import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'vite';
const elements = (node: any): any[] => React.isValidElement(node) ? [node, ...React.Children.toArray((node.props as any).children).flatMap(elements)] : [];
const space = { id: 'personal', kind: 'personal', name: '我的空间', membershipRole: 'owner', created_by: 'me' };
const event = { id: 'event-a', space_id: space.id, title: '要确认的日程', created_by: 'me', owner_user_id: 'me', scope: 'personal', starts_at: '2026-10-10T09:00:00Z', ends_at: null, all_day: false, recurrence_rule: null, reminder_kind: null };
function hooks() {
  let cursor = 0; const slots: any[] = []; const effects: Array<{ index: number; fn: () => any }> = []; const cleanups = new Map<number, () => void>();
  const mountedEffects = new Map<number, () => any>();
  return {
    reset() { cursor = 0; },
    useState(initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value: any) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(value: any) { const index = cursor++; return slots[index] ??= { current: value }; },
    useCallback(fn: any, deps: any[]) { const index = cursor++; if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) slots[index] = { fn, deps }; return slots[index].fn; },
    useEffect(fn: any, deps: any[]) { const index = cursor++; if (!slots[index] || deps.some((dep, i) => dep !== slots[index][i])) { slots[index] = deps; effects.push({ index, fn }); } },
    flush() { for (const { index, fn } of effects.splice(0)) { cleanups.get(index)?.(); mountedEffects.set(index, fn); const stop = fn(); if (stop) cleanups.set(index, stop); else cleanups.delete(index); } },
    replay() { for (const stop of cleanups.values()) stop(); cleanups.clear(); for (const [index, fn] of mountedEffects) { const stop = fn(); if (stop) cleanups.set(index, stop); } },
    stop() { for (const stop of cleanups.values()) stop(); cleanups.clear(); },
  };
}

async function runtime(kind: 'Event' | 'Task', run: (env: any) => Promise<void>) {
  const hook = hooks(); const calls: any[] = []; const prior = (globalThis as any).document;
  const trigger: any = { isConnected: true, focus() { document.activeElement = trigger; } };
  const document: any = { activeElement: trigger };
  let mutationWait: Promise<void> | undefined;
  const query: any = { delete() { calls.push('delete'); return query; }, eq() { return query; }, select() { return query; }, then(resolve: any) { return (mutationWait ?? Promise.resolve()).then(() => ({ data: [{ id: event.id }], error: null })).then(resolve); } };
  (globalThis as any).__stageSheets = { ...hook, useMemo: (fn: any) => fn(), supabase: { from() { return query; } } };
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{ name: 'sheet-runtime', enforce: 'pre',
    resolveId(id, importer) {
      if (id === 'react' && (importer?.includes('/components/') || importer?.endsWith('/App.tsx'))) return '\0sheet-hooks';
      if (/\/supabase(?:\.ts)?$/.test(id)) return '\0sheet-client';
    }, load(id) {
      if (id === '\0sheet-hooks') return 'const m=globalThis.__stageSheets; export const {useState,useRef,useCallback,useEffect,useMemo}=m;';
      if (id === '\0sheet-client') return 'export const supabase=globalThis.__stageSheets.supabase;';
    },
  }] } as any);
  try {
    const Sheet = kind === 'Event' ? (await vite.ssrLoadModule('/src/App.tsx')).EventSheet : (await vite.ssrLoadModule('/src/components/TaskSheet.tsx')).TaskSheet;
    (globalThis as any).document = document;
    const props: any = kind === 'Event' ? { target: { kind: 'event', event }, space, userId: 'me', members: [], partnerId: null, onClose() { calls.push('close'); }, onSaved() { calls.push('saved'); } }
      : { task: { id: 'task', title: '任务', status: 'open', assigned_to_user_id: null, due_on: null }, spaceId: space.id, spaceKind: space.kind, userId: 'me', members: [], onClose() { calls.push('close'); }, async onSaved() { calls.push('saved'); } };
    let dom: any[] = []; const mounted = new Map<string, any>();
    const render = () => {
      hook.reset(); let tree = Sheet(props);
      // Mount the existing occurrence chooser as a real child, when present.
      const expand = (node: any): any => {
        if (!React.isValidElement(node)) return node;
        if (typeof node.type === 'function' && node.type.name === 'OccurrenceActionChooser') return expand(node.type(node.props));
        return React.cloneElement(node, undefined, ...React.Children.toArray((node.props as any).children).map(expand));
      };
      tree = expand(tree); dom = []; for (const d of mounted.values()) d.isConnected = false;
      const mount = (node: any, path = ''): any => {
        if (!React.isValidElement(node)) return null;
        const identity = path + ':' + String(node.type);
        const children = React.Children.toArray((node.props as any).children).map((child, i) => mount(child, identity + '/' + i)).filter(Boolean);
        const listeners = mounted.get(identity)?.listeners ?? new Map(); const d: any = mounted.get(identity) ?? { node, children, isConnected: true, focus() { document.activeElement = d; },
          addEventListener(k: string, fn: any) { listeners.set(k, fn); }, removeEventListener(k: string) { listeners.delete(k); }, listeners, contains(other: any) { return other === d || descendants(d).includes(other); },
          querySelectorAll() { return descendants(d).filter((e: any) => ['button', 'input', 'select', 'textarea'].includes(e.node.type) && !e.node.props.disabled); },
          querySelector(selector: string) { return selector.includes('data-event-scope-dialog') ? descendants(d).find((e: any) => e.node.props['data-event-scope-dialog']) : selector.includes('data-confirm-cancel') ? descendants(d).find((e: any) => e.node.props['data-confirm-cancel']) : d.querySelectorAll()[0]; },
        };
        Object.assign(d, { node, children, isConnected: true }); mounted.set(identity, d);
        dom.push(d); if ((node as any).ref && typeof (node as any).ref === 'object') (node as any).ref.current = d;
        return d;
      };
      mount(tree); return tree;
    };
    const descendants = (d: any): any[] => d.children.flatMap((c: any) => [c, ...descendants(c)]);
    // Preserve node identity/listeners across rerenders like a mounted DOM.
    const pump = async () => { const tree = render(); hook.flush(); await new Promise((r) => setImmediate(r)); return tree; };
    const key = (key: string, shiftKey = false) => { const root = dom.find((d) => d.listeners.has('keydown')); assert.ok(root, 'Sheet must register keyboard handling'); let prevented = false;
      root.listeners.get('keydown')({ key, shiftKey, preventDefault() { prevented = true; }, stopPropagation() {} }); return prevented; };
    await run({ holdMutation() { let release!: () => void; mutationWait = new Promise<void>((resolve) => { release = resolve; }); return release; }, props, calls, render, pump, key, stop: hook.stop, document, trigger, dom: () => dom });
  } finally { hook.stop(); await vite.close(); delete (globalThis as any).__stageSheets; (globalThis as any).document = prior; }
}

for (const kind of ['Event', 'Task'] as const) {
  test(`${kind} Sheet initial focus, Tab containment, Escape and close focus return`, () => runtime(kind, async (e) => {
    const tree = await e.pump();
    assert.ok(elements(tree).some((n) => n.props.role === 'dialog' && n.props['aria-modal'] === 'true'));
    assert.notEqual(e.document.activeElement, e.trigger);
    const controls = e.dom().filter((d: any) => ['button', 'input', 'select', 'textarea'].includes(d.node.type) && !d.node.props.disabled);
    controls[0].focus(); assert.equal(e.key('Tab', true), true); assert.equal(e.document.activeElement, controls.at(-1));
    controls.at(-1).focus(); assert.equal(e.key('Tab'), true); assert.equal(e.document.activeElement, controls[0]);
    assert.equal(e.key('Escape'), true); assert.deepEqual(e.calls, ['close']);
    e.stop(); assert.equal(e.document.activeElement, e.trigger);
  }));
}

test('ordinary Event delete needs explicit confirmation; cancelling does not write', () => runtime('Event', async (e) => {
  let tree = await e.pump(); const clickDelete = () => elements(tree).find((n) => n.props['aria-label'] === '删除日程').props.onClick();
  clickDelete(); tree = await e.pump(); assert.equal(e.calls.includes('delete'), false);
  const cancel = elements(tree).find((n) => n.type === 'button' && n.props.children === '取消'); assert.ok(cancel); cancel.props.onClick();
  tree = await e.pump(); assert.equal(e.calls.includes('delete'), false);
  clickDelete(); tree = await e.pump(); const confirm = elements(tree).find((n) => n.type === 'button' && n.props.children === '确认删除'); assert.ok(confirm);
  await confirm.props.onClick(); await new Promise((r) => setImmediate(r));
  assert.equal(e.calls.filter((c: any) => c === 'delete').length, 1);
  assert.ok(e.calls.includes('close')); assert.ok(e.calls.includes('saved'));
}));

test('removed navigation controller has zero runtime imports; direct target/editor entry points stay wired', () => {
  assert.equal(existsSync('src/components/useImportantDateHandoff.ts'), false);
  for (const file of ['src/App.tsx', 'src/components/ImportantDatesPage.tsx', 'src/components/HomePage.tsx', 'src/components/useCalendarImportantDates.ts']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /useImportantDateHandoff|onHandoffHandled|returnTo|handoffRequestId/);
  }
  for (const file of ['src/components/HomePage.tsx', 'src/components/useCalendarImportantDates.ts']) assert.match(readFileSync(file, 'utf8'), /useImportantDateEditor/);
});


for (const kind of ['Event', 'Task'] as const) test(`${kind} ignores Escape during an unresolved mutation`, () => runtime(kind, async (e) => {
  let release!: () => void;
  if (kind === 'Event') release = e.holdMutation();
  else e.props.onSaved = () => new Promise<void>((resolve) => { release = resolve; });
  let tree = await e.pump();
  elements(tree).find((n) => n.props['aria-label'] === (kind === 'Event' ? '删除日程' : '删除任务')).props.onClick();
  tree = await e.pump(); elements(tree).find((n) => n.type === 'button' && n.props.children === '确认删除').props.onClick();
  await new Promise((r) => setImmediate(r)); tree = await e.pump(); e.key('Escape');
  assert.equal(e.calls.includes('close'), false); assert.ok(release); release(); await new Promise((r) => setImmediate(r));
  assert.equal(e.calls.includes('close'), true);
}));

test('recurring Event keeps scope confirmation, traps its keyboard and Escape cancels only the chooser', () => runtime('Event', async (e) => {
  e.props.target = { kind: 'occurrence', event: { ...event, recurrence_rule: { frequency: 'daily', interval: 1 } },
    occurrence: { ...event, source_event_id: event.id, occurrence_id: 'e:2026-10-10', occurrence_starts_at: event.starts_at, occurrence_ends_at: null } };
  let tree = await e.pump(); elements(tree).find((n) => n.props['aria-label'] === '删除此事件').props.onClick();
  tree = await e.pump(); assert.ok(elements(tree).find((n) => n.props['data-event-scope-dialog']));
  assert.equal(e.document.activeElement.node.props.children, '取消');
  e.key('Tab'); assert.equal(e.document.activeElement.node.props.children, '仅删除当前事件');
  e.key('Tab', true); assert.equal(e.document.activeElement.node.props.children, '取消');
  e.key('Escape'); tree = await e.pump();
  assert.equal(elements(tree).some((n) => n.props['data-event-scope-dialog']), false);
  assert.equal(e.calls.includes('close'), false); assert.equal(e.calls.includes('delete'), false);
}));
