// ─────────────────────────────────────────────────────────────
// Template Type Definitions
// ─────────────────────────────────────────────────────────────

/** Template channel / delivery method. */
export type TemplateType = 'TEAMS_DM' | 'TEAMS_CHANNEL' | 'EMAIL';

/** Template record matching Prisma schema. */
export interface MessageTemplate {
  id: string;
  userId: string;
  name: string;
  type: TemplateType;
  subject: string | null;
  body: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Payload for creating / updating a template. */
export interface TemplateInput {
  name: string;
  type: TemplateType;
  subject?: string;
  body: string;
  isDefault?: boolean;
}

/** Known template variables. */
export type TemplateVariable =
  | 'senderName'
  | 'senderLogin'
  | 'receiverName'
  | 'receiverLogin'
  | 'prTitle'
  | 'prNumber'
  | 'prUrl'
  | 'prAge'
  | 'repoName'
  | 'repoUrl'
  | 'reviewStatus'
  | 'branchName'
  | 'targetBranch'
  | 'labelList'
  | 'prDescription'
  | 'currentDate'
  | 'currentTime'
  | 'orgName';

/** Context object passed to the template engine for rendering. */
export interface TemplateContext {
  senderName: string;
  senderLogin: string;
  receiverName: string;
  receiverLogin: string;
  prTitle: string;
  prNumber: number;
  prUrl: string;
  prAge: number;
  repoName: string;
  repoUrl: string;
  reviewStatus: string;
  branchName: string;
  targetBranch: string;
  labelList: string;
  prDescription: string;
  currentDate: string;
  currentTime: string;
  orgName: string;
}

/** Result of template validation. */
export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  unknownVariables: string[];
}
