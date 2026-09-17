// Executar via Playwright CLI com os bundles locais servidos em url.
export default async function outboxBrowserQa(page, url) {
 const name='qa-outbox-'+Date.now();
 const second=await page.context().newPage();
 const fixture=await page.evaluate(()=>({ownerId:crypto.randomUUID(),entityId:crypto.randomUUID(),foreign:crypto.randomUUID()}));
 try{
  await second.goto('http://localhost:8081/?teste=1');
  for(const tab of [page,second]){
   await tab.evaluate(async({url,name})=>{const {SyncOutbox}=await import(url+'/sync-outbox.js?v=2');window.__qaOutbox=new SyncOutbox(name);},{url,name});
  }
  const operations=await page.evaluate(async({url,fixture})=>{
   const {createOperation}=await import(url+'/sync-operation.js?v=2');
   const first=createOperation({ownerId:fixture.ownerId,entityId:fixture.entityId,entity:'tournament',kind:'tournament.create',expectedRevision:0,payload:{name:'QA'}});
   const next=createOperation({...first,kind:'tournament.update',expectedRevision:1,payload:{name:'QA2'}});
   const foreign=createOperation({...first,ownerId:fixture.foreign});
   await window.__qaOutbox.enqueue(first);await window.__qaOutbox.enqueue(next);await window.__qaOutbox.enqueue(foreign);
   return {first,next,foreign};
  },{url,fixture});
  const race=await Promise.all([page,second].map(tab=>tab.evaluate(owner=>window.__qaOutbox.claim(owner,1000),fixture.ownerId)));
  const leases=race.filter(Boolean);
  if(leases.length!==1||leases[0].operation.id!==operations.first.id)throw new Error('Claim concorrente duplicou ou ultrapassou');
  const original=leases[0];
  const renewed=await second.evaluate(owner=>window.__qaOutbox.claim(owner,32000),fixture.ownerId);
  if(renewed.operation.id!==original.operation.id||renewed.attempts!==2||renewed.lease.token===original.lease.token)throw new Error('Reenvio mudou identidade');
  const stale=await page.evaluate(({owner,op,token})=>window.__qaOutbox.confirm(owner,op,token,{operationId:op,revision:1}),{owner:fixture.ownerId,op:original.operation.id,token:original.lease.token});
  if(stale)throw new Error('Confirmacao antiga aceita');
  const confirmed=await second.evaluate(({owner,op,token})=>window.__qaOutbox.confirm(owner,op,token,{operationId:op,revision:1}),{owner:fixture.ownerId,op:renewed.operation.id,token:renewed.lease.token});
  if(!confirmed)throw new Error('Recibo valido rejeitado');
  const b=await page.evaluate(owner=>window.__qaOutbox.list(owner),fixture.foreign);
  if(b.length!==1||b[0].attempts!==0)throw new Error('Conta B afetada');
  await page.evaluate(()=>window.__qaOutbox.close());
  await page.reload();
  const persisted=await page.evaluate(async({url,name,owner})=>{const{SyncOutbox}=await import(url+'/sync-outbox.js?v=2');window.__qaOutbox=new SyncOutbox(name);return window.__qaOutbox.list(owner);},{url,name,owner:fixture.ownerId});
  if(persisted[0].status!=='confirmed'||persisted[1].status!=='queued')throw new Error('Reload perdeu estados');
  const claimed=await page.evaluate(owner=>window.__qaOutbox.claim(owner,32001),fixture.ownerId);
  if(claimed.operation.id!==operations.next.id)throw new Error('FIFO apos confirmacao falhou');
  await page.evaluate(({owner,id,token})=>window.__qaOutbox.fail(owner,id,token,'conflict',{code:'40001',message:'Revisao mudou'}),{owner:fixture.ownerId,id:claimed.operation.id,token:claimed.lease.token});
  if(await second.evaluate(owner=>window.__qaOutbox.claim(owner,999999),fixture.ownerId))throw new Error('Conflito ignorado');
  return 'PASS: IndexedDB real, duas abas, claim atomico, FIFO, lease vencida, resposta antiga, conta B isolada, persistencia no reload e conflito preservado. Sem Supabase.';
 }finally{
  for(const tab of [page,second])await tab.evaluate(async()=>{await window.__qaOutbox?.close();}).catch(()=>{});
  await page.evaluate(name=>new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);}),name);
  await second.close();
 }
}
