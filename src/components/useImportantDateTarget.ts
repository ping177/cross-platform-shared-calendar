import { useEffect, useRef, useState } from 'react';
import { readImportantDateTarget } from '../lib/important-dates-data';
import { createRequestGuard } from '../lib/request-guard';
import type { ModuleEntry } from '../lib/module-availability';
import type { CurrentSpace, ImportantDate } from '../types';

export type ImportantDateIdentity = { spaceId: string; importantDateId: string };
export type ImportantDateTargetRequest = ImportantDateIdentity & { requestId: number };

// Target scheduling/qualification only. Canonical objects publish to the local
// editor owner; neither a module list nor a Home presentation supplies them.
export function useImportantDateTarget(userId: string, identity: ImportantDateTargetRequest | null | undefined, options: {
  entry?: ModuleEntry | null; entryPending?: boolean; memberSpaces?: CurrentSpace[]; sessionLost: boolean;
  onReady: (date: ImportantDate, space: CurrentSpace, requestId: number) => void;
  onLost: (requestId: number) => void;
  onUnavailable: (status: 'missing' | 'ineligible') => void;
  onOpening?: () => void;
}) {
  // Keep the completed request token so rerenders never reread or reopen a target.
  const targetReadId = useRef<number | undefined>(undefined);
  if (identity) targetReadId.current = identity.requestId;
  const handledTarget = useRef<number | undefined>(undefined);
  const targetGuard = useRef(createRequestGuard());
  const targetContext = useRef<{
    userId: string; requestId?: number; spaceId?: string; importantDateId?: string;
    scopeKey?: string; memberRole?: CurrentSpace['membershipRole']; eligibleRole?: CurrentSpace['membershipRole']; scopeRevision: number;
  }>({ userId, requestId: targetReadId.current, spaceId: identity?.spaceId, importantDateId: identity?.importantDateId, scopeRevision: 0 });
  if (targetContext.current.userId !== userId || targetContext.current.requestId !== targetReadId.current
    || (identity && (targetContext.current.spaceId !== identity.spaceId || targetContext.current.importantDateId !== identity.importantDateId))) {
    targetGuard.current.invalidate();
    targetContext.current = { userId, requestId: targetReadId.current, spaceId: identity?.spaceId, importantDateId: identity?.importantDateId, scopeRevision: 0 };
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
    const identity = JSON.stringify([userId, targetReadId.current, targetContext.current.spaceId]);
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
  const targetSpace = targetRead.requestId === targetReadId.current ? targetRead.space : undefined;
  const targetEntryValid = (!options.memberSpaces || Boolean(targetSpace && membershipRole === targetSpace.membershipRole)) && (targetContext.current.scopeKey === undefined || Boolean(targetSpace
    && targetContext.current.memberRole === targetSpace.membershipRole && targetContext.current.eligibleRole === targetSpace.membershipRole));
  const targetCanAct = Boolean(targetSpace && targetEntryValid && !targetRead.loading && !targetRead.error && !options.sessionLost);
  function loseTarget(requestId: number) {
    if (targetReadId.current !== requestId || (handledTarget.current === requestId && !targetReadRef.current.space)) return;
    handledTarget.current = requestId; targetGuard.current.invalidate();
    targetReadRef.current = { requestId, error: '', loading: false };
    setTargetRead(targetReadRef.current);
    callbacks.current.onLost(requestId);
  }

  useEffect(() => {
    if (identity && handledTarget.current !== identity.requestId) callbacks.current.onOpening?.();
  }, [identity?.requestId]);

  useEffect(() => {
    if (!identity || handledTarget.current === identity.requestId || options.sessionLost) return;
    if ((options.memberSpaces && !membershipRole) || (targetContext.current.scopeKey !== undefined && (!targetContext.current.memberRole
      || targetContext.current.eligibleRole !== targetContext.current.memberRole))) {
      loseTarget(identity.requestId);
      return;
    }
    const request = targetGuard.current.begin();
    const current = () => targetGuard.current.isCurrent(request) && targetContext.current.requestId === identity.requestId
      && handledTarget.current !== identity.requestId;
    setTargetRead({ requestId: identity.requestId, importantDateId: identity.importantDateId, error: '', loading: true });
    // Same-turn StrictMode cleanup invalidates the ticket before any I/O starts.
    void Promise.resolve().then(async () => {
      if (!current()) return;
      try {
        const result = await readImportantDateTarget(userId, { spaceId: identity.spaceId, importantDateId: identity.importantDateId });
        if (!current()) return;
        if (result.status === 'ready' && (result.date.id !== identity.importantDateId || result.date.space_id !== identity.spaceId || result.space.id !== identity.spaceId)) throw new Error('重要日目标身份不一致，请重试。');
        if (result.status === 'ready' && options.memberSpaces && membershipRole !== result.space.membershipRole) throw new Error('重要日目标空间资格已变化，请刷新后重试。');
        if (result.status === 'ready' && targetContext.current.scopeKey !== undefined
          && (targetContext.current.memberRole !== result.space.membershipRole || targetContext.current.eligibleRole !== result.space.membershipRole)) {
          throw new Error('重要日目标空间资格已变化，请刷新后重试。');
        }
        handledTarget.current = identity.requestId;
        // Eligibility can finish before React commits this publication.
        targetReadRef.current = { requestId: identity.requestId, importantDateId: identity.importantDateId,
          space: result.status === 'ready' ? result.space : undefined, error: '', loading: false };
        setTargetRead(targetReadRef.current);
        if (result.status === 'ready') callbacks.current.onReady(result.date, result.space, identity.requestId);
        else callbacks.current.onUnavailable(result.status);
      } catch (error) {
        if (!current()) return;
        setTargetRead({ requestId: identity.requestId, importantDateId: identity.importantDateId, loading: false,
          error: error instanceof Error && /[\u3400-\u9fff]/u.test(error.message) ? error.message : '重要日目标读取失败，请重试。' });
      }
    });
    return () => targetGuard.current.invalidate();
  }, [userId, identity?.requestId, identity?.spaceId, identity?.importantDateId, targetRetry, targetScopeKey, membershipRole, options.sessionLost]);

  // Transient UI availability does not revoke exact qualification. Confirmed
  // target scope loss still closes the interaction; the list never supplies it.
  useEffect(() => {
    if (!targetSpace || targetEntryValid) return;
    loseTarget(targetReadId.current!);
  }, [targetSpace, targetEntryValid, options.entry, options.entryPending]);

  useEffect(() => () => targetGuard.current.invalidate(), []);
  useEffect(() => { if (options.sessionLost) { targetGuard.current.invalidate(); clear(); } }, [options.sessionLost]);
  function clear() {
    targetGuard.current.invalidate(); handledTarget.current = targetReadId.current;
    targetReadRef.current = { requestId: targetReadId.current, error: '', loading: false };
    setTargetRead(targetReadRef.current);
  }
  return { targetRead, targetSpace, targetCanAct, loseTarget, clear,
    retry: () => setTargetRetry((value) => value + 1) };
}
