begin;
insert into auth.users(id,email,raw_user_meta_data) values
('ac62c39b-1234-4321-8c12-123456789001','structure-a@example.invalid','{}'),
('ac62c39b-1234-4321-8c12-123456789002','structure-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','ac62c39b-1234-4321-8c12-123456789001',true);
do $$
declare
  table_id uuid := 'ac62c39b-1234-4321-8c12-123456789100';
  base jsonb;
  cmd jsonb;
  invalid jsonb;
  receipt jsonb;
  before_state jsonb;
  changed jsonb := '[{"level":1,"smallBlind":40,"bigBlind":80,"ante":10,"durationMinutes":7},
    {"level":1,"smallBlind":0,"bigBlind":0,"ante":0,"durationMinutes":3,"isBreak":true},
    {"level":2,"smallBlind":75,"bigBlind":150,"ante":15,"durationMinutes":9}]';
begin
  base := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ac62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',table_id,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-10-01T18:00:00Z','payload',jsonb_build_object(
      'name','Structure QA','format','regular','buyIn',25,'reEntryAllowed',false,
      'maxReEntries',0,'startTime','2100-01-02T19:30:00Z',
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":1}]'::jsonb));
  perform public.apply_tournament_operation(base);
  cmd := base || jsonb_build_object('id',gen_random_uuid(),'kind','clock.structure',
    'expectedRevision',1,'payload',jsonb_build_object('levels',changed));
  receipt := public.apply_tournament_operation(cmd);
  if receipt->>'revision' <> '2' or public.apply_tournament_operation(cmd) <> receipt
    or (select blind_levels from public.tournaments where id=table_id) <> changed
    or (select current_level from public.tournaments where id=table_id) <> 0
    or (select seconds_remaining from public.tournaments where id=table_id) <> 420
    or public.read_tournament_clock(table_id)->>'isRunning' <> 'false'
    or (select count(*) from public.sync_operation_receipts where actor_id=(base->>'ownerId')::uuid) <> 2
    or (select count(*) from public.sync_operation_audit where entity_id=table_id) <> 2 then
    raise exception 'Structure update or idempotent replay failed';
  end if;
  select to_jsonb(t) into before_state from public.tournaments t where id=table_id;
  for invalid in select value from jsonb_array_elements(jsonb_build_array(
    '{}'::jsonb, jsonb_build_object('levels','[]'::jsonb), jsonb_build_object('levels',null),
    jsonb_build_object('levels',changed,'extra',true),
    jsonb_build_object('levels',jsonb_set(changed,'{0,durationMinutes}','0')),
    jsonb_build_object('levels',jsonb_set(changed,'{0,smallBlind}','99')),
    jsonb_build_object('levels',jsonb_set(changed,'{1,bigBlind}','50')),
    jsonb_build_object('levels',jsonb_set(changed,'{2,level}','3')),
    jsonb_build_object('levels',changed))) loop
    begin
      perform public.apply_tournament_operation(cmd || jsonb_build_object('id',gen_random_uuid(),'expectedRevision',2,'payload',invalid));
      raise exception 'Invalid or unchanged structure accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.apply_tournament_operation(cmd || jsonb_build_object('payload',base->'payload'));
    raise exception 'Operation identity reused';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.apply_tournament_operation(cmd || jsonb_build_object('id',gen_random_uuid()));
    raise exception 'Stale structure accepted';
  exception when serialization_failure then null; end;
  if (select to_jsonb(t) from public.tournaments t where id=table_id) <> before_state
    or (select count(*) from public.sync_operation_receipts where actor_id=(base->>'ownerId')::uuid) <> 2
    or (select count(*) from public.sync_operation_audit where entity_id=table_id) <> 2 then
    raise exception 'Rejected update changed state, receipt or audit';
  end if;
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','player.add','expectedRevision',2,'payload',jsonb_build_object('playerId',gen_random_uuid(),'name','Ana')));
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','tournament.start','expectedRevision',3,'payload','{}'::jsonb));
  begin
    perform public.apply_tournament_operation(cmd || jsonb_build_object('id',gen_random_uuid(),'expectedRevision',4,
      'payload',jsonb_build_object('levels',base->'payload'->'levels')));
    raise exception 'Running structure changed';
  exception when object_not_in_prerequisite_state then null; end;
  if public.apply_tournament_operation(cmd) <> receipt
    or (select revision from public.tournaments where id=table_id) <> 4
    or (select status from public.tournaments where id=table_id) <> 'running'
    or (select blind_levels from public.tournaments where id=table_id) <> changed then
    raise exception 'Retry after start did not preserve original receipt';
  end if;
end $$;
set local role postgres;
create function pg_temp.reject_structure_audit() returns trigger language plpgsql as $$
begin
  if new.kind = 'clock.structure' then raise exception 'QA audit failure' using errcode='23514'; end if;
  return new;
end $$;
create trigger qa_reject_structure_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_structure_audit();
set local role authenticated;
do $$
declare
  table_id uuid := 'ac62c39b-1234-4321-8c12-123456789101';
  op jsonb;
  before_state jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','ac62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',table_id,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-10-01T18:00:00Z','payload',jsonb_build_object(
      'name','Rollback structure QA','format','regular','buyIn',25,'reEntryAllowed',false,
      'maxReEntries',0,'startTime','2100-01-02T19:30:00Z',
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":1}]'::jsonb));
  perform public.apply_tournament_operation(op);
  select to_jsonb(t) into before_state from public.tournaments t where id=table_id;
  op := op || jsonb_build_object('id',gen_random_uuid(),'kind','clock.structure','expectedRevision',1,
    'payload',jsonb_build_object('levels','[{"level":1,"smallBlind":100,"bigBlind":200,"ante":0,"durationMinutes":2}]'::jsonb));
  begin
    perform public.apply_tournament_operation(op); raise exception 'Audit failure ignored';
  exception when check_violation then
    if sqlerrm <> 'QA audit failure' then raise; end if;
  end;
  if (select to_jsonb(t) from public.tournaments t where id=table_id) <> before_state
    or (select count(*) from public.sync_operation_receipts where operation_id=(op->>'id')::uuid) <> 0
    or (select count(*) from public.sync_operation_audit where entity_id=table_id) <> 1 then
    raise exception 'Partial structure update survived audit failure';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_structure_audit on public.sync_operation_audit;
set local role authenticated;
select set_config('request.jwt.claim.sub','ac62c39b-1234-4321-8c12-123456789002',true);
do $$ begin
  begin
    perform public.apply_tournament_operation(jsonb_build_object('version',1,'id',gen_random_uuid(),
      'ownerId','ac62c39b-1234-4321-8c12-123456789002','entity','tournament',
      'entityId','ac62c39b-1234-4321-8c12-123456789100','kind','clock.structure',
      'expectedRevision',4,'createdAt','2026-10-01T18:00:00Z','payload','{}'::jsonb));
    raise exception 'Foreign structure accepted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin
    perform public.apply_tournament_operation('{"kind":"clock.structure"}'::jsonb); raise exception 'Missing identity accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.apply_tournament_operation('{}'::jsonb);
    raise exception 'Anonymous command accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Structure: custom blinds, breaks, paused preparation, validation, atomic refusal, revision, idempotence and account scope passed' as result;
