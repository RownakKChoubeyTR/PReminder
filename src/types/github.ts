// ─────────────────────────────────────────────────────────────
// GitHub API Type Definitions
// ─────────────────────────────────────────────────────────────

/** Minimal org repository (from GET /orgs/{org}/repos). */
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  updated_at: string;
  open_issues_count: number;
  language: string | null;
  archived: boolean;
}

/** Pull request summary (from GET /repos/{owner}/{repo}/pulls). */
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: 'open' | 'closed';
  draft: boolean;
  created_at: string;
  updated_at: string;
  user: GitHubUser;
  requested_reviewers: GitHubUser[];
  requested_teams: GitHubTeam[];
  labels: GitHubLabel[];
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
}

/** User object (author, reviewer, etc.). */
export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  type: 'User' | 'Bot' | 'Organization';
}

/** Full user profile (from GET /users/{login}). Includes public email and name. */
export interface GitHubUserProfile extends GitHubUser {
  name: string | null;
  email: string | null;
  company: string | null;
  bio: string | null;
}

/** Team object (from requested_teams). */
export interface GitHubTeam {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  html_url: string;
}

/** PR review (from GET /repos/{owner}/{repo}/pulls/{number}/reviews). */
export interface GitHubReview {
  id: number;
  user: GitHubUser;
  state: GitHubReviewState;
  submitted_at: string;
  html_url: string;
  body: string;
}

export type GitHubReviewState =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'COMMENTED'
  | 'DISMISSED'
  | 'PENDING';

/** Label on a PR. */
export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
}

/** Team member (from GET /orgs/{org}/teams/{slug}/members). */
export interface GitHubTeamMember {
  id: number;
  login: string;
  avatar_url: string;
}

// ─────────────────────────────────────────────────────────────
// Computed / Application Types
// ─────────────────────────────────────────────────────────────

/** Computed reviewer status for display. */
export type ReviewerStatus =
  | 'approved'
  | 'changes_requested'
  | 'commented'
  | 'pending'
  | 'awaiting';

/** Enriched reviewer with computed status. */
export interface ReviewerInfo {
  user: GitHubUser;
  status: ReviewerStatus;
  lastReviewedAt: string | null;
  /** Resolved corporate email — from EmailMapping table (null if not yet mapped). */
  email: string | null;
}

/** Enriched PR with reviewer breakdown. */
export interface EnrichedPullRequest extends GitHubPullRequest {
  repo: string;
  reviewers: ReviewerInfo[];
  ageInDays: number;
}

/** PR returned by the "My PRs" search — includes repo name extracted from search results. */
export interface GitHubMyPR extends GitHubPullRequest {
  /** Short repository name (e.g. "my-repo"). */
  repo_name: string;
}

/** Paginated API response wrapper. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
}
