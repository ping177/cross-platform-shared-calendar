import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

function nodes(tree: any): any[] { return React.isValidElement(tree) ? [tree, ...React.Children.toArray((tree.props as any).children).flatMap(nodes)] : []; }
const userId = 'aa000000-0000-4000-8000-000000000001';
async function runtime(file: string, run: (env: any) => Promise<void>) {
  let cursor = 0; const slots: any[] = [], effects: any[] = [], calls: any[] = [];
  const hooks = { useState(initial: any) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (v: any) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; }, useRef(initial: any) { return slots[cursor++] ??= { current: initial }; }, useEffect(fn: any) { effects.push(fn); } };
  const client: any = { storage: { from: () => ({ createSignedUrl: async (path: string, seconds: number) => { calls.push({ path, seconds }); return { data: { signedUrl: 'https://example.invalid/signed-photo' }, error: null }; } }) } };
  const transport: any = { changeAvatar: async (_c: any, _id: string, choice: any) => { calls.push(choice); return { profile: { display_name: '我', avatar_preset: choice.preset, avatar_path: null }, cleanupPaths: [] }; }, cleanupAvatarFiles: async () => [], findUnusedAvatarPhotos: async () => [] };
  (globalThis as any).__avatarHooks = hooks; (globalThis as any).__avatarClient = client; (globalThis as any).__avatarTransport = transport;
  const v = await createServer({ configFile: false, envFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false }, ssr: { noExternal: [/^react$/], external: ['react/jsx-runtime', 'react/jsx-dev-runtime'] }, plugins: [{ name: 'avatar-runtime', enforce: 'pre', resolveId(id) { if (id === 'react') return '\0avatar-hooks'; if (/\/supabase(?:\.ts)?$/.test(id)) return '\0avatar-client'; if (/\/avatar-data$/.test(id)) return '\0avatar-data'; }, load(id) { if (id === '\0avatar-hooks') return 'export const {useState,useEffect,useRef}=globalThis.__avatarHooks;'; if (id === '\0avatar-client') return 'export const supabase=globalThis.__avatarClient;'; if (id === '\0avatar-data') return 'export class AvatarSaveError extends Error {} export const changeAvatar=(...a)=>globalThis.__avatarTransport.changeAvatar(...a); export const cleanupAvatarFiles=(...a)=>globalThis.__avatarTransport.cleanupAvatarFiles(...a); export const findUnusedAvatarPhotos=(...a)=>globalThis.__avatarTransport.findUnusedAvatarPhotos(...a);'; } }] } as any);
  try {
    const m = await v.ssrLoadModule('/src/components/' + file + '.tsx'); const saved: any[] = []; let closed = 0;
    const props: any = { userId, profile: { display_name: '我', avatar_preset: 'cat', avatar_path: null }, onSaved: (p: any) => { saved.push(p); props.profile = p; }, onClose: () => closed++ };
    const render = () => { cursor = 0; return m[file](props); };
    const click = (label: string) => nodes(render()).find(n => n.type === 'button' && (n.props['aria-label'] === label || n.props.children === label)).props.onClick();
    await run({ props, render, effects, calls, client, transport, saved, closed: () => closed, click, html: () => renderToStaticMarkup(render()), flush: () => new Promise(r => setImmediate(r)) });
  } finally { await v.close(); delete (globalThis as any).__avatarHooks; delete (globalThis as any).__avatarClient; delete (globalThis as any).__avatarTransport; }
}
test('picker offers upload, all 12 original presets and default reset with selected semantics', () => runtime('AvatarPicker', async ({ html }) => {
  const markup = html(); assert.equal((markup.match(/aria-pressed=/g) || []).length, 12); assert.match(markup, /type="file".*accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(markup, /role="dialog"|aria-modal="true"/); assert.match(markup, /使用猫头像.*aria-pressed="true"/); assert.match(markup, /恢复默认头像/);
}));
test('preset and reset persist the choice; same-tick attempts and close are locked; failure retries', () => runtime('AvatarPicker', async ({ click, calls, transport, saved, closed, html, flush }) => {
  let release: any; transport.changeAvatar = async (_c: any, _id: string, choice: any) => { calls.push(choice); return new Promise(r => { release = r; }); };
  click('使用枝叶头像'); click('使用月头像'); click('关闭头像选择'); assert.equal(calls.length, 1); assert.equal(closed(), 0); assert.match(html(), /正在处理/);
  release({ profile: { display_name: '我', avatar_preset: 'leaf', avatar_path: null }, cleanupPaths: [] }); await flush(); assert.equal(saved[0].avatar_preset, 'leaf'); assert.equal(closed(), 1);
  transport.changeAvatar = async () => { throw new Error('fixture save failure'); }; click('恢复默认头像'); await flush(); assert.match(html(), /fixture save failure/);
  transport.changeAvatar = async (_c: any, _id: string, choice: any) => ({ profile: { display_name: '我', avatar_preset: choice.preset, avatar_path: null }, cleanupPaths: [] }); click('恢复默认头像'); await flush(); assert.equal(saved.at(-1).avatar_preset, null);
}));
test('cleanup warning keeps panel open and retries cleanup without another profile save', () => runtime('AvatarPicker', async ({ click, transport, saved, closed, html, flush, calls }) => {
  transport.changeAvatar = async () => ({ profile: { display_name: '我', avatar_preset: 'moon', avatar_path: null }, cleanupPaths: ['owned-old-photo'] });
  click('使用月头像'); await flush(); assert.equal(saved.length, 1); assert.equal(closed(), 0); assert.match(html(), /重试清理旧照片/); click('重试清理旧照片'); await flush(); assert.doesNotMatch(html(), /重试清理旧照片/); assert.equal(calls.length, 0);
}));
test('preset/default rendering never signs; invalid or foreign paths fail closed', () => runtime('ProfileAvatar', async ({ props, html, effects, calls, flush }) => {
  props.preset = 'cat'; assert.match(html(), /\/avatars\/cat.svg/); effects.at(-1)(); await flush(); assert.equal(calls.length, 0);
  props.preset = null; props.path = 'other/secret.jpg'; html(); effects.at(-1)(); await flush(); assert.match(html(), /lucide-user-round/); assert.equal(calls.length, 0);
}));
test('photo URLs refresh before expiry, on focus and failure with bounded retry; unmount cancels timers', () => runtime('ProfileAvatar', async ({ props, render, effects, client, calls, html, flush }) => {
  const originals = { document: (globalThis as any).document, window: (globalThis as any).window, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  const timers = new Map<number, { fn: any; delay: number }>(); let next = 0; const listeners: any = {};
  (globalThis as any).setTimeout = (fn: any, delay: number) => { timers.set(++next, { fn, delay }); return next; }; (globalThis as any).clearTimeout = (id: number) => timers.delete(id);
  (globalThis as any).document = { visibilityState: 'visible', addEventListener: (name: string, fn: any) => listeners[name] = fn, removeEventListener: (name: string) => delete listeners[name] };
  (globalThis as any).window = { addEventListener: (name: string, fn: any) => listeners[name] = fn, removeEventListener: (name: string) => delete listeners[name] };
  try {
    props.path = `${userId}/bb000000-0000-4000-8000-000000000001.jpg`; render(); const cleanup = effects.at(-1)(); await flush(); assert.equal(calls[0].seconds, 300); assert.match(html(), /signed-photo/); assert.equal([...timers.values()][0].delay, 240_000);
    [...timers.values()][0].fn(); await flush(); assert.equal(calls.length, 2); listeners.focus(); listeners.focus(); await flush(); assert.equal(calls.length, 3);
    nodes(render()).find(n => n.type === 'img').props.onError(); assert.doesNotMatch(html(), /<img/); assert.equal([...timers.values()][0].delay, 30_000);
    client.storage.from = () => ({ createSignedUrl: async () => ({ data: null, error: new Error('expired') }) }); [...timers.values()][0].fn(); await flush(); assert.match(html(), /lucide-user-round/); cleanup(); assert.equal(timers.size, 0); assert.equal(Object.keys(listeners).length, 0);
  } finally { Object.assign(globalThis, originals); }
}));
test('Space member surfaces render presets without edit actions; missing profiles use default', async () => {
  const v = await createServer({ configFile: false, envFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } } as any);
  try {
    const { SpaceDetailContent } = await v.ssrLoadModule('/src/components/SpaceManagementPage.tsx');
    const { MemberSheet } = await v.ssrLoadModule('/src/components/MemberSheet.tsx');
    const members = [{ user_id: userId, role: 'owner', profiles: { display_name: '本人', avatar_preset: 'cat' } }, { user_id: 'other', role: 'member', profiles: { display_name: '同伴', avatar_preset: 'leaf' } }, { user_id: 'missing', role: 'member', profiles: null }];
    const detail = renderToStaticMarkup(React.createElement(SpaceDetailContent, { space: { id: 's', name: '共同空间', kind: 'shared', membershipRole: 'member' }, members, moduleState: 'disabled', moduleBusy: false, moduleError: '', onModuleRetry() {}, onModuleToggle() {}, onSpaceChange() {} }));
    const sheet = renderToStaticMarkup(React.createElement(MemberSheet, { members, userId, onClose() {} }));
    for (const markup of [detail, sheet]) { assert.match(markup, /\/avatars\/cat.svg/); assert.match(markup, /\/avatars\/leaf.svg/); assert.match(markup, /lucide-user-round/); assert.doesNotMatch(markup, /更换头像|修改显示名称|使用猫头像/); }
  } finally { await v.close(); }
});
test('member reader retains avatar metadata for object and array Profile relationships', async () => {
  const row = { space_id: 's', user_id: userId, role: 'owner', profiles: { display_name: '本人', avatar_preset: 'cat', avatar_path: null } };
  (globalThis as any).__avatarMemberRows = [row, { ...row, user_id: 'other', profiles: [{ display_name: '同伴', avatar_preset: null, avatar_path: 'owned-photo' }] }, { ...row, user_id: 'missing', profiles: [] }];
  const v = await createServer({ configFile: false, envFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false }, plugins: [{ name: 'member-avatar-reader', enforce: 'pre', resolveId(id) { if (/\/supabase(?:\.ts)?$/.test(id)) return '\0member-avatar-client'; }, load(id) { if (id === '\0member-avatar-client') return 'export const supabase={from(){const q={select(){return q},eq(){return q},order(){return q},then(resolve){return Promise.resolve({data:globalThis.__avatarMemberRows,error:null}).then(resolve)}};return q}};'; } }] } as any);
  try { const { readSpaceMembers } = await v.ssrLoadModule('/src/lib/space-members.ts'); const result = await readSpaceMembers('s'); assert.equal(result[0].profiles.avatar_preset, 'cat'); assert.equal(result[1].profiles.avatar_path, 'owned-photo'); assert.equal(result[2].profiles, null); }
  finally { await v.close(); delete (globalThis as any).__avatarMemberRows; }
});
