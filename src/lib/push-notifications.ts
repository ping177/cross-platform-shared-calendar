import type { SupabaseClient } from '@supabase/supabase-js';

export const INSTALLATION_ID_STORAGE_KEY = 'shared-calendar.installation-id.v1';

export type PushCapabilityStatus = 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribed' | 'error';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type SerializablePushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  toJSON(): {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: Record<string, string>;
  };
};

export type SerializedPushSubscription = {
  endpoint: string;
  expirationTime: string | null;
  p256dh: string;
  auth: string;
};

export type PushPlatformContext = {
  isIos: boolean;
  isStandalone: boolean;
};

export function getOrCreateInstallationId(
  storage: StorageLike,
  createUuid: () => string = () => crypto.randomUUID(),
) {
  const existing = storage.getItem(INSTALLATION_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const installationId = createUuid();
  storage.setItem(INSTALLATION_ID_STORAGE_KEY, installationId);
  return installationId;
}

export function pushCapabilityStatus({
  supported,
  permission,
  subscribed,
}: {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}): PushCapabilityStatus {
  if (!supported) {
    return 'unsupported';
  }

  if (subscribed) {
    return 'subscribed';
  }

  return permission;
}

export function applicationServerKeyFromBase64(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(base64);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function pushPlatformHint({ isIos, isStandalone }: PushPlatformContext) {
  if (isIos) {
    return isStandalone ? 'ios-standalone' : 'ios-browser';
  }

  return isStandalone ? 'standalone' : 'browser';
}

export function serializePushSubscription(subscription: SerializablePushSubscription): SerializedPushSubscription {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!subscription.endpoint || !p256dh || !auth) {
    throw new Error('Push subscription is missing required keys.');
  }

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime === null ? null : new Date(subscription.expirationTime).toISOString(),
    p256dh,
    auth,
  };
}

export function browserPushPlatformContext(): PushPlatformContext {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isIos: false, isStandalone: false };
  }

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || navigatorWithStandalone.standalone === true;

  return { isIos, isStandalone };
}

export function isBrowserPushSupported() {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function getStoredInstallationId(storage: StorageLike = window.localStorage) {
  return storage.getItem(INSTALLATION_ID_STORAGE_KEY);
}

export async function registerPushServiceWorker() {
  if (!isBrowserPushSupported()) {
    return null;
  }

  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function getCurrentPushSubscription() {
  if (!isBrowserPushSupported()) {
    return null;
  }

  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration?.pushManager.getSubscription() ?? null;
}

async function persistPushSubscription(subscription: PushSubscription, installationId: string, client: SupabaseClient) {
  const serialized = serializePushSubscription(subscription);
  const platformHint = pushPlatformHint(browserPushPlatformContext());
  const { error } = await client.rpc('register_push_subscription', {
    p_installation_id: installationId,
    p_endpoint: serialized.endpoint,
    p_p256dh: serialized.p256dh,
    p_auth: serialized.auth,
    p_expiration_time: serialized.expirationTime,
    p_platform_hint: platformHint,
  });

  if (error) {
    throw error;
  }
}

export async function syncCurrentPushSubscription(client: SupabaseClient) {
  const subscription = await getCurrentPushSubscription();
  if (!subscription || Notification.permission !== 'granted') {
    return null;
  }

  const installationId = getOrCreateInstallationId(window.localStorage);
  await persistPushSubscription(subscription, installationId, client);
  return subscription;
}

export async function enablePushNotifications(vapidPublicKey: string, client: SupabaseClient) {
  if (!isBrowserPushSupported()) {
    return { status: 'unsupported' as const, subscription: null };
  }

  if (!vapidPublicKey) {
    throw new Error('VAPID public key is not configured.');
  }

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;

  if (permission !== 'granted') {
    return { status: permission as 'default' | 'denied', subscription: null };
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKeyFromBase64(vapidPublicKey),
  });
  const installationId = getOrCreateInstallationId(window.localStorage);
  await persistPushSubscription(subscription, installationId, client);

  return { status: 'subscribed' as const, subscription };
}

export async function disableCurrentPushInstallation(client: SupabaseClient) {
  const installationId = getStoredInstallationId();
  if (!installationId) {
    return false;
  }

  const { data, error } = await client.rpc('disable_push_subscription', {
    p_installation_id: installationId,
  });
  if (error) {
    throw error;
  }

  return data === true;
}

export async function unsubscribeCurrentPushSubscription() {
  const subscription = await getCurrentPushSubscription();
  return subscription ? subscription.unsubscribe() : false;
}

export async function sendCurrentInstallationTestPush(client: SupabaseClient) {
  const installationId = getStoredInstallationId();
  if (!installationId) {
    throw new Error('This browser does not have a push installation id.');
  }

  const { data, error } = await client.functions.invoke('send-test-push', {
    body: { installation_id: installationId },
  });
  if (error) {
    throw error;
  }

  return data as { delivered: boolean; disabled: boolean };
}

export async function cleanupPushAndSignOut({
  disableRemote,
  unsubscribe,
  signOut,
  onCleanupError,
}: {
  disableRemote: () => Promise<void>;
  unsubscribe: () => Promise<boolean>;
  signOut: () => Promise<void>;
  onCleanupError?: (stage: 'disable' | 'unsubscribe', error: unknown) => void;
}) {
  let remoteDisabled = false;
  let unsubscribed = false;

  try {
    await disableRemote();
    remoteDisabled = true;
  } catch (error) {
    onCleanupError?.('disable', error);
  }

  try {
    unsubscribed = await unsubscribe();
  } catch (error) {
    onCleanupError?.('unsubscribe', error);
  }

  await signOut();
  return { remoteDisabled, unsubscribed };
}
