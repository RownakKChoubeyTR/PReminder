---
name: test
description: Write, audit, and maintain unit tests for Cobalt Static Content. Covers Jest, Jasmine, and QUnit frameworks. Use when adding tests for a module, auditing test coverage for a folder, adjusting tests after refactoring, or during development to ensure proper test practices. Supports active mode (pass a path) and passive mode (applied during development).
argument-hint: <path-to-module-or-folder>
---

# Test

Write, audit, and maintain unit tests across Jest, Jasmine, and QUnit in Cobalt Static Content.

## Quick Start

**Active mode** (add or audit tests):

```
/test Platform/js/Core/SomeModule.js
/test Products/WestlawNext/js/Website/Widgets/
```

**Passive mode** (automatically applied during development, refactoring, or code reviews when test files are involved).

## Framework-Specific References

- **Jest tests** (`**/Jest/**/*.test.js`, `**/Jest/**/*.test.jsx`): See [references/jest.md](references/jest.md)
- **Karma tests** (Jasmine/QUnit: `**/Jasmine/**/*.test.js`, `**/QUnit/**/*.test.js`, `**/*.spec.ts`): See [references/karma.md](references/karma.md)

## Running Tests

### Jest Tests: Run Automatically to Verify

After writing or updating Jest tests, **run them to verify they pass**. The repo has many `jest.config.js` files scattered across test directories. Use the `--config` flag to point Jest at the correct config so tests can be run from the project root.

**Step 1: Find the closest config for each test file**

Use the helper script to group test files by their closest config. Paths must be relative to the repo root:

```bash
node .claude/skills/test/scripts/find-jest-config.mjs <test-file-paths...>
```

This outputs a JSON map of config paths to test file arrays (all paths relative to the repo root).

**Step 2: Run Jest once per config**

For each config from step 1, run Jest from the project root:

```bash
npx jest --config <config-path> <test-file-path> [<test-file-path> ...]
```

**Example: Single test file**

```bash
node .claude/skills/test/scripts/find-jest-config.mjs Platform/tests/Jest/Core/SomeModule.test.js
# Output: { "Platform/tests/Jest/Core/jest.config.js": ["Platform/tests/Jest/Core/SomeModule.test.js"] }

npx jest --config Platform/tests/Jest/Core/jest.config.js Platform/tests/Jest/Core/SomeModule.test.js
```

**Example: Multiple test files with different configs**

If the script outputs multiple config groups, run a separate Jest invocation for each:

```bash
npx jest --config Platform/tests/Jest/Core/jest.config.js Platform/tests/Jest/Core/SomeModule.test.js

npx jest --config Products/WestlawNext/tests/Jest/Indigo/Core/jest.config.js Products/WestlawNext/tests/Jest/Indigo/Core/AnotherModule.test.jsx
```

**Important rules:**

- Always use `--config` to specify the closest `jest.config.js` for the test file(s)
- If a test fails, read the error output, fix the test, and re-run
- Do NOT run `yarn test` or `yarn jest` (these run the full suite via Grunt)

### Karma Tests (Jasmine/QUnit): Ask the User

Do **NOT** attempt to run Karma/Jasmine/QUnit tests automatically. Ask the user to run them manually:

- `yarn run-tests` - Interactive test runner (lets user pick the test suite)
- `yarn workspaces:test` - Workspace-wide checks

## Instructions

### Active Mode: Module Path

When invoked with a path to a **single module file** (`.js`, `.jsx`, `.ts`, `.tsx`):

1. **Read the target module** to understand its exports, dependencies, and behavior
2. **Determine the test framework** based on the module's location:
    - React components or modules with Jest tests nearby: **Jest**
    - Angular modules (`.spec.ts`): **Jasmine on Karma**
    - Legacy/vanilla JS with QUnit or Jasmine tests nearby: **QUnit or Jasmine on Karma**
3. **Locate existing tests** by searching for test files that import or reference the module:
    - Check `tests/Jest/`, `tests/Jasmine/`, `tests/QUnit/` directories at the same level (Platform, Product, or Product View)
    - Search for the module name in test files
4. **If no test exists**: Create a new test file in the appropriate `tests/<Framework>/` directory mirroring the module's path structure
5. **If a test exists**: Read the existing test, compare it against the module's current implementation, and identify:
    - Missing test cases for new or changed exports/functions
    - Assertions that no longer match the module's behavior
    - Dead test cases for removed functionality
6. **Write or update tests** following framework-specific practices from the reference files
7. **Verify Jest tests pass** by running them (see "Running Tests" above). For Karma tests, ask the user to verify manually
8. **Report what was done**: Summarize added/modified test cases

### Active Mode: Folder Path

When invoked with a path to a **directory**:

1. **Scan the folder** for production modules (`.js`, `.jsx`, `.ts`, `.tsx` files, excluding test files, configs, and bootstraps)
2. **For each module, locate existing tests** using the same search strategy as module mode
3. **Produce a coverage audit report** listing:
    - Modules with existing tests (and whether tests appear up-to-date)
    - Modules missing tests entirely
    - Test files that reference modules no longer present (orphaned tests)
4. **Do NOT automatically write tests for every module**. Instead, present the audit and ask the user which modules to cover
5. After user selection, proceed with the module-path workflow for each chosen module

### Passive Mode: During Development

When working on new features, refactoring, or code reviews (no explicit `/test` invocation):

- When creating a new module, suggest that tests should be added and offer to write them
- When modifying an existing module, check if the corresponding test needs updates
- When reviewing code, flag untested public APIs or behaviors
- Ensure all test edits follow the practices below

## Core Practices

### Test Isolation

- Test cases must not depend on other tests or on execution order
- Tests should be hermetic
- Avoid leaking DOM elements and events
- Use test doubles to isolate external dependencies and global state
- Prefer sandboxing to isolate each test case and simplify cleanup

### No Conditions in Tests

Tests should NOT contain conditional logic (`if`, `?.`, `&&`, `||`, ternaries):

```javascript
// BAD - optional chaining hides failures
const count = container.querySelector('#list')?.children.length;

// GOOD - explicit guard, fail fast
const list = container.querySelector('#list');
expect(list).toBeTruthy(); // or assert.ok(list, 'list exists')
const count = list.children.length;
```

```javascript
// BAD - conditional hides failures
if (items.length > 1) {
    expect(items[0]).toBe('first');
}

// GOOD - explicit assertion
expect(items.length).toBeGreaterThan(1);
expect(items[0]).toBe('first');
```

If a condition is truly needed (e.g., testing different scenarios), split into separate test cases.

### No Side Effects

- Tests should NEVER introduce side effects into global state
- Tests should NEVER make real network requests
- Global hooks handle cleanup of event listeners, `localStorage`, `sessionStorage`
- Do NOT add broad `.removeEventListener()` sweeps or manual storage clears unless verifying specific behavior

### Async Guidance

- Prefer `waitFor` over ad-hoc polling or `setTimeout`
- Prefer fake timers where applicable rather than real timers

### Mocking HTTP Requests (MockWebRequest)

Import from: `Platform/tests/Fakes/Core/MockWebRequest.js`

Global setup exists; do NOT call `.reset()` to clean up.

```javascript
import MockWebRequest from 'Platform/tests/Fakes/Core/MockWebRequest.js';

MockWebRequest.mock({
    request: '/api/data',
    response: {
        ResponseText: JSON.stringify({ success: true }),
        StatusCode: 200
    }
});
```

### Tests Teardown

- Global hooks already call `restore()` and `reset()` on common fakes
- Do NOT add new global resets in `afterEach`
- Leave legacy per-file resets unchanged unless they cause conflicts

### Focused Tests

Focused tests are intentionally used during debugging. Keep them as-is:

- `describe.only` / `it.only` / `fdescribe` / `fit` - keep as is
- `QUnit.module.only` / `QUnit.test.only` - keep as is

### Prefer Local Changes

- Do not modify production code to "make tests pass"
- Favor clear assertions, deterministic execution, and minimal mocking
- See [Best Practices](/docs/testing/best-practices) for detailed guidance

## Test File Placement

Tests mirror the source directory structure within the appropriate `tests/<Framework>/` folder:

| Source Module                              | Test File                                               |
| ------------------------------------------ | ------------------------------------------------------- |
| `Platform/js/Core/SomeModule.js`           | `Platform/tests/Jest/Core/SomeModule.test.js`           |
| `Platform/js/Indigo/Components/Button.jsx` | `Platform/tests/Jest/Indigo/Components/Button.test.jsx` |
| `Products/WestlawNext/js/Search/Query.js`  | `Products/WestlawNext/tests/Jest/Search/Query.test.js`  |
| `Products/WestlawNext/ts/App.component.ts` | `Products/WestlawNext/tests/App.component.spec.ts`      |

When creating a new test, follow the naming pattern of nearby existing tests.

## Determining the Right Framework

| Signal                                      | Framework                      |
| ------------------------------------------- | ------------------------------ |
| React component (`.jsx`) or React hook      | Jest + React Testing Library   |
| Module with nearby `tests/Jest/` tests      | Jest                           |
| Angular component (`.ts` with `@Component`) | Jasmine on Karma               |
| Module with nearby `tests/Jasmine/` tests   | Jasmine on Karma               |
| Module with nearby `tests/QUnit/` tests     | QUnit on Karma                 |
| New vanilla JS module (no nearby tests)     | Jest (preferred for new tests) |
