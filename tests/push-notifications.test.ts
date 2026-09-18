import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applicationServerKeyFromBase64,
  cleanupPushAndSignOut,
  getOrCreateInstallationId,
  pushPlatformHint,
  pushCapabilityStatus,
  serializePushSubscription,
} from '../src/lib/push-notifications.ts';

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test('creates and reuses one stable installation id', () => {
  const storage = new MemoryStorage();
  let generated = 0;
  const createUuid = () => {
    generated += 1;
    return '11111111-1111-4111-8111-111111111111';
  };

  assert.equal(getOrCreateInstallationId(storage, createUuid), '11111111-1111-4111-8111-111111111111');
  assert.equal(getOrCreateInstallationId(storage, createUuid), '11111111-1111-4111-8111-111111111111');
  assert.equal(generated, 1);
});

test('maps unsupported, permission, and subscribed browser states', () => {
  assert.equal(pushCapabilityStatus({ supported: false, permission: 'default', subscribed: false }), 'unsupported');
  assert.equal(pushCapabilityStatus({ supported: true, permission: 'default', subscribed: false }), 'default');
  assert.equal(pushCapabilityStatus({ supported: true, permission: 'granted', subscribed: false }), 'granted');
  assert.equal(pushCapabilityStatus({ supported: true, permission: 'denied', subscribed: false }), 'denied');
  assert.equal(pushCapabilityStatus({ supported: true, permission: 'granted', subscribed: true }), 'subscribed');
});

test('decodes a URL-safe public VAPID key for PushManager.subscribe', () => {
  assert.deepEqual(
    Array.from(applicationServerKeyFromBase64('AQID-_8')),
    [1, 2, 3, 251, 255],
  );
});

test('uses platform hints only for diagnostics', () => {
  assert.equal(pushPlatformHint({ isIos: true, isStandalone: false }), 'ios-browser');
  assert.equal(pushPlatformHint({ isIos: true, isStandalone: true }), 'ios-standalone');
  assert.equal(pushPlatformHint({ isIos: false, isStandalone: true }), 'standalone');
  assert.equal(pushPlatformHint({ isIos: false, isStandalone: false }), 'browser');
});

test('serializes only the subscription fields persisted by the RPC', () => {
  const serialized = serializePushSubscription({
    endpoint: 'https://fcm.googleapis.com/fcm/send/example',
    expirationTime: 1_800_000_000_000,
    toJSON: () => ({
      endpoint: 'https://fcm.googleapis.com/fcm/send/example',
      expirationTime: 1_800_000_000_000,
      keys: { p256dh: 'public-key', auth: 'auth-secret' },
    }),
  });

  assert.deepEqual(serialized, {
    endpoint: 'https://fcm.googleapis.com/fcm/send/example',
    expirationTime: '2027-01-15T08:00:00.000Z',
    p256dh: 'public-key',
    auth: 'auth-secret',
  });
});

test('attempts server disable, unsubscribe, then sign-out without blocking logout on cleanup failures', async () => {
  const calls: string[] = [];
  const errors: string[] = [];

  const result = await cleanupPushAndSignOut({
    disableRemote: async () => {
      calls.push('disable');
      throw new Error('offline');
    },
    unsubscribe: async () => {
      calls.push('unsubscribe');
      return true;
    },
    signOut: async () => {
      calls.push('sign-out');
    },
    onCleanupError: (stage) => errors.push(stage),
  });

  assert.deepEqual(calls, ['disable', 'unsubscribe', 'sign-out']);
  assert.deepEqual(errors, ['disable']);
  assert.deepEqual(result, { remoteDisabled: false, unsubscribed: true });
});
