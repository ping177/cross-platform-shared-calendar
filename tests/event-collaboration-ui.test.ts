import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { createServer } from 'vite';

const nodes=(t:any):any[]=>React.isValidElement(t)?[t,...React.Children.toArray((t.props as any).children).flatMap(nodes)]:[];
const text=(t:any):string=>React.isValidElement(t)?React.Children.toArray((t.props as any).children).map(text).join(''):typeof t==='string'?t:'';
async function runtime(run:(e:any)=>Promise<void>, recurring=false) {
  let cursor=0;const slots:any[]=[];
  const event:any={id:'e',space_id:'s',scope:'personal',owner_user_id:'a',created_by:'a',title:'A event',description:null,starts_at:'2030-01-01T10:00:00Z',ends_at:null,all_day:false,reminder_kind:null,time_zone:'UTC',recurrence_rule:recurring?{version:1,frequency:'daily',interval:1,time_zone:'UTC'}:null,series_id:recurring?'e':null,parent_event_id:null,updated_at:'version'};
  const m:any={calls:[],error:null,result:event,deleted:[{id:'e'}],closed:0,saved:0,
    useState(initial:any){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],(v:any)=>{slots[i]=typeof v==='function'?v(slots[i]):v}];},
    useRef(v:any){return slots[cursor++]??={current:v}},useEffect(){cursor++},useMemo(fn:any){cursor++;return fn()},useCallback(fn:any){cursor++;return fn},
    async rpc(name:string,args:any){m.calls.push([name,args]);if(m.wait)await m.wait;return {data:m.result,error:m.error}},
    from(name:string){return {delete(){const c:any={eq(k:string,v:any){m.calls.push(['eq',k,v]);return c},async select(){m.calls.push(['delete',name]);if(m.wait)await m.wait;return {data:m.deleted,error:m.error}}};return c}}},
  };
  (globalThis as any).__eventCollab=m;
  const vite=await createServer({configFile:false,envFile:false,logLevel:'silent',appType:'custom',ssr:{noExternal:[/^react$/],external:['react/jsx-runtime','react/jsx-dev-runtime']},server:{middlewareMode:true,hmr:false},plugins:[{
    name:'event-collab-fixture',enforce:'pre',
    resolveId(id,importer){if(id==='react'&&(importer?.includes('/components/')||importer?.endsWith('/App.tsx')))return '\0collab-hooks';if(/\/supabase(?:\.ts)?$/.test(id))return '\0collab-db'},
    load(id){if(id==='\0collab-hooks')return 'export const {useState,useRef,useEffect,useMemo,useCallback}=globalThis.__eventCollab;';if(id==='\0collab-db')return 'const m=globalThis.__eventCollab;export const supabase={rpc:(...args)=>m.rpc(...args),from:(...args)=>m.from(...args)};'}
  }]} as any);
  try {
    const {EventSheet}=await vite.ssrLoadModule('/src/App.tsx');
    const props:any={space:{id:'s',kind:'shared',created_by:'a',name:'Shared'},userId:'b',partnerId:'a',members:[{space_id:'s',user_id:'a'},{space_id:'s',user_id:'b'}],
      target:recurring?{kind:'occurrence',event,occurrence:{occurrence_date:'2030-01-01',title:'A event',description:null,occurrence_starts_at:event.starts_at,occurrence_ends_at:null,all_day:false}}:{kind:'event',event},
      onClose:()=>m.closed++,onSaved:()=>m.saved++,validateCreateTarget:async()=>true};
    const render=()=>{cursor=0;return EventSheet(props)};
    const find=(label:string)=>nodes(render()).find(n=>n.type==='button'&&text(n)===label);
    const save=()=>nodes(render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
    await run({m,props,event,render,find,save});
  } finally {await vite.close();delete (globalThis as any).__eventCollab}
}
test('B edits A-assigned event, changes final audience and sends one CAS save with draft retained on failure',()=>runtime(async e=>{
  assert.ok(e.find('保存'));assert.equal(e.find('我')?.props.disabled??false,false);
  // Labels use real member names/fallbacks; the first three-button group is the audience control.
  const group=nodes(e.render()).find(n=>n.props.className==='grid grid-cols-3 gap-2');
  const mine=React.Children.toArray(group.props.children)[0] as any;assert.equal(mine.props.disabled,false);mine.props.onClick();
  nodes(e.render()).find(n=>n.type==='input'&&n.props.type===undefined).props.onChange({target:{value:'B changed'}});
  let release!:()=>void;e.m.wait=new Promise<void>(r=>release=r);e.m.error=new Error('concurrent membership change');
  const first=e.save();await e.save();assert.equal(e.m.calls.length,1);release();await first;
  assert.equal(e.m.closed,0);assert.equal(nodes(e.render()).find(n=>n.type==='input'&&n.props.type===undefined).props.value,'B changed');
  e.m.wait=null;e.m.error=null;await e.save();
  const [name,args]=e.m.calls.at(-1);assert.equal(name,'save_event_edit');assert.equal(args.p_owner_user_id,'b');assert.equal(args.p_content.title,'B changed');assert.equal(args.p_expected_updated_at,'version');assert.equal(e.m.saved,1);
}));
test('delete requires confirmation, pins Space and version, rejects zero-row result',()=>runtime(async e=>{
  nodes(e.render()).find(n=>n.type==='button'&&n.props['aria-label']==='删除日程').props.onClick();assert.equal(e.m.calls.length,0);
  e.m.deleted=[];await e.find('删除').props.onClick();assert.equal(e.m.closed,0);
  assert.ok(e.m.calls.some((c:any)=>c[0]==='eq'&&c[1]==='space_id'&&c[2]==='s'));
  assert.ok(e.m.calls.some((c:any)=>c[0]==='eq'&&c[1]==='updated_at'&&c[2]==='version'));
  e.m.deleted=[{id:'e'}];await e.find('删除').props.onClick();assert.equal(e.m.closed,1);
}));
test('occurrence retains content scope chooser and explicit whole-series audience semantics',()=>runtime(async e=>{
  assert.ok(text(e.render()).includes('归属修改对整个重复系列生效'));
  const group=nodes(e.render()).find(n=>n.props.className==='grid grid-cols-3 gap-2');
  (React.Children.toArray(group.props.children)[2] as any).props.onClick();
  await e.save();
  const chooser=nodes(e.render()).find(n=>n.type?.name==='OccurrenceActionChooser');
  assert.ok(chooser);await chooser.props.onSelect('only-this');
  assert.equal(e.m.calls[0][0],'save_event_edit');assert.equal(e.m.calls[0][1].p_edit_mode,'only-this');
  assert.equal(e.m.calls[0][1].p_scope,'shared');assert.equal(e.m.calls[0][1].p_occurrence_date,'2030-01-01');
},true));

test('recurring save rejects an empty RPC response and retains the editor',()=>runtime(async e=>{
  await e.save();
  e.m.result=[];
  const chooser=nodes(e.render()).find(n=>n.type?.name==='OccurrenceActionChooser');
  await chooser.props.onSelect('only-this');
  assert.equal(e.m.closed,0);
  assert.ok(e.find('保存'));
},true));
