import type { EventEditTarget } from '../types';
import type { OccurrenceScope } from './event-edit-mutation';

const occurrenceScopes: OccurrenceScope[] = ['only-this', 'this-and-future'];
export type OccurrenceAction = 'save' | 'delete';

export function occurrenceActionCopy(action: OccurrenceAction, scope: OccurrenceScope) {
  if (action === 'save') {
    return {
      title: '选择修改范围',
      label: scope === 'only-this' ? '仅修改当前事件' : '修改当前及未来事件',
    };
  }

  return {
    title: '选择删除范围',
    label: scope === 'only-this' ? '仅删除当前事件' : '删除当前及未来事件',
  };
}

export function eventEditUiState(target: EventEditTarget | null) {
  const isRecurringOccurrenceEdit = target?.kind === 'occurrence' && target.event.recurrence_rule !== null;
  const showOccurrenceScope = target?.kind === 'occurrence';

  return {
    isRecurringOccurrenceEdit,
    canEditRecurrence: !isRecurringOccurrenceEdit,
    canEditAllDay: !isRecurringOccurrenceEdit,
    showOccurrenceScope,
    occurrenceScopes: showOccurrenceScope ? occurrenceScopes : [],
  };
}
