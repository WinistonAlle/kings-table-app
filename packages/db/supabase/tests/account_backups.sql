-- Run as postgres. All fixtures are rolled back; no real users are modified.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('adfbb303-fd78-4673-9036-dfdc002e92a1','backup-qa-a@example.invalid','{}'),
('adfbb303-fd78-4673-9036-dfdc002e92b2','backup-qa-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','adfbb303-fd78-4673-9036-dfdc002e92a1',true);
do $$
declare result jsonb;
begin
  result := public.save_account_backup('{"version":1}',0);
  if result->>'revision' <> '1' then raise exception 'Initial revision failed'; end if;
  result := public.save_account_backup('{"version":1}',1);
  if result->>'revision' <> '2' then raise exception 'Update revision failed'; end if;
  begin
    perform public.save_account_backup('{"version":1}',1);
    raise exception 'Stale revision was accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.save_account_backup('{"version":2}',2);
    raise exception 'Invalid version accepted';
  exception when check_violation then null; end;
  begin
    perform public.save_account_backup('{}',2);
    raise exception 'Missing version accepted';
  exception when check_violation then null; end;
  begin
    perform public.save_account_backup('{"version":null}',2);
    raise exception 'Null version accepted';
  exception when check_violation then null; end;
  begin
    perform public.save_account_backup(jsonb_build_object('version',1,'large',repeat('x',5242880)),2);
    raise exception 'Oversized backup accepted';
  exception when check_violation then null; end;
  if (select revision from public.account_backups) <> 2 then
    raise exception 'Rejected writes changed revision';
  end if;
  begin
    perform public.save_account_backup('{"version":1}',-1);
    raise exception 'Negative revision accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_account_backup('{"version":1}',null);
    raise exception 'Null revision accepted';
  exception when invalid_parameter_value then null; end;
  perform 1 from public.league_members;
  perform 1 from public.tournaments;
end $$;
select set_config('request.jwt.claim.sub','adfbb303-fd78-4673-9036-dfdc002e92b2',true);
do $$
declare affected integer;
begin
  if exists(select 1 from public.account_backups) then raise exception 'Foreign backup exposed'; end if;
  if exists(select 1 from public.profiles where id='adfbb303-fd78-4673-9036-dfdc002e92a1') then raise exception 'Foreign profile exposed'; end if;
  update public.account_backups set revision=99 where owner_id='adfbb303-fd78-4673-9036-dfdc002e92a1';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign update allowed'; end if;
  begin
    insert into public.account_backups(owner_id,snapshot) values('adfbb303-fd78-4673-9036-dfdc002e92a1','{"version":1}');
    raise exception 'Foreign insert allowed';
  exception when insufficient_privilege then null; end;
  perform public.save_account_backup('{"version":1}',0);
  if (select count(*) from public.account_backups) <> 1 then raise exception 'Own backup unavailable'; end if;
  begin
    update public.account_backups set owner_id='adfbb303-fd78-4673-9036-dfdc002e92a1';
    raise exception 'Ownership reassignment allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin
    perform 1 from public.account_backups;
    raise exception 'Anonymous read allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_account_backup('{"version":1}',0);
    raise exception 'Anonymous RPC allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Account isolation, anonymous denial, version, size and stale revision checks passed' as result;
