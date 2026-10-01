-- Preserve receipt-first retry and the existing tournament lock before checking players.
create or replace function kt_private.apply_tournament_clock_operation(op jsonb) returns jsonb
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
    if not exists (select 1 from public.tournament_players p
      where p.tournament_id = entity_id and p.position is null) then
      raise exception 'Tournament requires a registered player' using errcode = '55000';
    end if;
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
