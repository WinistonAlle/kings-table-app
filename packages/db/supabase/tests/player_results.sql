-- Local Postgres fixtures only. Entire suite rolls back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('a9920000-0000-4000-8000-000000000001','result-a@example.invalid','{}'),
('a9920000-0000-4000-8000-000000000002','result-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','a9920000-0000-4000-8000-000000000001',true);
do $$
declare
  table_id uuid := 'a9920000-0000-4000-8000-000000000010';
  player_ids uuid[] := array[
    'a9920000-0000-4000-8000-000000000011'::uuid,
    'a9920000-0000-4000-8000-000000000012'::uuid,
    'a9920000-0000-4000-8000-000000000013'::uuid,
    'a9920000-0000-4000-8000-000000000014'::uuid];
  base jsonb;
  op jsonb;
  receipt jsonb;
  i integer;
begin
  base := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','a9920000-0000-4000-8000-000000000001','entity','tournament',
    'entityId',table_id,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-09-29T19:00:00Z','payload',jsonb_build_object(
      'name','Results test','format','regular','buyIn',0.55,
      'reEntryAllowed',false,'maxReEntries',0,'startTime','2026-09-29T19:00:00Z',
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20}]'::jsonb));
  perform public.apply_tournament_operation(base);
  for i in 1..4 loop
    perform public.apply_tournament_operation(base || jsonb_build_object(
      'id',gen_random_uuid(),'kind','player.add','expectedRevision',i,
      'payload',jsonb_build_object('playerId',player_ids[i],'name','Player ' || i)));
  end loop;
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','tournament.start','expectedRevision',5,'payload','{}'::jsonb));
  op := base || jsonb_build_object('id',gen_random_uuid(),'kind','player.eliminate',
    'expectedRevision',6,'payload',jsonb_build_object('playerId',player_ids[4]));
  receipt := public.apply_tournament_operation(op);
  if receipt <> jsonb_build_object('operationId',op->>'id','revision',7)
    or public.apply_tournament_operation(op) <> receipt
    or (select position from public.tournament_players where id=player_ids[4]) <> 4 then
    raise exception 'First elimination or retry failed';
  end if;
  begin
    perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
      'expectedRevision',6,'payload',jsonb_build_object('playerId',player_ids[3])));
    raise exception 'Stale elimination accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
      'expectedRevision',7,'payload',jsonb_build_object('playerId',player_ids[3],'prize',99)));
    raise exception 'Prize injection accepted';
  exception when invalid_parameter_value then null; end;
  perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
    'expectedRevision',7,'payload',jsonb_build_object('playerId',player_ids[3])));
  begin
    perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
      'kind','player.undoElimination','expectedRevision',8,
      'payload',jsonb_build_object('playerId',player_ids[4])));
    raise exception 'Older elimination undo accepted';
  exception when object_not_in_prerequisite_state then null; end;
  op := op || jsonb_build_object('id',gen_random_uuid(),'expectedRevision',8,
    'payload',jsonb_build_object('playerId',player_ids[2]));
  perform public.apply_tournament_operation(op);
  if (select status from public.tournaments where id=table_id) <> 'finished'
    or (select clock_ends_at from public.tournaments where id=table_id) is not null
    or (select array_agg(position order by position) from public.tournament_players where tournament_id=table_id)
      <> array[1,2,3,4]
    or (select sum(prize) from public.tournament_players where tournament_id=table_id) <> 2.20
    or (select prize from public.tournament_players where id=player_ids[1]) <> 1.43
    or (select prize from public.tournament_players where id=player_ids[2]) <> 0.77 then
    raise exception 'Final results or cent conservation failed';
  end if;
  begin
    perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
      'expectedRevision',9,'payload',jsonb_build_object('playerId',player_ids[1])));
    raise exception 'Champion elimination accepted';
  exception when object_not_in_prerequisite_state then null; end;
  op := op || jsonb_build_object('id',gen_random_uuid(),'kind','player.undoElimination',
    'expectedRevision',9,'payload',jsonb_build_object('playerId',player_ids[2]));
  receipt := public.apply_tournament_operation(op);
  if public.apply_tournament_operation(op) <> receipt
    or (select status from public.tournaments where id=table_id) <> 'running'
    or (select count(*) from public.tournament_players where tournament_id=table_id and position is null) <> 2
    or (select count(*) from public.tournament_players where tournament_id=table_id and prize is not null) <> 0
    or (select end_time from public.tournaments where id=table_id) is not null then
    raise exception 'Undo final elimination left stale result';
  end if;
  perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
    'expectedRevision',10,'payload',jsonb_build_object('playerId',player_ids[3])));
  if (select count(*) from public.tournament_players where tournament_id=table_id and position is null) <> 3
    or (select position from public.tournament_players where id=player_ids[4]) <> 4
    or (select revision from public.tournaments where id=table_id) <> 11 then
    raise exception 'Undo order or revision failed';
  end if;
end $$;
select set_config('request.jwt.claim.sub','a9920000-0000-4000-8000-000000000001',true);
do $$
declare
  table_id uuid;
  player_ids uuid[];
  base jsonb;
  revision integer;
  field_size integer;
  i integer;
  actual integer[];
  wanted integer[];
begin
  foreach field_size in array array[2,3,6,10] loop
    table_id := gen_random_uuid();
    player_ids := array[]::uuid[];
    base := jsonb_build_object('version',1,'id',gen_random_uuid(),
      'ownerId','a9920000-0000-4000-8000-000000000001','entity','tournament',
      'entityId',table_id,'kind','tournament.create','expectedRevision',0,
      'createdAt','2026-09-29T19:00:00Z','payload',jsonb_build_object(
        'name','Small pool ' || field_size,'format','regular','buyIn',0.01,
        'reEntryAllowed',false,'maxReEntries',0,'startTime','2026-09-29T19:00:00Z',
        'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20}]'::jsonb));
    perform public.apply_tournament_operation(base);
    revision := 1;
    for i in 1..field_size loop
      player_ids := pg_catalog.array_append(player_ids, gen_random_uuid());
      perform public.apply_tournament_operation(base || jsonb_build_object(
        'id',gen_random_uuid(),'kind','player.add','expectedRevision',revision,
        'payload',jsonb_build_object('playerId',player_ids[i],'name','Field player ' || i)));
      revision := revision + 1;
    end loop;
    if field_size = 6 then
      perform public.apply_tournament_operation(base || jsonb_build_object(
        'id',gen_random_uuid(),'kind','player.entries.adjust','expectedRevision',revision,
        'payload',jsonb_build_object('playerId',player_ids[1],'entryKind','addOn',
          'delta',1,'expectedTotalCents',1)));
      revision := revision + 1;
    end if;
    perform public.apply_tournament_operation(base || jsonb_build_object(
      'id',gen_random_uuid(),'kind','tournament.start','expectedRevision',revision,
      'payload','{}'::jsonb));
    revision := revision + 1;
    for i in reverse field_size..2 loop
      perform public.apply_tournament_operation(base || jsonb_build_object(
        'id',gen_random_uuid(),'kind','player.eliminate','expectedRevision',revision,
        'payload',jsonb_build_object('playerId',player_ids[i])));
      revision := revision + 1;
    end loop;
    select pg_catalog.array_agg((p.prize * 100)::integer order by p.position) into actual
      from public.tournament_players p where p.tournament_id = table_id;
    wanted := case field_size
      when 2 then array[2,0]
      when 3 then array[2,1,0]
      when 6 then array[4,2,1,0,0,0]
      when 10 then array[4,3,2,1,0,0,0,0,0,0] end;
    if actual <> wanted or (select status from public.tournaments where id=table_id) <> 'finished' then
      raise exception 'Cent payout differs for field size %: got %, expected %', field_size, actual, wanted;
    end if;
  end loop;
end $$;

set local role postgres;
create function pg_temp.reject_result_audit() returns trigger language plpgsql as $$
begin raise exception 'QA result audit failure' using errcode='23514'; end;
$$;
create trigger qa_reject_result_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_result_audit();
set local role authenticated;
do $$
declare
  op jsonb := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','a9920000-0000-4000-8000-000000000001','entity','tournament',
    'entityId','a9920000-0000-4000-8000-000000000010','kind','player.eliminate',
    'expectedRevision',11,'createdAt','2026-09-29T19:10:00Z',
    'payload',jsonb_build_object('playerId','a9920000-0000-4000-8000-000000000013'));
begin
  begin perform public.apply_tournament_operation(op); raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if (select position from public.tournament_players where id='a9920000-0000-4000-8000-000000000013') is not null
    or (select revision from public.tournaments where id='a9920000-0000-4000-8000-000000000010') <> 11
    or exists(select 1 from public.sync_operation_receipts where operation_id=(op->>'id')::uuid) then
    raise exception 'Result mutation survived audit failure';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_result_audit on public.sync_operation_audit;
set local role authenticated;
select set_config('request.jwt.claim.sub','a9920000-0000-4000-8000-000000000002',true);
do $$
declare
  op jsonb := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','a9920000-0000-4000-8000-000000000002','entity','tournament',
    'entityId','a9920000-0000-4000-8000-000000000010','kind','player.eliminate',
    'expectedRevision',11,'createdAt','2026-09-29T19:11:00Z',
    'payload',jsonb_build_object('playerId','a9920000-0000-4000-8000-000000000013'));
begin
  begin perform public.apply_tournament_operation(op); raise exception 'Foreign elimination accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Results: finish, prizes, undo, receipts, rollback and isolation passed' as result;
