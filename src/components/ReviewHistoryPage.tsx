import { useMobileSwipe } from './useMobileSwipe';
import type { SwipeClickGuard } from '../lib/mobile-swipe';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { createReviewRound, loadReviewEligibility, loadReviewHistoryPage } from '../lib/review-history-data';
import { canCreateReview, localReviewDate, mergeReviewPages, selectReviewSpace, type ReviewHistoryRow } from '../lib/review-history';
import { reviewDetailTarget, type ReviewDetailTarget } from '../lib/review-detail';
import { createRequestGuard } from '../lib/request-guard';
import { readSpaceMembers } from '../lib/space-members';
import { sameModuleScope, type ModuleEntry } from '../lib/module-availability';
import { supabase } from '../lib/supabase';
import type { CurrentSpace, ReviewRound } from '../types';

function message(error: unknown, fallback: string): string {
  const text = error instanceof Error ? error.message : '';
  return /[\u3400-\u9fff]/u.test(text) ? text : fallback;
}

export type ReviewHistorySnapshot = {
  selectedSpaceId: string;
  rows: ReviewHistoryRow[];
  cursor: Pick<ReviewRound, 'review_date' | 'round_no'> | null;
  hasMore: boolean;
  totalCount: number | null;
};

export function ReviewHistoryRows({ rows, onOpenDetail }: { rows: ReviewHistoryRow[]; onOpenDetail: (target: ReviewDetailTarget) => void }) {
  if (!rows.length) return null;
  return <div className="ui-review-rows rounded-ui-group border border-ui-border bg-ui-surface">{rows.map((row) => <button data-swipe-start key={row.round.id} className="ui-review-row ui-focus w-full min-w-0 text-left" type="button" aria-label={`打开 ${row.round.review_date} 回顾，我：${row.mine}${row.other !== null ? `，对方：${row.other}` : ''}`} onClick={() => onOpenDetail(reviewDetailTarget(row.round, false))} data-review-id={row.round.id}>
    <CalendarDays size={22} className="ui-review-row-icon text-ui-auxiliary" aria-hidden="true" />
    <span className="min-w-0"><time className="block text-ui-list font-ui-semibold text-ui-text" dateTime={row.round.review_date}>{row.round.review_date}</time><span className="mt-ui-1 block text-ui-meta text-ui-muted">第 {row.round.round_no} 次</span></span>
    <span className="ui-review-row-status text-ui-label text-ui-muted"><span>我：{row.mine}</span>{row.other !== null && <span>对方：{row.other}</span>}</span>
    <ChevronRight size={16} className="ui-review-row-chevron text-ui-muted" aria-hidden="true" />
  </button>)}</div>;
}

export function ReviewHistorySummary({ totalCount }: { totalCount: number }) {
  return <p className="text-ui-meta text-ui-muted">共 {totalCount} 篇回顾</p>;
}

export function ReviewHistoryPage({ swipeClickGuard, userId, entry = null, entryPending = false, initialSnapshot, onValidated, onInvalidateEligibility, currentSpaceId, onSpaceChange, onOpenDetail, onHubBack, onNoEligible }: { swipeClickGuard?: SwipeClickGuard; userId: string; entry?: ModuleEntry | null; entryPending?: boolean; initialSnapshot?: ReviewHistorySnapshot; onValidated?: (snapshot: ReviewHistorySnapshot) => void; onInvalidateEligibility?: () => void; currentSpaceId: string | null; onSpaceChange: (id: string | null) => void; onOpenDetail: (target: ReviewDetailTarget) => void; onHubBack: () => void; onNoEligible?: () => void }) {
  const [spaces, setSpaces] = useState<CurrentSpace[]>(entry?.eligibleSpaces ?? []);
  const [eligibilityStatus, setEligibilityStatus] = useState<'loading' | 'ready' | 'error'>(entry ? 'ready' : 'loading');
  const [eligibilityError, setEligibilityError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => selectReviewSpace(currentSpaceId, entry?.eligibleSpaces ?? []));
  const selectedRef = useRef<string | null>(selectReviewSpace(currentSpaceId, entry?.eligibleSpaces ?? []));
  const initialEntry = useRef(entry);
  const [rows, setRows] = useState<ReviewHistoryRow[]>(initialSnapshot?.rows ?? []);
  const rowsRef = useRef(initialSnapshot?.rows ?? []);
  const [cursor, setCursor] = useState<Pick<ReviewRound, 'review_date' | 'round_no'> | null>(initialSnapshot?.cursor ?? null);
  const [hasMore, setHasMore] = useState(initialSnapshot?.hasMore ?? false);
  const [totalCount, setTotalCount] = useState<number | null>(initialSnapshot?.totalCount ?? null);
  const totalCountRef = useRef(initialSnapshot?.totalCount ?? null);
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'more' | 'error'>(initialSnapshot ? 'ready' : 'loading');
  const [historyError, setHistoryError] = useState('');
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [memberError, setMemberError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewDate, setReviewDate] = useState(() => localReviewDate(new Date()));
  const [createError, setCreateError] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const creating = useRef(false);
  const eligibilityGuard = useRef(createRequestGuard());
  const historyGuard = useRef(createRequestGuard());
  const membersGuard = useRef(createRequestGuard());
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const onValidatedRef = useRef(onValidated);
  onValidatedRef.current = onValidated;

  const selectedSpace = spaces.find((space) => space.id === selectedId) ?? null;
  const lostScope = Boolean(entry && initialEntry.current && !sameModuleScope(entry, initialEntry.current.memberSpaces, initialEntry.current.eligibleSpaces));
  const canCreate = selectedSpace !== null && memberCount !== null && canCreateReview(selectedSpace, memberCount);
  const canMutate = Boolean(entry) && !entryPending && !lostScope && eligibilityStatus === 'ready';

  function applyEligibility(eligible: CurrentSpace[], rereadSameSpace: boolean, scopeChanged = false) {
    if (!eligible.length && onNoEligible) { onNoEligible(); return; }
    const priorId = selectedRef.current;
    const nextId = selectReviewSpace(priorId, eligible);
    selectedRef.current = nextId;
    setSpaces(eligible);
    setSelectedId(nextId);
    if (nextId !== priorId) onSpaceChange(nextId);
    if (!nextId) {
      historyGuard.current.invalidate();
      membersGuard.current.invalidate();
      setRows([]);
      rowsRef.current = [];
      setCursor(null);
      setHasMore(false);
      setTotalCount(null);
      totalCountRef.current = null;
      setCreateOpen(false);
    } else if (nextId !== priorId || scopeChanged) {
      historyGuard.current.invalidate();
      membersGuard.current.invalidate();
      setRows([]);
      rowsRef.current = [];
      setCursor(null);
      setHasMore(false);
      setTotalCount(null);
      totalCountRef.current = null;
      setCreateOpen(false);
      setMemberCount(null);
      setHistoryStatus('loading');
      const space = eligible.find((item) => item.id === nextId);
      if (space && scopeChanged && nextId === priorId) { void readPage(space, null, true); void readMembers(space); }
    } else if (rereadSameSpace) {
      const space = eligible.find((item) => item.id === nextId);
      if (space) { void readPage(space, null, true, true); void readMembers(space); }
    }
    setEligibilityStatus('ready');
  }

  async function refreshEligibility() {
    const request = eligibilityGuard.current.begin();
    setEligibilityStatus('loading');
    setEligibilityError('');
    try {
      const eligible = await loadReviewEligibility(userId);
      if (eligibilityGuard.current.isCurrent(request)) {
        if (entry && eligible.map((space) => space.id).join(',') !== entry.eligibleSpaces.map((space) => space.id).join(',')) onInvalidateEligibility?.();
        applyEligibility(eligible, true);
      }
    } catch (error) {
      if (!eligibilityGuard.current.isCurrent(request)) return;
      onInvalidateEligibility?.();
      setEligibilityStatus('error');
      setEligibilityError(message(error, '回顾空间读取失败，请重试。'));
    }
  }

  useEffect(() => {
    if (entry && currentSpaceId !== selectedRef.current) onSpaceChange(selectedRef.current);
    if (entryPending) {
      eligibilityGuard.current.invalidate();
      historyGuard.current.invalidate();
      membersGuard.current.invalidate();
      return;
    }
    if (entry) {
      eligibilityGuard.current.invalidate();
      const reread = initialEntry.current !== entry;
      const scopeChanged = Boolean(initialEntry.current && !sameModuleScope(entry, initialEntry.current.memberSpaces, initialEntry.current.eligibleSpaces));
      initialEntry.current = entry;
      applyEligibility(entry.eligibleSpaces, reread, scopeChanged);
    } else void refreshEligibility();
  }, [entry, entryPending, userId]);

  useEffect(() => () => {
    eligibilityGuard.current.invalidate();
    historyGuard.current.invalidate();
    membersGuard.current.invalidate();
  }, [userId]);

  function selectSpace(id: string) {
    if (!spaces.some((space) => space.id === id) || id === selectedRef.current) return;
    selectedRef.current = id;
    onSpaceChange(id);
    historyGuard.current.invalidate();
    membersGuard.current.invalidate();
    setSelectedId(id);
    setRows([]);
    rowsRef.current = [];
    setCursor(null);
    setHasMore(false);
    setTotalCount(null);
    totalCountRef.current = null;
    setMemberCount(null);
    setCreateOpen(false);
  }

  async function readPage(space: CurrentSpace, nextCursor: Pick<ReviewRound, 'review_date' | 'round_no'> | null, reset: boolean, background = false) {
    const request = historyGuard.current.begin();
    const readEntry = entryRef.current;
    if (!background) setHistoryStatus(reset ? 'loading' : 'more');
    setHistoryError('');
    try {
      const page = await loadReviewHistoryPage(supabase, space, userId, nextCursor);
      if (!historyGuard.current.isCurrent(request) || selectedRef.current !== space.id
        || (readEntry && !sameModuleScope(entryRef.current, readEntry.memberSpaces, readEntry.eligibleSpaces))) return;
      const nextRows = reset ? page.rows : mergeReviewPages(rowsRef.current, page.rows);
      const nextPageCursor = page.rows[page.rows.length - 1]?.round ?? nextCursor;
      const nextTotalCount = page.totalCount ?? totalCountRef.current;
      rowsRef.current = nextRows;
      totalCountRef.current = nextTotalCount;
      setRows(nextRows);
      setCursor(nextPageCursor);
      setHasMore(page.hasMore);
      if (page.totalCount !== null) setTotalCount(page.totalCount);
      setHistoryStatus('ready');
      if (readEntry && sameModuleScope(entryRef.current, readEntry.memberSpaces, readEntry.eligibleSpaces)) {
        onValidatedRef.current?.({ selectedSpaceId: space.id, rows: nextRows, cursor: nextPageCursor, hasMore: page.hasMore, totalCount: nextTotalCount });
      }
    } catch (error) {
      if (!historyGuard.current.isCurrent(request) || selectedRef.current !== space.id
        || (readEntry && !sameModuleScope(entryRef.current, readEntry.memberSpaces, readEntry.eligibleSpaces))) return;
      setHistoryStatus(background ? 'ready' : 'error');
      setHistoryError(message(error, '回顾历史读取失败，请重试。'));
    }
  }

  function readMembers(space: CurrentSpace) {
    const request = membersGuard.current.begin();
    setMemberCount(null);
    setMemberError('');
    void readSpaceMembers(space.id).then((members) => {
      if (membersGuard.current.isCurrent(request) && selectedRef.current === space.id) setMemberCount(members.length);
    }).catch(() => {
      if (membersGuard.current.isCurrent(request) && selectedRef.current === space.id) setMemberError('无法确认当前成员，请刷新后重试。');
    });
  }

  useEffect(() => {
    historyGuard.current.invalidate();
    membersGuard.current.invalidate();
    const retained = Boolean(selectedSpace && initialSnapshot?.selectedSpaceId === selectedSpace.id);
    if (!retained) {
      setRows([]);
      rowsRef.current = [];
      setCursor(null);
      setHasMore(false);
      setTotalCount(null);
      totalCountRef.current = null;
    }
    setMemberCount(null);
    setMemberError('');
    if (!selectedSpace) return;
    void readPage(selectedSpace, null, true, retained);
    readMembers(selectedSpace);
    return () => { historyGuard.current.invalidate(); membersGuard.current.invalidate(); };
  }, [selectedSpace?.id]);

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedSpace || !canCreate || !canMutate || creating.current || !reviewDate) return;
    creating.current = true;
    setCreateBusy(true);
    setCreateError('');
    try {
      const created = await createReviewRound(supabase, selectedSpace.id, reviewDate, userId);
      if (selectedRef.current !== selectedSpace.id) return;
      setCreateOpen(false);
      onOpenDetail(reviewDetailTarget(created, true));
    } catch (error) {
      onInvalidateEligibility?.();
      if (selectedRef.current === selectedSpace.id) setCreateError(message(error, '创建失败，请确认空间成员与模块状态后重试。'));
    } finally {
      creating.current = false;
      setCreateBusy(false);
    }
  }

  const swipe = useMobileSwipe({ enabled: !createOpen && !createBusy, scope: `${userId}:${selectedId}`,
    direction: 'right', clickGuard: swipeClickGuard, onSwipe: onHubBack });

  return <main {...swipe} className="ui-review-page mx-auto min-h-screen w-full max-w-3xl bg-ui-page px-ui-4 py-ui-6 font-ui text-ui-text ui-safe-bottom">
    <header className="flex min-h-11 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <button className="ui-focus inline-flex min-h-ui-touch shrink-0 items-center gap-ui-1 rounded-ui-control text-ui-meta font-ui-semibold text-ui-accent" type="button" onClick={onHubBack}><ChevronLeft size={18} />功能中心</button>
        <h1 className="text-ui-page-title">回顾</h1>
      </div>
      {selectedSpace && <button className="grid h-11 w-11 shrink-0 place-items-center bg-transparent text-ui-accent hover:text-ui-accent-strong ui-focus disabled:text-ui-muted" type="button" aria-label="新建回顾" disabled={!canMutate || !canCreate} onClick={() => { setReviewDate(localReviewDate(new Date())); setCreateError(''); setCreateOpen(true); }}><Plus size={18} aria-hidden="true" /></button>}
    </header>
    {eligibilityStatus === 'error' && <div className="mt-4" role="alert">{eligibilityError}<button className="ui-focus ml-ui-2 min-h-ui-touch min-w-11 rounded-ui-control font-ui-semibold text-ui-accent" type="button" onClick={() => void refreshEligibility()}>重试</button></div>}
    {eligibilityStatus === 'loading' && !selectedSpace && <p className="mt-4" role="status">正在读取回顾空间…</p>}
    {eligibilityStatus === 'ready' && !selectedSpace && <p className="mt-ui-4 rounded-ui-group border border-ui-border bg-ui-surface p-ui-4 text-ui-meta text-ui-muted">当前没有已开启回顾的空间。可在空间管理中开启。</p>}
    {selectedSpace && <>
      <label className="mt-ui-6 block text-ui-meta font-ui-semibold" htmlFor="review-space">空间</label>
      <select id="review-space" className="ui-focus mt-ui-2 min-h-ui-touch w-full min-w-0 rounded-ui-control border border-ui-control bg-ui-surface px-ui-3 text-ui-body" value={selectedSpace.id} disabled={entryPending} onChange={(event) => selectSpace(event.target.value)}>
        {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
      </select>
      {selectedSpace.kind === 'shared' && memberCount === 1 && <p className="mt-ui-3 text-ui-meta text-ui-muted">当前共享空间需要两名成员才能新建回顾；已有历史仍可查看。</p>}
      {memberError && <p className="mt-3 text-ui-meta text-ui-danger" role="alert">{memberError}</p>}
      <section className="mt-ui-7" aria-label="历史回顾">
        {totalCount !== null && <div className="mb-3 flex min-w-0 items-baseline justify-between gap-3"><h2 className="text-ui-section">历史回顾</h2><ReviewHistorySummary totalCount={totalCount} /></div>}
        {(historyStatus === 'loading' || lostScope) && <p role="status">正在读取历史回顾…</p>}
        {historyError && <div role="alert">{historyError}<button className="ui-focus ml-ui-2 min-h-ui-touch min-w-11 rounded-ui-control font-ui-semibold text-ui-accent" type="button" onClick={() => void (historyStatus === 'ready' ? readPage(selectedSpace, null, true, true) : readPage(selectedSpace, rows.length ? cursor : null, rows.length === 0))}>重试</button></div>}
        {historyStatus !== 'loading' && rows.length === 0 && historyStatus !== 'error' && <p className="rounded-ui-group border border-ui-border bg-ui-surface p-ui-6 text-ui-meta text-ui-muted">还没有回顾记录</p>}
        {!lostScope && <ReviewHistoryRows rows={rows} onOpenDetail={onOpenDetail} />}
        {!lostScope && hasMore && historyStatus !== 'loading' && <button className="ui-focus mt-ui-4 min-h-ui-touch w-full rounded-ui-control border border-ui-control bg-ui-surface px-ui-4 font-ui-semibold text-ui-accent disabled:opacity-50" type="button" disabled={historyStatus === 'more' || historyStatus === 'error'} onClick={() => void readPage(selectedSpace, cursor, false)}>{historyStatus === 'more' ? '加载中…' : '加载更多'}</button>}
        <button className="ui-focus mt-ui-3 min-h-ui-touch min-w-11 rounded-ui-control text-ui-meta font-ui-semibold text-ui-accent disabled:opacity-50" type="button" disabled={entryPending} onClick={() => void refreshEligibility()}>刷新</button>
      </section>
    </>}
    {createOpen && selectedSpace && <div className="fixed inset-0 z-40 flex items-end bg-ink/50 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="review-create-title" onClick={(event) => { if (event.target === event.currentTarget && !createBusy) setCreateOpen(false); }}>
      <form className="ui-review-create-form mx-auto w-full max-w-md rounded-ui-sheet bg-ui-page p-ui-5 shadow-ui-sheet ui-safe-bottom" onSubmit={(event) => void submitCreate(event)}>
        <h2 id="review-create-title" className="text-ui-section">新建回顾</h2>
        <p className="mt-ui-3 break-words text-ui-meta text-ui-muted">目标空间：<strong>{selectedSpace.name}</strong></p>
        <label className="mt-ui-6 block text-ui-meta font-ui-semibold" htmlFor="review-date">回顾日期</label>
        <input id="review-date" className="ui-focus mt-ui-2 min-h-ui-touch w-full min-w-0 rounded-ui-control border border-ui-control bg-ui-surface px-ui-3 text-ui-body" type="date" required value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} disabled={createBusy} />
        {createError && <p className="mt-3 text-ui-meta text-ui-danger" role="alert">{createError}</p>}
        <div className="mt-5 flex justify-end gap-2"><button className="ui-focus min-h-ui-touch min-w-11 rounded-ui-control bg-ui-soft px-ui-4 font-ui-semibold" type="button" disabled={createBusy} onClick={() => setCreateOpen(false)}>取消</button><button className="ui-focus min-h-ui-touch min-w-11 rounded-ui-control bg-ui-accent px-ui-4 font-ui-semibold text-ui-on-accent disabled:opacity-50" type="submit" disabled={createBusy || !canMutate || !canCreate || !reviewDate}>{createBusy ? '创建中…' : '确认创建'}</button></div>
      </form>
    </div>}
  </main>;
}
