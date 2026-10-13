import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { createServer } from 'vite';

const members = [{user_id:'a',role:'owner',space_id:'s',profiles:{display_name:'A'}},{user_id:'b',role:'member',space_id:'s',profiles:{display_name:'B'}}];
const task = {id:'t',space_id:'s',created_by:'a',title:'Old',assigned_to_user_id:null,due_on:'2026-10-06',status:'open',
  reminder_kind:null,time_zone:null,reminder_schedule_changed_at:'2000-01-01T00:00:00.123456Z',created_at:'2000',updated_at:'2000'};
const elements=(node:any):any[] => React.isValidElement(node)?[node,...React.Children.toArray((node.props as any).children).flatMap(elements)]:[];
const text=(node:any):string => React.isValidElement(node)?React.Children.toArray((node.props as any).children).map(text).join(''):typeof node==='string'?node:'';
async function ui(run:(env:any)=>Promise<void>) {
  let cursor=0; const slots:any[]=[]; const writes:any[]=[]; let saved=0, closed=0, resultError:any=null;
  const m:any = {
    useState(initial:any) { const i=cursor++; if(!(i in slots)) slots[i]=typeof initial==='function'?initial():initial;
      return [slots[i],(value:any)=>{slots[i]=typeof value==='function'?value(slots[i]):value;}]; },
    useRef(initial:any) {return slots[cursor++]??={current:initial};}, useEffect() {},
    supabase:{from(table:string) {assert.equal(table,'tasks'); const q:any={insert(value:any){writes.push(['insert',value]);return q;},
      update(value:any){writes.push(['update',value]);return q;},eq(){return q;},select:async()=>({data:resultError?null:[{id:'t'}],error:resultError})};return q;}},
  };
  (globalThis as any).__taskReminderUi=m;
  const vite=await createServer({configFile:false,envFile:false,logLevel:'silent',optimizeDeps:{noDiscovery:true,include:[]},
    ssr:{noExternal:[/^react$/],external:['react/jsx-runtime','react/jsx-dev-runtime']},server:{middlewareMode:true,hmr:false},appType:'custom',plugins:[{
      name:'task-reminder-fixture',enforce:'pre',resolveId(id,importer){
        if(id==='react' && importer?.endsWith('TaskSheet.tsx')) return '\0task-hooks';
        if(/\/supabase(?:\.ts)?$/.test(id)) return '\0task-client';
      },load(id){const prefix='const m=globalThis.__taskReminderUi;';
        if(id==='\0task-hooks') return prefix+'export const {useState,useRef,useEffect}=m;';
        if(id==='\0task-client') return prefix+'export const supabase=m.supabase;';
      },
    }]} as any);
  try {
    const {TaskSheet}=await vite.ssrLoadModule('/src/components/TaskSheet.tsx');
    const props:any={task:null,spaceId:'s',spaceKind:'shared',userId:'a',members,onClose:()=>closed++,onSaved:async()=>{saved++;}};
    const render=()=>{cursor=0;return TaskSheet(props);};
    const field=(id:string)=>elements(render()).find(el=>el.props.id===id);
    const set=(id:string,value:string)=>field(id).props.onChange({target:{value}});
    const title=(value:string)=>elements(render()).find(el=>el.type==='input'&&!el.props.id).props.onChange({target:{value}});
    const save=()=>elements(render()).find(el=>el.type==='form').props.onSubmit({preventDefault(){}});
    await run({props,render,field,set,title,save,writes,saved:()=>saved,closed:()=>closed,fail:(error:any)=>{resultError=error;}});
  } finally {await vite.close();delete (globalThis as any).__taskReminderUi;}
}
test('new due Task defaults same-day, selector has exactly three presets, saved then canonical reread/close',()=>ui(async e=>{
  assert.equal(e.field('task-reminder').props.disabled,true); assert.equal(e.field('task-reminder').props.value,'');
  e.title('New');e.set('task-due-on','2026-10-06');assert.equal(e.field('task-reminder').props.value,'all_day_same_day_08');
  assert.equal(elements(e.field('task-reminder')).filter(el=>el.type==='option').length,3);assert.match(text(e.render()),/当前所有空间成员/);
  await e.save();assert.equal(e.writes[0][1].reminder_kind,'all_day_same_day_08');assert.ok(e.writes[0][1].time_zone);
  assert.equal(e.saved(),1);assert.equal(e.closed(),1);assert.ok(!('reminder_schedule_changed_at' in e.writes[0][1]));
}));
test('new no-due saves off without timezone; historical due edit retains explicit off',()=>ui(async e=>{
  e.title('No due');await e.save();assert.equal(e.writes[0][1].reminder_kind,null);assert.equal(e.writes[0][1].time_zone,null);
}));
test('historical null edit stays off and sends only changed due',()=>ui(async e=>{
  e.props.task=task;assert.equal(e.field('task-reminder').props.value,'');e.set('task-due-on','2026-10-07');await e.save();
  assert.deepEqual(e.writes[0],['update',{due_on:'2026-10-07'}]);
}));
test('saved preset persists; due clear closes reminder; canonical timezone survives device state',()=>ui(async e=>{
  e.props.task={...task,reminder_kind:'all_day_previous_day_20',time_zone:'America/New_York'};
  assert.equal(e.field('task-reminder').props.value,'all_day_previous_day_20');e.set('task-due-on','');await e.save();
  assert.deepEqual(e.writes[0],['update',{due_on:null,reminder_kind:null}]);
}));
test('recipient copy follows Personal, assigned Shared and unassigned Shared draft',()=>ui(async e=>{
  e.set('task-due-on','2026-10-06');assert.match(text(e.render()),/当前所有空间成员/);
  elements(e.render()).find(el=>el.type==='select'&&!el.props.id).props.onChange({target:{value:'b'}});assert.match(text(e.render()),/任务负责人/);
  e.props.spaceKind='personal';assert.match(text(e.render()),/提醒自己/);
}));
test('failed timezone capture prevents writes, reread and close',()=>ui(async e=>{
  e.title('Invalid zone');e.set('task-due-on','2026-10-06');const original=Intl.DateTimeFormat;
  Intl.DateTimeFormat=function(...args:any[]) {if(args.length===0) return {resolvedOptions:()=>({timeZone:'bad-zone'})};return new (original as any)(...args);} as any;
  try {await e.save();} finally {Intl.DateTimeFormat=original;}
  assert.equal(e.writes.length,0);assert.equal(e.saved(),0);assert.equal(e.closed(),0);assert.match(text(e.render()),/时区/);
}));

const button=(e:any,label:string)=>elements(e.render()).find(el=>el.type==='button'&&(el.props['aria-label']===label||text(el)===label));
test('module task Sheet has one header submit, four Personal fields and no description',()=>ui(async e=>{
 e.props.moduleView=true;e.props.spaceKind='personal';e.props.sourceSpaceLabel='我的空间';
 const tree=e.render();const form=elements(tree).find(el=>el.type==='form');
 const submit=elements(tree).filter(el=>el.type==='button'&&el.props.type==='submit');
 assert.equal(submit.length,1);assert.equal(submit[0].props.form,form.props.id);
 assert.match(text(tree),/保存到/);assert.doesNotMatch(text(tree),/分配给|描述/);
 assert.equal(elements(form).some(el=>el.type==='button'&&el.props.type==='submit'),false);
}));
test('module Sheet dirty close can cancel or discard without losing the draft or writing',()=>ui(async e=>{
 e.props.moduleView=true;e.title('保留的输入');button(e,'关闭任务表单').props.onClick();
 assert.equal(e.closed(),0);assert.match(text(e.render()),/放弃未保存的更改/);
 button(e,'继续编辑').props.onClick();assert.equal(elements(e.render()).find(el=>el.type==='input'&&!el.props.id).props.value,'保留的输入');
 button(e,'关闭任务表单').props.onClick();button(e,'放弃更改').props.onClick();assert.equal(e.closed(),1);assert.equal(e.writes.length,0);
}));
test('module editing suppresses synchronous duplicate submits and closing while the mutation is pending',()=>ui(async e=>{
 e.props.moduleView=true;e.props.task=task;e.title('Updated');
 const finishes:Array<()=>void>=[];e.props.onSaved=()=>new Promise<void>(r=>{finishes.push(r);});
 const submit=elements(e.render()).find(el=>el.type==='form').props.onSubmit;
 const first=submit({preventDefault(){}});const second=submit({preventDefault(){}});await new Promise(r=>setTimeout(r,0));
 assert.equal(e.writes.length,1);button(e,'关闭任务表单').props.onClick();assert.equal(e.closed(),0);
 finishes.forEach(f=>f());await Promise.all([first,second]);assert.equal(e.closed(),1);
}));
test('module failure retains inputs and permits retry without changing reminder semantics',()=>ui(async e=>{
 e.props.moduleView=true;e.props.task=task;e.title('Failed draft');e.set('task-due-on','2026-10-07');e.fail(new Error('保存失败'));
 await e.save();assert.equal(e.closed(),0);assert.match(text(e.render()),/保存失败/);
 assert.equal(elements(e.render()).find(el=>el.type==='input'&&!el.props.id).props.value,'Failed draft');
 e.fail(null);await e.save();assert.equal(e.writes.length,2);assert.equal(e.closed(),1);
 assert.deepEqual(e.writes[1],['update',{title:'Failed draft',due_on:'2026-10-07'}]);
}));
test('module create retains target confirmation and qualification, including synchronous duplicate confirmation protection',()=>ui(async e=>{
 e.props.moduleView=true;e.props.createTarget={spaces:[{id:'s',name:'共享空间',kind:'shared'}],selectedId:'s',enabledIds:['s'],state:'ready',error:'',onSelect(){},onRetry(){}};
 let checks=0;e.props.validateGlobalCreate=async()=>{checks++;};e.title('确认创建');
 await e.save();assert.equal(e.writes.length,0);assert.match(text(e.render()),/确认保存/);
 e.props.createTarget.state='blocked';assert.equal(button(e,'确认保存').props.disabled,true);
 e.props.createTarget.state='ready';const confirm=button(e,'确认保存').props.onClick;
 confirm();confirm();await new Promise(r=>setTimeout(r,0));
 assert.equal(checks,1);assert.equal(e.writes.length,1);assert.equal(e.writes[0][1].space_id,'s');assert.equal(e.saved(),1);assert.equal(e.closed(),1);
}));
test('home/default Sheet mode shares the header form but keeps its original direct close behavior',()=>ui(async e=>{
 e.title('首页输入');assert.equal(elements(e.render()).find(el=>el.type==='form').props.id,'task-sheet-form');
 assert.equal(elements(e.render()).filter(el=>el.type==='button'&&el.props.type==='submit').length,1);
 button(e,'关闭任务表单').props.onClick();assert.equal(e.closed(),1);assert.doesNotMatch(text(e.render()),/放弃未保存/);
}));
