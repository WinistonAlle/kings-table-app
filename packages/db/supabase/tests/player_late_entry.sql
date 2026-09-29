-- Local Postgres fixtures only. Entire suite rolls back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('a9910000-0000-4000-8000-000000000001','late-a@example.invalid','{}'),
('a9910000-0000-4000-8000-000000000002','late-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','a9910000-0000-4000-8000-000000000001',true);
do $$
declare
  table_id uuid := 'a9910000-0000-4000-8000-000000000010';
  base jsonb;
  op jsonb;
  receipt jsonb;
  player_id uuid;
  player_name text;
begin
  base := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','a9910000-0000-4000-8000-000000000001','entity','tournament',
    'entityId',table_id,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-09-29T19:00:00Z','payload',jsonb_build_object(
      'name','Late entry test','format','regular','buyIn',0.55,
      'reEntryAllowed',false,'maxReEntries',0,'startTime','2026-09-29T19:00:00Z',
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20}]'::jsonb));
  perform public.apply_tournament_operation(base);
  for player_id, player_name in select id, name from (values
    ('a9910000-0000-4000-8000-000000000011'::uuid,'Ana'),
    ('a9910000-0000-4000-8000-000000000012'::uuid,'Bia'),
    ('a9910000-0000-4000-8000-000000000013'::uuid,'Caio')
  ) players(id,name) loop
    perform public.apply_tournament_operation(base || jsonb_build_object(
      'id',gen_random_uuid(),'kind','player.add',
      'expectedRevision',(select revision from public.tournaments where id=table_id),
      'payload',jsonb_build_object('playerId',player_id,'name',player_name)));
  end loop;
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','tournament.start','expectedRevision',4,'payload','{}'::jsonb));
  if (select revision from public.tournaments where id=table_id) <> 5 then
    raise exception 'Late entry fixture did not start';
  end if;
end $$;

set local role postgres;
update public.tournament_players set position=3, eliminated_at=clock_timestamp()
  where id='a9910000-0000-4000-8000-000000000013';
set local role authenticated;
do $$
declare
  table_id uuid := 'a9910000-0000-4000-8000-000000000010';
  late_id uuid := 'a9910000-0000-4000-8000-000000000014';
  op jsonb;
  receipt jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','a9910000-0000-4000-8000-000000000001','entity','tournament',
    'entityId',table_id,'kind','player.add','expectedRevision',5,
    'createdAt','2026-09-29T19:05:00Z',
    'payload',jsonb_build_object('playerId',late_id,'name','Duda'));
  receipt := public.apply_tournament_operation(op);
  if receipt <> jsonb_build_object('operationId',op->>'id','revision',6)
    or public.apply_tournament_operation(op) <> receipt
    or (select position from public.tournament_players where id='a9910000-0000-4000-8000-000000000013') <> 4
    or (select position from public.tournament_players where id=late_id) is not null
    or (select count(*) from public.tournament_players where tournament_id=table_id) <> 4
    or (select count(*) from public.sync_operation_audit where entity_id=table_id) <> 6 then
    raise exception 'Late entry did not shift places exactly once';
  end if;
  begin
    perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
      'expectedRevision',6,'payload',jsonb_build_object('playerId',gen_random_uuid(),'name','Duda')));
    raise exception 'Duplicate name accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
      'payload',jsonb_build_object('playerId',gen_random_uuid(),'name','Eva')));
    raise exception 'Stale late entry accepted';
  exception when serialization_failure then null; end;
  if (select position from public.tournament_players where id='a9910000-0000-4000-8000-000000000013') <> 4
    or (select revision from public.tournaments where id=table_id) <> 6 then
    raise exception 'Rejected late entry changed places or revision';
  end if;
end $$;

set local role postgres;
create function pg_temp.reject_late_entry_audit() returns trigger language plpgsql as $$
begin raise exception 'QA audit failure' using errcode='23514'; end;
$$;
create trigger qa_reject_late_entry_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_late_entry_audit();
set local role authenticated;
do $$
declare
  op jsonb := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','a9910000-0000-4000-8000-000000000001','entity','tournament',
    'entityId','a9910000-0000-4000-8000-000000000010','kind','player.add',
    'expectedRevision',6,'createdAt','2026-09-29T19:06:00Z',
    'payload',jsonb_build_object('playerId','a9910000-0000-4000-8000-000000000015','name','Eva'));
begin
  begin perform public.apply_tournament_operation(op); raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if (select position from public.tournament_players where id='a9910000-0000-4000-8000-000000000013') <> 4
    or exists(select 1 from public.tournament_players where id='a9910000-0000-4000-8000-000000000015')
    or (select revision from public.tournaments where id='a9910000-0000-4000-8000-000000000010') <> 6
    or exists(select 1 from public.sync_operation_receipts where operation_id=(op->>'id')::uuid) then
    raise exception 'Late entry survived audit failure partially';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_late_entry_audit on public.sync_operation_audit;
set local role authenticated;
select set_config('request.jwt.claim.sub','a9910000-0000-4000-8000-000000000002',true);
do $$
declare
  op jsonb := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','a9910000-0000-4000-8000-000000000002','entity','tournament',
    'entityId','a9910000-0000-4000-8000-000000000010','kind','player.add',
    'expectedRevision',6,'createdAt','2026-09-29T19:07:00Z',
    'payload',jsonb_build_object('playerId',gen_random_uuid(),'name','Foreign'));
begin
  begin perform public.apply_tournament_operation(op); raise exception 'Foreign account added player';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Late entry: places, receipt, stale revision, rollback and isolation passed' as result;
