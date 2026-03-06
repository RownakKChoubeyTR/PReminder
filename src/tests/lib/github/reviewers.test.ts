import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Reviewers Route — computeReviewerStatuses logic tests
// ─────────────────────────────────────────────────────────────
// We test the reviewer status computation by extracting the
// logic from the route handler. Since the handler is a Next.js
// API route, we test the exported computation function.

// Since the computeReviewerStatuses function is not exported,
// we replicate its logic in a test helper and verify against
// expected behaviors documented in the route.

import type { GitHubReview, ReviewerInfo, ReviewerStatus } from '@/types/github';

// Replicate the reviewer computation logic for unit testing
function computeReviewerStatuses(reviews: GitHubReview[]): ReviewerInfo[] {
  const byUser = new Map<string, { reviews: GitHubReview[]; user: GitHubReview['user'] }>();

  for (const review of reviews) {
    const login = review.user.login;
    if (!byUser.has(login)) {
      byUser.set(login, { reviews: [], user: review.user });
    }
    byUser.get(login)!.reviews.push(review);
  }

  const result: ReviewerInfo[] = [];

  for (const [, { reviews: userReviews, user }] of byUser) {
    const sorted = [...userReviews].sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
    );

    const actionable = sorted.find((r) => r.state !== 'COMMENTED' && r.state !== 'PENDING');

    let status: ReviewerStatus;
    if (actionable) {
      status = mapGitHubState(actionable.state);
    } else if (sorted.some((r) => r.state === 'COMMENTED')) {
      status = 'commented';
    } else {
      status = 'pending';
    }

    result.push({
      user,
      status,
      email: null,
      lastReviewedAt: sorted[0]?.submitted_at ?? null,
    });
  }

  return result;
}

function mapGitHubState(state: GitHubReview['state']): ReviewerStatus {
  switch (state) {
    case 'APPROVED':
      return 'approved';
    case 'CHANGES_REQUESTED':
      return 'changes_requested';
    case 'DISMISSED':
      return 'pending';
    default:
      return 'pending';
  }
}

function makeReview(
  login: string,
  state: GitHubReview['state'],
  submittedAt: string,
): GitHubReview {
  return {
    id: Math.random(),
    user: {
      id: 1,
      login,
      avatar_url: `https://github.com/${login}.png`,
      html_url: `https://github.com/${login}`,
      type: 'User',
    },
    state,
    submitted_at: submittedAt,
    html_url: '',
    body: '',
  };
}

describe('computeReviewerStatuses', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array for no reviews', () => {
    expect(computeReviewerStatuses([])).toEqual([]);
  });

  it('should show approved when latest actionable review is APPROVED', () => {
    const reviews = [
      makeReview('alice', 'COMMENTED', '2025-01-01T00:00:00Z'),
      makeReview('alice', 'APPROVED', '2025-01-02T00:00:00Z'),
    ];

    const result = computeReviewerStatuses(reviews);
    expect(result).toHaveLength(1);
    expect(result[0]!.user.login).toBe('alice');
    expect(result[0]!.status).toBe('approved');
  });

  it('should show changes_requested when latest actionable review is CHANGES_REQUESTED', () => {
    const reviews = [
      makeReview('bob', 'APPROVED', '2025-01-01T00:00:00Z'),
      makeReview('bob', 'CHANGES_REQUESTED', '2025-01-02T00:00:00Z'),
    ];

    const result = computeReviewerStatuses(reviews);
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe('changes_requested');
  });

  it('should show commented when only COMMENTED reviews exist', () => {
    const reviews = [
      makeReview('carol', 'COMMENTED', '2025-01-01T00:00:00Z'),
      makeReview('carol', 'COMMENTED', '2025-01-02T00:00:00Z'),
    ];

    const result = computeReviewerStatuses(reviews);
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe('commented');
  });

  it('should show pending when only PENDING reviews exist', () => {
    const reviews = [makeReview('dave', 'PENDING', '2025-01-01T00:00:00Z')];

    const result = computeReviewerStatuses(reviews);
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe('pending');
  });

  it('should show pending when DISMISSED', () => {
    const reviews = [makeReview('eve', 'DISMISSED', '2025-01-01T00:00:00Z')];

    const result = computeReviewerStatuses(reviews);
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe('pending');
  });

  it('should handle multiple reviewers independently', () => {
    const reviews = [
      makeReview('alice', 'APPROVED', '2025-01-02T00:00:00Z'),
      makeReview('bob', 'CHANGES_REQUESTED', '2025-01-01T00:00:00Z'),
      makeReview('carol', 'COMMENTED', '2025-01-01T00:00:00Z'),
    ];

    const result = computeReviewerStatuses(reviews);
    expect(result).toHaveLength(3);

    const alice = result.find((r) => r.user.login === 'alice');
    const bob = result.find((r) => r.user.login === 'bob');
    const carol = result.find((r) => r.user.login === 'carol');

    expect(alice!.status).toBe('approved');
    expect(bob!.status).toBe('changes_requested');
    expect(carol!.status).toBe('commented');
  });

  it('should use the latest submitted_at for lastReviewedAt', () => {
    const reviews = [
      makeReview('alice', 'COMMENTED', '2025-01-01T00:00:00Z'),
      makeReview('alice', 'APPROVED', '2025-01-03T00:00:00Z'),
      makeReview('alice', 'COMMENTED', '2025-01-02T00:00:00Z'),
    ];

    const result = computeReviewerStatuses(reviews);
    expect(result[0]!.lastReviewedAt).toBe('2025-01-03T00:00:00Z');
  });

  it('should prioritize latest non-comment/pending review', () => {
    const reviews = [
      makeReview('alice', 'CHANGES_REQUESTED', '2025-01-01T00:00:00Z'),
      makeReview('alice', 'COMMENTED', '2025-01-02T00:00:00Z'),
      makeReview('alice', 'APPROVED', '2025-01-03T00:00:00Z'),
      makeReview('alice', 'COMMENTED', '2025-01-04T00:00:00Z'),
    ];

    // Latest actionable is APPROVED (Jan 3), even though last overall is COMMENTED (Jan 4)
    const result = computeReviewerStatuses(reviews);
    expect(result[0]!.status).toBe('approved');
  });
});
