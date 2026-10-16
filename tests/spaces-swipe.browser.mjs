import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
const {webkit,chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const artifacts=process.env.SPACES_SWIPE_ARTIFACTS;
const browsers=new Map();let files;
const api=`export const isSupabaseConfigured=true;export const supabase={auth:{async getSession(){return {data:{session:{user:{id:'me'}}}}},async getUser(){return {data:{user:{id:'me'}},error:null}},onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}},from(table){return window.swipeFixture.query(table)},rpc(name,args){return window.swipeFixture.rpc(name,args)},channel(){return {on(){return this},subscribe(callback){if(callback)queueMicrotask(()=>callback('SUBSCRIBED'));return this}}},removeChannel(){},storage:{from(){return {async createSignedUrl(){return {data:null,error:null}}}}}};`;
before(async()=>{
 files=(await build({root,configFile:false,envFile:false,logLevel:'error',plugins:[{name:'spaces-swipe-backend-io',enforce:'pre',resolveId(id){if(/\/supabase(?:\.ts)?$/.test(id))return '\0swipe-api'},load(id){if(id==='\0swipe-api')return api}}],build:{write:false,minify:false,rollupOptions:{input:root+'tests/fixtures/spaces-swipe-browser.jsx'}}})).output;
 if(artifacts)await mkdir(artifacts,{recursive:true});
 for(const [name,type] of [['WebKit',webkit],['Chrome',chromium]])browsers.set(name,await type.launch(name==='Chrome'?{channel:'chrome',headless:true}:{headless:true}));
});
after(async()=>{for(const browser of browsers.values())await browser.close()});
async function pageFor(engine,width=375){
 const page=await browsers.get(engine).newPage({viewport:{width,height:812},hasTouch:true,isMobile:true});page.errors=[];page.setDefaultTimeout(3000);page.on('pageerror',error=>page.errors.push(error.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());assert.equal(u.origin,'http://127.0.0.1:5175');const file=files.find(f=>u.pathname==='/'+f.fileName);if(file)return route.fulfill({contentType:file.fileName.endsWith('.css')?'text/css':'text/javascript',body:file.type==='chunk'?file.code:file.source});if(u.pathname.startsWith('/avatars/'))return route.fulfill({contentType:'image/svg+xml',body:await readFile(root+'public'+u.pathname)});if(u.pathname!=='/__spaces_swipe')return route.abort();return route.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><div id="root"></div><link rel="stylesheet" href="/${files.find(f=>f.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find(f=>f.type==='chunk'&&f.isEntry).fileName}"></script>`})});
 await page.goto('http://127.0.0.1:5175/__spaces_swipe');await page.waitForTimeout(300);assert.deepEqual(page.errors,[],await page.locator('body').innerText());await page.getByRole('navigation',{name:'一级导航'}).getByRole('button',{name:'我的',exact:true}).tap();await page.getByRole('heading',{name:'我的',exact:true}).waitFor();return page;
}
async function management(page){await page.getByRole('button',{name:'空间管理',exact:true}).tap();await page.getByRole('heading',{name:'空间管理',exact:true}).waitFor();await page.getByRole('button',{name:'创建共享空间',exact:true}).waitFor()}
async function detail(page){await management(page);await page.locator('[data-space-id="s"]').tap();await page.getByRole('heading',{name:'家庭共享空间',exact:true}).first().waitFor();await page.getByRole('button',{name:'修改名称',exact:true}).waitFor()}
// Real DOM events bubble through the unchanged React tree; WebKit exposes no touch-move protocol.
async function swipe(locator,{dx=120,dy=3,cancel=false,pointerType='touch'}={}){
 await locator.evaluate((el,o)=>{const r=el.getBoundingClientRect(),x=r.x+Math.min(35,r.width/3),y=r.y+r.height/2,p={bubbles:true,cancelable:true,composed:true,pointerId:27,pointerType:o.pointerType,isPrimary:true,buttons:1};el.dispatchEvent(new PointerEvent('pointerdown',{...p,clientX:x,clientY:y}));el.dispatchEvent(new PointerEvent('pointermove',{...p,clientX:x+o.dx/2,clientY:y+o.dy/2}));el.dispatchEvent(new PointerEvent(o.cancel?'pointercancel':'pointerup',{...p,buttons:0,clientX:x+o.dx,clientY:y+o.dy}))},{dx,dy,cancel,pointerType});
}
for(const engine of ['WebKit','Chrome'])test(`${engine}: real App Space management/detail right swipes follow existing back routes`,async()=>{
 const page=await pageFor(engine);try{
  await management(page);if(artifacts)await page.screenshot({path:artifacts+'/'+engine+'-management.png'});await swipe(page.locator('[data-space-id="s"] span').filter({hasText:'家庭共享空间'}).first());await page.getByRole('heading',{name:'我的',exact:true}).waitFor();
  await detail(page);await swipe(page.getByRole('heading',{name:'家庭共享空间',exact:true}).first());await page.getByRole('heading',{name:'空间管理',exact:true}).waitFor();await swipe(page.getByRole('heading',{name:'空间管理',exact:true}));await page.getByRole('heading',{name:'我的',exact:true}).waitFor();assert.deepEqual(page.errors,[]);
 }finally{await page.close()}
});
for(const engine of ['WebKit','Chrome'])test(`${engine}: existing top-back routes still return detail → management → My`,async()=>{
 const page=await pageFor(engine,430);try{
  await detail(page);await page.locator('main header').getByRole('button',{name:'空间管理',exact:true}).tap();await page.getByRole('heading',{name:'空间管理',exact:true}).waitFor();await page.locator('main header').getByRole('button',{name:'我的',exact:true}).tap();await page.getByRole('heading',{name:'我的',exact:true}).waitFor();assert.deepEqual(page.errors,[]);
 }finally{await page.close()}
});
for(const engine of ['WebKit','Chrome'])test(`${engine}: management rejects left/vertical/short/cancel/mouse gestures and ordinary action-button starts`,async()=>{
 const page=await pageFor(engine);try{
  await management(page);const title=page.getByRole('heading',{name:'空间管理',exact:true}),row=page.locator('[data-space-id="s"]');
  for(const options of [{dx:-120},{dx:15,dy:120},{dx:30},{cancel:true},{pointerType:'mouse'}]){await swipe(row.locator('span').filter({hasText:'家庭共享空间'}).first(),options);assert.ok(await title.isVisible(),JSON.stringify(options))}
  await swipe(page.getByRole('button',{name:'创建共享空间',exact:true}));assert.ok(await title.isVisible());assert.equal(await page.getByRole('dialog').count(),0);
  await row.tap();await page.getByRole('heading',{name:'家庭共享空间',exact:true}).first().waitFor();assert.deepEqual(page.errors,[]);
 }finally{await page.close()}
});
for(const engine of ['WebKit','Chrome'])test(`${engine}: real create/join modal and dirty cancel protection block parent swipes`,async()=>{
 const page=await pageFor(engine);try{
  await management(page);const title=page.getByRole('heading',{name:'空间管理',exact:true});
  for(const [label,input] of [['创建共享空间','#shared-space-name'],['加入空间','#shared-invite-code']]){
   await page.getByRole('button',{name:label,exact:true}).tap();const modal=page.getByRole('dialog');await modal.waitFor();const field=page.locator(input);await field.fill(label==='加入空间'?'SYNTH123':'未保存的测试名称');
   await swipe(field);await swipe(modal.getByRole('heading'));await swipe(title);assert.ok(await modal.isVisible());assert.ok(await title.isVisible());
   page.once('dialog',dialog=>dialog.dismiss());await modal.getByRole('button',{name:'返回空间管理',exact:true}).click();assert.ok(await modal.isVisible(),'dismissed discard keeps dirty form');assert.equal(await field.inputValue(),label==='加入空间'?'SYNTH123':'未保存的测试名称');
   page.once('dialog',dialog=>dialog.accept());await modal.getByRole('button',{name:'返回空间管理',exact:true}).click();await modal.waitFor({state:'hidden'});assert.ok(await title.isVisible());
  }
  await swipe(title);await page.getByRole('heading',{name:'我的',exact:true}).waitFor();assert.deepEqual(page.errors,[]);
 }finally{await page.close()}
});
for(const engine of ['WebKit','Chrome'])test(`${engine}: inline rename input and pending real update prevent detail swipe navigation`,async()=>{
 const page=await pageFor(engine);try{
  await detail(page);const title=page.getByRole('heading',{name:'家庭共享空间',exact:true}).first();await page.getByRole('button',{name:'修改名称',exact:true}).tap();const field=page.getByLabel('空间名称',{exact:true});await field.fill('待保存的家庭空间');await swipe(field);assert.ok(await title.isVisible());assert.equal(await field.inputValue(),'待保存的家庭空间');
  await page.evaluate(()=>{window.swipeFixture.hold=true});await page.getByRole('button',{name:'保存名称',exact:true}).tap();await page.getByRole('button',{name:'保存中…',exact:true}).waitFor();assert.equal(await page.locator('main header').getByRole('button',{name:'空间管理',exact:true}).isDisabled(),true);
  await swipe(title);assert.ok(await title.isVisible(),'busy prevents returning');assert.equal(await page.getByRole('heading',{name:'空间管理',exact:true}).count(),0);
  await page.evaluate(()=>window.swipeFixture.release());await page.getByRole('alert').filter({hasText:'模拟操作失败'}).waitFor();await page.getByRole('button',{name:'取消',exact:true}).tap();await swipe(title);await page.getByRole('heading',{name:'空间管理',exact:true}).waitFor();assert.deepEqual(page.errors,[]);
 }finally{await page.close()}
});
test('Chrome: native CDP touch swipe through real App does not click the newly revealed page',async()=>{
 const page=await pageFor('Chrome');try{
  await management(page);const row=page.locator('[data-space-id="s"]'),box=await row.boundingBox();const client=await page.context().newCDPSession(page),x=box.x+32,y=box.y+box.height/2;
  await page.evaluate(()=>{window.swipeFixture.events=[]});
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(const dx of [30,70,120])await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+2,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.getByRole('heading',{name:'我的',exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByRole('heading',{name:'空间管理',exact:true}).count(),0);
  const trace=await page.evaluate(()=>window.swipeFixture.events);assert.ok(trace.some(event=>event.type==='pointerdown'&&event.pointerType==='touch'&&event.trusted));assert.ok(trace.some(event=>event.type==='pointerup'&&event.pointerType==='touch'&&event.trusted));if(artifacts)await writeFile(artifacts+'/Chrome-native-touch.json',JSON.stringify(trace,null,2));
  await management(page);assert.ok(await page.getByRole('heading',{name:'空间管理',exact:true}).isVisible(),'new real tap remains available after the gesture');assert.deepEqual(page.errors,[]);
 }finally{await page.close()}
});
