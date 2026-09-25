import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { CurrentSpace, SpaceMember, Task } from '../src/types.ts';

const personal = { id: 'personal', name: '我的空间', kind: 'personal', created_by: 'me', membershipRole: 'owner' } as CurrentSpace;
const shared = { id: 'shared-a', name: '同名空间', kind: 'shared', created_by: 'me', membershipRole: 'owner' } as CurrentSpace;
const sameName = { ...shared, id: 'shared-b' };
const member = { space_id: personal.id, user_id: 'me', role: 'owner', joined_at: '2026-09-01' } as SpaceMember;
const task = (id: string, spaceId: string, assignee: string | null = null, status: Task['status'] = 'open') => ({
  id, space_id: spaceId, title: id, assigned_to_user_id: assignee, status,
  created_by: 'me', due_on: null, created_at: '2026-09-25', updated_at: '2026-09-25',
}) as Task;

function elements(node: React.ReactNode): React.ReactElement[] {
  if (!React.isValidElement(node)) return [];
  const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}

test('Tasks filter presents only eligible IDs and emits one canonical selection', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { TaskFilterPicker } = await vite.ssrLoadModule('/src/components/TasksArea.tsx');
    const selected: Array<'all' | { spaceId: string }> = [];
    const tree = TaskFilterPicker({ spaces: [shared, sameName], filter: 'all', onChange: (next: 'all' | { spaceId: string }) => selected.push(next) });
    const markup = renderToStaticMarkup(tree);
    assert.match(markup, /全部空间/);
    assert.equal((markup.match(/同名空间/g) ?? []).length, 2);
    assert.doesNotMatch(markup, /我的空间/);
    const select = elements(tree).find((element) => element.type === 'select');
    assert.ok(select);
    const change = (select.props as { onChange: (event: { target: { value: string } }) => void }).onChange;
    change({ target: { value: sameName.id } });
    change({ target: { value: personal.id } });
    change({ target: { value: 'all' } });
    assert.deepEqual(selected, [{ spaceId: sameName.id }, 'all']);
  } finally { await vite.close(); }
});

test('duplicate Space names never change the Task identity passed to open and status actions', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { TaskRows } = await vite.ssrLoadModule('/src/components/TasksArea.tsx');
    const first = task('first', shared.id);
    const second = task('second', sameName.id, 'other');
    const opened: Task[] = [];
    const changed: Array<{ task: Task; status: Task['status'] }> = [];
    const props = {
      tasks: [first, second], sourceSpacesById: { [shared.id]: shared, [sameName.id]: sameName },
      membersBySpaceId: { [shared.id]: [{ ...member, space_id: shared.id }], [sameName.id]: [{ ...member, space_id: sameName.id }] },
      userId: 'me', completed: false, busyTaskId: null, openingTask: false,
      onOpen: (selected: Task) => opened.push(selected), onChangeStatus: (selected: Task, status: Task['status']) => changed.push({ task: selected, status }),
    };
    const tree = TaskRows(props);
    const markup = renderToStaticMarkup(tree);
    assert.equal((markup.match(/>同名空间<\/span>/g) ?? []).length, 2);
    assert.match(markup, /data-space-id="shared-a" data-task-id="first"/);
    assert.match(markup, /data-space-id="shared-b" data-task-id="second"/);
    const buttons = elements(tree).filter((element) => element.type === 'button');
    const click = (label: string) => {
      const button = buttons.find((element) => (element.props as { 'aria-label'?: string })['aria-label'] === label);
      assert.ok(button, label);
      (button.props as { onClick: () => void }).onClick();
    };
    click('打开任务 second，同名空间');
    click('完成 first');
    assert.deepEqual(opened.map((item) => [item.space_id, item.id]), [[sameName.id, second.id]]);
    assert.deepEqual(changed.map((item) => [item.task.space_id, item.task.id, item.status]), [[shared.id, first.id, 'completed']]);
    assert.ok(!buttons.some((button) => (button.props as { 'aria-label'?: string })['aria-label'] === '完成 second'));

    const completed = TaskRows({ ...props, tasks: [task('done', sameName.id, null, 'completed')], completed: true });
    const reopen = elements(completed).find((element) => element.type === 'button' && (element.props as { 'aria-label'?: string })['aria-label'] === '重新打开 done');
    assert.ok(reopen);
    (reopen.props as { onClick: () => void }).onClick();
    assert.deepEqual(changed.at(-1) && [changed.at(-1)?.task.space_id, changed.at(-1)?.task.id, changed.at(-1)?.status], [sameName.id, 'done', 'open']);
  } finally { await vite.close(); }
});

test('disabled Personal default remains selected in the TaskSheet and cannot be saved', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { TaskSheet } = await vite.ssrLoadModule('/src/components/TaskSheet.tsx');
    const markup = renderToStaticMarkup(React.createElement(TaskSheet, {
      task: null, spaceId: personal.id, spaceKind: personal.kind, userId: 'me', members: [member],
      onClose: () => undefined, onSaved: async () => undefined,
      createTarget: { spaces: [personal, shared], selectedId: personal.id, enabledIds: [shared.id], state: 'blocked', error: '', onSelect: () => undefined, onRetry: () => undefined },
      validateGlobalCreate: async () => undefined,
    }));
    assert.match(markup, /value="personal" disabled="" selected=""/);
    assert.match(markup, /value="shared-a"/);
    assert.match(markup, /未启用任务，请主动选择其他已启用任务的空间/);
    assert.match(markup, /type="submit" disabled=""/);
  } finally { await vite.close(); }
});
