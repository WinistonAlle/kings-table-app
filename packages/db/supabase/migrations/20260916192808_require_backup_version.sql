-- CHECK must reject a missing version too, rather than accepting SQL NULL.
alter table public.account_backups drop constraint account_backups_snapshot_check;
alter table public.account_backups add constraint account_backups_snapshot_check
check (jsonb_typeof(snapshot) = 'object' and snapshot ? 'version'
  and snapshot->>'version' = '1' and octet_length(snapshot::text) <= 5242880);
