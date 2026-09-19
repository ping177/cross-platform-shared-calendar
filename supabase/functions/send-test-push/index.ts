import { sendPushNotification, WebPushError } from '@mmmike/web-push/send';
import { createClient } from '@supabase/supabase-js';
import {
  installationIdFromRequestBody,
  pushServiceErrorDiagnostic,
  pushStatusFromLoggerData,
  sendTestPushForInstallation,
  type StoredPushSubscription,
} from './logic.ts';

const allowedOrigins = new Set([
  'https://cross-platform-shared-calendar.vercel.app',
  'http://127.0.0.1:5175',
  'http://localhost:5175',
]);

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

function responseHeaders(origin: string | null) {
  if (!origin || !allowedOrigins.has(origin)) {
    return jsonHeaders;
  }

  return {
    ...jsonHeaders,
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(origin: string | null, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
}

function requiredSecret(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required server configuration: ${name}`);
  }
  return value;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse(null, { error: 'Origin is not allowed.' }, 403);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(origin, { error: 'Method not allowed.' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse(origin, { error: 'Authentication required.' }, 401);
  }

  const contentLength = Number(request.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return jsonResponse(origin, { error: 'Request body is too large.' }, 413);
  }

  try {
    const supabaseUrl = requiredSecret('SUPABASE_URL');
    const supabaseAnonKey = requiredSecret('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY');
    const vapid = {
      subject: requiredSecret('VAPID_SUBJECT'),
      publicKey: requiredSecret('VAPID_PUBLIC_KEY'),
      privateKey: requiredSecret('VAPID_PRIVATE_KEY'),
    };

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authorization.slice('Bearer '.length);
    const { data: { user }, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse(origin, { error: 'Authentication required.' }, 401);
    }

    let body: unknown;
    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > 4096) {
        return jsonResponse(origin, { error: 'Request body is too large.' }, 413);
      }
      body = JSON.parse(rawBody);
    } catch {
      return jsonResponse(origin, { error: 'Request body must be valid JSON.' }, 400);
    }

    const installationId = installationIdFromRequestBody(body);
    if (installationId === null) {
      return jsonResponse(origin, { error: 'Request body must be a JSON object.' }, 400);
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const result = await sendTestPushForInstallation({
      userId,
      installationId,
      lookup: async (lookupUserId, lookupInstallationId) => {
        const { data, error } = await adminClient
          .from('push_subscriptions')
          .select('id, user_id, installation_id, endpoint, p256dh, auth, expiration_time')
          .eq('user_id', lookupUserId)
          .eq('installation_id', lookupInstallationId)
          .is('disabled_at', null)
          .maybeSingle<StoredPushSubscription>();
        if (error) {
          throw new Error('Subscription lookup failed.');
        }
        return data;
      },
      send: async (subscription) => {
        let upstreamStatus: number | null = null;
        const delivered = await sendPushNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          {
            title: '共享日历',
            body: '通知测试成功',
            url: '/',
            tag: 'shared-calendar-test',
          },
          vapid,
          {
            ttl: 60,
            timeoutMs: 10_000,
            urgency: 'normal',
            logger: {
              debug: (_message, data) => {
                upstreamStatus = pushStatusFromLoggerData(data) ?? upstreamStatus;
              },
            },
          },
        );

        if (upstreamStatus === null) {
          throw new Error('Push service status unavailable.');
        }
        return { status: upstreamStatus, delivered };
      },
      disable: async (subscriptionId) => {
        const { error } = await adminClient
          .from('push_subscriptions')
          .update({ disabled_at: new Date().toISOString() })
          .eq('id', subscriptionId)
          .eq('user_id', userId);
        if (error) {
          throw new Error('Subscription cleanup failed.');
        }
      },
    });

    return jsonResponse(origin, result);
  } catch (error) {
    if (error instanceof WebPushError) {
      const diagnostic = pushServiceErrorDiagnostic(error.statusCode, error.endpoint);
      console.error('Push service rejected a test notification.', {
        statusCode: diagnostic.status,
        provider: diagnostic.provider,
        retryAfterMs: error.retryAfterMs,
      });
      return jsonResponse(origin, diagnostic, 502);
    }

    const message = error instanceof Error ? error.message : 'Unexpected push error.';
    if (message === 'Authentication required.') {
      return jsonResponse(origin, { error: message }, 401);
    }
    if (message === 'Invalid installation id.') {
      return jsonResponse(origin, { error: message }, 400);
    }
    if (message === 'Subscription not found.') {
      return jsonResponse(origin, { error: message }, 404);
    }
    if (message === 'Push endpoint is not allowed.') {
      return jsonResponse(origin, { error: message }, 422);
    }

    console.error('Test push failed without logging subscription data.', {
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return jsonResponse(origin, { error: 'Unable to send test notification.' }, 500);
  }
});
