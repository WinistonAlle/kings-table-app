-- Each re-entry or add-on changes the amount due, never the original buy-in.
create table public.player_entry_events (
  operation_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null,
  player_name text not null,
  entry_kind text not null check (entry_kind in ('reEntry','addOn')),
  delta smallint not null check (delta in (-1,1)),
  count_before integer not null check (count_before >= 0),
  count_after integer not null check (count_after >= 0),
  total_before_cents bigint not null check (total_before_cents > 0),
  total_after_cents bigint not null check (total_after_cents > 0),
  payment_status_before text not null check (payment_status_before in ('pending','confirmed','disputed')),
  payment_status_after text not null check (payment_status_after in ('pending','confirmed','disputed')),
  recorded_at timestamptz not null
);
create index player_entry_events_tournament_player
  on public.player_entry_events(tournament_id, player_id, recorded_at);
alter table public.player_entry_events enable row level security;
revoke all on public.player_entry_events from public, anon, authenticated;
grant select on public.player_entry_events to authenticated;
create policy "Organizer reads entry history" on public.player_entry_events
  for select to authenticated using (
    exists(select 1 from public.tournaments t
      where t.id = tournament_id and t.created_by = (select auth.uid()))
  );

create or replace function kt_private.apply_player_entry_operation(op jsonb) returns jsonb
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
  entry_kind text;
  delta integer;
  count_before integer;
  total_before_cents bigint;
  total_after_cents bigint;
  status_after text;
  at_time timestamptz;
  result jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform kt_private.validate_operation(op);
  if (op->>'ownerId')::uuid <> actor then raise exception 'Actor mismatch' using errcode = '42501'; end if;
  if op->>'entity' <> 'tournament' or op->>'kind' <> 'player.entries.adjust' then
    raise exception 'Unsupported entry command' using errcode = '22023';
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
    raise exception 'Tournament does not accept entries' using errcode = '55000';
  end if;

  payload := op->'payload';
  if not payload ?& array['playerId','entryKind','delta','expectedTotalCents']
    or (payload - array['playerId','entryKind','delta','expectedTotalCents']) <> '{}'::jsonb
    or jsonb_typeof(payload->'playerId') <> 'string'
    or payload->>'playerId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(payload->'entryKind') <> 'string'
    or payload->>'entryKind' not in ('reEntry','addOn')
    or jsonb_typeof(payload->'delta') <> 'number'
    or payload->>'delta' not in ('-1','1')
    or jsonb_typeof(payload->'expectedTotalCents') <> 'number'
    or (payload->>'expectedTotalCents')::numeric not between 1 and 9007199254740991
    or pg_catalog.trunc((payload->>'expectedTotalCents')::numeric) <> (payload->>'expectedTotalCents')::numeric then
    raise exception 'Invalid entry payload' using errcode = '22023';
  end if;
  v_player_id := (payload->>'playerId')::uuid;
  entry_kind := payload->>'entryKind';
  delta := (payload->>'delta')::integer;
  select * into player from public.tournament_players p
    where p.id = v_player_id and p.tournament_id = entity_id for update;
  if not found then raise exception 'Player not found at this table' using errcode = '22023'; end if;

  total_before_cents := (existing.buy_in * (player.buy_ins + player.re_entries + player.add_ons) * 100)::bigint;
  if total_before_cents <= 0 or total_before_cents <> (payload->>'expectedTotalCents')::bigint then
    raise exception 'Entry total changed' using errcode = '40001';
  end if;
  count_before := case when entry_kind = 'reEntry' then player.re_entries else player.add_ons end;
  if delta = 1 then
    if entry_kind = 'reEntry' and (not existing.re_entry_allowed or count_before >= existing.max_re_entries) then
      raise exception 'Re-entry limit reached' using errcode = '55000';
    end if;
    if entry_kind = 'addOn' and count_before >= 1000 then
      raise exception 'Add-on limit reached' using errcode = '55000';
    end if;
  else
    if count_before <= 0 then raise exception 'No entry to correct' using errcode = '55000'; end if;
    if player.payment_status <> 'pending'
      or exists(select 1 from public.payment_proofs p where p.player_id = v_player_id) then
      raise exception 'Entry has payment evidence' using errcode = '55000';
    end if;
  end if;
  total_after_cents := total_before_cents + delta * (existing.buy_in * 100)::bigint;
  if total_after_cents <= 0 or total_after_cents > 9007199254740991 then
    raise exception 'Entry amount is out of range' using errcode = '22023';
  end if;
  status_after := case when delta = 1 and player.payment_status = 'confirmed'
    then 'pending' else player.payment_status end;

  at_time := pg_catalog.clock_timestamp();
  update public.tournament_players set
    re_entries = case when entry_kind = 'reEntry' then re_entries + delta else re_entries end,
    add_ons = case when entry_kind = 'addOn' then add_ons + delta else add_ons end,
    payment_status = status_after, financial_activity_recorded = true
    where id = v_player_id and tournament_id = entity_id;
  insert into public.player_entry_events(operation_id,actor_id,tournament_id,player_id,
    player_name,entry_kind,delta,count_before,count_after,total_before_cents,
    total_after_cents,payment_status_before,payment_status_after,recorded_at)
  values(v_operation_id,actor,entity_id,v_player_id,player.display_name,entry_kind,delta,
    count_before,count_before + delta,total_before_cents,total_after_cents,
    player.payment_status,status_after,at_time);
  if player.payment_status <> status_after then
    insert into public.player_payment_events(operation_id,actor_id,tournament_id,player_id,
      player_name,status_before,status_after,amount_cents,recorded_at)
    values(v_operation_id,actor,entity_id,v_player_id,player.display_name,
      player.payment_status,status_after,total_after_cents,at_time);
  end if;
  update public.tournaments set revision = expected + 1, updated_at = at_time where id = entity_id;
  result := pg_catalog.jsonb_build_object('operationId', v_operation_id, 'revision', expected + 1);
  insert into public.sync_operation_receipts values(actor, v_operation_id, op, result, at_time);
  insert into public.sync_operation_audit values(actor, v_operation_id, entity_id,
    'tournament', 'player.entries.adjust', expected, expected + 1, at_time);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Invalid entry values' using errcode = '22023';
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
      where e.tournament_id = entity_id and e.player_id = v_player_id)
    or exists(select 1 from public.player_entry_events e
      where e.tournament_id = entity_id and e.player_id = v_player_id) then
    raise exception 'Player has payment or entry evidence' using errcode = '55000';
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
  elsif p_operation->>'kind' = 'player.entries.adjust' then
    return kt_private.apply_player_entry_operation(p_operation);
  end if;
  raise exception 'Unsupported tournament command' using errcode = '22023';
end;
$$;
revoke all on function kt_private.apply_player_entry_operation(jsonb),
  public.apply_tournament_operation(jsonb) from public, anon, authenticated;
grant execute on function kt_private.apply_player_entry_operation(jsonb),
  public.apply_tournament_operation(jsonb) to authenticated;
