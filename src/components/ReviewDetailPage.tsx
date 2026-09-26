import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { correctReviewDate, readPreviousPlan, readReviewDetail } from '../lib/review-detail-data';
import { canLeaveReviewDetail, formatReviewDate, ReviewUnavailableError, type ReviewDetail, type ReviewDetailTarget } from '../lib/review-detail';
import { loadReviewEligibility } from '../lib/review-history-data';
import { createRequestGuard } from '../lib/request-guard';
import { supabase } from '../lib/supabase';
import { ReviewEntryEditor } from './ReviewEntryEditor';
import { ReviewReadOnlyEntry } from './ReviewReadOnlyEntry';

function detailError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (/Review module is disabled/i.test(message)) return '当前空间的回顾模块已关闭，暂时无法修改日期。';
  if (/Current review participant membership is required|permission denied|row-level security/i.test(message)) return '你的成员身份或本轮参与权限已变化，请刷新后重试。';
  return /[\u3400-\u9fff]/u.test(message) ? message : fallback;
}

export function ReviewDetailPanels({ detail, userId, mobilePanel, onMobilePanelChange, onDirtyChange }: {
  detail: ReviewDetail;
  userId: string;
  mobilePanel: 'mine' | 'other';
  onMobilePanelChange: (panel: 'mine' | 'other') => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const shared = detail.other !== null;
  return <>
    {shared && <div className="mt-4 grid grid-cols-2 gap-2 md:hidden" role="tablist" aria-label="回顾参与者">
      <button className={`min-h-11 rounded-lg font-semibold ${mobilePanel === 'mine' ? 'bg-teal text-white' : 'bg-white text-ink'}`} id="review-mine-tab" type="button" role="tab" aria-selected={mobilePanel === 'mine'} aria-controls="review-mine-panel" onClick={() => onMobilePanelChange('mine')}>我的</button>
      <button className={`min-h-11 rounded-lg font-semibold ${mobilePanel === 'other' ? 'bg-teal text-white' : 'bg-white text-ink'}`} id="review-other-tab" type="button" role="tab" aria-selected={mobilePanel === 'other'} aria-controls="review-other-panel" onClick={() => onMobilePanelChange('other')}>对方</button>
    </div>}
    <div className={`mt-4 grid min-w-0 gap-4 ${shared ? 'md:grid-cols-2 md:items-start' : ''}`}>
      <div className={`min-w-0 ${shared && mobilePanel !== 'mine' ? 'hidden md:block' : ''}`} id="review-mine-panel" role={shared ? 'tabpanel' : undefined} aria-labelledby={shared ? 'review-mine-tab' : undefined}>
        <h2 className="mb-2 font-semibold">我</h2>
        <ReviewEntryEditor reviewId={detail.round.id} userId={userId} onDirtyChange={onDirtyChange} />
      </div>
      {detail.other && <div className={`min-w-0 ${mobilePanel !== 'other' ? 'hidden md:block' : ''}`} id="review-other-panel" role="tabpanel" aria-labelledby="review-other-tab">
        <h2 className="mb-2 font-semibold">对方</h2>
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
  const detailGuard = useRef(createRequestGuard());
  const previousGuard = useRef(createRequestGuard());

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
    if (submittingDate.current) return;
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
      if (loadError instanceof ReviewUnavailableError || /登录状态已变化/u.test(loadError instanceof Error ? loadError.message : '')) {
        previousGuard.current.invalidate();
        detailRef.current = null;
        setDetail(null);
        setDirty(false);
        setDateOpen(false);
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
    if (phase === 'ready' && !canLeaveReviewDetail(dirty, () => window.confirm('有未保存的回顾内容，确定返回历史列表吗？'))) return;
    onBack();
  }

  function openDate() {
    if (!detail) return;
    setDateDraft(detail.round.review_date);
    setDateError('');
    setDateOpen(true);
  }

  async function saveDate(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !dateDraft || submittingDate.current) return;
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

  return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-4 safe-bottom">
    <header className="flex min-h-11 min-w-0 items-center gap-3">
      <button className="inline-flex min-h-11 shrink-0 items-center gap-1 font-semibold text-teal" type="button" onClick={back}><ChevronLeft size={18} />回顾列表</button>
      <span className="min-w-0 break-words text-sm text-ink/60">回顾详情</span>
    </header>
    {phase === 'loading' && <p className="mt-4" role="status">正在读取回顾详情…</p>}
    {phase === 'error' && <div className="mt-4" role="alert">{error}<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void refreshDetail()}>重试</button></div>}
    {phase === 'unavailable' && <p className="mt-4 rounded-lg bg-white p-4 text-sm text-ink/70 shadow-sm" role="alert">这次回顾暂不可访问，请返回历史列表。</p>}
    {phase === 'ready' && detail && <>
      <section className="mt-4 min-w-0 rounded-lg bg-white p-4 shadow-sm">
        <h1 className="break-words text-xl font-bold">{formatReviewDate(detail.round.review_date)}</h1>
        <button className="mt-2 min-h-11 text-sm font-semibold text-teal" type="button" aria-label="更正回顾日期" onClick={openDate}>更正日期</button>
      </section>
      {refreshError && <div className="mt-3 text-sm text-coral" role="alert">{refreshError}<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void refreshDetail()}>重试</button></div>}
      {target.justCreated && <section className="mt-4 min-w-0 rounded-lg bg-white p-4 shadow-sm" aria-label="上一份计划参考">
        <h2 className="font-semibold">上一份计划</h2>
        <p className="mt-1 text-xs text-ink/60">仅供参考，不会复制到本次回顾。</p>
        {previousState === 'loading' && <p className="mt-3 text-sm text-ink/60" role="status">正在读取上一份计划…</p>}
        {previousState === 'error' && <p className="mt-3 text-sm text-coral" role="alert">上一份计划暂时无法读取。<button className="ml-2 min-h-11 font-semibold text-teal" type="button" onClick={() => void refreshPrevious(detail.round)}>重试</button></p>}
        {previousState === 'ready' && <div className="mt-3 h-36 min-w-0 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-ink/15 bg-mist/30 px-4 py-3 text-sm">{previousPlan ?? '上一份计划暂无内容'}</div>}
      </section>}
      <ReviewDetailPanels detail={detail} userId={userId} mobilePanel={mobilePanel} onMobilePanelChange={setMobilePanel} onDirtyChange={setDirty} />
    </>}
    {dateOpen && detail && <div className="fixed inset-0 z-40 flex items-end bg-ink/50 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="review-date-title" onClick={(event) => { if (event.target === event.currentTarget && !dateBusy) setDateOpen(false); }}>
      <form className="mx-auto w-full max-w-md rounded-lg bg-white p-5 shadow-soft safe-bottom" onSubmit={(event) => void saveDate(event)}>
        <h2 id="review-date-title" className="text-lg font-bold">更正回顾日期</h2>
        <p className="mt-2 text-sm text-ink/65">当前日期：{formatReviewDate(detail.round.review_date)}</p>
        <label className="mt-4 block text-sm font-semibold" htmlFor="review-corrected-date">回顾日期</label>
        <input id="review-corrected-date" className="mt-2 min-h-11 w-full rounded-lg border border-ink/20 px-3" type="date" required value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} disabled={dateBusy} />
        {dateError && <p className="mt-3 text-sm text-coral" role="alert">{dateError}</p>}
        <div className="mt-5 flex justify-end gap-2"><button className="min-h-11 rounded-lg bg-mist px-4 font-semibold" type="button" disabled={dateBusy} onClick={() => setDateOpen(false)}>取消</button><button className="min-h-11 rounded-lg bg-teal px-4 font-semibold text-white disabled:opacity-50" type="submit" disabled={dateBusy || !dateDraft}>{dateBusy ? '保存中…' : '保存日期'}</button></div>
      </form>
    </div>}
  </main>;
}
