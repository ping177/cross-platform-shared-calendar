import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { correctReviewDate, deleteReviewRound, readPreviousPlan, readReviewDetail } from '../lib/review-detail-data';
import { canLeaveReviewDetail, formatReviewDate, ReviewUnavailableError, type ReviewDetail, type ReviewDetailTarget } from '../lib/review-detail';
import { loadReviewEligibility } from '../lib/review-history-data';
import { createRequestGuard } from '../lib/request-guard';
import { supabase } from '../lib/supabase';
import { ReviewEntryEditor } from './ReviewEntryEditor';
import { ReviewReadOnlyEntry } from './ReviewReadOnlyEntry';
import { useListModalKeyboard } from './ListSheets';

function detailError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (/Review module is disabled/i.test(message)) return '当前空间的回顾模块已关闭，暂时无法修改或删除回顾。';
  if (/Current review participant membership is required|permission denied|row-level security/i.test(message)) return '你的成员身份或本轮参与权限已变化，请刷新后重试。';
  return /[\u3400-\u9fff]/u.test(message) ? message : fallback;
}

export function ReviewDetailPanels({ detail, userId, mobilePanel, onMobilePanelChange, onDirtyChange, startEditing = false }: {
  detail: ReviewDetail;
  userId: string;
  mobilePanel: 'mine' | 'other';
  startEditing?: boolean;
  onMobilePanelChange: (panel: 'mine' | 'other') => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const shared = detail.other !== null;
  return <>
    {shared && <div className="mt-ui-6 grid grid-cols-2 gap-ui-2 md:hidden" role="tablist" aria-label="回顾参与者">
      <button className={`ui-focus min-h-ui-touch rounded-ui-control text-ui-meta font-ui-semibold ${mobilePanel === 'mine' ? 'bg-ui-accent-soft text-ui-accent' : 'bg-ui-surface text-ui-muted'}`} id="review-mine-tab" type="button" role="tab" aria-selected={mobilePanel === 'mine'} aria-controls="review-mine-panel" onClick={() => onMobilePanelChange('mine')}>我的</button>
      <button className={`ui-focus min-h-ui-touch rounded-ui-control text-ui-meta font-ui-semibold ${mobilePanel === 'other' ? 'bg-ui-accent-soft text-ui-accent' : 'bg-ui-surface text-ui-muted'}`} id="review-other-tab" type="button" role="tab" aria-selected={mobilePanel === 'other'} aria-controls="review-other-panel" onClick={() => onMobilePanelChange('other')}>对方</button>
    </div>}
    <div className={`mt-4 grid min-w-0 gap-4 ${shared ? 'md:grid-cols-2 md:items-start' : ''}`}>
      <div className={`min-w-0 ${shared && mobilePanel !== 'mine' ? 'hidden md:block' : ''}`} id="review-mine-panel" role={shared ? 'tabpanel' : undefined} aria-labelledby={shared ? 'review-mine-tab' : undefined}>
        <h2 className="mb-ui-3 text-ui-section">我</h2>
        <ReviewEntryEditor reviewId={detail.round.id} userId={userId} startEditing={startEditing} onDirtyChange={onDirtyChange} />
      </div>
      {detail.other && <div className={`min-w-0 ${mobilePanel !== 'other' ? 'hidden md:block' : ''}`} id="review-other-panel" role="tabpanel" aria-labelledby="review-other-tab">
        <h2 className="mb-ui-3 text-ui-section">对方</h2>
        <ReviewReadOnlyEntry entry={detail.other} />
      </div>}
    </div>
  </>;
}

export function ReviewDetailPage({ target, userId, onBack, onDirtyChange, onUnavailable }: { target: ReviewDetailTarget; userId: string; onBack: () => void; onDirtyChange: (dirty: boolean) => void; onUnavailable?: (reason: 'space' | 'review') => void }) {
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const detailRef = useRef<ReviewDetail | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading');
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [previousState, setPreviousState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [previousPlan, setPreviousPlan] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'mine' | 'other'>('mine');
  const [dirty, setDirty] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [dateError, setDateError] = useState('');
  const [dateBusy, setDateBusy] = useState(false);
  const submittingDate = useRef(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleting = useRef(false);
  const detailGuard = useRef(createRequestGuard());
  const previousGuard = useRef(createRequestGuard());
  const deleteKeyboard = useListModalKeyboard(deleteOpen, deleteBusy, () => setDeleteOpen(false), '[data-review-delete-cancel]', deleting);

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  async function refreshPrevious(round: ReviewDetail['round']) {
    if (!target.justCreated) return;
    const request = previousGuard.current.begin();
    setPreviousState('loading');
    try {
      const plan = await readPreviousPlan(supabase, round, userId);
      if (!previousGuard.current.isCurrent(request)) return;
      setPreviousPlan(plan);
      setPreviousState('ready');
    } catch {
      if (previousGuard.current.isCurrent(request)) setPreviousState('error');
    }
  }

  async function refreshDetail() {
    if (submittingDate.current || deleting.current) return;
    const request = detailGuard.current.begin();
    let spaceEligible = false;
    setRefreshError('');
    try {
      const eligible = await loadReviewEligibility(userId);
      if (!detailGuard.current.isCurrent(request)) return;
      const space = eligible.find((item) => item.id === target.spaceId);
      if (!space) throw new ReviewUnavailableError();
      spaceEligible = true;
      const loaded = await readReviewDetail(supabase, space, target.reviewId, userId);
      if (!detailGuard.current.isCurrent(request)) return;
      detailRef.current = loaded;
      setDetail(loaded);
      setPhase('ready');
      void refreshPrevious(loaded.round);
    } catch (loadError) {
      if (!detailGuard.current.isCurrent(request)) return;
      if (loadError instanceof ReviewUnavailableError) {
        previousGuard.current.invalidate();
        detailRef.current = null;
        setDetail(null);
        setDirty(false);
        setDateOpen(false);
        setDeleteOpen(false);
        setPhase('unavailable');
        if (loadError instanceof ReviewUnavailableError) onUnavailable?.(spaceEligible ? 'review' : 'space');
      } else if (detailRef.current) {
        setRefreshError(detailError(loadError, '回顾刷新失败，请重试。'));
      } else {
        setError(detailError(loadError, '回顾详情读取失败，请重试。'));
        setPhase('error');
      }
    }
  }

  useEffect(() => {
    void refreshDetail();
    const onFocus = () => { void refreshDetail(); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      detailGuard.current.invalidate();
      previousGuard.current.invalidate();
    };
  }, [target.spaceId, target.reviewId, target.justCreated, userId]);

  function back() {
    if (deleting.current || submittingDate.current) return;
    if (phase === 'ready' && !canLeaveReviewDetail(dirty, () => window.confirm('有未保存的回顾内容，确定返回历史列表吗？'))) return;
    onBack();
  }

  function openDate() {
    if (!detail || deleteOpen || deleting.current || submittingDate.current) return;
    setDateDraft(detail.round.review_date);
    setDateError('');
    setDateOpen(true);
  }

  async function saveDate(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !dateDraft || submittingDate.current || deleting.current) return;
    submittingDate.current = true;
    detailGuard.current.invalidate();
    setDateBusy(true);
    setDateError('');
    try {
      const changed = await correctReviewDate(supabase, detail.round, dateDraft, userId);
      if (detailRef.current?.round.id !== changed.id) return;
      const updated = { ...detailRef.current, round: changed };
      detailRef.current = updated;
      setDetail(updated);
      void refreshPrevious(changed);
      setDateOpen(false);
    } catch (saveError) {
      if (detailRef.current?.round.id === detail.round.id) setDateError(detailError(saveError, '日期更正失败，请检查网络或空间状态后重试。'));
    } finally {
      submittingDate.current = false;
      setDateBusy(false);
    }
  }

  async function removeReview() {
    if (!detail || !deleteOpen || deleting.current || submittingDate.current) return;
    deleting.current = true;
    const request = detailGuard.current.begin();
    previousGuard.current.invalidate();
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await deleteReviewRound(supabase, detail.round, userId);
      if (!detailGuard.current.isCurrent(request)) return;
      detailRef.current = null;
      setDetail(null);
      setDirty(false);
      onDirtyChange(false);
      setPhase('unavailable');
      // Existing unavailable callback clears the retained history snapshot.
      if (onUnavailable) onUnavailable('review');
      else onBack();
    } catch (deleteFailure) {
      if (detailGuard.current.isCurrent(request)) setDeleteError(detailError(deleteFailure, '删除回顾失败，请刷新确认状态后重试。'));
    } finally {
      deleting.current = false;
      setDeleteBusy(false);
    }
  }

  return <main className="ui-review-page mx-auto min-h-screen w-full max-w-5xl bg-ui-page px-ui-4 py-ui-6 font-ui text-ui-text ui-safe-bottom">
    <header className="flex min-h-11 min-w-0 items-center gap-3">
      <button className="ui-focus inline-flex min-h-ui-touch shrink-0 items-center gap-ui-1 rounded-ui-control text-ui-meta font-ui-semibold text-ui-accent" type="button" onClick={back}><ChevronLeft size={18} />回顾列表</button>
      <span className="min-w-0 break-words text-ui-meta text-ui-muted">回顾详情</span>
    </header>
    {phase === 'loading' && <p className="mt-4" role="status">正在读取回顾详情…</p>}
    {phase === 'error' && <div className="mt-4" role="alert">{error}<button className="ui-focus ml-ui-2 min-h-ui-touch min-w-11 rounded-ui-control font-ui-semibold text-ui-accent" type="button" onClick={() => void refreshDetail()}>重试</button></div>}
    {phase === 'unavailable' && <p className="mt-ui-4 rounded-ui-group border border-ui-border bg-ui-surface p-ui-4 text-ui-meta text-ui-muted" role="alert">这次回顾暂不可访问，请返回历史列表。</p>}
    {phase === 'ready' && detail && <>
      <section className="mt-ui-6 min-w-0">
        <h1 className="break-words text-ui-page-title">{formatReviewDate(detail.round.review_date)}</h1>
        <p className="mt-ui-1 text-ui-meta text-ui-muted">第 {detail.round.round_no} 次回顾</p>
        <button className="ui-focus mt-ui-2 min-h-ui-touch min-w-11 rounded-ui-control text-ui-meta font-ui-semibold text-ui-accent" type="button" aria-label="更正回顾日期" disabled={dateBusy || deleteBusy} onClick={openDate}>更正日期</button>
      </section>
      {refreshError && <div className="mt-3 text-ui-meta text-ui-danger" role="alert">{refreshError}<button className="ui-focus ml-ui-2 min-h-ui-touch min-w-11 rounded-ui-control font-ui-semibold text-ui-accent" type="button" onClick={() => void refreshDetail()}>重试</button></div>}
      {target.justCreated && <section className="mt-ui-6 min-w-0 rounded-ui-group border border-ui-border bg-ui-surface p-ui-4" aria-label="上一份计划参考">
        <h2 className="text-ui-list font-ui-semibold">上一份计划</h2>
        <p className="mt-ui-1 text-ui-meta text-ui-muted">仅供参考，不会复制到本次回顾。</p>
        {previousState === 'loading' && <p className="mt-ui-3 text-ui-meta text-ui-muted" role="status">正在读取上一份计划…</p>}
        {previousState === 'error' && <p className="mt-3 text-ui-meta text-ui-danger" role="alert">上一份计划暂时无法读取。<button className="ui-focus ml-ui-2 min-h-ui-touch min-w-11 rounded-ui-control font-ui-semibold text-ui-accent" type="button" onClick={() => void refreshPrevious(detail.round)}>重试</button></p>}
        {previousState === 'ready' && <div className="mt-ui-3 max-h-36 min-w-0 overflow-y-auto whitespace-pre-wrap break-words text-ui-body text-ui-muted">{previousPlan ?? '上一份计划暂无内容'}</div>}
      </section>}
      <fieldset className="min-w-0" disabled={deleteBusy}>
      <ReviewDetailPanels detail={detail} userId={userId} mobilePanel={mobilePanel} onMobilePanelChange={setMobilePanel} onDirtyChange={setDirty} startEditing={target.justCreated} />
      </fieldset>
      <section className="mt-ui-6 border-t border-ui-border pt-ui-4">
        <button className="ui-focus min-h-ui-touch rounded-ui-control px-ui-3 text-ui-meta font-ui-semibold text-ui-danger disabled:opacity-50" type="button" disabled={deleteBusy || dateBusy} onClick={() => { if (!deleting.current && !submittingDate.current) { setDeleteError(''); setDeleteOpen(true); } }}>{deleteBusy ? '删除中…' : '删除回顾'}</button>
      </section>
    </>}
    {deleteOpen && detail && <div ref={deleteKeyboard.container} tabIndex={-1} className="ui-space-confirm-overlay font-ui" role="dialog" aria-modal="true" aria-labelledby="review-delete-title" aria-describedby="review-delete-description">
      <div className="ui-space-confirm mx-auto w-full max-w-md rounded-lg bg-white p-5 shadow-soft safe-bottom">
        <h2 id="review-delete-title" className="text-lg font-bold">删除回顾</h2>
        <p className="mt-3 break-words text-sm leading-6">{formatReviewDate(detail.round.review_date)} · 第 {detail.round.round_no} 次回顾</p>
        <p id="review-delete-description" className="mt-3 text-sm leading-6">{detail.other ? '本次双方填写的全部内容将永久删除，无法恢复。' : '本次填写的全部内容将永久删除，无法恢复。'}{dirty && '尚未保存的内容也将丢弃。'}</p>
        {deleteError && <p className="mt-3 text-sm text-coral" role="alert">{deleteError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button data-review-delete-cancel className="min-h-11 rounded-lg bg-mist px-4 font-semibold" type="button" disabled={deleteBusy} onClick={() => { if (!deleting.current) setDeleteOpen(false); }}>取消</button>
          <button className="min-h-11 rounded-lg bg-coral px-4 font-semibold text-white disabled:opacity-50" type="button" disabled={deleteBusy} onClick={() => void removeReview()}>{deleteBusy ? '删除中…' : '永久删除回顾'}</button>
        </div>
      </div>
    </div>}
    {dateOpen && detail && <div className="fixed inset-0 z-40 flex items-end bg-ink/50 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="review-date-title" onClick={(event) => { if (event.target === event.currentTarget && !dateBusy) setDateOpen(false); }}>
      <form className="ui-review-date-form mx-auto w-full max-w-md rounded-ui-sheet bg-ui-page p-ui-5 shadow-ui-sheet ui-safe-bottom" onSubmit={(event) => void saveDate(event)}>
        <h2 id="review-date-title" className="text-ui-section">更正回顾日期</h2>
        <p className="mt-ui-2 text-ui-meta text-ui-muted">当前日期：{formatReviewDate(detail.round.review_date)}</p>
        <label className="mt-ui-4 block text-ui-meta font-ui-semibold" htmlFor="review-corrected-date">回顾日期</label>
        <input id="review-corrected-date" className="ui-focus mt-ui-2 min-h-ui-touch w-full min-w-0 rounded-ui-control border border-ui-control bg-ui-surface px-ui-3 text-ui-body" type="date" required value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} disabled={dateBusy} />
        {dateError && <p className="mt-3 text-ui-meta text-ui-danger" role="alert">{dateError}</p>}
        <div className="mt-5 flex justify-end gap-2"><button className="ui-focus min-h-ui-touch min-w-11 rounded-ui-control bg-ui-soft px-ui-4 font-ui-semibold" type="button" disabled={dateBusy} onClick={() => setDateOpen(false)}>取消</button><button className="ui-focus min-h-ui-touch min-w-11 rounded-ui-control bg-ui-accent px-ui-4 font-ui-semibold text-ui-on-accent disabled:opacity-50" type="submit" disabled={dateBusy || !dateDraft}>{dateBusy ? '保存中…' : '保存日期'}</button></div>
      </form>
    </div>}
  </main>;
}
