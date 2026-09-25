-- Local Postgres fixtures only. Entire suite rolls back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('ba62c39b-1234-4321-8c12-123456789001','remove-a@example.invalid','{}'),
('ba62c39b-1234-4321-8c12-123456789002','remove-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','ba62c39b-1234-4321-8c12-123456789001',true);
do $$
declare
  target uuid := 'ba62c39b-1234-4321-8c12-123456789100';
  player_a uuid := 'ba62c39b-1234-4321-8c12-123456789101';
  player_b uuid := 'ba62c39b-1234-4321-8c12-123456789102';
  creation jsonb;
  adding jsonb;
  removing jsonb;
  receipt jsonb;
begin
  creation := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ba62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',target,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-09-25T18:00:00Z','payload',jsonb_build_object(
      'name','Remove test','format','regular','buyIn',25,'reEntryAllowed',false,
      'maxReEntries',0,'startTime','2026-09-26T19:30:00Z',
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20}]'::jsonb));
  perform public.apply_tournament_operation(creation);
  adding := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ba62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',target,'kind','player.add','expectedRevision',1,
    'createdAt','2026-09-25T18:01:00Z','payload',jsonb_build_object('playerId',player_a,'name','Ana'));
  perform public.apply_tournament_operation(adding);
  removing := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ba62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',target,'kind','player.remove','expectedRevision',2,
    'createdAt','2026-09-25T18:02:00Z','payload',jsonb_build_object('playerId',player_a));
  receipt := public.apply_tournament_operation(removing);
  if receipt <> jsonb_build_object('operationId',removing->>'id','revision',3)
    or public.apply_tournament_operation(removing) <> receipt
    or exists(select 1 from public.tournament_players where id=player_a)
    or (select revision from public.tournaments where id=target) <> 3
    or (select count(*) from public.sync_operation_audit where entity_id=target) <> 3 then
    raise exception 'Player removal, receipt, or audit differs';
  end if;
  begin
    perform public.apply_tournament_operation(jsonb_set(removing,'{payload,playerId}',to_jsonb(player_b)));
    raise exception 'Changed operation ID accepted';
  exception when invalid_parameter_value then null; end;
  for adding in select v from (values
    ('{}'::jsonb), ('{"playerId":"bad"}'::jsonb),
    ('{"playerId":"ba62c39b-1234-4321-8c12-123456789102","extra":true}'::jsonb)
  ) invalid(v) loop
    begin
      perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(removing,
        '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','3'),'{payload}',adding));
      raise exception 'Invalid player removal accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.apply_tournament_operation(jsonb_set(jsonb_set(removing,
      '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','3'));
    raise exception 'Repeated player removal accepted';
  exception when invalid_parameter_value then null; end;
  perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(removing,
    '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','3'),'{kind}','"player.add"')
    || jsonb_build_object('payload',jsonb_build_object('playerId',player_b,'name','Bia')));
  if (select revision from public.tournaments where id=target) <> 4 then
    raise exception 'Test setup did not add second player';
  end if;
  begin
    perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(removing,
      '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','4'),'{payload}',
      jsonb_build_object('playerId',player_a)));
    raise exception 'Absent player removed';
  exception when invalid_parameter_value then null; end;
end $$;

-- A late audit failure must roll the deletion and revision back together.
set local role postgres;
create function pg_temp.reject_remove_audit() returns trigger language plpgsql as $$
begin raise exception 'QA remove audit failure' using errcode='23514'; end;
$$;
create trigger qa_reject_remove_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_remove_audit();
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ba62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','ba62c39b-1234-4321-8c12-123456789100','kind','player.remove',
    'expectedRevision',4,'createdAt','2026-09-25T18:03:00Z',
    'payload',jsonb_build_object('playerId','ba62c39b-1234-4321-8c12-123456789102'));
  begin perform public.apply_tournament_operation(op); raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if not exists(select 1 from public.tournament_players
    where id='ba62c39b-1234-4321-8c12-123456789102')
    or (select revision from public.tournaments where id=(op->>'entityId')::uuid) <> 4
    or exists(select 1 from public.sync_operation_receipts where operation_id=(op->>'id')::uuid) then
    raise exception 'Partial removal survived audit failure';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_remove_audit on public.sync_operation_audit;

-- Existing proofs must never be erased by the player's cascading FK.
insert into public.payment_proofs(id,tournament_id,player_id,storage_path)
values('ba62c39b-1234-4321-8c12-123456789200',
  'ba62c39b-1234-4321-8c12-123456789100',
  'ba62c39b-1234-4321-8c12-123456789102','qa-proof');
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ba62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','ba62c39b-1234-4321-8c12-123456789100','kind','player.remove',
    'expectedRevision',4,'createdAt','2026-09-25T18:03:00Z',
    'payload',jsonb_build_object('playerId','ba62c39b-1234-4321-8c12-123456789102'));
  begin perform public.apply_tournament_operation(op); raise exception 'Proof erased';
  exception when object_not_in_prerequisite_state then null; end;
  if not exists(select 1 from public.payment_proofs where storage_path='qa-proof')
    or (select revision from public.tournaments where id=(op->>'entityId')::uuid) <> 4 then
    raise exception 'Proof rejection had effects';
  end if;
end $$;
set local role postgres;
delete from public.payment_proofs where id='ba62c39b-1234-4321-8c12-123456789200';
update public.tournament_players set payment_status='confirmed'
  where id='ba62c39b-1234-4321-8c12-123456789102';
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ba62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','ba62c39b-1234-4321-8c12-123456789100','kind','player.remove',
    'expectedRevision',4,'createdAt','2026-09-25T18:03:00Z',
    'payload',jsonb_build_object('playerId','ba62c39b-1234-4321-8c12-123456789102'));
  begin perform public.apply_tournament_operation(op); raise exception 'Paid entry erased';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
set local role postgres;
update public.tournament_players set payment_status='pending'
  where id='ba62c39b-1234-4321-8c12-123456789102';
update public.tournaments set status='running'
  where id='ba62c39b-1234-4321-8c12-123456789100';
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ba62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','ba62c39b-1234-4321-8c12-123456789100','kind','player.remove',
    'expectedRevision',4,'createdAt','2026-09-25T18:03:00Z',
    'payload',jsonb_build_object('playerId','ba62c39b-1234-4321-8c12-123456789102'));
  begin perform public.apply_tournament_operation(op); raise exception 'Running entry erased';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
set local role postgres;
update public.tournaments set status='upcoming'
  where id='ba62c39b-1234-4321-8c12-123456789100';
set local role authenticated;
select set_config('request.jwt.claim.sub','ba62c39b-1234-4321-8c12-123456789002',true);
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ba62c39b-1234-4321-8c12-123456789002','entity','tournament',
    'entityId','ba62c39b-1234-4321-8c12-123456789100','kind','player.remove',
    'expectedRevision',4,'createdAt','2026-09-25T18:03:00Z',
    'payload',jsonb_build_object('playerId','ba62c39b-1234-4321-8c12-123456789102'));
  begin perform public.apply_tournament_operation(op); raise exception 'Foreign removal accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.apply_tournament_operation('{}'); raise exception 'Anonymous removal accepted';
  exception when insufficient_privilege then null; end;
  begin delete from public.tournament_players; raise exception 'Direct player delete allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Player remove: receipt, validation, proof/payment/status protection and isolation passed' as result;
