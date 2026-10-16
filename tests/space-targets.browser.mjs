import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
const {webkit,chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.SPACE_TARGET_ARTIFACTS,browsers=new Map(),records=[];let files;
const ids={event:'event-create-target',task:'task-create-target',list:'list-space',important:'important-date-space'};
before(async()=>{
 files=(await build({root,configFile:false,envFile:false,logLevel:'error',plugins:[{name:'space-target-boundary-io',enforce:'pre',resolveId(id){if(/\/supabase(?:\.ts)?$/.test(id))return '\0target-api'},load(id){if(id==='\0target-api')return `export const isSupabaseConfigured=true;export const supabase={auth:{async getUser(){return {data:{user:{id:'me'}},error:null}}},from(table){return window.targetFixture.query(table)},rpc(name,args){return window.targetFixture.rpc(name,args)}};`}}],build:{write:false,minify:false,rollupOptions:{input:root+'tests/fixtures/space-targets-browser.jsx'}}})).output;
 if(out)await mkdir(out,{recursive:true});for(const [name,type] of [['WebKit',webkit],['Chrome',chromium]])browsers.set(name,await type.launch(name==='Chrome'?{channel:'chrome',headless:true}:{headless:true}));
});
after(async()=>{if(out)await writeFile(out+'/metrics.json',JSON.stringify(records,null,2));for(const b of browsers.values())await b.close()});
async function pageFor(engine,mode,width=375,params=''){
 const page=await browsers.get(engine).newPage({viewport:{width,height:812},isMobile:true,hasTouch:true,timezoneId:'Asia/Shanghai'});page.setDefaultTimeout(3000);page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());assert.equal(u.origin,'http://127.0.0.1:5175');const f=files.find(f=>u.pathname==='/'+f.fileName);if(f)return route.fulfill({contentType:f.fileName.endsWith('.css')?'text/css':'text/javascript',body:f.type==='chunk'?f.code:f.source});if(u.pathname!=='/__target')return route.abort();return route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><div id="root"></div><link rel="stylesheet" href="/${files.find(f=>f.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find(f=>f.type==='chunk'&&f.isEntry).fileName}"></script>`})});
 await page.goto(`http://127.0.0.1:5175/__target?mode=${mode}&${params}`);await page.getByRole('dialog').waitFor();assert.deepEqual(page.errors,[]);return page;
}
for(const engine of ['WebKit','Chrome'])for(const width of [375,430])test(`${engine} ${width}: four create forms use the shared custom Space menu without native ownership selects`,async()=>{
 const failures=[];
 for(const mode of Object.keys(ids)){const page=await pageFor(engine,mode,width);try{
  const trigger=page.locator('#'+ids[mode]);await trigger.scrollIntoViewIfNeeded();
  if(out)await page.screenshot({path:`${out}/${engine}-${width}-${mode}-closed.png`,fullPage:true});
  if(await trigger.evaluate(el=>el.tagName)!=='BUTTON'){failures.push(mode+' still native');continue}
  const style=await trigger.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {font:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,padding:s.padding,border:s.borderWidth,radius:s.borderRadius,bg:s.backgroundColor,chevron:s.backgroundImage,chevronSize:s.backgroundSize,chevronPosition:s.backgroundPosition,x:r.x,width:r.width,height:r.height}});assert.equal(style.font,'16px');assert.equal(style.weight,'400');assert.equal(style.height,44);assert.equal(style.lineHeight,'24px');assert.equal(style.padding,'0px 48px 0px 12px');assert.equal(style.border,'1px');assert.equal(style.radius,'12px');assert.equal(style.bg,'rgb(255, 255, 255)');assert.notEqual(style.chevron,'none');assert.equal(style.chevronSize,'16px 16px');assert.match(style.chevronPosition,/16px/);
  assert.ok((await trigger.innerText()).includes('我的自定义空间'));await trigger.tap();const menu=page.getByRole('listbox');await menu.waitFor();assert.equal(await menu.getByRole('option',{name:'全部空间',exact:true}).count(),0);assert.ok(await menu.getByRole('option',{name:'我的自定义空间',exact:true}).getAttribute('aria-selected')==='true');
  const box=await menu.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=812);assert.equal(await menu.evaluate(el=>!!el.closest('[role="dialog"]')),true,'portal remains in the modal accessibility/focus scope');
  const visible=await menu.getByRole('option',{name:'家庭共享空间',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[role="option"]')===el});assert.equal(visible,true,'not covered or clipped');
  if(out)await page.screenshot({path:`${out}/${engine}-${width}-${mode}-open.png`});
  await menu.getByRole('option',{name:'家庭共享空间',exact:true}).tap();await menu.waitFor({state:'hidden'});assert.ok((await trigger.innerText()).includes('家庭共享空间'));await page.waitForFunction(id=>document.activeElement?.id===id,ids[mode]);assert.equal(await page.getByRole('dialog').count(),1);assert.deepEqual(page.errors,[]);records.push({engine,width,mode,trigger:style,menu:box});
 }finally{await page.close()}}
 assert.deepEqual(failures,[]);
});

const closeLabels={event:'关闭',task:'关闭任务表单',list:'关闭清单表单',important:'关闭重要日表单'};
const nameField=(page,mode)=>mode==='event'?page.locator('#event-sheet-form input').first():mode==='task'?page.getByPlaceholder('输入任务标题'):page.locator(mode==='list'?'#list-name':'#important-date-name');
async function closeSheet(page,mode){await page.getByRole('button',{name:closeLabels[mode],exact:true}).click();const discard=page.getByRole('button',{name:'放弃更改',exact:true});if(await discard.count())await discard.click();await page.getByRole('dialog').waitFor({state:'hidden'})}
for(const engine of ['WebKit','Chrome']){
 test(`${engine}: popup keyboard/outside close, focus scope, Sheet cancel/reopen and listeners clean up`,async()=>{
  for(const mode of Object.keys(ids)){const page=await pageFor(engine,mode);try{
   await page.evaluate(()=>{const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document),listeners=new Set();window.targetFixture.pointerListeners=listeners;document.addEventListener=(type,fn,...args)=>{if(type==='pointerdown')listeners.add(fn);return add(type,fn,...args)};document.removeEventListener=(type,fn,...args)=>{if(type==='pointerdown')listeners.delete(fn);return remove(type,fn,...args)}});
   const trigger=page.locator('#'+ids[mode]);await trigger.scrollIntoViewIfNeeded();await trigger.tap();const menu=page.getByRole('listbox');await menu.waitFor();assert.equal(await page.evaluate(()=>window.targetFixture.pointerListeners.size),1);
   await menu.dispatchEvent('keydown',{key:'Escape',isComposing:true,keyCode:229,bubbles:true});assert.equal(await menu.isVisible(),true);assert.equal(await page.getByRole('dialog').count(),1);
   await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});await page.waitForFunction(id=>document.activeElement?.id===id,ids[mode]);assert.equal(await page.getByRole('dialog').count(),1);
   await trigger.tap();await menu.waitFor();await page.keyboard.press('Tab');await menu.waitFor({state:'hidden'});assert.equal(await page.getByRole('dialog').evaluate(el=>el.contains(document.activeElement)),true,'Tab remains in Sheet');
   await trigger.tap();await menu.waitFor();await page.getByRole('dialog').getByRole('heading').first().click();await menu.waitFor({state:'hidden'});assert.equal(await page.getByRole('dialog').count(),1);
   await trigger.tap();await menu.waitFor();await page.getByRole('button',{name:closeLabels[mode],exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.getByRole('listbox').count(),0);assert.equal(await page.evaluate(()=>window.targetFixture.pointerListeners.size),0);
   await page.getByRole('button',{name:'重新打开表单'}).click();await page.getByRole('dialog').waitFor();assert.ok((await trigger.innerText()).includes('我的自定义空间'));await trigger.scrollIntoViewIfNeeded();await trigger.tap();await page.getByRole('listbox').waitFor();await page.keyboard.press('Escape');await page.getByRole('listbox').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.targetFixture.cancelled),1);await closeSheet(page,mode);assert.deepEqual(page.errors,[]);
  }finally{await page.close()}}
 });
 for(const width of [375,430])test(`${engine} ${width}: many long names scroll within a visible menu and flip above the low List field`,async()=>{
  for(const mode of Object.keys(ids)){const page=await pageFor(engine,mode,width,'many&long&target=s');try{
   const trigger=page.locator('#'+ids[mode]);await trigger.scrollIntoViewIfNeeded();await trigger.tap();const menu=page.getByRole('listbox');await menu.waitFor();const box=await menu.boundingBox(),anchor=await trigger.boundingBox();assert.ok(box.width<=384&&box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=812);
   if(mode==='list')assert.ok(box.y+box.height<=anchor.y,'low field menu flips above');
   const longName=await page.evaluate(()=>window.targetFixture.spaces[1].name);assert.ok((await trigger.getAttribute('aria-label')).includes(longName),'assistive name includes untruncated selected Space');assert.equal(await trigger.evaluate(el=>getComputedStyle(el).textOverflow),'ellipsis');assert.equal(await menu.getByRole('option',{name:longName,exact:true}).locator('span').textContent(),longName);
   const scroll=await menu.evaluate(el=>{const body=el.closest('[role="dialog"]').querySelector('[class$="sheet-body"]');return {own:el.scrollHeight>el.clientHeight,parent:body?.scrollTop||0,page:scrollY}});assert.ok(scroll.own);if(out)await page.screenshot({path:`${out}/${engine}-${width}-${mode}-many-top-open.png`});await menu.evaluate(el=>{el.scrollTop=el.scrollHeight});assert.ok(await menu.evaluate(el=>el.scrollTop)>0);assert.equal(await page.evaluate(()=>scrollY),scroll.page);assert.equal(await menu.evaluate(el=>el.closest('[role="dialog"]').querySelector('[class$="sheet-body"]')?.scrollTop||0),scroll.parent,'menu scroll does not move Sheet content');
   const last=menu.getByRole('option',{name:'其他共享空间 19',exact:true});const hit=await last.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[role="option"]')===el});assert.equal(hit,true);
   if(out)await page.screenshot({path:`${out}/${engine}-${width}-${mode}-many-open.png`});await last.tap();await menu.waitFor({state:'hidden'});assert.ok((await trigger.innerText()).includes('其他共享空间 19'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(page.errors,[]);
  }finally{await page.close()}}
 });
 test(`${engine}: one Space, explicit Shared default and original disabled eligibility rules stay distinct`,async()=>{
  for(const mode of Object.keys(ids))for(const state of ['single','target=s','blocked']){const page=await pageFor(engine,mode,375,state);try{
   const trigger=page.locator('#'+ids[mode]);await trigger.scrollIntoViewIfNeeded();await trigger.tap();const menu=page.getByRole('listbox');await menu.waitFor();assert.equal(await menu.getByRole('option',{name:'全部空间',exact:true}).count(),0);
   if(state==='single')assert.equal(await menu.getByRole('option').count(),mode==='important'?2:1);
   if(state==='target=s')assert.ok((await trigger.innerText()).includes('家庭共享空间'));
   if(state==='blocked'){
    const own=menu.getByRole('option',{name:/我的自定义空间/});assert.equal(await own.isDisabled(),mode==='task'||mode==='important');
    await page.keyboard.press('End');await page.keyboard.press('Enter');await menu.waitFor({state:'hidden'});assert.ok((await trigger.innerText()).includes('家庭共享空间'));
   }assert.deepEqual(page.errors,[]);
  }finally{await page.close()}}
 });
 for(const width of [375,430])test(`${engine} ${width}: existing edit forms show immutable actual Space names, no ownership picker`,async()=>{
  for(const mode of Object.keys(ids)){const page=await pageFor(engine,mode,width,'edit');try{
   assert.equal(await page.locator('[data-space-target-trigger]').count(),0);assert.equal(await page.locator('select#'+ids[mode]).count(),0);assert.ok((await page.getByRole('dialog').innerText()).includes('我的自定义空间'));
   if(out)await page.screenshot({path:`${out}/${engine}-${width}-${mode}-edit.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await closeSheet(page,mode);assert.deepEqual(page.errors,[]);
  }finally{await page.close()}}
 });
 test(`${engine}: actual form submission keeps the latest Space ID and draft through switches; busy controls lock`,async()=>{
  for(const mode of Object.keys(ids)){const page=await pageFor(engine,mode,375,'busy&entry=home');try{
   const field=nameField(page,mode);await field.fill('保留草稿内容');if(mode==='important'){await page.getByRole('spinbutton',{name:'月',exact:true}).fill('10');await page.getByRole('spinbutton',{name:'日',exact:true}).fill('20');}const trigger=page.locator('#'+ids[mode]);
   for(const name of ['家庭共享空间','我的自定义空间','家庭共享空间']){await trigger.scrollIntoViewIfNeeded();await trigger.tap();await page.getByRole('listbox').getByRole('option',{name,exact:true}).tap();await page.getByRole('listbox').waitFor({state:'hidden'})}assert.equal(await field.inputValue(),'保留草稿内容');
   const submit=page.locator('button[type="submit"]');await submit.click();if(mode==='event'||mode==='task')await page.getByRole('button',{name:'确认保存',exact:true}).click();await page.waitForFunction(()=>window.targetFixture.calls.length===1);assert.equal(await trigger.isDisabled(),true);assert.equal(await page.getByRole('listbox').count(),0);
   const call=await page.evaluate(()=>window.targetFixture.calls[0]);assert.equal(call.space_id||call.values?.space_id,'s','actual save uses selected Space, not filter or initial Personal');assert.equal(call.name||call.draft?.name||call.values?.title,'保留草稿内容');await page.evaluate(()=>window.targetFixture.release());await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.targetFixture.calls.length),1);assert.deepEqual(page.errors,[]);
  }finally{await page.close()}}
 });
}

for(const engine of ['WebKit','Chrome'])test(`${engine}: short viewport keeps popup within the visible area and leaves Sheet cancel usable`,async()=>{
 for(const mode of Object.keys(ids)){const page=await pageFor(engine,mode);try{
  await page.setViewportSize({width:375,height:360});const trigger=page.locator('#'+ids[mode]);await trigger.scrollIntoViewIfNeeded();await trigger.tap();const menu=page.getByRole('listbox');await menu.waitFor();const box=await menu.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=360&&box.height>=44);if(out)await page.screenshot({path:`${out}/${engine}-375-${mode}-short-open.png`});
  if(mode==='event'){
   const body=page.locator('.ui-event-sheet-body');await body.evaluate(el=>{el.scrollTop=el.scrollHeight});await menu.waitFor({state:'hidden'});await page.waitForFunction(id=>document.activeElement?.id===id,ids[mode]);assert.ok(await body.evaluate(el=>el.scrollTop)>0,'closing an offscreen popup restores focus without undoing Sheet scroll');
  }else{await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'})}await closeSheet(page,mode);assert.deepEqual(page.errors,[]);
 }finally{await page.close()}}
});

for(const engine of ['WebKit','Chrome'])test(`${engine}: qualification loss during an open popup updates disabled choices without escaping modal focus`,async()=>{
 for(const mode of ['task','list','important']){const page=await pageFor(engine,mode);try{
  const trigger=page.locator('#'+ids[mode]);await trigger.scrollIntoViewIfNeeded();await trigger.tap();const menu=page.getByRole('listbox');await menu.waitFor();await page.evaluate(()=>window.targetFixture.setEligible([]));
  if(mode==='task'){await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='listbox');assert.equal(await menu.getByRole('option').filter({hasText:'家庭共享空间'}).count(),0)}
  if(mode==='important'){await page.waitForFunction(()=>document.activeElement?.textContent==='请主动选择空间');assert.equal(await menu.getByRole('option',{name:/我的自定义空间/}).isDisabled(),true)}
  assert.equal(await page.locator('button[type="submit"]').isDisabled(),true);await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});assert.equal(await page.getByRole('dialog').count(),1);assert.deepEqual(await page.evaluate(()=>window.targetFixture.calls),[]);assert.deepEqual(page.errors,[]);
 }finally{await page.close()}}
});

for(const engine of ['WebKit','Chrome'])test(`${engine}: choosing the current form Space closes without resetting Event audience or Task assignment`,async()=>{
 for(const mode of ['event','task']){const page=await pageFor(engine,mode,375,'target=s&entry=home');try{
  if(mode==='event')await page.getByRole('button',{name:'共同',exact:true}).click();else await page.getByLabel('分配给').selectOption('other');
  const trigger=page.locator('#'+ids[mode]);await trigger.scrollIntoViewIfNeeded();await trigger.tap();await page.getByRole('listbox').getByRole('option',{name:'家庭共享空间',exact:true}).tap();await page.getByRole('listbox').waitFor({state:'hidden'});assert.deepEqual(await page.evaluate(()=>window.targetFixture.selections),[],'same target is not a semantic change');
  if(mode==='event')assert.match(await page.getByRole('button',{name:'共同',exact:true}).getAttribute('class'),/bg-teal/);else assert.equal(await page.getByLabel('分配给').inputValue(),'other');assert.deepEqual(page.errors,[]);
 }finally{await page.close()}}
});
