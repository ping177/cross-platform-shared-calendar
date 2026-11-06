import assert from 'node:assert/strict';
import test from 'node:test';
import { clearDeletionPreferences, receiptAccountBinding, localDeletionEnabled, deletionRecoveryEnabled, readDeletionReceipt, writeDeletionReceipt, deletionReceiptKey, deletionStatusCopy } from '../src/lib/account-deletion.ts';
test('deletion requires explicit DEV flag and loopback frontend/backend',()=>{
 assert.equal(localDeletionEnabled('true',true,'http://127.0.0.1:54321','localhost'),true);
 for(const args of [[undefined,true,'http://127.0.0.1:54321','localhost'],['true',false,'http://127.0.0.1:54321','localhost'],['true',true,'https://project.supabase.co','localhost'],['true',true,'http://127.0.0.1:54321','example.com']] as const)assert.equal(localDeletionEnabled(...args),false);
});
test('only short-lived read-only receipt is persisted; malformed/expired data rejected',()=>{
 const values=new Map<string,string>();const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)}};
 writeDeletionReceipt(storage,'a'.repeat(64),'b'.repeat(64));assert.deepEqual(Object.keys(JSON.parse(values.get(deletionReceiptKey)!)),['token','expires','binding']);
 assert.equal(readDeletionReceipt(storage)?.token,'a'.repeat(64));assert.equal(readDeletionReceipt(storage,Date.now()+8*86400_000),null);
 values.set(deletionReceiptKey,'broken');assert.equal(readDeletionReceipt(storage),null);
 assert.throws(()=>writeDeletionReceipt({getItem:()=>null,setItem:()=>{throw Error('blocked')}},'b'.repeat(64),'c'.repeat(64)));
});
test('unknown and attention never claim success; only completed does',()=>{
 assert.equal(deletionStatusCopy('completed')[0],'账号已注销');
 for(const status of ['unknown','preparing','processing','needs_attention'] as const)assert.notEqual(deletionStatusCopy(status)[0],'账号已注销');
});

test('completed receipt clears only matching account preferences without retaining raw UUID',async()=>{
 const values=new Map([['selectedSpaceId:old','private'],['navigation:old','private'],['selectedSpaceId:other','keep'],['unrelated','keep']]);
 const storage={get length(){return values.size;},key:(index:number)=>Array.from(values.keys())[index]??null,removeItem:(key:string)=>{values.delete(key);}};
 await clearDeletionPreferences(storage,await receiptAccountBinding('old'));
 assert.deepEqual([...values.keys()],['selectedSpaceId:other','unrelated']);
});

test('production recovery stays enabled while the new-entry switch is off',()=>{
 const url='https://ximazjhxvmktpcdbypka.supabase.co';
 assert.equal(deletionRecoveryEnabled('production','false',false,url,'cross-platform-shared-calendar.vercel.app'),true);
 assert.equal(deletionRecoveryEnabled('production','false',false,url,'evil.invalid'),false);
 assert.equal(deletionRecoveryEnabled(undefined,'false',false,url,'cross-platform-shared-calendar.vercel.app'),false);
});
