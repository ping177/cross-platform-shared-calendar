export type StoredPushSubscription = {
  id: string;
  user_id: string;
  installation_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expiration_time: string | null;
};

type PushServiceSendResult = {
  status: number;
  delivered: boolean;
};

type SendTestPushDependencies = {
  userId: string | null;
  installationId: string;
  lookup: (userId: string, installationId: string) => Promise<StoredPushSubscription | null>;
  send: (subscription: StoredPushSubscription) => Promise<PushServiceSendResult>;
  disable: (subscriptionId: string) => Promise<void>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function installationIdFromRequestBody(body: unknown) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }

  const installationId = (body as Record<string, unknown>).installation_id;
  return typeof installationId === 'string' ? installationId : '';
}

export function pushProviderHostname(endpoint: string) {
  return new URL(endpoint).hostname.toLowerCase();
}

export function pushStatusFromLoggerData(data: unknown) {
  if (typeof data !== 'object' || data === null || !('status' in data)) {
    return null;
  }

  const status = (data as Record<string, unknown>).status;
  return typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : null;
}

export function pushServiceErrorDiagnostic(status: number, endpoint: string) {
  return {
    status,
    delivered: false,
    provider: pushProviderHostname(endpoint),
    gone: false,
    error: 'push_service_rejected',
  };
}

export function isAllowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (
      hostname === 'fcm.googleapis.com'
      || hostname.endsWith('.push.services.mozilla.com')
      || hostname.endsWith('.push.apple.com')
    );
  } catch {
    return false;
  }
}

export async function sendTestPushForInstallation({
  userId,
  installationId,
  lookup,
  send,
  disable,
}: SendTestPushDependencies) {
  if (!userId) {
    throw new Error('Authentication required.');
  }

  if (!uuidPattern.test(installationId)) {
    throw new Error('Invalid installation id.');
  }

  const subscription = await lookup(userId, installationId);
  if (
    !subscription
    || subscription.user_id !== userId
    || subscription.installation_id !== installationId
  ) {
    throw new Error('Subscription not found.');
  }

  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    throw new Error('Push endpoint is not allowed.');
  }

  const provider = pushProviderHostname(subscription.endpoint);
  const result = await send(subscription);
  const gone = !result.delivered && (result.status === 404 || result.status === 410);

  if (!result.delivered && !gone) {
    throw new Error('Unexpected push service result.');
  }
  if (result.delivered && (result.status < 200 || result.status > 299)) {
    throw new Error('Unexpected push service result.');
  }

  if (gone) {
    await disable(subscription.id);
  }

  return {
    status: result.status,
    delivered: result.delivered,
    provider,
    gone,
  };
}
