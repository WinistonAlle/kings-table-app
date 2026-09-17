// Playwright CLI runner. Fixtures are created/cleaned separately in Node only.
export default async function presetSyncBrowserQa(page, fixture, bundleUrl) {
  if(fixture.apiUrl!=='http://127.0.0.1:55321')throw new Error('Only local API allowed');
  const name='qa-preset-browser-'+fixture.nonce;
  const context=page.context();
  const second=await context.newPage();
  const setup=async tab=>tab.evaluate(async({fixture,bundleUrl,name})=>{
    const kit=await import(bundleUrl);
    const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
    const clients=[];
    for(const account of fixture.accounts){
      const client=kit.createClient(fixture.apiUrl,fixture.anonKey,options);
      const login=await client.auth.signInWithPassword({email:account.email,password:account.password});
      if(login.error||login.data.user?.id!==account.id)throw new Error('Browser password login failed');
      clients.push(client);
    }
    window.__presetQa={kit,clients,outbox:new kit.SyncOutbox(name),senders:[]};
  },{fixture,bundleUrl,name});
  try{
    await second.goto('http://localhost:8081/?teste=1');
    await setup(page);await setup(second);
    const op=await page.evaluate(async fixture=>{
      const qa=window.__presetQa;
      const operation=qa.kit.createOperation({ownerId:fixture.accounts[0].id,
        entityId:fixture.presets[0],entity:'preset',kind:'preset.save',expectedRevision:0,
        payload:{name:'Browser QA',levels:[{level:1,smallBlind:25,bigBlind:50,ante:0,durationMinutes:20}]}});
      await qa.outbox.enqueue(operation);
      return operation;
    },fixture);
    const send=async(tab,now)=>tab.evaluate(async({owner,now})=>{
      const qa=window.__presetQa;
      const sender=new qa.kit.SyncSender(owner,qa.outbox,
        qa.kit.createPresetTransport(qa.clients[0],owner),()=>now);
      qa.senders.push(sender);await sender.run();sender.stop();
      return qa.outbox.list(owner);
    },{owner:fixture.accounts[0].id,now});
    const first=await send(page,1000);
    if(first[0].status!=='confirmed')throw new Error('First browser commit not confirmed');
    const next=await page.evaluate(async op=>{
      const qa=window.__presetQa;
      const next=qa.kit.createOperation({...op,expectedRevision:1,payload:{...op.payload,name:'Offline edit'}});
      await qa.outbox.enqueue(next);return next;
    },op);
    await context.setOffline(true);
    const offline=await send(page,2000);
    if(offline[1].status!=='queued'||offline[1].operation.id!==next.id)throw new Error('Offline operation lost');
    // No service worker exists yet. Reload itself is tested after reconnect,
    // not misrepresented as offline application navigation support.
    await page.evaluate(()=>window.__presetQa.outbox.close());
    await context.setOffline(false);
    await page.reload();await setup(page);
    const recovered=await page.evaluate(owner=>window.__presetQa.outbox.list(owner),fixture.accounts[0].id);
    if(recovered[1].status!=='queued'||recovered[1].operation.id!==next.id)throw new Error('Reload lost offline queue');
    await Promise.all([send(page,3000),send(second,3000)]);
    const confirmed=await page.evaluate(owner=>window.__presetQa.outbox.list(owner),fixture.accounts[0].id);
    if(confirmed[1].status!=='confirmed'||confirmed[1].attempts!==2)throw new Error('Two tabs sent duplicate lease or failed retry');
    await second.evaluate(async({fixture,op})=>{
      const qa=window.__presetQa;
      const rows=await qa.clients[1].from('blind_structures').select('id').eq('id',op.entityId);
      if(rows.error||rows.data.length)throw new Error('Account B saw account A preset');
      const transport=qa.kit.createPresetTransport(qa.clients[1],fixture.accounts[1].id);
      const forbidden=qa.kit.createOperation({...op,ownerId:fixture.accounts[1].id,expectedRevision:2});
      const result=await transport(forbidden,new AbortController().signal);
      if(result.status!=='rejected'||result.issue.code!=='42501')throw new Error('Foreign write allowed');
    },{fixture,op});

    // Hold a real successful HTTP response; stop the sender before releasing it.
    const late=await page.evaluate(async({fixture,op})=>{
      const qa=window.__presetQa;
      const session=(await qa.clients[0].auth.getSession()).data.session;
      const actualFetch=window.fetch.bind(window);
      const held=qa.kit.createClient(fixture.apiUrl,fixture.anonKey,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
        global:{headers:{Authorization:'Bearer '+session.access_token},fetch:async(input,init)=>{
          const response=await actualFetch(input,init);
          if(response.ok&&String(input).includes('/rpc/apply_preset_operation')){
            qa.responseReady=true;
            return new Promise(resolve=>{qa.release=()=>resolve(response);});
          }
          return response;
        }}
      });
      const operation=qa.kit.createOperation({...op,expectedRevision:2,payload:{...op.payload,name:'Late response'}});
      await qa.outbox.enqueue(operation);
      qa.heldSender=new qa.kit.SyncSender(fixture.accounts[0].id,qa.outbox,
        qa.kit.createPresetTransport(held,fixture.accounts[0].id),()=>4000);
      qa.senders.push(qa.heldSender);qa.running=qa.heldSender.run();
      return operation;
    },{fixture,op});
    await page.waitForFunction(()=>window.__presetQa.responseReady,null,{timeout:10000});
    const stopped=await page.evaluate(async owner=>{
      const qa=window.__presetQa;qa.heldSender.stop();qa.release();await qa.running;
      return qa.outbox.list(owner);
    },fixture.accounts[0].id);
    if(stopped[2].status!=='sending')throw new Error('Stopped sender applied late confirmation');
    const resumed=await send(second,35001);
    if(resumed[2].status!=='confirmed'||resumed[2].operation.id!==late.id)throw new Error('Expired lease failed idempotent recovery');
    const database=await page.evaluate(async preset=>{
      const client=window.__presetQa.clients[0];
      const row=await client.from('blind_structures').select('revision,name').eq('id',preset).single();
      const audit=await client.from('sync_operation_audit').select('operation_id').eq('entity_id',preset);
      if(row.error||audit.error)throw new Error('Database reconciliation query failed');
      return {revision:row.data.revision,audits:audit.data.length,name:row.data.name};
    },fixture.presets[0]);
    if(database.revision!==3||database.audits!==3||database.name!=='Late response')throw new Error('Browser flow duplicated or lost effects');
    return 'PASS: real browser Auth/JWT/HTTP/IndexedDB, offline queue, online reload, two tabs, account B denial and cancelled response after commit recovered with same ID.';
  }finally{
    await context.setOffline(false);
    for(const tab of [page,second])await tab.evaluate(async()=>{
      const qa=window.__presetQa;
      qa?.senders.forEach(sender=>sender.stop());qa?.release?.();
      await qa?.running?.catch(()=>{});await qa?.outbox.close();
    }).catch(()=>{});
    await page.evaluate(name=>new Promise((resolve,reject)=>{
      const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Fixture IndexedDB still open'));
    }),name);
    await second.close();
  }
}
