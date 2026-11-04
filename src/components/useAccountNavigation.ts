import { useEffect, useId, useRef, useState } from 'react';

// Scope browser Back/Forward to this My-page instance; never persist an email.
export function useAccountNavigation(userId: string, scope: 'account' | 'export' = 'account') {
  const id = useId();
  const token = `${userId}:${id}`;
  const key = scope === 'account' ? 'calendarAccount' : 'calendarExport';
  const leaving = useRef(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const pop = (event: PopStateEvent) => { leaving.current = false; setOpen(event.state?.[key] === token); };
    window.addEventListener('popstate', pop);
    return () => {
      window.removeEventListener('popstate', pop);
      if (window.history.state?.[key] === token) {
        const { [key]: _account, ...rest } = window.history.state;
        window.history.replaceState(rest, '');
      }
    };
  }, [token, key]);
  return {
    open,
    enter() {
      leaving.current = false;
      if (window.history.state?.[key] !== token) {
        window.history.pushState({ ...window.history.state, [key]: token }, '');
      }
      setOpen(true);
    },
    back() {
      if (leaving.current) return;
      if (window.history.state?.[key] === token) { leaving.current = true; window.history.back(); }
      else setOpen(false);
    },
  };
}
