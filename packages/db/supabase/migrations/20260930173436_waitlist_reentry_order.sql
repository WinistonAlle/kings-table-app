alter table public.tournament_invites add column waiting_since timestamptz;
update public.tournament_invites set waiting_since = created_at where status = 'waiting';
alter table public.tournament_invites add constraint tournament_invites_waiting_since_matches_status
  check ((status = 'waiting') = (waiting_since is not null));
create index tournament_invites_waiting_order on public.tournament_invites
  (tournament_id, waiting_since, id) where status = 'waiting' and deleted_at is null;

create function kt_private.set_tournament_invite_waiting_since() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'waiting' then
    if tg_op = 'INSERT' then
      new.waiting_since := new.created_at;
    elsif old.status <> 'waiting' then
      new.waiting_since := pg_catalog.clock_timestamp();
    end if;
  else
    new.waiting_since := null;
  end if;
  return new;
end;
$$;
revoke all on function kt_private.set_tournament_invite_waiting_since() from public, anon, authenticated;
create trigger set_tournament_invite_waiting_since
  before insert or update of status on public.tournament_invites
  for each row execute function kt_private.set_tournament_invite_waiting_since();

create or replace function kt_private.promote_tournament_waitlist(p_tournament_id uuid, p_exclude uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cap integer;
  table_status text;
  removed_at timestamptz;
  candidate record;
  promoted integer := 0;
begin
  select nullif(t.details->>'capacity','')::integer, t.status, t.deleted_at
    into cap, table_status, removed_at
    from public.tournaments t where t.id = p_tournament_id for update;
  if not found or table_status <> 'upcoming' or removed_at is not null then return 0; end if;

  for candidate in
    select i.id, i.name from public.tournament_invites i
      where i.tournament_id = p_tournament_id and i.status = 'waiting'
        and i.deleted_at is null and i.id is distinct from p_exclude
      order by i.waiting_since, i.id for update
  loop
    if cap is not null and kt_private.reserved_tournament_places(p_tournament_id) >= cap
      and not exists (
        select 1 from public.tournament_players p
          where p.tournament_id = p_tournament_id
            and pg_catalog.lower(pg_catalog.btrim(p.display_name)) = pg_catalog.lower(pg_catalog.btrim(candidate.name))
      ) then exit; end if;
    update public.tournament_invites set status = 'confirmed' where id = candidate.id;
    promoted := promoted + 1;
  end loop;
  return promoted;
end;
$$;
