import React, { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createExportDownload, requestExportSave } from '../../src/lib/data-export-save.ts';
import { syntheticExport } from './data-export-synthetic.ts';
import '../../src/styles.css';

// This standalone Vite DEV fixture is not imported by the application entry.
if (!import.meta.env.DEV) throw new Error('导出保存验证仅允许本地开发模式。');
type Probe = { mode: 'normal' | 'invalid' | 'hold'; generated: number; settled: number; release?: () => void; unmount: () => void };
const probe: Probe = { mode: 'normal', generated: 0, settled: 0, unmount: () => root.unmount() };
(window as unknown as { exportProbe: Probe }).exportProbe = probe;
const root = createRoot(document.getElementById('root')!);

function ExportSaveProbe() {
  const [file, setFile] = useState<File | null>(null);
  const [download, setDownload] = useState<ReturnType<typeof createExportDownload> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('只使用两个示例空间，不读取账户或业务数据。');
  const [error, setError] = useState('');
  const lock = useRef(false), generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    setDownload(null);
    if (!file) return;
    try {
      const current = createExportDownload(file); setDownload(current);
      return () => current.dispose();
    } catch { setError('无法准备下载链接，请重新生成。'); }
  }, [file]);

  async function generate() {
    if (lock.current) return;
    lock.current = true;
    const request = ++generation.current;
    setBusy(true); setFile(null); setError(''); setMessage('正在生成合成 ZIP…');
    try {
      const input = syntheticExport();
      if (probe.mode === 'invalid') input.spaces[1].expectedRows.events++;
      if (probe.mode === 'hold') await new Promise<void>((resolve) => { probe.release = resolve; });
      const { generateExportZip } = await import('../../src/lib/data-export-archive.ts');
      const result = await generateExportZip(input);
      if (request !== generation.current) return;
      setFile(new File([result.bytes as Uint8Array<ArrayBuffer>], result.filename, { type: 'application/zip' }));
      probe.generated++;
      setMessage('合成 ZIP 已生成，尚未保存。');
    } catch {
      if (request === generation.current) { setError('生成失败，未提供 ZIP。请重试。'); setMessage(''); }
    } finally {
      probe.settled++;
      if (request === generation.current) { lock.current = false; setBusy(false); }
    }
  }

  async function save(forceDownload = false) {
    if (!file || !download || lock.current) return;
    lock.current = true;
    const request = generation.current;
    setBusy(true); setError('');
    const result = await requestExportSave(file, download.click, forceDownload ? {} : navigator);
    if (request !== generation.current) return;
    setMessage({
      'share-dispatched': '系统已接收分享请求，请自行确认文件是否保存。',
      'download-requested': '已请求浏览器下载，请确认文件是否保存。',
      cancelled: '已取消分享，文件仍可重试保存。',
      failed: '保存请求失败，文件仍可重试或使用下载 ZIP。',
    }[result]);
    lock.current = false; setBusy(false);
  }

  return <main className="mx-auto min-h-[100dvh] w-full max-w-3xl bg-ui-page px-ui-4 py-ui-4 font-ui text-ui-text safe-bottom">
    <h1 className="text-ui-section">导出保存验证</h1>
    <p className="mt-ui-4 text-ui-meta text-ui-muted">本地合成数据。此页用于验证 ZIP 格式和保存能力，不是正式导出入口。</p>
    <div className="flex flex-col gap-ui-3">
      <button className="ui-space-entry ui-account-card ui-focus" disabled={busy} onClick={() => void generate()}>生成合成 ZIP</button>
      {file && <>
        <p className="break-all text-ui-meta">{file.name} · {file.size} bytes</p>
        <button className="ui-space-entry ui-account-card ui-focus" disabled={busy || !download} onClick={() => void save()}>保存 ZIP</button>
        <button className="ui-focus min-h-11 text-ui-accent" disabled={busy || !download} onClick={() => void save(true)}>下载 ZIP</button>
      </>}
    </div>
    <p className="mt-ui-4 text-ui-meta" role="status" aria-live="polite">{message}</p>
    {error && <p className="mt-ui-4 text-ui-meta text-ui-danger" role="alert">{error}</p>}
  </main>;
}
root.render(<StrictMode><ExportSaveProbe /></StrictMode>);
