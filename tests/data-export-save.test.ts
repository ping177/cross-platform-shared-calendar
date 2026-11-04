import assert from 'node:assert/strict';
import test from 'node:test';
import { requestExportSave } from '../src/lib/data-export-save.ts';

const file = new File(['synthetic'], 'sample.zip', { type: 'application/zip' });
test('unsupported file sharing requests a download without inventing saved success', async () => {
  let downloads = 0;
  assert.equal(await requestExportSave(file, () => downloads++, {}), 'download-requested');
  assert.equal(await requestExportSave(file, () => downloads++, { canShare: () => false, share: async () => assert.fail() }), 'download-requested');
  assert.equal(await requestExportSave(file, () => downloads++, { canShare: () => { throw new Error('unsupported'); } }), 'download-requested');
  assert.equal(downloads, 3);
});
test('native share is called synchronously and cancellation/failure preserves the file for retry', async () => {
  let calls = 0, downloads = 0;
  const target = { canShare: () => true, share: async (data) => { calls++; assert.equal(data.files[0], file); } };
  const operation = requestExportSave(file, () => downloads++, target);
  assert.equal(calls, 1, 'share must start before any await consumes the user activation');
  assert.equal(await operation, 'share-dispatched');
  target.share = async () => { throw new DOMException('cancel', 'AbortError'); };
  assert.equal(await requestExportSave(file, () => downloads++, target), 'cancelled');
  target.share = async () => { throw new DOMException('blocked', 'NotAllowedError'); };
  assert.equal(await requestExportSave(file, () => downloads++, target), 'failed');
  target.share = async () => { calls++; };
  assert.equal(await requestExportSave(file, () => downloads++, target), 'share-dispatched');
  assert.equal(downloads, 0);
  assert.equal(await requestExportSave(file, () => { throw Error('download unavailable'); }, {}), 'failed');
});
