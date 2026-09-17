-- Local-first command API. No application activation or legacy-ID migration.
create schema if not exists kt_private;
revoke all on schema kt_private from public, anon, authenticated;
grant usage on schema kt_private to authenticated;

alter table public.blind_structures
  add column revision bigint not null default 0 check (revision between 0 and 9007199254740991),
  add column deleted_at timestamptz,
  add column updated_at timestamptz not null default now();

-- Clients may read, but cannot bypass revisions/receipts with direct writes.
revoke all on public.blind_structures from public, anon, authenticated;
grant select on public.blind_structures to authenticated;
drop policy "Estruturas padrão e próprias visíveis" on public.blind_structures;
drop policy "Usuário cria estruturas" on public.blind_structures;
drop policy "Dono edita estruturas" on public.blind_structures;
create policy "Read own presets and live defaults" on public.blind_structures
  for select to authenticated
  using (owner_id = (select auth.uid()) or (is_default and deleted_at is null));

create table public.sync_operation_receipts (
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  envelope jsonb not null,
  receipt jsonb not null,
  committed_at timestamptz not null,
  primary key (actor_id, operation_id)
);
create table public.sync_operation_audit (
  actor_id uuid not null,
  operation_id uuid not null,
  entity_id uuid not null,
  entity text not null,
  kind text not null,
  before_revision bigint not null,
  after_revision bigint not null check (after_revision = before_revision + 1),
  committed_at timestamptz not null,
  primary key (actor_id, operation_id),
  foreign key (actor_id, operation_id) references public.sync_operation_receipts on delete cascade
);
create index sync_operation_audit_entity on public.sync_operation_audit(entity, entity_id, after_revision);
alter table public.sync_operation_receipts enable row level security;
alter table public.sync_operation_audit enable row level security;
revoke all on public.sync_operation_receipts, public.sync_operation_audit from public, anon, authenticated;
grant select on public.sync_operation_receipts, public.sync_operation_audit to authenticated;
create policy "Actor reads own receipts" on public.sync_operation_receipts
  for select to authenticated using (actor_id = (select auth.uid()));
create policy "Actor reads own command audit" on public.sync_operation_audit
  for select to authenticated using (actor_id = (select auth.uid()));

create function kt_private.validate_operation(op jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare key text;
begin
  if op is null or jsonb_typeof(op) <> 'object' then
    raise exception 'Invalid operation' using errcode = '22023';
  end if;
  if octet_length(op::text) > 1048576 or not op ?& array[
    'version','id','ownerId','entityId','entity','kind','expectedRevision','createdAt','payload']
    or (op - array['version','id','ownerId','entityId','entity','kind','expectedRevision','createdAt','payload']) <> '{}'
    or op->'version' <> '1'::jsonb
    or jsonb_typeof(op->'expectedRevision') <> 'number'
    or (op->>'expectedRevision')::numeric not between 0 and 9007199254740990
    or trunc((op->>'expectedRevision')::numeric) <> (op->>'expectedRevision')::numeric
    or jsonb_typeof(op->'payload') <> 'object'
    or jsonb_typeof(op->'entity') <> 'string' or jsonb_typeof(op->'kind') <> 'string'
    or jsonb_typeof(op->'createdAt') <> 'string'
    or op->>'createdAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$' then
    raise exception 'Invalid operation envelope' using errcode = '22023';
  end if;
  foreach key in array array['id','ownerId','entityId'] loop
      if jsonb_typeof(op->key) <> 'string' or op->>key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Invalid operation identity' using errcode = '22023';
      end if;
      perform (op->>key)::uuid;
  end loop;
  perform (op->>'createdAt')::timestamptz;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
  raise exception 'Invalid operation values' using errcode = '22023';
end;
$$;

create function kt_private.validate_preset_levels(levels jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare item jsonb; key text; value numeric; number integer := 0; is_break boolean;
begin
  if levels is null or jsonb_typeof(levels) <> 'array' then
    raise exception 'Levels must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(levels) not between 1 and 500 then
    raise exception 'Use between 1 and 500 levels' using errcode = '22023';
  end if;
  for item in select jsonb_array_elements(levels) loop
    if jsonb_typeof(item) <> 'object'
      or not item ?& array['level','smallBlind','bigBlind','ante','durationMinutes']
      or (item - array['level','smallBlind','bigBlind','ante','durationMinutes','isBreak']) <> '{}'
      or (item ? 'isBreak' and jsonb_typeof(item->'isBreak') <> 'boolean') then
      raise exception 'Invalid level fields' using errcode = '22023';
    end if;
    foreach key in array array['level','smallBlind','bigBlind','ante','durationMinutes'] loop
      if jsonb_typeof(item->key) <> 'number' then
        raise exception 'Level values must be numbers' using errcode = '22023';
      end if;
      value := (item->>key)::numeric;
      if value not between 0 and 9007199254740991 or trunc(value) <> value then
        raise exception 'Level values must be safe nonnegative integers' using errcode = '22023';
      end if;
    end loop;
    is_break := coalesce((item->>'isBreak')::boolean,false);
    if not is_break then number := number + 1; end if;
    if (item->>'level')::numeric <> number or (item->>'durationMinutes')::numeric not between 1 and 240
      or (is_break and ((item->>'smallBlind')::numeric <> 0 or (item->>'bigBlind')::numeric <> 0 or (item->>'ante')::numeric <> 0))
      or (not is_break and ((item->>'bigBlind')::numeric <= 0 or (item->>'smallBlind')::numeric > (item->>'bigBlind')::numeric)) then
      raise exception 'Invalid level sequence, duration or blinds' using errcode = '22023';
    end if;
  end loop;
  if number = 0 then raise exception 'At least one blind level is required' using errcode = '22023'; end if;
end;
$$;

-- Narrow privileged implementation is necessary because direct writes are revoked.
-- Ownership is always checked against Auth, never granted from caller JSON.
create function kt_private.apply_preset_operation(op jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); v_operation_id uuid; entity_id uuid; expected bigint;
  previous public.sync_operation_receipts; preset public.blind_structures;
  result jsonb; at_time timestamptz; preset_name text;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform kt_private.validate_operation(op);
  if (op->>'ownerId')::uuid <> actor then raise exception 'Actor mismatch' using errcode = '42501'; end if;
  if op->>'entity' <> 'preset' or op->>'kind' not in ('preset.save','preset.remove') then
    raise exception 'Unsupported preset command' using errcode = '22023';
  end if;
  v_operation_id := (op->>'id')::uuid; entity_id := (op->>'entityId')::uuid;
  expected := (op->>'expectedRevision')::numeric::bigint;
  -- Stable transaction locks cover absent rows and concurrent retry IDs.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('operation:' || actor || ':' || v_operation_id,0));
  select * into previous from public.sync_operation_receipts r where r.actor_id=actor and r.operation_id=v_operation_id;
  if found then
    if previous.envelope <> op then raise exception 'Operation ID reused with different content' using errcode = '22023'; end if;
    return previous.receipt;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('preset:' || entity_id,0));
  select * into preset from public.blind_structures b where b.id=entity_id for update;
  if found then
    if preset.owner_id is distinct from actor or preset.is_default then
      raise exception 'Preset not writable' using errcode = '42501';
    end if;
    if preset.revision <> expected then raise exception 'Preset revision conflict' using errcode = '40001'; end if;
    if preset.deleted_at is not null then raise exception 'Preset was removed' using errcode = '55000'; end if;
  elsif expected <> 0 or op->>'kind' <> 'preset.save' then
    raise exception 'Preset revision conflict' using errcode = '40001';
  end if;
  at_time := clock_timestamp();
  if op->>'kind' = 'preset.save' then
    if not (op->'payload') ?& array['name','levels']
      or ((op->'payload') - array['name','levels']) <> '{}'
      or jsonb_typeof(op->'payload'->'name') <> 'string' then
      raise exception 'Invalid preset payload' using errcode = '22023';
    end if;
    preset_name := regexp_replace(op->'payload'->>'name','^\s+|\s+$','','g');
    if char_length(preset_name) not between 1 and 120 then raise exception 'Invalid preset name' using errcode = '22023'; end if;
    perform kt_private.validate_preset_levels(op->'payload'->'levels');
    if preset.id is null then
      insert into public.blind_structures(id,name,format,owner_id,levels,revision,updated_at)
        values(entity_id,preset_name,'regular',actor,op->'payload'->'levels',expected+1,at_time);
    else
      update public.blind_structures set name=preset_name,levels=op->'payload'->'levels',revision=expected+1,updated_at=at_time
        where id=entity_id;
    end if;
  else
    if op->'payload' <> '{}' then raise exception 'Remove payload must be empty' using errcode = '22023'; end if;
    update public.blind_structures set deleted_at=at_time,updated_at=at_time,revision=expected+1 where id=entity_id;
  end if;
  result := jsonb_build_object('operationId',v_operation_id,'revision',expected+1);
  insert into public.sync_operation_receipts values(actor,v_operation_id,op,result,at_time);
  insert into public.sync_operation_audit values(actor,v_operation_id,entity_id,'preset',op->>'kind',expected,expected+1,at_time);
  return result;
end;
$$;

create function public.apply_preset_operation(p_operation jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  select kt_private.apply_preset_operation(p_operation);
$$;
revoke all on function kt_private.validate_operation(jsonb), kt_private.validate_preset_levels(jsonb),
  kt_private.apply_preset_operation(jsonb), public.apply_preset_operation(jsonb) from public, anon, authenticated;
grant execute on function kt_private.apply_preset_operation(jsonb), public.apply_preset_operation(jsonb) to authenticated;
