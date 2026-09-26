import type { CurrentSpace, ReviewEntry, ReviewRound } from '../types.ts';

export type ReviewDetailTarget = { spaceId: string; reviewId: string; justCreated: boolean };
export type ReviewDetail = { round: ReviewRound; own: ReviewEntry; other: ReviewEntry | null };

export class ReviewUnavailableError extends Error {
  constructor() { super('这次回顾暂不可访问，请返回历史列表。'); }
}

export function reviewDetailTarget(round: ReviewRound, justCreated: boolean): ReviewDetailTarget {
  return { spaceId: round.space_id, reviewId: round.id, justCreated };
}

export function mapReviewDetail(round: ReviewRound, entries: ReviewEntry[], space: CurrentSpace, userId: string): ReviewDetail {
  const own = entries.find((entry) => entry.user_id === userId);
  const other = entries.filter((entry) => entry.user_id !== userId);
  if (round.space_id !== space.id || !own || entries.some((entry) => entry.review_id !== round.id)
    || entries.length !== (space.kind === 'shared' ? 2 : 1) || other.length !== (space.kind === 'shared' ? 1 : 0)) {
    throw new ReviewUnavailableError();
  }
  return { round, own, other: other[0] ?? null };
}

export function formatReviewDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
}

export function canLeaveReviewDetail(dirty: boolean, confirmDiscard: () => boolean): boolean {
  return !dirty || confirmDiscard();
}
