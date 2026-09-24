-- Local Postgres fixtures only. All changes roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('7a62c39b-1234-4321-8c12-123456789001','planning-a@example.invalid','{}'),
('7a62c39b-1234-4321-8c12-123456789002','planning-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','7a62c39b-1234-4321-8c12-123456789001',true);
do $$
declare target_id uuid := '7a62c39b-1234-4321-8c12-123456789100';
  creation jsonb; editing jsonb; payload jsonb; receipt jsonb; bad jsonb;
  future_time text := to_char((now() + interval '3 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  creation := jsonb_build_object('version',1,'id',gen_random_uuid(),'ownerId','7a62c39b-1234-4321-8c12-123456789001',
    'entity','tournament','entityId',target_id,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-09-24T17:00:00Z','payload',jsonb_build_object('name','Planning','format','regular',
    'buyIn',20,'reEntryAllowed',false,'maxReEntries',0,'startTime',future_time,
    'levels','[{"level":1,"smallBlind":1,"bigBlind":2,"ante":0,"durationMinutes":20}]'::jsonb,
    'suit','copas','color','#78a885','location','Original','capacity',8));
  perform public.apply_tournament_operation(creation);
  payload := jsonb_build_object('startTime',future_time,'location',' Sala nova ','capacity',5);
  editing := jsonb_build_object('version',1,'id',gen_random_uuid(),'ownerId','7a62c39b-1234-4321-8c12-123456789001',
    'entity','tournament','entityId',target_id,'kind','tournament.update','expectedRevision',1,
    'createdAt','2026-09-24T17:01:00Z','payload',payload);
  receipt := public.apply_tournament_operation(editing);
  if receipt <> jsonb_build_object('operationId',editing->>'id','revision',2)
    or public.apply_tournament_operation(editing) <> receipt then raise exception 'Planning retry changed receipt'; end if;
  if (select revision from public.tournaments where id=target_id) <> 2
    or (select details->>'location' from public.tournaments where id=target_id) <> 'Sala nova'
    or (select details->>'capacity' from public.tournaments where id=target_id) <> '5'
    or (select details->>'color' from public.tournaments where id=target_id) <> '#78a885'
    or (select count(*) from public.sync_operation_audit where entity_id=target_id) <> 2 then
    raise exception 'Planning changed unexpected fields or duplicated audit';
  end if;
  begin
    perform public.apply_tournament_operation(jsonb_set(editing,'{payload,location}','"Tampered"'));
    raise exception 'Changed command ID accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.apply_tournament_operation(jsonb_set(editing,'{id}',to_jsonb(gen_random_uuid())));
    raise exception 'Stale planning accepted';
  exception when serialization_failure then null; end;
  for bad in select v from (values
    (payload - 'capacity'), (payload || '{"extra":true}'::jsonb),
    (jsonb_set(payload,'{capacity}','1')),
    (jsonb_set(payload,'{capacity}','5.5')),
    (jsonb_set(payload,'{location}',to_jsonb(repeat('a',201)))),
    (jsonb_set(payload,'{startTime}','"2020-01-01T00:00:00Z"')),
    (jsonb_set(payload,'{startTime}','"2026-99-01T00:00:00Z"'))
  ) invalid(v) loop
    begin
      perform public.apply_tournament_operation(jsonb_set(jsonb_set(editing,'{id}',to_jsonb(gen_random_uuid())),
        '{expectedRevision}','2') || jsonb_build_object('payload',bad));
      raise exception 'Invalid planning accepted: %', bad;
    exception when invalid_parameter_value then null; end;
  end loop;
  if (select revision from public.tournaments where id=target_id) <> 2 then raise exception 'Invalid edit had effects'; end if;
  perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(editing,'{id}',to_jsonb(gen_random_uuid())),
    '{expectedRevision}','2'),'{payload}',jsonb_build_object('startTime',future_time,'location','','capacity',null)));
  if (select details ? 'location' from public.tournaments where id=target_id)
    or (select details ? 'capacity' from public.tournaments where id=target_id)
    or (select details->>'suit' from public.tournaments where id=target_id) <> 'copas' then
    raise exception 'Clearing planning fields lost unrelated details';
  end if;
end $$;
do $$ begin
  begin update public.tournaments set status='running' where id='7a62c39b-1234-4321-8c12-123456789100';
    raise exception 'Direct status write allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role postgres;
insert into public.tournament_players(tournament_id, display_name)
select '7a62c39b-1234-4321-8c12-123456789100', 'Player ' || n from generate_series(1,3) n;
create function pg_temp.reject_planning_audit() returns trigger language plpgsql as $$
begin raise exception 'QA audit failure' using errcode = '23514'; end;
$$;
create trigger qa_reject_planning_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_planning_audit();
set local role authenticated;
do $$
declare op jsonb; future_time text := to_char((now() + interval '3 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),'ownerId','7a62c39b-1234-4321-8c12-123456789001',
    'entity','tournament','entityId','7a62c39b-1234-4321-8c12-123456789100',
    'kind','tournament.update','expectedRevision',3,'createdAt','2026-09-24T17:02:00Z',
    'payload',jsonb_build_object('startTime',future_time,'location','Too small','capacity',2));
  begin perform public.apply_tournament_operation(op); raise exception 'Capacity below players accepted';
  exception when invalid_parameter_value then null; end;
  op := jsonb_set(op,'{id}',to_jsonb(gen_random_uuid()));
  op := jsonb_set(op,'{payload,capacity}','3');
  begin perform public.apply_tournament_operation(op); raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if (select revision from public.tournaments where id='7a62c39b-1234-4321-8c12-123456789100') <> 3
    or exists(select 1 from public.sync_operation_receipts where operation_id=(op->>'id')::uuid) then
    raise exception 'Partial planning survived audit failure';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_planning_audit on public.sync_operation_audit;
update public.tournaments set status='running' where id='7a62c39b-1234-4321-8c12-123456789100';
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),'ownerId','7a62c39b-1234-4321-8c12-123456789001',
    'entity','tournament','entityId','7a62c39b-1234-4321-8c12-123456789100',
    'kind','tournament.update','expectedRevision',3,'createdAt','2026-09-24T17:02:00Z',
    'payload',jsonb_build_object('startTime',to_char((now() + interval '3 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'location','Late','capacity',null));
  begin perform public.apply_tournament_operation(op); raise exception 'Running table edited';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
select set_config('request.jwt.claim.sub','7a62c39b-1234-4321-8c12-123456789002',true);
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),'ownerId','7a62c39b-1234-4321-8c12-123456789002',
    'entity','tournament','entityId','7a62c39b-1234-4321-8c12-123456789100',
    'kind','tournament.update','expectedRevision',3,'createdAt','2026-09-24T17:02:00Z',
    'payload',jsonb_build_object('startTime',to_char((now() + interval '3 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'location','Foreign','capacity',null));
  begin perform public.apply_tournament_operation(op); raise exception 'Foreign edit accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Tournament planning: revision, validation, ownership and state passed' as result;
