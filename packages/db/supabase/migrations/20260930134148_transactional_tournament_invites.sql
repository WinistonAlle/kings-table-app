create table public.tournament_invites (
  id uuid primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 60),
  status text not null check (status in ('confirmed','maybe','absent','waiting')),
  player_id uuid references public.tournament_players(id) on delete set null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  deleted_at timestamptz
);
create unique index tournament_invites_live_name on public.tournament_invites
  (tournament_id, pg_catalog.lower(pg_catalog.btrim(name))) where deleted_at is null;
create unique index tournament_invites_live_player on public.tournament_invites(tournament_id, player_id)
  where player_id is not null and deleted_at is null;
create index tournament_invites_page on public.tournament_invites(tournament_id, id);
alter table public.tournament_invites enable row level security;
revoke all on public.tournament_invites from public, anon, authenticated;
grant select on public.tournament_invites to authenticated;
create policy "Organizer reads own invitations" on public.tournament_invites
  for select to authenticated using (
    exists(select 1 from public.tournaments t
      where t.id = tournament_id and t.created_by = (select auth.uid()))
  );

create function kt_private.reserved_tournament_places(p_tournament_id uuid) returns integer
language sql security definer set search_path = '' as $$
  select pg_catalog.count(*)::integer from (
    select pg_catalog.lower(pg_catalog.btrim(p.display_name)) as key
      from public.tournament_players p where p.tournament_id = p_tournament_id
    union
    select pg_catalog.lower(pg_catalog.btrim(i.name)) as key
      from public.tournament_invites i where i.tournament_id = p_tournament_id
        and i.status = 'confirmed' and i.deleted_at is null
  ) names;
$$;
revoke all on function kt_private.reserved_tournament_places(uuid) from public, anon, authenticated;

create function kt_private.enforce_tournament_reservations() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cap integer; places integer;
begin
  if tg_table_name = 'tournaments' then
    if new.status = 'upcoming' and new.details is distinct from old.details then
      cap := nullif(new.details->>'capacity', '')::integer;
      if cap is not null and kt_private.reserved_tournament_places(new.id) > cap then
        raise exception 'Capacity below confirmed reservations' using errcode = '22023';
      end if;
    end if;
  elsif tg_table_name = 'tournament_players' then
    select nullif(t.details->>'capacity','')::integer into cap
      from public.tournaments t where t.id = new.tournament_id and t.status = 'upcoming';
    if cap is not null then
      select pg_catalog.count(*)::integer into places from (
        select pg_catalog.lower(pg_catalog.btrim(p.display_name)) as key
          from public.tournament_players p where p.tournament_id = new.tournament_id
        union
        select pg_catalog.lower(pg_catalog.btrim(i.name)) as key
          from public.tournament_invites i where i.tournament_id = new.tournament_id
            and i.status = 'confirmed' and i.deleted_at is null
        union
        select pg_catalog.lower(pg_catalog.btrim(new.display_name)) as key
      ) names;
      if places > cap then raise exception 'Confirmed reservations fill the table' using errcode = '22023'; end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function kt_private.enforce_tournament_reservations() from public, anon, authenticated;
create trigger enforce_tournament_capacity_on_planning before update of details on public.tournaments
  for each row execute function kt_private.enforce_tournament_reservations();
create trigger enforce_tournament_capacity_on_player before insert on public.tournament_players
  for each row execute function kt_private.enforce_tournament_reservations();

create function kt_private.apply_tournament_invite_operation(op jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  v_operation_id uuid;
  entity_id uuid;
  expected bigint;
  previous public.sync_operation_receipts;
  existing public.tournaments;
  target public.tournament_invites;
  player public.tournament_players;
  payload jsonb;
  kind text;
  invite_id uuid;
  v_player_id uuid;
  invite_name text;
  requested text;
  cap integer;
  at_time timestamptz;
  result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform kt_private.validate_operation(op);
  if (op->>'ownerId')::uuid <> actor then raise exception 'Actor mismatch' using errcode = '42501'; end if;
  kind := op->>'kind';
  if op->>'entity' <> 'tournament' or kind not in
    ('invite.add','invite.attendance','invite.remove','invite.checkIn') then
    raise exception 'Unsupported invitation command' using errcode = '22023';
  end if;
  v_operation_id := (op->>'id')::uuid;
  entity_id := (op->>'entityId')::uuid;
  expected := (op->>'expectedRevision')::numeric::bigint;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('operation:' || actor || ':' || v_operation_id, 0));
  select * into previous from public.sync_operation_receipts r
    where r.actor_id = actor and r.operation_id = v_operation_id;
  if found then
    if previous.envelope <> op then raise exception 'Operation ID reused with different content' using errcode = '22023'; end if;
    return previous.receipt;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tournament:' || entity_id, 0));
  select * into existing from public.tournaments t where t.id = entity_id for update;
  if not found then raise exception 'Tournament revision conflict' using errcode = '40001'; end if;
  if existing.created_by is distinct from actor then raise exception 'Tournament not writable' using errcode = '42501'; end if;
  if existing.revision <> expected then raise exception 'Tournament revision conflict' using errcode = '40001'; end if;
  if existing.deleted_at is not null or existing.status <> 'upcoming' then
    raise exception 'Invitations are closed' using errcode = '55000';
  end if;

  payload := op->'payload';
  if not (payload ? 'inviteId') or pg_catalog.jsonb_typeof(payload->'inviteId') <> 'string'
    or payload->>'inviteId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Invalid invitation identity' using errcode = '22023';
  end if;
  invite_id := (payload->>'inviteId')::uuid;
  cap := nullif(existing.details->>'capacity', '')::integer;
  at_time := pg_catalog.clock_timestamp();

  if kind = 'invite.add' then
    if not (payload ?& array['inviteId','name','status'])
      or (payload - array['inviteId','name','status']) <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(payload->'name') <> 'string'
      or pg_catalog.jsonb_typeof(payload->'status') <> 'string'
      or payload->>'status' not in ('confirmed','maybe','absent','waiting') then
      raise exception 'Invalid invitation payload' using errcode = '22023';
    end if;
    invite_name := pg_catalog.regexp_replace(payload->>'name', '^\s+|\s+$', '', 'g');
    if pg_catalog.char_length(invite_name) not between 1 and 60 then
      raise exception 'Invalid invitation name' using errcode = '22023';
    end if;
    requested := payload->>'status';
    insert into public.tournament_invites(id,tournament_id,name,status,created_at)
      values(invite_id,entity_id,invite_name,requested,at_time);
    if requested = 'confirmed' and cap is not null
      and kt_private.reserved_tournament_places(entity_id) > cap then
      update public.tournament_invites set status = 'waiting' where id = invite_id;
    end if;
  else
    select * into target from public.tournament_invites i
      where i.id = invite_id and i.tournament_id = entity_id and i.deleted_at is null for update;
    if not found then raise exception 'Invitation not found' using errcode = '22023'; end if;
    if kind = 'invite.attendance' then
      if (payload - array['inviteId','status']) <> '{}'::jsonb
        or not (payload ? 'status') or pg_catalog.jsonb_typeof(payload->'status') <> 'string'
        or payload->>'status' not in ('confirmed','maybe','absent','waiting')
        or target.player_id is not null then
        raise exception 'Invitation cannot change attendance' using errcode = '22023';
      end if;
      requested := payload->>'status';
      update public.tournament_invites set status = requested where id = invite_id;
      if requested = 'confirmed' and cap is not null
        and kt_private.reserved_tournament_places(entity_id) > cap then
        update public.tournament_invites set status = 'waiting' where id = invite_id;
      end if;
    elsif kind = 'invite.remove' then
      if (payload - 'inviteId') <> '{}'::jsonb or target.player_id is not null then
        raise exception 'Checked-in invitation cannot be removed' using errcode = '55000';
      end if;
      update public.tournament_invites set deleted_at = at_time where id = invite_id;
    else
      if not (payload ?& array['inviteId','playerId'])
        or (payload - array['inviteId','playerId']) <> '{}'::jsonb
        or pg_catalog.jsonb_typeof(payload->'playerId') <> 'string'
        or payload->>'playerId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or target.status <> 'confirmed' or target.player_id is not null then
        raise exception 'Invitation cannot check in' using errcode = '55000';
      end if;
      v_player_id := (payload->>'playerId')::uuid;
      select * into player from public.tournament_players p
        where p.tournament_id = entity_id
          and pg_catalog.lower(pg_catalog.btrim(p.display_name)) = pg_catalog.lower(pg_catalog.btrim(target.name))
        for update;
      if found then
        if player.id <> v_player_id then raise exception 'Player identity changed' using errcode = '40001'; end if;
      else
        insert into public.tournament_players(id,tournament_id,user_id,display_name,buy_ins,
          re_entries,add_ons,payment_status)
        values(v_player_id,entity_id,null,target.name,1,0,0,'pending');
      end if;
      update public.tournament_invites set player_id = v_player_id where id = invite_id;
    end if;
  end if;

  update public.tournaments set revision = expected + 1, updated_at = at_time where id = entity_id;
  result := pg_catalog.jsonb_build_object('operationId',v_operation_id,'revision',expected + 1);
  insert into public.sync_operation_receipts values(actor,v_operation_id,op,result,at_time);
  insert into public.sync_operation_audit values(actor,v_operation_id,entity_id,
    'tournament',kind,expected,expected + 1,at_time);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Invalid invitation values' using errcode = '22023';
end;
$$;
revoke all on function kt_private.apply_tournament_invite_operation(jsonb) from public, anon, authenticated;
grant execute on function kt_private.apply_tournament_invite_operation(jsonb) to authenticated;

create or replace function public.apply_tournament_operation(p_operation jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  if p_operation->>'kind' = 'tournament.create' then
    return kt_private.apply_tournament_operation(p_operation);
  elsif p_operation->>'kind' = 'tournament.update' then
    return kt_private.apply_tournament_planning_operation(p_operation);
  elsif p_operation->>'kind' = 'player.add' then
    return kt_private.apply_player_add_operation(p_operation);
  elsif p_operation->>'kind' = 'player.update' then
    return kt_private.apply_player_rename_operation(p_operation);
  elsif p_operation->>'kind' = 'player.remove' then
    return kt_private.apply_player_remove_operation(p_operation);
  elsif p_operation->>'kind' = 'player.payment.set' then
    return kt_private.apply_player_payment_operation(p_operation);
  elsif p_operation->>'kind' = 'player.entries.adjust' then
    return kt_private.apply_player_entry_operation(p_operation);
  elsif p_operation->>'kind' in ('player.eliminate','player.undoElimination') then
    return kt_private.apply_player_result_operation(p_operation);
  elsif p_operation->>'kind' in ('invite.add','invite.attendance','invite.remove','invite.checkIn') then
    return kt_private.apply_tournament_invite_operation(p_operation);
  elsif p_operation->>'kind' in ('tournament.start','clock.start','clock.pause',
    'clock.level','clock.reset','clock.handForHand') then
    return kt_private.apply_tournament_clock_operation(p_operation);
  end if;
  raise exception 'Unsupported tournament command' using errcode = '22023';
end;
$$;
revoke all on function public.apply_tournament_operation(jsonb) from public, anon, authenticated;
grant execute on function public.apply_tournament_operation(jsonb) to authenticated;
