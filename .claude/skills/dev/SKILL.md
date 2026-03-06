---
name: dev
description: "Full AI development pipeline: requirement -> code -> review -> scan -> test -> PR"
---

# AI Development Pipeline

Execute the full development pipeline for the given requirement.

## IMPORTANT: Follow these stages IN ORDER. Do NOT skip any stage.

Initialize: `retry_count = 0`, `max_retries = 3`

---

### Stage 1: REQUIREMENT ANALYSIS

1. Parse the user's requirement from the arguments
2. Read the project structure (use Glob to find package.json, requirements.txt, pom.xml, etc.)
3. Identify the primary programming language
4. List existing files that need modification
5. Print a detailed implementation plan for the user to see (following the format in CLAUDE.md Stage 1)
6. Print the STAGE 1 GATE summary block (see CLAUDE.md)
7. **STOP HERE.** End your response after printing the plan. Do NOT use AskUserQuestion — just print and stop. Do NOT proceed to Stage 2 until the user replies with approval.

---

### Stage 2: IMPLEMENT

1. Write code following existing project patterns (READ existing files first)
2. Create test files alongside the source code
3. Add docstrings/JSDoc/Javadoc to all public functions
4. Print a summary of all files created or modified

---

### Stage 3: SELF-REVIEW

1. Re-read EVERY file you created or modified
2. Score on 4 axes (each 0-10):
   - **Simplicity**: Is this the simplest solution? No over-engineering?
   - **Security**: No secrets, proper input validation, safe API usage?
   - **Test Coverage**: Happy path + edge cases + error cases covered?
   - **Performance**: No obvious N+1, memory leaks, or blocking calls?
3. Print the scorecard as a table
4. **GATE**: Average score must be >= 7.0
5. If issues found: fix them immediately, then re-score
6. If score < 7.0 after fix: increment `retry_count`, try again
7. If `retry_count >= max_retries`: ABORT with failure report

---

### Stage 4: SECURITY SCAN

Run BOTH scanners (order doesn't matter):

**Scanner 1 - TR MCP:**
```
Use mcp__tr-code-scan-mcp__scan_project with the project directory path
```

**Scanner 2 - Snyk CLI:**

Find the Snyk CLI and run both scans:
```bash
# Auto-detect Snyk CLI location (check PATH first, then common install locations)
SNYK_CMD=$(command -v snyk 2>/dev/null \
  || echo "$HOME/AppData/Local/snyk/snyk-cli/snyk-win.exe" \
  || echo "$HOME/AppData/Local/snyk/vscode-cli/snyk-win.exe")

# If Snyk is found, run both scans:
"$SNYK_CMD" code test 2>&1 || true   # SAST (code quality + security)
"$SNYK_CMD" test 2>&1 || true        # SCA (dependency vulnerabilities)

# If Snyk is NOT found, print warning and continue (TR MCP scanner alone is sufficient)
```

- Parse results from both scanners
- **GATE**: Zero critical/high vulnerabilities from EITHER scanner
- If vulnerabilities found: attempt to fix the code, then re-scan
- On fix+re-scan: increment `retry_count`
- If `retry_count >= max_retries`: ABORT
- On success: create marker file by running `mkdir -p .claude/hooks && touch .claude/hooks/.scan-passed`
- Print scan results summary

---

### Stage 5: TEST EXECUTION

Detect language and run the appropriate test framework:

- **Python**: `python -m pytest --tb=short -v`
- **JavaScript/TypeScript**: `npx jest --verbose` OR `npx vitest run`
- **Java**: `mvn test -Dsurefire.useFile=false`

- Capture and parse test output
- **GATE**: ALL tests must pass
- If tests fail: read the failure output, fix the code, re-run tests
- On fix+re-run: increment `retry_count`
- If `retry_count >= max_retries`: ABORT
- On success: create marker file by running `mkdir -p .claude/hooks && touch .claude/hooks/.tests-passed`
- Print test results

---

### Stage 6: PR CREATION

1. Create a feature branch:
   ```bash
   git checkout -b ai/<short-description-based-on-requirement>
   ```

2. Stage only the files you created/modified (list them explicitly):
   ```bash
   git add <file1> <file2> <file3>
   ```

3. Commit with a descriptive message using HEREDOC:
   ```bash
   git commit -m "$(cat <<'EOF'
   feat: <description of what was implemented>

   Co-Authored-By: Claude Code <noreply@anthropic.com>
   EOF
   )"
   ```

4. Push the branch:
   ```bash
   git push -u origin ai/<short-description>
   ```

5. Create PR with `gh pr create`:
   ```bash
   gh pr create --title "<concise title>" --body "$(cat <<'EOF'
   ## Summary
   <1-3 bullet points describing what was implemented>

   ## Quality Checks
   | Check | Status |
   |-------|--------|
   | Code Review Score | X.X/10 |
   | Security Scan (Snyk + TR MCP) | PASSED |
   | Tests | X passed, 0 failed |

   ## Files Changed
   <list each file>

   ## Test Plan
   - [ ] Unit tests pass
   - [ ] Security scan clean
   - [ ] Manual verification

   ---
   Generated with **Claude Code AI Development Agent**
   EOF
   )"
   ```

6. Clean up markers:
   ```bash
   rm -f .claude/hooks/.scan-passed .claude/hooks/.tests-passed
   ```

7. Print the PR URL

---

### ABORT Procedure (if retry_count >= 3)

1. Print a failure report listing which stage failed and why
2. Clean up: delete feature branch if created, remove marker files
3. Leave the working directory in a clean state
4. Suggest manual steps the user can take to fix the remaining issues
