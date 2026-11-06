import { createClient } from '@supabase/supabase-js';
import { executeOneDeletion, wakeAuthorized } from './execution.ts';
import { deletionInput, newConfirmationToken, permitDigest, verifiedSession } from './logic.ts';

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
function config(name: string) { const value = Deno.env.get(name); if (!value) throw new Error('Service unavailable.'); return value; }
async function requestBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid request.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length; if (size > 4096) { await reader.cancel(); throw new Error('Invalid request.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('Invalid request.'); }
}

Deno.serve(async request => {
  const origin = request.headers.get('Origin');
  const allowedOrigin = origin && ['http://127.0.0.1:5175', 'http://localhost:5175'].includes(origin) ? origin : null;
  const responseHeaders = { ...headers, ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) };
  const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: responseHeaders });
  // No deployment/config resource is added. Default is fail-closed; this draft
  // can accept requests only in the deliberately configured isolated test stack.
  if (Deno.env.get('ACCOUNT_DELETION_RUNTIME_MODE') !== 'isolated-local') return reply({ error: 'Service unavailable.' }, 503);
  if (request.method === 'OPTIONS' && allowedOrigin) return new Response(null, { status: 204, headers: responseHeaders });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  if (origin && !['http://127.0.0.1:5175', 'http://localhost:5175'].includes(origin)) return reply({ error: 'Origin is not allowed.' }, 403);
  const authorization = request.headers.get('Authorization');
  try {
    const raw = await requestBody(request);
    const special = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const internal = special.action === 'work';
    const receipt = special.action === 'receipt';
    if (internal && (!wakeAuthorized(authorization, Deno.env.get('ACCOUNT_DELETION_WAKE_SECRET')) || Object.keys(special).some(key => key !== 'action'))) return reply({ error: 'Forbidden.' }, 403);
    if (receipt && (Object.keys(special).some(key => !['action','receipt_token'].includes(key)) || typeof special.receipt_token !== 'string' || !/^[0-9a-f]{64}$/.test(special.receipt_token))) return reply({ error: 'Invalid request.' }, 400);
    if (!internal && !receipt && !authorization?.startsWith('Bearer ')) return reply({ error: 'Authentication required.' }, 401);
    const body = internal || receipt ? special : deletionInput(raw);
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const url = config('SUPABASE_URL');
    const localUrl = new URL(url);
    if (localUrl.protocol !== 'http:' || !['127.0.0.1','localhost','storage','kong'].includes(localUrl.hostname)) throw new Error('Service unavailable.');
    const anon = config('SUPABASE_ANON_KEY');
    if (internal || receipt) {
      const admin = createClient(url, config('SUPABASE_SERVICE_ROLE_KEY'), { ...options, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) } });
      if (internal) return reply(await executeOneDeletion(admin), 200);
      const { data, error } = await admin.rpc('read_deletion_receipt', { p_receipt_hash: await permitDigest(body.receipt_token as string) });
      if (error) return reply({ error: 'Service unavailable.' }, 503);
      return data ? reply(data, 200) : reply({ error: 'Receipt unavailable.' }, 404);
    }
    const caller = createClient(url, anon, { ...options, global: { headers: { Authorization: authorization! } } });
    const token = authorization!.slice(7);
    const { data: { user }, error } = await caller.auth.getUser(token);
    if (error || !user?.email || !user.email_confirmed_at) return reply({ error: 'Authentication required.' }, 401);
    const sessionId = verifiedSession(token, user.id);
    if (body.action === 'begin') {
      const { data, error: prepareError } = await caller.rpc('prepare_my_account_deletion');
      if (prepareError || !data?.request_id || !data?.challenge_id) return reply({ error: 'Verification is unavailable.' }, 409);
      if (data.send_needed) {
        const verifier = createClient(url, anon, options);
        const { error: sendError } = await verifier.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false } });
        if (sendError) return reply({ error: 'Verification is unavailable.' }, 503);
      }
      return reply({ request_id: data.request_id, challenge_id: data.challenge_id }, 200);
    }
    if (body.action === 'cancel') {
      const { data, error: cancelError } = await caller.rpc('cancel_my_deletion_preparation');
      if (cancelError || typeof data !== 'boolean') return reply({ error: 'Confirmation is unavailable.' }, 409);
      return reply({ cancelled: data }, 200);
    }
    if (body.action === 'confirm') {
      const { data, error: acceptError } = await caller.rpc('accept_my_account_deletion', {
        p_request_id: body.request_id, p_confirmation_token: body.confirmation_token,
      });
      if (acceptError) return reply({ error: acceptError.message === 'SHARED_OWNERSHIP_REQUIRES_ACTION'
        ? 'Shared ownership requires action.' : 'Confirmation is unavailable.' }, 409);
      return reply(data, 202); // durable acceptance, never deletion-completed
    }
    const admin = createClient(url, config('SUPABASE_SERVICE_ROLE_KEY'), options);
    const tuple = { p_user_id: user.id, p_session_id: sessionId, p_request_id: body.request_id, p_challenge_id: body.challenge_id };
    const { data: claimId, error: claimError } = await admin.rpc('claim_deletion_verification', tuple);
    if (claimError || typeof claimId !== 'string') return reply({ error: 'Verification is unavailable.' }, 409);
    const verifier = createClient(url, anon, options);
    try {
      const { data, error: verifyError } = await verifier.auth.verifyOtp({ email: user.email, token: body.otp as string, type: 'email' });
      if (verifyError || !data.user || !data.session) return reply({ error: 'Verification failed.' }, 403);
      // The temporary OTP session must never replace or log out the original.
      const temporarySession = verifiedSession(data.session.access_token, data.user.id);
      if (temporarySession === sessionId) return reply({ error: 'Verification failed.' }, 403);
      const { error: logoutError } = await verifier.auth.signOut({ scope: 'local' });
      if (logoutError || data.user.id !== user.id) return reply({ error: 'Verification failed.' }, 403);
      const confirmation = newConfirmationToken();
      const { data: finished, error: finishError } = await admin.rpc('finish_deletion_verification', {
        ...tuple, p_claim_id: claimId, p_permit_hash: await permitDigest(confirmation),
      });
      if (finishError || finished !== true) return reply({ error: 'Verification failed.' }, 403);
      const receiptToken = newConfirmationToken();
      const { data: bound, error: receiptError } = await caller.rpc('bind_my_deletion_receipt', {
        p_request_id: body.request_id, p_confirmation_token: confirmation, p_receipt_hash: await permitDigest(receiptToken),
      });
      if (receiptError || bound !== true) return reply({ error: 'Verification failed.' }, 503);
      return reply({ request_id: body.request_id, confirmation_token: confirmation, receipt_token: receiptToken, expires_in: 300 }, 200);
    } finally {
      // CAS release cannot clear a newer attempt or an already issued permit.
      await admin.rpc('release_deletion_verification', { p_request_id: body.request_id, p_claim_id: claimId });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Invalid request.' || message === 'Final confirmation is required.') return reply({ error: message }, 400);
    if (message === 'Authentication required.') return reply({ error: message }, 401);
    // Never log OTP/JWT/request bodies/provider details.
    return reply({ error: 'Service unavailable.' }, 503);
  }
});
