-- Payment state is a whole-player status for now. Events preserve every transition.
alter table public.tournament_players
  add column financial_activity_recorded boolean not null default false;
update public.tournament_players
  set financial_activity_recorded = true
  where payment_status <> 'pending' or re_entries > 0 or add_ons > 0 or buy_ins <> 1;

create table public.player_payment_events (
  operation_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null,
  player_name text not null,
  status_before text not null check (status_before in ('pending','confirmed','disputed')),
  status_after text not null check (status_after in ('pending','confirmed','disputed')),
  amount_cents bigint not null check (amount_cents > 0),
  recorded_at timestamptz not null
);
create index player_payment_events_tournament_player
  on public.player_payment_events(tournament_id, player_id, recorded_at);
alter table public.player_payment_events enable row level security;
revoke all on public.player_payment_events from public, anon, authenticated;
grant select on public.player_payment_events to authenticated;
create policy "Organizer reads payment history" on public.player_payment_events
  for select to authenticated using (
    exists(select 1 from public.tournaments t
      where t.id = tournament_id and t.created_by = (select auth.uid()))
  );

create function kt_private.apply_player_payment_operation(op jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  v_operation_id uuid;
  entity_id uuid;
  player_id uuid;
  expected bigint;
  previous public.sync_operation_receipts;
  existing public.tournaments;
  player public.tournament_players;
  payload jsonb;
  next_status text;
  expected_cents bigint;
  actual_cents bigint;
  at_time timestamptz;
  result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform kt_private.validate_operation(op);
  if (op->>'ownerId')::uuid <> actor then raise exception 'Actor mismatch' using errcode = '42501'; end if;
  if op->>'entity' <> 'tournament' or op->>'kind' <> 'player.payment.set' then
    raise exception 'Unsupported payment command' using errcode = '22023';
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
  if existing.deleted_at is not null or existing.status not in ('upcoming','running') then
    raise exception 'Tournament does not accept payment changes' using errcode = '55000';
  end if;

  payload := op->'payload';
  if not payload ?& array['playerId','status','expectedAmountCents']
    or (payload - array['playerId','status','expectedAmountCents']) <> '{}'::jsonb
    or jsonb_typeof(payload->'playerId') <> 'string'
    or payload->>'playerId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(payload->'status') <> 'string'
    or payload->>'status' not in ('pending','confirmed','disputed')
    or jsonb_typeof(payload->'expectedAmountCents') <> 'number'
    or (payload->>'expectedAmountCents')::numeric not between 1 and 9007199254740991
    or pg_catalog.trunc((payload->>'expectedAmountCents')::numeric) <> (payload->>'expectedAmountCents')::numeric then
    raise exception 'Invalid payment payload' using errcode = '22023';
  end if;
  player_id := (payload->>'playerId')::uuid;
  next_status := payload->>'status';
  expected_cents := (payload->>'expectedAmountCents')::bigint;
  select * into player from public.tournament_players p
    where p.id = player_id and p.tournament_id = entity_id for update;
  if not found then raise exception 'Player not found at this table' using errcode = '22023'; end if;
  if player.payment_status = next_status then
    raise exception 'Payment status is unchanged' using errcode = '22023';
  end if;
  actual_cents := (existing.buy_in * (player.buy_ins + player.re_entries + player.add_ons) * 100)::bigint;
  if actual_cents <= 0 or expected_cents <> actual_cents then
    raise exception 'Payment total changed' using errcode = '40001';
  end if;

  at_time := pg_catalog.clock_timestamp();
  update public.tournament_players
    set payment_status = next_status, financial_activity_recorded = true
    where id = player_id and tournament_id = entity_id;
  insert into public.player_payment_events(operation_id,actor_id,tournament_id,player_id,
    player_name,status_before,status_after,amount_cents,recorded_at)
  values(v_operation_id,actor,entity_id,player_id,player.display_name,
    player.payment_status,next_status,actual_cents,at_time);
  update public.tournaments set revision = expected + 1, updated_at = at_time where id = entity_id;
  result := pg_catalog.jsonb_build_object('operationId', v_operation_id, 'revision', expected + 1);
  insert into public.sync_operation_receipts values(actor, v_operation_id, op, result, at_time);
  insert into public.sync_operation_audit values(actor, v_operation_id, entity_id,
    'tournament', 'player.payment.set', expected, expected + 1, at_time);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Invalid payment values' using errcode = '22023';
end;
$$;

create or replace function kt_private.apply_player_remove_operation(op jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  v_operation_id uuid;
  entity_id uuid;
  v_player_id uuid;
  expected bigint;
  previous public.sync_operation_receipts;
  existing public.tournaments;
  player public.tournament_players;
  payload jsonb;
  at_time timestamptz;
  result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform kt_private.validate_operation(op);
  if (op->>'ownerId')::uuid <> actor then raise exception 'Actor mismatch' using errcode = '42501'; end if;
  if op->>'entity' <> 'tournament' or op->>'kind' <> 'player.remove' then
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
  if existing.deleted_at is not null or existing.status <> 'upcoming' then
    raise exception 'Player removal requires an upcoming tournament' using errcode = '55000';
  end if;

  payload := op->'payload';
  if not payload ? 'playerId'
    or (payload - 'playerId') <> '{}'::jsonb
    or jsonb_typeof(payload->'playerId') <> 'string'
    or payload->>'playerId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Invalid player removal payload' using errcode = '22023';
  end if;
  v_player_id := (payload->>'playerId')::uuid;
  select * into player from public.tournament_players p
    where p.id = v_player_id and p.tournament_id = entity_id for update;
  if not found then raise exception 'Player not found at this table' using errcode = '22023'; end if;
  if player.buy_ins <> 1 or player.re_entries <> 0 or player.add_ons <> 0
    or player.payment_status <> 'pending' or player.position is not null
    or player.prize is not null or player.eliminated_at is not null
    or player.financial_activity_recorded then
    raise exception 'Player has game or financial history' using errcode = '55000';
  end if;
  if exists(select 1 from public.payment_proofs p where p.player_id = v_player_id)
    or exists(select 1 from public.player_payment_events e
      where e.tournament_id = entity_id and e.player_id = v_player_id) then
    raise exception 'Player has payment evidence' using errcode = '55000';
  end if;

  at_time := pg_catalog.clock_timestamp();
  delete from public.tournament_players where id = v_player_id and tournament_id = entity_id;
  update public.tournaments set revision = expected + 1, updated_at = at_time where id = entity_id;
  result := pg_catalog.jsonb_build_object('operationId', v_operation_id, 'revision', expected + 1);
  insert into public.sync_operation_receipts values(actor, v_operation_id, op, result, at_time);
  insert into public.sync_operation_audit values(actor, v_operation_id, entity_id,
    'tournament', 'player.remove', expected, expected + 1, at_time);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Invalid player values' using errcode = '22023';
end;
$$;

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
  end if;
  raise exception 'Unsupported tournament command' using errcode = '22023';
end;
$$;
revoke all on function kt_private.apply_player_payment_operation(jsonb),
  public.apply_tournament_operation(jsonb) from public, anon, authenticated;
grant execute on function kt_private.apply_player_payment_operation(jsonb),
  public.apply_tournament_operation(jsonb) to authenticated;
