---
name: code-review
allowed-tools:
    - mcp__github__*
    - Bash(git show:*)
    - Bash(git blame:*)
    - Bash(git log:*)
    - Bash(git diff:*)
    - Bash(git status:*)
    - Bash(git merge-base:*)
    - Bash(git rev-parse:*)
    - Bash(git switch:*)

description: Code review a pull request or local branch changes. Use only when the user explicitly asks for a code review.
argument-hint: '[PR number or link] [-c | --checkout]'
---

Review code changes in `tr/cobalt_static-content` for quality, accessibility, correctness, and compliance with project standards.

ARGUMENTS: $ARGUMENTS

## Mode Detection & Argument Parsing

Parse arguments for:

- A PR number (numeric value, e.g., `38200`) or GitHub link
- An optional `-c | --checkout` flag (auto-switch to the PR's branch locally)

Determine the review mode:

- **Pull Request Review Mode**: A PR number or URL was provided.
- **Self Review Mode**: No PR number was provided.

## Gather Context

### Pull Request Review Mode

1. Fetch PR details, diff, and file list using the GitHub MCP (owner: `tr`, repo: `cobalt_static-content`).
2. Run `git rev-parse --abbrev-ref HEAD` to get the current local branch.
3. If `--checkout` was passed and the current branch differs from the PR branch, run `git switch <branch-name>`.

### Self Review Mode

1. Run `git merge-base main HEAD` to find the common ancestor.
2. Get the file list: `git diff --name-only <merge-base>`
3. Get the full diff: `git diff <merge-base>`
4. Derive a summary from the branch name and `git log --oneline main..HEAD`.
5. If no changes are found, report "No changes to review" and stop.

## PR Metadata Validation (Pull Request Review Mode only)

Check the PR title and description to make sure it follows our standards.

## Launch Parallel Review Subagents

Launch the appropriate general purpose subagents for these changes in a single message. Each subagent prompt **must include**:

1. The full diff (or how to obtain it — `git diff <merge-base>` for Self Review Mode, or instructions to fetch via the GitHub MCP for Pull Request Review Mode)
2. The list of changed files with full paths
3. What the PR/branch is doing (title, description, or commit log summary)
4. Instructions to read each changed file in full (not just the diff) for complete context
5. Rules for Bash commands: Never use `xargs`.

### Subagent Definitions

1. **Code Quality**
    - **Focus:** Architecture, dependency direction (Platform → Product → View), framework best practices, correctness, security, and performance.
    - **Skip when:** Only documentation or properties files are changed.

2. **UI Standards**
    - **Focus:** Accessibility (WCAG 2.1 AA), internationalization, styling (CSS Modules, design tokens).
    - **Skip when:** No UI, style, or properties files are included in the changes.

3. **Test Quality**
    - **Focus:** Test coverage for changes, use of the appropriate test framework (Jest, Jasmine, QUnit), and overall test quality. Tell the subagent to use the /test skill
    - **Skip when:** Only documentation or properties files are changed.

4. **Git History Context**
    - **Focus:** Analyze the evolution and recent patterns of modified files using `git log` and `git blame`. Assess whether the changes are consistent with the ongoing trajectory of the codebase.
    - **Skip when:** Only documentation or configuration files are changed.

5. **Previous PR Comments**
    - **Focus:** Search for feedback and known issues by reviewing recent merged PRs that modified the same files.
    - **Skip when:** Only documentation or configuration files are changed.

#### Subagent Output Format

Return findings using this structure:

```markdown
#### Critical (must fix)

- <file:line> — <description>

#### Suggestions

- <file:line> — <description and suggested alternative>

#### Nits

- <file:line> — <minor observation>
```

Omit empty severity sections. If no findings, return "No issues found."

## Merge Results

After all subagents fully complete:

1. Deduplicate findings across subagents
2. Resolve conflicting assessments
3. Produce the final review:

```markdown
# PR Review: #<NUMBER> — <title>

<!-- Self Review Mode: # Branch Review: <branch-name> -->

## Overview

<1-2 sentence summary of changes and affected areas>

### PR Metadata (Pull Request Review Mode only)

- [ ] Title follows convention
- [ ] Description filled out
- [ ] Work item linked
- [ ] Self-review checklist completed

### Critical (must fix before merge)

- <file:line> — <description>

## Suggestions (consider improving)

- <file:line> — <description>

## Nits (optional)

- <file:line> — <description>

## Questions

- <file:line> — <description>
```

Omit the PR Metadata section for Self Review Mode. Omit any Summary subsection that has no findings.

### Code Linking

- **Pull Request Review Mode**: Use GitHub permalinks — `https://github.com/tr/cobalt_static-content/blob/<full-sha>/<file-path>#L<start>-L<end>` (include 1 line of context before/after)
- **Self Review Mode**: Use `file:line` format (no permalinks — no PR SHA exists)

## Tone

- Offer alternatives; assume the author considered them
- Distinguish strong opinions from minor preferences
- Focus on the code, not the person
- Do not post comments on the pull request
- Keep your output brief
