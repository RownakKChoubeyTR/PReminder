import type {
  TemplateContext,
  TemplateValidationResult,
  TemplateVariable,
} from '@/types/templates';

// ─────────────────────────────────────────────────────────────
// Template Engine
// ─────────────────────────────────────────────────────────────
// Interpolates {variableName} placeholders in template strings.
// All known variables are listed in TemplateVariable type.

/** Escape HTML special characters to prevent XSS in HTML contexts. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Set of all recognized variable names. */
const KNOWN_VARIABLES: ReadonlySet<TemplateVariable> = new Set([
  'senderName',
  'senderLogin',
  'receiverName',
  'receiverLogin',
  'prTitle',
  'prNumber',
  'prUrl',
  'prAge',
  'repoName',
  'repoUrl',
  'reviewStatus',
  'branchName',
  'targetBranch',
  'labelList',
  'prDescription',
  'currentDate',
  'currentTime',
  'orgName',
]);

/** Regex to match `{variableName}` tokens. */
const VARIABLE_PATTERN = /\{(\w+)\}/g;

/**
 * Render a template string by replacing `{variableName}` placeholders
 * with values from the context object.
 *
 * Unknown variables are left as-is (not replaced).
 *
 * @param template - The template string with `{var}` placeholders
 * @param context  - Object containing values for each variable
 * @param options  - Optional settings (e.g., HTML escaping for email bodies)
 * @returns        - Rendered string
 */
export function renderTemplate(
  template: string,
  context: TemplateContext,
  options?: { escapeHtml?: boolean },
): string {
  return template.replace(VARIABLE_PATTERN, (match, key: string) => {
    if (key in context) {
      const value = String(context[key as keyof TemplateContext]);
      return options?.escapeHtml ? escapeHtml(value) : value;
    }
    return match; // leave unknown variables untouched
  });
}

/**
 * Extract all variable names found in a template string.
 *
 * @returns Array of unique variable names (without braces)
 */
export function extractVariables(template: string): string[] {
  const variables = new Set<string>();
  let match: RegExpExecArray | null;

  // Reset lastIndex for global regex
  const regex = new RegExp(VARIABLE_PATTERN.source, 'g');

  while ((match = regex.exec(template)) !== null) {
    if (match[1]) {
      variables.add(match[1]);
    }
  }

  return Array.from(variables);
}

/**
 * Validate a template string.
 *
 * Checks:
 * 1. Template is non-empty
 * 2. All `{var}` references use known variable names
 * 3. Braces are balanced (no unclosed `{`)
 *
 * @returns Validation result with errors (if any)
 */
export function validateTemplate(template: string): TemplateValidationResult {
  const errors: string[] = [];
  const unknownVariables: string[] = [];

  if (!template.trim()) {
    errors.push('Template body cannot be empty.');
    return { valid: false, errors, unknownVariables };
  }

  // Check for unknown variables
  const variables = extractVariables(template);
  for (const v of variables) {
    if (!KNOWN_VARIABLES.has(v as TemplateVariable)) {
      unknownVariables.push(v);
    }
  }

  if (unknownVariables.length > 0) {
    errors.push(
      `Unknown variable(s): ${unknownVariables.map((v) => `{${v}}`).join(', ')}. ` +
        `Known variables: ${Array.from(KNOWN_VARIABLES).join(', ')}.`,
    );
  }

  // Check for unbalanced braces
  const openCount = (template.match(/\{/g) ?? []).length;
  const closeCount = (template.match(/\}/g) ?? []).length;
  if (openCount !== closeCount) {
    errors.push('Unbalanced braces — check for unclosed { or extra }.');
  }

  return {
    valid: errors.length === 0,
    errors,
    unknownVariables,
  };
}

/**
 * Build a sample context object for template preview.
 */
export function getSampleContext(): TemplateContext {
  return {
    senderName: 'John Smith',
    senderLogin: 'johnsmith',
    receiverName: 'Jane Doe',
    receiverLogin: 'janedoe',
    prTitle: 'feat: add dark mode toggle',
    prNumber: 42,
    prUrl: 'https://github.com/acme/project/pull/42',
    prAge: 3,
    repoName: 'project',
    repoUrl: 'https://github.com/acme/project',
    reviewStatus: 'Pending',
    branchName: 'feat/dark-mode',
    targetBranch: 'main',
    labelList: 'enhancement, ui',
    prDescription: 'Adds a theme toggle component with light/dark/system modes.',
    currentDate: new Date().toLocaleDateString(),
    currentTime: new Date().toLocaleTimeString(),
    orgName: 'Acme Corp',
  };
}
