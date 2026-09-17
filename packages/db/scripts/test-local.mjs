import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const container = 'supabase_db_kings-table-local';
const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');
assert.match(config, /^project_id = "kings-table-local"$/m);

function processSql(applicationName = 'kt-local-tests') {
  const child = spawn('docker', ['exec', '-i', '-e', `PGAPPNAME=${applicationName}`,
    '-e', 'PGOPTIONS=-c statement_timeout=15000 -c lock_timeout=12000',
    container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-A', '-t'], { cwd });
  let stdout = '';
  let stderr = '';
  const timeout = setTimeout(() => child.kill(), 30_000);
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const completed = new Promise((resolve, reject) => {
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', code => { clearTimeout(timeout); resolve({ code, stdout, stderr }); });
  });
  // Attach immediately, even when this session deliberately stays open.
  completed.catch(() => {});
  return { child, completed, output: () => stdout };
}

async function sql(text) {
  const session = processSql();
  session.child.stdin.end(text);
  const result = await session.completed;
  assert.equal(result.code, 0, result.stderr);
  return result.stdout.trim();
}

async function until(check, message) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(message);
}

// This runner has no db-url, linked-project or remote credentials option.
const versions = await sql('select version from supabase_migrations.schema_migrations order by version;');
const expected = ['20260420000001', '20260916192006', '20260916192808', '20260916192902'];
assert.deepEqual(versions.split('\n'), expected);
await sql(await readFile(new URL('../supabase/tests/account_backups.sql', import.meta.url), 'utf8'));

const actor = randomUUID();
const tag = `kt-race-${randomUUID()}`;
let first;
let second;
try {
  await sql(`insert into auth.users(id,email,raw_user_meta_data)
    values ('${actor}','${actor}@example.invalid','{}');
    set role authenticated;
    select set_config('request.jwt.claim.sub','${actor}',false);
    select public.save_account_backup('{"version":1}',0);`);
  first = processSql(`${tag}-a`);
  first.child.stdin.write(`begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub','${actor}',true);
    select public.save_account_backup('{"version":1,"writer":"a"}',1);
    select 'FIRST_LOCKED';\n`);
  await until(() => first.output().includes('FIRST_LOCKED'), 'First transaction did not acquire its lock');
  second = processSql(`${tag}-b`);
  second.child.stdin.end(`begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub','${actor}',true);
    select public.save_account_backup('{"version":1,"writer":"b"}',1);
    commit;`);
  await until(async () => (await sql(`select count(*) from pg_stat_activity
    where application_name='${tag}-b' and wait_event_type='Lock';`)) === '1',
    'Second transaction never waited for the competing write');
  first.child.stdin.end('commit;\n');
  const winner = await first.completed;
  const loser = await second.completed;
  assert.equal(winner.code, 0, winner.stderr);
  assert.notEqual(loser.code, 0, 'Concurrent stale write was accepted');
  assert.match(loser.stderr, /40001/);
  assert.equal(await sql(`select revision || ':' || (snapshot->>'writer')
    from public.account_backups where owner_id='${actor}';`), '2:a');
  console.log('PASS: four migrations, account RLS, validation, rollback and two competing transactions.');
} finally {
  // Terminate only the two fixture sessions, then remove only our random actor.
  await sql(`select pg_terminate_backend(pid) from pg_stat_activity
    where application_name in ('${tag}-a','${tag}-b') and pid <> pg_backend_pid();`);
  first?.child.stdin.end();
  second?.child.stdin.end();
  if (first) await first.completed;
  if (second) await second.completed;
  await sql(`delete from auth.users where id='${actor}';`);
  assert.equal(await sql(`select count(*) from public.profiles where id='${actor}';`), '0');
}
