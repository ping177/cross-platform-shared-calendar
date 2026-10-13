import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { CurrentSpace, ImportantDate } from '../src/types.ts';

const personal = { id: 'p', name: '我的空间', kind: 'personal', created_by: 'me', membershipRole: 'owner' } as CurrentSpace;
const shared = { ...personal, id: 's', name: '共同空间', kind: 'shared', created_by: 'other', membershipRole: 'member' } as CurrentSpace;
const date = { id: 'annual', space_id: 's', name: '相识', emoji: '🌿', repeat_kind: 'annual', year: 2020, month: 10, day: 10,
  reminder_kind: null, time_zone: 'Asia/Shanghai', created_by: 'other' } as ImportantDate;
const today = { year: 2026, month: 10, day: 12 };
const dates = [date, { ...date, id: 'past', name: '上次旅行', repeat_kind: 'none', year: 2026, day: 9 },
  { ...date, id: 'future', name: '旅行出发', repeat_kind: 'none', year: 2026, day: 15 },
  { ...date, id: 'today', name: '今天的生日', year: null, day: 12 }] as ImportantDate[];
const data = { memberSpaces: [personal, shared], eligibleSpaces: [personal, shared], dates };
const noop = () => undefined;
async function components(run: (m: any) => Promise<void> | void) {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } } as any);
  try { await run({ ...await vite.ssrLoadModule('/src/components/ImportantDatesPage.tsx'), ...await vite.ssrLoadModule('/src/components/ImportantDateSheet.tsx') }); }
  finally { await vite.close(); }
}
function nodes(tree: any): any[] { return React.isValidElement(tree) ? [tree, ...React.Children.toArray((tree.props as any).children).flatMap(nodes)] : []; }

test('module history is folded independently of annual count-up and preserves canonical order and source IDs', () => components(({ ImportantDatesContent }) => {
  const render = (pastExpanded: boolean) => renderToStaticMarkup(React.createElement(ImportantDatesContent, { data, filter: 'all', today, pastExpanded, canAct: true, onOpen: noop, onPastToggle: noop }));
  const folded = render(false);
  assert.match(folded, /历史重要日 · 1/); assert.match(folded, /aria-expanded="false"/); assert.doesNotMatch(folded, /上次旅行/);
  assert.ok(folded.indexOf('data-important-date-id="today"') < folded.indexOf('data-important-date-id="future"'));
  assert.ok(folded.indexOf('data-important-date-id="future"') < folded.indexOf('data-important-date-id="annual"'));
  assert.match(folded, /还有 3 天/); assert.match(folded, /就是今天/); assert.match(folded, /第 \d+ 天/); assert.match(folded, /距 7 周年还有 363 天/); assert.match(folded, /共同空间/);
  const expanded = render(true); assert.match(expanded, /已过 3 天/); assert.match(expanded, /data-important-date-id="past" data-space-id="s"/);
  assert.doesNotMatch(expanded, /已過|还有 -/);
}));

test('history disclosure and row click retain exact callbacks and filter scope', () => components(({ ImportantDatesContent }) => {
  let expanded = false; const opened: ImportantDate[] = [];
  const render = () => ImportantDatesContent({ data, filter: { spaceId: 's' }, today, pastExpanded: expanded, canAct: true, onOpen: (d: ImportantDate) => opened.push(d), onPastToggle: () => { expanded = !expanded; } });
  nodes(render()).find(n => n.props['aria-expanded'] !== undefined).props.onClick(); assert.equal(expanded, true);
  nodes(render()).find(n => n.props['aria-label'] === '打开重要日 上次旅行').props.onClick(); assert.equal(opened[0], dates[1]);
  nodes(render()).find(n => n.props['aria-expanded'] !== undefined).props.onClick(); assert.equal(expanded, false);
  const html = renderToStaticMarkup(React.createElement(ImportantDatesContent, { data, filter: { spaceId: 'p' }, today, pastExpanded: false, canAct: true, onOpen: noop, onPastToggle: noop }));
  assert.doesNotMatch(html, /相识|旅行出发|今天的生日|上次旅行/);
}));

test('module Sheet has one header submit and close, preserves all actual fields and immutable edit Space', () => components(({ ImportantDateSheet }) => {
  for (const editing of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(ImportantDateSheet, { moduleView: true, date: editing ? date : undefined, initialTargetId: 'p', memberSpaces: [personal, shared], eligibleSpaces: [personal, shared], canAct: true, onSubmit: async () => undefined, onCancel: noop, onDelete: noop }));
    assert.match(html, /ui-important-sheet-header/); assert.match(html, /aria-label="关闭重要日表单"/);
    assert.equal((html.match(/type="submit"/g) ?? []).length, 1); assert.match(html, /type="submit"[^>]*>保存<\/button>/);
    for (const field of ['important-date-name','important-date-emoji','important-date-repeat','important-date-reminder']) assert.ok(html.includes(`id="${field}"`));
    for (const label of ['开始年份（可选）','月','日']) assert.ok(html.includes(`aria-label="${label}"`));
    if (editing) { assert.doesNotMatch(html, /<select[^>]*id="important-date-space"/); assert.match(html, /删除重要日/); assert.match(html, /<option value="" selected="">不提醒/); }
    else assert.match(html, /<option value="p" selected="">我的空间/);
    assert.doesNotMatch(html, /添加到日历|备注|生日类型|每月|每周|每天/);
  }
  const original = renderToStaticMarkup(React.createElement(ImportantDateSheet, { date, memberSpaces: [shared], eligibleSpaces: [shared], canAct: true, onSubmit: async () => undefined, onCancel: noop, onDelete: noop }));
  assert.match(original, /ui-important-sheet-header/); assert.match(original, /aria-label="关闭重要日表单"/);
  assert.equal((original.match(/type="submit"/g) ?? []).length, 1);
  assert.doesNotMatch(original, /ui-important-emoji-field|保存修改/);
}));

async function sheetRuntime(run: (env: any) => Promise<void>) {
  let cursor = 0; const slots: any[] = [];
  (globalThis as any).__importantV2Hooks = { useState(initial: any) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (v: any) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; }, useRef(value: any) { return slots[cursor++] ??= { current: value }; }, useEffect() {} };
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime','react/jsx-dev-runtime'] }, plugins: [{ name: 'important-v2-handlers', enforce: 'pre', resolveId(id, importer) { if (id === 'react' && importer?.endsWith('/ImportantDateSheet.tsx')) return '\0important-v2-hooks'; }, load(id) { if (id === '\0important-v2-hooks') return 'export const {useState,useRef,useEffect}=globalThis.__importantV2Hooks;'; } }] } as any);
  try {
    const { ImportantDateSheet } = await vite.ssrLoadModule('/src/components/ImportantDateSheet.tsx');
    const calls: any[] = []; const props: any = { moduleView: true, date, memberSpaces: [personal, shared], eligibleSpaces: [personal, shared], canAct: true, onSubmit: async (...args: any[]) => { calls.push(args); }, onCancel: () => calls.push('cancel'), onDelete: () => calls.push('delete') };
    const render = () => { cursor = 0; return ImportantDateSheet(props); };
    const change = (id: string, value: string) => nodes(render()).find(n => n.props.id === id || n.props['aria-label'] === id).props.onChange({ target: { value } });
    const submit = () => nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    const flush = async () => { await new Promise(yes => setImmediate(yes)); };
    await run({ props, calls, render, change, submit, flush, html: () => renderToStaticMarkup(render()) });
  } finally { await vite.close(); delete (globalThis as any).__importantV2Hooks; }
}

test('module header uses original normalization and callbacks, preserving reminder null and Space', () => sheetRuntime(async ({ calls, render, change, submit, flush, html }) => {
  change('important-date-name', '  相识更新  '); submit(); await flush(); assert.equal(calls[0][0].name, '相识更新'); assert.equal(calls[0][0].reminder_kind, null); assert.equal(calls[0][1], 's');
  nodes(render()).find(n => n.props['aria-label'] === '关闭重要日表单').props.onClick(); assert.equal(calls[1], 'cancel');
  nodes(render()).find(n => n.type === 'button' && n.props.children === '删除重要日').props.onClick(); assert.equal(calls[2], 'delete');
  change('月', '2'); change('日', '30'); submit(); await flush(); assert.equal(calls.length, 3); assert.match(html(), /请输入有效日期/);
}));

test('module save failure retains draft, duplicate save and close are blocked, eligibility loss blocks retry', () => sheetRuntime(async ({ props, calls, render, change, submit, flush, html }) => {
  let release!: () => void; const pending = new Promise<void>(yes => { release = yes; });
  props.onSubmit = async (...args: any[]) => { calls.push(args); await pending; throw new Error('保存失败，请重试。'); };
  change('important-date-name', '保留文字'); submit(); submit(); assert.equal(calls.length, 1);
  assert.equal(nodes(render()).find(n => n.props['aria-label'] === '关闭重要日表单').props.disabled, true);
  release(); await flush(); assert.match(html(), /保存失败，请重试。/); assert.match(html(), /value="保留文字"/);
  props.canAct = false; submit(); await flush(); assert.equal(calls.length, 1);
  props.canAct = true; props.eligibleSpaces = [personal]; submit(); await flush(); assert.equal(calls.length, 1);
  props.eligibleSpaces = [personal, shared]; props.onSubmit = async (...args: any[]) => calls.push(args); submit(); await flush(); assert.equal(calls.length, 2);
}));

test('empty module keeps the original create callback, disabled qualification and transparent 18px entry', () => components(({ ImportantDatesContent, ImportantDatesPage }) => {
  let created = 0;
  const props = { data: { ...data, dates: [] }, filter: 'all', today, pastExpanded: false, canAct: true, onOpen: noop, onPastToggle: noop, onCreate: () => { created++; } };
  const tree = ImportantDatesContent(props);
  nodes(tree).find(n => n.type === 'button' && n.props.onClick === props.onCreate).props.onClick(); assert.equal(created, 1);
  const html = renderToStaticMarkup(tree); assert.match(html, /还没有重要日/); assert.match(html, /历史重要日 · 0/);
  const blocked = ImportantDatesContent({ ...props, canAct: false }); assert.equal(nodes(blocked).find(n => n.type === 'button' && n.props.onClick === props.onCreate).props.disabled, true);
  const page = renderToStaticMarkup(React.createElement(ImportantDatesPage, { userId: 'me', entry: { memberSpaces: data.memberSpaces, eligibleSpaces: data.eligibleSpaces }, initialData: data, onHubBack: noop, onNoEligible: noop }));
  const button = page.match(/<button[^>]*aria-label="新建重要日"[\s\S]*?<\/button>/)![0];
  assert.match(button, /bg-transparent/); assert.match(button, /width="18" height="18"/);
}));


test('module Emoji chooser starts folded, toggles without submitting and preserves custom existing text', () => sheetRuntime(async ({ render, calls, html }) => {
  const trigger = () => nodes(render()).find(n => n.props['aria-controls'] === 'important-date-emoji-choices');
  assert.equal(trigger().props['aria-expanded'], false);
  assert.match(html(), /value="🌿"/); assert.doesNotMatch(html(), /选择 🎂/);
  trigger().props.onClick(); assert.equal(trigger().props['aria-expanded'], true);
  const choices = nodes(render()).filter(n => n.props['aria-label']?.startsWith('选择 '));
  assert.equal(choices.length, 12); assert.ok(choices.every(n => n.props.type === 'button'));
  trigger().props.onClick(); assert.equal(trigger().props['aria-expanded'], false); assert.equal(calls.length, 0);
}));

test('Emoji selection and clear stay local until original submit, cancel never persists changes', () => sheetRuntime(async ({ render, calls, submit, flush }) => {
  const click = (label: string) => nodes(render()).find(n => n.props['aria-label'] === label || n.props.children === label).props.onClick();
  click('选择'); click('选择 🎂');
  assert.equal(nodes(render()).find(n => n.props.id === 'important-date-emoji').props.value, '🎂'); assert.equal(calls.length, 0);
  click('选择'); click('清除');
  assert.equal(nodes(render()).find(n => n.props.id === 'important-date-emoji').props.value, ''); assert.equal(calls.length, 0);
  submit(); await flush(); assert.equal(calls[0][0].emoji, null);
  click('选择'); click('选择 ❤️'); click('关闭重要日表单');
  assert.equal(calls.length, 2); assert.equal(calls[1], 'cancel');
}));

test('chooser Escape closes only the choices and restores focus; composition Escape keeps choices', () => sheetRuntime(async ({ render, calls }) => {
  const trigger = () => nodes(render()).find(n => n.props['aria-controls'] === 'important-date-emoji-choices');
  trigger().props.onClick(); let focused = 0; trigger().ref.current = { focus() { focused++; } };
  const field = () => nodes(render()).find(n => n.props.className === 'ui-important-emoji-field');
  let prevented = 0, stopped = 0;
  field().props.onKeyDownCapture({ key: 'Escape', nativeEvent: { isComposing: true }, preventDefault() { prevented++; }, stopPropagation() { stopped++; } });
  assert.equal(trigger().props['aria-expanded'], true); assert.equal(focused, 0);
  field().props.onKeyDownCapture({ key: 'Escape', nativeEvent: { isComposing: false }, preventDefault() { prevented++; }, stopPropagation() { stopped++; } });
  assert.equal(trigger().props['aria-expanded'], false); assert.equal(focused, 1); assert.equal(prevented, 1); assert.equal(stopped, 2); assert.equal(calls.length, 0);
}));

test('manual Emoji code-point validation and default Home/Calendar mode remain unchanged', () => sheetRuntime(async ({ props, render, change, submit, calls, flush, html }) => {
  props.moduleView = false; assert.doesNotMatch(html(), /important-date-emoji-choices|ui-important-emoji-field/);
  props.moduleView = true;
  change('important-date-emoji', '🦋✨ anniversary'); submit(); await flush(); assert.equal(calls[0][0].emoji, '🦋✨ anniversary');
  change('important-date-emoji', '🌸'.repeat(32)); submit(); await flush(); assert.equal(calls[1][0].emoji, '🌸'.repeat(32));
  change('important-date-emoji', '🌸'.repeat(33)); submit(); await flush(); assert.equal(calls.length, 2); assert.match(html(), /role="alert"/);
  assert.equal(nodes(render()).find(n => n.props.id === 'important-date-emoji').props.value, '🌸'.repeat(33));
}));

test('pending Emoji save disables picker; failed save preserves selected draft for retry', () => sheetRuntime(async ({ props, render, calls, submit, flush, html }) => {
  nodes(render()).find(n => n.props.children === '选择').props.onClick();
  nodes(render()).find(n => n.props['aria-label'] === '选择 🥂').props.onClick();
  let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
  props.onSubmit = async (...args: any[]) => { calls.push(args); await pending; throw new Error('保存失败，请重试。'); };
  submit(); submit(); assert.equal(calls.length, 1);
  assert.equal(nodes(render()).find(n => n.props['aria-controls'] === 'important-date-emoji-choices').props.disabled, true);
  release(); await flush(); assert.match(html(), /保存失败，请重试。/);
  assert.equal(nodes(render()).find(n => n.props.id === 'important-date-emoji').props.value, '🥂');
  props.onSubmit = async (...args: any[]) => calls.push(args); submit(); await flush(); assert.equal(calls[1][0].emoji, '🥂');
}));
