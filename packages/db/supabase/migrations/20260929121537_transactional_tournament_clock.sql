-- Wall-clock anchor is independent of tournament.updated_at, which changes for players and payments.
alter table public.tournaments
  add column clock_ends_at timestamptz,
  add column clock_hand_for_hand boolean not null default false,
  add constraint tournament_clock_anchor_valid
    check (clock_ends_at is null or (status = 'running' and not clock_hand_for_hand));

create or replace function kt_private.tournament_clock_at(t public.tournaments, at_time timestamptz) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  level_index integer := t.current_level;
  levels_count integer;
  remaining integer;
  ends_at timestamptz := t.clock_ends_at;
  running boolean;
  duration_seconds integer;
begin
  if pg_catalog.jsonb_typeof(t.blind_levels) <> 'array' then
    raise exception 'Clock structure is invalid' using errcode = '55000';
  end if;
  levels_count := pg_catalog.jsonb_array_length(t.blind_levels);
  if levels_count = 0 or level_index < 0 or level_index >= levels_count then
    raise exception 'Clock level is invalid' using errcode = '55000';
  end if;
  duration_seconds := (t.blind_levels->level_index->>'durationMinutes')::integer * 60;
  remaining := coalesce(t.seconds_remaining, duration_seconds);
  if duration_seconds <= 0 or remaining < 0 then
    raise exception 'Clock duration is invalid' using errcode = '55000';
  end if;
  running := ends_at is not null and t.status = 'running' and not t.clock_hand_for_hand;
  if running then
    while at_time >= ends_at loop
      if level_index + 1 >= levels_count then
        return pg_catalog.jsonb_build_object('currentLevel',level_index,
          'secondsRemaining',0,'levelEndsAt',null,'isRunning',false,
          'handForHand',t.clock_hand_for_hand);
      end if;
      level_index := level_index + 1;
      duration_seconds := (t.blind_levels->level_index->>'durationMinutes')::integer * 60;
      if duration_seconds <= 0 then raise exception 'Clock duration is invalid' using errcode = '55000'; end if;
      ends_at := ends_at + pg_catalog.make_interval(secs => duration_seconds);
    end loop;
    remaining := greatest(0,pg_catalog.ceil(extract(epoch from (ends_at - at_time)))::integer);
  end if;
  return pg_catalog.jsonb_build_object('currentLevel',level_index,
    'secondsRemaining',remaining,'levelEndsAt',ends_at,'isRunning',running,
    'handForHand',t.clock_hand_for_hand);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Clock structure is invalid' using errcode = '55000';
end;
$$;

create function public.read_tournament_clock(p_tournament_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  t public.tournaments;
  at_time timestamptz := pg_catalog.clock_timestamp();
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into t from public.tournaments row
    where row.id = p_tournament_id and row.created_by = auth.uid() and row.deleted_at is null;
  if not found then raise exception 'Clock is not available to this account' using errcode = '42501'; end if;
  return kt_private.tournament_clock_at(t,at_time) ||
    pg_catalog.jsonb_build_object('revision',t.revision,'serverNow',at_time);
end;
$$;
revoke all on function public.read_tournament_clock(uuid) from public, anon, authenticated;
grant execute on function public.read_tournament_clock(uuid) to authenticated;

create function kt_private.apply_tournament_clock_operation(op jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  v_operation_id uuid;
  entity_id uuid;
  expected bigint;
  previous public.sync_operation_receipts;
  existing public.tournaments;
  payload jsonb;
  kind text;
  state jsonb;
  next_status text;
  next_level integer;
  next_remaining integer;
  next_ends_at timestamptz;
  next_hand boolean;
  target_level integer;
  at_time timestamptz;
  result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform kt_private.validate_operation(op);
  if (op->>'ownerId')::uuid <> actor then raise exception 'Actor mismatch' using errcode = '42501'; end if;
  kind := op->>'kind';
  if op->>'entity' <> 'tournament' or kind not in
    ('tournament.start','clock.start','clock.pause','clock.level','clock.reset','clock.handForHand') then
    raise exception 'Unsupported clock command' using errcode = '22023';
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
  if existing.deleted_at is not null then raise exception 'Tournament is deleted' using errcode = '55000'; end if;
  payload := op->'payload';
  at_time := pg_catalog.clock_timestamp();
  state := kt_private.tournament_clock_at(existing,at_time);
  next_status := existing.status;
  next_level := (state->>'currentLevel')::integer;
  next_remaining := (state->>'secondsRemaining')::integer;
  next_ends_at := case when state->>'isRunning' = 'true' then (state->>'levelEndsAt')::timestamptz else null end;
  next_hand := existing.clock_hand_for_hand;

  if kind = 'tournament.start' then
    if payload <> '{}'::jsonb then raise exception 'Start requires empty payload' using errcode = '22023'; end if;
    if existing.status <> 'upcoming' then raise exception 'Tournament already started' using errcode = '55000'; end if;
    next_status := 'running';
  else
    if existing.status <> 'running' then raise exception 'Clock requires a running tournament' using errcode = '55000'; end if;
    if kind = 'clock.start' then
      if payload <> '{}'::jsonb then raise exception 'Start requires empty payload' using errcode = '22023'; end if;
      if next_ends_at is not null or next_hand or next_remaining <= 0 then
        raise exception 'Clock cannot start now' using errcode = '55000';
      end if;
      next_ends_at := at_time + pg_catalog.make_interval(secs => next_remaining);
    elsif kind = 'clock.pause' then
      if payload <> '{}'::jsonb then raise exception 'Pause requires empty payload' using errcode = '22023'; end if;
      if existing.clock_ends_at is null then raise exception 'Clock is already paused' using errcode = '55000'; end if;
      next_ends_at := null;
    elsif kind = 'clock.level' then
      if not payload ? 'level' or (payload - 'level') <> '{}'::jsonb
        or pg_catalog.jsonb_typeof(payload->'level') <> 'number'
        or (payload->>'level')::numeric not between 0 and pg_catalog.jsonb_array_length(existing.blind_levels)-1
        or pg_catalog.trunc((payload->>'level')::numeric) <> (payload->>'level')::numeric then
        raise exception 'Invalid clock level' using errcode = '22023';
      end if;
      target_level := (payload->>'level')::integer;
      next_level := target_level;
      next_remaining := (existing.blind_levels->target_level->>'durationMinutes')::integer * 60;
      next_ends_at := case when state->>'isRunning' = 'true'
        then at_time + pg_catalog.make_interval(secs => next_remaining) else null end;
    elsif kind = 'clock.reset' then
      if payload <> '{}'::jsonb then raise exception 'Reset requires empty payload' using errcode = '22023'; end if;
      next_level := 0;
      next_remaining := (existing.blind_levels->0->>'durationMinutes')::integer * 60;
      next_ends_at := null;
      next_hand := false;
    elsif kind = 'clock.handForHand' then
      if not payload ? 'enabled' or (payload - 'enabled') <> '{}'::jsonb
        or pg_catalog.jsonb_typeof(payload->'enabled') <> 'boolean' then
        raise exception 'Invalid hand-for-hand setting' using errcode = '22023';
      end if;
      next_hand := (payload->>'enabled')::boolean;
      if next_hand = existing.clock_hand_for_hand then
        raise exception 'Hand-for-hand setting is unchanged' using errcode = '22023';
      end if;
      next_ends_at := null;
    end if;
  end if;

  update public.tournaments set status = next_status, current_level = next_level,
    seconds_remaining = next_remaining, clock_ends_at = next_ends_at,
    clock_hand_for_hand = next_hand, revision = expected + 1, updated_at = at_time
    where id = entity_id;
  result := pg_catalog.jsonb_build_object('operationId',v_operation_id,'revision',expected + 1);
  insert into public.sync_operation_receipts values(actor,v_operation_id,op,result,at_time);
  insert into public.sync_operation_audit values(actor,v_operation_id,entity_id,
    'tournament',kind,expected,expected + 1,at_time);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Invalid clock values' using errcode = '22023';
end;
$$;
revoke all on function kt_private.apply_tournament_clock_operation(jsonb) from public, anon, authenticated;
grant execute on function kt_private.apply_tournament_clock_operation(jsonb) to authenticated;

create or replace function public.apply_tournament_operation(p_operation jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  if p_operation->>'kind' = 'tournament.create' then
    return kt_private.apply_tournament_operation(p_operation);
  elsif p_operation->>'kind' = 'tournament.update' then
    return kt_private.apply_tournament_planning_operation(p_operation);
  elsif p_operation->>'kind' = 'player.add' then
    return kt_private.apply_player_add_operation(p_operation);
  elsif p_operation->>'kind' = 'player.remove' then
    return kt_private.apply_player_remove_operation(p_operation);
  elsif p_operation->>'kind' = 'player.payment.set' then
    return kt_private.apply_player_payment_operation(p_operation);
  elsif p_operation->>'kind' = 'player.entries.adjust' then
    return kt_private.apply_player_entry_operation(p_operation);
  elsif p_operation->>'kind' in ('tournament.start','clock.start','clock.pause',
    'clock.level','clock.reset','clock.handForHand') then
    return kt_private.apply_tournament_clock_operation(p_operation);
  end if;
  raise exception 'Unsupported tournament command' using errcode = '22023';
end;
$$;
revoke all on function public.apply_tournament_operation(jsonb) from public, anon, authenticated;
grant execute on function public.apply_tournament_operation(jsonb) to authenticated;
