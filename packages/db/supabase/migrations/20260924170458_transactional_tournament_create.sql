-- First tournament command. It does not enable client synchronization.
alter table public.tournaments
  add column revision bigint not null default 0 check (revision between 0 and 9007199254740991),
  add column deleted_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add column blind_levels jsonb not null default '[]'::jsonb,
  add column details jsonb not null default '{}'::jsonb;

-- A browser cannot bypass revisions, receipts and server-side validation.
revoke all on public.tournaments from public, anon, authenticated;
grant select on public.tournaments to authenticated;
drop policy "Criador gerencia torneio" on public.tournaments;

create function kt_private.apply_tournament_operation(op jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  v_operation_id uuid;
  entity_id uuid;
  expected bigint;
  previous public.sync_operation_receipts;
  existing public.tournaments;
  payload jsonb;
  amount numeric;
  max_entries integer;
  start_at timestamptz;
  at_time timestamptz;
  v_name text;
  v_location text;
  v_details jsonb;
  result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform kt_private.validate_operation(op);
  if (op->>'ownerId')::uuid <> actor then raise exception 'Actor mismatch' using errcode = '42501'; end if;
  if op->>'entity' <> 'tournament' or op->>'kind' <> 'tournament.create' then
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
  if found and existing.created_by is distinct from actor then
    raise exception 'Tournament not writable' using errcode = '42501';
  end if;
  if found or expected <> 0 then
    raise exception 'Tournament revision conflict' using errcode = '40001';
  end if;

  payload := op->'payload';
  if not payload ?& array['name','format','buyIn','reEntryAllowed','maxReEntries','startTime','levels']
    or (payload - array['name','format','buyIn','reEntryAllowed','maxReEntries','startTime','levels','suit','color','location','capacity']) <> '{}'::jsonb
    or jsonb_typeof(payload->'name') <> 'string'
    or jsonb_typeof(payload->'format') <> 'string'
    or jsonb_typeof(payload->'buyIn') <> 'number'
    or jsonb_typeof(payload->'reEntryAllowed') <> 'boolean'
    or jsonb_typeof(payload->'maxReEntries') <> 'number'
    or jsonb_typeof(payload->'startTime') <> 'string' then
    raise exception 'Invalid tournament payload' using errcode = '22023';
  end if;
  v_name := pg_catalog.regexp_replace(payload->>'name', '^\s+|\s+$', '', 'g');
  if pg_catalog.char_length(v_name) not between 1 and 120
    or payload->>'format' not in ('deep','regular','turbo','hyper','rebuy','bounty') then
    raise exception 'Invalid tournament name or format' using errcode = '22023';
  end if;
  amount := (payload->>'buyIn')::numeric;
  if amount not between 0.01 and 99999999.99 or pg_catalog.trunc(amount * 100) <> amount * 100 then
    raise exception 'Invalid buy-in' using errcode = '22023';
  end if;
  if (payload->>'maxReEntries')::numeric not between 0 and 100
    or pg_catalog.trunc((payload->>'maxReEntries')::numeric) <> (payload->>'maxReEntries')::numeric then
    raise exception 'Invalid re-entry limit' using errcode = '22023';
  end if;
  max_entries := (payload->>'maxReEntries')::integer;
  if payload->'reEntryAllowed' = 'false'::jsonb and max_entries <> 0 then
    raise exception 'Re-entry limit requires re-entry' using errcode = '22023';
  end if;
  if payload->>'startTime' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$' then
    raise exception 'Invalid start time' using errcode = '22023';
  end if;
  start_at := (payload->>'startTime')::timestamptz;
  perform kt_private.validate_preset_levels(payload->'levels');
  if payload ? 'suit' and (jsonb_typeof(payload->'suit') <> 'string'
    or payload->>'suit' not in ('espada','copas','ouros','paus')) then
    raise exception 'Invalid suit' using errcode = '22023';
  end if;
  if payload ? 'color' and (jsonb_typeof(payload->'color') <> 'string'
    or payload->>'color' !~ '^#[0-9a-fA-F]{6}$') then
    raise exception 'Invalid color' using errcode = '22023';
  end if;
  if payload ? 'location' then
    if jsonb_typeof(payload->'location') <> 'string' then
      raise exception 'Invalid location' using errcode = '22023';
    end if;
    v_location := pg_catalog.regexp_replace(payload->>'location', '^\s+|\s+$', '', 'g');
    if pg_catalog.char_length(v_location) > 200 then raise exception 'Location too long' using errcode = '22023'; end if;
  end if;
  if payload ? 'capacity' and (jsonb_typeof(payload->'capacity') <> 'number'
    or (payload->>'capacity')::numeric not between 2 and 1000
    or pg_catalog.trunc((payload->>'capacity')::numeric) <> (payload->>'capacity')::numeric) then
    raise exception 'Invalid capacity' using errcode = '22023';
  end if;
  v_details := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'suit', payload->'suit', 'color', payload->'color', 'location', to_jsonb(v_location),
    'capacity', payload->'capacity'));
  at_time := pg_catalog.clock_timestamp();
  insert into public.tournaments(id, name, format, status, buy_in, re_entry_allowed,
    max_re_entries, start_time, current_level, seconds_remaining, created_by,
    blind_levels, details, revision, updated_at)
  values(entity_id, v_name, payload->>'format', 'upcoming', amount,
    (payload->>'reEntryAllowed')::boolean, max_entries, start_at, 0,
    (payload->'levels'->0->>'durationMinutes')::integer * 60, actor,
    payload->'levels', v_details, 1, at_time);

  result := pg_catalog.jsonb_build_object('operationId', v_operation_id, 'revision', 1);
  insert into public.sync_operation_receipts values(actor, v_operation_id, op, result, at_time);
  insert into public.sync_operation_audit values(actor, v_operation_id, entity_id,
    'tournament', 'tournament.create', 0, 1, at_time);
  return result;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
  raise exception 'Invalid tournament values' using errcode = '22023';
end;
$$;

create function public.apply_tournament_operation(p_operation jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  select kt_private.apply_tournament_operation(p_operation);
$$;
revoke all on function kt_private.apply_tournament_operation(jsonb),
  public.apply_tournament_operation(jsonb) from public, anon, authenticated;
grant execute on function kt_private.apply_tournament_operation(jsonb),
  public.apply_tournament_operation(jsonb) to authenticated;
