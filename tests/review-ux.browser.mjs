import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const { webkit, chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.REVIEW_UX_ARTIFACTS;
const browsers = new Map();
let files;
const api = `export const supabase={auth:{async getUser(){return {data:{user:{id:'me'}},error:null}}},from(table){return window.reviewUx.query(table)},rpc(name,args){return window.reviewUx.rpc(name,args)}};`;
before(async () => {
  files = (await build({ root, configFile: false, envFile: false, logLevel: 'error', plugins: [{ name: 'review-ux-boundary', enforce: 'pre', resolveId(id) { if (/\/supabase(?:\.ts)?$/.test(id)) return '\0review-ux-client'; }, load(id) { if (id === '\0review-ux-client') return api; } }], build: { write: false, minify: false, rollupOptions: { input: root + 'tests/fixtures/review-ux-browser.jsx' } } })).output;
  if (out) await mkdir(out, { recursive: true });
  browsers.set('WebKit', await webkit.launch({ headless: true }));
  browsers.set('Chrome', await chromium.launch({ channel: 'chrome', headless: true }));
});
after(async () => { for (const browser of browsers.values()) await browser.close(); });
async function pageFor(engine, mode = '', width = 375) {
  const page = await browsers.get(engine).newPage({ viewport: { width, height: 812 }, hasTouch: true, isMobile: true });
  page.setDefaultTimeout(3000); page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    assert.equal(url.origin, 'http://127.0.0.1:5175', 'all I/O must stay inside the offline fixture');
    const file = files.find(f => '/' + f.fileName === url.pathname);
    if (file) return route.fulfill({ contentType: file.fileName.endsWith('.css') ? 'text/css' : 'text/javascript', body: file.type === 'chunk' ? file.code : file.source });
    if (url.pathname !== '/__review_ux') return route.abort();
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><div id="root"></div><link rel="stylesheet" href="/${files.find(f => f.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find(f => f.isEntry).fileName}"></script></html>` });
  });
  await page.goto('http://127.0.0.1:5175/__review_ux?mode=' + mode);
  await page.getByRole('button', { name: mode === 'blank' ? '填写我的回顾' : '编辑我的回顾', exact: true }).waitFor();
  return page;
}
// Synthetic PointerEvents exercise the real DOM/Hook in both engines; native Chrome touch is covered below.
async function swipe(target, { dx = 120, dy = 3, cancel = false, pointerType = 'touch' } = {}) {
  await target.evaluate((el, o) => {
    const p = { bubbles: true, cancelable: true, composed: true, pointerId: 17, pointerType: o.pointerType, isPrimary: true, buttons: 1 };
    const y = Math.max(100, el.getBoundingClientRect().y + 10), x = 4;
    el.dispatchEvent(new PointerEvent('pointerdown', { ...p, clientX: x, clientY: y }));
    el.dispatchEvent(new PointerEvent('pointermove', { ...p, clientX: x + o.dx / 2, clientY: y + o.dy / 2 }));
    el.dispatchEvent(new PointerEvent(o.cancel ? 'pointercancel' : 'pointerup', { ...p, buttons: 0, clientX: x + o.dx, clientY: y + o.dy }));
  }, { dx, dy, cancel, pointerType });
}
const edit = page => page.getByRole('button', { name: '编辑我的回顾', exact: true });
const mark = page => page.getByRole('button', { name: '标记已填写', exact: true });
const labels = ['近期专注事项', '近期进展', '面临问题', '下一步计划'];
async function fill(page) { for (const label of labels) await page.getByRole('textbox', { name: label, exact: true }).fill(label + ' 未保存'); }
async function assertDraft(page) { for (const label of labels) assert.equal(await page.getByRole('textbox', { name: label, exact: true }).inputValue(), label + ' 未保存'); }
for (const engine of ['WebKit', 'Chrome']) {
  test(`${engine}: reading and unchanged editing swipes return to history without confirmation`, async () => {
    for (const editing of [false, true]) {
      const page = await pageFor(engine);
      try {
        if (editing) await edit(page).click();
        page.on('dialog', () => assert.fail('clean page must not ask to discard'));
        await swipe(page.locator('main'));
        await page.getByRole('heading', { name: '回顾历史列表', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => window.reviewUx.backs), 1); assert.deepEqual(page.errors, []);
      } finally { await page.close(); }
    }
  });
  test(`${engine}: dirty swipe dismiss keeps four fields; top back shares guard; confirmed swipe leaves`, async () => {
    const page = await pageFor(engine);
    try {
      await edit(page).click(); await fill(page);
      await page.waitForFunction(() => window.reviewUx.dirty);
      for (const action of [() => swipe(page.locator('main')), () => page.getByRole('button', { name: '回顾列表', exact: true }).click()]) {
        let prompted = false;
        page.once('dialog', dialog => { prompted = true; assert.match(dialog.message(), /未保存.*返回历史列表/); return dialog.dismiss(); });
        await action(); assert.equal(prompted, true); await assertDraft(page);
        assert.equal(await page.evaluate(() => window.reviewUx.backs), 0);
      }
      page.once('dialog', dialog => dialog.accept()); await swipe(page.locator('main'));
      await page.getByRole('heading', { name: '回顾历史列表', exact: true }).waitFor(); assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: vertical, left, short, cancelled, mouse and textarea gestures never navigate`, async () => {
    const page = await pageFor(engine);
    try {
      for (const options of [{ dx: 15, dy: 120 }, { dx: -120 }, { dx: 20 }, { cancel: true }, { pointerType: 'mouse' }]) await swipe(page.locator('main'), options);
      await edit(page).click(); await fill(page);
      await swipe(page.getByRole('textbox', { name: labels[0], exact: true })); await assertDraft(page);
      assert.equal(await page.evaluate(() => window.reviewUx.backs), 0); assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: date/delete dialogs block parent swipes without dismissing content`, async () => {
    const page = await pageFor(engine);
    try {
      await page.getByRole('button', { name: '更正回顾日期', exact: true }).click();
      await swipe(page.locator('main')); assert.equal(await page.getByRole('dialog').count(), 1);
      await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
      await page.getByRole('button', { name: '删除回顾', exact: true }).click();
      await swipe(page.locator('main')); assert.equal(await page.getByRole('dialog').count(), 1);
      await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
      assert.equal(await page.evaluate(() => window.reviewUx.backs), 0); assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  for (const width of [320, 375, 390, 430, 1024]) test(`${engine} ${width}: saved reading view marks own revision directly; counterpart remains read-only`, async () => {
    const page = await pageFor(engine, 'updated', width);
    try {
      assert.equal(await page.locator('textarea').count(), 0); assert.equal(await mark(page).count(), 1);
      const box = await mark(page).boundingBox(); assert.ok(box.height >= 44);
      const content = page.getByLabel('我的回顾内容', { exact: true });
      const status = content.getByRole('status');
      assert.match(await status.innerText(), /有更新/);
      const statusBox = await status.boundingBox();
      assert.ok(box.x >= statusBox.x + statusBox.width, 'status and action never overlap');
      assert.ok(Math.abs(box.y + box.height / 2 - statusBox.y - statusBox.height / 2) < 2, 'status and action share a row');
      const styles = await mark(page).evaluate(el => { const s = getComputedStyle(el); return { font: s.fontSize, weight: s.fontWeight, border: s.borderTopWidth, background: s.backgroundColor }; });
      const editStyles = await edit(page).evaluate(el => { const s = getComputedStyle(el); return { font: s.fontSize, weight: s.fontWeight }; });
      assert.equal(styles.font, editStyles.font); assert.equal(styles.weight, editStyles.weight);
      assert.equal(styles.border, '0px'); assert.equal(styles.background, 'rgba(0, 0, 0, 0)');
      assert.ok(parseFloat(styles.font) < parseFloat(await page.locator('#review-mine-panel > h2').evaluate(el => getComputedStyle(el).fontSize)));
      assert.ok((await edit(page).boundingBox()).y > (await content.locator('.rounded-ui-group').boundingBox()).y, 'edit stays below content');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (out && [375, 390, 430].includes(width)) await page.screenshot({ path: `${out}/${engine}-${width}-reading.png`, fullPage: true });
      await mark(page).focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.reviewUx.row.filled_revision === 3);
      await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).some(b => b.textContent === '标记已填写'));
      const calls = await page.evaluate(() => window.reviewUx.calls);
      assert.deepEqual(calls, [{ name: 'mark_my_review_filled', args: { p_review_id: 'review', p_expected_content_revision: 3 } }]);
      assert.match(await page.getByLabel('我的回顾内容', { exact: true }).innerText(), /填写状态：已填写/);
      if (width < 768) await page.getByRole('tab', { name: '对方', exact: true }).click();
      assert.equal(await page.locator('#review-other-panel button, #review-other-panel textarea').count(), 0);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: blank/completed entries have no redundant mark; Personal saved entry still marks`, async () => {
    for (const mode of ['blank', 'completed', 'personal']) {
      const page = await pageFor(engine, mode);
      try {
        assert.equal(await mark(page).count(), mode === 'personal' ? 1 : 0);
        if (mode === 'personal') { assert.equal(await page.getByRole('tablist').count(), 0); await mark(page).click(); await page.waitForFunction(() => window.reviewUx.row.filled_revision === 3); }
        else assert.equal(await page.evaluate(() => window.reviewUx.calls.length), 0);
        assert.deepEqual(page.errors, []);
      } finally { await page.close(); }
    }
  });
  test(`${engine}: stale reading mark conflicts, retains viewed content and reload confirmation`, async () => {
    const page = await pageFor(engine);
    try {
      await page.evaluate(() => window.reviewUx.remote()); await mark(page).click();
      await page.getByRole('alert').filter({ hasText: '本次未完成标记' }).waitFor();
      assert.equal(await mark(page).isDisabled(), true);
      assert.equal(await page.evaluate(() => window.reviewUx.row.filled_revision), null);
      assert.match(await page.getByLabel('我的回顾内容', { exact: true }).first().innerText(), /已保存专注/);
      await page.getByRole('button', { name: '查看最新内容', exact: true }).click();
      await page.getByLabel('服务器最新回顾内容', { exact: true }).waitFor();
      assert.match(await page.getByLabel('我的回顾内容', { exact: true }).first().innerText(), /已保存专注/);
      page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: '重新载入最新内容', exact: true }).click();
      assert.equal(await mark(page).isDisabled(), true);
      page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '重新载入最新内容', exact: true }).click();
      await page.getByRole('alert').waitFor({ state: 'hidden' }); await mark(page).click();
      await page.waitForFunction(() => window.reviewUx.row.filled_revision === 4);
      assert.deepEqual((await page.evaluate(() => window.reviewUx.calls)).map(c => c.args.p_expected_content_revision), [3, 4]);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: pending mark/save blocks swipe/back/edit; nonconflict failure is visible and retryable`, async () => {
    const page = await pageFor(engine);
    try {
      await page.evaluate(() => { window.reviewUx.hold = true; }); await mark(page).click();
      await page.getByRole('button', { name: '标记中…', exact: true }).waitFor();
      assert.equal(await edit(page).isDisabled(), true);
      await swipe(page.locator('main')); await page.getByRole('button', { name: '回顾列表', exact: true }).click();
      assert.equal(await page.evaluate(() => window.reviewUx.backs), 0);
      await page.evaluate(() => { window.reviewUx.error = 'network'; window.reviewUx.hold = false; window.reviewUx.release(); });
      await page.getByRole('alert').filter({ hasText: '标记失败' }).waitFor();
      assert.equal(await mark(page).isDisabled(), false);
      await page.evaluate(() => { window.reviewUx.error = null; }); await edit(page).click(); await fill(page);
      await page.evaluate(() => { window.reviewUx.hold = true; }); await page.getByRole('button', { name: '保存草稿', exact: true }).click();
      await page.getByRole('button', { name: '保存中…', exact: true }).waitFor();
      await swipe(page.locator('main')); assert.equal(await page.evaluate(() => window.reviewUx.backs), 0);
      await page.evaluate(() => { window.reviewUx.hold = false; window.reviewUx.release(); });
      await page.getByRole('button', { name: '保存中…', exact: true }).waitFor({ state: 'hidden' });
      await swipe(page.locator('main')); await page.getByRole('heading', { name: '回顾历史列表', exact: true }).waitFor();
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
}
test('Chrome: native left-edge touch returns once without a trailing click', async () => {
  const page = await pageFor('Chrome');
  try {
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 4, y: 180, id: 1 }] });
    for (const x of [34, 74, 124]) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 182, id: 1 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.getByRole('heading', { name: '回顾历史列表', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.reviewUx.backs), 1); assert.deepEqual(page.errors, []);
  } finally { await page.close(); }
});
