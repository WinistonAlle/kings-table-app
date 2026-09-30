-- Result mutations share the tournament revision lock with late entries and payments.
create or replace function kt_private.apply_player_result_operation(op jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  v_operation_id uuid;
  entity_id uuid;
  player_id uuid;
  expected bigint;
  previous public.sync_operation_receipts;
  existing public.tournaments;
  target public.tournament_players;
  payload jsonb;
  kind text;
  active_count integer;
  last_eliminated_position integer;
  field_size integer;
  pool_cents numeric;
  second_cents numeric;
  third_cents numeric;
  fourth_cents numeric;
  champion_cents numeric;
  clock_state jsonb;
  at_time timestamptz;
  result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform kt_private.validate_operation(op);
  if (op->>'ownerId')::uuid <> actor then raise exception 'Actor mismatch' using errcode = '42501'; end if;
  kind := op->>'kind';
  if op->>'entity' <> 'tournament' or kind not in ('player.eliminate','player.undoElimination') then
    raise exception 'Unsupported result command' using errcode = '22023';
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
  if not (payload ? 'playerId')
    or (payload - 'playerId') <> '{}'::jsonb
    or pg_catalog.jsonb_typeof(payload->'playerId') <> 'string'
    or payload->>'playerId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Invalid result payload' using errcode = '22023';
  end if;
  player_id := (payload->>'playerId')::uuid;
  select * into target from public.tournament_players p
    where p.id = player_id and p.tournament_id = entity_id for update;
  if not found then raise exception 'Player not found at this table' using errcode = '22023'; end if;
  at_time := pg_catalog.clock_timestamp();

  if kind = 'player.eliminate' then
    if existing.status <> 'running' or target.position is not null then
      raise exception 'Player cannot be eliminated now' using errcode = '55000';
    end if;
    select pg_catalog.count(*) into active_count from public.tournament_players p
      where p.tournament_id = entity_id and p.position is null;
    if active_count <= 1 then raise exception 'Cannot eliminate the last player' using errcode = '55000'; end if;
    update public.tournament_players set position = active_count, eliminated_at = at_time
      where id = player_id;
    if active_count = 2 then
      select pg_catalog.count(*),
        pg_catalog.sum((p.buy_ins::numeric + p.re_entries::numeric + p.add_ons::numeric)
          * pg_catalog.round(existing.buy_in * 100))
        into field_size, pool_cents
        from public.tournament_players p where p.tournament_id = entity_id;
      second_cents := pg_catalog.floor(pool_cents * case when field_size <= 5 then 35 else 30 end / 100);
      third_cents := case when field_size > 5 then pg_catalog.floor(pool_cents * 20 / 100) else 0 end;
      fourth_cents := case when field_size > 9 then pg_catalog.floor(pool_cents * 10 / 100) else 0 end;
      champion_cents := pool_cents - second_cents - third_cents - fourth_cents;
      update public.tournament_players set
        position = case when position is null then 1 else position end,
        prize = (case
          when position is null then champion_cents
          when position = 2 then second_cents
          when position = 3 then third_cents
          when position = 4 then fourth_cents
          else 0 end) / 100
        where tournament_id = entity_id;
      clock_state := kt_private.tournament_clock_at(existing, at_time);
      update public.tournaments set status = 'finished', end_time = at_time,
        current_level = (clock_state->>'currentLevel')::integer,
        seconds_remaining = (clock_state->>'secondsRemaining')::integer,
        clock_ends_at = null where id = entity_id;
    end if;
  else
    if existing.status not in ('running','finished') or target.position is null or target.position <= 1 then
      raise exception 'Elimination cannot be undone now' using errcode = '55000';
    end if;
    select pg_catalog.min(p.position) into last_eliminated_position
      from public.tournament_players p where p.tournament_id = entity_id and p.position > 1;
    if target.position <> last_eliminated_position then
      raise exception 'Only the latest elimination can be undone' using errcode = '55000';
    end if;
    update public.tournament_players set position = null, eliminated_at = null, prize = null
      where id = player_id;
    if existing.status = 'finished' then
      update public.tournament_players set position = null, prize = null
        where tournament_id = entity_id and position = 1;
      update public.tournament_players set prize = null where tournament_id = entity_id;
      update public.tournaments set status = 'running', end_time = null,
        clock_ends_at = null where id = entity_id;
    end if;
  end if;

  update public.tournaments set revision = expected + 1, updated_at = at_time where id = entity_id;
  result := pg_catalog.jsonb_build_object('operationId',v_operation_id,'revision',expected + 1);
  insert into public.sync_operation_receipts values(actor,v_operation_id,op,result,at_time);
  insert into public.sync_operation_audit values(actor,v_operation_id,entity_id,
    'tournament',kind,expected,expected + 1,at_time);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Invalid result values' using errcode = '22023';
end;
$$;
revoke all on function kt_private.apply_player_result_operation(jsonb) from public, anon, authenticated;
grant execute on function kt_private.apply_player_result_operation(jsonb) to authenticated;

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
  elsif p_operation->>'kind' in ('tournament.start','clock.start','clock.pause',
    'clock.level','clock.reset','clock.handForHand') then
    return kt_private.apply_tournament_clock_operation(p_operation);
  end if;
  raise exception 'Unsupported tournament command' using errcode = '22023';
end;
$$;
revoke all on function public.apply_tournament_operation(jsonb) from public, anon, authenticated;
grant execute on function public.apply_tournament_operation(jsonb) to authenticated;
