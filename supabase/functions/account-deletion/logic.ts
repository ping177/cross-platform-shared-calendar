const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function deletionInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request.');
  const body = value as Record<string, unknown>;
  const keys = body.action === 'begin' ? ['action'] : body.action === 'verify'
    ? ['action', 'request_id', 'challenge_id', 'otp'] : body.action === 'confirm'
      ? ['action', 'request_id', 'confirmation_token', 'confirmed'] : [];
  if (!keys.length || Object.keys(body).some(key => !keys.includes(key))) throw new Error('Invalid request.');
  if (body.action !== 'begin' && (typeof body.request_id !== 'string' || !uuid.test(body.request_id))) throw new Error('Invalid request.');
  if (body.action === 'verify' && (typeof body.challenge_id !== 'string' || !uuid.test(body.challenge_id)
    || typeof body.otp !== 'string' || !/^\d{8}$/.test(body.otp))) throw new Error('Invalid request.');
  if (body.action === 'confirm' && (body.confirmed !== true || typeof body.confirmation_token !== 'string'
    || !/^[0-9a-f]{64}$/.test(body.confirmation_token))) throw new Error('Final confirmation is required.');
  return body;
}

// Decode only after getUser has validated this exact token. Decoding is not an
// alternative signature/session check; the database checks the same session ID.
export function verifiedSession(token: string, userId: string): string {
  try {
    const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '=')));
    if (claims.sub !== userId || claims.role !== 'authenticated' || !uuid.test(claims.session_id)) throw new Error();
    return claims.session_id;
  } catch { throw new Error('Authentication required.'); }
}

export async function permitDigest(token: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function newConfirmationToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}
