import assert from 'node:assert/strict';
import test from 'node:test';
import { exportColumns, exportCsvColumns, exportPresentation, exportTables, exportCsv } from '../src/lib/data-export-format.ts';
import { prepareExport } from '../src/lib/data-export-archive.ts';
import { syntheticExport } from './fixtures/data-export-synthetic.ts';
const filenames = ['空间信息.csv','空间成员.csv','功能设置.csv','日程.csv','重复日程调整.csv','任务.csv','清单.csv','清单分组.csv','清单事项.csv','重要日.csv','回顾记录.csv','回顾内容.csv'];

test('format 2 has twelve unique Chinese filenames and complete one-to-one Chinese columns in CSV order', () => {
  assert.deepEqual(exportTables.map(t => exportPresentation[t].filename), filenames);
  for (const table of exportTables) {
    const columns = exportCsvColumns[table], source = exportColumns[table];
    assert.deepEqual(new Set(columns.map(c => c.name)), new Set(source.map(c => c.name)));
    assert.equal(columns.length, source.length);
    assert.equal(new Set(columns.map(c => c.label)).size, columns.length);
    for (const column of columns) {
      assert.match(column.label, /[\u4e00-\u9fff]/);
      const { label, ...original } = column;
      assert.deepEqual(original, source.find(c => c.name === column.name));
    }
    assert.equal(exportCsv(table, []), '\uFEFF'+columns.map(c=>'"'+c.label+'"').join(',')+'\r\n');
  }
  assert.deepEqual(exportCsvColumns.events.slice(0, 5).map(c=>c.name), ['title','description','starts_at','ends_at','all_day']);
  assert.deepEqual(exportCsvColumns.review_entries.slice(0, 4).map(c=>c.label), ['近期专注事项','近期进展','面临问题','下一步计划']);
  // Readers keep the original whitelist, types and stable primary-key-first query order.
  assert.equal(exportColumns.events[0].name, 'id');
});

test('manifest maps every original field to its Chinese header and every table to its only CSV file', () => {
  const prepared = prepareExport(syntheticExport()), manifest = prepared.manifest;
  assert.equal(manifest.format_version, 2);
  for (const table of exportTables) {
    assert.equal(manifest.file_names[table], exportPresentation[table].filename);
    assert.deepEqual(manifest.fields[table], exportCsvColumns[table]);
    const actual = manifest.files.filter(f=>f.table===table);
    assert.equal(actual.length, 2);
    for (const file of actual) {
      assert.ok(file.path.endsWith('/'+manifest.file_names[table]));
      assert.ok(prepared.files[file.path]);
      assert.equal(file.rows, syntheticExport().spaces[actual.indexOf(file)].tables[table].length);
    }
  }
  assert.equal(Object.keys(prepared.files).length, 26);
  assert.match(new TextDecoder().decode(prepared.files['README.txt']), /格式 2/);
});
