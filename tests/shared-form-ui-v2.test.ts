import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const space = { id: 'p', name: '很长的个人空间名称', kind: 'personal', created_by: 'me', membershipRole: 'owner' };
const members = [{ space_id: 'p', user_id: 'me', role: 'owner' }];
const event = { id: 'e', space_id: 'p', title: '原日程', description: '原描述', scope: 'personal', owner_user_id: 'me', created_by: 'me', starts_at: '2026-10-15T09:00:00Z', ends_at: '2026-10-15T10:00:00Z', all_day: false, recurrence_rule: null, reminder_kind: null, time_zone: 'Asia/Shanghai' };
const nodes = (tree: any): any[] => React.isValidElement(tree) ? [tree, ...React.Children.toArray((tree.props as any).children).flatMap(nodes)] : [];
const label = (tree: any): string => React.isValidElement(tree) ? React.Children.toArray((tree.props as any).children).map(label).join('') : typeof tree === 'string' ? tree : '';

async function sheet(kind: 'Event' | 'Task' | 'Important', run: (e: any) => Promise<void> | void) {
  let cursor = 0; const slots: any[] = []; const calls: any[] = []; const effects: Array<() => any> = []; const cleanups: Array<() => void> = [];
  let wait: Promise<void> | undefined, failure: Error | null = null;
  const hooks = {
    useState(value: any) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value; return [slots[i], (v: any) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useRef(value: any) { return slots[cursor++] ??= { current: value }; },
    useEffect(fn: () => any, deps: any[]) { const i = cursor++; if (!(i in slots) || deps.some((v, n) => v !== slots[i][n])) { slots[i] = deps; effects.push(fn); } },
    useMemo(fn: () => any) { return fn(); },
  };
  const query: any = { insert(value: any) { calls.push(['insert', value]); return query; }, update(value: any) { calls.push(['update', value]); return query; }, delete() { calls.push(['delete']); return query; }, eq() { return query; }, select() { return query; }, async maybeSingle() { return { data: null, error: failure }; }, then(resolve: any) { return (wait ?? Promise.resolve()).then(() => ({ data: [{ id: 'e' }], error: failure })).then(resolve); } };
  (globalThis as any).__sharedForms = { ...hooks, supabase: { auth: { async getUser() { return { data: { user: { id: 'me' } }, error: null }; } }, from() { return query; }, async rpc(name: string, args: any) { calls.push(['rpc', name, args]); return { error: failure }; } } };
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] }, ssr: { external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{ name: 'shared-form-handlers', enforce: 'pre', transform(code, id) { if ((id.includes('/src/components/') && !id.endsWith('/SpaceFilterDropdown.tsx')) || id.endsWith('/src/App.tsx')) return code.replace("from 'react'", "from 'shared-form-test-hooks'"); }, resolveId(id, importer) {
    if (id === 'shared-form-test-hooks' && (importer?.includes('/components/') || importer?.endsWith('/App.tsx'))) return '\0shared-hooks';
    if (/\/supabase(?:\.ts)?$/.test(id)) return '\0shared-client';
  }, load(id) { if (id === '\0shared-hooks') return 'export const {useState,useRef,useEffect,useMemo}=globalThis.__sharedForms;'; if (id === '\0shared-client') return 'export const supabase=globalThis.__sharedForms.supabase;'; } }] } as any);
  const previousDocument = (globalThis as any).document;
  const trigger = { focus() { document.activeElement = trigger; }, isConnected: true };
  const document: any = { activeElement: trigger };
  try {
    const Component = kind === 'Event' ? (await vite.ssrLoadModule('/src/App.tsx')).EventSheet : kind === 'Task' ? (await vite.ssrLoadModule('/src/components/TaskSheet.tsx')).TaskSheet : (await vite.ssrLoadModule('/src/components/ImportantDateSheet.tsx')).ImportantDateSheet;
    (globalThis as any).document = document;
    const props: any = kind === 'Event' ? { target: null, space, members, partnerId: null, userId: 'me', validateCreateTarget: async () => true, onClose() { calls.push('close'); }, onSaved() { calls.push('saved'); } }
      : kind === 'Task' ? { task: null, spaceId: 'p', spaceKind: 'personal', userId: 'me', members, onClose() { calls.push('close'); }, async onSaved() { calls.push('saved'); } }
      : { memberSpaces: [space], eligibleSpaces: [space], initialTargetId: 'p', canAct: true, async onSubmit(draft: any, id: string) { calls.push(['submit', draft, id]); await wait; if (failure) throw failure; }, onCancel() { calls.push('close'); }, onDelete() { calls.push('delete'); } };
    const render = () => { cursor = 0; return Component(props); };
    const submit = () => nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    const click = (name: string) => nodes(render()).find(n => n.type === 'button' && (n.props['aria-label'] === name || label(n) === name)).props.onClick();
    const change = (id: string, value: string) => nodes(render()).find(n => n.props.id === id).props.onChange({ target: { value } });
    const mountFocus = () => {
      const tree = render(); const dom: any[] = nodes(tree).map(n => ({ node: n, isConnected: true, focus() { document.activeElement = this; }, addEventListener() {}, removeEventListener() {}, contains(other: any) { return dom.includes(other); }, querySelector(selector: string) { return selector.startsWith('#') ? dom.find(d => d.node.props.id === selector.slice(1)) : dom.find(d => ['input', 'button', 'select'].includes(d.node.type)); } }));
      dom.forEach(d => { const ref = (d.node as any).ref; if (ref && typeof ref === 'object') ref.current = d; });
      effects.splice(0).forEach(fn => { const stop = fn(); if (stop) cleanups.push(stop); }); return dom;
    };
    await run({ props, calls, render, submit, click, change, mountFocus, document, trigger, stop() { cleanups.splice(0).forEach(fn => fn()); }, html: () => renderToStaticMarkup(render()), fail(error: Error | null) { failure = error; }, hold() { let release!: () => void; wait = new Promise<void>(yes => { release = yes; }); return release; } });
  } finally { cleanups.forEach(fn => fn()); await vite.close(); delete (globalThis as any).__sharedForms; (globalThis as any).document = previousDocument; }
}

function assertHeader(e: any, prefix: string) {
  const tree = e.render(); const header = nodes(tree).find(n => n.type === 'header');
  assert.ok(header, 'form must have a fixed visual header');
  const submits = nodes(tree).filter(n => n.type === 'button' && n.props.type === 'submit');
  assert.equal(submits.length, 1);
  assert.equal(nodes(header).filter(n => n.type === 'button' && n.props.type === 'submit').length, 1);
  const form = nodes(tree).find(n => n.type === 'form');
  assert.equal(form.props.id, `${prefix}-sheet-form`);
  if (prefix !== 'important-date') assert.equal(submits[0].props.form, form.props.id);
  assert.equal(form.props.noValidate, undefined);
  assert.ok(nodes(form).some(n => n.type === 'input' && n.props.required));
  assert.match(submits[0].props.className, /text-ui-meta.*font-ui-semibold/);
}

test('Event Home global create and Calendar local create use one header submit with required native fields', () => sheet('Event', e => {
  assertHeader(e, 'event');
  e.props.createTarget = { spaces: [space], selectedId: 'p', state: 'ready', error: '', onSelect() {}, onRetry() {} };
  assertHeader(e, 'event'); assert.match(e.html(), /event-create-target/);
  assert.equal(nodes(e.render()).filter(n => n.type === 'input' && n.props.required).length, 2);
}));
test('Event Home and Calendar edits preserve delete and read-only users have no save or delete', () => sheet('Event', e => {
  e.props.target = { kind: 'event', event }; assertHeader(e, 'event'); assert.match(e.html(), /删除日程/);
  e.props.showSourceSpace = true; assertHeader(e, 'event');
  e.props.userId = 'other'; const tree = e.render();
  assert.equal(nodes(tree).filter(n => n.props.type === 'submit').length, 0);
  assert.doesNotMatch(e.html(), /删除日程/); assert.match(e.html(), /日程详情/);
}));
test('Event global target confirmation disables submit; deletion replaces edit controls with named confirmation', () => sheet('Event', async e => {
  e.props.createTarget = { spaces: [space], selectedId: 'p', state: 'ready', error: '', onSelect() {}, onRetry() {} };
  await e.submit(); assert.equal(nodes(e.render()).find(n => n.props.type === 'submit').props.disabled, true);
  assert.match(e.html(), /确认保存/); assert.equal(e.calls.length, 0);
  e.click('取消'); e.props.target = { kind: 'event', event }; e.click('删除日程');
  assert.equal(nodes(e.render()).some(n => n.props.type === 'submit'), false);
  assert.match(e.html(), /删除日程/); assert.match(e.html(), /ui-delete-target/); assert.equal(e.calls.length, 0);
}));
test('Event occurrence save opens the original chooser and disables the underlying header', () => sheet('Event', async e => {
  e.props.target = { kind: 'occurrence', event: { ...event, recurrence_rule: { frequency: 'daily', interval: 1 } }, occurrence: { ...event, source_event_id: 'e', occurrence_id: 'e:2026-10-15', occurrence_starts_at: event.starts_at, occurrence_ends_at: event.ends_at } };
  await e.submit(); assert.equal(nodes(e.render()).find(n => n.props.type === 'submit').props.disabled, true);
  assert.match(e.html(), /选择修改范围|仅修改当前事件/); assert.equal(e.calls.length, 0);
}));
test('Event saving disables header and close; failure retains values and retry keeps the same payload and close order', () => sheet('Event', async e => {
  const input = nodes(e.render()).find(n => n.type === 'input' && !n.props.type);
  input.props.onChange({ target: { value: '保留的日程' } });
  const release = e.hold(); e.fail(new Error('保存失败')); const pending = e.submit();
  assert.equal(nodes(e.render()).find(n => n.props.type === 'submit').props.disabled, true);
  assert.equal(nodes(e.render()).find(n => n.props['aria-label'] === '关闭').props.disabled, true);
  release(); await pending; assert.match(e.html(), /创建结果尚未确认/); assert.equal(nodes(e.render()).some(n => n.type === 'form'), false); assert.equal(e.calls.includes('close'), false);
  e.fail(null); e.click('核对并重试原始创建'); await new Promise(setImmediate); const writes = e.calls.filter((c: any) => Array.isArray(c));
  assert.deepEqual(writes[0], writes[1]); assert.deepEqual(e.calls.slice(-2), ['close', 'saved']);
}));

for (const moduleView of [false, true]) test(`Task mode ${moduleView} shares header/form while retaining source and global target controls`, () => sheet('Task', e => {
  e.props.moduleView = moduleView; assertHeader(e, 'task');
  e.props.sourceSpaceLabel = space.name; assert.match(e.html(), /很长的个人空间名称/);
  e.props.createTarget = { spaces: [space], selectedId: 'p', state: 'ready', error: '', onSelect() {}, onRetry() {} };
  assertHeader(e, 'task'); assert.match(e.html(), /task-create-target/);
  e.props.createTarget.state = 'loading'; assert.equal(nodes(e.render()).find(n => n.props.type === 'submit').props.disabled, true);
}));
test('default Task visual migration retains direct dirty close and no new discard confirmation', () => sheet('Task', e => {
  nodes(e.render()).find(n => n.type === 'input' && !n.props.id).props.onChange({ target: { value: '首页草稿' } });
  assertHeader(e, 'task'); e.click('关闭任务表单'); assert.deepEqual(e.calls, ['close']); assert.doesNotMatch(e.html(), /放弃未保存/);
}));

for (const moduleView of [false, true]) {
  test(`Important Date mode ${moduleView} shares visual header but keeps manual versus picker Emoji scope and immutable edit Space`, () => sheet('Important', e => {
    e.props.moduleView = moduleView; assertHeader(e, 'important-date');
    assert.equal(nodes(e.render()).find(n => n.props.id === 'important-date-emoji').props.value, '');
    assert.equal(nodes(e.render()).some(n => n.props['aria-controls'] === 'important-date-emoji-choices'), moduleView);
    e.props.date = { id: 'd', space_id: 'p', name: '纪念日', emoji: '🦋✨', repeat_kind: 'annual', year: 2020, month: 10, day: 15, reminder_kind: null };
    assertHeader(e, 'important-date'); assert.match(e.html(), /删除重要日/);
    assert.doesNotMatch(e.html(), /<select[^>]*id="important-date-space"/);
  }));
  test(`Important Date mode ${moduleView} preserves initial focus and returns to opener`, () => sheet('Important', e => {
    e.props.moduleView = moduleView; e.mountFocus();
    if (moduleView) assert.equal(e.document.activeElement.node.props['aria-label'], '关闭重要日表单');
    else assert.equal(e.document.activeElement.node.props.id, 'important-date-name');
    e.stop(); assert.equal(e.document.activeElement, e.trigger);
  }));
}
test('default Important Date failure keeps manual Emoji draft, blocks duplicates while pending and can retry', () => sheet('Important', async e => {
  e.change('important-date-name', '重要日草稿'); e.change('important-date-emoji', '🦋✨');
  const numeric = nodes(e.render()).filter(n => n.type === 'input' && n.props.type === 'number');
  numeric[1].props.onChange({ target: { value: '10' } }); numeric[2].props.onChange({ target: { value: '15' } });
  const release = e.hold(); e.fail(new Error('保存失败')); const first = e.submit(); await e.submit();
  assert.equal(e.calls.length, 1); assert.equal(nodes(e.render()).find(n => n.props.type === 'submit').props.disabled, true);
  assert.equal(nodes(e.render()).find(n => n.props['aria-label'] === '关闭重要日表单').props.disabled, true);
  release(); await first; await new Promise(r => setImmediate(r)); assert.match(e.html(), /重要日草稿/); assert.match(e.html(), /保存失败/);
  e.fail(null); await e.submit(); await new Promise(r => setImmediate(r)); assert.deepEqual(e.calls[0], e.calls[1]);
  assert.equal(e.calls[0][1].emoji, '🦋✨');
  e.props.eligibleSpaces = []; await e.submit(); assert.equal(e.calls.length, 2);
}));
