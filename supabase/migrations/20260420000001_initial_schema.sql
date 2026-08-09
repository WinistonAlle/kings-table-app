-- ══════════════════════════════════════════════════════
-- King's Table — Schema inicial
-- ══════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null default '',
  avatar_url  text,
  xp          integer not null default 0,
  streak      integer not null default 0,
  level       integer not null default 1,
  last_active date,
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Perfis públicos visíveis"
  on profiles for select using (true);

create policy "Usuário atualiza o próprio perfil"
  on profiles for update using (auth.uid() = id);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────
-- LEAGUES
-- ─────────────────────────────────────────────────────
create table leagues (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  owner_id        uuid not null references profiles(id) on delete cascade,
  slug            text unique,
  scoring_formula text not null default 'linear' check (scoring_formula in ('linear','exponential','custom')),
  points_win      integer not null default 100,
  points_itm      integer not null default 30,
  bonus_bounty    integer not null default 20,
  is_public       boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table leagues enable row level security;

create policy "Qualquer um lê ligas públicas ou próprias"
  on leagues for select using (is_public = true or owner_id = auth.uid());

create policy "Dono gerencia a liga"
  on leagues for all using (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────
-- LEAGUE MEMBERS
-- ─────────────────────────────────────────────────────
create table league_members (
  league_id  uuid references leagues(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  role       text not null default 'player' check (role in ('owner','admin','player')),
  joined_at  timestamptz not null default now(),
  primary key (league_id, user_id)
);

alter table league_members enable row level security;

create policy "Membros veem a lista da liga"
  on league_members for select
  using (
    exists (
      select 1 from league_members lm
      where lm.league_id = league_members.league_id and lm.user_id = auth.uid()
    )
  );

create policy "Dono/admin gerencia membros"
  on league_members for all
  using (
    exists (
      select 1 from league_members lm
      where lm.league_id = league_members.league_id
        and lm.user_id = auth.uid()
        and lm.role in ('owner','admin')
    )
  );

-- ─────────────────────────────────────────────────────
-- BLIND STRUCTURES
-- ─────────────────────────────────────────────────────
create table blind_structures (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  format      text not null check (format in ('deep','regular','turbo','hyper','rebuy','bounty')),
  owner_id    uuid references profiles(id) on delete set null,
  is_default  boolean not null default false,
  levels      jsonb not null default '[]',
  created_at  timestamptz not null default now()
);

alter table blind_structures enable row level security;

create policy "Estruturas padrão e próprias visíveis"
  on blind_structures for select
  using (is_default = true or owner_id = auth.uid());

create policy "Usuário cria estruturas"
  on blind_structures for insert with check (owner_id = auth.uid());

create policy "Dono edita estruturas"
  on blind_structures for update using (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────
-- TOURNAMENTS
-- ─────────────────────────────────────────────────────
create table tournaments (
  id                  uuid primary key default gen_random_uuid(),
  league_id           uuid references leagues(id) on delete set null,
  name                text not null,
  format              text not null check (format in ('deep','regular','turbo','hyper','rebuy','bounty')),
  status              text not null default 'upcoming' check (status in ('upcoming','running','paused','finished','cancelled')),
  buy_in              numeric(10,2) not null default 0,
  re_entry_allowed    boolean not null default false,
  max_re_entries      integer not null default 0,
  start_time          timestamptz,
  end_time            timestamptz,
  blind_structure_id  uuid references blind_structures(id),
  current_level       integer not null default 0,
  seconds_remaining   integer,
  created_by          uuid not null references profiles(id),
  created_at          timestamptz not null default now()
);

alter table tournaments enable row level security;

create policy "Criador e membros da liga veem torneios"
  on tournaments for select
  using (
    created_by = auth.uid()
    or league_id is null
    or exists (
      select 1 from league_members lm
      where lm.league_id = tournaments.league_id and lm.user_id = auth.uid()
    )
  );

create policy "Criador gerencia torneio"
  on tournaments for all using (created_by = auth.uid());

-- ─────────────────────────────────────────────────────
-- TOURNAMENT PLAYERS
-- ─────────────────────────────────────────────────────
create table tournament_players (
  id               uuid primary key default gen_random_uuid(),
  tournament_id    uuid not null references tournaments(id) on delete cascade,
  user_id          uuid references profiles(id) on delete set null,
  display_name     text not null,
  buy_ins          integer not null default 1,
  re_entries       integer not null default 0,
  add_ons          integer not null default 0,
  position         integer,
  prize            numeric(10,2),
  payment_status   text not null default 'pending' check (payment_status in ('pending','confirmed','disputed')),
  eliminated_at    timestamptz,
  registered_at    timestamptz not null default now()
);

alter table tournament_players enable row level security;

create policy "Organizador e participante veem jogadores"
  on tournament_players for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from tournaments t
      where t.id = tournament_id and t.created_by = auth.uid()
    )
  );

create policy "Organizador gerencia jogadores"
  on tournament_players for all
  using (
    exists (
      select 1 from tournaments t
      where t.id = tournament_id and t.created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────
-- LEAGUE STANDINGS
-- ─────────────────────────────────────────────────────
create table league_standings (
  id                  uuid primary key default gen_random_uuid(),
  league_id           uuid not null references leagues(id) on delete cascade,
  user_id             uuid not null references profiles(id) on delete cascade,
  points              integer not null default 0,
  tournaments_played  integer not null default 0,
  wins                integer not null default 0,
  itm_count           integer not null default 0,
  rank                integer,
  updated_at          timestamptz not null default now(),
  unique(league_id, user_id)
);

alter table league_standings enable row level security;

create policy "Standings visíveis para membros e ligas públicas"
  on league_standings for select
  using (
    exists (
      select 1 from league_members lm
      where lm.league_id = league_standings.league_id and lm.user_id = auth.uid()
    )
    or exists (
      select 1 from leagues l
      where l.id = league_standings.league_id and l.is_public = true
    )
  );

-- ─────────────────────────────────────────────────────
-- PAYMENT PROOFS
-- ─────────────────────────────────────────────────────
create table payment_proofs (
  id                uuid primary key default gen_random_uuid(),
  tournament_id     uuid not null references tournaments(id) on delete cascade,
  player_id         uuid not null references tournament_players(id) on delete cascade,
  storage_path      text not null,
  amount            numeric(10,2),
  ai_result         jsonb,
  ai_confidence     numeric(4,3),
  reviewed_by       uuid references profiles(id),
  status            text not null default 'pending' check (status in ('pending','confirmed','disputed','rejected')),
  submitted_at      timestamptz not null default now(),
  reviewed_at       timestamptz
);

alter table payment_proofs enable row level security;

create policy "Jogador e organizador veem comprovantes"
  on payment_proofs for select
  using (
    exists (
      select 1 from tournament_players tp
      where tp.id = player_id and tp.user_id = auth.uid()
    )
    or exists (
      select 1 from tournaments t
      where t.id = tournament_id and t.created_by = auth.uid()
    )
  );

create policy "Jogador envia comprovante"
  on payment_proofs for insert
  with check (
    exists (
      select 1 from tournament_players tp
      where tp.id = player_id and tp.user_id = auth.uid()
    )
  );

create policy "Organizador revisa comprovante"
  on payment_proofs for update
  using (
    exists (
      select 1 from tournaments t
      where t.id = tournament_id and t.created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────
-- CHAT MESSAGES
-- ─────────────────────────────────────────────────────
create table chat_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  role         text not null check (role in ('user','assistant')),
  content      text not null,
  context      jsonb,
  created_at   timestamptz not null default now()
);

alter table chat_messages enable row level security;

create policy "Usuário vê e envia próprias mensagens"
  on chat_messages for all using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────
-- STUDY PROGRESS
-- ─────────────────────────────────────────────────────
create table study_progress (
  user_id      uuid references profiles(id) on delete cascade,
  module_id    integer not null,
  completed    boolean not null default false,
  score        integer,
  xp_earned    integer not null default 0,
  completed_at timestamptz,
  primary key (user_id, module_id)
);

alter table study_progress enable row level security;

create policy "Usuário gerencia próprio progresso"
  on study_progress for all using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────
-- REALTIME para leaderboard ao vivo
-- ─────────────────────────────────────────────────────
alter publication supabase_realtime add table league_standings;
alter publication supabase_realtime add table tournament_players;
alter publication supabase_realtime add table tournaments;

-- ─────────────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────────────
create index idx_tournaments_league  on tournaments(league_id);
create index idx_tournaments_created on tournaments(created_by);
create index idx_tp_tournament       on tournament_players(tournament_id);
create index idx_standings_league    on league_standings(league_id, points desc);
create index idx_chat_user           on chat_messages(user_id, created_at desc);
create index idx_study_user          on study_progress(user_id);

-- ─────────────────────────────────────────────────────
-- STORAGE bucket para comprovantes
-- ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,  -- 5MB
  array['image/jpeg','image/png','image/webp','application/pdf']
);

create policy "Jogador faz upload do próprio comprovante"
  on storage.objects for insert
  with check (bucket_id = 'payment-proofs' and auth.role() = 'authenticated');

create policy "Organizador e jogador leem comprovantes"
  on storage.objects for select
  using (bucket_id = 'payment-proofs' and auth.role() = 'authenticated');
