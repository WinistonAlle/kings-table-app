-- Local Postgres fixtures only. Entire suite rolls back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('a9900000-0000-4000-8000-000000000001','rename-a@example.invalid','{}'),
('a9900000-0000-4000-8000-000000000002','rename-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','a9900000-0000-4000-8000-000000000001',true);
do $$
declare
  table_id uuid := 'a9900000-0000-4000-8000-000000000010';
  player_id uuid := 'a9900000-0000-4000-8000-000000000011';
  other_id uuid := 'a9900000-0000-4000-8000-000000000012';
  base jsonb;
  op jsonb;
  receipt jsonb;
  bad jsonb;
begin
  base := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','a9900000-0000-4000-8000-000000000001','entity','tournament',
    'entityId',table_id,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-09-29T13:00:00Z','payload',jsonb_build_object(
      'name','Rename test','format','regular','buyIn',25,'reEntryAllowed',false,
      'maxReEntries',0,'startTime','2026-09-29T19:00:00Z',
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20}]'::jsonb));
  perform public.apply_tournament_operation(base);
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','player.add','expectedRevision',1,'payload',jsonb_build_object('playerId',player_id,'name','Ana')));
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','player.add','expectedRevision',2,'payload',jsonb_build_object('playerId',other_id,'name','Bia')));
  op := base || jsonb_build_object('id',gen_random_uuid(),'kind','player.update',
    'expectedRevision',3,'payload',jsonb_build_object('playerId',player_id,'name',' Ana Maria '));
  receipt := public.apply_tournament_operation(op);
  if receipt <> jsonb_build_object('operationId',op->>'id','revision',4)
    or public.apply_tournament_operation(op) <> receipt
    or (select display_name from public.tournament_players where id=player_id) <> 'Ana Maria'
    or (select buy_ins from public.tournament_players where id=player_id) <> 1
    or (select revision from public.tournaments where id=table_id) <> 4
    or (select count(*) from public.sync_operation_audit where entity_id=table_id) <> 4 then
    raise exception 'Rename did not preserve data, revision, audit or receipt';
  end if;
  begin
    perform public.apply_tournament_operation(jsonb_set(op,'{payload,name}','"Another"'));
    raise exception 'Changed operation ID accepted';
  exception when invalid_parameter_value then null; end;
  for bad in select v from (values
    (jsonb_build_object('playerId',player_id,'name',' bia ')),
    (jsonb_build_object('playerId',player_id,'name','Ana Maria')),
    (jsonb_build_object('playerId',player_id,'name',' ')),
    (jsonb_build_object('playerId',player_id,'name',repeat('A',61))),
    (jsonb_build_object('playerId',gen_random_uuid(),'name','Nova')),
    (jsonb_build_object('playerId',player_id,'name','Nova','paymentStatus','confirmed')),
    (jsonb_build_object('playerId','bad','name','Nova')),
    ('{"name":"Nova"}'::jsonb)
  ) invalid(v) loop
    begin
      perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
        'expectedRevision',4,'payload',bad));
      raise exception 'Invalid rename accepted: %',bad;
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
      'expectedRevision',3,'payload',jsonb_build_object('playerId',player_id,'name','Nova')));
    raise exception 'Stale rename accepted';
  exception when serialization_failure then null; end;
  begin
    update public.tournament_players set display_name='Bypass' where id=player_id;
    raise exception 'Direct rename allowed';
  exception when insufficient_privilege then null; end;
  if (select display_name from public.tournament_players where id=player_id) <> 'Ana Maria'
    or (select revision from public.tournaments where id=table_id) <> 4 then
    raise exception 'Rejected rename changed data';
  end if;
end $$;

set local role postgres;
update public.tournaments set status='finished' where id='a9900000-0000-4000-8000-000000000010';
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','a9900000-0000-4000-8000-000000000001','entity','tournament',
    'entityId','a9900000-0000-4000-8000-000000000010','kind','player.update',
    'expectedRevision',4,'createdAt','2026-09-29T13:01:00Z',
    'payload',jsonb_build_object('playerId','a9900000-0000-4000-8000-000000000011','name','Ana Final'));
  perform public.apply_tournament_operation(op);
  if (select display_name from public.tournament_players where id='a9900000-0000-4000-8000-000000000011') <> 'Ana Final'
    or (select revision from public.tournaments where id='a9900000-0000-4000-8000-000000000010') <> 5 then
    raise exception 'Finished table did not accept name correction';
  end if;
end $$;
set local role postgres;
update public.tournaments set status='cancelled' where id='a9900000-0000-4000-8000-000000000010';
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','a9900000-0000-4000-8000-000000000001','entity','tournament',
    'entityId','a9900000-0000-4000-8000-000000000010','kind','player.update',
    'expectedRevision',5,'createdAt','2026-09-29T13:01:00Z',
    'payload',jsonb_build_object('playerId','a9900000-0000-4000-8000-000000000011','name','Nao permitido'));
  begin perform public.apply_tournament_operation(op); raise exception 'Cancelled table accepted rename';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
set local role postgres;
update public.tournaments set status='finished' where id='a9900000-0000-4000-8000-000000000010';
create function pg_temp.reject_rename_audit() returns trigger language plpgsql as $$
begin raise exception 'QA audit failure' using errcode='23514'; end;
$$;
create trigger qa_reject_rename_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_rename_audit();
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','a9900000-0000-4000-8000-000000000001','entity','tournament',
    'entityId','a9900000-0000-4000-8000-000000000010','kind','player.update',
    'expectedRevision',5,'createdAt','2026-09-29T13:01:00Z',
    'payload',jsonb_build_object('playerId','a9900000-0000-4000-8000-000000000011','name','Nova'));
  begin perform public.apply_tournament_operation(op); raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if (select display_name from public.tournament_players where id='a9900000-0000-4000-8000-000000000011') <> 'Ana Final'
    or (select revision from public.tournaments where id='a9900000-0000-4000-8000-000000000010') <> 5
    or exists(select 1 from public.sync_operation_receipts where operation_id=(op->>'id')::uuid) then
    raise exception 'Partial rename survived audit failure';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_rename_audit on public.sync_operation_audit;
set local role authenticated;
select set_config('request.jwt.claim.sub','a9900000-0000-4000-8000-000000000002',true);
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','a9900000-0000-4000-8000-000000000002','entity','tournament',
    'entityId','a9900000-0000-4000-8000-000000000010','kind','player.update',
    'expectedRevision',4,'createdAt','2026-09-29T13:02:00Z',
    'payload',jsonb_build_object('playerId','a9900000-0000-4000-8000-000000000011','name','Foreign'));
  begin perform public.apply_tournament_operation(op); raise exception 'Foreign rename accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.apply_tournament_operation('{}'); raise exception 'Anonymous rename accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Player rename: validation, receipt, rollback and isolation passed' as result;
