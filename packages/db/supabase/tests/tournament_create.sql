-- Local Postgres fixtures only. Entire suite is rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('6a62c39b-1234-4321-8c12-123456789001','tournament-a@example.invalid','{}'),
('6a62c39b-1234-4321-8c12-123456789002','tournament-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','6a62c39b-1234-4321-8c12-123456789001',true);
do $$
declare op jsonb; payload jsonb; bad jsonb; receipt jsonb; entity uuid;
begin
  entity := '6a62c39b-1234-4321-8c12-123456789100';
  payload := jsonb_build_object('name',' Mesa da liga ','format','regular','buyIn',37.50,
    'reEntryAllowed',true,'maxReEntries',2,'startTime','2026-09-25T19:30:00.000Z',
    'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20},
      {"level":1,"smallBlind":0,"bigBlind":0,"ante":0,"durationMinutes":10,"isBreak":true},
      {"level":2,"smallBlind":50,"bigBlind":100,"ante":10,"durationMinutes":15}]'::jsonb,
    'suit','copas','color','#78a885','location',' Casa do anfitrião ','capacity',9);
  op := jsonb_build_object('version',1,'id','6a62c39b-1234-4321-8c12-123456789010',
    'ownerId','6a62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',entity,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-09-24T17:00:00.000Z','payload',payload);
  receipt := public.apply_tournament_operation(op);
  if receipt <> jsonb_build_object('operationId',op->>'id','revision',1)
    or public.apply_tournament_operation(op) <> receipt then raise exception 'Create retry changed receipt'; end if;
  if (select count(*) from public.sync_operation_audit where actor_id=(op->>'ownerId')::uuid) <> 1
    or (select count(*) from public.sync_operation_receipts where actor_id=(op->>'ownerId')::uuid) <> 1 then
    raise exception 'Create retry duplicated effects';
  end if;
  if (select name from public.tournaments where id=entity) <> 'Mesa da liga'
    or (select status from public.tournaments where id=entity) <> 'upcoming'
    or (select revision from public.tournaments where id=entity) <> 1
    or (select buy_in from public.tournaments where id=entity) <> 37.50
    or (select details->>'location' from public.tournaments where id=entity) <> 'Casa do anfitrião'
    or (select details->>'capacity' from public.tournaments where id=entity) <> '9'
    or (select jsonb_array_length(blind_levels) from public.tournaments where id=entity) <> 3
    or (select seconds_remaining from public.tournaments where id=entity) <> 1200 then
    raise exception 'Created tournament fields differ from command';
  end if;
  begin
    perform public.apply_tournament_operation(jsonb_set(op,'{payload,name}','"Outra mesa"'));
    raise exception 'Changed duplicate ID accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.apply_tournament_operation(jsonb_set(op,'{id}',to_jsonb(gen_random_uuid())));
    raise exception 'Second create for same ID accepted';
  exception when serialization_failure then null; end;
  for bad in select v from (values
    (jsonb_set(payload,'{name}','""')),
    (jsonb_set(payload,'{name}',to_jsonb(repeat('a',121)))),
    (jsonb_set(payload,'{format}','"other"')),
    (jsonb_set(payload,'{buyIn}','0')),
    (jsonb_set(payload,'{buyIn}','37.501')),
    (jsonb_set(payload,'{buyIn}','100000000')),
    (jsonb_set(payload,'{maxReEntries}','101')),
    (jsonb_set(payload,'{reEntryAllowed}','false')),
    (jsonb_set(payload,'{startTime}','"2026-99-25T19:30:00Z"')),
    (jsonb_set(payload,'{levels,0,bigBlind}','0')),
    (jsonb_set(payload,'{levels}','[]')),
    (jsonb_set(payload,'{capacity}','1')),
    (jsonb_set(payload,'{capacity}','9.5')),
    (jsonb_set(payload,'{color}','"red"')),
    (jsonb_set(payload,'{suit}','"joker"')),
    (payload || '{"extra":true}'::jsonb)
  ) invalid(v) loop
    begin
      perform public.apply_tournament_operation(jsonb_set(jsonb_set(op,'{id}',to_jsonb(gen_random_uuid())),
        '{entityId}',to_jsonb(gen_random_uuid())) || jsonb_build_object('payload',bad));
      raise exception 'Invalid create accepted: %', bad;
    exception when invalid_parameter_value then null; end;
  end loop;
  if (select count(*) from public.tournaments where created_by=(op->>'ownerId')::uuid) <> 1
    or (select count(*) from public.sync_operation_audit where actor_id=(op->>'ownerId')::uuid) <> 1 then
    raise exception 'Invalid command had effects';
  end if;
  begin
    update public.tournaments set name='Direct write' where id=entity;
    raise exception 'Direct update allowed';
  exception when insufficient_privilege then null; end;
end $$;

-- The entity and receipt must roll back together if audit insertion fails.
set local role postgres;
create function pg_temp.reject_tournament_audit() returns trigger language plpgsql as $$
begin raise exception 'QA audit failure' using errcode='23514'; end;
$$;
create trigger qa_reject_tournament_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_tournament_audit();
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','6a62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','6a62c39b-1234-4321-8c12-123456789101','kind','tournament.create',
    'expectedRevision',0,'createdAt','2026-09-24T17:00:00Z',
    'payload','{"name":"Rollback","format":"regular","buyIn":10,"reEntryAllowed":false,
      "maxReEntries":0,"startTime":"2026-09-25T19:30:00Z",
      "levels":[{"level":1,"smallBlind":1,"bigBlind":2,"ante":0,"durationMinutes":1}]}'::jsonb);
  begin
    perform public.apply_tournament_operation(op);
    raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if exists(select 1 from public.tournaments where id=(op->>'entityId')::uuid)
    or exists(select 1 from public.sync_operation_receipts where operation_id=(op->>'id')::uuid) then
    raise exception 'Partial create survived audit failure';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_tournament_audit on public.sync_operation_audit;

set local role authenticated;
select set_config('request.jwt.claim.sub','6a62c39b-1234-4321-8c12-123456789002',true);
do $$
declare op jsonb;
begin
  if exists(select 1 from public.tournaments where id='6a62c39b-1234-4321-8c12-123456789100')
    or exists(select 1 from public.sync_operation_receipts where actor_id='6a62c39b-1234-4321-8c12-123456789001') then
    raise exception 'Foreign tournament or receipt exposed';
  end if;
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','6a62c39b-1234-4321-8c12-123456789002','entity','tournament',
    'entityId','6a62c39b-1234-4321-8c12-123456789100','kind','tournament.create',
    'expectedRevision',0,'createdAt','2026-09-24T17:00:00Z',
    'payload','{"name":"Outra","format":"regular","buyIn":10,"reEntryAllowed":false,
      "maxReEntries":0,"startTime":"2026-09-25T19:30:00Z",
      "levels":[{"level":1,"smallBlind":1,"bigBlind":2,"ante":0,"durationMinutes":1}]}'::jsonb);
  begin
    perform public.apply_tournament_operation(op);
    raise exception 'Foreign tournament overwritten';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apply_tournament_operation(jsonb_set(op,'{ownerId}','"6a62c39b-1234-4321-8c12-123456789001"'));
    raise exception 'Actor spoofing accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.apply_tournament_operation('{}'); raise exception 'Anonymous create allowed';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.tournaments; raise exception 'Anonymous tournament access allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Tournament create: validation, idempotency, audit rollback and isolation passed' as result;
