begin;
insert into auth.users(id,email,raw_user_meta_data) values
  ('ab62c39b-1234-4321-8c12-123456789001','waitlist-a@example.invalid','{}');
create function pg_temp.waitlist_op(p_table uuid, p_kind text, p_revision integer, p_payload jsonb)
returns jsonb language sql as $$
  select pg_catalog.jsonb_build_object('version',1,'id',pg_catalog.gen_random_uuid(),
    'ownerId','ab62c39b-1234-4321-8c12-123456789001',
    'entity','tournament','entityId',p_table,'kind',p_kind,
    'expectedRevision',p_revision,'createdAt','2026-09-30T14:00:00Z','payload',p_payload);
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','ab62c39b-1234-4321-8c12-123456789001',true);
do $$
declare
  target uuid := 'ab62c39b-1234-4321-8c12-123456789100';
  ana uuid := 'ab62c39b-1234-4321-8c12-123456789101';
  bia uuid := 'ab62c39b-1234-4321-8c12-123456789102';
  caio uuid := 'ab62c39b-1234-4321-8c12-123456789103';
  dora uuid := 'ab62c39b-1234-4321-8c12-123456789104';
  eva uuid := 'ab62c39b-1234-4321-8c12-123456789105';
  faro uuid := 'ab62c39b-1234-4321-8c12-123456789106';
  gabi uuid := 'ab62c39b-1234-4321-8c12-123456789107';
  future_time text;
begin
  future_time := to_char((now() + interval '3 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"');
  perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'tournament.create',0,
    pg_catalog.jsonb_build_object('name','Lista de espera','format','regular','buyIn',20,
      'reEntryAllowed',false,'maxReEntries',0,'startTime',future_time,'capacity',2,
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20}]'::jsonb)));
  perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'invite.add',1,
    pg_catalog.jsonb_build_object('inviteId',ana,'name','Ana','status','confirmed')));
  perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'invite.add',2,
    pg_catalog.jsonb_build_object('inviteId',bia,'name','Bia','status','confirmed')));
  perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'invite.add',3,
    pg_catalog.jsonb_build_object('inviteId',caio,'name','Caio','status','confirmed')));
  perform pg_catalog.pg_sleep(0.002);
  perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'invite.add',4,
    pg_catalog.jsonb_build_object('inviteId',dora,'name','Dora','status','confirmed')));
  if (select status from public.tournament_invites where id=caio) <> 'waiting'
    or (select status from public.tournament_invites where id=dora) <> 'waiting' then
    raise exception 'Overflow was not queued';
  end if;
  perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'invite.attendance',5,
    pg_catalog.jsonb_build_object('inviteId',bia,'status','absent')));
  if (select status from public.tournament_invites where id=caio) <> 'confirmed'
    or (select status from public.tournament_invites where id=dora) <> 'waiting' then
    raise exception 'First queued guest was not promoted after absence';
  end if;
  perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'invite.remove',6,
    pg_catalog.jsonb_build_object('inviteId',ana)));
  if (select status from public.tournament_invites where id=dora) <> 'confirmed' then
    raise exception 'Second queued guest was not promoted after removal';
  end if;
  perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'invite.add',7,
    pg_catalog.jsonb_build_object('inviteId',eva,'name','Eva','status','confirmed')));
  perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'tournament.update',8,
    pg_catalog.jsonb_build_object('startTime',future_time,'location','Sala','capacity',3)));
  if (select status from public.tournament_invites where id=eva) <> 'confirmed' then
    raise exception 'Capacity increase did not promote next guest';
  end if;
  perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'invite.add',9,
    pg_catalog.jsonb_build_object('inviteId',faro,'name','Faro','status','confirmed')));
  perform pg_catalog.pg_sleep(0.002);
  perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'invite.add',10,
    pg_catalog.jsonb_build_object('inviteId',gabi,'name','Gabi','status','confirmed')));
end $$;

set local role postgres;
create function pg_temp.reject_waitlist_audit() returns trigger language plpgsql as $$
begin raise exception 'QA waitlist audit failure' using errcode='23514'; end;
$$;
create trigger qa_reject_waitlist_audit before insert on public.sync_operation_audit
  for each row execute function pg_temp.reject_waitlist_audit();
set local role authenticated;
do $$
declare target uuid := 'ab62c39b-1234-4321-8c12-123456789100';
  caio uuid := 'ab62c39b-1234-4321-8c12-123456789103';
  faro uuid := 'ab62c39b-1234-4321-8c12-123456789106';
begin
  begin
    perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'invite.attendance',11,
      pg_catalog.jsonb_build_object('inviteId',caio,'status','absent')));
    raise exception 'Audit failure accepted';
  exception when check_violation then null; end;
  if (select status from public.tournament_invites where id=caio) <> 'confirmed'
    or (select status from public.tournament_invites where id=faro) <> 'waiting'
    or (select revision from public.tournaments where id=target) <> 11 then
    raise exception 'Promotion or attendance survived audit rollback';
  end if;
end $$;
set local role postgres;
drop trigger qa_reject_waitlist_audit on public.sync_operation_audit;
set local role authenticated;
do $$
declare
  target uuid := 'ab62c39b-1234-4321-8c12-123456789100';
  second uuid := 'ab62c39b-1234-4321-8c12-123456789200';
  faro uuid := 'ab62c39b-1234-4321-8c12-123456789106';
  gabi uuid := 'ab62c39b-1234-4321-8c12-123456789107';
  manual uuid := 'ab62c39b-1234-4321-8c12-123456789201';
  invite_ana uuid := 'ab62c39b-1234-4321-8c12-123456789202';
  invite_bia uuid := 'ab62c39b-1234-4321-8c12-123456789203';
  invite_caio uuid := 'ab62c39b-1234-4321-8c12-123456789204';
  player_ana uuid := 'ab62c39b-1234-4321-8c12-123456789205';
  future_time text;
begin
  future_time := to_char((now() + interval '3 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"');
  perform public.apply_tournament_operation(pg_temp.waitlist_op(target,'tournament.update',11,
    pg_catalog.jsonb_build_object('startTime',future_time,'location','Sala','capacity',null)));
  if (select status from public.tournament_invites where id=faro) <> 'confirmed'
    or (select status from public.tournament_invites where id=gabi) <> 'confirmed'
    or (select revision from public.tournaments where id=target) <> 12 then
    raise exception 'Removing the limit did not promote all queued guests';
  end if;
  perform public.apply_tournament_operation(pg_temp.waitlist_op(second,'tournament.create',0,
    pg_catalog.jsonb_build_object('name','Mesa com jogador','format','regular','buyIn',20,
      'reEntryAllowed',false,'maxReEntries',0,'startTime',future_time,'capacity',2,
      'levels','[{"level":1,"smallBlind":25,"bigBlind":50,"ante":0,"durationMinutes":20}]'::jsonb)));
  perform public.apply_tournament_operation(pg_temp.waitlist_op(second,'player.add',1,
    pg_catalog.jsonb_build_object('playerId',manual,'name','Manual')));
  perform public.apply_tournament_operation(pg_temp.waitlist_op(second,'invite.add',2,
    pg_catalog.jsonb_build_object('inviteId',invite_ana,'name','Ana','status','confirmed')));
  perform public.apply_tournament_operation(pg_temp.waitlist_op(second,'invite.add',3,
    pg_catalog.jsonb_build_object('inviteId',invite_bia,'name','Bia','status','confirmed')));
  perform public.apply_tournament_operation(pg_temp.waitlist_op(second,'player.remove',4,
    pg_catalog.jsonb_build_object('playerId',manual)));
  if (select status from public.tournament_invites where id=invite_bia) <> 'confirmed'
    or (select revision from public.tournaments where id=second) <> 5 then
    raise exception 'Player withdrawal did not promote the waitlist';
  end if;
  perform public.apply_tournament_operation(pg_temp.waitlist_op(second,'invite.add',5,
    pg_catalog.jsonb_build_object('inviteId',invite_caio,'name','Caio','status','confirmed')));
  perform public.apply_tournament_operation(pg_temp.waitlist_op(second,'invite.attendance',6,
    pg_catalog.jsonb_build_object('inviteId',invite_bia,'status','waiting')));
  if (select status from public.tournament_invites where id=invite_bia) <> 'waiting'
    or (select status from public.tournament_invites where id=invite_caio) <> 'confirmed' then
    raise exception 'Returning to waitlist promoted the same guest';
  end if;
  perform public.apply_tournament_operation(pg_temp.waitlist_op(second,'invite.checkIn',7,
    pg_catalog.jsonb_build_object('inviteId',invite_ana,'playerId',player_ana)));
  perform public.apply_tournament_operation(pg_temp.waitlist_op(second,'player.remove',8,
    pg_catalog.jsonb_build_object('playerId',player_ana)));
  if (select status from public.tournament_invites where id=invite_bia) <> 'waiting'
    or (select status from public.tournament_invites where id=invite_ana) <> 'confirmed'
    or (select player_id from public.tournament_invites where id=invite_ana) is not null then
    raise exception 'Removing a checked-in player freed a reserved invite seat';
  end if;
end $$;
rollback;
select 'Tournament waitlist: ordered promotions and audit rollback passed' as result;
