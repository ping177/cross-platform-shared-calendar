import { deriveReviewEntryStatus, type ReviewEntryStatus } from './review-entry.ts';
import type { CurrentSpace, ReviewEntry, ReviewRound } from '../types.ts';

export const reviewHistoryPageSize = 20;
export type ReviewModuleRow = { space_id: string; enabled: boolean };
export type ReviewHistoryRow = { round: ReviewRound; mine: ReviewEntryStatus; other: ReviewEntryStatus | null };

export function eligibleReviewSpaces(spaces: CurrentSpace[], modules: ReviewModuleRow[]): CurrentSpace[] {
  const enabled = new Set(modules.filter((row) => row.enabled === true).map((row) => row.space_id));
  return spaces.filter((space) => (space.membershipRole === 'owner' || space.membershipRole === 'member') && enabled.has(space.id));
}

export function selectReviewSpace(currentId: string | null, spaces: CurrentSpace[]): string | null {
  return spaces.find((space) => space.id === currentId)?.id ?? spaces[0]?.id ?? null;
}

export function canCreateReview(space: CurrentSpace, currentMemberCount: number): boolean {
  return space.kind === 'personal' ? currentMemberCount === 1 : currentMemberCount === 2;
}

export function localReviewDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function mapReviewHistory(rounds: ReviewRound[], entries: ReviewEntry[], userId: string, spaces: Map<string, CurrentSpace>): ReviewHistoryRow[] {
  const byRound = new Map<string, ReviewEntry[]>();
  for (const entry of entries) byRound.set(entry.review_id, [...(byRound.get(entry.review_id) ?? []), entry]);
  return rounds.map((round) => {
    const space = spaces.get(round.space_id);
    const participants = byRound.get(round.id) ?? [];
    const mine = participants.find((entry) => entry.user_id === userId);
    const other = participants.filter((entry) => entry.user_id !== userId);
    if (!space || !mine || participants.length !== (space.kind === 'shared' ? 2 : 1) || other.length > 1) {
      throw new Error('回顾参与者数据读取不完整，请重试。');
    }
    return { round, mine: deriveReviewEntryStatus(mine), other: other[0] ? deriveReviewEntryStatus(other[0]) : null };
  });
}

export function mergeReviewPages(current: ReviewHistoryRow[], next: ReviewHistoryRow[]): ReviewHistoryRow[] {
  const ids = new Set(current.map((row) => row.round.id));
  return [...current, ...next.filter((row) => !ids.has(row.round.id))];
}
