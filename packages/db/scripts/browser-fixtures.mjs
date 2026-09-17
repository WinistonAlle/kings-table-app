import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const workdir=fileURLToPath(new URL('..',import.meta.url));
const status=JSON.parse(execFileSync('npx',['supabase','status','--workdir',workdir,'-o','json'],
  {encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(status.API_URL,'http://127.0.0.1:55321');
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function cleanup(fixture){
  assert.match(fixture.nonce,uuid);
  for(const preset of fixture.presets)assert.match(preset,uuid);
  for(const account of fixture.accounts){
    assert.match(account.id,uuid);
    const result=await admin.auth.admin.getUserById(account.id);
    assert.equal(result.error,null);
    assert.equal(result.data.user.user_metadata.kt_browser_fixture,fixture.nonce);
    assert.equal(result.data.user.email,account.email);
    assert.ok(account.email.startsWith(`kt-browser-${fixture.nonce}-`));
  }
  const ids=fixture.accounts.map(account=>account.id);
  const removed=await admin.from('blind_structures').delete().in('id',fixture.presets).in('owner_id',ids);
  assert.equal(removed.error,null);
  for(const id of ids){const result=await admin.auth.admin.deleteUser(id);assert.equal(result.error,null);}
}

if(process.argv[2]==='create'){
  const fixture={nonce:randomUUID(),apiUrl:status.API_URL,anonKey:status.ANON_KEY,
    accounts:[],presets:[randomUUID()]};
  try{
    for(const label of ['a','b']){
      const email=`kt-browser-${fixture.nonce}-${label}@example.invalid`,password=`Qa-${randomUUID()}!`;
      const created=await admin.auth.admin.createUser({email,password,email_confirm:true,
        user_metadata:{kt_browser_fixture:fixture.nonce}});
      assert.equal(created.error,null);assert.ok(created.data.user);
      fixture.accounts.push({id:created.data.user.id,email,password});
    }
    // Publishable local key only. Privileged key stays in this Node process.
    console.log(JSON.stringify(fixture));
  }catch(error){if(fixture.accounts.length)await cleanup(fixture);throw error;}
}else if(process.argv[2]==='cleanup'){
  let input='';for await(const chunk of process.stdin)input+=chunk;
  await cleanup(JSON.parse(input));console.log('Local browser fixtures removed.');
}else throw new Error('Use create or cleanup (fixture JSON on stdin).');
