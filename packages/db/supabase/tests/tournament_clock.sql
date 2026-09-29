-- Local Postgres fixtures only. Entire suite rolls back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('cc62c39b-1234-4321-8c12-123456789001','clock-a@example.invalid','{}'),
('cc62c39b-1234-4321-8c12-123456789002','clock-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','cc62c39b-1234-4321-8c12-123456789001',true);
do $$
declare
  table_id uuid := 'cc62c39b-1234-4321-8c12-123456789100';
  base jsonb;
  cmd jsonb;
  receipt jsonb;
  view_state jsonb;
begin
  base := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','cc62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',table_id,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-09-29T13:00:00Z','payload',jsonb_build_object(
      'name','Clock QA','format','regular','buyIn',25,'reEntryAllowed',false,
      'maxReEntries',0,'startTime','2026-09-30T19:30:00Z',
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":1},{"level":2,"smallBlind":50,"bigBlind":100,"ante":0,"durationMinutes":1},{"level":3,"smallBlind":100,"bigBlind":200,"ante":0,"durationMinutes":1}]'::jsonb));
  perform public.apply_tournament_operation(base);
  view_state := public.read_tournament_clock(table_id);
  if view_state->>'currentLevel' <> '0' or view_state->>'secondsRemaining' <> '60'
    or view_state->>'isRunning' <> 'false' or view_state->>'revision' <> '1' then
    raise exception 'New clock did not start paused';
  end if;
  begin
    perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
      'kind','clock.start','expectedRevision',1,'payload','{}'::jsonb));
    raise exception 'Clock started before tournament';
  exception when object_not_in_prerequisite_state then null; end;
  cmd := base || jsonb_build_object('id',gen_random_uuid(),'kind','tournament.start',
    'expectedRevision',1,'payload','{}'::jsonb);
  receipt := public.apply_tournament_operation(cmd);
  if public.apply_tournament_operation(cmd) <> receipt or receipt->>'revision' <> '2'
    or (select status from public.tournaments where id=table_id) <> 'running'
    or public.read_tournament_clock(table_id)->>'isRunning' <> 'false' then
    raise exception 'Tournament start is not idempotent or starts clock';
  end if;
  begin
    perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
      'kind','tournament.start','expectedRevision',2,'payload','{}'::jsonb));
    raise exception 'Second start accepted';
  exception when object_not_in_prerequisite_state then null; end;
  cmd := base || jsonb_build_object('id',gen_random_uuid(),'kind','clock.start',
    'expectedRevision',2,'payload','{}'::jsonb);
  receipt := public.apply_tournament_operation(cmd);
  if public.apply_tournament_operation(cmd) <> receipt
    or public.read_tournament_clock(table_id)->>'isRunning' <> 'true' then
    raise exception 'Clock start or retry failed';
  end if;
  begin
    perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
      'kind','clock.pause','expectedRevision',2,'payload','{}'::jsonb));
    raise exception 'Stale clock revision accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.apply_tournament_operation(jsonb_set(cmd,'{payload}','{"extra":true}'::jsonb));
    raise exception 'Changed clock ID accepted';
  exception when invalid_parameter_value then null; end;
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','clock.pause','expectedRevision',3,'payload','{}'::jsonb));
  view_state := public.read_tournament_clock(table_id);
  if view_state->>'isRunning' <> 'false' or (view_state->>'secondsRemaining')::integer not between 1 and 60
    or (select clock_ends_at from public.tournaments where id=table_id) is not null then
    raise exception 'Pause did not freeze remaining time';
  end if;
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','clock.level','expectedRevision',4,'payload','{"level":2}'::jsonb));
  if public.read_tournament_clock(table_id)->>'currentLevel' <> '2'
    or public.read_tournament_clock(table_id)->>'secondsRemaining' <> '60' then
    raise exception 'Manual level did not reset its duration';
  end if;
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','clock.start','expectedRevision',5,'payload','{}'::jsonb));
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','clock.handForHand','expectedRevision',6,'payload','{"enabled":true}'::jsonb));
  view_state := public.read_tournament_clock(table_id);
  if view_state->>'handForHand' <> 'true' or view_state->>'isRunning' <> 'false' then
    raise exception 'Hand-for-hand did not pause';
  end if;
  begin
    perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
      'kind','clock.start','expectedRevision',7,'payload','{}'::jsonb));
    raise exception 'Hand-for-hand clock started';
  exception when object_not_in_prerequisite_state then null; end;
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','clock.handForHand','expectedRevision',7,'payload','{"enabled":false}'::jsonb));
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','clock.reset','expectedRevision',8,'payload','{}'::jsonb));
  view_state := public.read_tournament_clock(table_id);
  if view_state->>'currentLevel' <> '0' or view_state->>'secondsRemaining' <> '60'
    or view_state->>'handForHand' <> 'false' or view_state->>'isRunning' <> 'false' then
    raise exception 'Reset did not restore first level';
  end if;
  for cmd in select v from (values
    (base || jsonb_build_object('id',gen_random_uuid(),'kind','clock.level',
      'expectedRevision',9,'payload','{"level":3}'::jsonb)),
    (base || jsonb_build_object('id',gen_random_uuid(),'kind','clock.level',
      'expectedRevision',9,'payload','{"level":0.5}'::jsonb)),
    (base || jsonb_build_object('id',gen_random_uuid(),'kind','clock.start',
      'expectedRevision',9,'payload','{"extra":1}'::jsonb)),
    (base || jsonb_build_object('id',gen_random_uuid(),'kind','clock.handForHand',
      'expectedRevision',9,'payload','{"enabled":"true"}'::jsonb))
  ) bad(v) loop
    begin perform public.apply_tournament_operation(cmd); raise exception 'Invalid clock command accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','clock.start','expectedRevision',9,'payload','{}'::jsonb));
  if (select count(*) from public.sync_operation_audit where entity_id=table_id) <> 10 then
    raise exception 'Clock audit count differs';
  end if;
end $$;

-- A fixed timestamp proves advancement across two levels without sleeping.
set local role postgres;
do $$
declare t public.tournaments; state jsonb;
begin
  select * into t from public.tournaments where id='cc62c39b-1234-4321-8c12-123456789100';
  state := kt_private.tournament_clock_at(t,t.clock_ends_at + interval '70 seconds');
  if state->>'currentLevel' <> '2' or state->>'secondsRemaining' <> '50'
    or state->>'isRunning' <> 'true' then raise exception 'Clock failed to skip levels'; end if;
  state := kt_private.tournament_clock_at(t,t.clock_ends_at + interval '121 seconds');
  if state->>'currentLevel' <> '2' or state->>'secondsRemaining' <> '0'
    or state->>'isRunning' <> 'false' then raise exception 'Clock ran past final level'; end if;
  update public.tournaments set clock_ends_at=clock_timestamp()-interval '190 seconds'
    where id=t.id;
end $$;
set local role authenticated;
do $$
declare
  table_id uuid := 'cc62c39b-1234-4321-8c12-123456789100';
  op jsonb;
  state jsonb;
begin
  state := public.read_tournament_clock(table_id);
  if state->>'currentLevel' <> '2' or state->>'secondsRemaining' <> '0'
    or state->>'isRunning' <> 'false' then raise exception 'Offline clock did not reach final level'; end if;
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','cc62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',table_id,'kind','clock.pause','expectedRevision',10,
    'createdAt','2026-09-29T13:01:00Z','payload','{}'::jsonb);
  perform public.apply_tournament_operation(op);
  if (select current_level from public.tournaments where id=table_id) <> 2
    or (select seconds_remaining from public.tournaments where id=table_id) <> 0
    or (select clock_ends_at from public.tournaments where id=table_id) is not null then
    raise exception 'Expired clock did not materialize on pause';
  end if;
  begin
    perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
      'kind','clock.start','expectedRevision',11));
    raise exception 'Expired clock restarted';
  exception when object_not_in_prerequisite_state then null; end;
  perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
    'kind','clock.level','expectedRevision',11,'payload','{"level":1}'::jsonb));
  perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
    'kind','clock.start','expectedRevision',12));
end $$;

set local role postgres;
create function pg_temp.reject_clock_audit() returns trigger language plpgsql as $$
begin raise exception 'QA clock audit failure' using errcode='23514'; end;
$$;
create trigger qa_reject_clock_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_clock_audit();
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','cc62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','cc62c39b-1234-4321-8c12-123456789100',
    'kind','clock.pause','expectedRevision',13,
    'createdAt','2026-09-29T13:02:00Z','payload','{}'::jsonb);
  begin perform public.apply_tournament_operation(op); raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if (select revision from public.tournaments where id=(op->>'entityId')::uuid) <> 13
    or (select clock_ends_at from public.tournaments where id=(op->>'entityId')::uuid) is null
    or exists(select 1 from public.sync_operation_receipts where operation_id=(op->>'id')::uuid) then
    raise exception 'Clock update survived audit failure';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_clock_audit on public.sync_operation_audit;
set local role authenticated;
select set_config('request.jwt.claim.sub','cc62c39b-1234-4321-8c12-123456789002',true);
do $$
declare op jsonb;
begin
  begin perform public.read_tournament_clock('cc62c39b-1234-4321-8c12-123456789100');
    raise exception 'Foreign clock was read';
  exception when insufficient_privilege then null; end;
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','cc62c39b-1234-4321-8c12-123456789002','entity','tournament',
    'entityId','cc62c39b-1234-4321-8c12-123456789100',
    'kind','clock.pause','expectedRevision',13,
    'createdAt','2026-09-29T13:03:00Z','payload','{}'::jsonb);
  begin perform public.apply_tournament_operation(op); raise exception 'Foreign clock changed';
  exception when insufficient_privilege then null; end;
  begin update public.tournaments set seconds_remaining=99 where id=(op->>'entityId')::uuid;
    raise exception 'Direct clock update accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.read_tournament_clock('cc62c39b-1234-4321-8c12-123456789100');
    raise exception 'Anonymous clock read';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Tournament clock: anchor, skip, expiry, controls, rollback and isolation passed' as result;
