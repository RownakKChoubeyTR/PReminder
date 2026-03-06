---
name: angularjs-plan
description: Analyze an AngularJS app folder and create a MIGRATION.md plan for incremental migration to React. Use when starting a new AngularJS to React migration.
disable-model-invocation: true
argument-hint: [app-folder-path]
---

# AngularJS to React Migration Planner

You are an expert AngularJS to React migration planner. Analyze the AngularJS application at the provided path and create a comprehensive `MIGRATION.md` file with a detailed incremental migration plan.

**App folder path**: $ARGUMENTS

If no path is provided, ask the user for the AngularJS application folder path.

## Important References

Before starting, read these key resources:

- **Migration Guide**: `docs/practices/angularjs/migration-guide.md`
- **AngularJS Adapter**: `Platform/js/Core/Util/AngularJSAdapter.js` (provides `angularizeDirective` and `getService`)
- **React Guidelines**
    - `docs/practices/react/react-overview.md`
    - `docs/practices/react/jsdoc-type-checking.md`
    - `docs/practices/react/components-qualities.md`
- **Test Migration Rules**:
    - `.github/instructions/cobalt-ai-rules_tests-common.instructions.md`
    - `.github/instructions/cobalt-ai-rules_tests-jest.instructions.md`
    - `.github/instructions/cobalt-ai-rules_tests-karma.instructions.md`

---

## Migration Strategy Overview

The migration follows a **side-by-side approach** that preserves the original app while creating a modernized version:

1. **Copy** the existing AngularJS app to `<AppName>Legacy/` folder (the legacy app that remains untouched)
2. **Move** existing tests (Jasmine/QUnit) to the Legacy test folder
3. The original AngularJS app remains in place and will be incrementally modernized
4. **Do NOT copy** legacy tests to the modernized app - write new Jest tests for React components
5. **Create** the app entry point `<AppName>.js` that allows switching between Legacy and Modernized versions based on the IAC feature flag
    - Place the app entry point module in the parent folder of the app folders
    - Update references to import the app using the new entry point

This approach ensures:

- The legacy app remains untouched and functional
- Quick rollback by toggling IAC flag
- Incremental migration without breaking production
- Clean separation between legacy and modern code

---

## Process Overview

Work through these phases in order:

1. **Discovery Phase**: Explore the codebase and gather information
2. **Questions Phase**: Ask clarifying questions to the user
3. **Analysis Phase**: Build dependency graph and determine migration order
4. **Planning Phase**: Generate the MIGRATION.md file

---

## Phase 1: Discovery

### Step 1.1: Validate the App Path

If `$ARGUMENTS` is empty or invalid, ask the user:

> What is the path to the AngularJS application folder you want to migrate?

### Step 1.2: Scan for AngularJS Components

Use Glob to find all AngularJS components in the app folder:

**Module files** (entry points):

- `{appPath}/**/*.app.js`
- `{appPath}/**/*.module.js`

**Controllers**:

- `{appPath}/**/controllers/**/*.js`
- `{appPath}/**/*Controller.js`
- `{appPath}/**/*controller.js`
- `{appPath}/**/*.controller.js`

**Directives**:

- `{appPath}/**/directives/**/*.js`
- `{appPath}/**/*Directive.js`
- `{appPath}/**/*directive.js`
- `{appPath}/**/*.directive.js`

**Services and Factories**:

- `{appPath}/**/services/**/*.js`
- `{appPath}/**/*Service.js`
- `{appPath}/**/*service.js`
- `{appPath}/**/*.service.js`
- `{appPath}/**/*Factory.js`

**Filters**:

- `{appPath}/**/filters/**/*.js`
- `{appPath}/**/*Filter.js`
- `{appPath}/**/*filter.js`
- `{appPath}/**/*.filter.js`

**Templates**:

- `{appPath}/**/templates/**/*.html`
- `{appPath}/**/views/**/*.html`
- `{appPath}/**/*.tpl.html`

### Step 1.3: Scan for Existing Tests

Look for tests related to this app:

**Jasmine tests**: `**/tests/Jasmine/**/*.test.js`
**QUnit tests**: `**/tests/QUnit/**/*.test.js`
**Jest tests**: `**/tests/Jest/**/*.test.jsx`, `**/tests/Jest/**/*.test.js`

### Step 1.4: Read and Analyze Each File

For each file found, read it and extract:

- File path
- Component type (module, controller, directive, service, filter, template)
- Component name (from `app.controller('name')`, `app.directive('name')`, etc.)
- Dependencies:
    - Injected services (from `['$scope', 'ServiceA', function(...)]`)
    - Module dependencies (from `angular.module('name', ['dep1', 'dep2'])`)
    - ES6 import dependencies
- Scope bindings (for directives): `'='`, `'@'`, `'&'`, `'<'`
- Template references

### Step 1.5: Identify External Dependencies

Categorize all dependencies as **internal** (within the app) or **external** (outside the app):

**External dependencies include:**

- Platform utilities (`Platform/js/Core/`, `Platform/js/Util/`, etc.)
- AngularJS built-in services (`$scope`, `$http`, `$timeout`, `$q`, etc.)
- Third-party libraries (lodash, moment, etc.)
- Other product modules (outside this app's folder)
- Shared components from other areas

**For each external dependency, note:**

- Import path
- How it's used (direct call, injected service, etc.)
- Whether it has a React equivalent or should be kept as-is

### Step 1.6: Analyze Localization (i18n)

Scan all templates and JavaScript files in the app for localization status:

1. **Check for existing localization**: Look for `Localizer.lookup`, `Localizer.format`, `Localizer.renderDate`, `Localizer.renderInteger`, and `<Localize>` usage in the app
2. **Identify hard-coded user-facing strings**: Scan templates (`.html`) for text content, `placeholder`, `aria-label`, `title`, and `alt` attributes that are not interpolated from localized sources
3. **Find the matching properties file**: Check `js/LocalizationResources/*.properties` at the Product or Product View level for existing keys
4. **Document findings** in the MIGRATION.md "Notes" section: List any hard-coded strings that need localization during migration

**Key insight**: AngularJS templates often contain hard-coded English strings that were never localized. The migration to React is an opportunity to fix it.

### Step 1.7: Analyze HTTP Interceptors (for `$http` → `WebRequest` migration)

When components use `$http`, determine the correct `Vertical` for `WebRequest` by analyzing HTTP interceptors:

1. **Search for HTTP interceptors** in the app modules:
    - Look for `$httpProvider.interceptors.push(...)` in `*.app.js` or `*.module.js` files

2. **Read each interceptor** to understand what it does:
    - Search for the factory/service definition (e.g., `app.factory('templateHttpInterceptor', ...)`)
    - Check if it only adds headers (e.g., `x-cobalt-pcid`) or if it sets routing headers (e.g., `x-cobalt-host`)

3. **Determine the Vertical**:
    - **If no `x-cobalt-host` header is set**: Use `Vertical.Website` (same-origin requests)
    - **If `x-cobalt-host` is set**: Use the corresponding `Vertical.*` constant

4. **Document the finding** in the MIGRATION.md:
    - Add to the dedicated "HTTP Interceptors Analysis" section
    - Include which interceptors are registered, what headers they add, and the recommended Vertical for `$http` → `WebRequest` migration

**Key insight**: `Vertical.Website` is special - when used, the `x-cobalt-host` header is NOT added, so requests stay on the same origin. This replicates the default AngularJS `$http.get('/relative/path')` behavior.

---

## Phase 2: Interactive Questions

After discovery, ask the user these questions:

### Question 1: App Name for IAC Flag

Ask about the short name for the IAC feature flag:

> What is the short name for this application? This will be used to generate the IAC flag and folder names.
>
> The flag format is: `IAC-ANGULARJS-MOD-{APP-NAME}`
> Maximum total length is 40 characters, so APP-NAME should be at most 20 characters.
>
> This name will also be used for folder structure and the app entry point:
>
> - `{AppName}Legacy/` - Original AngularJS app (moved here)
> - `{AppName}/` - Modernized app (copy that gets migrated)
> - `{AppName}.js` - App entry point module
>
> Examples:
>
> - SmartFolders → `IAC-ANGULARJS-MOD-SMARTFOLDERS`
> - Rulebook TOC → `IAC-ANGULARJS-MOD-RULEBOOK-TOC`

### Question 2: Priority Components

> Are there any specific components that should be prioritized for migration?
> (e.g., components with known bugs, components that need new features)
>
> Options:
>
> 1. No specific priorities - migrate in dependency order
> 2. I have specific components to prioritize (please list them)

### Question 3: Components to Exclude

> Are there any components that should NOT be migrated?
> (e.g., deprecated features, components scheduled for removal)
>
> Options:
>
> 1. Migrate all components
> 2. Exclude specific components (please list them)

### Question 4: Third-Party Libraries

If any third-party libraries (jQuery plugins, UI libraries, utility libraries, etc.) were discovered during Phase 1, ask the developer how to handle each one:

> The following third-party libraries were found in the application:
>
> - {library 1} - used in {components}
> - {library 2} - used in {components}
>
> For each library, please specify how it should be handled in the React migration:
>
> - Keep as-is (continue using the library)
> - Replace with a React alternative (specify which one)
> - Replace with native browser APIs / CSS
> - Remove (functionality no longer needed)
> - Other (please describe your approach)

Include the developer's decisions in the MIGRATION.md "Notes" section and in the relevant component migration instructions.

### Question 5: Custom Migration Instructions

> Do you have any additional migration instructions or special requirements?
> (e.g., specific patterns to follow, naming conventions, architectural decisions, integration requirements)
>
> Options:
>
> 1. No additional instructions
> 2. I have custom instructions (please provide them)

If the user provides custom instructions, include them in the MIGRATION.md file under a dedicated "Custom Migration Instructions" section and ensure they are considered in the detailed migration plans for each component.

---

## Phase 3: Dependency Analysis

### Step 3.1: Build the Dependency Graph

Create a dependency graph where:

- **Nodes** = AngularJS components (modules, controllers, directives, services, filters)
- **Edges** = Dependencies (A depends on B means an edge from A to B)

### Step 3.2: Identify Leaf Nodes

**Leaf nodes** are components with NO dependencies on other AngularJS components in the same app. They only depend on:

- Non-AngularJS modules, e.g. Platform utilities (from `Platform/js/`)
- Built-in AngularJS services (`$scope`, `$http`, `$timeout`, etc.)
- External libraries

Typical leaf nodes:

- Utility services (pure functions)
- Filters (data transformers)
- Constants
- Services that only use Platform utilities

### Step 3.3: Determine Migration Order

Use topological sort on the dependency graph:

1. **Wave 1**: Migrate leaf nodes first (no internal dependencies)
2. **Wave 2**: Migrate components whose dependencies are all migrated
3. **Wave 3+**: Continue until all components are ordered

---

## Phase 4: Generate MIGRATION.md

**CRITICAL**: The MIGRATION.md file must contain **instructions only**, NOT code implementations. The only exception from this rule is the app entry point code snippet in 0.2 Create App Entry Point.

**Rationale**:

- Code stored in MIGRATION.md becomes outdated as the actual source files change
- Migration may take several iterations with code modifications between attempts
- The migration command should always read actual source code from disk
- MIGRATION.md serves as a **guide**, not a source of code

**What to include**:

- Component inventory with file paths
- Dependency graph
- Migration order (waves)
- Step-by-step migration instructions per component
- File path mappings (source → target)
- Testing requirements and scenarios
- Success criteria

**What NOT to include**:

- Current implementation code snippets
- Proposed React code implementations
- Full test file contents
- Bridge implementation code

Create the file at `{appPath}/MIGRATION.md` with this structure:

````markdown
# Migration Plan: {App Name}

## Overview

- **Application**: {App Name}
- **Original Location**: `{appPath}`
- **Legacy Location**: `{parentPath}/{AppName}Legacy/`
- **Modernized Location**: `{parentPath}/{AppName}/`
- **Entry Point**: `{parentPath}/{AppName}.js`
- **IAC Flag**: `{IAC-FLAG}`
- **Generated**: {YYYY-MM-DD}
- **Total Components**: {count}
- **Estimated Migration Waves**: {count}

## Migration Strategy

This migration uses a **side-by-side approach**:

1. **Copy** the original app to `{AppName}Legacy/` folder (the legacy app that remains untouched)
2. **Move** existing Jasmine/QUnit tests to the Legacy test folder
3. The original app stays in place and will be incrementally modernized
4. **Do NOT copy** legacy tests to the modernized app - write new Jest tests for React components
5. **Create** app entry point `{AppName}.js` in the parent folder
6. **Use IAC flag** in the entry point to switch between Legacy and Modernized versions

### Benefits

- The legacy app remains untouched and functional
- Quick rollback by toggling IAC flag OFF
- Incremental migration without breaking production
- Clean separation between legacy and modern code

## Step 0: Initial Setup

Before starting component migration, perform these setup steps:

### 0.1 Create Folder Structure

Strictly follow the instructions to set up the folder structure:

```bash
# 1. Copy original app to Legacy folder (the legacy app that remains untouched)
cp -r {appPath} {parentPath}/{AppName}Legacy

# 2. Remove MIGRATION.md from Legacy folder (it should only exist in the modernized app)
rm {parentPath}/{AppName}Legacy/MIGRATION.md

# 3. Move legacy tests to Legacy test folder
mv {testsPath}/Jasmine/{AppName} {testsPath}/Jasmine/{AppName}Legacy
mv {testsPath}/QUnit/{AppName} {testsPath}/QUnit/{AppName}Legacy

# 4. Create Jest test folder for modernized app (do NOT copy legacy tests)
mkdir -p {testsPath}/Jest/{AppName}
```

**Note**: The original app stays in place at `{appPath}` and will be incrementally modernized. The legacy app remains untouched. **MIGRATION.md must only exist in the modernized app folder `{AppName}/`, NOT in `{AppName}Legacy/`.**

### 0.2 Create App Entry Point

Create `{parentPath}/{AppName}.js` - the entry point that switches between Legacy and Modernized apps:

```javascript
/**
 * {App Name} Entry Point
 *
 * This module provides the entry point for the {App Name} application,
 * switching between Legacy (AngularJS) and Modernized (React) versions
 * based on the IAC feature flag.
 */
import Configuration from 'Platform/js/Core/Configuration.js';

if (Configuration.isIacOn('{IAC-FLAG}')) {
    // Load partially modernized app (AngularJS + React) - During migration (Step 0)
    import('./{AppName}/{app}.bundle.js').then(() => {
        // Bootstrap AngularJS app after loading the bundle
        angular.bootstrap(element, ['moduleName']);
    });

    // Load modernized app (React) - Uncomment the code at the final migration stage
    // and remove the partially modernized app import above
    // import('./{AppName}/App.jsx').then(({ default: bootstrap }) => {
    //    bootstrap();
    // });
} else {
    // Load legacy app (AngularJS)
    import('./{AppName}Legacy/{app}.bundle.js');
}
```

**Note**: The `element` selector and `moduleName` values must be determined from the AngularJS app source code:

- **moduleName**: Find in `{app}.app.js` where the module is defined, e.g., `angular.module('rulebook', [...])`
- **element**: Find the DOM element selector used to bootstrap the app by searching for `angular.bootstrap(...)` calls with the found `moduleName` in external or internal modules.

**IMPORTANT - External trigger timing**: If the app initialization depends on an external trigger (event handler, callback, message listener, etc.), the trigger handler must be registered BEFORE any async loading. Place the dynamic import INSIDE the handler to avoid race conditions where the trigger fires before the bundle is loaded:

```javascript
// WRONG - trigger might fire before bundle loads
import('./bundle.js').then(() => {
    registerHandler(trigger, () => {
        /* ... */
    });
});

// CORRECT - register handler first, load bundle inside
registerHandler(trigger, () => {
    import('./bundle.js').then(() => {
        /* ... */
    });
});
```

### 0.3 Refactor External Modules

External modules that import the app bundle and call `angular.bootstrap` need to be refactored. Replace the static import and manual bootstrap with a dynamic import of the entry point.

**Before** (static import + manual bootstrap):

```javascript
import '{parentPath}/{AppName}/{app}.bundle.js';

import angular from 'angular';

// ... somewhere in the code, angular.bootstrap is called:
angular.bootstrap(element, ['{moduleName}']);
```

**After** (static import via entry point + removed bootstrap logic):

```javascript
import '{parentPath}/{AppName}.js';
```

**Key changes**:

1. **Remove old bundle import** - The bundle is no longer imported directly
2. **Remove angular import** - If it was only used for `angular.bootstrap`, remove it
3. **Remove bootstrap logic entirely** - No function wrapper, no `angular.bootstrap()` call
4. **Use static import** - Must be a static import (`import 'path';`), NOT a dynamic import (`import('path')`)
5. **Entry point handles everything** - The `{AppName}.js` entry point handles IAC check, bundle loading, handler registration, and bootstrap internally

**IMPORTANT**: Use static import, not dynamic import. Static imports execute immediately when the module loads, ensuring the entry point registers its handlers before any external triggers can fire. Dynamic imports are deferred and may cause race conditions.

## IAC Configuration

The migration is controlled by the feature flag: `{IAC-FLAG}`

**Implementation pattern**:

- Import `Configuration` from `Platform/js/Core/Configuration.js`
- Use `Configuration.isIacOn('{IAC-FLAG}')` to check flag status
- When ON: Load partially modernized app (AngularJS + React during migration, then pure React after final stage)
- When OFF: Load legacy app (original AngularJS)

**Entry point setup**:

- Create entry point file `{AppName}.js` in the parent folder
- Entry point uses dynamic imports internally to load either Legacy or Modernized app based on IAC flag
- During migration (Step 0): Load the bundle and bootstrap AngularJS manually
- Final stage: Switch to loading React App.jsx entry point
- External modules use static import (`import 'path';`) to the entry point - this ensures immediate execution

## Component Inventory

### Modules ({count})

| File     | Module Name | Dependencies |
| -------- | ----------- | ------------ |
| `{path}` | {name}      | {deps}       |

### Controllers ({count})

| File     | Controller Name | Injected Dependencies |
| -------- | --------------- | --------------------- |
| `{path}` | {name}          | {deps}                |

### Directives ({count})

| File     | Directive Name | Bindings   | Template   |
| -------- | -------------- | ---------- | ---------- |
| `{path}` | {name}         | {bindings} | {template} |

### Services ({count})

| File     | Service Name | Type            | Dependencies |
| -------- | ------------ | --------------- | ------------ |
| `{path}` | {name}       | factory/service | {deps}       |

### Filters ({count})

| File     | Filter Name | Description   |
| -------- | ----------- | ------------- |
| `{path}` | {name}      | {description} |

### Templates ({count})

| File     | Associated Component |
| -------- | -------------------- |
| `{path}` | {component}          |

## Existing Tests (Legacy)

These tests will be moved to the Legacy folder and remain unchanged:

| Test File | Framework     | Components Tested |
| --------- | ------------- | ----------------- |
| `{path}`  | Jasmine/QUnit | {components}      |

## External Dependencies

Dependencies outside this app that are used by components:

### Platform Utilities

| Import Path                    | Used By      | Migration Notes |
| ------------------------------ | ------------ | --------------- |
| `Platform/js/Core/{Module}.js` | {components} | Keep as-is      |

### AngularJS Built-in Services

| Service    | Used By      | React Equivalent                                                                                 |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------ |
| `$http`    | {components} | Platform WebRequest (see [HTTP Interceptors Analysis](#http-interceptors-analysis) for Vertical) |
| `$timeout` | {components} | `setTimeout` or `useEffect`                                                                      |
| `$q`       | {components} | Native `Promise`                                                                                 |
| `$scope`   | {components} | `useState`, `useEffect`                                                                          |

### Third-Party Libraries

| Library | Version   | Used By      | Migration Notes |
| ------- | --------- | ------------ | --------------- |
| {name}  | {version} | {components} | {notes}         |

### Other Product Modules

| Import Path | Used By      | Migration Notes |
| ----------- | ------------ | --------------- |
| `{path}`    | {components} | {notes}         |

## HTTP Interceptors Analysis

This section documents the HTTP interceptors registered in the AngularJS app and the recommended `Vertical` for migrating `$http` calls to `WebRequest`.

### Registered Interceptors

| Interceptor Name    | Module          | Headers Added    | Purpose         |
| ------------------- | --------------- | ---------------- | --------------- |
| `{interceptorName}` | `{module path}` | `{header names}` | `{description}` |

### Recommended Vertical for WebRequest

**Vertical**: `{Vertical.Website | Vertical.* }`

**Rationale**: {Explain why this Vertical was chosen based on interceptor analysis}

- **If using `Vertical.Website`**: Requests stay on the same origin (no `x-cobalt-host` header added). This replicates the default AngularJS `$http.get('/relative/path')` behavior.
- **If using another Vertical**: The corresponding `x-cobalt-host` header will be added for routing.

## Localization (i18n)

Hard-coded user-facing strings found in templates and JavaScript must be localized during migration using `Localizer.js`.

**Properties file**: `{properties file path}`

**Strings requiring localization**:

| String | Source File | Suggested Key        |
| ------ | ----------- | -------------------- |
| {text} | {file}      | {SC.Context.KeyName} |

Refer to the `/localize` skill for Localizer API usage, properties file format, and naming conventions.

## Dependency Graph

```mermaid
graph TD
    {nodes and edges}
```

## Migration Order

### Wave 1: Foundation (Leaves)

These components have no dependencies on other app components and should be migrated first.

| Priority | Component | Type   | Migration Strategy |
| -------- | --------- | ------ | ------------------ |
| 1.1      | {name}    | {type} | {strategy}         |

### Wave 2: First Dependents

These components depend only on Wave 1 components.

| Priority | Component | Type   | Dependencies | Migration Strategy |
| -------- | --------- | ------ | ------------ | ------------------ |
| 2.1      | {name}    | {type} | {deps}       | {strategy}         |

{Continue for all waves...}

## Detailed Migration Plans

**IMPORTANT**: This section contains migration instructions only, NOT code. The migration command should read actual source files from disk to ensure it works with the current state of the codebase.

{For each component, include:}

### {Component Name}

**Type**: {controller/directive/service/filter}
**Source File**: `{AppName}/{file path}`
**Target File**: `{AppName}/{target folder}/{NewFileName}` (see naming conventions below)
**Target Test**: `tests/Jest/{AppName}/{target folder}/{NewFileName}.test.{jsx|js}`
**Dependencies**: {list}
**Used By**: {list of components that depend on this}

#### Naming Conventions

| Target Folder | Naming Pattern                                   | Example               |
| ------------- | ------------------------------------------------ | --------------------- |
| `Components/` | `{ComponentName}.jsx` (PascalCase)               | `RulebookToc.jsx`     |
| `Hooks/`      | `use{HookName}.js` (camelCase with `use` prefix) | `useRulebookData.js`  |
| `Providers/`  | `{ProviderName}.js` (PascalCase)                 | `RulebookProvider.js` |
| `Utils/`      | `{UtilName}.js` (PascalCase)                     | `PathUtils.js`        |

**Test files**: Same name with `.test.jsx` for components, `.test.js` for others.

#### Migration Strategy

{One of:}

- Convert to React Component → `Components/{ComponentName}.jsx`
- Convert to Custom Hook → `Hooks/use{HookName}.js`
- Convert to Data Provider → `Providers/{ProviderName}.js` (network requests)
- Convert to Utility Function → `Utils/{UtilName}.js` (pure functions)
- Convert to Context Provider
- Keep as AngularJS Service (accessed via getService during bridge period)
- Remove (unused)

#### Migration Instructions

{Detailed step-by-step instructions for migrating this component:}

1. **Read the source file** at `{source file path}` to understand the current implementation
2. **Identify the exported API**: {describe what functions/methods are exported}
3. **Map AngularJS patterns to React**:
    - {specific pattern mapping instructions}
    - {dependency injection replacements}
    - {scope/state management approach}
4. **Create the React equivalent** at `{target file path}`:
    - {specific instructions for the React implementation}
    - {hooks to use, if applicable}
    - {props structure, if applicable}
5. **Handle internal dependencies**:
    - {how to handle each internal app dependency}
6. **Handle external dependencies**:
    - Platform utilities: {keep as-is, import directly}
    - AngularJS services: {replace with React equivalent - see table below}
    - Third-party libraries: {keep or replace}
7. **Localize user-facing strings**: See the [Localization](#localization-i18n) section for the list of strings and the `/localize` skill for API details

#### AngularJS Service Replacements

| AngularJS Service  | React Equivalent                          |
| ------------------ | ----------------------------------------- |
| `$http`            | `Platform/js/Core/WebRequest.js`          |
| `$timeout`         | `setTimeout` or `useEffect` with cleanup  |
| `$interval`        | `setInterval` or custom hook with cleanup |
| `$q`               | Native `Promise`                          |
| `$scope.$watch`    | `useEffect` with dependency array         |
| `$scope.$on/$emit` | Context, custom events, or lifted state   |

#### Binding Migration (for directives)

| AngularJS Binding    | React Prop   | Type         | Notes                              |
| -------------------- | ------------ | ------------ | ---------------------------------- |
| `{bindingName}: '='` | `{propName}` | `{PropType}` | Two-way binding → controlled prop  |
| `{bindingName}: '@'` | `{propName}` | `string`     | String interpolation → string prop |
| `{bindingName}: '&'` | `{propName}` | `() => void` | Expression binding → callback prop |

#### Bridge Requirements

- **Bridge Type**: `angularizeDirective` from `Platform/js/Core/Util/AngularJSAdapter.js`
- **Directive Name**: `{directiveName}` (use the SAME name as the original directive for seamless replacement)
- **App Module**: `{app module path}`
- **Bindings to Register**: {list of bindings}

#### Test Migration

**Current Tests**: `{test file path}`
**Framework**: Jasmine/QUnit
**Target Framework**: Jest + React Testing Library
**Target Test File**: `{testsPath}/Jest/{AppName}/{folder}/{Component}.test.jsx`

**Test scenarios to cover**:

- {list each test case from the original file with description}
- {additional React-specific scenarios}

**Testing Notes**:

- {specific mocking requirements}
- {async handling notes}
- {user interaction patterns to test}

## File Organization

### Initial Structure After Setup

```
{parentPath}/
├── {AppName}.js                    # Entry point with IAC switch
├── {AppName}/                      # Modernized app (original, being migrated)
│   ├── MIGRATION.md                # Migration plan (this file)
│   ├── {app}.bundle.js
│   ├── {app}.app.js
│   ├── controllers/
│   ├── directives/
│   ├── services/
│   ├── filters/
│   └── templates/
└── {AppName}Legacy/                # Legacy app (copy, untouched legacy, NO MIGRATION.md)
    ├── {app}.bundle.js
    ├── {app}.app.js
    ├── controllers/
    ├── directives/
    ├── services/
    ├── filters/
    └── templates/
```

### Modernized App Structure (During Migration)

As components are migrated, add new folders to `{AppName}/`:

```
{AppName}/
├── MIGRATION.md                    # Migration plan
├── App.jsx                         # React app entry point
├── {app}.bundle.js                 # Remove after migration complete
├── {app}.app.js                    # Remove after migration complete
├── Components/                     # React components (from directives) - PascalCase
│   ├── {ComponentName}.jsx
│   └── ...
├── Hooks/                          # Custom hooks (stateful logic) - use{HookName}
│   ├── use{HookName}.js
│   └── ...
├── Providers/                      # Data fetching (network services) - PascalCase
│   ├── {ProviderName}.js
│   └── ...
├── Utils/                          # Pure functions (filters, utility services) - PascalCase
│   ├── {UtilName}.js
│   └── ...
├── controllers/                    # Remove after migration complete
├── directives/                     # Remove after migration complete
├── services/                       # Remove after migration complete
└── filters/                        # Remove after migration complete
```

### Test Structure

```
tests/
├── Jasmine/.../
│   └── {AppName}Legacy/            # Legacy tests (moved)
├── QUnit/.../
│   └── {AppName}Legacy/            # Legacy tests (moved)
└── Jest/.../{AppName}/             # New Jest tests for React components
    ├── Components/
    │   └── {ComponentName}.test.jsx
    ├── Hooks/
    │   └── use{HookName}.test.js
    ├── Providers/
    │   └── {ProviderName}.test.js
    └── Utils/
        └── {UtilName}.test.js
```

## Testing Strategy

### Test Migration Approach

1. **Do NOT copy legacy tests** - Write new Jest tests for React components
2. **Legacy tests remain untouched** - They stay in the Legacy test folder and test the legacy app
3. **Migrate tests alongside components** - Each migrated component gets new Jest tests
4. **Delete legacy tests after full rollout** - Only when IAC flag is permanently ON

### Test Migration Order

1. Write tests for leaf components first (Wave 1 services and utilities)
2. Write tests for hooks (Wave 2 controller logic)
3. Write tests for UI components (Wave 3 directives)
4. Keep legacy tests running during bridge period for the legacy app

### Jest Test Guidelines

Follow the test rules in these instruction files:

- `.github/instructions/cobalt-ai-rules_tests-common.instructions.md`
- `.github/instructions/cobalt-ai-rules_tests-jest.instructions.md`

**Key testing patterns**:

- Use `@testing-library/react` for component tests
- Use `@testing-library/user-event` for user interactions
- Use `waitFor` for async operations
- Use `jest.mock()` for module mocking

### Mocking AngularJS Services

When React components need to access AngularJS services during the bridge period:

- Mock `getService` from `Platform/js/Core/Util/AngularJSAdapter.js` using `jest.mock()`
- Return mock implementations for each service method needed
- See the Jest test rules for detailed mocking examples

## Rollback Plan

If issues are discovered after enabling the IAC flag:

1. **Disable the IAC flag**: Set `{IAC-FLAG}` = OFF
2. **Automatic rollback**: Users will immediately use the Legacy app
3. **No code changes required**: Both versions coexist
4. **Investigate and fix**: Debug issues in the modernized app
5. **Re-enable**: Turn IAC flag back ON when ready

## Success Criteria

### Initial Setup Completion

- [ ] Entry point `{AppName}.js` created and working
- [ ] Legacy app works with IAC OFF (via entry point)
- [ ] Modernized app works with IAC ON (via entry point)
- [ ] All external modules refactored (static imports and `angular.bootstrap` replaced with dynamic import of entry point)
- [ ] Legacy tests still pass

### Per-Wave Completion

- [ ] All components in wave migrated to React
- [ ] Jest tests written and passing for all migrated components
- [ ] Manual QA completed for migrated functionality
- [ ] There are no A11y issues

### Full Migration Completion

- [ ] All components listed in this plan have been migrated
- [ ] All Jest tests pass
- [ ] Manual QA completed for all user flows
- [ ] IAC flag enabled for all users
- [ ] Entry point updated to use `App.jsx` instead of `{app}.bundle.js`
- [ ] Legacy AngularJS files removed from `{AppName}/` folder
- [ ] Legacy folder and tests can be safely deleted
- [ ] Entry point can be simplified (remove IAC check, import modernized app only)

## Appendix: AngularJS to React Mapping

| AngularJS                     | React Equivalent            | Target Folder | Naming Pattern        |
| ----------------------------- | --------------------------- | ------------- | --------------------- |
| Module                        | Entry point / App wrapper   | -             | `App.jsx`             |
| Controller                    | Custom Hook (stateful)      | `Hooks/`      | `use{HookName}.js`    |
| Directive (with template)     | React Component             | `Components/` | `{ComponentName}.jsx` |
| Directive (attribute only)    | Custom Hook or HOC          | `Hooks/`      | `use{HookName}.js`    |
| Service/Factory (network)     | Data Provider module        | `Providers/`  | `{ProviderName}.js`   |
| Service/Factory (stateful)    | Custom Hook                 | `Hooks/`      | `use{HookName}.js`    |
| Service/Factory (pure)        | Utility function            | `Utils/`      | `{UtilName}.js`       |
| Filter                        | Utility function            | `Utils/`      | `{UtilName}.js`       |
| Template                      | JSX                         | `Components/` | (inline in component) |
| `$scope`                      | Component state (useState)  | -             | -                     |
| `$scope.$watch`               | useEffect with dependencies | -             | -                     |
| `$scope.$on` / `$scope.$emit` | Context or lifted state     | -             | -                     |
| `ng-repeat`                   | `{array.map()}`             | -             | -                     |
| `ng-if`                       | `{condition && ...}`        | -             | -                     |
| `ng-class`                    | className with template     | -             | -                     |
| `ng-click`                    | onClick prop                | -             | -                     |
| `ng-model`                    | value + onChange            | -             | -                     |

## Custom Migration Instructions

{Include any custom instructions provided by the user in Question 4. If none provided, remove this section.}

## Notes

{Any additional observations, concerns, or recommendations from the analysis}
````

---

## Key Patterns Reference

### React-in-AngularJS Bridge

Use `angularizeDirective` from `Platform/js/Core/Util/AngularJSAdapter.js`:

```javascript
import { angularizeDirective } from 'Platform/js/Core/Util/AngularJSAdapter.js';
import MyReactComponent from './Components/MyReactComponent.jsx';
import app from './{app}.app.js';

// Use the SAME directive name as the original for seamless replacement
angularizeDirective(MyReactComponent, 'myDirective', app, {
    title: '@', // String binding
    data: '=', // Two-way binding
    onAction: '&' // Function binding
});
```

### Accessing AngularJS Services from React

Use `getService` when React components need access to AngularJS services during the bridge period:

```javascript
import { getService } from 'Platform/js/Core/Util/AngularJSAdapter.js';

const MyService = getService('myApp.module', 'MyService');
if (MyService) {
    const result = MyService.doSomething();
}
```

### IAC Flag Pattern

```javascript
import Configuration from 'Platform/js/Core/Configuration.js';

if (Configuration.isIacOn('IAC-ANGULARJS-MOD-APPNAME')) {
    // Load partially modernized app (AngularJS + React) - During migration (Step 0)
    import('./{AppName}/{app}.bundle.js').then(() => {
        // Bootstrap AngularJS app after loading the bundle
        angular.bootstrap(element, ['moduleName']);
    });

    // Load modernized app (React) - Uncomment the code at the final migration stage
    // and remove the partially modernized app import above
    // import('./{AppName}/App.jsx').then(({ default: bootstrap }) => {
    //    bootstrap();
    // });
} else {
    // Load legacy app (AngularJS)
    import('./{AppName}Legacy/{app}.bundle.js');
}
```

**Note**: The `element` selector and `moduleName` must be determined from the AngularJS app source code (see section 0.2).

**IAC Flag Naming Rules:**

- Maximum 40 characters total
- Format: `IAC-ANGULARJS-MOD-{APP-NAME}`
- APP-NAME should be uppercase, no spaces
- Use hyphens for multi-word names

---

## Reminders

1. **NEVER include code in MIGRATION.md** - Only instructions, file paths, and guidance
2. **The migration command reads actual source files** - MIGRATION.md is for guidance only
3. **Copy original app to Legacy folder** - Create an untouched legacy backup
4. **Remove MIGRATION.md from Legacy folder** - It should only exist in the modernized app `{AppName}/`
5. **Original app stays in place** - It will be incrementally modernized
6. **Move legacy tests to Legacy folder** - Keep them with the legacy app
7. **Do NOT copy legacy tests to modernized app** - Write fresh Jest tests for React components
8. **Create the entry point `{AppName}.js`** - Place it in the parent folder of both apps
9. **Refactor external modules** - Replace bundle imports and bootstrap logic with static import of the entry point (`import 'path';` not `import('path')`)
10. **Use IAC flag in the entry point** to switch between Legacy and Modernized apps
11. **External triggers before async loading** - In the entry point, register handlers first, place dynamic import inside to avoid race conditions
12. **Migrate leaf nodes first** to minimize dependencies during conversion
13. **Use `angularizeDirective`** to bridge React components into AngularJS templates
14. **Use `getService`** sparingly - only when necessary during bridge period
15. **Follow Jest testing patterns** from the test instruction files
