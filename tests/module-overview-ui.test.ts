import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
const elements = (node: any): any[] => React.isValidElement(node) ? [node, ...React.Children.toArray(node.props.children).flatMap(elements)] : [];
const noop = () => {};
const ready = { tasks:{state:'ready',value:5},lists:{state:'ready',value:2},review:{state:'ready',value:{date:'2026-10-10',spaceId:'p',spaceName:'我的空间'}},importantDates:{state:'ready',value:{name:'家庭纪念日',date:'2026-10-12',spaceId:'s'}} };
test('real Hub shows approved metrics and ordered original callbacks, while disabled modules have no entry', async()=>{
 const vite=await createServer({configFile:false,envFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false}});
 try {
  const {ModuleHubContent}=await vite.ssrLoadModule('/src/components/ModuleHub.tsx');const calls:string[]=[];
  const props={loading:false,tasksAvailable:true,reviewAvailable:true,listsAvailable:true,importantDatesAvailable:true,tasksError:false,reviewError:false,listsError:false,
   onOpenTasks:()=>calls.push('tasks'),onOpenReview:()=>calls.push('review'),onOpenLists:()=>calls.push('lists'),onOpenImportantDates:()=>calls.push('importantDates'),
   onRetryTasks:noop,onRetryReview:noop,onRetryLists:noop,overview:ready};
  const tree=ModuleHubContent(props);const buttons=elements(tree).filter(n=>n.props['aria-label']?.startsWith('进入'));
  assert.deepEqual(buttons.map(n=>n.props['aria-label']),['进入任务','进入回顾','进入清单','进入重要日']);
  buttons.forEach(n=>n.props.onClick());assert.deepEqual(calls,['tasks','review','lists','importantDates']);
  const html=renderToStaticMarkup(tree);assert.match(html,/未完成任务.*5 项/);assert.match(html,/清单总数.*2 个/);assert.match(html,/最近回顾.*2026-10-10.*我的空间/);assert.match(html,/家庭纪念日.*2026-10-12/);
  assert.doesNotMatch(html,/已完成回顾|下次回顾|今日 \d|最近生日|bg-teal|bg-ui-accent-soft/);
  const partial=renderToStaticMarkup(ModuleHubContent({...props,listsAvailable:false}));
  assert.doesNotMatch(partial,/进入清单/);assert.match(partial,/data-overview-metric="lists" data-overview-state="unavailable"/);
  const empty=renderToStaticMarkup(ModuleHubContent({...props,overview:{...ready,tasks:{state:'ready',value:0},lists:{state:'ready',value:0},review:{state:'ready',value:{...ready.review.value,date:null}},importantDates:{state:'ready',value:null}}}));
  assert.match(empty,/0 项/);assert.match(empty,/0 个/);assert.match(empty,/暂无回顾记录/);assert.match(empty,/暂无未来重要日/);
  const pending=renderToStaticMarkup(ModuleHubContent({...props,loading:true}));assert.equal((pending.match(/data-overview-state="loading"/g)||[]).length,4);assert.doesNotMatch(pending,/进入任务|5 项/);
  const error=renderToStaticMarkup(ModuleHubContent({...props,overview:{...ready,lists:{state:'error'}},onRetryOverview:noop}));assert.match(error,/读取失败/);assert.match(error,/重试概览/);assert.doesNotMatch(error,/2 个/);
 } finally {await vite.close();}
});

async function runtime(run:(e:any)=>Promise<void>) {
 const previous={window:globalThis.window,document:globalThis.document};const slots:any[]=[];const effects:any[]=[];const cleanups=new Map();let cursor=0;
 const listeners=new Map<string,Set<any>>();const intervals=new Set<any>();const reads:any[]=[];const results:any[]=[];
 const m:any={
  useRef(v:any){const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i];},
  useState(v:any){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return [slots[i],(next:any)=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
  useEffect(fn:any,deps:any[]){const i=cursor++;const old=slots[i];if(!old||deps.some((d,j)=>!Object.is(d,old[j]))){slots[i]=deps;effects.push({i,fn});}},
  read(scope:any){reads.push(scope);return new Promise((resolve,reject)=>results.push({resolve,reject}));}
 };
 (globalThis as any).__overview=m;
 const surface:any={visibilityState:'visible',addEventListener(k:string,fn:any){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k)!.add(fn);},removeEventListener(k:string,fn:any){listeners.get(k)?.delete(fn);},setInterval(fn:any){intervals.add(fn);return fn;},clearInterval(fn:any){intervals.delete(fn);}};
 (globalThis as any).window=surface;(globalThis as any).document=surface;
 const vite=await createServer({configFile:false,envFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/^react$/]},plugins:[{
  name:'overview-runtime',enforce:'pre',
  resolveId(id,importer){if(id.endsWith('/supabase')||id.endsWith('/supabase.ts'))return '\\0overview-client';if(id==='react'&&importer?.endsWith('/useModuleOverview.ts'))return '\0overview-react';},
  load(id){if(id.endsWith('overview-client'))return 'export const supabase={auth:{getUser(){throw new Error("unexpected business I/O");}}};';if(id==='\0overview-react')return 'const m=globalThis.__overview;export const useState=m.useState,useEffect=m.useEffect,useRef=m.useRef;';},
  transform(code,id){if(id.endsWith('/useModuleOverview.ts'))return code.replace('loadModuleOverview(scope!)','globalThis.__overview.read(scope!)');}
 }]});
 try {
  const {useModuleOverview,overviewFreshnessMs}=await vite.ssrLoadModule('/src/components/useModuleOverview.ts');
  const scope:any={userId:'me',spaces:[{id:'p',membershipRole:'owner',kind:'personal'}],availability:{tasksIds:['p'],reviewIds:['p'],listsIds:['p'],importantDatesIds:['p'],tasksError:false,reviewError:false,listsError:false,importantDatesError:false},reviewSpaceId:'p'};
  let pending=false;const render=()=>{cursor=0;return useModuleOverview(scope,pending);};
  const pump=async()=>{let out=render();for(const {i,fn}of effects.splice(0)){cleanups.get(i)?.();const cleanup=fn();if(cleanup)cleanups.set(i,cleanup);}await new Promise(r=>setImmediate(r));return render();};
  const unmount=()=>{for(const fn of cleanups.values())fn();cleanups.clear();slots.length=0;effects.length=0;};
  await run({scope,reads,results,render,pump,unmount,intervals,overviewFreshnessMs,setPending(v:boolean){pending=v;},setVisible(v:boolean){surface.visibilityState=v?'visible':'hidden';},dispatch(k:string){for(const fn of listeners.get(k)||[])fn();},strictReplay(){for(const fn of cleanups.values())fn();for(let i=0;i<slots.length;i++)if(Array.isArray(slots[i]))slots[i]=undefined;}});
  unmount();
 }finally{await vite.close();(globalThis as any).window=previous.window;(globalThis as any).document=previous.document;delete(globalThis as any).__overview;}
}
test('Hook deduplicates foreground reads, refreshes return, clears stale scope and rejects late results',()=>runtime(async e=>{
 let out=await e.pump();assert.equal(out.data.tasks.state,'loading');assert.equal(e.reads.length,1);
 e.dispatch('focus');e.dispatch('online');assert.equal(e.reads.length,1);
 e.results[0].resolve(ready);out=await e.pump();assert.equal(out.data.tasks.value,5);
 e.scope.availability={...e.scope.availability,tasksIds:[]};
 out=e.render();assert.equal(out.data.tasks.state,'loading');out=await e.pump();assert.equal(e.reads.length,2);
 e.scope.userId='other';out=await e.pump();e.results[1].resolve(ready);out=await e.pump();assert.equal(out.data.tasks.state,'loading');
 e.results[2].reject(new Error('offline'));out=await e.pump();assert.equal(out.data.tasks.state,'error');assert.equal('value' in out.data.tasks,false);
 e.unmount();out=await e.pump();assert.equal(e.reads.length,4);assert.equal(out.data.tasks.state,'loading');
}));
test('Hook retries after failure, respects expiry/hidden/pending and StrictMode replay',()=>runtime(async e=>{
 await e.pump();e.strictReplay();await e.pump();assert.equal(e.reads.length,2);
 e.results[0].resolve(ready);let out=await e.pump();assert.equal(out.data.tasks.state,'loading');
 e.results[1].resolve(ready);out=await e.pump();assert.equal(out.data.tasks.value,5);
 const originalNow=Date.now;Date.now=()=>originalNow()+e.overviewFreshnessMs+10;
 try{e.setVisible(false);for(const fn of e.intervals)fn();assert.equal(e.reads.length,2);e.setVisible(true);for(const fn of e.intervals)fn();assert.equal(e.reads.length,3);}finally{Date.now=originalNow;}
 e.results[2].reject(new Error('offline'));out=await e.pump();assert.equal(out.data.tasks.state,'error');
 out.retry();await e.pump();assert.equal(e.reads.length,4);
 e.setPending(true);out=await e.pump();assert.equal(out.data.tasks.state,'loading');
 e.results[3].resolve(ready);out=await e.pump();assert.equal(out.data.tasks.state,'loading');
 e.setPending(false);await e.pump();assert.equal(e.reads.length,5);
}));

test('existing eligibility foreground refresh coordinates one source reread after validation',()=>runtime(async e=>{
 await e.pump();e.results[0].resolve(ready);let out=await e.pump();
 e.setPending(true);out=await e.pump();assert.equal(out.data.tasks.state,'loading');
 e.dispatch('focus');e.dispatch('online');assert.equal(e.reads.length,1);
 e.setPending(false);await e.pump();assert.equal(e.reads.length,2);
 e.results[1].resolve({...ready,tasks:{state:'ready',value:8}});out=await e.pump();assert.equal(out.data.tasks.value,8);
}));
