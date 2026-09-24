-- Local Postgres fixtures only. Entire suite rolls back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('8a62c39b-1234-4321-8c12-123456789001','player-a@example.invalid','{}'),
('8a62c39b-1234-4321-8c12-123456789002','player-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','8a62c39b-1234-4321-8c12-123456789001',true);
do $$
declare target_id uuid := '8a62c39b-1234-4321-8c12-123456789100';
  first_id uuid := '8a62c39b-1234-4321-8c12-123456789101';
  creation jsonb; adding jsonb; receipt jsonb; bad jsonb;
begin
  creation := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','8a62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',target_id,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-09-24T18:00:00Z','payload',jsonb_build_object(
      'name','Players','format','regular','buyIn',37.50,'reEntryAllowed',false,
      'maxReEntries',0,'startTime','2026-09-25T19:30:00Z','capacity',2,
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20}]'::jsonb));
  perform public.apply_tournament_operation(creation);
  adding := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','8a62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',target_id,'kind','player.add','expectedRevision',1,
    'createdAt','2026-09-24T18:01:00Z','payload',jsonb_build_object('playerId',first_id,'name',' Ana '));
  receipt := public.apply_tournament_operation(adding);
  if receipt <> jsonb_build_object('operationId',adding->>'id','revision',2)
    or public.apply_tournament_operation(adding) <> receipt then
    raise exception 'Player retry changed receipt';
  end if;
  if (select revision from public.tournaments where id=target_id) <> 2
    or (select count(*) from public.tournament_players where tournament_id=target_id) <> 1
    or (select display_name from public.tournament_players where id=first_id) <> 'Ana'
    or (select buy_ins from public.tournament_players where id=first_id) <> 1
    or (select payment_status from public.tournament_players where id=first_id) <> 'pending'
    or (select count(*) from public.sync_operation_audit where entity_id=target_id) <> 2 then
    raise exception 'Player entry fields or audit differ';
  end if;
  begin
    perform public.apply_tournament_operation(jsonb_set(adding,'{payload,name}','"Tampered"'));
    raise exception 'Changed operation ID accepted';
  exception when invalid_parameter_value then null; end;
  for bad in select v from (values
    ('{"playerId":"8a62c39b-1234-4321-8c12-123456789102","name":"ana"}'::jsonb),
    ('{"playerId":"8a62c39b-1234-4321-8c12-123456789102","name":""}'::jsonb),
    (jsonb_build_object('playerId',gen_random_uuid(),'name',repeat('a',61))),
    ('{"playerId":"bad","name":"Bob"}'::jsonb),
    ('{"playerId":"8a62c39b-1234-4321-8c12-123456789102","name":"Bob","paymentStatus":"confirmed"}'::jsonb),
    ('{"name":"Bob"}'::jsonb)
  ) invalid(v) loop
    begin
      perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(adding,
        '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','2'),'{payload}',bad));
      raise exception 'Invalid player entry accepted: %',bad;
    exception when invalid_parameter_value then null; end;
  end loop;
  if (select revision from public.tournaments where id=target_id) <> 2 then
    raise exception 'Invalid player entry had effects';
  end if;
  begin
    insert into public.tournament_players(tournament_id,display_name) values(target_id,'Bypass');
    raise exception 'Direct player insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.tournament_players set payment_status='confirmed' where id=first_id;
    raise exception 'Direct payment update allowed';
  exception when insufficient_privilege then null; end;
  perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(adding,
    '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','2'),'{payload}',
    jsonb_build_object('playerId','8a62c39b-1234-4321-8c12-123456789103','name','Bia')));
  begin
    perform public.apply_tournament_operation(jsonb_set(jsonb_set(jsonb_set(adding,
      '{id}',to_jsonb(gen_random_uuid())),'{expectedRevision}','3'),'{payload}',
      jsonb_build_object('playerId','8a62c39b-1234-4321-8c12-123456789104','name','Caio')));
    raise exception 'Full table accepted player';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.tournament_players where tournament_id=target_id) <> 2
    or (select revision from public.tournaments where id=target_id) <> 3 then
    raise exception 'Capacity rejection had effects';
  end if;
end $$;

-- Simulate a receipt/audit write failure after the player and revision write.
set local role postgres;
create function pg_temp.reject_player_audit() returns trigger language plpgsql as $$
begin raise exception 'QA audit failure' using errcode='23514'; end;
$$;
create trigger qa_reject_player_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_player_audit();
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','8a62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','8a62c39b-1234-4321-8c12-123456789100','kind','player.add',
    'expectedRevision',3,'createdAt','2026-09-24T18:02:00Z',
    'payload',jsonb_build_object('playerId','8a62c39b-1234-4321-8c12-123456789105','name','Dora'));
  -- Free a place as postgres in a separate block below; here capacity still rejects.
  begin perform public.apply_tournament_operation(op); raise exception 'Full table accepted';
  exception when invalid_parameter_value then null; end;
end $$;
set local role postgres;
delete from public.tournament_players where id='8a62c39b-1234-4321-8c12-123456789103';
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','8a62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','8a62c39b-1234-4321-8c12-123456789100','kind','player.add',
    'expectedRevision',3,'createdAt','2026-09-24T18:02:00Z',
    'payload',jsonb_build_object('playerId','8a62c39b-1234-4321-8c12-123456789105','name','Dora'));
  begin perform public.apply_tournament_operation(op); raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if exists(select 1 from public.tournament_players where id=(op->'payload'->>'playerId')::uuid)
    or (select revision from public.tournaments where id=(op->>'entityId')::uuid) <> 3
    or exists(select 1 from public.sync_operation_receipts where operation_id=(op->>'id')::uuid) then
    raise exception 'Partial player entry survived audit failure';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_player_audit on public.sync_operation_audit;
set local role authenticated;
select set_config('request.jwt.claim.sub','8a62c39b-1234-4321-8c12-123456789002',true);
do $$
declare op jsonb;
begin
  if exists(select 1 from public.tournament_players where tournament_id='8a62c39b-1234-4321-8c12-123456789100') then
    raise exception 'Foreign player rows exposed';
  end if;
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','8a62c39b-1234-4321-8c12-123456789002','entity','tournament',
    'entityId','8a62c39b-1234-4321-8c12-123456789100','kind','player.add',
    'expectedRevision',3,'createdAt','2026-09-24T18:03:00Z',
    'payload',jsonb_build_object('playerId',gen_random_uuid(),'name','Foreign'));
  begin perform public.apply_tournament_operation(op); raise exception 'Foreign player entry accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.apply_tournament_operation('{}'); raise exception 'Anonymous player entry accepted';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.tournament_players; raise exception 'Anonymous player read allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Player add: validation, capacity, direct-write denial, rollback and isolation passed' as result;
