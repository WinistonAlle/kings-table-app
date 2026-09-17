import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
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
const expected = (await readdir(new URL('../supabase/migrations/', import.meta.url)))
  .filter(name => /^\d{14}_.+\.sql$/.test(name)).map(name => name.slice(0,14)).sort();
assert.deepEqual(versions.split('\n'), expected);
await sql(await readFile(new URL('../supabase/tests/account_backups.sql', import.meta.url), 'utf8'));
await sql(await readFile(new URL('../supabase/tests/preset_operations.sql', import.meta.url), 'utf8'));

const actor = randomUUID();
const presetId = randomUUID();
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
  const operation = {
    version: 1, id: randomUUID(), ownerId: actor, entity: 'preset', entityId: presetId,
    kind: 'preset.save', expectedRevision: 0, createdAt: new Date().toISOString(),
    payload: { name: 'Concurrent preset', levels: [
      { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 },
    ] },
  };
  const command = op => `select public.apply_preset_operation('${JSON.stringify(op).replaceAll("'", "''")}'::jsonb);`;
  for (const mode of ['duplicate', 'stale']) {
    const firstOp = mode === 'duplicate' ? operation : { ...operation, id: randomUUID(), expectedRevision: 1 };
    const secondOp = mode === 'duplicate' ? firstOp : { ...firstOp, id: randomUUID() };
    first = processSql(`${tag}-a`);
    first.child.stdin.write(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${command(firstOp)} select 'FIRST_LOCKED';\n`);
    await until(() => first.output().includes('FIRST_LOCKED'), 'Preset transaction did not acquire lock');
    second = processSql(`${tag}-b`);
    second.child.stdin.end(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${command(secondOp)} commit;`);
    await until(async () => (await sql(`select count(*) from pg_stat_activity
      where application_name='${tag}-b' and wait_event_type='Lock';`)) === '1',
      'Concurrent preset command never waited for lock');
    first.child.stdin.end('commit;\n');
    const a = await first.completed;
    const b = await second.completed;
    assert.equal(a.code, 0, a.stderr);
    if (mode === 'duplicate') {
      assert.equal(b.code, 0, b.stderr);
      const receipt = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')));
      assert.deepEqual(receipt(a.stdout), receipt(b.stdout));
    } else {
      assert.notEqual(b.code, 0, 'Competing preset revision was accepted');
      assert.match(b.stderr, /40001/);
    }
  }
  assert.equal(await sql(`select revision from public.blind_structures where id='${presetId}';`), '2');
  assert.equal(await sql(`select count(*) from public.sync_operation_receipts where actor_id='${actor}';`), '2');
  assert.equal(await sql(`select count(*) from public.sync_operation_audit where actor_id='${actor}';`), '2');
  console.log('PASS: canonical migrations, RLS, preset validation/rollback, backup race, preset retry race and preset revision race.');
} finally {
  // Terminate only the two fixture sessions, then remove only our random actor.
  await sql(`select pg_terminate_backend(pid) from pg_stat_activity
    where application_name in ('${tag}-a','${tag}-b') and pid <> pg_backend_pid();`);
  first?.child.stdin.end();
  second?.child.stdin.end();
  if (first) await first.completed;
  if (second) await second.completed;
  await sql(`delete from public.blind_structures where id='${presetId}' and owner_id='${actor}';
    delete from auth.users where id='${actor}';`);
  assert.equal(await sql(`select count(*) from public.profiles where id='${actor}';`), '0');
}
