import assert from 'node:assert/strict';
import test from 'node:test';
import {
  installationIdFromRequestBody,
  isAllowedPushEndpoint,
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
      send: async () => true,
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
      send: async () => true,
      disable: async () => undefined,
    }),
    /Subscription not found/,
  );
});

test('looks up and sends only the current user and installation', async () => {
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
      return true;
    },
    disable: async () => undefined,
  });

  assert.deepEqual(lookups, [[subscription.user_id, subscription.installation_id]]);
  assert.deepEqual(endpoints, [subscription.endpoint]);
  assert.deepEqual(result, { delivered: true, disabled: false });
});

test('disables only the gone subscription when the push service returns 404 or 410', async () => {
  const disabledIds: string[] = [];

  const result = await sendTestPushForInstallation({
    userId: subscription.user_id,
    installationId: subscription.installation_id,
    lookup: async () => subscription,
    send: async () => false,
    disable: async (subscriptionId) => {
      disabledIds.push(subscriptionId);
    },
  });

  assert.deepEqual(disabledIds, [subscription.id]);
  assert.deepEqual(result, { delivered: false, disabled: true });
});
