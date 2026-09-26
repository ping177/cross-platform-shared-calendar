import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { createReviewRound, loadReviewEligibility, loadReviewHistoryPage } from '../lib/review-history-data';
import { canCreateReview, localReviewDate, mergeReviewPages, selectReviewSpace, type ReviewHistoryRow } from '../lib/review-history';
import { reviewDetailTarget, type ReviewDetailTarget } from '../lib/review-detail';
import { createRequestGuard } from '../lib/request-guard';
import { readSpaceMembers } from '../lib/space-members';
import { supabase } from '../lib/supabase';
import type { CurrentSpace, ReviewRound } from '../types';

function message(error: unknown, fallback: string): string {
  const text = error instanceof Error ? error.message : '';
  return /[\u3400-\u9fff]/u.test(text) ? text : fallback;
}

export function ReviewHistoryRows({ rows, onOpenDetail }: { rows: ReviewHistoryRow[]; onOpenDetail: (target: ReviewDetailTarget) => void }) {
  return <div className="space-y-2">{rows.map((row) => <button key={row.round.id} className="block min-h-16 w-full min-w-0 rounded-lg bg-white px-4 py-3 text-left shadow-sm" type="button" aria-label={`打开 ${row.round.review_date} 回顾，我：${row.mine}${row.other !== null ? `，对方：${row.other}` : ''}`} onClick={() => onOpenDetail(reviewDetailTarget(row.round, false))} data-review-id={row.round.id}>
    <time className="block font-semibold" dateTime={row.round.review_date}>{row.round.review_date}</time>
    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/70"><span>我：{row.mine}</span>{row.other !== null && <span>对方：{row.other}</span>}</span>
  </button>)}</div>;
}

export function ReviewHistorySummary({ totalCount }: { totalCount: number }) {
  return <p className="text-sm text-ink/60">共 {totalCount} 篇回顾</p>;
}

export function ReviewHistoryPage({ userId, currentSpaceId, onSpaceChange, onOpenDetail, onHubBack }: { userId: string; currentSpaceId: string | null; onSpaceChange: (id: string | null) => void; onOpenDetail: (target: ReviewDetailTarget) => void; onHubBack: () => void }) {
  const [spaces, setSpaces] = useState<CurrentSpace[]>([]);
  const [eligibilityStatus, setEligibilityStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [eligibilityError, setEligibilityError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(currentSpaceId);
  const selectedRef = useRef<string | null>(currentSpaceId);
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<ReviewHistoryRow[]>([]);
  const [cursor, setCursor] = useState<Pick<ReviewRound, 'review_date' | 'round_no'> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'more' | 'error'>('loading');
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

  const selectedSpace = spaces.find((space) => space.id === selectedId) ?? null;
  const canCreate = selectedSpace !== null && memberCount !== null && canCreateReview(selectedSpace, memberCount);

  async function refreshEligibility() {
    const request = eligibilityGuard.current.begin();
    setEligibilityStatus('loading');
    setEligibilityError('');
    try {
      const eligible = await loadReviewEligibility(userId);
      if (!eligibilityGuard.current.isCurrent(request)) return;
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
        setCursor(null);
        setHasMore(false);
        setTotalCount(null);
        setCreateOpen(false);
      } else if (nextId !== priorId) {
        setCreateOpen(false);
        setMemberCount(null);
      }
      setEligibilityStatus('ready');
      setRevision((value) => value + 1);
    } catch (error) {
      if (!eligibilityGuard.current.isCurrent(request)) return;
      setEligibilityStatus('error');
      setEligibilityError(message(error, '回顾空间读取失败，请重试。'));
    }
  }

  useEffect(() => {
    void refreshEligibility();
    const onFocus = () => { void refreshEligibility(); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      eligibilityGuard.current.invalidate();
      historyGuard.current.invalidate();
      membersGuard.current.invalidate();
    };
  }, [userId]);

  function selectSpace(id: string) {
    if (!spaces.some((space) => space.id === id) || id === selectedRef.current) return;
    selectedRef.current = id;
    onSpaceChange(id);
    historyGuard.current.invalidate();
    membersGuard.current.invalidate();
    setSelectedId(id);
    setRows([]);
    setCursor(null);
    setHasMore(false);
    setTotalCount(null);
    setMemberCount(null);
    setCreateOpen(false);
  }

  async function readPage(space: CurrentSpace, nextCursor: Pick<ReviewRound, 'review_date' | 'round_no'> | null, reset: boolean) {
    const request = historyGuard.current.begin();
    setHistoryStatus(reset ? 'loading' : 'more');
    setHistoryError('');
    try {
      const page = await loadReviewHistoryPage(supabase, space, userId, nextCursor);
      if (!historyGuard.current.isCurrent(request) || selectedRef.current !== space.id) return;
      setRows((current) => reset ? page.rows : mergeReviewPages(current, page.rows));
      setCursor(page.rows[page.rows.length - 1]?.round ?? nextCursor);
      setHasMore(page.hasMore);
      if (page.totalCount !== null) setTotalCount(page.totalCount);
      setHistoryStatus('ready');
    } catch (error) {
      if (!historyGuard.current.isCurrent(request) || selectedRef.current !== space.id) return;
      setHistoryStatus('error');
      setHistoryError(message(error, '回顾历史读取失败，请重试。'));
    }
  }

  useEffect(() => {
    historyGuard.current.invalidate();
    membersGuard.current.invalidate();
    setRows([]);
    setCursor(null);
    setHasMore(false);
    setTotalCount(null);
    setMemberCount(null);
    setMemberError('');
    if (!selectedSpace) return;
    void readPage(selectedSpace, null, true);
    const request = membersGuard.current.begin();
    void readSpaceMembers(selectedSpace.id).then((members) => {
      if (membersGuard.current.isCurrent(request) && selectedRef.current === selectedSpace.id) setMemberCount(members.length);
    }).catch(() => {
      if (membersGuard.current.isCurrent(request) && selectedRef.current === selectedSpace.id) setMemberError('无法确认当前成员，请刷新后重试。');
    });
    return () => { historyGuard.current.invalidate(); membersGuard.current.invalidate(); };
  }, [selectedSpace?.id, revision]);

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedSpace || !canCreate || creating.current || !reviewDate) return;
    creating.current = true;
    setCreateBusy(true);
    setCreateError('');
    try {
      const created = await createReviewRound(supabase, selectedSpace.id, reviewDate, userId);
      if (selectedRef.current !== selectedSpace.id) return;
      setCreateOpen(false);
      onOpenDetail(reviewDetailTarget(created, true));
    } catch (error) {
      if (selectedRef.current === selectedSpace.id) setCreateError(message(error, '创建失败，请确认空间成员与模块状态后重试。'));
    } finally {
      creating.current = false;
      setCreateBusy(false);
    }
  }

  return <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-4 safe-bottom">
    <header className="flex min-h-11 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <button className="inline-flex min-h-11 shrink-0 items-center gap-1 font-semibold text-teal" type="button" onClick={onHubBack}><ChevronLeft size={18} />功能中心</button>
        <h1 className="text-xl font-bold">回顾</h1>
      </div>
      {selectedSpace && <button className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg bg-teal text-white disabled:opacity-40" type="button" aria-label="新建回顾" disabled={!canCreate || eligibilityStatus !== 'ready'} onClick={() => { setReviewDate(localReviewDate(new Date())); setCreateError(''); setCreateOpen(true); }}><Plus size={22} /></button>}
    </header>
    {eligibilityStatus === 'error' && <div className="mt-4" role="alert">{eligibilityError}<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void refreshEligibility()}>重试</button></div>}
    {eligibilityStatus === 'loading' && !selectedSpace && <p className="mt-4" role="status">正在读取回顾空间…</p>}
    {eligibilityStatus === 'ready' && !selectedSpace && <p className="mt-4 rounded-lg bg-white p-4 text-sm text-ink/65 shadow-sm">当前没有已开启回顾的空间。可在空间管理中开启。</p>}
    {selectedSpace && <>
      <label className="mt-4 block text-sm font-semibold" htmlFor="review-space">空间</label>
      <select id="review-space" className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-ink/20 bg-white px-3" value={selectedSpace.id} onChange={(event) => selectSpace(event.target.value)}>
        {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
      </select>
      {selectedSpace.kind === 'shared' && memberCount === 1 && <p className="mt-3 text-sm text-ink/65">当前共享空间需要两名成员才能新建回顾；已有历史仍可查看。</p>}
      {memberError && <p className="mt-3 text-sm text-coral" role="alert">{memberError}</p>}
      <section className="mt-5" aria-label="历史回顾">
        {totalCount !== null && <div className="mb-3 flex min-w-0 items-baseline justify-between gap-3"><h2 className="font-semibold">历史回顾</h2><ReviewHistorySummary totalCount={totalCount} /></div>}
        {historyStatus === 'loading' && <p role="status">正在读取历史回顾…</p>}
        {historyStatus === 'error' && <div role="alert">{historyError}<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void readPage(selectedSpace, rows.length ? cursor : null, rows.length === 0)}>重试</button></div>}
        {historyStatus !== 'loading' && rows.length === 0 && historyStatus !== 'error' && <p className="rounded-lg bg-white p-4 text-sm text-ink/65 shadow-sm">还没有回顾记录</p>}
        <ReviewHistoryRows rows={rows} onOpenDetail={onOpenDetail} />
        {hasMore && historyStatus !== 'loading' && <button className="mt-4 min-h-11 w-full rounded-lg bg-white px-4 font-semibold text-teal shadow-sm disabled:opacity-50" type="button" disabled={historyStatus === 'more' || historyStatus === 'error'} onClick={() => void readPage(selectedSpace, cursor, false)}>{historyStatus === 'more' ? '加载中…' : '加载更多'}</button>}
        <button className="mt-3 min-h-11 text-sm font-semibold text-teal" type="button" onClick={() => void refreshEligibility()}>刷新</button>
      </section>
    </>}
    {createOpen && selectedSpace && <div className="fixed inset-0 z-40 flex items-end bg-ink/50 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="review-create-title" onClick={(event) => { if (event.target === event.currentTarget && !createBusy) setCreateOpen(false); }}>
      <form className="mx-auto w-full max-w-md rounded-lg bg-white p-5 shadow-soft safe-bottom" onSubmit={(event) => void submitCreate(event)}>
        <h2 id="review-create-title" className="text-lg font-bold">新建回顾</h2>
        <p className="mt-3 break-all text-sm">目标空间：<strong>{selectedSpace.name}</strong></p>
        <label className="mt-4 block text-sm font-semibold" htmlFor="review-date">回顾日期</label>
        <input id="review-date" className="mt-2 min-h-11 w-full rounded-lg border border-ink/20 px-3" type="date" required value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} disabled={createBusy} />
        {createError && <p className="mt-3 text-sm text-coral" role="alert">{createError}</p>}
        <div className="mt-5 flex justify-end gap-2"><button className="min-h-11 rounded-lg bg-mist px-4 font-semibold" type="button" disabled={createBusy} onClick={() => setCreateOpen(false)}>取消</button><button className="min-h-11 rounded-lg bg-teal px-4 font-semibold text-white disabled:opacity-50" type="submit" disabled={createBusy || !canCreate || !reviewDate}>{createBusy ? '创建中…' : '确认创建'}</button></div>
      </form>
    </div>}
  </main>;
}
