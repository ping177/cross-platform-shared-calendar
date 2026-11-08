import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {createHash} from 'node:crypto';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const id='a1000000-0000-4000-8000-000000000001';
const otherId='a1000000-0000-4000-8000-000000000003';
const user={id,email:'synthetic@example.invalid',email_confirmed_at:'2026-01-01'};
const jwtFor=userId=>Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:userId,role:'authenticated',session_id:'a1000000-0000-4000-8000-000000000002',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.'+Buffer.alloc(32).toString('base64url');
const sessionFor=userId=>({access_token:jwtFor(userId),refresh_token:'synthetic-refresh',user:{...user,id:userId},expires_in:3600,token_type:'bearer'});
const formalOrigin='https://cross-platform-shared-calendar.vercel.app';
const backendOrigin='https://ximazjhxvmktpcdbypka.supabase.co';
const browsers=new Map();let enabled,disabled,pilot,productionOpen,productionClosed;
before(async()=>{for(const [key,engine] of [['Chrome',chromium],['WebKit',webkit]])browsers.set(key,await engine.launch(key==='Chrome'?{channel:'chrome'}:{}));
 async function bundle(flag,production=false,pilotId){
  const env={
   DEV:'true',
   VITE_ACCOUNT_DELETION_ENABLED:JSON.stringify(flag),
   VITE_SUPABASE_URL:JSON.stringify(production?backendOrigin:'http://127.0.0.1:5175/backend'),
   VITE_SUPABASE_ANON_KEY:'"synthetic-anon"',
   ...(production?{VITE_ACCOUNT_DELETION_RUNTIME_MODE:'"production"'}:{}),
   ...(pilotId?{VITE_ACCOUNT_DELETION_PILOT_USER_ID:JSON.stringify(pilotId)}:{}),
  };
  return (await build({configFile:false,envFile:false,logLevel:'error',
   define:Object.fromEntries(Object.entries(env).map(([key,value])=>['import.meta.env.'+key,value])),
   build:{write:false,rollupOptions:{input:'tests/fixtures/account-deletion-browser.tsx'}}})).output;
 }
 enabled=await bundle('true');disabled=await bundle('false');pilot=await bundle('false',true,id);
 productionOpen=await bundle('true',true,id);productionClosed=await bundle('false',true);
});
after(async()=>{for(const browser of browsers.values())await browser.close();});
async function pageFor(engine,mode,flag=true,root=false,userId=id,path='/account'){
 const production=typeof flag==='string',origin=production?formalOrigin:'http://127.0.0.1:5175',session=sessionFor(userId);
 const p=await browsers.get(engine).newPage({serviceWorkers:'block',viewport:{width:375,height:812}});p.setDefaultTimeout(4000);const calls=[];let state=mode==='completed-other'?'completed':mode==='unknown-other'?'preparing':mode;
 await p.addInitScript(({session,receipt,root})=>{window.deletionTestRoot=root;window.deletionTestSession=session;if(receipt)localStorage.setItem('calendar.deletion-receipt.v1',JSON.stringify(receipt));},{session,root,receipt:['unknown','preparing','accepted','needs_attention','completed','completed-other','unknown-other'].includes(mode)?{token:'a'.repeat(64),binding:createHash('sha256').update(mode.endsWith('-other')?'another-user':id).digest('hex'),expires:Date.now()+100000}:null});
 const files=flag==='pilot'?pilot:flag==='open'?productionOpen:flag==='closed'?productionClosed:flag?enabled:disabled;
 // All requests are intercepted, including production-looking pilot URLs.
 await p.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if((production&&url.origin===backendOrigin)||(!production&&url.origin===origin&&url.pathname.startsWith('/backend/'))){
   const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'*'};
   const fulfill=options=>route.fulfill({...options,headers:{...cors,...options.headers}});
   if(req.method()==='OPTIONS')return fulfill({status:204});
   const path=url.pathname;calls.push(path);
   if(path.includes('/auth/v1/user'))return fulfill({json:session.user});
   if(path.includes('/auth/v1/logout'))return fulfill({json:{}});
   if(path.endsWith('/current_account_active'))return fulfill({json:mode!=='inactive'});
   if(path.endsWith('/account-deletion')){const action=req.postDataJSON()?.action;
    if(action==='cancel'){calls.push('action:cancel');if(mode==='preparing'){state='accepted';return fulfill({json:{cancelled:false}});}return fulfill({json:{cancelled:true}});}
    if(action==='begin')return fulfill({json:{request_id:id,challenge_id:id}});
    if(action==='verify')return fulfill({json:{request_id:id,confirmation_token:'c'.repeat(64),receipt_token:'a'.repeat(64)}});
    if(action==='confirm'){state='accepted';return fulfill({status:202,json:{status:'accepted'}});}
    if(mode==='unknown')return fulfill({status:503,json:{error:'unavailable'}});return fulfill({json:{status:state}});}
   return fulfill({json:[],headers:{'content-range':'0-0/0'}});
  }
  if(url.origin!==origin)return route.abort();
  const file=files.find(f=>'/'+f.fileName===url.pathname);return route.fulfill(file?{contentType:file.fileName.endsWith('.css')?'text/css':'text/javascript',body:file.type==='chunk'?file.code:file.source}:{contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/${files.find(f=>f.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find(f=>f.type==='chunk'&&f.isEntry).fileName}"></script>`});
 });await p.goto(origin+path);return {p,calls};
}
for(const engine of ['Chrome','WebKit']){
 test(`${engine}: default closed entry preserves account/export/signout layout`,async()=>{const {p,calls}=await pageFor(engine,'none',false);try{await p.getByRole('heading',{name:'账户管理'}).waitFor();assert.equal(await p.getByRole('button',{name:'注销账号',exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:'导出数据',exact:true}).count(),1);assert.equal(await p.getByRole('button',{name:'退出登录',exact:true}).count(),1);assert.ok(!calls.some(path=>path.includes('account-deletion')||path.includes('current_account_active')));}finally{await p.close();}});
 test(`${engine}: production pilot grants A entry, refuses B route and new API actions`,async()=>{
  const a=await pageFor(engine,'none','pilot');
  const b=await pageFor(engine,'none','pilot',false,otherId,'/account/deletion');
  try{
   await a.p.getByRole('button',{name:'注销账号',exact:true}).click();
   await a.p.getByRole('heading',{name:'注销账号',exact:true}).waitFor();
   await b.p.getByRole('heading',{name:'账户管理',exact:true}).waitFor();
   const historyToken=await a.p.evaluate(()=>history.state.calendarDeletion);
   await b.p.evaluate(({historyToken,id,otherId})=>{
    dispatchEvent(new PopStateEvent('popstate',{state:{calendarDeletion:historyToken.replace(id,otherId)}}));
   },{historyToken,id,otherId});
   assert.equal(await b.p.getByRole('heading',{name:'注销账号',exact:true}).count(),0);
   assert.equal(await b.p.getByRole('button',{name:'注销账号',exact:true}).count(),0);
   for(const action of ['begin','verify','confirm'])await assert.rejects(b.p.evaluate(action=>window.deletionTestRequest({action}),action),/账号注销暂未开放/);
   assert.ok(a.calls.some(path=>path.endsWith('/current_account_active')));
   assert.ok(b.calls.some(path=>path.endsWith('/current_account_active')));
   assert.ok(!b.calls.some(path=>path.endsWith('/account-deletion')));
  }finally{await a.p.close();await b.p.close();}
 });
 test(`${engine}: global production entry retains its independent flag`,async()=>{
  for(const userId of [id,otherId]){
   const {p}=await pageFor(engine,'none','closed',false,userId);
   try{
    await p.getByRole('heading',{name:'账户管理',exact:true}).waitFor();
    assert.equal(await p.getByRole('button',{name:'注销账号',exact:true}).count(),0);
   }finally{await p.close();}
  }
  const {p}=await pageFor(engine,'none','open',false,otherId);
  try{await p.getByRole('button',{name:'注销账号',exact:true}).waitFor();}finally{await p.close();}
 });
 test(`${engine}: pilot preserves receipt recovery for B`,async()=>{
  const {p,calls}=await pageFor(engine,'accepted','pilot',false,otherId);
  try{
   await p.getByRole('heading',{name:'注销处理中',exact:true}).waitFor();
   assert.ok(calls.some(path=>path.endsWith('/account-deletion')));
  }finally{await p.close();}
 });
 for(const [mode,title] of [['unknown','正在核对注销状态'],['needs_attention','注销尚未完成'],['accepted','注销处理中']])test(`${engine}: ${mode} cannot report completion or reopen normal account`,async()=>{const {p}=await pageFor(engine,mode);try{await p.getByRole('heading',{name:title,exact:true}).waitFor();assert.equal(await p.getByRole('heading',{name:'账号已注销',exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:'退出登录',exact:true}).count(),0);if(mode!=='unknown')assert.equal(await p.getByRole('button',{name:'核实未受理并返回'}).count(),0);for(const width of [320,390,430]){await p.setViewportSize({width,height:812});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}}finally{await p.close();}});
 test(`${engine}: uncertain request cannot cancel an already accepted server intent`,async()=>{const {p,calls}=await pageFor(engine,'preparing');try{await p.getByRole('button',{name:'核实未受理并返回'}).click();await p.getByRole('heading',{name:'注销处理中'}).waitFor();assert.ok(calls.includes('action:cancel'));assert.ok(await p.evaluate(()=>Boolean(localStorage.getItem('calendar.deletion-receipt.v1'))));}finally{await p.close();}});
 test(`${engine}: final consent is active, and backing out sends no confirmation`,async()=>{const {p,calls}=await pageFor(engine,'none');try{
  await p.getByRole('button',{name:'注销账号',exact:true}).click();await p.getByRole('button',{name:'跳过导出，继续注销'}).click();await p.getByRole('button',{name:'发送注销验证码'}).click();await p.getByLabel('8 位验证码').fill('12345678');await p.getByRole('button',{name:'验证并继续'}).click();await p.getByRole('heading',{name:'最终确认',exact:true}).waitFor();await p.getByText('平台备份、审计记录和日志可能按平台保留政策继续保存，不会因注销立即清除。已下载的文件、设备缓存和已发送的通知也无法远程收回。',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'永久注销账号',exact:true}).isDisabled(),true);assert.equal(await p.evaluate(()=>localStorage.getItem('calendar.deletion-receipt.v1')),null);await p.getByRole('button',{name:'暂不注销'}).click();await p.getByRole('heading',{name:'账户管理',exact:true}).waitFor();assert.equal(await p.getByRole('heading',{name:'注销处理中'}).count(),0);
 }finally{await p.close();}});
 test(`${engine}: blocked receipt storage prevents irreversible confirm and shows Chinese error`,async()=>{const {p}=await pageFor(engine,'none');try{
  await p.getByRole('button',{name:'注销账号',exact:true}).click();await p.getByRole('button',{name:'跳过导出，继续注销'}).click();await p.getByRole('button',{name:'发送注销验证码'}).click();await p.getByLabel('8 位验证码').fill('12345678');await p.getByRole('button',{name:'验证并继续'}).click();await p.getByRole('checkbox').check();await p.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='calendar.deletion-receipt.v1')throw Error('fixture');return original.call(this,key,value);};});await p.getByRole('button',{name:'永久注销账号',exact:true}).click();await p.getByRole('alert').filter({hasText:'无法保存注销进度'}).waitFor();assert.equal(await p.getByRole('heading',{name:'注销处理中'}).count(),0);
 }finally{await p.close();}});
 test(`${engine}: a changed Auth session discards in-memory OTP permit`,async()=>{const {p}=await pageFor(engine,'none');try{
  await p.getByRole('button',{name:'注销账号',exact:true}).click();await p.getByRole('button',{name:'跳过导出，继续注销'}).click();await p.getByRole('button',{name:'发送注销验证码'}).click();await p.getByLabel('8 位验证码').fill('12345678');await p.getByRole('button',{name:'验证并继续'}).click();await p.getByRole('heading',{name:'最终确认',exact:true}).waitFor();await p.evaluate(()=>window.deletionSessionChange());await p.getByRole('heading',{name:'登录',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'永久注销账号',exact:true}).count(),0);assert.equal(await p.evaluate(()=>localStorage.getItem('calendar.deletion-receipt.v1')),null);
 }finally{await p.close();}});
 test(`${engine}: an old account receipt cannot sign out a different current account`,async()=>{const {p,calls}=await pageFor(engine,'completed-other');try{await p.getByRole('button',{name:'返回应用',exact:true}).waitFor();assert.ok(!calls.some(path=>path.includes('/auth/v1/logout')));await p.getByRole('button',{name:'返回应用',exact:true}).click();await p.getByRole('heading',{name:'账户管理',exact:true}).waitFor();}finally{await p.close();}});
 test(`${engine}: actual App root blocks bootstrap for accepted receipt`,async()=>{const {p,calls}=await pageFor(engine,'accepted',true,true);try{await p.getByRole('heading',{name:'注销处理中',exact:true}).waitFor();assert.ok(!calls.some(path=>path.endsWith('/ensure_personal_space')||path.endsWith('/profiles')));}finally{await p.close();}});
 test(`${engine}: actual App root cannot bootstrap inactive account without receipt`,async()=>{const {p,calls}=await pageFor(engine,'inactive',true,true);try{await p.getByRole('status').filter({hasText:'此账号无法继续使用'}).waitFor();assert.ok(!calls.some(path=>path.endsWith('/ensure_personal_space')));}finally{await p.close();}});
 test(`${engine}: a different current account cannot revoke or discard another pending intent`,async()=>{const {p,calls}=await pageFor(engine,'unknown-other');try{await p.getByRole('button',{name:'核实未受理并返回'}).click();await p.getByRole('alert').filter({hasText:'当前登录账号与注销请求不同'}).waitFor();assert.ok(!calls.includes('action:cancel'));assert.ok(await p.evaluate(()=>Boolean(localStorage.getItem('calendar.deletion-receipt.v1'))));}finally{await p.close();}});
 test(`${engine}: completed alone cleans receipt and local session`,async()=>{const {p,calls}=await pageFor(engine,'completed');try{await p.getByRole('button',{name:'返回登录',exact:true}).waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('calendar.deletion-receipt.v1')),null);assert.ok(calls.some(path=>path.includes('/auth/v1/logout')));await p.getByRole('button',{name:'返回登录',exact:true}).click();await p.getByRole('heading',{name:'登录',exact:true}).waitFor();}finally{await p.close();}});
}
