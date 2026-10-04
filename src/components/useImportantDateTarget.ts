import { useEffect, useRef, useState } from 'react';
import { readImportantDateTarget } from '../lib/important-dates-data';
import { createRequestGuard } from '../lib/request-guard';
import type { ModuleEntry } from '../lib/module-availability';
import type { CurrentSpace, ImportantDate } from '../types';
import type { PendingImportantDateHandoff } from './useImportantDateHandoff';

// Target scheduling/qualification only. Canonical objects publish to the local
// editor owner; neither a module list nor a Home presentation supplies them.
export function useImportantDateTarget(userId: string, handoff: PendingImportantDateHandoff | null | undefined, options: {
  entry?: ModuleEntry | null; entryPending?: boolean; memberSpaces?: CurrentSpace[]; sessionLost: boolean;
  onReady: (date: ImportantDate, space: CurrentSpace, requestId: number) => void;
  onLost: (requestId: number) => void;
  onUnavailable: (status: 'missing' | 'ineligible') => void;
  onOpening?: () => void; onHandled?: (requestId: number) => void; onNoEligible?: () => void;
}) {
  // Keep the completed read token after consumption, without retaining a target
  // or causing another read/reopen when App clears the one-time identity.
  const handoffReadId = useRef<number | undefined>(undefined);
  if (handoff) handoffReadId.current = handoff.requestId;
  const handledHandoff = useRef<number | undefined>(undefined);
  const targetGuard = useRef(createRequestGuard());
  const targetContext = useRef<{
    userId: string; requestId?: number; spaceId?: string; importantDateId?: string;
    scopeKey?: string; memberRole?: CurrentSpace['membershipRole']; eligibleRole?: CurrentSpace['membershipRole']; scopeRevision: number;
  }>({ userId, requestId: handoffReadId.current, spaceId: handoff?.spaceId, importantDateId: handoff?.importantDateId, scopeRevision: 0 });
  if (targetContext.current.userId !== userId || targetContext.current.requestId !== handoffReadId.current
    || (handoff && (targetContext.current.spaceId !== handoff.spaceId || targetContext.current.importantDateId !== handoff.importantDateId))) {
    targetGuard.current.invalidate();
    targetContext.current = { userId, requestId: handoffReadId.current, spaceId: handoff?.spaceId, importantDateId: handoff?.importantDateId, scopeRevision: 0 };
  }
  // Remember only confirmed target scope identity across an unknown/pending
  // UI hint. The exact reader still owns object and action qualification.
  if (options.entry && !options.entryPending && targetContext.current.spaceId) {
    const memberRole = options.entry.memberSpaces.find((space) => space.id === targetContext.current.spaceId)?.membershipRole;
    const eligibleRole = options.entry.eligibleSpaces.find((space) => space.id === targetContext.current.spaceId)?.membershipRole;
    const scopeKey = JSON.stringify([memberRole ?? null, eligibleRole ?? null]);
    const changed = targetContext.current.scopeKey !== undefined && targetContext.current.scopeKey !== scopeKey;
    const confirmedLoss = !memberRole || eligibleRole !== memberRole;
    if (targetContext.current.scopeKey !== scopeKey && (changed || confirmedLoss)) {
      targetGuard.current.invalidate(); targetContext.current.scopeRevision++;
    }
    Object.assign(targetContext.current, { scopeKey, memberRole, eligibleRole });
  }
  const membershipRole = options.memberSpaces?.find((space) => space.id === targetContext.current.spaceId)?.membershipRole;
  const membershipContext = useRef<{ identity: string; role?: CurrentSpace['membershipRole'] } | null>(null);
  if (options.memberSpaces) {
    const identity = JSON.stringify([userId, handoffReadId.current, targetContext.current.spaceId]);
    if (membershipContext.current?.identity === identity && membershipContext.current.role !== membershipRole) targetGuard.current.invalidate();
    membershipContext.current = { identity, role: membershipRole };
  }
  if (options.memberSpaces && targetContext.current.spaceId && (!membershipRole || (targetContext.current.memberRole !== undefined && membershipRole !== targetContext.current.memberRole))) {
    targetGuard.current.invalidate();
  }
  const targetScopeKey = targetContext.current.scopeRevision;
  const [targetRead, setTargetRead] = useState<{ requestId?: number; importantDateId?: string; space?: CurrentSpace; error: string; loading: boolean }>({ error: '', loading: false });
  const targetReadRef = useRef(targetRead);
  targetReadRef.current = targetRead;
  const callbacks = useRef(options); callbacks.current = options;
  const [targetRetry, setTargetRetry] = useState(0);
  const targetSpace = targetRead.requestId === handoffReadId.current ? targetRead.space : undefined;
  const targetEntryValid = (!options.memberSpaces || Boolean(targetSpace && membershipRole === targetSpace.membershipRole)) && (targetContext.current.scopeKey === undefined || Boolean(targetSpace
    && targetContext.current.memberRole === targetSpace.membershipRole && targetContext.current.eligibleRole === targetSpace.membershipRole));
  const targetCanAct = Boolean(targetSpace && targetEntryValid && !targetRead.loading && !targetRead.error && !options.sessionLost);
  function loseTarget(requestId: number) {
    if (handoffReadId.current !== requestId || (handledHandoff.current === requestId && !targetReadRef.current.space)) return;
    const pending = handledHandoff.current !== requestId;
    handledHandoff.current = requestId; targetGuard.current.invalidate();
    targetReadRef.current = { requestId, error: '', loading: false };
    setTargetRead(targetReadRef.current);
    callbacks.current.onLost(requestId);
    if (pending) callbacks.current.onHandled?.(requestId);
  }

  useEffect(() => {
    if (handoff && handledHandoff.current !== handoff.requestId) callbacks.current.onOpening?.();
  }, [handoff?.requestId]);

  useEffect(() => {
    if (!handoff || handledHandoff.current === handoff.requestId || options.sessionLost) return;
    if ((options.memberSpaces && !membershipRole) || (targetContext.current.scopeKey !== undefined && (!targetContext.current.memberRole
      || targetContext.current.eligibleRole !== targetContext.current.memberRole))) {
      loseTarget(handoff.requestId);
      if (options.entry && !options.entryPending && !options.entry.eligibleSpaces.length) callbacks.current.onNoEligible?.();
      return;
    }
    const request = targetGuard.current.begin();
    const current = () => targetGuard.current.isCurrent(request) && targetContext.current.requestId === handoff.requestId
      && handledHandoff.current !== handoff.requestId;
    setTargetRead({ requestId: handoff.requestId, importantDateId: handoff.importantDateId, error: '', loading: true });
    // Same-turn StrictMode cleanup invalidates the ticket before any I/O starts.
    void Promise.resolve().then(async () => {
      if (!current()) return;
      try {
        const result = await readImportantDateTarget(userId, { spaceId: handoff.spaceId, importantDateId: handoff.importantDateId });
        if (!current()) return;
        if (result.status === 'ready' && (result.date.id !== handoff.importantDateId || result.date.space_id !== handoff.spaceId || result.space.id !== handoff.spaceId)) throw new Error('重要日目标身份不一致，请重试。');
        if (result.status === 'ready' && options.memberSpaces && membershipRole !== result.space.membershipRole) throw new Error('重要日目标空间资格已变化，请刷新后重试。');
        if (result.status === 'ready' && targetContext.current.scopeKey !== undefined
          && (targetContext.current.memberRole !== result.space.membershipRole || targetContext.current.eligibleRole !== result.space.membershipRole)) {
          throw new Error('重要日目标空间资格已变化，请刷新后重试。');
        }
        handledHandoff.current = handoff.requestId;
        // Eligibility can finish before React commits this publication.
        targetReadRef.current = { requestId: handoff.requestId, importantDateId: handoff.importantDateId,
          space: result.status === 'ready' ? result.space : undefined, error: '', loading: false };
        setTargetRead(targetReadRef.current);
        if (result.status === 'ready') callbacks.current.onReady(result.date, result.space, handoff.requestId);
        else callbacks.current.onUnavailable(result.status);
        callbacks.current.onHandled?.(handoff.requestId);
      } catch (error) {
        if (!current()) return;
        setTargetRead({ requestId: handoff.requestId, importantDateId: handoff.importantDateId, loading: false,
          error: error instanceof Error && /[\u3400-\u9fff]/u.test(error.message) ? error.message : '重要日目标读取失败，请重试。' });
      }
    });
    return () => targetGuard.current.invalidate();
  }, [userId, handoff?.requestId, handoff?.spaceId, handoff?.importantDateId, targetRetry, targetScopeKey, membershipRole, options.sessionLost]);

  // Transient UI availability does not revoke exact qualification. Confirmed
  // target scope loss still closes the interaction; the list never supplies it.
  useEffect(() => {
    if (!targetSpace || targetEntryValid) return;
    loseTarget(handoffReadId.current!);
  }, [targetSpace, targetEntryValid, options.entry, options.entryPending]);

  useEffect(() => () => targetGuard.current.invalidate(), []);
  useEffect(() => { if (options.sessionLost) { targetGuard.current.invalidate(); clear(); } }, [options.sessionLost]);
  function clear() {
    targetGuard.current.invalidate(); handledHandoff.current = handoffReadId.current;
    targetReadRef.current = { requestId: handoffReadId.current, error: '', loading: false };
    setTargetRead(targetReadRef.current);
  }
  return { targetRead, targetSpace, targetCanAct, loseTarget, clear,
    retry: () => setTargetRetry((value) => value + 1) };
}
