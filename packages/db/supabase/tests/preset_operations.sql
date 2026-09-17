-- Local Postgres fixtures only. Entire suite is rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('8b64db63-1234-4321-8c12-123456789001','preset-a@example.invalid','{}'),
('8b64db63-1234-4321-8c12-123456789002','preset-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','8b64db63-1234-4321-8c12-123456789001',true);
do $$
declare op jsonb; original_op jsonb; result jsonb; bad jsonb; levels jsonb;
begin
  levels := '[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20},
    {"level":1,"smallBlind":0,"bigBlind":0,"ante":0,"durationMinutes":10,"isBreak":true},
    {"level":2,"smallBlind":50,"bigBlind":100,"ante":10,"durationMinutes":15}]';
  op := jsonb_build_object('version',1,'id','8b64db63-1234-4321-8c12-123456789010',
    'ownerId','8b64db63-1234-4321-8c12-123456789001','entity','preset',
    'entityId','8b64db63-1234-4321-8c12-123456789100','kind','preset.save',
    'expectedRevision',0,'createdAt','2026-09-17T01:00:00.000Z',
    'payload',jsonb_build_object('name',' Minha estrutura ','levels',levels));
  original_op := op;
  result := public.apply_preset_operation(op);
  if result <> jsonb_build_object('operationId',op->>'id','revision',1) then raise exception 'Wrong receipt'; end if;
  if public.apply_preset_operation(op) <> result then raise exception 'Retry changed receipt'; end if;
  if (select count(*) from public.sync_operation_audit) <> 1 then raise exception 'Retry duplicated audit'; end if;
  if (select name from public.blind_structures where id=(op->>'entityId')::uuid) <> 'Minha estrutura' then raise exception 'Name not normalized'; end if;
  begin
    perform public.apply_preset_operation(jsonb_set(op,'{payload,name}','"Alterada"'));
    raise exception 'Changed duplicate ID accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.apply_preset_operation(jsonb_set(op,'{id}',to_jsonb(gen_random_uuid())));
    raise exception 'Stale revision accepted';
  exception when serialization_failure then null; end;
  op := jsonb_set(jsonb_set(op,'{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','1');
  for bad in select v from (values
    (jsonb_set(op,'{payload,levels,0,durationMinutes}','0')),
    (jsonb_set(op,'{payload,levels,0,smallBlind}','51')),
    (jsonb_set(op,'{payload,levels,0,ante}','0.5')),
    (jsonb_set(op,'{payload,levels,0,bigBlind}','9007199254740992')),
    (jsonb_set(op,'{payload,levels,1,bigBlind}','100')),
    (jsonb_set(op,'{payload,levels,2,level}','3')),
    (jsonb_set(op,'{payload,levels}','[]')),
    (jsonb_set(op,'{payload,name}','""')),
    (jsonb_set(op,'{payload,name}',to_jsonb(E'\n\t '::text))),
    (jsonb_set(op,'{payload,name}',to_jsonb(repeat('a',121)))),
    (jsonb_set(op,'{payload,levels,0,isBreak}','null')),
    (jsonb_set(op,'{expectedRevision}','null')),
    (jsonb_set(op,'{createdAt}','"2026-99-17T01:00:00Z"')),
    (op || '{"unknown":true}'),
    (jsonb_set(op,'{payload,extra}','true'))
  ) invalid(v) loop
    begin
      perform public.apply_preset_operation(bad);
      raise exception 'Invalid command accepted: %',bad;
    exception when invalid_parameter_value then null; end;
  end loop;
  if (select revision from public.blind_structures where id=(op->>'entityId')::uuid) <> 1
    or (select count(*) from public.sync_operation_receipts) <> 1 then raise exception 'Rejected command had effects'; end if;
  result := public.apply_preset_operation(op);
  op := jsonb_set(jsonb_set(jsonb_set(op,'{id}',to_jsonb(gen_random_uuid())),
    '{expectedRevision}','2'),'{kind}','"preset.remove"');
  op := jsonb_set(op,'{payload}','{}');
  result := public.apply_preset_operation(op);
  if result->>'revision' <> '3' or public.apply_preset_operation(op) <> result then raise exception 'Remove retry failed'; end if;
  begin
    perform public.apply_preset_operation(jsonb_set(jsonb_set(op,'{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','3'));
    raise exception 'Deleted preset accepted a new operation';
  exception when object_not_in_prerequisite_state then null; end;
  if (select deleted_at from public.blind_structures where id=(op->>'entityId')::uuid) is null
    or (select count(*) from public.sync_operation_audit) <> 3 then raise exception 'Tombstone or audit missing'; end if;
  if public.apply_preset_operation(original_op)->>'revision' <> '1'
    or (select count(*) from public.sync_operation_audit) <> 3
    or (select revision from public.blind_structures where id=(op->>'entityId')::uuid) <> 3 then
    raise exception 'Retry after deletion resurrected or changed history';
  end if;
  begin
    update public.blind_structures set revision=99 where id=(op->>'entityId')::uuid;
    raise exception 'Direct preset update allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.sync_operation_receipts;
    raise exception 'Direct receipt deletion allowed';
  exception when insufficient_privilege then null; end;
end $$;

-- A failed audit insertion must roll back preset and receipt too.
set local role postgres;
create function pg_temp.reject_preset_audit() returns trigger language plpgsql as $$
begin raise exception 'QA audit failure' using errcode='23514'; end;
$$;
create trigger qa_reject_preset_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_preset_audit();
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','8b64db63-1234-4321-8c12-123456789001','entity','preset',
    'entityId','8b64db63-1234-4321-8c12-123456789101','kind','preset.save',
    'expectedRevision',0,'createdAt','2026-09-17T01:00:00Z',
    'payload','{"name":"Rollback","levels":[{"level":1,"smallBlind":1,"bigBlind":2,"ante":0,"durationMinutes":1}]}'::jsonb);
  begin
    perform public.apply_preset_operation(op);
    raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if exists(select 1 from public.blind_structures where id=(op->>'entityId')::uuid)
    or exists(select 1 from public.sync_operation_receipts where operation_id=(op->>'id')::uuid) then
    raise exception 'Partial transaction survived audit failure';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_preset_audit on public.sync_operation_audit;
insert into public.blind_structures(id,name,format,owner_id,is_default) values
('8b64db63-1234-4321-8c12-123456789102','Protected default','regular',
 '8b64db63-1234-4321-8c12-123456789001',true);
set local role authenticated;
do $$ begin
  begin
    perform public.apply_preset_operation(jsonb_build_object('version',1,'id',gen_random_uuid(),
      'ownerId','8b64db63-1234-4321-8c12-123456789001','entity','preset',
      'entityId','8b64db63-1234-4321-8c12-123456789102','kind','preset.remove',
      'expectedRevision',0,'createdAt','2026-09-17T01:00:00Z','payload','{}'::jsonb));
    raise exception 'Default preset was writable';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin perform public.apply_preset_operation('{}'); raise exception 'Null Auth actor allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','8b64db63-1234-4321-8c12-123456789002',true);
do $$
declare op jsonb;
begin
  if exists(select 1 from public.sync_operation_receipts) or exists(select 1 from public.sync_operation_audit)
    or exists(select 1 from public.blind_structures where id='8b64db63-1234-4321-8c12-123456789100') then
    raise exception 'Foreign data exposed';
  end if;
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','8b64db63-1234-4321-8c12-123456789002','entity','preset',
    'entityId','8b64db63-1234-4321-8c12-123456789100','kind','preset.remove',
    'expectedRevision',3,'createdAt','2026-09-17T01:00:00Z','payload','{}'::jsonb);
  begin
    perform public.apply_preset_operation(op);
    raise exception 'Foreign command accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apply_preset_operation(jsonb_set(op,'{ownerId}','"8b64db63-1234-4321-8c12-123456789001"'));
    raise exception 'Actor spoofing accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.apply_preset_operation('{}'); raise exception 'Anonymous command allowed';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.sync_operation_receipts; raise exception 'Anonymous receipts exposed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Preset commands: idempotency, validation, audit rollback, tombstones and isolation passed' as result;
