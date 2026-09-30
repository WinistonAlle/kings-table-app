create function kt_private.promote_tournament_waitlist(p_tournament_id uuid, p_exclude uuid default null) returns integer
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
      order by i.created_at, i.id for update
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
revoke all on function kt_private.promote_tournament_waitlist(uuid,uuid) from public, anon, authenticated;

create function kt_private.promote_after_invite_release() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.deleted_at is null and old.status = 'confirmed'
    and (new.status <> 'confirmed' or new.deleted_at is not null) then
    perform kt_private.promote_tournament_waitlist(new.tournament_id,
      case when new.status = 'waiting' and new.deleted_at is null then new.id else null end);
  end if;
  return new;
end;
$$;
revoke all on function kt_private.promote_after_invite_release() from public, anon, authenticated;
create trigger promote_after_invite_release after update of status, deleted_at on public.tournament_invites
  for each row execute function kt_private.promote_after_invite_release();

create function kt_private.promote_after_capacity_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.details->>'capacity' is distinct from old.details->>'capacity' then
    perform kt_private.promote_tournament_waitlist(new.id);
  end if;
  return new;
end;
$$;
revoke all on function kt_private.promote_after_capacity_change() from public, anon, authenticated;
create trigger promote_after_capacity_change after update of details on public.tournaments
  for each row execute function kt_private.promote_after_capacity_change();

create function kt_private.promote_after_player_remove() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform kt_private.promote_tournament_waitlist(old.tournament_id);
  return old;
end;
$$;
revoke all on function kt_private.promote_after_player_remove() from public, anon, authenticated;
create trigger promote_after_player_remove after delete on public.tournament_players
  for each row execute function kt_private.promote_after_player_remove();
