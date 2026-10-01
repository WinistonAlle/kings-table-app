-- Dedicated local fixtures; no data survives this transaction.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('fc62c39b-1234-4321-8c12-123456789001','start-a@example.invalid','{}'),
('fc62c39b-1234-4321-8c12-123456789002','start-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','fc62c39b-1234-4321-8c12-123456789001',true);
do $$
declare
  table_id uuid := 'fc62c39b-1234-4321-8c12-123456789100';
  player_id uuid := gen_random_uuid();
  base jsonb;
  cmd jsonb;
  receipt jsonb;
begin
  base := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','fc62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',table_id,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-10-01T18:00:00Z','payload',jsonb_build_object(
      'name','Start QA','format','regular','buyIn',25,'reEntryAllowed',false,
      'maxReEntries',0,'startTime','2026-10-02T19:30:00Z',
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":1}]'::jsonb));
  perform public.apply_tournament_operation(base);
  cmd := base || jsonb_build_object('id',gen_random_uuid(),'kind','tournament.start',
    'expectedRevision',1,'payload','{}'::jsonb);
  for attempt in 1..2 loop
    begin
      perform public.apply_tournament_operation(cmd);
      raise exception 'Empty tournament started';
    exception when object_not_in_prerequisite_state then
      if sqlerrm <> 'Tournament requires a registered player' then raise; end if;
    end;
  end loop;
  if (select revision from public.tournaments where id=table_id) <> 1
    or (select status from public.tournaments where id=table_id) <> 'upcoming'
    or (select clock_ends_at from public.tournaments where id=table_id) is not null
    or (select count(*) from public.sync_operation_receipts where actor_id=(base->>'ownerId')::uuid) <> 1
    or (select count(*) from public.sync_operation_audit where entity_id=table_id) <> 1 then
    raise exception 'Rejected start changed state, receipt or audit';
  end if;
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','player.add','expectedRevision',1,'payload',jsonb_build_object('playerId',player_id,'name','Ana')));
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','player.remove','expectedRevision',2,'payload',jsonb_build_object('playerId',player_id)));
  cmd := cmd || jsonb_build_object('expectedRevision',3);
  begin
    perform public.apply_tournament_operation(cmd); raise exception 'Start accepted after last removal';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'Tournament requires a registered player' then raise; end if;
  end;
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','player.add','expectedRevision',3,'payload',jsonb_build_object('playerId',gen_random_uuid(),'name','Bia')));
  cmd := cmd || jsonb_build_object('expectedRevision',4);
  receipt := public.apply_tournament_operation(cmd);
  if public.apply_tournament_operation(cmd) <> receipt or receipt->>'revision' <> '5'
    or (select status from public.tournaments where id=table_id) <> 'running'
    or public.read_tournament_clock(table_id)->>'isRunning' <> 'false'
    or (select count(*) from public.sync_operation_receipts where actor_id=(base->>'ownerId')::uuid) <> 5
    or (select count(*) from public.sync_operation_audit where entity_id=table_id) <> 5 then
    raise exception 'Valid start or idempotent retry failed';
  end if;
end $$;
select set_config('request.jwt.claim.sub','fc62c39b-1234-4321-8c12-123456789002',true);
do $$ begin
  begin
    perform public.apply_tournament_operation(jsonb_build_object('version',1,'id',gen_random_uuid(),
      'ownerId','fc62c39b-1234-4321-8c12-123456789002','entity','tournament',
      'entityId','fc62c39b-1234-4321-8c12-123456789100','kind','tournament.start',
      'expectedRevision',5,'createdAt','2026-10-01T18:00:00Z','payload','{}'::jsonb));
    raise exception 'Foreign start accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Tournament start: registered player, last removal, atomic rejection, retry and account scope passed' as result;
