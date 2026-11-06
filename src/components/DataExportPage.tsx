import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { listExportSpaces, readSpaceExport, verifyExportAccess } from '../lib/space-export';
import { generateExportZip } from '../lib/data-export-archive';
import type { ExportRow } from '../lib/data-export-format';
import { createExportDownload, requestExportSave, supportsExportFileShare } from '../lib/data-export-save';
import { useMobileSwipe } from './useMobileSwipe';

type Archive = { file: File; spaceIds: string[] };
export default function DataExportPage({ userId, onBack, backLabel = '账户管理' }: { userId: string; onBack: () => void; backLabel?: string }) {
  const [spaces, setSpaces] = useState<ExportRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const [loaded, setLoaded] = useState(false);
  const [archive, setArchive] = useState<Archive | null>(null);
  const [download, setDownload] = useState<ReturnType<typeof createExportDownload> | null>(null);
  const [phase, setPhase] = useState('loading');
  const [message, setMessage] = useState('正在核验可访问空间…');
  const [error, setError] = useState('');
  const [shareFailed, setShareFailed] = useState(false);
  const [prepared, setPrepared] = useState<{ mode: 'system' | 'download'; revision: number; expires: number } | null>(null);
  const revision = useRef(0), controller = useRef(new AbortController()), alive = useRef(false), busy = useRef(false);
  const currentArchive = useRef(archive); currentArchive.current = archive;

  function invalidate(message = '') {
    controller.current.abort(); controller.current = new AbortController(); revision.current++;
    currentArchive.current = null; busy.current = false;
    setArchive(null); setPrepared(null); setShareFailed(false); setMessage(''); setError(message); setPhase('idle');
  }
  async function load(preserve = false) {
    invalidate(); const request = revision.current; busy.current = true; setPhase('loading'); setMessage('正在核验可访问空间…');
    try {
      const available = await listExportSpaces(supabase, userId, controller.current.signal);
      if (!alive.current || request !== revision.current) return;
      setSpaces(available); setLoaded(true);
      const next = preserve ? selectedRef.current.filter(id => available.some(space => space.id === id)) : available.filter(space => space.kind === 'personal').map(space => String(space.id));
      if (preserve && next.length !== selectedRef.current.length) setError('部分所选空间已失去访问权限，请重新选择。');
      selectedRef.current = next; setSelected(next); setMessage('请选择需要导出的空间。');
    } catch { if (alive.current && request === revision.current) { setSpaces([]); setLoaded(false); setError('无法确认空间列表权限，请重试。'); setMessage(''); } }
    finally { if (alive.current && request === revision.current) { busy.current = false; setPhase('idle'); } }
  }
  useEffect(() => {
    alive.current = true; void load();
    const auth = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive.current) return;
      if (!session || session.user.id !== userId) { setSpaces([]); setSelected([]); selectedRef.current = []; setLoaded(false); invalidate('登录状态已变化，导出结果已清除。'); }
    });
    const refresh = () => {
      if (!alive.current) return;
      invalidate('空间成员关系已变化，正在刷新。'); void load(true);
    };
    const channel = supabase.channel(`space-export:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'space_members', filter: `user_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces' }, refresh).subscribe();
    const focus = async () => {
      const file = currentArchive.current;
      if (busy.current || document.visibilityState === 'hidden') return;
      if (!file) { void load(true); return; }
      const request = revision.current; setPrepared(null); busy.current = true; setPhase('checking');
      try {
        const available = await verifyExportAccess(supabase, userId, file.spaceIds, controller.current.signal);
        if (alive.current && request === revision.current) setSpaces(available);
      }
      catch { if (alive.current && request === revision.current) { setSpaces([]); setLoaded(false); invalidate('访问权限无法确认，导出结果已清除。'); } }
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
    if (busy.current || !selectedRef.current.length) return;
    const selection = [...selectedRef.current];
    invalidate(); const request = revision.current, signal = controller.current.signal;
    busy.current = true; setPhase('generating'); setMessage('正在准备所选空间的数据…');
    try {
      const input = await readSpaceExport(supabase, userId, selection, signal);
      const result = await generateExportZip(input, signal);
      await verifyExportAccess(supabase, userId, selection, signal);
      if (!alive.current || request !== revision.current) return;
      setArchive({ spaceIds: selection, file: new File([result.bytes as Uint8Array<ArrayBuffer>], result.filename, { type: 'application/zip' }) });
      setMessage('');
    } catch (error) { if (alive.current && request === revision.current) { setError(error instanceof Error && error.name === 'ExportCapacityError' ? error.message : '导出失败，未提供 ZIP。请刷新空间列表后重试。'); setMessage(''); } }
    finally { if (alive.current && request === revision.current) { busy.current = false; setPhase('idle'); } }
  }
  async function prepareSave(mode: 'system' | 'download') {
    if (busy.current || !archive || !download) return;
    busy.current = true; const request = revision.current; setPhase('checking'); setError(''); setPrepared(null);
    try {
      const available = await verifyExportAccess(supabase, userId, archive.spaceIds, controller.current.signal);
      if (alive.current && request === revision.current) setSpaces(available);
      if (alive.current && request === revision.current) { setPrepared({ mode, revision: request, expires: Date.now() + 10000 }); setMessage(mode === 'system' ? '访问权限已核验，请继续保存或分享文件。' : '访问权限已核验，请确认下载文件。'); }
    } catch { if (alive.current && request === revision.current) { setSpaces([]); setLoaded(false); invalidate('访问权限无法确认，导出结果已清除。'); } }
    finally { if (alive.current && request === revision.current) { busy.current = false; setPhase('idle'); } }
  }
  async function confirmSave() {
    if (busy.current || !prepared || !archive || !download || prepared.revision !== revision.current) return;
    if (Date.now() > prepared.expires) { setPrepared(null); setMessage('保存确认已过期，请重新选择保存方式。'); return; }
    busy.current = true; setPhase('sharing'); const request = revision.current;
    const result = await requestExportSave(archive.file, download.click, prepared.mode === 'download' ? {} : navigator);
    if (!alive.current || request !== revision.current) return;
    setPrepared(null); busy.current = false; setPhase('idle');
    if (result === 'share-dispatched') setShareFailed(false);
    else if (result === 'failed' && prepared.mode === 'system') setShareFailed(true);
    setMessage({ 'share-dispatched': '系统已接收分享请求，请自行确认文件是否保存。', 'download-requested': '已请求浏览器下载，请确认文件是否保存。', cancelled: '已取消分享，可重试保存或分享。', failed: '保存请求失败，可重试。' }[result]);
  }
  function changeSelection(ids: string[]) { invalidate(); selectedRef.current = ids; setSelected(ids); setMessage(ids.length ? '选择已更新，请重新生成 ZIP。' : '请选择至少一个空间。'); }
  const leave = () => { invalidate(); onBack(); };
  const swipe = useMobileSwipe({ enabled: phase !== 'sharing', scope: `${userId}:export`, direction: 'right', onSwipe: leave });
  const disabled = phase !== 'idle';
  const canShare = archive ? supportsExportFileShare(archive.file) : false;
  return <main {...swipe} className="mx-auto min-h-[100dvh] w-full max-w-3xl bg-ui-page px-ui-4 py-ui-4 font-ui text-ui-text safe-bottom">
    <header className="ui-spaces-header flex min-h-11 items-center gap-ui-3"><button type="button" className="ui-focus inline-flex min-h-11 shrink-0 items-center gap-ui-1 rounded-ui-control text-ui-meta font-ui-semibold text-ui-accent" onClick={leave}><ChevronLeft size={18} aria-hidden="true" />{backLabel}</button><h1 className="min-w-0 flex-1 break-all text-ui-section">导出数据</h1></header>
    <p className="mt-ui-4 text-ui-meta text-ui-muted">选择空间，导出你有权访问的数据。</p>
    {loaded && <fieldset className="mt-ui-4"><legend className="text-ui-body font-ui-semibold">选择空间</legend>
      <button type="button" className="ui-focus min-h-11 text-ui-accent" disabled={disabled || !spaces.length} onClick={() => changeSelection(selected.length === spaces.length ? [] : spaces.map(space => String(space.id)))}>{selected.length === spaces.length && spaces.length ? '取消全选' : '全选'}</button>
      <div className="flex flex-col gap-ui-3">{spaces.map(space => <label key={String(space.id)} className="ui-space-entry ui-account-card ui-focus"><input type="checkbox" className="h-5 w-5 shrink-0 accent-ui-accent ui-focus" disabled={disabled} checked={selected.includes(String(space.id))} onChange={() => changeSelection(selected.includes(String(space.id)) ? selected.filter(id => id !== space.id) : [...selected, String(space.id)])} /><span className="ui-account-label min-w-0 break-all">{space.kind === 'personal' ? '个人空间' : '共享空间'}：{String(space.name || '未命名空间')}</span></label>)}</div>
      {!spaces.length && <p className="text-ui-meta">暂无可导出的空间。</p>}
    </fieldset>}
    <div className="ui-my-links">
      {archive ? <>
        <section aria-label="导出文件" aria-live="polite" className="rounded-ui-group border border-ui-border bg-ui-surface p-ui-4">
          <h2 className="text-ui-body font-ui-semibold">数据已准备好</h2>
          <p className="mt-ui-1 text-ui-meta text-ui-muted">{archive.spaceIds.length} 个空间 · {archive.file.size >= 1024 * 1024 ? `${(archive.file.size / (1024 * 1024)).toFixed(1)} MB` : `${(archive.file.size / 1024).toFixed(1)} KB`}</p>
        </section>
        <button type="button" className="ui-space-entry ui-account-card ui-focus text-ui-accent" disabled={disabled || !download} onClick={() => void (prepared ? confirmSave() : prepareSave(canShare ? 'system' : 'download'))}>
          <span className="ui-account-label">{prepared ? prepared.mode === 'system' ? '继续保存或分享' : '确认下载文件' : '保存或分享文件'}</span>
        </button>
        {!prepared && <div className="flex flex-wrap items-start gap-x-ui-4">
          <button type="button" className="ui-focus min-h-11 text-ui-meta text-ui-accent" disabled={disabled} onClick={() => void generate()}>更新导出文件</button>
          {(!canShare || shareFailed) && <button type="button" className="ui-focus min-h-11 text-ui-meta text-ui-accent" disabled={disabled || !download} onClick={() => void prepareSave('download')}>直接下载 ZIP</button>}
        </div>}
      </> : loaded && <button type="button" className="ui-space-entry ui-account-card ui-focus" disabled={disabled || !selected.length} onClick={() => void generate()}><span className="ui-account-label">{phase === 'generating' ? '生成中…' : '生成文件'}</span></button>}
      {!archive && phase === 'idle' && <button type="button" className="ui-focus min-h-11 text-ui-accent" onClick={() => void load(loaded)}>{loaded ? '刷新空间列表' : '重试核验空间列表'}</button>}
      {(phase === 'generating' || prepared) && <button type="button" className="ui-focus min-h-11 text-ui-accent" onClick={() => { invalidate(); setMessage('已取消，可重新生成。'); }}>取消</button>}
    </div>
    <p className="mt-ui-4 text-ui-meta" role="status" aria-live="polite">{phase === 'checking' ? '正在核验保存权限…' : message}</p>
    {error && <p className="mt-ui-4 text-ui-meta text-ui-danger" role="alert">{error}</p>}
  </main>;
}
