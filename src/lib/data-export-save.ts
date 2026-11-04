export type ExportSaveResult = 'share-dispatched' | 'download-requested' | 'cancelled' | 'failed';
type ShareTarget = { canShare?: (data: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };

export function supportsExportFileShare(file: File, target: ShareTarget = navigator): boolean {
  try { return typeof target.share === 'function' && target.canShare?.({ files: [file] }) === true; }
  catch { return false; }
}

export async function requestExportSave(file: File, download: () => void, target: ShareTarget = navigator): Promise<ExportSaveResult> {
  if (supportsExportFileShare(file, target)) {
    try {
      // Called directly from the click, BEFORE an await or any ZIP generation.
      await target.share!({ files: [file], title: '共享日历数据导出' });
      return 'share-dispatched';
    } catch (error) {
      return error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'failed';
    }
  }
  try { download(); return 'download-requested'; } catch { return 'failed'; }
}

export function createExportDownload(file: File) {
  const href = URL.createObjectURL(file);
  let disposed = false;
  return {
    click() {
      if (disposed) throw new Error('导出文件已释放，请重新生成。');
      const link = document.createElement('a');
      link.href = href; link.download = file.name;
      document.body.append(link);
      try { link.click(); } finally { link.remove(); }
    },
    dispose() { if (!disposed) URL.revokeObjectURL(href); disposed = true; },
  };
}
