import { useEffect, useState, type RefObject } from 'react';
import { useListModalKeyboard } from './ListSheets';
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

export function NotificationSettings({ onClose, returnFocusRef }: { onClose: () => void; returnFocusRef?: RefObject<HTMLButtonElement> }) {
  const [status, setStatus] = useState<PushCapabilityStatus>('default');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  // Closing this panel keeps the existing notification operation semantics.
  const keyboard = useListModalKeyboard(true, false, onClose, '[data-notification-close]', undefined, { cycleTab: true, lockScroll: true, restoreFocus: () => returnFocusRef?.current ?? null });
  const platform = browserPushPlatformContext();
  const needsIosInstallation = platform.isIos && !platform.isStandalone;

  useEffect(() => {
    let active = true;

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
    <div ref={keyboard.container} tabIndex={-1} onCompositionStartCapture={() => { keyboard.composing.current = true; }} onCompositionEndCapture={() => { keyboard.composing.current = false; }} className="ui-notification-overlay fixed inset-0 z-30 flex items-end bg-ui-text/35 font-ui text-ui-text md:items-center md:px-4" role="dialog" aria-modal="true" aria-labelledby="notification-settings-title">
      <section className="w-full max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-ui-sheet bg-ui-page p-ui-5 shadow-ui-sheet ui-safe-bottom md:mx-auto md:max-w-md md:rounded-ui-sheet">
        <div className="flex items-start justify-between gap-ui-4">
          <div className="flex min-w-0 items-start gap-ui-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-ui-control bg-ui-accent-soft text-ui-accent">
              {status === 'denied' || status === 'unsupported' ? <BellOff size={19} /> : <Bell size={19} />}
            </div>
            <div>
              <h2 id="notification-settings-title" className="text-ui-bar">通知设置</h2>
              <p className="mt-ui-1 text-ui-meta font-ui-medium text-ui-muted">{copy.title}</p>
            </div>
          </div>
          <button data-notification-close className="ui-focus grid h-11 w-11 shrink-0 place-items-center rounded-ui-control bg-ui-soft text-ui-muted" type="button" onClick={onClose} aria-label="关闭通知设置">
            <X size={19} />
          </button>
        </div>

        <p className="mt-ui-4 text-ui-meta leading-6 text-ui-muted">{copy.body}</p>
        {needsIosInstallation && status === 'unsupported' && (
          <p className="mt-ui-3 rounded-ui-control bg-ui-warning-soft px-ui-4 py-ui-3 text-ui-meta leading-6 text-ui-warning">
            请先将应用添加到主屏幕，并从主屏幕打开后启用通知。
          </p>
        )}
        {message && (
          <p className={`mt-ui-3 rounded-ui-control px-ui-4 py-ui-3 text-ui-meta leading-6 ${status === 'error' ? 'bg-ui-danger-soft text-ui-danger' : 'bg-ui-accent-soft text-ui-accent'}`} role="status">
            {message}
          </p>
        )}

        {(status === 'default' || status === 'granted' || status === 'error') && !needsIosInstallation && (
          <button className="ui-focus mt-ui-5 min-h-ui-touch w-full rounded-ui-control bg-ui-accent px-ui-3 font-ui-semibold text-ui-on-accent disabled:opacity-50" type="button" onClick={() => void enableNotifications()} disabled={busy}>
            {busy ? '正在开启' : '开启通知'}
          </button>
        )}

        {status === 'subscribed' && (
          <div className="mt-ui-5 space-y-ui-3">
            <button className="ui-focus flex min-h-ui-touch w-full items-center justify-center gap-ui-2 rounded-ui-control bg-ui-accent px-ui-3 font-ui-semibold text-ui-on-accent disabled:opacity-50" type="button" onClick={() => void sendTestPush()} disabled={busy}>
              <Send size={17} />
              {busy ? '正在发送' : '发送测试通知'}
            </button>
            <button className="ui-focus min-h-ui-touch w-full rounded-ui-control bg-ui-soft px-ui-3 text-ui-meta font-ui-semibold text-ui-muted disabled:opacity-50" type="button" onClick={() => void disableNotifications()} disabled={busy}>
              关闭此设备通知
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
