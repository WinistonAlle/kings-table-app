-- PostgreSQL CHECK also accepts NULL expressions: reject JSON null explicitly.
alter table public.account_backups drop constraint account_backups_snapshot_check;
alter table public.account_backups add constraint account_backups_snapshot_check
check (jsonb_typeof(snapshot) = 'object'
  and coalesce(snapshot->>'version' = '1', false)
  and octet_length(snapshot::text) <= 5242880);
