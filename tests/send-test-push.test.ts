import assert from 'node:assert/strict';
import test from 'node:test';
import {
  installationIdFromRequestBody,
  isAllowedPushEndpoint,
  pushServiceErrorDiagnostic,
  pushStatusFromLoggerData,
  sendTestPushForInstallation,
  type StoredPushSubscription,
} from '../supabase/functions/send-test-push/logic.ts';

const subscription: StoredPushSubscription = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  installation_id: '33333333-3333-4333-8333-333333333333',
  endpoint: 'https://fcm.googleapis.com/fcm/send/example',
  p256dh: 'public-key',
  auth: 'auth-secret',
  expiration_time: null,
};

test('rejects valid JSON values that are not non-null, non-array objects', () => {
  for (const body of [null, [], 'abc', 123, true]) {
    assert.equal(installationIdFromRequestBody(body), null);
  }
});

test('accepts an object without installation_id and lets UUID validation return the client error', () => {
  assert.equal(installationIdFromRequestBody({}), '');
});

test('reads installation_id from a valid request object', () => {
  assert.equal(
    installationIdFromRequestBody({ installation_id: subscription.installation_id }),
    subscription.installation_id,
  );
});

test('allows known HTTPS push services and rejects arbitrary outbound targets', () => {
  assert.equal(isAllowedPushEndpoint(subscription.endpoint), true);
  assert.equal(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/example'), true);
  assert.equal(isAllowedPushEndpoint('https://web.push.apple.com/Q/example'), true);
  assert.equal(isAllowedPushEndpoint('http://fcm.googleapis.com/fcm/send/example'), false);
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com.attacker.example/metadata'), false);
  assert.equal(isAllowedPushEndpoint('https://127.0.0.1/internal'), false);
});

test('rejects unauthenticated sends before looking up a subscription', async () => {
  await assert.rejects(
    () => sendTestPushForInstallation({
      userId: null,
      installationId: subscription.installation_id,
      lookup: async () => subscription,
      send: async () => ({ status: 201, delivered: true }),
      disable: async () => undefined,
    }),
    /Authentication required/,
  );
});

test('does not send a row that is not owned by the authenticated user', async () => {
  await assert.rejects(
    () => sendTestPushForInstallation({
      userId: '44444444-4444-4444-8444-444444444444',
      installationId: subscription.installation_id,
      lookup: async () => subscription,
      send: async () => ({ status: 201, delivered: true }),
      disable: async () => undefined,
    }),
    /Subscription not found/,
  );
});

test('returns the accepted upstream status and hostname-only provider', async () => {
  const lookups: Array<[string, string]> = [];
  const endpoints: string[] = [];

  const result = await sendTestPushForInstallation({
    userId: subscription.user_id,
    installationId: subscription.installation_id,
    lookup: async (userId, installationId) => {
      lookups.push([userId, installationId]);
      return subscription;
    },
    send: async (current) => {
      endpoints.push(current.endpoint);
      return { status: 201, delivered: true };
    },
    disable: async () => undefined,
  });

  assert.deepEqual(lookups, [[subscription.user_id, subscription.installation_id]]);
  assert.deepEqual(endpoints, [subscription.endpoint]);
  assert.deepEqual(result, {
    status: 201,
    delivered: true,
    provider: 'fcm.googleapis.com',
    gone: false,
  });
  assert.ok(JSON.stringify(result).length > 0);
  assert.doesNotMatch(JSON.stringify(result), /fcm\/send|public-key|auth-secret/);
});

for (const status of [404, 410]) {
  test(`disables only the gone subscription when the push service returns ${status}`, async () => {
    const disabledIds: string[] = [];

    const result = await sendTestPushForInstallation({
      userId: subscription.user_id,
      installationId: subscription.installation_id,
      lookup: async () => subscription,
      send: async () => ({ status, delivered: false }),
      disable: async (subscriptionId) => {
        disabledIds.push(subscriptionId);
      },
    });

    assert.deepEqual(disabledIds, [subscription.id]);
    assert.deepEqual(result, {
      status,
      delivered: false,
      provider: 'fcm.googleapis.com',
      gone: true,
    });
  });
}

test('extracts only a valid numeric status from library logger data', () => {
  const loggerData = {
    status: 201,
    endpoint: subscription.endpoint,
    body: 'upstream response body',
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    privateKey: 'private-vapid-material',
  };

  assert.equal(pushStatusFromLoggerData(loggerData), 201);
  assert.equal(pushStatusFromLoggerData({ status: '201' }), null);
  assert.equal(pushStatusFromLoggerData({ status: 99 }), null);
  assert.equal(pushStatusFromLoggerData({ status: 600 }), null);
  assert.equal(pushStatusFromLoggerData(null), null);
});

for (const status of [401, 403, 429, 503]) {
  test(`builds a non-sensitive diagnostic for upstream ${status}`, () => {
    const result = pushServiceErrorDiagnostic(status, subscription.endpoint);
    const serialized = JSON.stringify(result);

    assert.deepEqual(result, {
      status,
      delivered: false,
      provider: 'fcm.googleapis.com',
      gone: false,
      error: 'push_service_rejected',
    });
    assert.doesNotMatch(serialized, /fcm\/send|public-key|auth-secret|private-vapid-material/);
  });
}

test('propagates network and runtime failures for the Edge handler to map to 500', async () => {
  await assert.rejects(
    () => sendTestPushForInstallation({
      userId: subscription.user_id,
      installationId: subscription.installation_id,
      lookup: async () => subscription,
      send: async () => {
        throw new TypeError('network unavailable');
      },
      disable: async () => undefined,
    }),
    /network unavailable/,
  );
});
