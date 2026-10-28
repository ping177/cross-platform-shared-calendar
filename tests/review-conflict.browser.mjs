import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const { webkit, chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.REVIEW_CONFLICT_ARTIFACTS;
let files; const browsers = new Map(); const results = [];
const api = `export const supabase={auth:{async getUser(){return {data:{user:{id:'me'}},error:null}}},from(){const q={select(){return q},eq(){return q},async maybeSingle(){return window.reviewFixture.read()}};return q},async rpc(name,args){return window.reviewFixture.rpc(name,args)}};`;
before(async () => {
  files = (await build({ root, configFile: false, envFile: false, logLevel: 'error', plugins: [{ name: 'review-conflict-boundary', enforce: 'pre', resolveId(id) { if (/\/supabase(?:\.ts)?$/.test(id)) return '\0review-test-client'; }, load(id) { if (id === '\0review-test-client') return api; } }], build: { write: false, minify: false, rollupOptions: { input: root + 'tests/fixtures/review-conflict-browser.jsx' } } })).output;
  if (out) await mkdir(out, { recursive: true });
  browsers.set('WebKit', await webkit.launch({ headless: true }));
  browsers.set('Chrome', await chromium.launch({ channel: 'chrome', headless: true }));
});
after(async () => { for (const browser of browsers.values()) await browser.close(); if (out) await writeFile(out + '/results.json', JSON.stringify(results, null, 2)); });
async function pageFor(engine, width = 375) {
  const page = await browsers.get(engine).newPage({ viewport: { width, height: 812 } });
  page.setDefaultTimeout(3000); page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    assert.equal(url.origin, 'http://127.0.0.1:5175', 'all I/O stays in offline fixture');
    const asset = files.find(f => '/' + f.fileName === url.pathname);
    if (asset) return route.fulfill({ contentType: asset.fileName.endsWith('.css') ? 'text/css' : 'text/javascript', body: asset.type === 'chunk' ? asset.code : asset.source });
    if (url.pathname !== '/__review_conflict') return route.abort();
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/${files.find(f => f.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find(f => f.isEntry).fileName}"></script></html>` });
  });
  await page.goto('http://127.0.0.1:5175/__review_conflict');
  await page.getByRole('textbox', { name: '近期专注事项', exact: true }).waitFor();
  return page;
}
const labels = ['近期专注事项', '近期进展', '面临问题', '下一步计划'];
async function fillDraft(page) { for (const label of labels) await page.getByRole('textbox', { name: label, exact: true }).fill(label + ' 电脑未保存'); }
async function conflict(page) { await fillDraft(page); await page.evaluate(() => window.reviewFixture.remote()); await page.getByRole('button', { name: '保存草稿', exact: true }).click(); await page.getByRole('alert').waitFor(); }
for (const engine of ['WebKit', 'Chrome']) {
  for (const width of [320, 375, 430, 768, 1024, 1440]) test(`${engine} ${width}: conflict preserves fields, read-only latest, confirmed reload and guarded retry`, async () => {
    const page = await pageFor(engine, width);
    try {
      await conflict(page);
      assert.match(await page.getByRole('alert').innerText(), /其他设备.*本次未保存.*输入仍保留/);
      for (const label of labels) assert.equal(await page.getByRole('textbox', { name: label, exact: true }).inputValue(), label + ' 电脑未保存');
      assert.equal(await page.getByRole('button', { name: '保存草稿', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: '我已填写', exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: '查看最新内容', exact: true }).focus(); await page.keyboard.press('Enter');
      await page.getByLabel('服务器最新回顾内容', { exact: true }).waitFor();
      assert.match(await page.getByLabel('服务器最新回顾内容', { exact: true }).innerText(), /手机新专注/);
      for (const label of labels) assert.equal(await page.getByRole('textbox', { name: label, exact: true }).inputValue(), label + ' 电脑未保存');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const button = page.getByRole('button', { name: '重新载入最新内容', exact: true });
      page.once('dialog', dialog => { assert.match(dialog.message(), /未保存内容将丢弃/); return dialog.dismiss(); });
      await button.click(); assert.equal(await page.getByRole('textbox', { name: '近期专注事项', exact: true }).inputValue(), '近期专注事项 电脑未保存');
      if (out && width === 375) await page.screenshot({ path: `${out}/${engine}-conflict.png`, fullPage: true });
      page.once('dialog', dialog => dialog.accept()); await button.click();
      await page.waitForFunction(() => document.querySelector('textarea').value === '手机新专注');
      assert.equal(await page.getByRole('alert').count(), 0);
      await page.getByRole('textbox', { name: '近期进展', exact: true }).fill('重新编辑进展');
      await page.getByRole('button', { name: '保存草稿', exact: true }).click();
      await page.waitForFunction(() => window.reviewFixture.row.content_revision === 3);
      const state = await page.evaluate(() => ({ row: window.reviewFixture.row, calls: window.reviewFixture.calls }));
      assert.equal(state.row.focus, '手机新专注'); assert.equal(state.row.progress, '重新编辑进展');
      assert.deepEqual(state.calls.filter(c => c.name === 'save_my_review_entry').map(c => c.args.p_expected_content_revision), [1, 2]);
      assert.deepEqual(page.errors, []); results.push({ engine, width, conflict: 'preserved', reload: 'confirmed', savedRevision: state.row.content_revision });
    } finally { await page.close(); }
  });
  test(`${engine}: stale marker rejects and failed confirmed reload preserves all input`, async () => {
    const page = await pageFor(engine);
    try {
      await page.evaluate(() => window.reviewFixture.remote());
      await page.getByRole('button', { name: '我已填写', exact: true }).click();
      await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').innerText(), /本次未完成标记/);
      assert.equal(await page.evaluate(() => window.reviewFixture.row.filled_revision), null);
      await fillDraft(page); await page.evaluate(() => { window.reviewFixture.readError = true; });
      page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '重新载入最新内容', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[role="alert"]').textContent.includes('读取失败'));
      for (const label of labels) assert.equal(await page.getByRole('textbox', { name: label, exact: true }).inputValue(), label + ' 电脑未保存');
      assert.equal(await page.getByRole('button', { name: '保存草稿', exact: true }).isDisabled(), true);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
}
