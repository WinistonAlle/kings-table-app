-- Only the display name is editable in this first player.update contract.
create function kt_private.apply_player_rename_operation(op jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  v_operation_id uuid;
  entity_id uuid;
  player_id uuid;
  expected bigint;
  previous public.sync_operation_receipts;
  existing public.tournaments;
  current_player public.tournament_players;
  payload jsonb;
  player_name text;
  at_time timestamptz;
  result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform kt_private.validate_operation(op);
  if (op->>'ownerId')::uuid <> actor then raise exception 'Actor mismatch' using errcode = '42501'; end if;
  if op->>'entity' <> 'tournament' or op->>'kind' <> 'player.update' then
    raise exception 'Unsupported player command' using errcode = '22023';
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
  if existing.deleted_at is not null or existing.status = 'cancelled' then
    raise exception 'Tournament cannot be edited' using errcode = '55000';
  end if;

  payload := op->'payload';
  if not payload ?& array['playerId','name']
    or (payload - array['playerId','name']) <> '{}'::jsonb
    or pg_catalog.jsonb_typeof(payload->'playerId') <> 'string'
    or payload->>'playerId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or pg_catalog.jsonb_typeof(payload->'name') <> 'string' then
    raise exception 'Invalid player payload' using errcode = '22023';
  end if;
  player_id := (payload->>'playerId')::uuid;
  player_name := pg_catalog.regexp_replace(payload->>'name', '^\s+|\s+$', '', 'g');
  if pg_catalog.char_length(player_name) not between 1 and 60 then
    raise exception 'Invalid player name' using errcode = '22023';
  end if;
  select * into current_player from public.tournament_players p
    where p.id = player_id and p.tournament_id = entity_id for update;
  if not found then raise exception 'Player not found at this table' using errcode = '22023'; end if;
  if current_player.display_name = player_name then
    raise exception 'Player name is unchanged' using errcode = '22023';
  end if;
  if exists(select 1 from public.tournament_players p where p.tournament_id = entity_id
    and p.id <> player_id and pg_catalog.lower(pg_catalog.btrim(p.display_name)) = pg_catalog.lower(player_name)) then
    raise exception 'Player name already used at this table' using errcode = '22023';
  end if;

  at_time := pg_catalog.clock_timestamp();
  update public.tournament_players set display_name = player_name where id = player_id;
  update public.tournaments set revision = expected + 1, updated_at = at_time where id = entity_id;
  result := pg_catalog.jsonb_build_object('operationId', v_operation_id, 'revision', expected + 1);
  insert into public.sync_operation_receipts values(actor,v_operation_id,op,result,at_time);
  insert into public.sync_operation_audit values(actor,v_operation_id,entity_id,
    'tournament','player.update',expected,expected + 1,at_time);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Invalid player values' using errcode = '22023';
end;
$$;
revoke all on function kt_private.apply_player_rename_operation(jsonb) from public, anon, authenticated;
grant execute on function kt_private.apply_player_rename_operation(jsonb) to authenticated;

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
  elsif p_operation->>'kind' in ('tournament.start','clock.start','clock.pause',
    'clock.level','clock.reset','clock.handForHand') then
    return kt_private.apply_tournament_clock_operation(p_operation);
  end if;
  raise exception 'Unsupported tournament command' using errcode = '22023';
end;
$$;
revoke all on function public.apply_tournament_operation(jsonb) from public, anon, authenticated;
grant execute on function public.apply_tournament_operation(jsonb) to authenticated;
