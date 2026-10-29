import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EventSheet} from '../../src/App';
import '../../src/styles.css';
const q = new URLSearchParams(location.search);
const spaces = [{id:'p',kind:'personal',name:'我的空间',created_by:'me'}, {id:'s',kind:'shared',name:'共享空间',created_by:'me'}];
const f = window.eventCreateFixture = {user:'me', allowed:true, scenario:q.get('scenario')||'normal', visible:false, rows:[], calls:[], reads:[], saved:0, closed:0};
f.client = {auth:{getUser:async()=>({data:{user:{id:f.user}},error:null})}, from(table) {
  if(table !== 'events') throw Error('Unexpected table');
  let filters={};
  return {
    async insert(payload) {
      f.calls.push(structuredClone(payload));
      if(f.rows.some(row=>row.id===payload.id)) return {error:{code:'23505'}};
      if(f.scenario==='transport' && f.calls.length===1) throw Error('offline before commit');
      f.rows.push({...structuredClone(payload),parent_event_id:null,series_id:null,recurrence_until:null});
      if(f.scenario==='hold') await new Promise(resolve=>{f.release=resolve});
      if(f.scenario==='collision') f.rows[0].title='different object';
      if(f.scenario==='lost' || f.scenario==='hold' || f.scenario==='collision' || f.scenario==='reconcile') return {error:Error('lost response')};
      return {error:null};
    },
    select(){return this}, eq(key,value){filters[key]=value;return this},
    async maybeSingle(){f.reads.push(filters);return {data:(f.visible||f.scenario==='reconcile'||f.scenario==='collision')?f.rows.find(row=>Object.entries(filters).every(([k,v])=>row[k]===v))||null:null,error:f.readError?Error('not readable'):null}},
  };
}};
function Fixture() {
  const [open,setOpen]=useState(true),[spaceId,setSpaceId]=useState('p'),[user,setUser]=useState('me');
  f.unmount=()=>setOpen(false); f.setSpace=setSpaceId; f.setUser=id=>{f.user=id;setUser(id)};
  const space=spaces.find(s=>s.id===spaceId);
  return <main data-user={user} data-space={spaceId}><p>Synthetic offline EventSheet</p>{open&&<EventSheet target={null} space={space} userId={user} members={[{space_id:spaceId,user_id:user,role:'owner'}]} partnerId={null}
    createTarget={{spaces,selectedId:spaceId,state:'ready',error:'',onSelect:setSpaceId,onRetry(){}}}
    validateCreateTarget={async()=>f.allowed} onSaved={()=>{f.saved++}} onClose={()=>{f.closed++;setOpen(false)}}/>}</main>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);
