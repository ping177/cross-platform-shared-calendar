import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
const {webkit,chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),browsers=new Map();let files;
before(async()=>{
 files=(await build({root,configFile:false,envFile:false,logLevel:'error',plugins:[{name:'event-intent-boundary',enforce:'pre',resolveId(id){if(/\/supabase(?:\.ts)?$/.test(id))return '\0intent-client'},load(id){if(id==='\0intent-client')return 'export const isSupabaseConfigured=true;export const supabase={auth:{getUser:(...a)=>window.eventCreateFixture.client.auth.getUser(...a)},from:(...a)=>window.eventCreateFixture.client.from(...a)};'}}],build:{write:false,minify:false,rollupOptions:{input:root+'tests/fixtures/event-create-browser.jsx'}}})).output;
 for(const [name,type] of [['WebKit',webkit],['Chrome',chromium]])browsers.set(name,await type.launch(name==='Chrome'?{channel:'chrome',headless:true}:{headless:true}));
});
after(async()=>{for(const b of browsers.values())await b.close()});
async function pageFor(engine,scenario='normal'){
 const page=await browsers.get(engine).newPage({viewport:{width:375,height:812},timezoneId:'Asia/Shanghai'});page.setDefaultTimeout(3000);page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());assert.equal(u.origin,'http://127.0.0.1:5175');const f=files.find(f=>u.pathname==='/'+f.fileName);if(f)return route.fulfill({contentType:f.fileName.endsWith('.css')?'text/css':'text/javascript',body:f.type==='chunk'?f.code:f.source});if(u.pathname!=='/__intent')return route.abort();return route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/${files.find(f=>f.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find(f=>f.type==='chunk'&&f.isEntry).fileName}"></script>`})});
 await page.goto('http://127.0.0.1:5175/__intent?scenario='+scenario);await page.getByRole('dialog').waitFor();return page;
}
async function submit(page,recurring=false){await page.locator('#event-sheet-form input').first().fill('原始日程');if(recurring)await page.getByRole('button',{name:'每天',exact:true}).click();await page.getByRole('button',{name:'保存',exact:true}).click();await page.getByRole('button',{name:'确认保存',exact:true}).click()}
const retry=page=>page.getByRole('button',{name:'核对并重试原始创建',exact:true});
for(const engine of ['WebKit','Chrome']){
 for(const recurring of [false,true])test(`${engine}: ${recurring?'series root':'ordinary'} lost response retries original UUID and body once`,async()=>{const page=await pageFor(engine,'lost');try{
  await submit(page,recurring);await retry(page).waitFor();await page.waitForFunction(()=>!document.querySelector('[aria-label="关闭"]').disabled);
  assert.equal(await page.locator('#event-sheet-form').count(),0);assert.equal(await page.locator('#event-create-target').isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.eventCreateFixture.saved),0);
  await page.evaluate(()=>{window.eventCreateFixture.visible=true});await retry(page).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  const f=await page.evaluate(()=>{const f=window.eventCreateFixture;return {calls:f.calls,rows:f.rows,reads:f.reads,saved:f.saved}});
  assert.equal(f.rows.length,1);assert.equal(f.saved,1);assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0],f.calls[1]);assert.match(f.calls[0].id,/^[0-9a-f-]{36}$/);assert.equal(!!f.rows[0].recurrence_rule,recurring);assert.ok(f.reads.every(r=>r.space_id==='p'&&r.id===f.calls[0].id));assert.deepEqual(page.errors,[]);
 }finally{await page.close()}});
 test(`${engine}: normal create and immediately readable lost response finish successfully`,async()=>{for(const scenario of ['normal','reconcile']){const page=await pageFor(engine,scenario);try{await submit(page);await page.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(await page.evaluate(()=>[window.eventCreateFixture.saved,window.eventCreateFixture.rows.length]),[1,1]);assert.deepEqual(page.errors,[])}finally{await page.close()}}});
 test(`${engine}: preflight denial sends nothing; transport retry keeps the original intent`,async()=>{const page=await pageFor(engine,'transport');try{
  await page.evaluate(()=>{window.eventCreateFixture.allowed=false});await submit(page);await page.locator('#event-sheet-form').waitFor();assert.equal(await page.evaluate(()=>window.eventCreateFixture.calls.length),0);
  await page.evaluate(()=>{window.eventCreateFixture.allowed=true});await submit(page);await retry(page).waitFor();await retry(page).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.deepEqual(await page.evaluate(()=>{const f=window.eventCreateFixture;return [f.calls.length,f.rows.length,f.calls[0].id===f.calls[1].id]}),[2,1,true]);assert.deepEqual(page.errors,[]);
 }finally{await page.close()}});
 test(`${engine}: mismatched or unreadable collision never reports success`,async()=>{for(const scenario of ['collision','lost']){const page=await pageFor(engine,scenario);try{await submit(page);await retry(page).waitFor();await page.evaluate(()=>{window.eventCreateFixture.visible=true;window.eventCreateFixture.readError=true});await retry(page).click();await page.waitForFunction(()=>window.eventCreateFixture.calls.length===2);assert.equal(await page.evaluate(()=>window.eventCreateFixture.saved),0);assert.equal(await page.getByRole('dialog').count(),1);assert.deepEqual(page.errors,[])}finally{await page.close()}}});
 test(`${engine}: uncertain close/Escape explicitly warns and cancellation preserves the intent`,async()=>{const page=await pageFor(engine,'lost');try{await submit(page);await retry(page).waitFor();await page.waitForFunction(()=>!document.querySelector('[aria-label="关闭"]').disabled);
  const warnings=[];page.on('dialog',async dialog=>{warnings.push(dialog.message());if(warnings.length===1)await dialog.dismiss();else await dialog.accept()});
  await page.getByRole('button',{name:'关闭',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),1);await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(warnings.length,2);assert.ok(warnings.every(m=>m.includes('重新新建可能重复')));assert.equal(await page.evaluate(()=>window.eventCreateFixture.saved),0);assert.deepEqual(page.errors,[]);
 }finally{await page.close()}});
 for(const change of ['permission','account','space','unmount'])test(`${engine}: in-flight ${change} change cannot consume an old result or send twice`,async()=>{const page=await pageFor(engine,'hold');try{await submit(page);await page.waitForFunction(()=>!!window.eventCreateFixture.release);
  assert.equal(await page.locator('#event-sheet-form').count(),0);assert.equal(await page.getByRole('button',{name:'关闭',exact:true}).isDisabled(),true);
  assert.equal(await retry(page).count(),0);assert.equal(await page.evaluate(()=>window.eventCreateFixture.calls.length),1);
  await page.evaluate(change=>{const f=window.eventCreateFixture;if(change==='permission')f.allowed=false;if(change==='account')f.setUser('other');if(change==='space')f.setSpace('s');if(change==='unmount')f.unmount()},change);
  if(change==='unmount') await page.getByRole('dialog').waitFor({state:'hidden'});
  if(change==='account') await page.waitForFunction(()=>document.querySelector('main').dataset.user==='other');
  if(change==='space') await page.waitForFunction(()=>document.querySelector('main').dataset.space==='s');
  // Round trips must also invalidate the original request generation.
  if(change==='account'||change==='space'){await page.evaluate(change=>{const f=window.eventCreateFixture;if(change==='account')f.setUser('me');else f.setSpace('p')},change)}
  if(change==='account'||change==='space') await page.waitForFunction(()=>document.querySelector('main').dataset.user==='me'&&document.querySelector('main').dataset.space==='p');
  await page.evaluate(()=>{window.eventCreateFixture.visible=true;window.eventCreateFixture.release()});await page.waitForFunction(()=>window.eventCreateFixture.reads.length>0);
  await page.evaluate(()=>new Promise(r=>setTimeout(r,20)));assert.equal(await page.evaluate(()=>window.eventCreateFixture.saved),0);assert.equal(await page.evaluate(()=>window.eventCreateFixture.closed),0);assert.deepEqual(page.errors,[]);
 }finally{await page.close()}});
}

for(const engine of ['WebKit','Chrome']) {
 for(const scenario of ['slow-pre','slow-success','slow-post']) for(const recurring of [false,true]) test(`${engine}: ${scenario} ${recurring?'series':'ordinary'} waits without a retry action and accepts late success`,async()=>{
  const page=await pageFor(engine,scenario);try{
   await submit(page,recurring);await page.waitForFunction(()=>!!window.eventCreateFixture.release);
   assert.equal(await retry(page).count(),0,'in-flight work must not display a retry operation');
   assert.match(await page.getByRole('status').innerText(),/保存中/);
   assert.equal(await page.getByRole('button',{name:'保存中',exact:true}).isDisabled(),true);
   await page.evaluate(()=>{window.eventCreateFixture.release()});await page.getByRole('dialog').waitFor({state:'hidden'});
   assert.deepEqual(await page.evaluate(()=>{const f=window.eventCreateFixture;return [f.calls.length,f.rows.length,f.saved,f.reads.length]}),[1,1,1,0]);assert.deepEqual(page.errors,[]);
  }finally{await page.close()}
 });
 test(`${engine}: uncertain retry hides its action while running and reconciles once`,async()=>{
  const page=await pageFor(engine,'lost');try{
   await submit(page);await retry(page).waitFor();await page.evaluate(()=>{const f=window.eventCreateFixture;f.visible=true;f.holdRetry=true});
   await retry(page).click();await page.waitForFunction(()=>!!window.eventCreateFixture.releaseRetry);assert.equal(await retry(page).count(),0);assert.match(await page.getByRole('status').innerText(),/保存中/);
   await page.evaluate(()=>window.eventCreateFixture.releaseRetry());await page.getByRole('dialog').waitFor({state:'hidden'});
   assert.deepEqual(await page.evaluate(()=>{const f=window.eventCreateFixture;return [f.calls.length,f.rows.length,f.saved,JSON.stringify(f.calls[0])===JSON.stringify(f.calls[1])]}),[2,1,1,true]);assert.deepEqual(page.errors,[]);
  }finally{await page.close()}
 });
}
