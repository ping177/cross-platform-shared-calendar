import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
const {webkit,chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const out=process.env.UI_CONSISTENCY_ARTIFACTS;
const browsers=new Map();let files;const measurements=[];
const api=`export const isSupabaseConfigured=true;export const supabase={auth:{async getSession(){return {data:{session:null}}},async getUser(){return {data:{user:{id:'me'}},error:null}},async signInWithOtp(input){window.audit.authCalls.push({kind:'send',input});return {error:null}},async verifyOtp(input){window.audit.authCalls.push({kind:'verify',input});return {error:{message:'模拟验证码错误'}}},onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}},channel(){return {on(){return this},subscribe(cb){if(cb)queueMicrotask(()=>cb('SUBSCRIBED'));return this}}},removeChannel(){},from(table){return window.audit.query(table)},rpc(name,args){return window.audit.rpc(name,args)},storage:{from(){return {createSignedUrl:async()=>({data:null,error:null})}}}};`;
const io={
 'current-spaces':'export async function listCurrentSpaces(){return window.audit.read(window.audit.spaces)}',
 'space-members':'export async function readSpaceMembers(id){return window.audit.read(window.audit.members(id))}',
 'aggregate-tasks-data':'export async function loadAggregateTasks(user,filter){return window.audit.read(window.audit.taskData(filter))};export async function loadTaskEligibility(){return window.audit.read(window.audit.entry)}',
 'lists-data':'export async function loadListsOverview(){return window.audit.read(window.audit.listData())};export async function loadListsEligibility(){return window.audit.read(window.audit.entry)}',
 'important-dates-data':'export async function loadImportantDates(){return window.audit.read(window.audit.dateData())};export async function loadImportantDatesEligibility(){return window.audit.read(window.audit.entry)};export async function loadHomeImportantDates(){return window.audit.read(window.audit.dateData())};export async function loadCalendarImportantDates(){return window.audit.read(window.audit.dateData())}',
 'review-history-data':`export async function loadReviewEligibility(){return window.audit.read(window.audit.spaces)};export async function loadReviewHistoryPage(){const a=window.audit;return a.read({rows:a.rounds.map(round=>({round,mine:'已填写',other:'草稿'})),hasMore:false,totalCount:a.rounds.length})}`,
 'lists-detail-data':`export async function loadListDetail(){const a=window.audit;return a.read({status:'ready',space:a.spaces[1],list:a.lists[0]||{id:'l',space_id:'s',name:'周末采购'},sections:a.tables.list_sections,items:a.items})}`,
 'review-detail-data':`export async function readReviewDetail(){const a=window.audit;return a.read({round:a.rounds[0],own:a.own,other:{...a.own,user_id:'other'}})}`
};

before(async()=>{
 files=(await build({root,configFile:false,envFile:false,logLevel:'error',plugins:[{name:'ui-consistency-backend-io',enforce:'pre',resolveId(id){if(/\/supabase(?:\.ts)?$/.test(id))return '\0audit-api';for(const name of Object.keys(io))if(new RegExp('/'+name+'(?:\\.ts)?$').test(id))return '\0audit-'+name},load(id){if(id==='\0audit-api')return api;if(id.startsWith('\0audit-')){const name=id.slice(7);return `export * from ${JSON.stringify(root+'src/lib/'+name+'.ts?actual')};`+io[name]}}}],build:{write:false,minify:false,rollupOptions:{input:root+'tests/fixtures/ui-consistency-browser.jsx'}}})).output;
 if(out)await mkdir(out,{recursive:true});
 for(const [name,type] of [['WebKit',webkit],['Chrome',chromium]])browsers.set(name,await type.launch(name==='Chrome'?{channel:'chrome',headless:true}:{headless:true}));
});
after(async()=>{
 try{if(out){
  await writeFile(out+'/metrics.json',JSON.stringify(measurements,null,2));
  const stitch=await browsers.get('Chrome').newPage();
  for(const [name,names,width] of [
   ['headers-375',modes.map(mode=>`WebKit-${mode}-375.png`),375],
   ['headers-430',modes.map(mode=>`WebKit-${mode}-430.png`),430],
   ['empty-375',modes.map(mode=>`WebKit-${mode}-empty-375.png`),375],
   ['login-notification',['WebKit-login-375.png','WebKit-otp-375.png','WebKit-me-dialog-375.png'],375],
  ]){
   const entries=await Promise.all(names.map(async file=>{try{return {file,data:(await readFile(out+'/'+file)).toString('base64')}}catch{return null}}));
   if(entries.some(e=>!e))continue;
   await stitch.setViewportSize({width:width*entries.length,height:844});await stitch.setContent(`<style>body{margin:0;display:flex;align-items:flex-start;background:#f8f7f3}p{margin:0;height:32px;font:14px sans-serif;display:grid;place-items:center}img{display:block}</style>${entries.map(e=>`<div><p>${e.file}</p><img width="${width}" src="data:image/png;base64,${e.data}"></div>`).join('')}`);await stitch.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await stitch.screenshot({path:out+'/'+name+'.png',fullPage:true});
  }await stitch.close();
 }}finally{for(const browser of browsers.values())await browser.close()}
});
async function pageFor(engine,mode,state='populated',width=375,safeBottom=0){
 const page=await browsers.get(engine).newPage({viewport:{width,height:812},isMobile:width<768,hasTouch:width<768,timezoneId:'Asia/Shanghai'});page.setDefaultTimeout(3000);page.errors=[];page.on('pageerror',error=>page.errors.push(error.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());assert.equal(u.origin,'http://127.0.0.1:5175');const f=files.find(f=>u.pathname==='/'+f.fileName);if(f)return route.fulfill({contentType:f.fileName.endsWith('.css')?'text/css':'text/javascript',body:f.type==='chunk'?f.code:safeBottom?String(f.source).replace(/env\(safe-area-inset-bottom(?:,\s*0px)?\)/g,String(safeBottom)+'px'):f.source});if(u.pathname.startsWith('/avatars/'))return route.fulfill({contentType:'image/svg+xml',body:await readFile(root+'public'+u.pathname)});if(u.pathname!=='/__ui_test')return route.abort();return route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><div id="root"></div><link rel="stylesheet" href="/${files.find(f=>f.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find(f=>f.type==='chunk'&&f.isEntry).fileName}"></script>`})});
 await page.goto(`http://127.0.0.1:5175/__ui_test?mode=${mode}&state=${state}`);return page;
}
const reviewFollowup=[];
after(async()=>{if(out)await writeFile(out+'/review-widths.json',JSON.stringify(reviewFollowup,null,2))});
for(const engine of ['WebKit','Chrome'])for(const width of [375,430])test(`${engine}: ${width}px Review short dialogs match accepted bottom Sheet edges`,async()=>{
 const records=[];
 for(const [mode,label] of [['review','新建回顾'],['review-detail','更正回顾日期'],['review-detail','删除回顾']]){
  const page=await pageFor(engine,mode,'populated',width);try{
   const trigger=page.getByRole('button',{name:label,exact:true});await trigger.waitFor();await trigger.click();const dialog=page.getByRole('dialog');await dialog.waitFor();const panel=dialog.locator('form, .ui-space-confirm').first();
   const geometry=await panel.evaluate(el=>{const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};const s=getComputedStyle(el),overlay=el.parentElement,o=getComputedStyle(overlay),v=visualViewport;return {...rect(el),compatMode:document.compatMode,viewportBottom:v?v.offsetTop+v.height:innerHeight,gap:(v?v.offsetTop+v.height:innerHeight)-el.getBoundingClientRect().bottom,padding:s.padding,borderRadius:s.borderRadius,maxWidth:s.maxWidth,margin:s.margin,alignSelf:s.alignSelf,boxSizing:s.boxSizing,overlayPadding:o.padding,align:o.alignItems,overlay:{...rect(overlay),position:o.position,inset:o.inset,margin:o.margin,transform:o.transform,clientHeight:overlay.clientHeight,flexDirection:o.flexDirection,rowGap:o.rowGap,columnGap:o.columnGap},ancestors:Array.from((function*(node){while(node){yield node;node=node.parentElement}})(overlay.parentElement)).map(node=>{const style=getComputedStyle(node);return {tag:node.tagName,class:node.className,transform:style.transform,filter:style.filter,contain:style.contain,backdrop:style.backdropFilter}})}});
   records.push({engine,viewportWidth:width,label,...geometry});if(out)await page.screenshot({path:`${out}/${engine}-${mode}-${label}-${width}.png`});
   if(label!=='删除回顾'){const input=dialog.locator('input[type="date"]');await input.fill('2026-10-15');assert.equal(await input.inputValue(),'2026-10-15')}
   await dialog.getByRole('button',{name:'取消',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.deepEqual(page.errors,[]);
  }finally{await page.close()}
 }
 reviewFollowup.push(...records);
 const deletion=records[2];
 for(const record of records.slice(0,2)){
  assert.equal(record.x,deletion.x,record.label+' left matches accepted delete shell');assert.equal(record.width,deletion.width,record.label+' full mobile width');assert.equal(record.width,width);assert.equal(record.maxWidth,deletion.maxWidth,'same existing mobile maximum width');assert.equal(record.align,'flex-end');
  assert.ok(Math.abs(record.gap)<=1,record.label+' bottom flush with visual viewport: '+JSON.stringify(record));assert.equal(record.bottom,deletion.bottom,'same viewport bottom as accepted delete Sheet');assert.equal(record.borderRadius,'24px 24px 0px 0px','top corners only');assert.ok(record.height<record.viewportBottom/2,'short Sheet keeps natural height');
 }
});
for(const engine of ['WebKit','Chrome'])test(`${engine}: Review bottom Sheets retain edges after scroll, safe-area arithmetic and short viewport resize`,async()=>{
 for(const width of [375,430])for(const [mode,label] of [['review','新建回顾'],['review-detail','更正回顾日期'],['review-detail','删除回顾']]){
  // Replace only CSS env(bottom) with 34px; this checks rule arithmetic, not a real iPhone notch.
  const page=await pageFor(engine,mode,'populated',width,34);try{
   const trigger=page.getByRole('button',{name:label,exact:true});await trigger.waitFor();await page.evaluate(()=>scrollTo(0,70));await trigger.click();const dialog=page.getByRole('dialog');await dialog.waitFor();const panel=dialog.locator('form, .ui-space-confirm').first();
   const assertBottom=async()=>{const value=await panel.evaluate(el=>{const r=el.getBoundingClientRect(),v=visualViewport,s=getComputedStyle(el);return {top:r.top,bottom:r.bottom,viewportBottom:v.offsetTop+v.height,paddingBottom:s.paddingBottom,overflow:s.overflowY,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}});assert.ok(Math.abs(value.bottom-value.viewportBottom)<=1,JSON.stringify(value));assert.equal(value.paddingBottom,'34px');assert.ok(value.top>=15);return value};
   await assertBottom();
   if(label!=='删除回顾'){
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');const scrollY=await page.evaluate(()=>window.scrollY);await panel.locator('input[type="date"]').fill('2026-10-15');await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
    if(engine==='Chrome'){await page.mouse.move(5,120);await page.mouse.wheel(0,160);assert.equal(await page.evaluate(()=>window.scrollY),scrollY,'background locked during modal')}
    // Layout-viewport resize is an automated stress model, not native keyboard emulation.
    await page.setViewportSize({width,height:200});const short=await assertBottom();assert.equal(short.overflow,'auto');assert.ok(short.scrollHeight>short.clientHeight,'short viewport keeps content internally scrollable');await panel.evaluate(el=>{el.scrollTop=el.scrollHeight});assert.ok(await panel.getByRole('button',{name:'取消',exact:true}).isVisible());
    if(out)await page.screenshot({path:`${out}/${engine}-${mode}-safe-short-${width}.png`});
    await page.setViewportSize({width,height:812});await assertBottom();await panel.locator('input[type="date"]').focus();await page.keyboard.press('Tab');await assertInside(page,dialog,'date after viewport restore');
   }
   await panel.getByRole('button',{name:'取消',exact:true}).click();await dialog.waitFor({state:'hidden'});if(label!=='删除回顾'){assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');await page.waitForFunction(label=>[...document.querySelectorAll('button')].some(b=>b===document.activeElement&&(b.getAttribute('aria-label')||b.textContent)===label),label)}assert.deepEqual(page.errors,[]);
  }finally{await page.close()}
 }
 const desktop=await pageFor(engine,'review','populated',1280);try{await desktop.getByRole('button',{name:'新建回顾',exact:true}).click();const panel=desktop.getByRole('dialog').locator('form');const box=await panel.boundingBox();assert.equal(box.width,448);assert.ok(Math.abs(box.x+box.width/2-640)<=1);assert.ok(Math.abs(box.y+box.height/2-406)<=1);await desktop.keyboard.press('Escape')}finally{await desktop.close()}
});
const modes=['tasks','lists','review','important'];
for(const engine of ['WebKit','Chrome'])for(const width of [375,430])test(`${engine}: ${width}px real module headers share centered 20px titles and filter rhythm`,async()=>{
 const records=[];
 for(const mode of modes){const page=await pageFor(engine,mode,'populated',width);try{
  await page.locator('[data-space-filter-trigger]').waitFor();
  const value=await page.evaluate(()=>{const title=document.querySelector('main h1'),filter=document.querySelector('[data-space-filter-trigger]'),header=title.closest('header');const measure=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontSize,weight:s.fontWeight,position:s.position}};return {title:measure(title),filter:measure(filter),header:measure(header),bodyWidth:document.documentElement.scrollWidth}});
  records.push({mode,...value});if(out)await page.screenshot({path:`${out}/${engine}-${mode}-${width}.png`,fullPage:true});
  assert.equal(value.title.font,'20px',mode);assert.equal(value.title.weight,'600',mode);assert.ok(Math.abs(value.title.x+value.title.width/2-width/2)<=1,mode+' exact screen center');assert.equal(value.header.position,'sticky',mode);assert.ok(Math.abs(value.filter.y-76)<=1,mode+' filter y76');assert.ok(Math.abs(value.filter.y-value.title.y-value.title.height-22)<=1,mode+' title to filter gap22');assert.ok(value.bodyWidth<=width);
  const overlap=await page.locator('main header').evaluate(header=>{const title=header.querySelector('h1').getBoundingClientRect();return [...header.querySelectorAll('button')].filter(b=>!b.hasAttribute('data-space-filter-trigger')).some(b=>{const r=b.getBoundingClientRect();return r.x<title.right&&r.right>title.x&&r.y<title.bottom&&r.bottom>title.y})});assert.equal(overlap,false,mode+' centered title leaves real operation buttons clear');
  await page.evaluate(()=>scrollTo(0,90));await page.waitForFunction(()=>document.querySelector('main header').getBoundingClientRect().top<=1);const stuck=await page.locator('main header').boundingBox();assert.ok(stuck.y>=-1&&stuck.y<=1,mode+' remains visible while scrolling');

  assert.deepEqual(page.errors,[]);
 }finally{await page.close()}}
 measurements.push({engine,width,headers:records});
});

const crossReview=[];
after(async()=>{if(out)await writeFile(out+'/cross-review.json',JSON.stringify(crossReview,null,2))});
const secondaryFor=(page,mode)=>mode==='tasks'?page.locator('details.ui-task-completed > summary'):page.getByRole('region',{name:mode==='lists'?'已完成清单':'历史重要日',exact:true}).locator(':scope > button');
for(const [engine,width] of [['WebKit',375],['WebKit',430],['Chrome',375]])test(`${engine}: ${width}px complete four-module collapsed/expanded and populated/empty visual review`,async()=>{
 const failures=[];
 for(const state of ['populated','empty']){
  let reference;
  for(const mode of modes){const page=await pageFor(engine,mode,state,width);try{
   await page.locator('main h2').first().waitFor();
   const measure=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontSize,weight:s.fontWeight,color:s.color,padding:s.padding,border:s.borderWidth,borderColor:s.borderColor,bg:s.backgroundColor,radius:s.borderRadius,shadow:s.boxShadow,lineHeight:s.lineHeight}};
   const record={engine,width,state,mode,header:await page.locator('main h1').evaluate(measure),headerActions:await page.locator('main header button:not([data-space-filter-trigger])').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {label:el.getAttribute('aria-label')||el.innerText,x:r.x,y:r.y,width:r.width,height:r.height}})),filter:await page.locator('[data-space-filter-trigger]').evaluate(measure),primaryLabel:await page.locator('main h2').first().evaluate(measure),rowTitles:await page.locator('.ui-task-title,.ui-lists-name,.ui-review-row time,.ui-important-row .text-ui-list').evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length).map(el=>({text:el.textContent,font:getComputedStyle(el).fontSize,weight:getComputedStyle(el).fontWeight}))),empty:state==='empty'?await page.locator('main .ui-module-empty').first().evaluate(measure):null};
   if(record.primaryLabel.weight!=='500')failures.push(mode+' same-level primary label weight '+record.primaryLabel.weight);
   await page.evaluate(()=>scrollTo(0,0));if(out)await page.screenshot({path:`${out}/cross-${engine}-${width}-${state}-${mode}-closed.png`,fullPage:true});
   const closedHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
   if(mode==='review'){assert.equal(await page.locator('main summary, main button[aria-expanded]:not([data-space-filter-trigger])').count(),0,'Review has no invented secondary disclosure');record.secondary=null}
   else {
    const control=secondaryFor(page,mode);await control.waitFor();
    const collapsed=await control.evaluate(el=>el.tagName==='SUMMARY'?!el.parentElement.open:el.getAttribute('aria-expanded')==='false');assert.equal(collapsed,true);
    const style=await control.evaluate(measure);const extra=await control.evaluate(el=>{const svg=el.querySelector('svg'),r=svg.getBoundingClientRect(),s=getComputedStyle(svg),label=el.querySelector('span').getBoundingClientRect(),container=el.parentElement,previous=container.previousElementSibling;return {labelX:label.x,labelY:label.y,labelInset:label.x-el.getBoundingClientRect().x,iconRightInset:el.getBoundingClientRect().right-r.right,iconYOffset:r.y-el.getBoundingClientRect().y,iconX:r.x,iconY:r.y,iconWidth:r.width,iconHeight:r.height,iconColor:s.color,iconTransform:s.transform,gapBefore:previous?container.getBoundingClientRect().top-previous.getBoundingClientRect().bottom:null,text:el.innerText}});
    record.secondary={...style,...extra};assert.equal(extra.text,`${mode==='important'?'历史重要日':'已完成'} · ${state==='empty'?0:1}`,'real rendered secondary count and business label');reference??=record.secondary;
    for(const key of ['font','weight','color','padding','border','bg','radius','shadow','lineHeight','height','width','x','iconWidth','iconHeight','iconColor','gapBefore','labelInset','iconRightInset','iconYOffset'])if(record.secondary[key]!==reference[key])failures.push(`${state} ${mode} ${key}: ${record.secondary[key]} vs Task ${reference[key]}`);
    await control.tap();assert.equal(await control.evaluate(el=>el.tagName==='SUMMARY'?el.parentElement.open:el.getAttribute('aria-expanded')==='true'),true);
    const content=control.locator('..').locator(':scope > div').last();await content.waitFor();assert.ok(await content.isVisible());record.expanded={control:await control.evaluate(measure),content:await content.evaluate(measure),text:await content.innerText()};
    if(state==='empty'){const expected={tasks:'暂无已完成任务',lists:'暂无已完成的清单',important:'暂无历史重要日'};assert.ok(record.expanded.text.includes(expected[mode]));assert.equal(await content.locator('button').count(),0)}else{assert.ok(await content.locator('button').count()>0,'real secondary rows retain actions');assert.ok(record.expanded.text.length>0)}
    for(const key of ['x','width','height','font','weight','color','padding','border','bg','radius'])assert.equal(record.expanded.control[key],style[key],mode+' disclosure layout stable when expanded '+key);
    const gap=record.expanded.content.y-record.expanded.control.y-record.expanded.control.height;if(gap!==12)failures.push(mode+' expanded content gap '+gap);
    await page.evaluate(()=>scrollTo(0,0));if(out)await page.screenshot({path:`${out}/cross-${engine}-${width}-${state}-${mode}-open.png`,fullPage:true});
    await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));record.expanded.bottom={lastContentBottom:await content.evaluate(el=>el.getBoundingClientRect().bottom),navTop:(await page.getByRole('navigation',{name:'一级导航'}).boundingBox()).y};assert.ok(record.expanded.bottom.lastContentBottom<=record.expanded.bottom.navTop,'expanded content bottom clears navigation');if(out)await page.screenshot({path:`${out}/cross-${engine}-${width}-${state}-${mode}-open-bottom.png`});
    await control.click();assert.equal(await control.evaluate(el=>el.tagName==='SUMMARY'?!el.parentElement.open:el.getAttribute('aria-expanded')==='false'),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),closedHeight,'collapse restores document height');
    await control.focus();await page.keyboard.press('Enter');assert.equal(await control.evaluate(el=>el.tagName==='SUMMARY'?el.parentElement.open:el.getAttribute('aria-expanded')==='true'),true);await page.keyboard.press('Space');assert.equal(await control.evaluate(el=>el.tagName==='SUMMARY'?!el.parentElement.open:el.getAttribute('aria-expanded')==='false'),true);assert.equal(await control.evaluate(el=>el===document.activeElement),true,'native keyboard focus retained');
   }
   await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));record.bottom={scrollY:await page.evaluate(()=>scrollY),bodyWidth:await page.evaluate(()=>document.documentElement.scrollWidth),nav:await page.getByRole('navigation',{name:'一级导航'}).boundingBox()};assert.ok(record.bottom.bodyWidth<=width);if(out)await page.screenshot({path:`${out}/cross-${engine}-${width}-${state}-${mode}-bottom.png`});
   crossReview.push(record);assert.deepEqual(page.errors,[]);
  }finally{await page.close()}}
 }
 assert.deepEqual(failures,[],'actual geometry/style comparison against Task reference');
});

const emptyText={tasks:'暂无待完成任务',review:'暂无回顾',lists:'暂无清单',important:'暂无重要日'};
for(const engine of ['WebKit','Chrome'])test(`${engine}: normal empty results are equivalent lightweight text; errors/loading stay distinct`,async()=>{
 let reference;
 for(const mode of modes){const page=await pageFor(engine,mode,'empty');try{
  const empty=page.getByText(emptyText[mode],{exact:true});await empty.waitFor();
  const style=await empty.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {font:s.fontSize,weight:s.fontWeight,color:s.color,align:s.textAlign,bg:s.backgroundColor,border:s.borderWidth,radius:s.borderRadius,padding:s.padding,y:r.y,height:r.height,icons:el.querySelectorAll('svg').length,buttons:el.querySelectorAll('button').length}});
  assert.equal(style.align,'center');assert.equal(style.bg,'rgba(0, 0, 0, 0)');assert.equal(style.border,'0px');assert.equal(style.icons,0);assert.equal(style.buttons,0);assert.equal(style.font,'14px');assert.equal(style.weight,'400');assert.ok(style.height<=100);
  reference??=style;assert.deepEqual(style,reference,mode+' actual empty rendering matches');measurements.push({engine,mode,state:'empty',width:375,...style});
  if(out)await page.screenshot({path:`${out}/${engine}-${mode}-empty-375.png`,fullPage:true});assert.deepEqual(page.errors,[]);
  if(mode==='important'){
   await page.getByRole('button',{name:'历史重要日 · 0',exact:true}).click();
   const historical=await page.getByText('暂无历史重要日',{exact:true}).evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {font:s.fontSize,weight:s.fontWeight,color:s.color,align:s.textAlign,bg:s.backgroundColor,border:s.borderWidth,padding:s.padding,height:r.height}});
   for(const key of Object.keys(historical))assert.equal(historical[key],style[key],'historical important-date empty '+key);
  }
 }finally{await page.close()}
 for(const state of ['loading','error']){const alternate=await pageFor(engine,mode,state);try{await alternate.locator(state==='error'?'[role="alert"]':'[role="status"]').first().waitFor();assert.equal(await alternate.getByText(emptyText[mode],{exact:true}).count(),0);assert.deepEqual(alternate.errors,[])}finally{await alternate.close()}}
 }
});
for(const engine of ['WebKit','Chrome'])test(`${engine}: Hub concise ready values, compact entries and actual navigation preserve data-state semantics`,async()=>{
 const page=await pageFor(engine,'hub','empty');try{
  await page.locator('[data-overview-state="ready"]').first().waitFor();
  for(const key of ['review','importantDates'])assert.equal(await page.locator(`[data-overview-metric="${key}"] .ui-module-metric-value`).innerText(),'暂无');
  assert.equal(await page.locator('[data-overview-metric="tasks"] .ui-module-metric-value').innerText(),'0 项');assert.equal(await page.locator('[data-overview-metric="lists"] .ui-module-metric-value').innerText(),'0 个');assert.ok(await page.getByText('我的小天地',{exact:true}).isVisible());
  for(const [title,target] of [['任务','tasks'],['回顾','review'],['清单','lists'],['重要日','important']]){const button=page.getByRole('button',{name:'进入'+title,exact:true});assert.equal((await button.innerText()).trim(),title);const box=await button.boundingBox();assert.ok(box.height>=44&&box.height<=68);await button.tap();assert.equal(await page.evaluate(()=>window.audit.navigations.at(-1)),target)}
  measurements.push({engine,mode:'hub',state:'empty',width:375,entries:await page.getByRole('navigation',{name:'功能模块',exact:true}).getByRole('button').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {text:el.innerText,y:r.y,height:r.height}}))});if(out)await page.screenshot({path:`${out}/${engine}-hub-empty-375.png`,fullPage:true});assert.deepEqual(page.errors,[]);
 }finally{await page.close()}
 for(const state of ['loading','error']){const alternate=await pageFor(engine,'hub',state);try{await alternate.locator('[data-overview-metric]').first().waitFor();assert.equal(await alternate.getByText('暂无',{exact:true}).count(),0);assert.ok(await alternate.getByText(state==='error'?'读取失败':'加载中…',{exact:true}).count()>0);assert.deepEqual(alternate.errors,[])}finally{await alternate.close()}}
});
async function assertInside(page,dialog,label){assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,label)}
for(const engine of ['WebKit','Chrome'])test(`${engine}: real Review create/date and Notification dialogs contain keyboard focus, cancel safely and restore trigger`,async()=>{
 for(const [mode,label,cancel] of [['review','新建回顾','取消'],['review-detail','更正回顾日期','取消'],['me','此设备通知设置','关闭通知设置']]){
  const page=await pageFor(engine,mode);try{
   const trigger=page.getByRole('button',{name:label,exact:true});await trigger.waitFor();await page.waitForFunction(label=>!([...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent)===label)?.disabled),label);await trigger.focus();await trigger.click();const dialog=page.getByRole('dialog');await dialog.waitFor();await page.waitForFunction(()=>document.querySelector('[role="dialog"]')?.contains(document.activeElement));
   const trace=[];
   for(const key of ['Tab','Shift+Tab','Shift+Tab','Tab','Tab','Tab','Tab','Tab']){const before=await page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id,text:document.activeElement.textContent?.slice(0,100)}));await page.keyboard.press(key);trace.push({key,before,active:await page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id,label:document.activeElement.getAttribute('aria-label'),text:document.activeElement.textContent?.slice(0,100)}))});if(out)await writeFile(`${out}/${engine}-${mode}-focus.json`,JSON.stringify(trace,null,2));await assertInside(page,dialog,key+' remains inside '+label+' '+JSON.stringify(trace.at(-1)))}
   await dialog.evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true})));assert.ok(await dialog.isVisible(),'IME Escape must not cancel');
   if(out){await page.screenshot({path:`${out}/${engine}-${mode}-dialog-375.png`,fullPage:true});await writeFile(`${out}/${engine}-${mode}-focus.json`,JSON.stringify(trace,null,2))}
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.waitForFunction(label=>[...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||b.textContent)===label&&b===document.activeElement),label);
   await trigger.click();await dialog.waitFor();await dialog.getByRole('button',{name:cancel,exact:true}).click();await dialog.waitFor({state:'hidden'});await page.waitForFunction(label=>[...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||b.textContent)===label&&b===document.activeElement),label);
   assert.deepEqual(page.errors,[]);
  }finally{await page.close()}
 }
});
for(const engine of ['WebKit','Chrome'])test(`${engine}: pending Review create/date submissions ignore Escape/outside and recover after backend failure`,async()=>{
 for(const [mode,label,submit] of [['review','新建回顾','确认创建'],['review-detail','更正回顾日期','保存日期']]){
 const page=await pageFor(engine,mode);try{
  const trigger=page.getByRole('button',{name:label,exact:true});await trigger.waitFor();await page.waitForFunction(label=>![...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label)?.disabled,label);await trigger.click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  const count=await page.evaluate(()=>{window.audit.holdRpc=true;return window.audit.rpcCalls.length});await dialog.getByRole('button',{name:submit,exact:true}).click();await page.waitForFunction(count=>window.audit.rpcCalls.length===count+1,count);await page.keyboard.press('Escape');assert.ok(await dialog.isVisible());await dialog.click({position:{x:1,y:1}});assert.ok(await dialog.isVisible());await page.keyboard.press('Tab');await assertInside(page,dialog,'busy focus retained');assert.equal(await page.evaluate(()=>window.audit.rpcCalls.length),count+1);
  await page.evaluate(()=>window.audit.releaseRpc());await dialog.getByRole('alert').waitFor();await dialog.getByRole('button',{name:'取消',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.deepEqual(page.errors,[]);
 }finally{await page.close()}
 }
});
for(const engine of ['WebKit','Chrome'])test(`${engine}: actual Auth form keeps OTP sanitization, errors, cooldown and UI v2 visual tokens`,async()=>{
 const page=await pageFor(engine,'login');try{
  const email=page.getByLabel('邮箱',{exact:true});await email.waitFor();await email.fill('fixture@example.test');
  const visual=await page.locator('main').evaluate(el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor,font:s.fontFamily}});
  const reference=await pageFor(engine,'tasks');try{await reference.locator('main h1').waitFor();assert.deepEqual(visual,await reference.locator('main').evaluate(el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor,font:s.fontFamily}}))}finally{await reference.close()}
  const brand=page.locator('main h1').locator('..').locator('..').locator('svg').locator('..');
  const send=page.getByRole('button',{name:'发送验证码',exact:true});
  const colors=await send.evaluate((button)=>{const rgb=value=>value.match(/\d+/g).slice(0,3).map(Number);const lum=channels=>channels.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);const s=getComputedStyle(button),root=getComputedStyle(document.documentElement);return {bg:s.backgroundColor,color:s.color,soft:`rgb(${root.getPropertyValue('--ui-color-accent-soft').trim().split(/\s+/).join(', ')})`,accent:`rgb(${root.getPropertyValue('--ui-color-accent').trim().split(/\s+/).join(', ')})`,contrast:(lum(rgb(s.backgroundColor))+.05)/(lum(rgb(s.color))+.05)}});
  if(out)await page.screenshot({path:`${out}/${engine}-login-375.png`,fullPage:true});
  assert.equal(colors.bg,colors.soft,'existing UI v2 soft accent instead of dark solid fill');assert.equal(colors.color,colors.accent);assert.ok(colors.contrast>=4.5,'legible primary button text');assert.deepEqual(await brand.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color]}),[colors.bg,colors.color]);assert.equal(await page.getByText('两个人的小日程本',{exact:true}).count(),0);assert.ok(await page.getByRole('heading',{name:'共享日历',exact:true}).isVisible());
  measurements.push({engine,mode:'login',colors});
  const accentReference=await pageFor(engine,'me');try{await accentReference.getByRole('button',{name:'此设备通知设置',exact:true}).click();const icon=accentReference.getByRole('dialog').locator('svg').first().locator('..');assert.deepEqual(await icon.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color]}),[colors.bg,colors.color],'matches actual existing UI v2 notification icon')}finally{await accentReference.close()}
  await page.getByRole('button',{name:'发送验证码',exact:true}).click();const otp=page.getByLabel('8 位验证码',{exact:true});await otp.waitFor();assert.deepEqual(await page.getByRole('button',{name:'验证并登录',exact:true}).evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color]}),[colors.bg,colors.color]);await page.waitForFunction(()=>document.activeElement?.id==='otp');assert.equal(await page.evaluate(()=>window.audit.authCalls[0].input.email),'fixture@example.test');await otp.fill('12ab3456');assert.equal(await otp.inputValue(),'123456');assert.equal(await page.getByRole('button',{name:'验证并登录',exact:true}).isDisabled(),true);await otp.fill('12345678');await page.getByRole('button',{name:'验证并登录',exact:true}).click();await page.getByText('模拟验证码错误',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.audit.authCalls[1].input.type),'email');assert.equal(await page.getByRole('button',{name:/秒后可重发/}).isDisabled(),true);
  if(out)await page.screenshot({path:`${out}/${engine}-otp-375.png`,fullPage:true});await page.getByRole('button',{name:'修改邮箱',exact:true}).click();await email.waitFor();assert.equal(await email.inputValue(),'fixture@example.test');assert.deepEqual(page.errors,[]);
 }finally{await page.close()}
});
for(const engine of ['WebKit','Chrome'])test(`${engine}: notification visual tokens and sign-out decoration keep existing actions`,async()=>{
 const page=await pageFor(engine,'me');try{
  const logout=page.getByRole('button',{name:'退出登录',exact:true});await logout.waitFor();assert.equal(await logout.locator('svg').count(),1,'keep logout icon and remove navigation chevron only');
  await page.getByRole('button',{name:'此设备通知设置',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  const visual=await dialog.evaluate(el=>{const panel=el.querySelector('section'),s=getComputedStyle(panel),root=getComputedStyle(document.documentElement);return {bg:s.backgroundColor,font:s.fontFamily,radius:s.borderRadius,shadow:s.boxShadow,page:root.getPropertyValue('--ui-color-page').trim(),surface:root.getPropertyValue('--ui-color-surface').trim(),title:getComputedStyle(el.querySelector('h2')).fontSize}});
  assert.equal(visual.title,'18px');assert.equal(visual.bg,`rgb(${visual.page.split(/\s+/).join(', ')})`);if(out)measurements.push({engine,notification:visual});assert.deepEqual(page.errors,[]);
 }finally{await page.close()}
});
test('WebKit 430px and Chrome desktop: complete populated/empty pages and short dialogs stay within viewport',async()=>{
 for(const [engine,width] of [['WebKit',430],['Chrome',1280]])for(const mode of ['tasks','lists','review','important','hub','login','me']){
  const state=['tasks','lists','review','important','hub'].includes(mode)?'empty':'populated';const page=await pageFor(engine,mode,state,width);try{
   await page.locator('main').waitFor();if(modes.includes(mode))await page.getByText(emptyText[mode],{exact:true}).waitFor();if(mode==='login')await page.getByLabel('邮箱',{exact:true}).waitFor();
   if(mode==='me'){await page.getByRole('button',{name:'此设备通知设置',exact:true}).click();await page.getByRole('dialog').waitFor()}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(out)await page.screenshot({path:`${out}/${engine}-${mode}-${state}-${width}.png`,fullPage:true});assert.deepEqual(page.errors,[]);
  }finally{await page.close()}
 }
});
