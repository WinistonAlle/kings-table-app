-- Planning edits are separate from game, player, clock and financial commands.
create function kt_private.apply_tournament_planning_operation(op jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  v_operation_id uuid;
  entity_id uuid;
  expected bigint;
  previous public.sync_operation_receipts;
  existing public.tournaments;
  payload jsonb;
  new_start timestamptz;
  new_location text;
  new_capacity integer;
  new_details jsonb;
  at_time timestamptz;
  result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform kt_private.validate_operation(op);
  if (op->>'ownerId')::uuid <> actor then raise exception 'Actor mismatch' using errcode = '42501'; end if;
  if op->>'entity' <> 'tournament' or op->>'kind' <> 'tournament.update' then
    raise exception 'Unsupported tournament command' using errcode = '22023';
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
    raise exception 'Tournament cannot be planned now' using errcode = '55000';
  end if;

  payload := op->'payload';
  if not payload ?& array['startTime','location','capacity']
    or (payload - array['startTime','location','capacity']) <> '{}'::jsonb
    or jsonb_typeof(payload->'startTime') <> 'string'
    or jsonb_typeof(payload->'location') <> 'string'
    or jsonb_typeof(payload->'capacity') not in ('number','null') then
    raise exception 'Invalid planning payload' using errcode = '22023';
  end if;
  if payload->>'startTime' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$' then
    raise exception 'Invalid start time' using errcode = '22023';
  end if;
  new_start := (payload->>'startTime')::timestamptz;
  if new_start <= pg_catalog.clock_timestamp() then
    raise exception 'Start time must be in the future' using errcode = '22023';
  end if;
  new_location := pg_catalog.regexp_replace(payload->>'location', '^\s+|\s+$', '', 'g');
  if pg_catalog.char_length(new_location) > 200 then raise exception 'Location too long' using errcode = '22023'; end if;
  if jsonb_typeof(payload->'capacity') = 'number' then
    if (payload->>'capacity')::numeric not between 2 and 1000
      or pg_catalog.trunc((payload->>'capacity')::numeric) <> (payload->>'capacity')::numeric then
      raise exception 'Invalid capacity' using errcode = '22023';
    end if;
    new_capacity := (payload->>'capacity')::integer;
    if new_capacity < (select count(*) from public.tournament_players where tournament_id = entity_id) then
      raise exception 'Capacity below registered players' using errcode = '22023';
    end if;
  end if;
  new_details := (existing.details - 'location' - 'capacity') ||
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'location', case when new_location = '' then null else new_location end,
      'capacity', new_capacity));
  at_time := pg_catalog.clock_timestamp();
  update public.tournaments set start_time = new_start, details = new_details,
    revision = expected + 1, updated_at = at_time where id = entity_id;
  result := pg_catalog.jsonb_build_object('operationId', v_operation_id, 'revision', expected + 1);
  insert into public.sync_operation_receipts values(actor, v_operation_id, op, result, at_time);
  insert into public.sync_operation_audit values(actor, v_operation_id, entity_id,
    'tournament', 'tournament.update', expected, expected + 1, at_time);
  return result;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
  raise exception 'Invalid planning values' using errcode = '22023';
end;
$$;

create or replace function public.apply_tournament_operation(p_operation jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  if p_operation->>'kind' = 'tournament.create' then
    return kt_private.apply_tournament_operation(p_operation);
  elsif p_operation->>'kind' = 'tournament.update' then
    return kt_private.apply_tournament_planning_operation(p_operation);
  end if;
  raise exception 'Unsupported tournament command' using errcode = '22023';
end;
$$;
revoke all on function kt_private.apply_tournament_planning_operation(jsonb),
  public.apply_tournament_operation(jsonb) from public, anon, authenticated;
grant execute on function kt_private.apply_tournament_planning_operation(jsonb),
  public.apply_tournament_operation(jsonb) to authenticated;
