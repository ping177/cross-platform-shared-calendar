import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Send, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  browserPushPlatformContext,
  disableCurrentPushInstallation,
  enablePushNotifications,
  getCurrentPushSubscription,
  isBrowserPushSupported,
  pushCapabilityStatus,
  registerPushServiceWorker,
  sendCurrentInstallationTestPush,
  syncCurrentPushSubscription,
  unsubscribeCurrentPushSubscription,
  type PushCapabilityStatus,
} from '../lib/push-notifications';

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return '通知设置失败，请稍后再试。';
}

const statusCopy: Record<PushCapabilityStatus, { title: string; body: string }> = {
  unsupported: { title: '当前环境不支持通知', body: '请使用支持 Web Push 的安全浏览器或已安装的 PWA。' },
  default: { title: '通知尚未开启', body: '开启后，此设备可以接收共享日历的系统通知。' },
  granted: { title: '权限已允许', body: '完成此设备的订阅后即可接收系统通知。' },
  denied: { title: '通知权限已关闭', body: '请在浏览器或系统设置中允许通知，然后重新打开此页面。' },
  subscribed: { title: '此设备已开启通知', body: '订阅已安全保存，可以发送一条测试通知。' },
  error: { title: '通知设置遇到问题', body: '请检查网络和配置后重试。' },
};

export function NotificationSettings({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<PushCapabilityStatus>('default');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const platform = browserPushPlatformContext();
  const needsIosInstallation = platform.isIos && !platform.isStandalone;

  useEffect(() => {
    closeButtonRef.current?.focus();
    let active = true;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);

    async function inspect() {
      if (!isBrowserPushSupported()) {
        if (active) setStatus('unsupported');
        return;
      }

      try {
        await registerPushServiceWorker();
        const subscription = await getCurrentPushSubscription();
        if (subscription && Notification.permission === 'granted') {
          await syncCurrentPushSubscription(supabase);
        }
        if (active) {
          setStatus(pushCapabilityStatus({
            supported: true,
            permission: Notification.permission,
            subscribed: Boolean(subscription),
          }));
        }
      } catch (error) {
        if (active) {
          setStatus('error');
          setMessage(errorMessage(error));
        }
      }
    }

    void inspect();
    return () => {
      active = false;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  async function enableNotifications() {
    setBusy(true);
    setMessage('');
    try {
      const result = await enablePushNotifications(import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '', supabase);
      setStatus(result.status);
      if (result.status === 'subscribed') {
        setMessage('此设备的通知已开启。');
      } else if (result.status === 'default') {
        setMessage('你暂未选择通知权限，可以稍后再试。');
      }
    } catch (error) {
      setStatus('error');
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function sendTestPush() {
    setBusy(true);
    setMessage('');
    try {
      const result = await sendCurrentInstallationTestPush(supabase);
      if (!result.delivered) {
        setStatus('error');
        setMessage('此订阅已失效，请重新开启通知。');
        return;
      }
      setMessage('测试通知已发送，请查看系统通知。');
    } catch (error) {
      setStatus('error');
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    setBusy(true);
    setMessage('');
    let cleanupError = '';

    try {
      await disableCurrentPushInstallation(supabase);
    } catch (error) {
      cleanupError = errorMessage(error);
    }

    try {
      await unsubscribeCurrentPushSubscription();
    } catch (error) {
      cleanupError ||= errorMessage(error);
    }

    setStatus('granted');
    setMessage(cleanupError || '此设备的通知已关闭。');
    setBusy(false);
  }

  const copy = statusCopy[status];

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-ink/35 md:items-center md:px-4" role="dialog" aria-modal="true" aria-labelledby="notification-settings-title">
      <section className="w-full rounded-t-2xl bg-white p-5 shadow-soft safe-bottom md:mx-auto md:max-w-md md:rounded-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal/10 text-teal">
              {status === 'denied' || status === 'unsupported' ? <BellOff size={19} /> : <Bell size={19} />}
            </div>
            <div>
              <h2 id="notification-settings-title" className="text-lg font-bold text-ink">通知设置</h2>
              <p className="mt-1 text-sm font-semibold text-ink/70">{copy.title}</p>
            </div>
          </div>
          <button ref={closeButtonRef} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-mist text-ink" type="button" onClick={onClose} aria-label="关闭通知设置">
            <X size={19} />
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-ink/65">{copy.body}</p>
        {needsIosInstallation && status === 'unsupported' && (
          <p className="mt-3 rounded-lg bg-amber/10 px-4 py-3 text-sm leading-6 text-amber">
            请先将应用添加到主屏幕，并从主屏幕打开后启用通知。
          </p>
        )}
        {message && (
          <p className={`mt-3 rounded-lg px-4 py-3 text-sm leading-6 ${status === 'error' ? 'bg-coral/10 text-coral' : 'bg-teal/10 text-teal'}`} role="status">
            {message}
          </p>
        )}

        {(status === 'default' || status === 'granted' || status === 'error') && !needsIosInstallation && (
          <button className="mt-5 h-12 w-full rounded-lg bg-teal font-semibold text-white disabled:opacity-60" type="button" onClick={() => void enableNotifications()} disabled={busy}>
            {busy ? '正在开启' : '开启通知'}
          </button>
        )}

        {status === 'subscribed' && (
          <div className="mt-5 space-y-3">
            <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal font-semibold text-white disabled:opacity-60" type="button" onClick={() => void sendTestPush()} disabled={busy}>
              <Send size={17} />
              {busy ? '正在发送' : '发送测试通知'}
            </button>
            <button className="h-12 w-full rounded-lg bg-mist text-sm font-semibold text-ink/70 disabled:opacity-60" type="button" onClick={() => void disableNotifications()} disabled={busy}>
              关闭此设备通知
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
