export type StoredPushSubscription = {
  id: string;
  user_id: string;
  installation_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expiration_time: string | null;
};

export type WebPushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
};

export type VapidConfig = {
  subject: string;
  publicKey: string;
  privateKey: string;
};

export type WebPushDeliveryResult =
  | { classification: 'delivered'; provider: string; status: number }
  | { classification: 'subscription_gone'; provider: string; status: 404 | 410 }
  | { classification: 'provider_rejected'; provider: string; status: number }
  | { classification: 'network_timeout'; provider: string }
  | { classification: 'network_error'; provider: string }
  | { classification: 'invalid_sender_result'; provider: string | null; status?: number };

type WebPushTransportOptions = {
  ttl: number;
  timeoutMs: number;
  urgency: 'normal';
  logger: {
    debug: (message: string, data?: unknown) => void;
  };
};

export type WebPushTransport = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: WebPushPayload,
  vapid: VapidConfig,
  options: WebPushTransportOptions,
) => Promise<boolean>;

type SendWebPushOptions = {
  subscription: StoredPushSubscription;
  payload: WebPushPayload;
  vapid: VapidConfig;
  transport?: WebPushTransport;
};

export class WebPushProviderError extends Error {
  readonly status: number;

  constructor(status: number) {
    super('Push service rejected notification.');
    this.name = 'WebPushProviderError';
    this.status = status;
  }
}

function requiredValue(name: string, readEnvironment: (name: string) => string | undefined) {
  const value = readEnvironment(name);
  if (!value) {
    throw new Error(`Missing required server configuration: ${name}`);
  }
  return value;
}

export function loadVapidConfig(
  readEnvironment: (name: string) => string | undefined = (name) => Deno.env.get(name),
): VapidConfig {
  return {
    subject: requiredValue('VAPID_SUBJECT', readEnvironment),
    publicKey: requiredValue('VAPID_PUBLIC_KEY', readEnvironment),
    privateKey: requiredValue('VAPID_PRIVATE_KEY', readEnvironment),
  };
}

export function pushProviderHostname(endpoint: string) {
  return new URL(endpoint).hostname.toLowerCase();
}

function safePushProviderHostname(endpoint: string) {
  try {
    return pushProviderHostname(endpoint);
  } catch {
    return null;
  }
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

async function defaultWebPushTransport(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: WebPushPayload,
  vapid: VapidConfig,
  options: WebPushTransportOptions,
) {
  const { sendPushNotification, WebPushError } = await import('npm:@mmmike/web-push@1.3.0/send');

  try {
    return await sendPushNotification(subscription, payload, vapid, options);
  } catch (error) {
    if (error instanceof WebPushError) {
      const statusCode = (error as { statusCode?: unknown }).statusCode;
      throw new WebPushProviderError(typeof statusCode === 'number' ? statusCode : Number.NaN);
    }
    throw error;
  }
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

export async function sendWebPush({
  subscription,
  payload,
  vapid,
  transport = defaultWebPushTransport,
}: SendWebPushOptions): Promise<WebPushDeliveryResult> {
  const provider = safePushProviderHostname(subscription.endpoint);
  if (!provider || !isAllowedPushEndpoint(subscription.endpoint)) {
    return { classification: 'invalid_sender_result', provider };
  }

  let upstreamStatus: number | null = null;
  let delivered: boolean;

  try {
    delivered = await transport(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      payload,
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
  } catch (error) {
    if (error instanceof WebPushProviderError) {
      if (!pushStatusFromLoggerData({ status: error.status })) {
        return { classification: 'invalid_sender_result', provider };
      }
      if (error.status === 404 || error.status === 410) {
        return { classification: 'subscription_gone', provider, status: error.status };
      }
      return { classification: 'provider_rejected', provider, status: error.status };
    }
    if (isTimeoutError(error)) {
      return { classification: 'network_timeout', provider };
    }
    if (error instanceof TypeError) {
      return { classification: 'network_error', provider };
    }
    return { classification: 'invalid_sender_result', provider };
  }

  if (upstreamStatus === null) {
    return { classification: 'invalid_sender_result', provider };
  }
  if (delivered && upstreamStatus >= 200 && upstreamStatus <= 299) {
    return { classification: 'delivered', provider, status: upstreamStatus };
  }
  if (!delivered && (upstreamStatus === 404 || upstreamStatus === 410)) {
    return { classification: 'subscription_gone', provider, status: upstreamStatus };
  }
  return { classification: 'invalid_sender_result', provider, status: upstreamStatus };
}
