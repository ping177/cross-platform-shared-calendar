import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WebPushProviderError,
  isAllowedPushEndpoint,
  loadVapidConfig,
  sendWebPush,
  type StoredPushSubscription,
} from '../supabase/functions/_shared/web-push.ts';

const subscription: StoredPushSubscription = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  installation_id: '33333333-3333-4333-8333-333333333333',
  endpoint: 'https://fcm.googleapis.com/fcm/send/private-endpoint-token',
  p256dh: 'private-p256dh-key',
  auth: 'private-auth-secret',
  expiration_time: null,
};

const payload = {
  title: '共享日历',
  body: '通知测试成功',
  url: '/',
  tag: 'shared-calendar-test',
};

const vapid = {
  subject: 'mailto:push@example.com',
  publicKey: 'private-vapid-public-key',
  privateKey: 'private-vapid-private-key',
};

test('loads the three required VAPID values through an injectable environment reader', () => {
  const values = new Map([
    ['VAPID_SUBJECT', vapid.subject],
    ['VAPID_PUBLIC_KEY', vapid.publicKey],
    ['VAPID_PRIVATE_KEY', vapid.privateKey],
  ]);
  const requested: string[] = [];

  assert.deepEqual(loadVapidConfig((name) => {
    requested.push(name);
    return values.get(name);
  }), vapid);
  assert.deepEqual(requested, ['VAPID_SUBJECT', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']);
  assert.throws(
    () => loadVapidConfig((name) => name === 'VAPID_SUBJECT' ? vapid.subject : undefined),
    /Missing required server configuration: VAPID_PUBLIC_KEY/,
  );
});

test('allows only the established HTTPS Web Push provider hosts', () => {
  assert.equal(isAllowedPushEndpoint(subscription.endpoint), true);
  assert.equal(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/example'), true);
  assert.equal(isAllowedPushEndpoint('https://web.push.apple.com/Q/example'), true);
  assert.equal(isAllowedPushEndpoint('http://fcm.googleapis.com/fcm/send/example'), false);
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com.attacker.example/metadata'), false);
  assert.equal(isAllowedPushEndpoint('https://127.0.0.1/internal'), false);
  assert.equal(isAllowedPushEndpoint('not a URL'), false);
});

test('sends with the fixed transport contract and returns a closed delivered result', async () => {
  let captured: unknown[] | null = null;

  const result = await sendWebPush({
    subscription,
    payload,
    vapid,
    transport: async (...args) => {
      captured = args;
      args[3].logger.debug('Web Push response', {
        status: 201,
        endpoint: subscription.endpoint,
        body: 'raw provider response',
      });
      return true;
    },
  });

  assert.deepEqual(result, {
    classification: 'delivered',
    provider: 'fcm.googleapis.com',
    status: 201,
  });
  assert.deepEqual(captured?.slice(0, 3), [
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    payload,
    vapid,
  ]);
  assert.deepEqual(captured?.[3] && {
    ttl: captured[3].ttl,
    timeoutMs: captured[3].timeoutMs,
    urgency: captured[3].urgency,
  }, {
    ttl: 60,
    timeoutMs: 10_000,
    urgency: 'normal',
  });
});

for (const status of [404, 410] as const) {
  test(`classifies an upstream ${status} as subscription_gone`, async () => {
    const result = await sendWebPush({
      subscription,
      payload,
      vapid,
      transport: async (_subscription, _payload, _vapid, options) => {
        options.logger.debug('Web Push response', { status });
        return false;
      },
    });

    assert.deepEqual(result, {
      classification: 'subscription_gone',
      provider: 'fcm.googleapis.com',
      status,
    });
  });
}

test('classifies a safe wrapped provider error without exposing its cause', async () => {
  const result = await sendWebPush({
    subscription,
    payload,
    vapid,
    transport: async () => {
      throw new WebPushProviderError(503);
    },
  });

  assert.deepEqual(result, {
    classification: 'provider_rejected',
    provider: 'fcm.googleapis.com',
    status: 503,
  });
});

test('classifies timeout, network, and malformed sender outcomes', async () => {
  const timeoutError = new Error('contains unsafe timeout details');
  timeoutError.name = 'TimeoutError';

  const [timeout, network, missingStatus, inconsistentResult] = await Promise.all([
    sendWebPush({
      subscription,
      payload,
      vapid,
      transport: async () => { throw timeoutError; },
    }),
    sendWebPush({
      subscription,
      payload,
      vapid,
      transport: async () => { throw new TypeError('contains unsafe network details'); },
    }),
    sendWebPush({
      subscription,
      payload,
      vapid,
      transport: async () => true,
    }),
    sendWebPush({
      subscription,
      payload,
      vapid,
      transport: async (_subscription, _payload, _vapid, options) => {
        options.logger.debug('Web Push response', { status: 503 });
        return true;
      },
    }),
  ]);

  assert.deepEqual(timeout, {
    classification: 'network_timeout',
    provider: 'fcm.googleapis.com',
  });
  assert.deepEqual(network, {
    classification: 'network_error',
    provider: 'fcm.googleapis.com',
  });
  assert.deepEqual(missingStatus, {
    classification: 'invalid_sender_result',
    provider: 'fcm.googleapis.com',
  });
  assert.deepEqual(inconsistentResult, {
    classification: 'invalid_sender_result',
    provider: 'fcm.googleapis.com',
    status: 503,
  });
});

test('rejects a disallowed endpoint before transport and never serializes sensitive values', async () => {
  let transportCalled = false;
  const result = await sendWebPush({
    subscription: { ...subscription, endpoint: 'https://127.0.0.1/internal/private-token' },
    payload,
    vapid,
    transport: async () => {
      transportCalled = true;
      return true;
    },
  });
  const serialized = JSON.stringify(result);

  assert.equal(transportCalled, false);
  assert.deepEqual(result, {
    classification: 'invalid_sender_result',
    provider: '127.0.0.1',
  });
  assert.doesNotMatch(
    serialized,
    /private-endpoint-token|private-p256dh-key|private-auth-secret|private-vapid|通知测试成功/,
  );
});
