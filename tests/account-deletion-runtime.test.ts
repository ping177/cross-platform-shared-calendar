import assert from 'node:assert/strict';
import test from 'node:test';
import { deletionRuntime, acceptsDeletion, deletionOrigin } from '../supabase/functions/account-deletion/runtime.ts';
const url='https://ximazjhxvmktpcdbypka.supabase.co';
const env=(values:Record<string,string>)=>(name:string)=>values[name];
test('production is fixed-project and new acceptance defaults off independently of recovery',()=>{
 const p=deletionRuntime(env({ACCOUNT_DELETION_RUNTIME_MODE:'production',SUPABASE_URL:url}));
 assert.equal(p.url,url);assert.equal(acceptsDeletion(p,'user'),false);
 assert.throws(()=>deletionRuntime(env({ACCOUNT_DELETION_RUNTIME_MODE:'production',SUPABASE_URL:'https://other.supabase.co'})));
 assert.throws(()=>deletionRuntime(env({ACCOUNT_DELETION_RUNTIME_MODE:'production',SUPABASE_URL:url+'@evil.invalid'})));
 assert.throws(()=>deletionRuntime(env({SUPABASE_URL:url})));
});
test('explicit acceptance switch can restrict synthetic rollout identities',()=>{
 const values={ACCOUNT_DELETION_RUNTIME_MODE:'production',SUPABASE_URL:url,ACCOUNT_DELETION_ACCEPT_NEW:'true',ACCOUNT_DELETION_ACCEPT_USER_IDS:'user-a'};
 assert.equal(acceptsDeletion(deletionRuntime(env(values)),'user-a'),true);
 assert.equal(acceptsDeletion(deletionRuntime(env(values)),'user-b'),false);
 assert.equal(acceptsDeletion(deletionRuntime(env({...values,ACCOUNT_DELETION_ACCEPT_NEW:'false'})),'user-a'),false);
});
test('production CORS has one exact HTTPS origin; isolated mode stays local',()=>{
 const p=deletionRuntime(env({ACCOUNT_DELETION_RUNTIME_MODE:'production',SUPABASE_URL:url}));
 assert.equal(deletionOrigin(p,'https://cross-platform-shared-calendar.vercel.app'),true);
 for(const o of ['http://127.0.0.1:5175','https://preview.vercel.app','https://cross-platform-shared-calendar.vercel.app.evil.invalid'])assert.equal(deletionOrigin(p,o),false);
 const local=deletionRuntime(env({ACCOUNT_DELETION_RUNTIME_MODE:'isolated-local',SUPABASE_URL:'http://storage:8080'}));
 assert.equal(deletionOrigin(local,'http://127.0.0.1:5175'),true);
 assert.throws(()=>deletionRuntime(env({ACCOUNT_DELETION_RUNTIME_MODE:'isolated-local',SUPABASE_URL:url})));
});
test('handler checks exact origins and separates worker, receipt and verified user authorization',async()=>{
 let handler:(request:Request)=>Promise<Response>;
 const values:Record<string,string>={ACCOUNT_DELETION_RUNTIME_MODE:'production',SUPABASE_URL:url,SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',ACCOUNT_DELETION_WAKE_SECRET:'a'.repeat(64)};
 const user='a1000000-0000-4000-8000-000000000001',session='a1000000-0000-4000-8000-000000000002';
 const jwt='synthetic.'+Buffer.from(JSON.stringify({sub:user,session_id:session,role:'authenticated'})).toString('base64url')+'.synthetic';
 Object.assign(globalThis,{Deno:{env:{get:env(values)},serve:(fn:typeof handler)=>{handler=fn;}}});
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(input)=>{calls++;const u=new URL(String(input));assert.equal(u.origin,url);
  const data=u.pathname==='/auth/v1/user'?{id:user,email:'fixture@example.invalid',email_confirmed_at:'2026-01-01'}:u.pathname.endsWith('/claim_account_deletion')?null:u.pathname.endsWith('/read_deletion_receipt')?{status:'processing'}:assert.fail('Unexpected provider request');
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 };
 const request=(body:unknown,auth?:string,origin?:string,method='POST')=>new Request('https://function.example.invalid',{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{}),...(origin?{Origin:origin}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})});
 try{
  await import('../supabase/functions/account-deletion/index.ts');
  const origin='https://cross-platform-shared-calendar.vercel.app';
  const preflight=await handler!(request(null,undefined,origin,'OPTIONS'));
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal((await handler!(request({action:'work'},'a'.repeat(64),'https://evil.invalid'))).status,403);
  for(const credential of [undefined,jwt,'synthetic-service'])assert.equal((await handler!(request({action:'work'},credential))).status,403);
  assert.equal((await handler!(request({action:'work',user_id:user},'a'.repeat(64)))).status,403);
  assert.deepEqual(await (await handler!(request({action:'work'},'a'.repeat(64)))).json(),{status:'idle'});
  assert.equal((await handler!(request({action:'begin'},'a'.repeat(64)))).status,401);
  assert.equal((await handler!(request({action:'begin'},jwt))).status,503);
  assert.deepEqual(await (await handler!(request({action:'receipt',receipt_token:'b'.repeat(64)}))).json(),{status:'processing'});
  const before=calls;delete values.ACCOUNT_DELETION_RUNTIME_MODE;
  assert.equal((await handler!(request({action:'work'},'a'.repeat(64)))).status,503);assert.equal(calls,before);
 }finally{globalThis.fetch=original;}
});
