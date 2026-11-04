import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const { webkit, chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = process.env.EXPORT_ARTIFACTS || '/private/tmp/calendar-export-slice1/browser';
const browsers = new Map();
let files;
before(async () => {
  files = (await build({ root, configFile: false, envFile: false, logLevel: 'error', define: { 'import.meta.env.DEV': 'true' },
    build: { write: false, rollupOptions: { input: root + 'tests/fixtures/data-export-browser.tsx' } } })).output;
  await mkdir(artifacts, { recursive: true });
  await writeFile(artifacts + '/fixture-bundle.json', JSON.stringify(files.filter((f) => f.type === 'chunk').map((f) => ({ file: f.fileName, entry: f.isEntry, bytes: Buffer.byteLength(f.code), gzip: gzipSync(f.code).length, modules: Object.keys(f.modules).filter((m) => /fflate|data-export/.test(m)) })), null, 2));
  browsers.set('WebKit', await webkit.launch());
  browsers.set('Chrome', await chromium.launch({ channel: 'chrome', headless: true }));
});
after(async () => { for (const browser of browsers.values()) await browser.close(); });

async function pageFor(engine, sharing = 'absent') {
  const page = await browsers.get(engine).newPage({ viewport: { width: 375, height: 812 }, acceptDownloads: true });
  page.setDefaultTimeout(4000);
  page.errors = []; page.on('pageerror', (error) => page.errors.push(error.message));
  await page.addInitScript((sharing) => {
    window.shareCalls = []; window.shareOutcome = 'success'; window.fileUrls = []; window.revoked = [];
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const url = create(blob); if (blob instanceof File) window.fileUrls.push(url); return url; };
    URL.revokeObjectURL = (url) => { window.revoked.push(url); revoke(url); };
    if (sharing === 'native') return;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: sharing === 'absent' ? undefined : () => {
      if (sharing === 'throw') throw Error('fixture detection failed');
      return sharing !== 'false';
    } });
    Object.defineProperty(navigator, 'share', { configurable: true, value: sharing === 'absent' ? undefined : async (data) => {
      window.shareCalls.push({ name: data.files[0].name, size: data.files[0].size, active: navigator.userActivation?.isActive });
      if (window.shareOutcome === 'hold') await new Promise((resolve) => { window.releaseShare = resolve; });
      if (window.shareOutcome === 'cancel') throw new DOMException('cancelled', 'AbortError');
      if (window.shareOutcome === 'fail') throw new DOMException('blocked', 'NotAllowedError');
    } });
  }, sharing);
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    assert.equal(url.origin, 'http://127.0.0.1:5175', 'probe must make no external requests');
    const file = files.find((file) => '/' + file.fileName === url.pathname);
    if (file) return route.fulfill({ contentType: file.fileName.endsWith('.css') ? 'text/css' : 'text/javascript', body: file.type === 'chunk' ? file.code : file.source });
    if (url.pathname !== '/__export-probe') return route.abort();
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/${files.find((f) => f.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find((f) => f.isEntry).fileName}"></script></html>` });
  });
  await page.goto('http://127.0.0.1:5175/__export-probe');
  try { await page.getByRole('button', { name: '生成合成 ZIP', exact: true }).waitFor(); }
  catch (error) { await page.close(); throw new Error(`Probe startup: ${page.errors.join('; ') || error.message}`); }
  return page;
}
const generate = async (page) => {
  await page.getByRole('button', { name: '生成合成 ZIP', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '尚未保存' }).waitFor();
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find((b) => b.textContent === '保存 ZIP').disabled);
};
async function downloadAndVerify(page, engine, button = '保存 ZIP') {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  const result = await download;
  assert.match(result.suggestedFilename(), /^shared-calendar-export_.*\.zip$/);
  const path = `${artifacts}/${engine}-${button === '保存 ZIP' ? 'fallback' : 'explicit'}.zip`;
  await result.saveAs(path); assert.equal(await result.failure(), null);
  assert.ok((await readFile(path)).length > 0);
  assert.equal(execFileSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert len(z.namelist())==26; print("PASS")', path], { encoding: 'utf8' }).trim(), 'PASS');
  await page.getByRole('status').filter({ hasText: '已请求浏览器下载' }).waitFor();
}

for (const engine of ['WebKit', 'Chrome']) {
  test(`${engine}: records actual file-share capability and downloads without opening a native dialog`, async () => {
    const page = await pageFor(engine, 'native');
    try {
      const capability = await page.evaluate(() => {
        const sample = new File(['synthetic'], 'sample.zip', { type: 'application/zip' });
        try { return { share: typeof navigator.share, canShare: typeof navigator.canShare, zip: navigator.canShare?.({ files: [sample] }) ?? false }; }
        catch { return { share: typeof navigator.share, canShare: typeof navigator.canShare, zip: false, detectionThrew: true }; }
      });
      await writeFile(`${artifacts}/${engine}-native-capability.json`, JSON.stringify(capability, null, 2));
      await generate(page); await downloadAndVerify(page, engine, '下载 ZIP');
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: no automatic save; actual Blob download is a readable ZIP`, async () => {
    const page = await pageFor(engine); let downloads = 0; page.on('download', () => downloads++);
    try {
      assert.equal(await page.getByRole('button', { name: '保存 ZIP', exact: true }).count(), 0);
      await generate(page); assert.equal(downloads, 0);
      await downloadAndVerify(page, engine); assert.equal(downloads, 1);
      assert.equal(await page.getByRole('button', { name: '保存 ZIP', exact: true }).isEnabled(), true);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: simulated native share, cancel, failure and retry never claim the file was saved`, async () => {
    const page = await pageFor(engine, 'supported');
    try {
      await generate(page); assert.deepEqual(await page.evaluate(() => window.shareCalls), []);
      for (const [outcome, text] of [['success', '系统已接收分享请求'], ['cancel', '已取消分享'], ['fail', '保存请求失败'], ['success', '系统已接收分享请求']]) {
        await page.evaluate((value) => { window.shareOutcome = value; }, outcome);
        await page.getByRole('button', { name: '保存 ZIP', exact: true }).click();
        await page.getByRole('status').filter({ hasText: text }).waitFor();
        assert.equal(await page.getByRole('button', { name: '保存 ZIP', exact: true }).isEnabled(), true);
      }
      const calls = await page.evaluate(() => window.shareCalls);
      assert.equal(calls.length, 4); assert.ok(calls.every((call) => call.size > 0 && call.active !== false));
      await downloadAndVerify(page, engine, '下载 ZIP');
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: unsupported ZIP or throwing capability detection uses real download`, async () => {
    for (const sharing of ['false', 'throw']) {
      const page = await pageFor(engine, sharing);
      try { await generate(page); await downloadAndVerify(page, engine); assert.deepEqual(await page.evaluate(() => window.shareCalls), []); assert.deepEqual(page.errors, []); }
      finally { await page.close(); }
    }
  });
  test(`${engine}: invalid generation clears an old file, revokes URLs and can retry`, async () => {
    const page = await pageFor(engine);
    try {
      await generate(page);
      await page.evaluate(() => { window.exportProbe.mode = 'invalid'; });
      await page.getByRole('button', { name: '生成合成 ZIP', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: '生成失败' }).waitFor();
      assert.equal(await page.getByRole('button', { name: '保存 ZIP', exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => window.fileUrls.every((url) => window.revoked.includes(url))), true);
      await page.evaluate(() => { window.exportProbe.mode = 'normal'; }); await generate(page);
      await page.evaluate(() => window.exportProbe.unmount());
      assert.equal(await page.evaluate(() => window.fileUrls.every((url) => window.revoked.includes(url))), true);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: pending generation/share ignores duplicate clicks and late results after unmount`, async () => {
    const page = await pageFor(engine, 'supported');
    try {
      await page.evaluate(() => { window.exportProbe.mode = 'hold'; });
      await page.getByRole('button', { name: '生成合成 ZIP', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: '生成合成 ZIP', exact: true }).isDisabled(), true);
      await page.evaluate(() => window.exportProbe.unmount());
      await page.evaluate(() => window.exportProbe.release());
      await page.waitForFunction(() => window.exportProbe.settled === 1);
      assert.equal(await page.evaluate(() => window.exportProbe.generated), 0);
      assert.equal(await page.evaluate(() => window.fileUrls.length), 0);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
    const sharing = await pageFor(engine, 'supported');
    try {
      await generate(sharing); await sharing.evaluate(() => { window.shareOutcome = 'hold'; });
      await sharing.getByRole('button', { name: '保存 ZIP', exact: true }).click();
      assert.equal(await sharing.getByRole('button', { name: '保存 ZIP', exact: true }).isDisabled(), true);
      await sharing.evaluate(() => { window.exportProbe.unmount(); window.releaseShare(); });
      assert.equal(await sharing.getByRole('status').count(), 0);
      assert.deepEqual(sharing.errors, []);
    } finally { await sharing.close(); }
  });
  test(`${engine}: narrow viewport and keyboard access preserve readable controls`, async () => {
    const page = await pageFor(engine);
    try {
      const button = page.getByRole('button', { name: '生成合成 ZIP', exact: true });
      assert.equal(await button.evaluate((element) => element.tabIndex), 0);
      // WebKit on macOS may skip buttons on Tab unless Full Keyboard Access is set.
      await button.focus(); await page.keyboard.press('Enter');
      await page.getByRole('status').filter({ hasText: '尚未保存' }).waitFor();
      for (const width of [320, 375, 390]) {
        await page.setViewportSize({ width, height: 812 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      await page.screenshot({ path: `${artifacts}/${engine}-390.png`, fullPage: true });
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
}
