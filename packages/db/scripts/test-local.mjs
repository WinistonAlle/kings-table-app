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
await sql(await readFile(new URL('../supabase/tests/tournament_create.sql', import.meta.url), 'utf8'));
await sql(await readFile(new URL('../supabase/tests/tournament_planning.sql', import.meta.url), 'utf8'));
await sql(await readFile(new URL('../supabase/tests/player_add.sql', import.meta.url), 'utf8'));
await sql(await readFile(new URL('../supabase/tests/player_late_entry.sql', import.meta.url), 'utf8'));
await sql(await readFile(new URL('../supabase/tests/player_results.sql', import.meta.url), 'utf8'));
await sql(await readFile(new URL('../supabase/tests/player_rename.sql', import.meta.url), 'utf8'));
await sql(await readFile(new URL('../supabase/tests/player_remove.sql', import.meta.url), 'utf8'));
await sql(await readFile(new URL('../supabase/tests/player_payment.sql', import.meta.url), 'utf8'));
await sql(await readFile(new URL('../supabase/tests/player_entries.sql', import.meta.url), 'utf8'));
await sql(await readFile(new URL('../supabase/tests/tournament_clock.sql', import.meta.url), 'utf8'));

const actor = randomUUID();
const presetId = randomUUID();
const tournamentIds = [randomUUID(), randomUUID(), randomUUID()];
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
  const tournamentPayload = { name: 'Concurrent table', format: 'regular', buyIn: 37.5,
    reEntryAllowed: false, maxReEntries: 0, startTime: new Date().toISOString(),
    levels: [{ level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 }] };
  const tournamentCommand = op => `select public.apply_tournament_operation('${JSON.stringify(op).replaceAll("'", "''")}'::jsonb);`;
  for (const mode of ['duplicate', 'competing']) {
    const entityId = tournamentIds[mode === 'duplicate' ? 0 : 1];
    const firstOp = { version: 1, id: randomUUID(), ownerId: actor, entity: 'tournament',
      entityId, kind: 'tournament.create', expectedRevision: 0,
      createdAt: new Date().toISOString(), payload: tournamentPayload };
    const secondOp = mode === 'duplicate' ? firstOp : { ...firstOp, id: randomUUID() };
    first = processSql(`${tag}-a`);
    first.child.stdin.write(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(firstOp)} select 'FIRST_LOCKED';\n`);
    await until(() => first.output().includes('FIRST_LOCKED'), 'Tournament transaction did not acquire lock');
    second = processSql(`${tag}-b`);
    second.child.stdin.end(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(secondOp)} commit;`);
    await until(async () => (await sql(`select count(*) from pg_stat_activity
      where application_name='${tag}-b' and wait_event_type='Lock';`)) === '1',
      'Concurrent tournament command never waited for lock');
    first.child.stdin.end('commit;\n');
    const a = await first.completed;
    const b = await second.completed;
    assert.equal(a.code, 0, a.stderr);
    if (mode === 'duplicate') {
      assert.equal(b.code, 0, b.stderr);
      const receipt = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')));
      assert.deepEqual(receipt(a.stdout), receipt(b.stdout));
    } else {
      assert.notEqual(b.code, 0, 'Competing tournament create was accepted');
      assert.match(b.stderr, /40001/);
    }
    assert.equal(await sql(`select count(*) from public.tournaments where id='${entityId}' and created_by='${actor}';`), '1');
  }
  for (const mode of ['duplicate', 'competing']) {
    const revision = mode === 'duplicate' ? 1 : 2;
    const firstOp = { version: 1, id: randomUUID(), ownerId: actor, entity: 'tournament',
      entityId: tournamentIds[0], kind: 'tournament.update', expectedRevision: revision,
      createdAt: new Date().toISOString(), payload: {
        startTime: new Date(Date.now() + 86400000).toISOString(), location: mode,
        capacity: 9,
      } };
    const secondOp = mode === 'duplicate' ? firstOp : { ...firstOp, id: randomUUID() };
    first = processSql(`${tag}-a`);
    first.child.stdin.write(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(firstOp)} select 'FIRST_LOCKED';\n`);
    await until(() => first.output().includes('FIRST_LOCKED'), 'Planning transaction did not acquire lock');
    second = processSql(`${tag}-b`);
    second.child.stdin.end(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(secondOp)} commit;`);
    await until(async () => (await sql(`select count(*) from pg_stat_activity
      where application_name='${tag}-b' and wait_event_type='Lock';`)) === '1',
      'Concurrent planning command never waited for lock');
    first.child.stdin.end('commit;\n');
    const a = await first.completed;
    const b = await second.completed;
    assert.equal(a.code, 0, a.stderr);
    if (mode === 'duplicate') {
      assert.equal(b.code, 0, b.stderr);
      const receipt = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')));
      assert.deepEqual(receipt(a.stdout), receipt(b.stdout));
    } else {
      assert.notEqual(b.code, 0, 'Competing planning revision was accepted');
      assert.match(b.stderr, /40001/);
    }
  }
  assert.equal(await sql(`select revision from public.tournaments where id='${tournamentIds[0]}';`), '3');
  const plan = { version: 1, id: randomUUID(), ownerId: actor, entity: 'tournament',
    entityId: tournamentIds[1], kind: 'tournament.update', expectedRevision: 1,
    createdAt: new Date().toISOString(), payload: {
      startTime: new Date(Date.now() + 86400000).toISOString(), location: 'Capacity race', capacity: 3,
    } };
  const seedPlayer = { ...plan, id: randomUUID(), kind: 'player.add', expectedRevision: 2,
    payload: { playerId: randomUUID(), name: 'First player' } };
  await sql(`set role authenticated; select set_config('request.jwt.claim.sub','${actor}',false);
    ${tournamentCommand(plan)} ${tournamentCommand(seedPlayer)}`);
  for (const mode of ['duplicate', 'last-seat']) {
    const revision = mode === 'duplicate' ? 3 : 4;
    const firstOp = { ...seedPlayer, id: randomUUID(), expectedRevision: revision,
      payload: { playerId: randomUUID(), name: mode === 'duplicate' ? 'Second player' : 'Final seat' } };
    const secondOp = mode === 'duplicate' ? firstOp : { ...firstOp, id: randomUUID(),
      payload: { playerId: randomUUID(), name: 'Competing seat' } };
    first = processSql(`${tag}-a`);
    first.child.stdin.write(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(firstOp)} select 'FIRST_LOCKED';\n`);
    await until(() => first.output().includes('FIRST_LOCKED'), 'Player transaction did not acquire lock');
    second = processSql(`${tag}-b`);
    second.child.stdin.end(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(secondOp)} commit;`);
    await until(async () => (await sql(`select count(*) from pg_stat_activity
      where application_name='${tag}-b' and wait_event_type='Lock';`)) === '1',
      'Concurrent player command never waited for lock');
    first.child.stdin.end('commit;\n');
    const a = await first.completed;
    const b = await second.completed;
    assert.equal(a.code, 0, a.stderr);
    if (mode === 'duplicate') {
      assert.equal(b.code, 0, b.stderr);
      const receipt = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')));
      assert.deepEqual(receipt(a.stdout), receipt(b.stdout));
    } else {
      assert.notEqual(b.code, 0, 'Competing final seat was accepted');
      assert.match(b.stderr, /40001/);
    }
  }
  assert.equal(await sql(`select revision from public.tournaments where id='${tournamentIds[1]}';`), '5');
  assert.equal(await sql(`select count(*) from public.tournament_players where tournament_id='${tournamentIds[1]}';`), '3');
  const removableIds = (await sql(`select id from public.tournament_players
    where tournament_id='${tournamentIds[1]}' order by id;`)).split('\n');
  for (const mode of ['duplicate', 'competing']) {
    const revision = mode === 'duplicate' ? 5 : 6;
    const firstOp = { ...seedPlayer, id: randomUUID(), kind: 'player.remove',
      expectedRevision: revision, payload: { playerId: removableIds[revision - 5] } };
    const secondOp = mode === 'duplicate' ? firstOp : { ...firstOp, id: randomUUID(),
      payload: { playerId: removableIds[2] } };
    first = processSql(`${tag}-a`);
    first.child.stdin.write(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(firstOp)} select 'FIRST_LOCKED';\n`);
    await until(() => first.output().includes('FIRST_LOCKED'), 'Removal transaction did not acquire lock');
    second = processSql(`${tag}-b`);
    second.child.stdin.end(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(secondOp)} commit;`);
    await until(async () => (await sql(`select count(*) from pg_stat_activity
      where application_name='${tag}-b' and wait_event_type='Lock';`)) === '1',
      'Concurrent player removal never waited for lock');
    first.child.stdin.end('commit;\n');
    const a = await first.completed;
    const b = await second.completed;
    assert.equal(a.code, 0, a.stderr);
    if (mode === 'duplicate') {
      assert.equal(b.code, 0, b.stderr);
      const receipt = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')));
      assert.deepEqual(receipt(a.stdout), receipt(b.stdout));
    } else {
      assert.notEqual(b.code, 0, 'Competing removal was accepted');
      assert.match(b.stderr, /40001/);
    }
  }
  const proofId = randomUUID();
  const proofRaceRemoval = { ...seedPlayer, id: randomUUID(), kind: 'player.remove',
    expectedRevision: 7, payload: { playerId: removableIds[2] } };
  first = processSql(`${tag}-a`);
  first.child.stdin.write(`begin;
    insert into public.payment_proofs(id,tournament_id,player_id,storage_path)
    values ('${proofId}','${tournamentIds[1]}','${removableIds[2]}','qa-race');
    select 'FIRST_LOCKED';\n`);
  await until(() => first.output().includes('FIRST_LOCKED'), 'Proof insert did not hold its transaction');
  second = processSql(`${tag}-b`);
  second.child.stdin.end(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${actor}',true);
    ${tournamentCommand(proofRaceRemoval)} commit;`);
  await until(async () => (await sql(`select count(*) from pg_stat_activity
    where application_name='${tag}-b' and wait_event_type='Lock';`)) === '1',
    'Removal did not wait for the concurrent proof');
  first.child.stdin.end('commit;\n');
  const proofCommit = await first.completed;
  const removalAfterProof = await second.completed;
  assert.equal(proofCommit.code, 0, proofCommit.stderr);
  assert.notEqual(removalAfterProof.code, 0, 'Removal erased a concurrent proof');
  assert.match(removalAfterProof.stderr, /55000/);
  assert.equal(await sql(`select count(*) from public.payment_proofs where id='${proofId}';`), '1');
  assert.equal(await sql(`select count(*) from public.tournament_players where id='${removableIds[2]}';`), '1');
  assert.equal(await sql(`select revision from public.tournaments where id='${tournamentIds[1]}';`), '7');
  assert.equal(await sql(`select count(*) from public.tournament_players where tournament_id='${tournamentIds[1]}';`), '1');
  for (const mode of ['duplicate', 'competing']) {
    const revision = mode === 'duplicate' ? 7 : 8;
    const firstOp = { ...seedPlayer, id: randomUUID(), kind: 'player.payment.set',
      expectedRevision: revision, payload: { playerId: removableIds[2],
        status: mode === 'duplicate' ? 'confirmed' : 'disputed', expectedAmountCents: 3750 } };
    const secondOp = mode === 'duplicate' ? firstOp : { ...firstOp, id: randomUUID(),
      payload: { ...firstOp.payload, status: 'pending' } };
    first = processSql(`${tag}-a`);
    first.child.stdin.write(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(firstOp)} select 'FIRST_LOCKED';\n`);
    await until(() => first.output().includes('FIRST_LOCKED'), 'Payment transaction did not acquire lock');
    second = processSql(`${tag}-b`);
    second.child.stdin.end(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(secondOp)} commit;`);
    await until(async () => (await sql(`select count(*) from pg_stat_activity
      where application_name='${tag}-b' and wait_event_type='Lock';`)) === '1',
      'Concurrent payment command never waited for lock');
    first.child.stdin.end('commit;\n');
    const a = await first.completed;
    const b = await second.completed;
    assert.equal(a.code, 0, a.stderr);
    if (mode === 'duplicate') {
      assert.equal(b.code, 0, b.stderr);
      const receipt = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')));
      assert.deepEqual(receipt(a.stdout), receipt(b.stdout));
    } else {
      assert.notEqual(b.code, 0, 'Competing payment revision was accepted');
      assert.match(b.stderr, /40001/);
    }
  }
  assert.equal(await sql(`select revision from public.tournaments where id='${tournamentIds[1]}';`), '9');
  assert.equal(await sql(`select payment_status from public.tournament_players where id='${removableIds[2]}';`), 'disputed');
  assert.equal(await sql(`select count(*) from public.player_payment_events where tournament_id='${tournamentIds[1]}';`), '2');
  for (const mode of ['duplicate', 'competing']) {
    const revision = mode === 'duplicate' ? 9 : 10;
    const firstOp = { ...seedPlayer, id: randomUUID(), kind: 'player.entries.adjust',
      expectedRevision: revision, payload: { playerId: removableIds[2],
        entryKind: 'addOn', delta: 1, expectedTotalCents: revision === 9 ? 3750 : 7500 } };
    const secondOp = mode === 'duplicate' ? firstOp : { ...firstOp, id: randomUUID() };
    first = processSql(`${tag}-a`);
    first.child.stdin.write(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(firstOp)} select 'FIRST_LOCKED';\n`);
    await until(() => first.output().includes('FIRST_LOCKED'), 'Entry transaction did not acquire lock');
    second = processSql(`${tag}-b`);
    second.child.stdin.end(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(secondOp)} commit;`);
    await until(async () => (await sql(`select count(*) from pg_stat_activity
      where application_name='${tag}-b' and wait_event_type='Lock';`)) === '1',
      'Concurrent entry command never waited for lock');
    first.child.stdin.end('commit;\n');
    const a = await first.completed;
    const b = await second.completed;
    assert.equal(a.code, 0, a.stderr);
    if (mode === 'duplicate') {
      assert.equal(b.code, 0, b.stderr);
      const receipt = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')));
      assert.deepEqual(receipt(a.stdout), receipt(b.stdout));
    } else {
      assert.notEqual(b.code, 0, 'Competing entry revision was accepted');
      assert.match(b.stderr, /40001/);
    }
  }
  assert.equal(await sql(`select revision from public.tournaments where id='${tournamentIds[1]}';`), '11');
  assert.equal(await sql(`select add_ons from public.tournament_players where id='${removableIds[2]}';`), '2');
  assert.equal(await sql(`select count(*) from public.player_entry_events where tournament_id='${tournamentIds[1]}';`), '2');
  const startOp = { ...seedPlayer, id: randomUUID(), kind: 'tournament.start',
    expectedRevision: 11, payload: {} };
  await sql(`set role authenticated; select set_config('request.jwt.claim.sub','${actor}',false);
    ${tournamentCommand(startOp)}`);
  for (const mode of ['duplicate', 'competing']) {
    const revision = mode === 'duplicate' ? 12 : 13;
    const firstOp = { ...startOp, id: randomUUID(), kind: mode === 'duplicate' ? 'clock.start' : 'clock.pause',
      expectedRevision: revision };
    const secondOp = mode === 'duplicate' ? firstOp : { ...firstOp, id: randomUUID() };
    first = processSql(`${tag}-a`);
    first.child.stdin.write(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(firstOp)} select 'FIRST_LOCKED';\n`);
    await until(() => first.output().includes('FIRST_LOCKED'), 'Clock transaction did not acquire lock');
    second = processSql(`${tag}-b`);
    second.child.stdin.end(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(secondOp)} commit;`);
    await until(async () => (await sql(`select count(*) from pg_stat_activity
      where application_name='${tag}-b' and wait_event_type='Lock';`)) === '1',
      'Concurrent clock command never waited for lock');
    first.child.stdin.end('commit;\n');
    const a = await first.completed;
    const b = await second.completed;
    assert.equal(a.code, 0, a.stderr);
    if (mode === 'duplicate') {
      assert.equal(b.code, 0, b.stderr);
      const receipt = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')));
      assert.deepEqual(receipt(a.stdout), receipt(b.stdout));
    } else {
      assert.notEqual(b.code, 0, 'Competing clock revision was accepted');
      assert.match(b.stderr, /40001/);
    }
  }
  assert.equal(await sql(`select revision from public.tournaments where id='${tournamentIds[1]}';`), '14');
  assert.equal(await sql(`select status from public.tournaments where id='${tournamentIds[1]}';`), 'running');
  assert.equal(await sql(`select clock_ends_at is null from public.tournaments where id='${tournamentIds[1]}';`), 't');
  for (const mode of ['duplicate', 'competing']) {
    const revision = mode === 'duplicate' ? 14 : 15;
    const firstOp = { ...seedPlayer, id: randomUUID(), kind: 'player.update',
      expectedRevision: revision,
      payload: { playerId: removableIds[2], name: mode === 'duplicate' ? 'Renamed once' : 'Renamed twice' } };
    const secondOp = mode === 'duplicate' ? firstOp : { ...firstOp, id: randomUUID(),
      payload: { playerId: removableIds[2], name: 'Competing rename' } };
    first = processSql(`${tag}-a`);
    first.child.stdin.write(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(firstOp)} select 'FIRST_LOCKED';\n`);
    await until(() => first.output().includes('FIRST_LOCKED'), 'Rename transaction did not acquire lock');
    second = processSql(`${tag}-b`);
    second.child.stdin.end(`begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','${actor}',true);
      ${tournamentCommand(secondOp)} commit;`);
    await until(async () => (await sql(`select count(*) from pg_stat_activity
      where application_name='${tag}-b' and wait_event_type='Lock';`)) === '1',
      'Concurrent rename never waited for lock');
    first.child.stdin.end('commit;\n');
    const a = await first.completed;
    const b = await second.completed;
    assert.equal(a.code, 0, a.stderr);
    if (mode === 'duplicate') {
      assert.equal(b.code, 0, b.stderr);
      const receipt = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')));
      assert.deepEqual(receipt(a.stdout), receipt(b.stdout));
    } else {
      assert.notEqual(b.code, 0, 'Competing rename was accepted');
      assert.match(b.stderr, /40001/);
    }
  }
  assert.equal(await sql(`select revision from public.tournaments where id='${tournamentIds[1]}';`), '16');
  assert.equal(await sql(`select display_name from public.tournament_players where id='${removableIds[2]}';`), 'Renamed twice');
  assert.equal(await sql(`select count(*) from public.sync_operation_receipts where actor_id='${actor}';`), '21');
  assert.equal(await sql(`select count(*) from public.sync_operation_audit where actor_id='${actor}';`), '21');
  const resultBase = { version: 1, id: randomUUID(), ownerId: actor, entity: 'tournament',
    entityId: tournamentIds[2], kind: 'tournament.create', expectedRevision: 0,
    createdAt: new Date().toISOString(), payload: tournamentPayload };
  const resultPlayers = [randomUUID(), randomUUID(), randomUUID()];
  await sql(`set role authenticated; select set_config('request.jwt.claim.sub','${actor}',false);
    ${tournamentCommand(resultBase)}`);
  for (const [i, playerId] of resultPlayers.entries()) {
    await sql(`set role authenticated; select set_config('request.jwt.claim.sub','${actor}',false);
      ${tournamentCommand({ ...resultBase, id: randomUUID(), kind: 'player.add',
        expectedRevision: i + 1, payload: { playerId, name: `Race player ${i + 1}` } })}`);
  }
  await sql(`set role authenticated; select set_config('request.jwt.claim.sub','${actor}',false);
    ${tournamentCommand({ ...resultBase, id: randomUUID(), kind: 'tournament.start',
      expectedRevision: 4, payload: {} })}`);
  const eliminate = { ...resultBase, id: randomUUID(), kind: 'player.eliminate',
    expectedRevision: 5, payload: { playerId: resultPlayers[2] } };
  const latePlayerId = randomUUID();
  const lateAdd = { ...resultBase, id: randomUUID(), kind: 'player.add',
    expectedRevision: 5, payload: { playerId: latePlayerId, name: 'Late race player' } };
  first = processSql(`${tag}-a`);
  first.child.stdin.write(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${actor}',true);
    ${tournamentCommand(eliminate)} select 'FIRST_LOCKED';\n`);
  await until(() => first.output().includes('FIRST_LOCKED'), 'Elimination did not acquire tournament lock');
  second = processSql(`${tag}-b`);
  second.child.stdin.end(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${actor}',true);
    ${tournamentCommand(lateAdd)} commit;`);
  await until(async () => (await sql(`select count(*) from pg_stat_activity
    where application_name='${tag}-b' and wait_event_type='Lock';`)) === '1',
    'Late entry never waited for the competing elimination');
  first.child.stdin.end('commit;\n');
  const eliminationWinner = await first.completed;
  const lateEntryLoser = await second.completed;
  assert.equal(eliminationWinner.code, 0, eliminationWinner.stderr);
  assert.notEqual(lateEntryLoser.code, 0, 'Stale late entry won after elimination');
  assert.match(lateEntryLoser.stderr, /40001/);
  assert.equal(await sql(`select position from public.tournament_players where id='${resultPlayers[2]}';`), '3');
  assert.equal(await sql(`select count(*) from public.tournament_players where id='${latePlayerId}';`), '0');
  await sql(`set role authenticated; select set_config('request.jwt.claim.sub','${actor}',false);
    ${tournamentCommand({ ...lateAdd, id: randomUUID(), expectedRevision: 6 })}`);
  assert.equal(await sql(`select position from public.tournament_players where id='${resultPlayers[2]}';`), '4');
  assert.equal(await sql(`select revision from public.tournaments where id='${tournamentIds[2]}';`), '7');
console.log('PASS: canonical migrations, RLS, rollback, late-entry/result checks and backup/preset/tournament/player/payment/entry/clock/rename races.');
} finally {
  // Terminate only the two fixture sessions, then remove only our random actor.
  await sql(`select pg_terminate_backend(pid) from pg_stat_activity
    where application_name in ('${tag}-a','${tag}-b') and pid <> pg_backend_pid();`);
  first?.child.stdin.end();
  second?.child.stdin.end();
  if (first) await first.completed;
  if (second) await second.completed;
  await sql(`delete from public.tournaments where id in ('${tournamentIds[0]}','${tournamentIds[1]}','${tournamentIds[2]}') and created_by='${actor}';
    delete from public.blind_structures where id='${presetId}' and owner_id='${actor}';
    delete from auth.users where id='${actor}';`);
  assert.equal(await sql(`select count(*) from public.profiles where id='${actor}';`), '0');
}
