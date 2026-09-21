import {
  isAllowedPushEndpoint,
  pushProviderHostname,
  pushStatusFromLoggerData,
  type StoredPushSubscription,
  type WebPushDeliveryResult,
} from '../_shared/web-push.ts';

export { isAllowedPushEndpoint, pushProviderHostname, pushStatusFromLoggerData };
export type { StoredPushSubscription };

type SendTestPushDependencies = {
  userId: string | null;
  installationId: string;
  lookup: (userId: string, installationId: string) => Promise<StoredPushSubscription | null>;
  send: (subscription: StoredPushSubscription) => Promise<WebPushDeliveryResult>;
  disable: (subscriptionId: string) => Promise<void>;
};

export class SendTestPushDeliveryError extends Error {
  readonly result: WebPushDeliveryResult;

  constructor(result: WebPushDeliveryResult) {
    super('Test push delivery failed.');
    this.name = 'SendTestPushDeliveryError';
    this.result = result;
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function installationIdFromRequestBody(body: unknown) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }

  const installationId = (body as Record<string, unknown>).installation_id;
  return typeof installationId === 'string' ? installationId : '';
}

export function pushServiceResultDiagnostic(
  result: Extract<WebPushDeliveryResult, { classification: 'provider_rejected' }>,
) {
  return {
    status: result.status,
    delivered: false,
    provider: result.provider,
    gone: false,
    error: 'push_service_rejected',
  };
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

  const result = await send(subscription);
  if (result.classification === 'subscription_gone') {
    await disable(subscription.id);
  }
  if (result.classification !== 'delivered' && result.classification !== 'subscription_gone') {
    throw new SendTestPushDeliveryError(result);
  }

  return {
    status: result.status,
    delivered: result.classification === 'delivered',
    provider: result.provider,
    gone: result.classification === 'subscription_gone',
  };
}
