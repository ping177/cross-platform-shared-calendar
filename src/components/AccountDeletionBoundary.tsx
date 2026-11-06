import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { accountDeletionEnabled, deletionRequest, receiptStatus } from '../lib/account-deletion-api';
import { clearDeletionPreferences, deletionReceiptEvent, deletionReceiptKey, deletionStatusCopy, receiptAccountBinding, readDeletionReceipt, writeDeletionReceipt, type DeletionProof, type DeletionReceipt, type DeletionStatus } from '../lib/account-deletion';
import { supabase } from '../lib/supabase';
import { unsubscribeCurrentPushSubscription } from '../lib/push-notifications';
function stored() {try{const receipt=readDeletionReceipt(window.localStorage);if(!receipt)window.localStorage.removeItem(deletionReceiptKey);return receipt;}catch{return null;}}
function changed() {window.dispatchEvent(new Event(deletionReceiptEvent));}
export async function submitDeletionFromPage(userId: string, proof: DeletionProof) {
  writeDeletionReceipt(window.localStorage,proof.receipt_token,await receiptAccountBinding(userId));changed(); // Persist before irreversible request; unmount business/export state.
  try { await deletionRequest({action:'confirm',request_id:proof.request_id,confirmation_token:proof.confirmation_token,confirmed:true},userId); }
  finally {changed();} // Unknown response is resolved only by receipt or atomic cancellation.
}
export function AccountDeletionBoundary({session,children,onFinished}:{session:Session|null;children:ReactNode;onFinished:(clearSession:boolean)=>void}) {
  const [receipt,setReceipt]=useState<DeletionReceipt|null>(stored),[status,setStatus]=useState<DeletionStatus|'unknown'>('unknown');
  const [access,setAccess]=useState<{id:string;active:boolean}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[finished,setFinished]=useState(false),[cleanupRetry,setCleanupRetry]=useState(0);
  const cleaning=useRef(false),identity=useRef(session?.user.id);if(session?.user.id)identity.current=session.user.id;
  useEffect(()=>{const reload=()=>{setStatus('unknown');cleaning.current=false;setReceipt(stored());};window.addEventListener(deletionReceiptEvent,reload);window.addEventListener('storage',reload);return()=>{window.removeEventListener(deletionReceiptEvent,reload);window.removeEventListener('storage',reload);};},[]);
  useEffect(()=>{if(!accountDeletionEnabled||receipt||!session)return;let current=true;setAccess(null);void supabase.rpc('current_account_active').then(({data,error:e})=>{if(current){if(e||typeof data!=='boolean')setError('暂时无法核对账号状态，请重试。');else{setError('');setAccess({id:session.user.id,active:data});}}});return()=>{current=false;};},[session?.user.id,session?.access_token,receipt]);
  async function check() {if(!receipt)return;setBusy(true);try{const next=await receiptStatus(receipt.token);setStatus(next);setError('');}catch(e){setError(e instanceof Error?e.message:'暂时无法查询注销状态。');}finally{setBusy(false);}}
  useEffect(()=>{if(!accountDeletionEnabled||!receipt)return;let current=true;let timer:ReturnType<typeof setTimeout>;const poll=async()=>{try{const next=await receiptStatus(receipt.token);if(current){setStatus(next);setError('');}}catch(e){if(current)setError(e instanceof Error?e.message:'暂时无法查询注销状态。');}finally{if(current)timer=setTimeout(poll,5000);}};void poll();return()=>{current=false;clearTimeout(timer);};},[receipt?.token]);
  useEffect(()=>{if(status!=='completed'||!receipt||cleaning.current)return;cleaning.current=true;void(async()=>{
    const sameAccount=identity.current ? await receiptAccountBinding(identity.current)===receipt.binding : false;
    try {
      if(sameAccount||!session){try{await unsubscribeCurrentPushSubscription();}catch{/* Server subscriptions are removed; local unsubscribe may be unsupported/offline. */}}
      if(sameAccount){
        const {error:signOutError}=await supabase.auth.signOut({scope:'local'});
        if(signOutError)throw Error('账号已注销，此设备的登录信息尚未清理，请重试。');
      }
      await clearDeletionPreferences(window.localStorage,receipt.binding);
      try{await clearDeletionPreferences(window.sessionStorage,receipt.binding);}catch{/* session storage unavailable */}
      window.localStorage.removeItem(deletionReceiptKey);setReceipt(null);setFinished(true);onFinished(sameAccount);
    }catch(e){cleaning.current=false;setError(e instanceof Error?e.message:'账号已注销，请重试清理此设备。');}
  })();},[status,cleanupRetry]);
  async function cancelUnaccepted(){setBusy(true);setError('');try{if(!receipt||!session||await receiptAccountBinding(session.user.id)!==receipt.binding)throw Error('当前登录账号与注销请求不同，请继续查询进度。');const data=await deletionRequest({action:'cancel'},session.user.id);if(typeof data.cancelled!=='boolean')throw Error('无法确认请求尚未受理，请继续查询。');if(data.cancelled===true){window.localStorage.removeItem(deletionReceiptKey);setReceipt(null);setStatus('unknown');changed();}else await check();}catch(e){setError(e instanceof Error?e.message:'无法确认，请继续查询。');}finally{setBusy(false);}}
  if(!accountDeletionEnabled)return <>{children}</>;
  if(finished)return <main className="mx-auto min-h-[100dvh] max-w-3xl bg-ui-page p-ui-4 font-ui text-ui-text"><h1 className="text-ui-section">账号已注销</h1><p className="mt-ui-4 text-ui-body text-ui-muted">原账号和私人数据已删除，无法恢复。</p><button className="ui-focus mt-ui-4 min-h-11 text-ui-accent" onClick={()=>{setFinished(false);setStatus('unknown');cleaning.current=false;}}>{session?'返回应用':'返回登录'}</button></main>;
  if(!receipt&&!session)return <>{children}</>;
  if(!receipt&&access?.id===session?.user.id&&access?.active)return <>{children}</>;
  const copy=receipt?deletionStatusCopy(status):['正在核对账号状态','核对完成前暂不载入业务数据。'];
  return <main className="mx-auto min-h-[100dvh] w-full max-w-3xl bg-ui-page p-ui-4 font-ui text-ui-text safe-bottom"><h1 className="text-ui-section">{copy[0]}</h1><p className="mt-ui-4 text-ui-body leading-7 text-ui-muted" role="status">{!receipt&&access?.active===false?'此账号无法继续使用。此设备没有可用的状态回执，暂时无法确认注销结果。':copy[1]}</p>{error&&<p role="alert" className="mt-ui-4 text-ui-meta text-ui-danger">{error}</p>}{receipt&&<button className="ui-focus mt-ui-4 min-h-11 text-ui-accent disabled:opacity-50" disabled={busy} onClick={()=>void check()}>重新查询进度</button>}{status==='completed'&&error&&<button className="ui-focus mt-ui-3 block min-h-11 text-ui-accent" onClick={()=>setCleanupRetry(v=>v+1)}>重试清理此设备</button>}{receipt&&(status==='preparing'||status==='unknown')&&session&&<button className="ui-focus mt-ui-3 block min-h-11 text-ui-accent disabled:opacity-50" disabled={busy} onClick={()=>void cancelUnaccepted()}>核实未受理并返回</button>}{!receipt&&!access&&error&&<button className="ui-focus mt-ui-4 min-h-11 text-ui-accent" onClick={()=>window.location.reload()}>重新核对</button>}</main>;
}
