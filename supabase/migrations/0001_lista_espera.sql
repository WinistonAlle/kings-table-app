-- Lista de espera da landing.
--
-- ATENÇÃO: migração não roda sozinha. Cole este SQL no editor do Supabase do
-- projeto `kings-table`. Migração commitada não é migração aplicada.

create table if not exists public.lista_espera (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  origem     text,
  criado_em  timestamptz not null default now()
);

alter table public.lista_espera enable row level security;

-- UMA policy, e só de INSERT.
--
-- Quem visita o site precisa poder entrar na lista e NÃO pode poder lê-la.
-- Sem policy de select, `select * from lista_espera` com a chave anônima
-- volta vazio mesmo que alguém descubra o nome da tabela — que é público,
-- porque a chave anônima vai no navegador por definição.
--
-- Uma policy de select aqui transformaria a dobra nova num vazamento de
-- e-mails dos primeiros interessados no produto.
drop policy if exists "qualquer um entra na lista" on public.lista_espera;
create policy "qualquer um entra na lista"
  on public.lista_espera
  for insert
  to anon
  with check (true);
