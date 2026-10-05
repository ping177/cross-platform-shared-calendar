import { useEffect, useRef, useState } from 'react';
import { deleteImportantDate, updateImportantDate } from '../lib/important-dates-data';
import type { ImportantDateDraft } from '../lib/important-dates';
import type { ModuleEntry } from '../lib/module-availability';
import { createRequestGuard } from '../lib/request-guard';
import { supabase } from '../lib/supabase';
import type { CurrentSpace, ImportantDate } from '../types';
import { type ImportantDateTargetRequest, useImportantDateTarget } from './useImportantDateTarget';

// A single canonical interaction, owned by its mounting page. Presentation
// snapshots never enter this controller and successful writes only request reread.
export function useImportantDateEditor(userId: string, identity: ImportantDateTargetRequest | null, options: {
  spaces: CurrentSpace[]; entry?: ModuleEntry | null; onClose: () => void; onReconcile: () => void;
}) {
  const [editor, setEditor] = useState<{ date: ImportantDate; space: CurrentSpace; requestId: number; userId: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ requestId?: number; text: string }>({ text: '' });
  const [sessionLost, setSessionLost] = useState(false);
  const mutation = useRef(createRequestGuard());
  const lock = useRef(false);
  const authorizedKey = useRef<string | undefined>(undefined);
  const authOwner = useRef(userId);
  const context = useRef('');
  const memberRole = options.spaces.find((space) => space.id === identity?.spaceId)?.membershipRole;
  const confirmedEligibility = useRef<{ requestId?: number; role?: CurrentSpace['membershipRole'] | null }>({});
  if (confirmedEligibility.current.requestId !== identity?.requestId) confirmedEligibility.current = { requestId: identity?.requestId };
  if (options.entry && identity) confirmedEligibility.current.role = options.entry.eligibleSpaces.find((space) => space.id === identity.spaceId)?.membershipRole ?? null;
  const eligibleRole = confirmedEligibility.current.role === undefined ? memberRole : confirmedEligibility.current.role;
  const key = JSON.stringify([userId, identity?.requestId, identity?.spaceId, identity?.importantDateId, memberRole, eligibleRole]);
  if (context.current !== key) { mutation.current.invalidate(); context.current = key; }
  const callbacks = useRef(options); callbacks.current = options;
  const target = useImportantDateTarget(userId, identity, {
    entry: options.entry, memberSpaces: options.spaces, sessionLost,
    onOpening: () => { authorizedKey.current = undefined; setEditor(null); setDeleting(false); setBusy(false); setError(''); setNotice({ text: '' }); },
    onReady: (date, space, requestId) => { authorizedKey.current = context.current; setEditor({ date, space, requestId, userId }); setNotice({ text: '' }); },
    onLost: unavailable,
    onUnavailable: unavailable,
  });
  function unavailable() {
    authorizedKey.current = undefined; mutation.current.invalidate(); setEditor(null); setDeleting(false); setBusy(false);
    setNotice({ requestId: identity?.requestId, text: '此重要日已删除或当前不可访问。' }); callbacks.current.onReconcile();
  }
  useEffect(() => {
    // Membership is independently known on Home even while module hints refresh.
    if (identity && (!memberRole || (editor?.requestId === identity.requestId && editor.space.id === identity.spaceId && memberRole !== editor.space.membershipRole))) target.loseTarget(identity.requestId);
  }, [identity?.requestId, memberRole, editor?.space.membershipRole]);
  useEffect(() => {
    if (authOwner.current !== userId) { authOwner.current = userId; close(); }
    setSessionLost(false);
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session?.user?.id && session.user.id !== userId)) {
        authorizedKey.current = undefined; mutation.current.invalidate(); target.clear(); setSessionLost(true); setEditor(null); setDeleting(false);
      }
    });
    return () => { authorizedKey.current = undefined; mutation.current.invalidate(); data.subscription.unsubscribe(); };
  }, [userId]);
  useEffect(() => () => mutation.current.invalidate(), []);
  const currentEditor = editor?.userId === userId && editor.requestId === identity?.requestId && editor.date.id === identity?.importantDateId
    && editor.space.id === identity.spaceId && memberRole === editor.space.membershipRole && target.targetCanAct && !sessionLost ? editor : null;
  function close() {
    authorizedKey.current = undefined; mutation.current.invalidate(); target.clear(); setEditor(null); setDeleting(false); setNotice({ text: '' }); setError(''); callbacks.current.onClose();
  }
  async function save(draft: ImportantDateDraft, spaceId: string) {
    if (!currentEditor || authorizedKey.current !== key || context.current !== key || lock.current) throw new Error('当前无法保存，请重新读取重要日。');
    if (spaceId !== currentEditor.date.space_id) throw new Error('编辑重要日不能迁移空间。');
    lock.current = true; const request = mutation.current.begin();
    try {
      await updateImportantDate(supabase, userId, currentEditor.date, draft);
      if (!mutation.current.isCurrent(request)) return;
      close(); callbacks.current.onReconcile();
    } catch (cause) {
      if (mutation.current.isCurrent(request)) callbacks.current.onReconcile();
      throw cause;
    } finally { lock.current = false; }
  }
  async function confirmDelete() {
    if (!currentEditor || authorizedKey.current !== key || context.current !== key || !deleting || lock.current) return;
    lock.current = true; const request = mutation.current.begin(); setBusy(true); setError('');
    try {
      await deleteImportantDate(supabase, userId, currentEditor.date);
      if (!mutation.current.isCurrent(request)) return;
      close(); callbacks.current.onReconcile();
    } catch {
      if (mutation.current.isCurrent(request)) {
        setError('删除未确认成功，请重新读取并确认目标后重试。'); callbacks.current.onReconcile();
      }
    } finally { lock.current = false; if (mutation.current.isCurrent(request)) setBusy(false); }
  }
  return { editor: currentEditor, deleting, busy, error, notice: notice.requestId === identity?.requestId ? notice.text : '',
    targetRead: target.targetRead.requestId === identity?.requestId ? target.targetRead : { error: '', loading: false },
    retry: target.retry, close, save, confirmDelete, cancelDelete: close,
    beginDelete: () => { if (currentEditor && authorizedKey.current === key && context.current === key) { setDeleting(true); setError(''); } } };
}
