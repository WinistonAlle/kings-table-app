-- Local Postgres fixtures only. Entire suite rolls back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('ca62c39b-1234-4321-8c12-123456789001','payment-a@example.invalid','{}'),
('ca62c39b-1234-4321-8c12-123456789002','payment-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','ca62c39b-1234-4321-8c12-123456789001',true);
do $$
declare
  target uuid := 'ca62c39b-1234-4321-8c12-123456789100';
  ana uuid := 'ca62c39b-1234-4321-8c12-123456789101';
  bia uuid := 'ca62c39b-1234-4321-8c12-123456789102';
  create_op jsonb;
  add_op jsonb;
  pay_op jsonb;
  receipt jsonb;
  attempted jsonb;
begin
  create_op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ca62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',target,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-09-25T18:00:00Z','payload',jsonb_build_object(
      'name','Payments','format','regular','buyIn',25,'reEntryAllowed',true,
      'maxReEntries',2,'startTime','2026-09-26T19:30:00Z',
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20}]'::jsonb));
  perform public.apply_tournament_operation(create_op);
  add_op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ca62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',target,'kind','player.add','expectedRevision',1,
    'createdAt','2026-09-25T18:01:00Z','payload',jsonb_build_object('playerId',ana,'name','Ana'));
  perform public.apply_tournament_operation(add_op);
  pay_op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ca62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',target,'kind','player.payment.set','expectedRevision',2,
    'createdAt','2026-09-25T18:02:00Z',
    'payload',jsonb_build_object('playerId',ana,'status','confirmed','expectedAmountCents',2500));
  receipt := public.apply_tournament_operation(pay_op);
  if receipt <> jsonb_build_object('operationId',pay_op->>'id','revision',3)
    or public.apply_tournament_operation(pay_op) <> receipt
    or (select payment_status from public.tournament_players where id=ana) <> 'confirmed'
    or not (select financial_activity_recorded from public.tournament_players where id=ana)
    or (select amount_cents from public.player_payment_events where operation_id=(pay_op->>'id')::uuid) <> 2500
    or (select status_before from public.player_payment_events where operation_id=(pay_op->>'id')::uuid) <> 'pending'
    or (select count(*) from public.sync_operation_audit where entity_id=target) <> 3 then
    raise exception 'Payment transition, receipt, marker or audit differs';
  end if;
  begin
    perform public.apply_tournament_operation(jsonb_set(pay_op,'{payload,status}','"disputed"'));
    raise exception 'Changed payment operation ID accepted';
  exception when invalid_parameter_value then null; end;
  for attempted in select v from (values
    ('{}'::jsonb),
    ('{"playerId":"bad","status":"pending","expectedAmountCents":2500}'::jsonb),
    (jsonb_build_object('playerId',ana,'status','paid','expectedAmountCents',2500)),
    (jsonb_build_object('playerId',ana,'status','pending','expectedAmountCents',25.5)),
    (jsonb_build_object('playerId',ana,'status','pending','expectedAmountCents',2500,'extra',true))
  ) bad(v) loop
    begin
      perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(pay_op,
        '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','3'),'{payload}',attempted));
      raise exception 'Invalid payment accepted: %',attempted;
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.apply_tournament_operation(jsonb_set(jsonb_set(pay_op,
      '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','3'));
    raise exception 'Unchanged payment accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(jsonb_set(pay_op,
      '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','3'),
      '{payload,status}','"disputed"'),'{payload,expectedAmountCents}','2600'));
    raise exception 'Stale payment total accepted';
  exception when serialization_failure then null; end;
  perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(pay_op,
    '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','3'),
    '{payload,status}','"disputed"'));
  perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(pay_op,
    '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','4'),
    '{payload,status}','"pending"'));
  if (select payment_status from public.tournament_players where id=ana) <> 'pending'
    or not (select financial_activity_recorded from public.tournament_players where id=ana)
    or (select count(*) from public.player_payment_events where player_id=ana) <> 3 then
    raise exception 'Payment reversal lost its history';
  end if;
  begin
    perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(pay_op,
      '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','5'),
      '{kind}','"player.remove"') || jsonb_build_object('payload',jsonb_build_object('playerId',ana)));
    raise exception 'Paid-then-pending player removed';
  exception when object_not_in_prerequisite_state then null; end;
  perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(add_op,
    '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','5'),'{payload}',
    jsonb_build_object('playerId',bia,'name','Bia')));
  perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(pay_op,
    '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','6'),
    '{kind}','"player.remove"') || jsonb_build_object('payload',jsonb_build_object('playerId',bia)));
  if (select revision from public.tournaments where id=target) <> 7
    or exists(select 1 from public.tournament_players where id=bia) then
    raise exception 'Untouched player could not be removed';
  end if;
end $$;

-- Even a corrupted marker cannot erase the immutable payment event.
set local role postgres;
update public.tournament_players set financial_activity_recorded=false
  where id='ca62c39b-1234-4321-8c12-123456789101';
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ca62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','ca62c39b-1234-4321-8c12-123456789100','kind','player.remove',
    'expectedRevision',7,'createdAt','2026-09-25T18:03:00Z',
    'payload',jsonb_build_object('playerId','ca62c39b-1234-4321-8c12-123456789101'));
  begin perform public.apply_tournament_operation(op); raise exception 'Payment event erased';
  exception when object_not_in_prerequisite_state then null; end;
  if (select count(*) from public.player_payment_events
      where player_id='ca62c39b-1234-4321-8c12-123456789101') <> 3 then
    raise exception 'Payment events disappeared';
  end if;
end $$;

-- A late audit failure rolls back the state, event, revision and receipt.
set local role postgres;
create function pg_temp.reject_payment_audit() returns trigger language plpgsql as $$
begin raise exception 'QA payment audit failure' using errcode='23514'; end;
$$;
create trigger qa_reject_payment_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_payment_audit();
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ca62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','ca62c39b-1234-4321-8c12-123456789100','kind','player.payment.set',
    'expectedRevision',7,'createdAt','2026-09-25T18:04:00Z',
    'payload',jsonb_build_object('playerId','ca62c39b-1234-4321-8c12-123456789101',
      'status','confirmed','expectedAmountCents',2500));
  begin perform public.apply_tournament_operation(op); raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if (select payment_status from public.tournament_players
      where id='ca62c39b-1234-4321-8c12-123456789101') <> 'pending'
    or (select revision from public.tournaments where id=(op->>'entityId')::uuid) <> 7
    or exists(select 1 from public.player_payment_events where operation_id=(op->>'id')::uuid)
    or exists(select 1 from public.sync_operation_receipts where operation_id=(op->>'id')::uuid) then
    raise exception 'Partial payment survived audit failure';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_payment_audit on public.sync_operation_audit;
set local role authenticated;
select set_config('request.jwt.claim.sub','ca62c39b-1234-4321-8c12-123456789002',true);
do $$
declare op jsonb;
begin
  if exists(select 1 from public.player_payment_events where
    tournament_id='ca62c39b-1234-4321-8c12-123456789100') then
    raise exception 'Foreign payment history exposed';
  end if;
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ca62c39b-1234-4321-8c12-123456789002','entity','tournament',
    'entityId','ca62c39b-1234-4321-8c12-123456789100','kind','player.payment.set',
    'expectedRevision',7,'createdAt','2026-09-25T18:04:00Z',
    'payload',jsonb_build_object('playerId','ca62c39b-1234-4321-8c12-123456789101',
      'status','confirmed','expectedAmountCents',2500));
  begin perform public.apply_tournament_operation(op); raise exception 'Foreign payment accepted';
  exception when insufficient_privilege then null; end;
  begin insert into public.player_payment_events values(gen_random_uuid(),
    'ca62c39b-1234-4321-8c12-123456789002',
    'ca62c39b-1234-4321-8c12-123456789100',
    'ca62c39b-1234-4321-8c12-123456789101','Ana','pending','confirmed',2500,now());
    raise exception 'Direct payment event inserted';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.apply_tournament_operation('{}'); raise exception 'Anonymous payment accepted';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.player_payment_events; raise exception 'Anonymous payment history read';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Player payment: amount, transition, immutable history, rollback and isolation passed' as result;
