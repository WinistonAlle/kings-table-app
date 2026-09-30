begin;
insert into auth.users(id,email,raw_user_meta_data) values
('9a62c39b-1234-4321-8c12-123456789001','invite-a@example.invalid','{}'),
('9a62c39b-1234-4321-8c12-123456789002','invite-b@example.invalid','{}');
create function pg_temp.invite_op(p_table uuid, p_owner uuid, p_kind text, p_revision integer, p_payload jsonb)
returns jsonb language sql as $$
  select pg_catalog.jsonb_build_object('version',1,'id',pg_catalog.gen_random_uuid(),
    'ownerId',p_owner,'entity','tournament','entityId',p_table,'kind',p_kind,
    'expectedRevision',p_revision,'createdAt','2026-09-30T13:00:00Z','payload',p_payload);
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','9a62c39b-1234-4321-8c12-123456789001',true);
do $$
declare
  owner uuid := '9a62c39b-1234-4321-8c12-123456789001';
  target uuid := '9a62c39b-1234-4321-8c12-123456789100';
  ana uuid := '9a62c39b-1234-4321-8c12-123456789101';
  bia uuid := '9a62c39b-1234-4321-8c12-123456789102';
  caio uuid := '9a62c39b-1234-4321-8c12-123456789103';
  player_ana uuid := '9a62c39b-1234-4321-8c12-123456789104';
  player_bia uuid := '9a62c39b-1234-4321-8c12-123456789105';
  creation jsonb; command jsonb; result jsonb; future_time text;
begin
  future_time := to_char((now() + interval '3 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"');
  creation := pg_temp.invite_op(target,owner,'tournament.create',0,
    pg_catalog.jsonb_build_object('name','Convites','format','regular','buyIn',20,
      'reEntryAllowed',false,'maxReEntries',0,'startTime',future_time,'capacity',2,
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20}]'::jsonb));
  perform public.apply_tournament_operation(creation);
  command := pg_temp.invite_op(target,owner,'invite.add',1,
    pg_catalog.jsonb_build_object('inviteId',ana,'name',' Ana ','status','confirmed'));
  result := public.apply_tournament_operation(command);
  if result <> pg_catalog.jsonb_build_object('operationId',command->>'id','revision',2)
    or public.apply_tournament_operation(command) <> result then raise exception 'Invite retry changed receipt'; end if;
  perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'invite.add',2,
    pg_catalog.jsonb_build_object('inviteId',bia,'name','Bia','status','confirmed')));
  perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'invite.add',3,
    pg_catalog.jsonb_build_object('inviteId',caio,'name','Caio','status','confirmed')));
  if (select status from public.tournament_invites where id=ana) <> 'confirmed'
    or (select name from public.tournament_invites where id=ana) <> 'Ana'
    or (select status from public.tournament_invites where id=caio) <> 'waiting'
    or (select revision from public.tournaments where id=target) <> 4 then
    raise exception 'Reservation or waiting status differs';
  end if;
  begin
    perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'invite.add',4,
      pg_catalog.jsonb_build_object('inviteId',pg_catalog.gen_random_uuid(),'name',' ana ','status','maybe')));
    raise exception 'Duplicate invite name accepted';
  exception when unique_violation then null; end;
  begin
    perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'invite.add',4,
      pg_catalog.jsonb_build_object('inviteId',pg_catalog.gen_random_uuid(),'name','','status','confirmed')));
    raise exception 'Empty invite name accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'invite.checkIn',4,
      pg_catalog.jsonb_build_object('inviteId',caio,'playerId',pg_catalog.gen_random_uuid())));
    raise exception 'Waiting invite checked in';
  exception when object_not_in_prerequisite_state then null; end;
  begin
    perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'player.add',4,
      pg_catalog.jsonb_build_object('playerId',pg_catalog.gen_random_uuid(),'name','Extra')));
    raise exception 'Reservation bypassed by player add';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'tournament.update',4,
      pg_catalog.jsonb_build_object('startTime',future_time,'location','Menor','capacity',1)));
    raise exception 'Capacity shrank below reservations';
  exception when invalid_parameter_value then null; end;
  command := pg_temp.invite_op(target,owner,'invite.checkIn',4,
    pg_catalog.jsonb_build_object('inviteId',ana,'playerId',player_ana));
  result := public.apply_tournament_operation(command);
  if public.apply_tournament_operation(command) <> result
    or (select player_id from public.tournament_invites where id=ana) <> player_ana
    or (select payment_status from public.tournament_players where id=player_ana) <> 'pending'
    or (select count(*) from public.tournament_players where tournament_id=target) <> 1 then
    raise exception 'Check-in or retry differs';
  end if;
  begin
    perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'invite.remove',5,
      pg_catalog.jsonb_build_object('inviteId',ana)));
    raise exception 'Checked-in invite removed';
  exception when object_not_in_prerequisite_state then null; end;
  perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'invite.attendance',5,
    pg_catalog.jsonb_build_object('inviteId',bia,'status','absent')));
  perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'invite.attendance',6,
    pg_catalog.jsonb_build_object('inviteId',caio,'status','confirmed')));
  if (select status from public.tournament_invites where id=caio) <> 'confirmed' then
    raise exception 'Waiting invite did not take available place';
  end if;
  perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'invite.remove',7,
    pg_catalog.jsonb_build_object('inviteId',caio)));
  if (select deleted_at from public.tournament_invites where id=caio) is null then
    raise exception 'Removal did not leave a tombstone';
  end if;
  perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'invite.attendance',8,
    pg_catalog.jsonb_build_object('inviteId',bia,'status','confirmed')));
  perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'player.add',9,
    pg_catalog.jsonb_build_object('playerId',player_bia,'name','Bia')));
  perform public.apply_tournament_operation(pg_temp.invite_op(target,owner,'invite.checkIn',10,
    pg_catalog.jsonb_build_object('inviteId',bia,'playerId',player_bia)));
  if (select count(*) from public.tournament_players where tournament_id=target) <> 2
    or (select player_id from public.tournament_invites where id=bia) <> player_bia
    or (select revision from public.tournaments where id=target) <> 11
    or (select count(*) from public.sync_operation_audit where entity_id=target) <> 11 then
    raise exception 'Existing player linking or audit differs';
  end if;
  begin
    insert into public.tournament_invites(id,tournament_id,name,status)
      values(pg_catalog.gen_random_uuid(),target,'Bypass','confirmed');
    raise exception 'Direct invite insert allowed';
  exception when insufficient_privilege then null; end;
end $$;

set local role postgres;
create function pg_temp.reject_invite_audit() returns trigger language plpgsql as $$
begin raise exception 'QA audit failure' using errcode='23514'; end;
$$;
create trigger qa_reject_invite_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_invite_audit();
set local role authenticated;
do $$
declare owner uuid := '9a62c39b-1234-4321-8c12-123456789001';
  target uuid := '9a62c39b-1234-4321-8c12-123456789100';
  invite_id uuid := '9a62c39b-1234-4321-8c12-123456789106';
  command jsonb;
begin
  command := pg_temp.invite_op(target,owner,'invite.add',11,
    pg_catalog.jsonb_build_object('inviteId',invite_id,'name','Dora','status','maybe'));
  begin perform public.apply_tournament_operation(command); raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if exists(select 1 from public.tournament_invites where id=invite_id)
    or (select revision from public.tournaments where id=target) <> 11
    or exists(select 1 from public.sync_operation_receipts where operation_id=(command->>'id')::uuid) then
    raise exception 'Partial invitation survived audit failure';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_invite_audit on public.sync_operation_audit;
set local role authenticated;
select set_config('request.jwt.claim.sub','9a62c39b-1234-4321-8c12-123456789002',true);
do $$
declare target uuid := '9a62c39b-1234-4321-8c12-123456789100';
  foreign_owner uuid := '9a62c39b-1234-4321-8c12-123456789002';
begin
  if exists(select 1 from public.tournament_invites where tournament_id=target) then
    raise exception 'Other account read invitations';
  end if;
  begin
    perform public.apply_tournament_operation(pg_temp.invite_op(target,foreign_owner,'invite.add',11,
      pg_catalog.jsonb_build_object('inviteId',pg_catalog.gen_random_uuid(),'name','Intruso','status','confirmed')));
    raise exception 'Other account changed invitations';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform 1 from public.tournament_invites; raise exception 'Anonymous read invitations';
  exception when insufficient_privilege then null; end;
  begin perform public.apply_tournament_operation('{}'); raise exception 'Anonymous invitation command';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Tournament invitations: reservations, check-in, receipts, rollback and RLS passed' as result;
