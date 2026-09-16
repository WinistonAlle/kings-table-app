-- Harden the existing private domain before enabling account backups.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), ''), new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop policy "Perfis públicos visíveis" on public.profiles;
create policy "Account reads own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
alter policy "Usuário atualiza o próprio perfil" on public.profiles to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- These policies must not recursively query league_members itself.
drop policy "Membros veem a lista da liga" on public.league_members;
drop policy "Dono/admin gerencia membros" on public.league_members;
create policy "Member reads own membership or owner roster" on public.league_members for select to authenticated
using (user_id = (select auth.uid()) or exists (select 1 from public.leagues l where l.id = league_id and l.owner_id = (select auth.uid())));
create policy "League owner manages memberships" on public.league_members for all to authenticated
using (exists (select 1 from public.leagues l where l.id = league_id and l.owner_id = (select auth.uid())))
with check (exists (select 1 from public.leagues l where l.id = league_id and l.owner_id = (select auth.uid())));

alter policy "Criador e membros da liga veem torneios" on public.tournaments to authenticated
using (created_by = (select auth.uid()) or exists (select 1 from public.league_members lm where lm.league_id = tournaments.league_id and lm.user_id = (select auth.uid())));
alter policy "Criador gerencia torneio" on public.tournaments to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

drop policy "Jogador faz upload do próprio comprovante" on storage.objects;
drop policy "Organizador e jogador leem comprovantes" on storage.objects;
create policy "Account uploads own proof path" on storage.objects for insert to authenticated
with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Account or linked organizer reads proof" on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = (select auth.uid())::text
or exists (select 1 from public.payment_proofs p join public.tournaments t on t.id = p.tournament_id where p.storage_path = objects.name and t.created_by = (select auth.uid()))));

create table public.account_backups (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and snapshot->>'version' = '1' and octet_length(snapshot::text) <= 5242880),
  updated_at timestamptz not null default now()
);
alter table public.account_backups enable row level security;
revoke all on public.account_backups from anon, authenticated;
grant select, insert, update on public.account_backups to authenticated;
create policy "Owner reads backup" on public.account_backups for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owner creates backup" on public.account_backups for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owner updates backup" on public.account_backups for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Optimistic concurrency prevents silently replacing another device's copy.
create function public.save_account_backup(p_snapshot jsonb, p_expected_revision integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.account_backups;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid revision' using errcode = '22023'; end if;
  if p_expected_revision = 0 then
    insert into public.account_backups(owner_id, snapshot) values (auth.uid(), p_snapshot)
    on conflict (owner_id) do nothing returning * into saved;
  else
    update public.account_backups set snapshot = p_snapshot, revision = revision + 1, updated_at = now()
    where owner_id = auth.uid() and revision = p_expected_revision returning * into saved;
  end if;
  if saved.owner_id is null then raise exception 'Backup changed on another device' using errcode = '40001'; end if;
  return jsonb_build_object('revision', saved.revision, 'updated_at', saved.updated_at);
end;
$$;
revoke all on function public.save_account_backup(jsonb, integer) from public, anon;
grant execute on function public.save_account_backup(jsonb, integer) to authenticated;
