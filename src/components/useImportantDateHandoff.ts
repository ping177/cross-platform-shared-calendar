import { useCallback, useRef, useState } from 'react';
import { createRequestGuard } from '../lib/request-guard';

export type ImportantDateIdentityHandoff = { spaceId: string; importantDateId: string; returnTo: 'home' | 'calendar' };
export type PendingImportantDateHandoff = ImportantDateIdentityHandoff & { requestId: number };

// Transient interaction only; App's existing navigation still owns page restore.
export function useImportantDateHandoff(userId: string, onOpenModule: () => void) {
  const guard = useRef(createRequestGuard());
  const account = useRef({ userId, generation: 0 });
  if (account.current.userId !== userId) {
    guard.current.invalidate();
    account.current = { userId, generation: account.current.generation + 1 };
  }
  const navigate = useRef(onOpenModule);
  navigate.current = onOpenModule;
  const [state, setState] = useState<{ userId: string; generation: number; pending: PendingImportantDateHandoff | null; returnTo: ImportantDateIdentityHandoff['returnTo'] | null }>(
    { ...account.current, pending: null, returnTo: null });
  const open = useCallback((target: ImportantDateIdentityHandoff) => {
    if (!target.spaceId?.trim() || !target.importantDateId?.trim() || !['home', 'calendar'].includes(target.returnTo)) throw new Error('重要日目标无效。');
    const pending = { spaceId: target.spaceId, importantDateId: target.importantDateId, returnTo: target.returnTo, requestId: guard.current.begin() };
    setState({ ...account.current, pending, returnTo: pending.returnTo });
    navigate.current();
  }, []);
  const consume = useCallback((requestId: number) => {
    if (guard.current.isCurrent(requestId)) setState((current) => current.pending?.requestId === requestId ? { ...current, pending: null } : current);
  }, []);
  const reset = useCallback(() => {
    guard.current.invalidate();
    setState({ ...account.current, pending: null, returnTo: null });
  }, []);
  const current = state.userId === userId && state.generation === account.current.generation;
  return { pending: current ? state.pending : null, returnTo: current ? state.returnTo : null, open, consume, reset };
}
