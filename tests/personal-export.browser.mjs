import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
const { webkit, chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browsers = new Map(); let files;
const artifacts = process.env.EXPORT_ARTIFACTS || '/private/tmp/calendar-export-slice4/browser';
before(async () => {
  files = (await build({ configFile: false, envFile: false, logLevel: 'error', plugins: [{ name: 'export-client', enforce: 'pre', resolveId(id) { if (/\/supabase(?:\.ts)?$/.test(id)) return '\0export-client'; }, load(id) { if (id === '\0export-client') return 'export const supabase=new Proxy({}, {get:(_,key)=>window.personalFixture.client[key]});'; } }], build: { write: false, rollupOptions: { input: 'tests/fixtures/personal-export-browser.jsx' } } })).output;
  await mkdir(artifacts, { recursive: true });
  browsers.set('WebKit', await webkit.launch()); browsers.set('Chrome', await chromium.launch({ channel: 'chrome', args: ['--enable-precise-memory-info'] }));
});
after(async () => { for (const browser of browsers.values()) await browser.close(); });
async function pageFor(engine, empty = false, multi = false) {
  const page = await browsers.get(engine).newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page.setDefaultTimeout(4000); page.errors = []; page.on('pageerror', error => page.errors.push(error.message));
  await page.addInitScript(() => {
    window.shareMode = 'cancel'; window.urls = []; window.revoked = [];
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); if (blob instanceof File) window.urls.push(url); return url; };
    URL.revokeObjectURL = url => { window.revoked.push(url); revoke(url); };
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: async () => { if (window.shareMode !== 'success') throw new DOMException('fixture', window.shareMode === 'cancel' ? 'AbortError' : 'NotAllowedError'); }, configurable: true });
  });
  await page.route('**/*', route => {
    const url = new URL(route.request().url()); assert.equal(url.origin, 'http://127.0.0.1:5175');
    if (url.protocol === 'blob:') return route.continue();
    const f = files.find(f => '/' + f.fileName === url.pathname);
    if (f) return route.fulfill({ contentType: f.fileName.endsWith('.css') ? 'text/css' : 'text/javascript', body: f.type === 'chunk' ? f.code : f.source });
    if (url.pathname !== '/__personal-export') return route.abort();
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/${files.find(f=>f.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find(f=>f.isEntry).fileName}"></script>` });
  });
  await page.goto('http://127.0.0.1:5175/__personal-export' + (multi ? '?multi=1' : empty ? '?empty=1' : ''));
  await page.getByRole('button', { name: '导出数据', exact: true }).click();
  await page.getByRole('button', { name: '生成 ZIP', exact: true }).waitFor();
  return page;
}

test('Chrome: 10000-item capacity sample records ZIP and main-thread heap, without an iPhone claim', async () => {
  const page = await pageFor('Chrome', false, true);
  try {
    await page.evaluate(() => {
      window.heapBefore = performance.memory?.usedJSHeapSize ?? null; window.heapSamples = [];
      window.heapTimer = setInterval(() => { if (performance.memory) window.heapSamples.push(performance.memory.usedJSHeapSize); }, 5);
      const f = window.personalFixture, base = f.rows.list_items[0]; f.state.cap = 500;
      f.rows.list_items = Array.from({length:10000},(_,i)=>({...base,id:`80000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,content:('事项'+i+'家庭计划'.repeat(35)).slice(0,180),sort_order:String(9007199254740993n+BigInt(i))}));
    });
    await page.getByRole('button',{name:'全选',exact:true}).click();
    const start=Date.now();await generate(page);const elapsed=Date.now()-start;
    const heap=await page.evaluate(()=>{clearInterval(window.heapTimer);return {before:window.heapBefore,after:performance.memory?.usedJSHeapSize??null,sampledPeak:window.heapSamples.length?Math.max(...window.heapSamples):null,samples:window.heapSamples.length};});
    await prepare(page,'下载 ZIP');const next=page.waitForEvent('download');await page.getByRole('button',{name:'确认保存 ZIP',exact:true}).click();const download=await next,path=`${artifacts}/Chrome-capacity.zip`;await download.saveAs(path);
    execFileSync('python3',['-c',`import zipfile,sys,csv,io
z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None
assert any(len(list(csv.DictReader(io.StringIO(z.read(p).decode('utf-8-sig'),newline=''))))==10000 for p in z.namelist() if p.endswith('/list_items.csv'))`,path]);
    await writeFile(`${artifacts}/capacity.json`,JSON.stringify({items:10000,elapsedMs:elapsed,zipBytes:(await stat(path)).size,mainThreadJsHeapBytes:heap,limitations:'Desktop Chrome main-thread JS heap sample only; excludes full browser/worker RSS; no iPhone capacity claim.'},null,2));
    assert.deepEqual(page.errors,[]);
  }finally{await page.close();}
});
async function generate(page) { await page.getByRole('button', { name: '生成 ZIP', exact: true }).click(); await page.getByRole('status').filter({ hasText: '尚未保存' }).waitFor(); }
async function prepare(page, name = '保存 ZIP') { await page.getByRole('button', { name, exact: true }).click(); await page.getByRole('button', { name: '确认保存 ZIP', exact: true }).waitFor(); }
for (const engine of ['WebKit', 'Chrome']) {
  test(`${engine}: visible Review read failure/permission loss fails closed, then full long-history ZIP can download`, async () => {
    const page = await pageFor(engine, false, true);
    try {
      await page.getByRole('button', { name: '全选', exact: true }).click();
      await page.evaluate(() => window.personalFixture.state.fail = 'review_entries');
      await page.getByRole('button', { name: '生成 ZIP', exact: true }).click();
      await page.getByRole('alert').waitFor(); assert.equal(await page.getByRole('button', { name: '保存 ZIP', exact: true }).count(), 0);
      await page.evaluate(() => { const f = window.personalFixture; f.state.fail = ''; f.state.blocked = true; f.state.blockTable = 'review_entries'; });
      await page.getByRole('button', { name: '生成 ZIP', exact: true }).click(); await page.waitForFunction(() => !!window.personalFixture.state.release);
      await page.evaluate(() => { const f = window.personalFixture; f.rows.space_members = f.rows.space_members.filter(m => !(m.space_id.endsWith('2') && m.user_id === f.state.user)); f.emitPermission(); f.state.release(); f.state.blocked = false; });
      await page.getByRole('alert').waitFor(); assert.equal(await page.getByRole('button', { name: '保存 ZIP', exact: true }).count(), 0);
      await page.evaluate(() => { window.useLongHistory(true); window.personalFixture.emitPermission(); });
      await page.getByRole('checkbox', { name: /共享空间/ }).waitFor();
      await page.getByRole('button', { name: '全选', exact: true }).click();
      await page.getByRole('button', { name: '生成 ZIP', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: '分空间导出' }).waitFor();
      await page.getByRole('checkbox', { name: /个人空间/ }).uncheck();
      await page.evaluate(() => { window.heapBefore = performance.memory?.usedJSHeapSize ?? null; window.heapSamples = []; window.heapTimer = setInterval(() => { if (performance.memory) window.heapSamples.push(performance.memory.usedJSHeapSize); }, 5); });
      const start = Date.now(); await generate(page); const elapsedMs = Date.now() - start;
      const heap = await page.evaluate(() => { clearInterval(window.heapTimer); return { before: window.heapBefore, after: performance.memory?.usedJSHeapSize ?? null, sampledPeak: window.heapSamples.length ? Math.max(...window.heapSamples) : null, samples: window.heapSamples.length }; });
      assert.doesNotMatch(await page.getByRole('main').innerText(), /阶段性|尚未纳入/);
      await prepare(page, '下载 ZIP'); const next = page.waitForEvent('download'); await page.getByRole('button', { name: '确认保存 ZIP', exact: true }).click();
      const download = await next, path = `${artifacts}/${engine}-long-reviews.zip`; await download.saveAs(path);
      execFileSync('python3', ['-c', `import zipfile,sys,csv,io,json
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None and len(z.namelist())==14
m=json.loads(z.read('manifest.json')); assert set(m['table_coverage'].values())=={'exported'}
for name,count in [('review_rounds',520),('review_entries',1040)]:
 p=next(p for p in z.namelist() if p.endswith('/'+name+'.csv'))
 assert len(list(csv.DictReader(io.StringIO(z.read(p).decode('utf-8-sig'),newline=''))))==count`, path]);
      await writeFile(`${artifacts}/${engine}-long-capacity.json`, JSON.stringify({ rounds: 520, entries: 1040, charactersPerField: 600, variedText: true, elapsedMs, zipBytes: (await stat(path)).size, mainThreadJsHeapBytes: heap, limitations: 'Desktop only; excludes browser/worker RSS; no actual iPhone memory or save validation.' }, null, 2));
      await page.getByRole('button', { name: '账户管理', exact: true }).click();
      assert.equal(await page.evaluate(() => window.urls.every(url => window.revoked.includes(url))), true);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });

  test(`${engine}: personal default, all/none/shared selection invalidates ZIP and exports twelve CSV types`, async () => {
    const page = await pageFor(engine, false, true);
    try {
      const personal = page.getByRole('checkbox', { name: /个人空间/ }), shared = page.getByRole('checkbox', { name: /共享空间/ });
      assert.equal(await personal.isChecked(), true); assert.equal(await shared.isChecked(), false);
      await generate(page); await shared.check(); assert.equal(await page.getByRole('button',{name:'保存 ZIP',exact:true}).count(),0);
      await page.getByRole('button',{name:'取消全选',exact:true}).click();assert.equal(await page.getByRole('button',{name:'生成 ZIP',exact:true}).isDisabled(),true);
      await shared.check();await generate(page);await personal.check();assert.equal(await page.getByRole('button',{name:'保存 ZIP',exact:true}).count(),0);
      await page.getByRole('button',{name:'取消全选',exact:true}).click();await page.getByRole('button',{name:'全选',exact:true}).click();
      await generate(page);await prepare(page,'下载 ZIP');const next=page.waitForEvent('download');await page.getByRole('button',{name:'确认保存 ZIP',exact:true}).click();const download=await next;
      const path=`${artifacts}/${engine}-multi.zip`;await download.saveAs(path);assert.equal(await download.failure(),null);
      execFileSync('python3',['-c',`import zipfile,sys,json,csv,io
z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None and len(z.namelist())==26
m=json.loads(z.read('manifest.json'));assert len(m['spaces'])==2 and not m['complete_backup']
assert m['table_coverage']['review_rounds']=='exported' and m['table_coverage']['review_entries']=='exported'
assert len({s['directory'] for s in m['spaces']})==2
for f in m['files']:
 rows=list(csv.reader(io.StringIO(z.read(f['path']).decode('utf-8-sig'),newline='')));assert len(rows)-1==f['rows']
assert any(f['path'].endswith('/tasks.csv') and f['rows']==1 for f in m['files'])`,path]);
      for(const width of [375,390,1024]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`${artifacts}/${engine}-multi-${width}.png`,fullPage:true});}
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:`${artifacts}/${engine}-multi-390.png`,fullPage:true});assert.deepEqual(page.errors,[]);
    } finally {await page.close();}
  });
  test(`${engine}: shared membership removal refreshes list and aborts in-flight export`, async () => {
    const page=await pageFor(engine,false,true);
    try {
      await page.getByRole('button',{name:'全选',exact:true}).click();await page.evaluate(()=>window.personalFixture.state.blocked=true);
      await page.getByRole('button',{name:'生成 ZIP',exact:true}).click();await page.waitForFunction(()=>!!window.personalFixture.state.release);
      await page.evaluate(()=>{const f=window.personalFixture;f.rows.space_members=f.rows.space_members.filter(m=>!(m.space_id.endsWith('2')&&m.user_id===f.state.user));f.emitPermission();f.state.release();f.state.blocked=false;});
      await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('checkbox',{name:/共享空间/}).count(),0);assert.equal(await page.getByRole('button',{name:'保存 ZIP',exact:true}).count(),0);assert.deepEqual(page.errors,[]);
    }finally{await page.close();}
  });
  test(`${engine}: capacity failure is explicit and fewer selected Spaces can succeed`, async () => {
    const page=await pageFor(engine,false,true);
    try {
      await page.getByRole('button',{name:'全选',exact:true}).click();await page.evaluate(()=>window.personalFixture.rows.events[0].description='x'.repeat(16*1024*1024));
      await page.getByRole('button',{name:'生成 ZIP',exact:true}).click();await page.getByRole('alert').filter({hasText:'减少所选空间'}).waitFor();assert.match(await page.getByRole('alert').innerText(),/8 MiB.*16 MiB/);assert.equal(await page.getByRole('button',{name:'保存 ZIP',exact:true}).count(),0);
      await page.getByRole('checkbox',{name:/共享空间/}).uncheck();await generate(page);assert.deepEqual(page.errors,[]);
    }finally{await page.close();}
  });
  for (const empty of [false, true]) test(`${engine}: ${empty?'empty':'501-row'} account to ZIP download with complete authorized coverage`, async () => {
    const page = await pageFor(engine, empty);
    try {
      await generate(page); await prepare(page, '下载 ZIP');
      const next = page.waitForEvent('download'); await page.getByRole('button', { name: '确认保存 ZIP', exact: true }).click();
      const download = await next, path = `${artifacts}/${engine}-${empty?'empty':'populated'}.zip`; await download.saveAs(path);
      assert.equal(await download.failure(), null);
      execFileSync('python3', ['-c', `import zipfile,json,sys,csv,io
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
m=json.loads(z.read('manifest.json')); assert m['synthetic'] is False and m['export_scope']=='authorized-spaces'
assert m['table_coverage']['tasks']=='exported' and m['table_coverage']['review_entries']=='exported'; assert len(z.namelist())==14
p=next(p for p in z.namelist() if p.endswith('/events.csv')); rows=list(csv.DictReader(io.StringIO(z.read(p).decode('utf-8-sig'),newline='')))
assert len(rows)==int(sys.argv[2])`, path, empty ? '0' : '501']);
      await page.getByRole('status').filter({ hasText: '已请求浏览器下载' }).waitFor();
      for (const width of [320, 375, 390]) { await page.setViewportSize({ width, height: 844 }); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true); }
      await page.screenshot({ path: `${artifacts}/${engine}-${empty?'empty':'ready'}-390.png`, fullPage: true });
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: share cancellation/failure retry, permission loss clears generated files`, async () => {
    const page = await pageFor(engine);
    try {
      await generate(page);
      for (const [mode, text] of [['cancel','已取消分享'], ['fail','保存请求失败'], ['success','系统已接收分享请求']]) {
        await page.evaluate(mode => { window.shareMode = mode; }, mode); await prepare(page); await page.getByRole('button',{name:'确认保存 ZIP',exact:true}).click(); await page.getByRole('status').filter({hasText:text}).waitFor();
      }
      await page.evaluate(()=>{window.originalDownloadClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=()=>{throw Error('synthetic download failure');};});
      await prepare(page,'下载 ZIP');await page.getByRole('button',{name:'确认保存 ZIP',exact:true}).click();await page.getByRole('status').filter({hasText:'保存请求失败'}).waitFor();
      await page.evaluate(()=>{HTMLAnchorElement.prototype.click=window.originalDownloadClick;});
      await prepare(page,'下载 ZIP');const pending=page.waitForEvent('download');await page.getByRole('button',{name:'确认保存 ZIP',exact:true}).click();assert.equal(await (await pending).failure(),null);
      await page.evaluate(()=>{window.personalFixture.rows.space_members=[];window.personalFixture.emitPermission();});
      await page.getByRole('alert').waitFor(); assert.equal(await page.getByRole('button',{name:'保存 ZIP',exact:true}).count(),0);
      assert.equal(await page.evaluate(()=>window.urls.every(url=>window.revoked.includes(url))),true); assert.deepEqual(page.errors,[]);
    } finally { await page.close(); }
  });
  test(`${engine}: query failure/cancel/retry and in-flight logout cannot publish ZIP`, async () => {
    const page = await pageFor(engine);
    try {
      await page.evaluate(()=>window.personalFixture.state.fail='events');await page.getByRole('button',{name:'生成 ZIP',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'保存 ZIP',exact:true}).count(),0);
      await page.evaluate(()=>{const f=window.personalFixture;f.state.fail='';f.state.blocked=true;});
      await page.getByRole('button',{name:'生成 ZIP',exact:true}).click();await page.waitForFunction(()=>!!window.personalFixture.state.release);
      await page.getByRole('button',{name:'取消',exact:true}).click();await page.evaluate(()=>{window.personalFixture.state.release();window.personalFixture.state.blocked=false;});
      await generate(page);
      await page.evaluate(()=>{window.personalFixture.state.blocked=true;window.personalFixture.state.release=null;});
      await page.getByRole('button',{name:'重新生成 ZIP',exact:true}).click();await page.waitForFunction(()=>!!window.personalFixture.state.release);
      await page.evaluate(()=>{window.personalFixture.state.user='';window.personalFixture.emitAuth();window.personalFixture.state.release();});await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'保存 ZIP',exact:true}).count(),0);assert.deepEqual(page.errors,[]);
    } finally { await page.close(); }
  });
  test(`${engine}: back/navigation while pending and account replacement discard old content`, async () => {
    const page = await pageFor(engine);
    try {
      await page.evaluate(()=>window.personalFixture.state.blocked=true);await page.getByRole('button',{name:'生成 ZIP',exact:true}).click();await page.waitForFunction(()=>!!window.personalFixture.state.release);
      await page.getByRole('button',{name:'账户管理',exact:true}).click();await page.getByRole('heading',{name:'账户管理',exact:true}).waitFor();await page.evaluate(()=>{window.personalFixture.state.release();window.personalFixture.state.blocked=false;});
      await page.getByRole('button',{name:'导出数据',exact:true}).click();await page.getByRole('button',{name:'生成 ZIP',exact:true}).waitFor();await generate(page);
      await page.evaluate(()=>window.personalFixture.setUser('20000000-0000-4000-8000-000000000099'));await page.getByRole('heading',{name:'账户管理',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'保存 ZIP',exact:true}).count(),0);assert.deepEqual(page.errors,[]);
    } finally { await page.close(); }
  });
  test(`${engine}: save recheck failure rejects ZIP and swipe uses account return`, async () => {
    const page = await pageFor(engine);
    try {
      await generate(page);await page.evaluate(()=>window.personalFixture.rows.space_members=[]);await page.getByRole('button',{name:'保存 ZIP',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'确认保存 ZIP',exact:true}).count(),0);
      assert.doesNotMatch(await page.getByRole('status').innerText(), /已生成|尚未保存/);
      await page.getByRole('main').evaluate(el=>{const p={bubbles:true,pointerId:51,pointerType:'touch',isPrimary:true,buttons:1};el.dispatchEvent(new PointerEvent('pointerdown',{...p,clientX:4,clientY:650}));el.dispatchEvent(new PointerEvent('pointermove',{...p,clientX:60,clientY:650}));el.dispatchEvent(new PointerEvent('pointerup',{...p,buttons:0,clientX:130,clientY:650}));});
      await page.getByRole('heading',{name:'账户管理',exact:true}).waitFor();assert.deepEqual(page.errors,[]);
    } finally { await page.close(); }
  });
}
