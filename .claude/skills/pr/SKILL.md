---
name: pr
description: "Create an AI-generated pull request with structured description and quality check results."
---

# Create Pull Request

Create a well-structured PR for the current changes.

## Process

### Step 1: Gather Context

```bash
git status
git diff --cached
git diff
git log --oneline -5
```

Identify the base branch (main or master).

### Step 2: Create Branch (if on main/master)

```bash
git checkout -b ai/<short-description-from-changes>
```

### Step 3: Stage and Commit

Stage specific files (NEVER use `git add -A` or `git add .`):
```bash
git add <file1> <file2> <file3>
```

Commit with a descriptive message:
```bash
git commit -m "$(cat <<'EOF'
feat|fix|refactor: <description>

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

### Step 4: Push

```bash
git push -u origin <branch-name>
```

### Step 5: Create PR

Analyze all commits on the branch to write a comprehensive PR description:

```bash
gh pr create --title "<short title under 70 chars>" --body "$(cat <<'EOF'
## Summary
- <bullet point 1: what was added/changed>
- <bullet point 2: why it was needed>
- <bullet point 3: key technical decisions>

## Quality Checks
| Check | Status |
|-------|--------|
| Code Review | <score or N/A> |
| Security Scan | <PASSED/FAILED/NOT RUN> |
| Tests | <PASSED/FAILED/NOT RUN> |

## Files Changed
<list each file with a 1-line description of what changed>

## Test Plan
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] Manual verification steps

---
Generated with **Claude Code AI Development Agent**
EOF
)"
```

### Step 6: Report

Print the PR URL and a brief summary.

### Step 7: Cleanup

```bash
rm -f .claude/hooks/.scan-passed .claude/hooks/.tests-passed
```
