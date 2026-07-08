import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> } | undefined;

const CHECK_COUNT = 3;
const REQUEST_TIMEOUT_MS = 8_000;

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function runKeepAliveCheck(supabaseUrl: string, supabaseAnonKey: string) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  for (let index = 0; index < CHECK_COUNT; index += 1) {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

    try {
      const { error } = await supabase
        .from('spaces')
        .select('id', { head: true })
        .limit(1)
        .abortSignal(abortController.signal);

      if (error) {
        return false;
      }
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return true;
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') {
      return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
    }

    const env = process?.env ?? {};
    const cronSecret = env.CRON_SECRET;

    if (!cronSecret) {
      return jsonResponse({ ok: false, error: 'server_not_configured' }, 500);
    }

    if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
    }

    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ ok: false, error: 'server_not_configured' }, 500);
    }

    const ok = await runKeepAliveCheck(supabaseUrl, supabaseAnonKey);

    if (!ok) {
      return jsonResponse({ ok: false, error: 'supabase_keepalive_failed' }, 502);
    }

    return jsonResponse({ ok: true, checks: CHECK_COUNT }, 200);
  },
};
