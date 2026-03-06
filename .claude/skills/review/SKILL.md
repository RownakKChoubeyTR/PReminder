---
name: review
description: "AI code review with structured scorecard. Reviews staged changes or specific files."
---

# Code Review

Review the code changes for quality, security, and best practices.

## What to Review

If arguments provided: review those specific files
If no arguments: review staged changes (`git diff --cached`) or last commit (`git diff HEAD~1`)

## Review Process

1. **Get the diff**: Run `git diff --cached` or `git diff HEAD~1` or read the specified files
2. **For each changed file**, assess against the 4 quality axes
3. **Identify specific issues** with line numbers and severity
4. **Provide actionable fix suggestions** for each issue

## Scoring Axes (each 0-10)

| Axis | What to Check |
|------|--------------|
| **Simplicity** | KISS principle. No over-engineering, unnecessary abstractions, or premature optimization |
| **Security** | No hardcoded secrets, proper input validation, safe API usage, OWASP top 10 |
| **Test Coverage** | Tests exist for happy path, edge cases, and error scenarios |
| **Performance** | No N+1 queries, memory leaks, blocking calls, or unbounded operations |

## Output Format

Print the review as:

```
## Code Review Report

**Overall Score: X.X/10**

| Axis | Score | Notes |
|------|-------|-------|
| Simplicity | X/10 | <brief note> |
| Security | X/10 | <brief note> |
| Test Coverage | X/10 | <brief note> |
| Performance | X/10 | <brief note> |

### Issues Found

| # | Severity | File:Line | Issue | Suggestion |
|---|----------|-----------|-------|------------|
| 1 | CRITICAL | file.py:42 | SQL injection risk | Use parameterized queries |
| 2 | HIGH | file.py:88 | No input validation | Add type checking |
| ... | ... | ... | ... | ... |

### Verdict: APPROVE / NEEDS_CHANGES / REJECT

<Explanation of verdict>
```

## Verdict Rules
- Score >= 8.0 with no CRITICAL issues: **APPROVE**
- Score >= 6.0 with no CRITICAL issues: **NEEDS_CHANGES** (list what to fix)
- Score < 6.0 OR any CRITICAL issues: **REJECT** (explain why)
