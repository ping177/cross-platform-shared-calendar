import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const browsers=new Map();let files,baselineFiles;
const artifacts=process.env.SPACE_FILTER_ARTIFACTS;
const api=`export const isSupabaseConfigured=true;export const supabase={auth:{async getUser(){return {data:{user:{id:'me'}},error:null}},onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}},channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){},from(){const q={select(){return q},eq(){return q},order(){return q},in(){return q},or(){return q},range(){return q},then(resolve){return Promise.resolve({data:[],count:0,error:null}).then(resolve)}};return q}};`;
before(async()=>{
 async function bundleFor(baseline=false){return build({root,configFile:false,envFile:false,logLevel:'error',plugins:[{name:'filter-backend-io',enforce:'pre',transform(code,id){if(baseline&&['src/App.tsx','src/styles.css','src/components/TasksArea.tsx','src/components/ListsOverviewPage.tsx','src/components/ReviewHistoryPage.tsx','src/components/ImportantDatesPage.tsx'].some(file=>id===root+file))return execFileSync('git',['show','afd6e35a331af2d58db4cf5c4c16e3650928103e:'+id.slice(root.length)],{cwd:root,encoding:'utf8'});},resolveId(id){if(/\/supabase(?:\.ts)?$/.test(id))return '\0filter-api';for(const name of ['aggregate-tasks-data','lists-data','important-dates-data','current-spaces','space-members'])if(new RegExp('/'+name+'(?:\\.ts)?$').test(id))return '\0filter-'+name},load(id){if(id==='\0filter-api')return api;if(!id.startsWith('\0filter-'))return;const name=id.slice(8);const original=`export * from ${JSON.stringify(root+'src/lib/'+name+'.ts?actual')};`;
 if(name==='aggregate-tasks-data')return original+'export async function loadAggregateTasks(user,filter){return window.fixture.taskData(filter)};export async function loadTaskEligibility(){return window.fixture.entry}';
 if(name==='lists-data')return original+'export async function loadListsOverview(){return window.fixture.listData()}';
 if(name==='important-dates-data')return original+'export async function loadImportantDates(){return window.fixture.importantData()}';
 if(name==='current-spaces')return 'export async function listCurrentSpaces(){return window.fixture.spaces}';
 if(name==='space-members')return 'export async function readSpaceMembers(id){return window.fixture.members(id)}';
 }}],build:{write:false,minify:false,rollupOptions:{input:root+'tests/fixtures/space-filters-browser.jsx'}}});}
 files=(await bundleFor()).output;baselineFiles=(await bundleFor(true)).output;
 if(artifacts)await mkdir(artifacts,{recursive:true});
 for(const [name,type] of [['WebKit',webkit],['Chrome',chromium]])browsers.set(name,await type.launch(name==='Chrome'?{channel:'chrome',headless:true}:{headless:true}));
});
after(async()=>{
 try {
  if(artifacts){
   const page=await browsers.get('Chrome').newPage({viewport:{width:1875,height:846},deviceScaleFactor:1});
   for(const width of [375,430]){
    const images=await Promise.all(Object.keys(labels).map(async mode=>`<div><p>${mode} · ${width}px</p><img width="${width}" src="data:image/png;base64,${(await readFile(path.join(artifacts,`${mode}-${width}.png`))).toString('base64')}"></div>`));
    await page.setViewportSize({width:width*5,height:846});
    await page.setContent(`<style>body{margin:0;display:flex}p{margin:0;height:34px;font:16px sans-serif;display:grid;place-items:center}img{display:block}</style>${images.join('')}`);
    await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
    await page.screenshot({path:path.join(artifacts,`comparison-${width}.png`)});
   }
   await page.close();
  }
 }finally{for(const b of browsers.values())await b.close()}
});
const labels={calendar:'筛选日历',tasks:'筛选任务空间',lists:'筛选清单空间',review:'筛选回顾空间',important:'筛选重要日空间'};
async function pageFor(engine,mode,width=375,baseline=false){
 const assets=baseline?baselineFiles:files;
 const page=await browsers.get(engine).newPage({viewport:{width,height:812},hasTouch:true,isMobile:true});page.setDefaultTimeout(3000);page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());assert.equal(url.origin,'http://127.0.0.1:5175');const f=assets.find(f=>url.pathname==='/'+f.fileName);if(f)return route.fulfill({contentType:f.fileName.endsWith('.css')?'text/css':'text/javascript',body:f.type==='chunk'?f.code:f.source});if(url.pathname!=='/__filter_test')return route.abort();return route.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><div id="root"></div><link rel="stylesheet" href="/${assets.find(f=>f.fileName.endsWith('.css')).fileName}"><script type="module" src="/${assets.find(f=>f.type==='chunk'&&f.isEntry).fileName}"></script>`})});
 await page.goto('http://127.0.0.1:5175/__filter_test?mode='+mode);return page;
}
for(const engine of ['WebKit','Chrome'])for(const mode of Object.keys(labels))test(`${engine}: ${mode} real page touch opens inline listbox and selects actual Personal name`,async()=>{
 const page=await pageFor(engine,mode);try{
 const trigger=page.getByRole('button',{name:labels[mode],exact:true});await trigger.tap();
 const menu=page.getByRole('listbox',{name:labels[mode],exact:true});await menu.waitFor();
 assert.equal(await menu.getByRole('option',{name:'全部空间',exact:true}).count(),mode==='review'?0:1);
 await menu.getByRole('option',{name:'家庭共享空间',exact:true}).tap();await menu.waitFor({state:'hidden'});await trigger.filter({hasText:'家庭共享空间'}).waitFor();
 await trigger.tap();await page.getByRole('option',{name:'我的自定义小天地',exact:true}).tap();await trigger.filter({hasText:'我的自定义小天地'}).waitFor();
 if(mode!=='review'){await trigger.tap();await page.getByRole('option',{name:'全部空间',exact:true}).tap();await trigger.filter({hasText:'全部空间'}).waitFor()}
 assert.deepEqual(page.errors,[]);
 }finally{await page.close()}
});
const triggerFor=(page,mode)=>page.getByRole('button',{name:labels[mode],exact:true});
async function metrics(locator){return locator.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontSize,weight:s.fontWeight}})}
for(const engine of ['WebKit','Chrome']){
 for(const width of [375,430])test(`${engine}: ${width}px five real pages preserve trigger geometry and share unobscured bounded menu`,async()=>{
  let reference;
  for(const mode of Object.keys(labels)){
   const baseline=await pageFor(engine,mode,width,true);
   const oldTrigger=mode==='calendar'?triggerFor(baseline,mode):baseline.locator(mode==='review'?'#review-space':`select[aria-label="${labels[mode]}"]`);
   await oldTrigger.waitFor();const old=await metrics(oldTrigger);await baseline.close();
   const page=await pageFor(engine,mode,width);
   try{
    const trigger=triggerFor(page,mode);await trigger.waitFor();const now=await metrics(trigger);
    for(const k of ['x','y','width','height']){const expected=mode!=='calendar'&&k==='y'?76:old[k];assert.ok(Math.abs(now[k]-expected)<=1,`${mode} approved ${k}: ${expected} -> ${now[k]}`);}
    assert.equal(now.font,old.font);assert.equal(now.weight,old.weight);
    if(artifacts&&engine==='WebKit'&&width===375&&mode==='review')await page.screenshot({path:path.join(artifacts,'review-closed-375.png')});
    await trigger.tap();const menu=page.getByRole('listbox');await menu.waitFor();const box=await menu.boundingBox();
    assert.ok(Math.abs(box.y-(now.y+now.height+4))<=1);assert.ok(box.x>=16&&box.x+box.width<=width-16+1);assert.ok(Math.abs(box.width-Math.min(384,width-32))<=1);assert.ok(box.height<=320);
    if(mode==='calendar')assert.ok(box.width>now.width*1.5);
    assert.equal(await menu.evaluate(el=>el.scrollHeight>el.clientHeight),true);
    const item=menu.getByRole('option',{name:'家庭共享空间',exact:true});
    assert.equal(await item.evaluate(el=>getComputedStyle(el).fontSize),'16px');
    const hit=await item.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[role="option"]')===el});assert.ok(hit,mode+' not obscured by sticky header');
    const visual=await menu.evaluate(el=>{const s=getComputedStyle(el);return [s.fontFamily,s.fontSize,s.lineHeight,s.backgroundColor,s.borderRadius,s.padding,s.boxShadow]});
    reference??=visual;assert.deepEqual(visual,reference);
    assert.equal(await page.locator('[role="dialog"]').count(),0);
    if(mode==='review'){
     assert.equal(await page.locator('label[for="review-space"]').count(),0);
     const title=page.getByRole('heading',{name:'历史回顾',exact:true});assert.equal(await title.evaluate(el=>getComputedStyle(el).fontSize),'14px');assert.equal(await title.evaluate(el=>getComputedStyle(el).fontWeight),'500');assert.equal(await title.evaluate(el=>getComputedStyle(el.closest('section')).marginTop),'0px');
    }
    if(artifacts&&engine==='WebKit')await page.screenshot({path:path.join(artifacts,`${mode}-${width}.png`)});
    assert.deepEqual(page.errors,[]);
   }finally{await page.close()}
  }
 });
 test(`${engine}: all five menus support arrows, Enter, Escape, IME, Tab and outside touch`,async()=>{
  for(const mode of Object.keys(labels)){
   const page=await pageFor(engine,mode);
   try{
    const trigger=triggerFor(page,mode);await trigger.focus();await trigger.press('ArrowDown');const menu=page.getByRole('listbox');await menu.waitFor();await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='option');
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await menu.waitFor({state:'hidden'});
    await page.waitForFunction(label=>document.activeElement?.getAttribute('aria-label')===label,labels[mode]);
    await trigger.tap();await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='option');await page.keyboard.press('End');await page.waitForFunction(()=>document.activeElement?.textContent==='共享空间 23 很长的空间名称测试');await page.keyboard.press('Home');await page.waitForFunction(()=>document.activeElement===document.querySelector('[role="option"]'));await page.keyboard.press('Space');await menu.waitFor({state:'hidden'});
    const selected=await trigger.textContent();await trigger.tap();
    await menu.evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true})));assert.ok(await menu.isVisible());
    await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});assert.equal(await trigger.textContent(),selected);
    await trigger.tap();await page.keyboard.press('Tab');await menu.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-space-filter-trigger')),false);
    await trigger.tap();await page.locator('#outside').tap();await menu.waitFor({state:'hidden'});assert.equal(await trigger.textContent(),selected);
    assert.deepEqual(page.errors,[]);
   }finally{await page.close()}
  }
 });
 test(`${engine}: native pointer focus/click ordering, independent scroll, sticky tracking and viewport edges`,async()=>{
  const page=await pageFor(engine,'calendar');
  try{
   const trigger=triggerFor(page,'calendar');await trigger.tap();const menu=page.getByRole('listbox');await menu.waitFor();
   const bodyHeight=await page.evaluate(()=>document.documentElement.scrollHeight),scroll=await page.evaluate(()=>scrollY);
   await page.evaluate(()=>{window.fixture.trace=[];for(const type of ['pointerdown','mousedown','focusout','click'])document.addEventListener(type,e=>window.fixture.trace.push({type,related:e.relatedTarget?.tagName??null}),true)});
   const box=await menu.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);if(engine==='WebKit')await menu.evaluate(el=>{el.scrollTop=700});else await page.mouse.wheel(0,900);
   await page.waitForFunction(()=>document.querySelector('[role="listbox"]').scrollTop>0);
   assert.equal(await page.evaluate(()=>scrollY),scroll);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),bodyHeight);
   await menu.getByRole('option').last().tap();await trigger.filter({hasText:'共享空间 23'}).waitFor();
   const trace=await page.evaluate(()=>window.fixture.trace);assert.ok(trace.some(e=>e.type==='click'));assert.ok(trace.some(e=>e.type==='focusout'));if(artifacts)await writeFile(path.join(artifacts,`pointer-trace-${engine}.json`),JSON.stringify(trace,null,2));
   await trigger.tap();await page.evaluate(()=>window.scrollTo(0,90));
   await page.waitForFunction(()=>{const a=document.querySelector('[data-space-filter-trigger]').getBoundingClientRect(),b=document.querySelector('[role="listbox"]').getBoundingClientRect();return Math.abs(b.top-a.bottom-4)<1});
   await page.keyboard.press('Escape');
   await trigger.evaluate(el=>{Object.assign(el.style,{position:'fixed',top:'420px',left:'auto',right:'0',width:'110px'})});await trigger.tap();const edge=await menu.boundingBox();assert.ok(edge.x>=16&&edge.x+edge.width<=359+1);assert.ok(edge.y+edge.height<=804+1);
   assert.deepEqual(page.errors,[]);
  }finally{await page.close()}
 });
 test(`${engine}: rapid Task switches reject old responses and preserve failure retry`,async()=>{
  const page=await pageFor(engine,'tasks');
  try{
   const trigger=triggerFor(page,'tasks');await trigger.waitFor();await page.evaluate(()=>{window.fixture.hold=true});
   for(const id of [1,2]){await trigger.tap();await page.getByRole('option',{name:id===1?'家庭共享空间':'共享空间 2 很长的空间名称测试',exact:true}).tap();await page.waitForFunction(key=>window.fixture.pending.some(p=>p.key===key),'s'+id)}
   await page.evaluate(()=>{window.fixture.pending.find(p=>p.key==='s2').resolve()});await page.getByText('任务 共享空间 2 很长的空间名称测试',{exact:true}).waitFor();
   await page.evaluate(()=>{window.fixture.pending.find(p=>p.key==='s1').resolve()});await page.waitForTimeout(80);assert.equal(await page.getByText('任务 家庭共享空间',{exact:true}).count(),0);
   await page.evaluate(()=>{window.fixture.hold=false;window.fixture.fail=true});await trigger.tap();await page.getByRole('option',{name:'家庭共享空间',exact:true}).tap();await page.getByRole('alert').filter({hasText:'筛选读取失败'}).waitFor();
   await page.evaluate(()=>{window.fixture.fail=false});await page.getByRole('button',{name:'重试',exact:true}).click();await page.getByText('任务 家庭共享空间',{exact:true}).waitFor();assert.deepEqual(page.errors,[]);
  }finally{await page.close()}
 });
 test(`${engine}: Review pending eligibility closes menu and retains its single-Space contract`,async()=>{
  const page=await pageFor(engine,'review');try{
   const trigger=triggerFor(page,'review');await trigger.tap();await page.evaluate(()=>window.fixture.setEntryPending(true));await page.getByRole('listbox').waitFor({state:'hidden'});await page.waitForFunction(label=>document.querySelector(`[aria-label="${label}"]`).disabled,labels.review);
   await page.evaluate(()=>window.fixture.setEntryPending(false));await trigger.tap();assert.equal(await page.getByRole('option',{name:'全部空间',exact:true}).count(),0);await page.keyboard.press('Escape');assert.deepEqual(page.errors,[]);
  }finally{await page.close()}
 });
}

for(const engine of ['WebKit','Chrome'])test(`${engine}: real create forms keep all/one Space preselection and independent native save targets`,async()=>{
 const targets={calendar:['新建日程','#event-create-target'],tasks:['新建任务','#task-create-target'],lists:['新建清单','#list-space'],important:['新建重要日','#important-date-space']};
 for(const [mode,[create,selector]] of Object.entries(targets))for(const filtered of [false,true]){
  const page=await pageFor(engine,mode);try{
   const trigger=triggerFor(page,mode);await trigger.waitFor();
   if(filtered){await trigger.tap();await page.getByRole('option',{name:'家庭共享空间',exact:true}).tap()}
   await page.getByRole('button',{name:create,exact:true}).first().click();const target=page.locator(selector);await target.waitFor();assert.equal(await target.inputValue(),filtered?'s1':'s0');
   assert.equal(await target.evaluate(el=>el.tagName),'SELECT');assert.equal(await page.getByRole('listbox').count(),0);assert.deepEqual(page.errors,[]);
  }finally{await page.close()}
 }
});

for(const engine of ['WebKit','Chrome'])test(`${engine}: null blur cannot consume a real touch click; short safe viewport bounds long options`,async()=>{
 const page=await pageFor(engine,'calendar');try{
  const trigger=triggerFor(page,'calendar');await trigger.tap();const menu=page.getByRole('listbox');await menu.waitFor();
  await page.evaluate(()=>document.addEventListener('mousedown',()=>document.activeElement?.dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:null})),{once:true}));
  await page.getByRole('option',{name:'家庭共享空间',exact:true}).tap();await trigger.filter({hasText:'家庭共享空间'}).waitFor();
  await page.setViewportSize({width:375,height:360});await trigger.tap();await page.locator('.ui-space-filter-viewport').evaluate(el=>{el.style.inset='20px 22px 30px 18px';window.dispatchEvent(new Event('resize'))});
  await page.waitForFunction(()=>document.querySelector('[role="listbox"]').getBoundingClientRect().left>=34);
  const box=await menu.boundingBox();assert.ok(box.x>=34&&box.x+box.width<=337+1);assert.ok(box.y+box.height<=322+1);
  await menu.evaluate(el=>{el.scrollTop=el.scrollHeight});assert.ok(await menu.evaluate(el=>el.scrollWidth<=el.clientWidth));
  assert.deepEqual(page.errors,[]);
 }finally{await page.close()}
});
