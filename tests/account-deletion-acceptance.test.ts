import assert from 'node:assert/strict';
import test from 'node:test';
import { deletionInput, newConfirmationToken, permitDigest, verifiedSession } from '../supabase/functions/account-deletion/logic.ts';

const user = 'a1000000-0000-4000-8000-000000000001';
const session = 'a1000000-0000-4000-8000-000000000002';
const request = 'a1000000-0000-4000-8000-000000000003';
const challenge = 'a1000000-0000-4000-8000-000000000004';
function jwt(sub = user, sid = session) {
  return 'synthetic.' + Buffer.from(JSON.stringify({ sub, session_id: sid, role: 'authenticated' })).toString('base64url') + '.synthetic';
}

test('client input cannot select an account, email, cleanup target or verified flag', () => {
  assert.equal(deletionInput({ action: 'begin' }).action, 'begin');
  for (const key of ['user_id','email','space_id','verified','generation']) {
    assert.throws(() => deletionInput({ action: 'begin', [key]: user }), /Invalid request/);
  }
});

test('verification needs this intent, challenge and an eight-digit code', () => {
  const body = { action: 'verify', request_id: request, challenge_id: challenge, otp: '12345678' };
  assert.equal(deletionInput(body).otp, body.otp);
  for (const otp of ['', '123456', true, '12345678\n']) assert.throws(() => deletionInput({ ...body, otp }));
  assert.throws(() => deletionInput({ ...body, challenge_id: user.slice(0, 8) }));
});

test('final confirmation is distinct from identity proof and cannot be a truthy string', () => {
  for (const confirmed of [false, 'true', 1, null]) {
    assert.throws(() => deletionInput({ action: 'confirm', request_id: request, confirmation_token: 'a'.repeat(64), confirmed }));
  }
  assert.equal(deletionInput({ action: 'confirm', request_id: request, confirmation_token: 'a'.repeat(64), confirmed: true }).action, 'confirm');
});

test('session decode is tied to the user already verified by Auth', () => {
  assert.equal(verifiedSession(jwt(), user), session);
  assert.throws(() => verifiedSession(jwt(), request), /Authentication required/);
  assert.throws(() => verifiedSession(jwt(user, 'bad'), user), /Authentication required/);
  assert.throws(() => verifiedSession('not-a-token', user), /Authentication required/);
});

test('confirmation permits are random and only their SHA256 is persisted', async () => {
  const a = newConfirmationToken(), b = newConfirmationToken();
  assert.match(a, /^[0-9a-f]{64}$/); assert.notEqual(a, b);
  const hash = await permitDigest(a); assert.match(hash, /^[0-9a-f]{64}$/); assert.notEqual(hash, a);
  assert.equal(await permitDigest(a), hash);
});

test('a different Auth verification UUID cannot issue a permit; only its temporary session is logged out', async () => {
  let handler: (request: Request) => Promise<Response>;
  const originalFetch = globalThis.fetch;
  const calls: { path: string; body: unknown }[] = [];
  const other = 'a1000000-0000-4000-8000-000000000099';
  Object.assign(globalThis, { Deno: { env: { get: (key: string) => ({ ACCOUNT_DELETION_RUNTIME_MODE: 'isolated-local', ACCOUNT_DELETION_ACCEPT_NEW: 'true',
    SUPABASE_URL: 'http://localhost:55431', SUPABASE_ANON_KEY: 'synthetic-anon', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service' })[key] },
    serve: (callback: typeof handler) => { handler = callback; } } });
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.hostname, 'localhost'); assert.equal(url.port,'55431');
    calls.push({ path: url.pathname + url.search, body: init?.body ? JSON.parse(String(init.body)) : null });
    let body: unknown;
    if (url.pathname === '/auth/v1/user') body = { id: user, email: 'a@example.invalid', email_confirmed_at: '2026-01-01' };
    else if (url.pathname.endsWith('/claim_deletion_verification')) body = challenge;
    else if (url.pathname === '/auth/v1/verify') body = { access_token: jwt(other, other), refresh_token: 'synthetic-refresh', expires_in: 3600,
      token_type: 'bearer', user: { id: other, email: 'b@example.invalid' } };
    else if (url.pathname === '/auth/v1/logout') { assert.equal(url.searchParams.get('scope'), 'local');
      assert.ok(new Headers(init?.headers).get('Authorization') === 'Bearer '+jwt(other,other), 'logout is scoped to the temporary verified session'); body = {}; }
    else if (url.pathname.endsWith('/release_deletion_verification')) body = null;
    else assert.fail('Unexpected route: ' + url.pathname);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    await import('../supabase/functions/account-deletion/index.ts');
    const response = await handler!(new Request('https://function.example.invalid', { method: 'POST', headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', request_id: request, challenge_id: challenge, otp: '12345678' }) }));
    assert.equal(response.status, 403);
    assert.ok(calls.some(call => call.path === '/auth/v1/logout?scope=local'));
    assert.ok(!calls.some(call => call.path.endsWith('/finish_deletion_verification')));
    const before = calls.length;
    Object.assign((globalThis as typeof globalThis & { Deno: { env: { get: (key: string) => string | undefined } } }).Deno.env, { get: () => undefined });
    assert.equal((await handler!(new Request('https://function.example.invalid', { method:'POST' }))).status,503);
    assert.equal(calls.length,before,'disabled deployment gate performs no Auth or database operation');
    Object.assign((globalThis as typeof globalThis & { Deno: { env: { get: (key:string)=>string|undefined } } }).Deno.env, {get:(key:string)=>({ACCOUNT_DELETION_RUNTIME_MODE:'isolated-local',SUPABASE_URL:'https://production.example.invalid',SUPABASE_ANON_KEY:'synthetic'})[key]});
    const blocked=await handler!(new Request('https://function.example.invalid',{method:'POST',headers:{Authorization:'Bearer '+jwt(),'Content-Type':'application/json'},body:JSON.stringify({action:'begin'})}));
    assert.equal(blocked.status,503); assert.equal(calls.length,before,'non-local backend is rejected even if local flag is set');
  } finally { globalThis.fetch = originalFetch; }
});
