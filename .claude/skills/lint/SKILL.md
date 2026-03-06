---
name: lint
description: Run ESLint, StyleLint, and TypeScript type checking for Cobalt Static Content. Use when linting a module, folder, or validating code quality during feature development and refactoring.
argument-hint: <path-to-module-or-folder>
---

# Lint

Run ESLint, StyleLint, and TypeScript type checking across Cobalt Static Content.

## Quick Start

**Active mode** (lint specific files or folders):

```
/lint Platform/js/Core/SomeModule.js
/lint Products/WestlawNext/js/Website/Widgets/
/lint Platform/css/Core/
```

**Passive mode** (automatically applied during development and refactoring to ensure lint-clean code).

## Running Linters

### ESLint

Applies to: `.js`, `.jsx`, `.ts` files. Config: `eslint.config.js`.

```bash
npx eslint <path>
npx eslint --fix <path>   # auto-fix
```

### StyleLint

Applies to: `.css`, `.scss` files. Config: `.stylelintrc.js`.

**Important:** StyleLint requires quoted glob patterns. For folders, use `"<folder>/**/*.{css,scss}"`.

```bash
npx stylelint "<glob-pattern>"
npx stylelint --fix "<glob-pattern>"   # auto-fix
```

### TypeScript Type Checking

Applies to: `.jsx` files (via JSDoc) and `.ts` files.

Use the helper script to check specific files or folders. It reuses the core `ts-type-check` logic and accepts arbitrary file paths and glob patterns:

```bash
node .claude/skills/lint/scripts/ts-type-check.mjs <files-or-globs...>
```

- `.jsx` files: checked with `checkJs:true` using root `tsconfig.json`
- `.ts` files: checked using the nearest `tsconfig.json` (walking up from the file)

Examples:

```bash
# Single file
node .claude/skills/lint/scripts/ts-type-check.mjs Platform/js/Core/SomeComponent.jsx

# Glob pattern
node .claude/skills/lint/scripts/ts-type-check.mjs "Platform/js/Indigo/Core/Components/**/*.jsx"
```

## Instructions

### Active Mode

When invoked with a path to a **file or folder**:

1. **Determine applicable linters** based on file extensions present:
    - `.js`, `.jsx` files: **ESLint**
    - `.ts` files: **ESLint** (includes TypeScript-aware rules) + **TypeScript type checking**
    - `.css`, `.scss` files: **StyleLint**
    - `.jsx` in production code (`*/js/**`): **TypeScript type checking** also applies
2. **Run applicable linters in parallel** using parallel Bash tool calls
3. **Fix all reported issues** directly in the source files
4. **Re-run linters** to verify all issues are resolved. Repeat until clean

### Parallel Execution

When multiple linters apply, **always run them concurrently using parallel Bash tool calls in a single message**.

**Example: Folder with JS and SCSS files**

Run both as parallel Bash calls in one message:

```bash
# Call 1: ESLint
npx eslint Products/WestlawNext/js/Website/Views/Search/
```

```bash
# Call 2: StyleLint
npx stylelint "Products/WestlawNext/js/Website/Views/Search/**/*.{css,scss}"
```

**Example: Platform folder with JSX files (all 3 linters)**

Run all three as parallel Bash calls in one message:

```bash
# Call 1: ESLint
npx eslint Platform/js/Indigo/Core/Components/
```

```bash
# Call 2: StyleLint
npx stylelint "Platform/js/Indigo/Core/Components/**/*.{css,scss}"
```

```bash
# Call 3: TypeScript
node .claude/skills/lint/scripts/ts-type-check.mjs "Platform/js/Indigo/Core/Components/**/*.jsx"
```

### Passive Mode: During Development

When working on features, refactoring, or code reviews (no explicit `/lint` invocation):

1. **Run applicable linters in parallel** on the changed files
2. **Report issues** to the user - do NOT fix them automatically

## Guidelines

- **Fix all errors** - warnings are acceptable in legacy code but errors must be resolved
- **Do NOT run interactive lint scripts** (`yarn run-lint`, `yarn run-stylelint`) - use `npx` commands directly
- **Do NOT lint files you haven't changed** - only lint files relevant to the current task
