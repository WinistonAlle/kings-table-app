-- Local Postgres fixtures only. Entire suite rolls back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('cb62c39b-1234-4321-8c12-123456789001','entries-a@example.invalid','{}'),
('cb62c39b-1234-4321-8c12-123456789002','entries-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','cb62c39b-1234-4321-8c12-123456789001',true);
do $$
declare
  target uuid := 'cb62c39b-1234-4321-8c12-123456789100';
  player_id uuid := 'cb62c39b-1234-4321-8c12-123456789101';
  base jsonb;
  create_op jsonb;
  command jsonb;
  attempt jsonb;
  receipt jsonb;
begin
  base := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','cb62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',target,'kind','tournament.create','expectedRevision',0,
    'createdAt','2026-09-29T12:00:00Z','payload',jsonb_build_object(
      'name','Entries','format','regular','buyIn',25,'reEntryAllowed',true,
      'maxReEntries',2,'startTime','2026-09-30T19:30:00Z',
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20}]'::jsonb));
  perform public.apply_tournament_operation(base);
  perform public.apply_tournament_operation(base || jsonb_build_object(
    'id',gen_random_uuid(),'kind','player.add','expectedRevision',1,
    'payload',jsonb_build_object('playerId',player_id,'name','Ana')));
  command := base || jsonb_build_object('id',gen_random_uuid(),'kind','player.entries.adjust',
    'expectedRevision',2,'payload',jsonb_build_object('playerId',player_id,
      'entryKind','reEntry','delta',1,'expectedTotalCents',2500));
  receipt := public.apply_tournament_operation(command);
  if receipt <> jsonb_build_object('operationId',command->>'id','revision',3)
    or public.apply_tournament_operation(command) <> receipt
    or (select re_entries from public.tournament_players where id=player_id) <> 1
    or (select total_after_cents from public.player_entry_events
      where operation_id=(command->>'id')::uuid) <> 5000 then
    raise exception 'Re-entry did not record atomically';
  end if;
  begin
    perform public.apply_tournament_operation(jsonb_set(command,'{payload,delta}','-1'));
    raise exception 'Changed command ID accepted';
  exception when invalid_parameter_value then null; end;
  for attempt in select v from (values
    ('{}'::jsonb),
    (jsonb_build_object('playerId',player_id,'entryKind','bad','delta',1,'expectedTotalCents',5000)),
    (jsonb_build_object('playerId',player_id,'entryKind','addOn','delta',2,'expectedTotalCents',5000)),
    (jsonb_build_object('playerId',player_id,'entryKind','addOn','delta',1,'expectedTotalCents',50.5)),
    (jsonb_build_object('playerId',player_id,'entryKind','addOn','delta',1,'expectedTotalCents',5000,'extra',true))
  ) bad(v) loop
    begin
      perform public.apply_tournament_operation(command || jsonb_build_object(
        'id',gen_random_uuid(),'expectedRevision',3,'payload',attempt));
      raise exception 'Invalid entry accepted: %',attempt;
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.apply_tournament_operation(command || jsonb_build_object(
      'id',gen_random_uuid(),'expectedRevision',3,'payload',
      jsonb_build_object('playerId',player_id,'entryKind','addOn','delta',1,'expectedTotalCents',2500)));
    raise exception 'Stale total accepted';
  exception when serialization_failure then null; end;
  perform public.apply_tournament_operation(base || jsonb_build_object('id',gen_random_uuid(),
    'kind','player.payment.set','expectedRevision',3,'payload',
    jsonb_build_object('playerId',player_id,'status','confirmed','expectedAmountCents',5000)));
  begin
    perform public.apply_tournament_operation(command || jsonb_build_object(
      'id',gen_random_uuid(),'expectedRevision',4,'payload',
      jsonb_build_object('playerId',player_id,'entryKind','reEntry','delta',-1,'expectedTotalCents',5000)));
    raise exception 'Paid entry was reduced';
  exception when object_not_in_prerequisite_state then null; end;
  perform public.apply_tournament_operation(command || jsonb_build_object(
    'id',gen_random_uuid(),'expectedRevision',4,'payload',
    jsonb_build_object('playerId',player_id,'entryKind','addOn','delta',1,'expectedTotalCents',5000)));
  if (select payment_status from public.tournament_players where id=player_id) <> 'pending'
    or (select e.status_after from public.player_payment_events e
      where e.status_before='confirmed' and e.player_id=(command->'payload'->>'playerId')::uuid) <> 'pending'
    or (select e.amount_cents from public.player_payment_events e
      where e.status_before='confirmed' and e.player_id=(command->'payload'->>'playerId')::uuid) <> 7500 then
    raise exception 'New charge remained marked paid';
  end if;
  perform public.apply_tournament_operation(command || jsonb_build_object(
    'id',gen_random_uuid(),'expectedRevision',5,'payload',
    jsonb_build_object('playerId',player_id,'entryKind','addOn','delta',-1,'expectedTotalCents',7500)));
  perform public.apply_tournament_operation(command || jsonb_build_object(
    'id',gen_random_uuid(),'expectedRevision',6,'payload',
    jsonb_build_object('playerId',player_id,'entryKind','reEntry','delta',-1,'expectedTotalCents',5000)));
  if (select financial_activity_recorded from public.tournament_players where id=player_id) is not true
    or (select re_entries from public.tournament_players where id=player_id) <> 0
    or (select add_ons from public.tournament_players where id=player_id) <> 0 then
    raise exception 'Correction lost sticky history';
  end if;
  begin
    perform public.apply_tournament_operation(command || jsonb_build_object('id',gen_random_uuid(),
      'kind','player.remove','expectedRevision',7,
      'payload',jsonb_build_object('playerId',player_id)));
    raise exception 'Corrected player was removed';
  exception when object_not_in_prerequisite_state then null; end;
  begin
    perform public.apply_tournament_operation(command || jsonb_build_object(
      'id',gen_random_uuid(),'expectedRevision',7,'payload',
      jsonb_build_object('playerId',player_id,'entryKind','reEntry','delta',-1,'expectedTotalCents',2500)));
    raise exception 'Negative re-entry accepted';
  exception when object_not_in_prerequisite_state then null; end;
  perform public.apply_tournament_operation(command || jsonb_build_object(
    'id',gen_random_uuid(),'expectedRevision',7));
  perform public.apply_tournament_operation(command || jsonb_build_object(
    'id',gen_random_uuid(),'expectedRevision',8,'payload',
    jsonb_build_object('playerId',player_id,'entryKind','reEntry','delta',1,'expectedTotalCents',5000)));
  begin
    perform public.apply_tournament_operation(command || jsonb_build_object(
      'id',gen_random_uuid(),'expectedRevision',9,'payload',
      jsonb_build_object('playerId',player_id,'entryKind','reEntry','delta',1,'expectedTotalCents',7500)));
    raise exception 'Re-entry limit exceeded';
  exception when object_not_in_prerequisite_state then null; end;
  if (select revision from public.tournaments where id=target) <> 9
    or (select count(*) from public.player_entry_events where tournament_id=target) <> 6
    or (select count(*) from public.sync_operation_audit where entity_id=target) <> 9 then
    raise exception 'Entry events or revisions differ';
  end if;
  create_op := base || jsonb_build_object('id',gen_random_uuid(),
    'entityId',gen_random_uuid(),'payload',jsonb_set(jsonb_set(base->'payload',
      '{reEntryAllowed}','false'),'{maxReEntries}','0'));
  perform public.apply_tournament_operation(create_op);
  perform public.apply_tournament_operation(create_op || jsonb_build_object(
    'id',gen_random_uuid(),'kind','player.add','expectedRevision',1,
    'payload',jsonb_build_object('playerId',gen_random_uuid(),'name','Sem reentrada')));
  begin
    perform public.apply_tournament_operation(create_op || jsonb_build_object(
      'id',gen_random_uuid(),'kind','player.entries.adjust','expectedRevision',2,
      'payload',jsonb_build_object('playerId',
        (select id from public.tournament_players where tournament_id=(create_op->>'entityId')::uuid),
        'entryKind','reEntry','delta',1,'expectedTotalCents',2500)));
    raise exception 'Disabled re-entry was accepted';
  exception when object_not_in_prerequisite_state then null; end;
end $$;

-- Entry history alone prevents removal even if the sticky marker is corrupted.
do $$
declare
  target uuid := 'cb62c39b-1234-4321-8c12-123456789100';
  player_id uuid := 'cb62c39b-1234-4321-8c12-123456789102';
  op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','cb62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId',target,'kind','player.add','expectedRevision',9,
    'createdAt','2026-09-29T12:01:00Z',
    'payload',jsonb_build_object('playerId',player_id,'name','Bia'));
  perform public.apply_tournament_operation(op);
  op := op || jsonb_build_object('id',gen_random_uuid(),'kind','player.entries.adjust',
    'expectedRevision',10,'payload',jsonb_build_object('playerId',player_id,
      'entryKind','addOn','delta',1,'expectedTotalCents',2500));
  perform public.apply_tournament_operation(op);
  perform public.apply_tournament_operation(op || jsonb_build_object('id',gen_random_uuid(),
    'expectedRevision',11,'payload',jsonb_build_object('playerId',player_id,
      'entryKind','addOn','delta',-1,'expectedTotalCents',5000)));
end $$;
set local role postgres;
update public.tournament_players set financial_activity_recorded=false
  where id='cb62c39b-1234-4321-8c12-123456789102';
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','cb62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','cb62c39b-1234-4321-8c12-123456789100','kind','player.remove',
    'expectedRevision',12,'createdAt','2026-09-29T12:02:00Z',
    'payload',jsonb_build_object('playerId','cb62c39b-1234-4321-8c12-123456789102'));
  begin perform public.apply_tournament_operation(op); raise exception 'Entry history erased';
  exception when object_not_in_prerequisite_state then null; end;
  if (select count(*) from public.player_entry_events
      where player_id='cb62c39b-1234-4321-8c12-123456789102') <> 2 then
    raise exception 'Entry history disappeared';
  end if;
end $$;

set local role postgres;
insert into public.payment_proofs(id,tournament_id,player_id,storage_path)
  values('cb62c39b-1234-4321-8c12-123456789201',
    'cb62c39b-1234-4321-8c12-123456789100',
    'cb62c39b-1234-4321-8c12-123456789101','qa-entry-proof');
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','cb62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','cb62c39b-1234-4321-8c12-123456789100','kind','player.entries.adjust',
    'expectedRevision',12,'createdAt','2026-09-29T12:02:00Z',
    'payload',jsonb_build_object('playerId','cb62c39b-1234-4321-8c12-123456789101',
      'entryKind','reEntry','delta',-1,'expectedTotalCents',7500));
  begin perform public.apply_tournament_operation(op); raise exception 'Entry proof ignored';
  exception when object_not_in_prerequisite_state then null; end;
end $$;

set local role postgres;
create function pg_temp.reject_entry_audit() returns trigger language plpgsql as $$
begin raise exception 'QA entry audit failure' using errcode='23514'; end;
$$;
create trigger qa_reject_entry_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_entry_audit();
set local role authenticated;
do $$
declare op jsonb;
begin
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','cb62c39b-1234-4321-8c12-123456789001','entity','tournament',
    'entityId','cb62c39b-1234-4321-8c12-123456789100','kind','player.entries.adjust',
    'expectedRevision',12,'createdAt','2026-09-29T12:03:00Z',
    'payload',jsonb_build_object('playerId','cb62c39b-1234-4321-8c12-123456789101',
      'entryKind','addOn','delta',1,'expectedTotalCents',7500));
  begin perform public.apply_tournament_operation(op); raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if (select add_ons from public.tournament_players
      where id='cb62c39b-1234-4321-8c12-123456789101') <> 0
    or (select revision from public.tournaments where id=(op->>'entityId')::uuid) <> 12
    or exists(select 1 from public.player_entry_events where operation_id=(op->>'id')::uuid)
    or exists(select 1 from public.sync_operation_receipts where operation_id=(op->>'id')::uuid) then
    raise exception 'Partial entry survived audit failure';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_entry_audit on public.sync_operation_audit;
set local role authenticated;
select set_config('request.jwt.claim.sub','cb62c39b-1234-4321-8c12-123456789002',true);
do $$
declare op jsonb;
begin
  if exists(select 1 from public.player_entry_events where
    tournament_id='cb62c39b-1234-4321-8c12-123456789100') then
    raise exception 'Foreign entry history exposed';
  end if;
  op := jsonb_build_object('version',1,'id',gen_random_uuid(),
    'ownerId','cb62c39b-1234-4321-8c12-123456789002','entity','tournament',
    'entityId','cb62c39b-1234-4321-8c12-123456789100','kind','player.entries.adjust',
    'expectedRevision',12,'createdAt','2026-09-29T12:04:00Z',
    'payload',jsonb_build_object('playerId','cb62c39b-1234-4321-8c12-123456789101',
      'entryKind','addOn','delta',1,'expectedTotalCents',7500));
  begin perform public.apply_tournament_operation(op); raise exception 'Foreign entry accepted';
  exception when insufficient_privilege then null; end;
  begin delete from public.player_entry_events where tournament_id=(op->>'entityId')::uuid;
    raise exception 'Direct entry event deleted';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.apply_tournament_operation('{}'); raise exception 'Anonymous entry accepted';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.player_entry_events; raise exception 'Anonymous entry history read';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Player entries: limits, payment reset, corrections, immutable history and isolation passed' as result;
