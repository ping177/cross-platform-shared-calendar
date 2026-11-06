import assert from 'node:assert/strict';
import test from 'node:test';
import { executeOneDeletion, wakeAuthorized } from '../supabase/functions/account-deletion/execution.ts';

test('wake capability is separate from ordinary users, anon and service JWTs', () => {
  const secret = 'a'.repeat(64);
  assert.equal(wakeAuthorized('Bearer '+secret,secret),true);
  for (const auth of [null,'Bearer user.jwt.token','Bearer service.jwt.token','Bearer '+'b'.repeat(64),'Bearer '+secret+' ']) assert.equal(wakeAuthorized(auth,secret),false);
  assert.equal(wakeAuthorized('Bearer '+secret,undefined),false);
});

test('worker never deletes Auth when DB postflight fails and records attention', async () => {
  const calls: string[]=[];
  const client = { rpc: async (name:string) => {
    calls.push(name);
    if(name==='claim_account_deletion')return {data:{request_id:'job',user_id:'fixed',generation:1,lease_token:'lease',phase:'auth'},error:null};
    if(name==='check_deletion_execution')return {data:null,error:{code:'P0001'}};
    assert.equal(name,'release_deletion_execution');return {data:true,error:null};
  },auth:{admin:{deleteUser:()=>assert.fail('Auth deletion must not run')}} };
  assert.deepEqual(await executeOneDeletion(client as never),{status:'deferred'});
  assert.deepEqual(calls,['claim_account_deletion','check_deletion_execution','release_deletion_execution']);
});
