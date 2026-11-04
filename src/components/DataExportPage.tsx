import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { readPersonalCalendarExport, verifyPersonalExportAccess } from '../lib/personal-export';
import { createExportDownload, requestExportSave } from '../lib/data-export-save';
import { useMobileSwipe } from './useMobileSwipe';

type Archive = { file: File; spaceId: string };
export default function DataExportPage({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [spaceName, setSpaceName] = useState<string | null>(null);
  const [archive, setArchive] = useState<Archive | null>(null);
  const [download, setDownload] = useState<ReturnType<typeof createExportDownload> | null>(null);
  const [phase, setPhase] = useState('loading');
  const [message, setMessage] = useState('正在核验个人空间…');
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState<{ mode: 'system' | 'download'; revision: number; expires: number } | null>(null);
  const revision = useRef(0), controller = useRef(new AbortController()), alive = useRef(false), busy = useRef(false);
  const currentArchive = useRef(archive); currentArchive.current = archive;

  function invalidate(message = '') {
    controller.current.abort(); controller.current = new AbortController(); revision.current++;
    currentArchive.current = null; busy.current = false;
    setArchive(null); setPrepared(null); setMessage(''); setError(message); setPhase('idle');
  }
  async function load() {
    invalidate(); const request = revision.current; busy.current = true; setPhase('loading'); setMessage('正在核验个人空间…');
    try {
      const access = await verifyPersonalExportAccess(supabase, userId, controller.current.signal);
      if (!alive.current || request !== revision.current) return;
      setSpaceName(String(access.space.name)); setMessage('可导出个人空间的全部日程及重复例外。');
    } catch { if (alive.current && request === revision.current) { setSpaceName(null); setError('无法确认个人空间权限，请重试。'); setMessage(''); } }
    finally { if (alive.current && request === revision.current) { busy.current = false; setPhase('idle'); } }
  }
  useEffect(() => {
    alive.current = true; void load();
    const auth = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive.current) return;
      if (!session || session.user.id !== userId) { setSpaceName(null); invalidate('登录状态已变化，导出结果已清除。'); }
    });
    const channel = supabase.channel(`personal-export:${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'space_members', filter: `user_id=eq.${userId}` }, () => {
      if (!alive.current) return;
      setSpaceName(null); invalidate('空间成员关系已变化，请重新核验。');
    }).subscribe();
    const focus = async () => {
      const file = currentArchive.current;
      if (!file || busy.current || document.visibilityState === 'hidden') return;
      const request = revision.current; setPrepared(null); busy.current = true; setPhase('checking');
      try { await verifyPersonalExportAccess(supabase, userId, controller.current.signal, file.spaceId); }
      catch { if (alive.current && request === revision.current) { setSpaceName(null); invalidate('访问权限无法确认，导出结果已清除。'); } }
      finally { if (alive.current && request === revision.current) { busy.current = false; setPhase('idle'); } }
    };
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => { alive.current = false; revision.current++; controller.current.abort(); currentArchive.current = null; auth.data.subscription.unsubscribe(); void supabase.removeChannel(channel); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [userId]);
  useEffect(() => {
    setDownload(null);
    if (!archive) return;
    try { const target = createExportDownload(archive.file); setDownload(target); return () => target.dispose(); }
    catch { setError('无法准备下载，请重新生成。'); }
  }, [archive]);

  async function generate() {
    if (busy.current) return;
    invalidate(); const request = revision.current, signal = controller.current.signal;
    busy.current = true; setPhase('generating'); setMessage('正在读取日程并生成 ZIP…');
    try {
      const input = await readPersonalCalendarExport(supabase, userId, signal);
      const { generateExportZip } = await import('../lib/data-export-archive');
      const result = await generateExportZip(input);
      const spaceId = String(input.spaces[0].tables.space[0].id);
      await verifyPersonalExportAccess(supabase, userId, signal, spaceId);
      if (!alive.current || request !== revision.current) return;
      setArchive({ spaceId, file: new File([result.bytes as Uint8Array<ArrayBuffer>], result.filename, { type: 'application/zip' }) });
      setMessage(`阶段性 ZIP 已生成（日程 ${input.spaces[0].tables.events.length} 条，重复例外 ${input.spaces[0].tables.event_occurrence_exceptions.length} 条），尚未保存。`);
    } catch { if (alive.current && request === revision.current) { setError('导出失败，未提供 ZIP。请重试。'); setMessage(''); } }
    finally { if (alive.current && request === revision.current) { busy.current = false; setPhase('idle'); } }
  }
  async function prepareSave(mode: 'system' | 'download') {
    if (busy.current || !archive || !download) return;
    busy.current = true; const request = revision.current; setPhase('checking'); setError(''); setPrepared(null);
    try {
      await verifyPersonalExportAccess(supabase, userId, controller.current.signal, archive.spaceId);
      if (alive.current && request === revision.current) { setPrepared({ mode, revision: request, expires: Date.now() + 10000 }); setMessage('权限已核验，请点击确认保存。'); }
    } catch { if (alive.current && request === revision.current) { setSpaceName(null); invalidate('访问权限无法确认，导出结果已清除。'); } }
    finally { if (alive.current && request === revision.current) { busy.current = false; setPhase('idle'); } }
  }
  async function confirmSave() {
    if (busy.current || !prepared || !archive || !download || prepared.revision !== revision.current) return;
    if (Date.now() > prepared.expires) { setPrepared(null); setMessage('保存确认已过期，请重新核验保存。'); return; }
    busy.current = true; setPhase('sharing'); const request = revision.current;
    const result = await requestExportSave(archive.file, download.click, prepared.mode === 'download' ? {} : navigator);
    if (!alive.current || request !== revision.current) return;
    setPrepared(null); busy.current = false; setPhase('idle');
    setMessage({ 'share-dispatched': '系统已接收分享请求，请自行确认文件是否保存。', 'download-requested': '已请求浏览器下载，请确认文件是否保存。', cancelled: '已取消分享，可重试保存。', failed: '保存请求失败，可重试或使用下载 ZIP。' }[result]);
  }
  const leave = () => { invalidate(); onBack(); };
  const swipe = useMobileSwipe({ enabled: phase !== 'sharing', scope: `${userId}:export`, direction: 'right', onSwipe: leave });
  const disabled = phase !== 'idle';
  return <main {...swipe} className="mx-auto min-h-[100dvh] w-full max-w-3xl bg-ui-page px-ui-4 py-ui-4 font-ui text-ui-text safe-bottom">
    <header className="ui-spaces-header flex min-h-11 items-center gap-ui-3"><button type="button" className="ui-focus inline-flex min-h-11 shrink-0 items-center gap-ui-1 rounded-ui-control text-ui-meta font-ui-semibold text-ui-accent" onClick={leave}><ChevronLeft size={18} aria-hidden="true" />账户管理</button><h1 className="min-w-0 flex-1 break-all text-ui-section">导出数据</h1></header>
    <p className="mt-ui-4 text-ui-meta text-ui-muted">本阶段仅导出个人空间日程及重复例外。任务、清单、重要日、回顾等尚未纳入，这不是完整备份。</p>
    {spaceName !== null && <p className="mt-ui-4 break-all text-ui-body">个人空间：{spaceName || '未命名个人空间'}</p>}
    <div className="ui-my-links">
      {spaceName !== null && <button type="button" className="ui-space-entry ui-account-card ui-focus" disabled={disabled} onClick={() => void generate()}><span className="ui-account-label">{phase === 'generating' ? '生成中…' : archive ? '重新生成 ZIP' : '生成 ZIP'}</span></button>}
      {spaceName === null && phase === 'idle' && <button type="button" className="ui-space-entry ui-account-card ui-focus" onClick={() => void load()}>重试核验个人空间</button>}
      {archive && <><p className="break-all text-ui-meta">{archive.file.name}</p>{prepared ? <button type="button" className="ui-space-entry ui-account-card ui-focus" disabled={disabled} onClick={() => void confirmSave()}>确认保存 ZIP</button> : <><button type="button" className="ui-space-entry ui-account-card ui-focus" disabled={disabled || !download} onClick={() => void prepareSave('system')}>保存 ZIP</button><button type="button" className="ui-focus min-h-11 text-ui-accent" disabled={disabled || !download} onClick={() => void prepareSave('download')}>下载 ZIP</button></>}</>}
      {(phase === 'generating' || prepared) && <button type="button" className="ui-focus min-h-11 text-ui-accent" onClick={() => { invalidate(); setMessage('已取消，可重新生成。'); }}>取消</button>}
    </div>
    <p className="mt-ui-4 text-ui-meta" role="status" aria-live="polite">{phase === 'checking' ? '正在核验保存权限…' : message}</p>
    {error && <p className="mt-ui-4 text-ui-meta text-ui-danger" role="alert">{error}</p>}
  </main>;
}
