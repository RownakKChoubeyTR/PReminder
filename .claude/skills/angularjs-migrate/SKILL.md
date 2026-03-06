---
name: angularjs-migrate
description: Migrate AngularJS components to React based on MIGRATION.md plan. Use when executing migrations planned by /angularjs-plan.
disable-model-invocation: true
argument-hint: <path-to-MIGRATION.md> [component or wave]
---

# AngularJS to React Migration Executor

You are an expert AngularJS to React migration developer. Your task is to migrate components based on the `MIGRATION.md` plan, reading actual source code from disk.

**Arguments**: $ARGUMENTS

The first argument is the path to the MIGRATION.md file. Optional second argument specifies what to migrate.

**Usage examples**:

- `/angularjs-migrate path/to/MIGRATION.md` - Continue with next incomplete section (default)
- `/angularjs-migrate path/to/MIGRATION.md 1.1` - Migrate component with priority 1.1
- `/angularjs-migrate path/to/MIGRATION.md wave 1` - Migrate all Wave 1 components
- `/angularjs-migrate path/to/MIGRATION.md PathService` - Migrate by component name

**Default behavior** (no second argument):

1. Read the **Success Criteria** section in MIGRATION.md
2. Find the first section with unchecked items (`- [ ]`), in order:
    - Initial Setup Completion
    - Wave 1 Completion
    - Wave 2 Completion
    - Wave 3 Completion (and so on)
    - Full Migration Completion
3. Work on the unchecked items in that section ONLY
4. Do NOT mix items from different sections in a single run
5. Mark items as completed (`- [x]`) when done

**Argument parsing**:

1. First argument: Path to MIGRATION.md (required)
2. Second argument (optional): Override default behavior
    - Priority number (e.g., `1.1`, `2.1`)
    - Wave (e.g., `wave 1`, `wave 2`)
    - Component name (e.g., `PathService`, `TocWidget`)
    - If omitted, use default behavior (continue with next incomplete section)

## Important References

Before starting, read these key resources:

- **Migration Guide**: `docs/practices/angularjs/migration-guide.md`
- **AngularJS Adapter**: `Platform/js/Core/Util/AngularJSAdapter.js` (provides `angularizeDirective` and `getService`)
- **React Guidelines**:
    - `docs/practices/react/react-overview.md`
    - `docs/practices/react/jsdoc-type-checking.md`
    - `docs/practices/react/components-qualities.md`
- **Test Rules**:
    - `.github/instructions/cobalt-ai-rules_tests-common.instructions.md`
    - `.github/instructions/cobalt-ai-rules_tests-jest.instructions.md`

---

## Process Overview

1. **Find MIGRATION.md**: Locate the migration plan
2. **Parse the plan**: Extract component info, dependencies, migration strategy
3. **Read source files**: Get current implementation from disk (NOT from MIGRATION.md)
4. **Migrate component**: Create React equivalent following naming conventions
5. **Write tests**: Create Jest tests for the migrated component
6. **Create bridge**: Import the modernized React component in AngularJS module and set up bridge with `angularizeDirective` for hybrid period

---

## Step 1: Read MIGRATION.md

1. Parse the first argument as the path to MIGRATION.md
2. Read the file at the specified path
3. If the file doesn't exist or path is empty, ask the user for the path
4. If the file is not a valid migration plan, inform the user to run `/angularjs-plan` first

```
Example path: Products/WestlawNext/productViews/practicepoint/js/Document/Rulebook/MIGRATION.md
```

---

## Step 1.5: Determine Current Progress

If no specific component/wave is requested, determine what to work on:

1. **Find the Success Criteria section** in MIGRATION.md
2. **Scan each subsection in order** for unchecked items (`- [ ]`):
    - Initial Setup Completion
    - Wave 1 Completion
    - Wave 2 Completion
    - Wave 3 Completion
    - Full Migration Completion
3. **Stop at the first section with unchecked items** - this is what we'll work on
4. **List the unchecked items** to the user and confirm before proceeding
5. **Work ONLY on items from this section** - do not mix sections

**Example output:**

```
Current progress: Initial Setup Completion

Remaining tasks:
- [ ] Entry point `Rulebook.js` created and working
- [ ] Legacy app works with IAC OFF (via entry point)
- [ ] Modernized app works with IAC ON (via entry point)

Proceeding with Initial Setup...
```

---

## Step 2: Parse Migration Plan

Read MIGRATION.md and extract:

### 2.1 Global Context

- **Overview section**: App name, locations, IAC flag, total components
- **Special Notes section**: App-specific considerations (e.g., packages to use, template variants)
- **External Dependencies section**: Platform utilities, third-party libraries
- **Notes section** (at end): Important integration details, existing IAC flags, etc.

### 2.2 Component Information

For the target component(s), extract from the "Detailed Migration Plans" section:

- **Priority**: (e.g., 1.1, 2.1, 3.1)
- **Type**: Service, Controller, Directive, Filter
- **Source File**: Full path to the AngularJS file
- **Target File**: Full path for the new React file
- **Target Test**: Full path for the Jest test file
- **Dependencies**: Internal (other app components) and external (Platform, etc.)
- **Used By**: Components that depend on this one
- **Migration Strategy**: Component, Hook, Provider, or Utils
- **Migration Instructions**: Step-by-step instructions specific to this component
- **Test scenarios to cover**: List of test cases from the plan

### 2.3 For Directives, also extract:

- **Binding Migration table**: AngularJS bindings to React props mapping
- **Bridge Requirements**: Directive name, app module, bindings to register

**CRITICAL**: Use MIGRATION.md for guidance (file paths, strategy, dependencies, instructions), but ALWAYS read the actual source code from disk for implementation details. The Migration Instructions tell you WHAT to do; the source code tells you HOW.

---

## Step 3: Read Source Files

For each component to migrate:

1. Read the source file specified in the migration plan
2. Analyze the current implementation:
    - Functions and methods
    - Dependencies (injected services, imports)
    - For directives: bindings, template, controller logic
    - For services: public API, state management
    - For filters: transformation logic
3. For directives, also read the associated templates:
    - Check the "Templates" section in Component Inventory
    - Read all template variants (e.g., based on IAC flags)
4. Check the "Notes" section for app-specific integration details

## Step 3.5: Follow Migration Instructions

The MIGRATION.md contains detailed, numbered Migration Instructions for each component. Follow these steps:

1. Read through all the Migration Instructions for this component
2. Pay attention to:
    - Specific function/method names to export
    - How to handle each dependency
    - State management approach (useState, useEffect, etc.)
    - Special packages to use (e.g., react-highlight-words)
    - Hooks signature and return values
3. The instructions tell you WHAT the migrated code should do
4. The source code tells you HOW the current implementation works

---

## Step 4: Create React Equivalent

Based on the migration strategy, create the appropriate React file:

### General Principles

**Use Existing Libraries and Packages:**

- **Prefer existing solutions** over custom implementations
- **Check for existing utilities** in lodash, Platform modules, or third-party libraries before writing custom code
- **Review available packages**: Check `package.json` in the project root to see what libraries are already available
- **Benefits**: Reduces bugs, improves maintainability, leverages well-tested code

**Localize all user-facing strings:**

- Never copy hard-coded strings from templates to JSX
- Strings already localized in AngularJS must be properly migrated to React components
- Check the Localization section in MIGRATION.md for the list of strings requiring localization and suggested property keys
- Refer to the `/localize` skill for the full Localizer API, properties file format, and naming conventions

### For Components (from Directives)

Create `{AppName}/Components/{ComponentName}.jsx`:

- Convert template to JSX
- Convert bindings to props
- Convert controller logic to hooks (useState, useEffect, useCallback)
- Handle two-way bindings with controlled components
- Follow React best practices from the guidelines

### For Hooks (from Controllers/Stateful Services)

Create `{AppName}/Hooks/use{HookName}.js`:

- Extract stateful logic
- Return state and handlers
- Use appropriate React hooks
- Handle side effects with useEffect

### For Providers (from Network Services)

Create `{AppName}/Providers/{ProviderName}.js`:

- Convert to async functions
- Replace `$http` with `Platform/js/Core/WebRequest.js`
- Replace `$q` with native Promises
- Export functions for data fetching

### For Utils (from Filters/Pure Services)

Create `{AppName}/Utils/{UtilName}.js`:

- Convert to pure functions
- Export named functions
- No side effects, no state

### Naming Conventions

| Target Folder | Naming Pattern                                   | Example               |
| ------------- | ------------------------------------------------ | --------------------- |
| `Components/` | `{ComponentName}.jsx` (PascalCase)               | `RulebookToc.jsx`     |
| `Hooks/`      | `use{HookName}.js` (camelCase with `use` prefix) | `useRulebookData.js`  |
| `Providers/`  | `{ProviderName}.js` (PascalCase)                 | `RulebookProvider.js` |
| `Utils/`      | `{UtilName}.js` (PascalCase)                     | `PathUtils.js`        |

---

## Step 5: Write Jest Tests

**IMPORTANT**: The MIGRATION.md contains a "Test scenarios to cover" section for each component. Use these scenarios as the basis for your Jest tests.

Create Jest tests at the path specified in **Target Test** field:

### For Components

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentName } from '{AppName}/Components/{ComponentName}.jsx';

describe('{ComponentName}', () => {
    it('should render correctly', () => {
        render(<ComponentName />);
        expect(screen.getByRole('...')).toBeInTheDocument();
    });

    it('should handle user interaction', async () => {
        const user = userEvent.setup();
        const onAction = jest.fn();
        render(<ComponentName onAction={onAction} />);

        await user.click(screen.getByRole('button'));
        expect(onAction).toHaveBeenCalled();
    });
});
```

### For Hooks

```javascript
import { renderHook, act } from '@testing-library/react';
import { useHookName } from '{AppName}/Hooks/use{HookName}.js';

describe('use{HookName}', () => {
    it('should return initial state', () => {
        const { result } = renderHook(() => useHookName());
        expect(result.current.state).toBe(initialValue);
    });

    it('should update state', () => {
        const { result } = renderHook(() => useHookName());
        act(() => {
            result.current.updateState(newValue);
        });
        expect(result.current.state).toBe(newValue);
    });
});
```

### For Providers

```javascript
import { ProviderName } from '{AppName}/Providers/{ProviderName}.js';
import MockWebRequest from 'Platform/tests/Fakes/Core/MockWebRequest.js';

describe('{ProviderName}', () => {
    beforeEach(() => {
        MockWebRequest.mock({
            request: '/api/endpoint',
            response: {
                ResponseText: JSON.stringify({ data: 'test' }),
                StatusCode: 200
            }
        });
    });

    it('should fetch data', async () => {
        const result = await ProviderName.fetchData();
        expect(result).toEqual({ data: 'test' });
    });
});
```

### For Utils

```javascript
import { utilFunction } from '{AppName}/Utils/{UtilName}.js';

describe('{UtilName}', () => {
    it('should transform input correctly', () => {
        expect(utilFunction(input)).toBe(expectedOutput);
    });
});
```

---

## Step 6: Create Bridge for Components (Bridge Period)

For React components that need to work within AngularJS templates during the hybrid period, import the React component and register it in the AngularJS module file:

```javascript
// In the AngularJS module file (e.g., tocDirective.js)
import { angularizeDirective } from 'Platform/js/Core/Util/AngularJSAdapter.js';
import { TocWidget } from '../Components/TocWidget.jsx';

// Register React component as AngularJS directive with service injection
angularizeDirective(
    TocWidget,
    'tocWidget',
    app,
    {
        // bindings if needed
    },
    ['tabViewInstance', 'cobaltWrapper']
);
```

**Service Injection:**

The `angularizeDirective` function supports injecting AngularJS services directly as props to React components:

```javascript
// Inject services as the 5th parameter (array of service names)
angularizeDirective(
    ReactComponent,
    'directiveName',
    app,
    {
        // bindings for attributes/scope
    },
    ['service1', 'service2']
);

// The React component will receive injected services as props:
function ReactComponent({ service1, service2, ...otherProps }) {
    // Use the injected AngularJS services directly
    const data = service1.getData();
    return <div>{data}</div>;
}
```

**Bridge bindings reference:**

```javascript
// Use the SAME directive name as the original to seamlessly replace it
angularizeDirective(
    ComponentName,
    'directiveName',
    app,
    {
        propName: '=', // Two-way binding → value + onChange
        title: '@', // String binding → string prop
        onAction: '&' // Callback binding → function prop
    },
    ['injectedService1', 'injectedService2'] // Services as props
);
```

This approach:

- Keeps the bridge registration close to the AngularJS module
- No need to modify the bundle file
- The React component is loaded when the AngularJS module is loaded
- Services are automatically injected as component props

---

## Step 6.5: Access AngularJS Services from React (Bridge Period)

**PREFERRED METHOD: Use Service Injection (Step 6)**

The preferred way to access AngularJS services from React components is through the service injection feature in `angularizeDirective` (see Step 6). Services are automatically injected as component props.

**ALTERNATIVE METHOD: Use `getService` (Legacy)**

For cases where service injection isn't suitable, you can use `getService` from `Platform/js/Core/Util/AngularJSAdapter.js`.

### When to Use `getService` vs Service Injection

| Method                              | Use When                                                                 | Pros                        | Cons                                  |
| ----------------------------------- | ------------------------------------------------------------------------ | --------------------------- | ------------------------------------- |
| **Service Injection** (Recommended) | Registering React components as AngularJS directives                     | Clean, automatic, type-safe | Only works with `angularizeDirective` |
| **`getService`** (Legacy)           | Custom hooks, complex scenarios, or when not using `angularizeDirective` | Flexible, works anywhere    | Manual, requires error handling       |

### When to Use `getService`

- **Edge cases only**: When service injection via `angularizeDirective` isn't suitable
- **During bridge period only**: When a React component needs data/functionality from an unmigrated AngularJS service
- **Temporary solution**: The AngularJS service should eventually be migrated to React
- **Use sparingly**: Prefer migrating dependencies first (Wave 1 before Wave 2), then service injection, then `getService`.

### Usage Example

```javascript
import { getService } from 'Platform/js/Core/Util/AngularJSAdapter.js';

// Get a service from an AngularJS module
// First parameter: module name (string), NOT the app instance
// Second parameter: service name (string)
const MyService = getService('myApp.module', 'MyService');

// Always check if the service is available (can return null)
if (MyService) {
    const result = MyService.doSomething();
}
```

### `getService` vs `angularizeDirective`

| Function              | Purpose                                       | Parameters                                  |
| --------------------- | --------------------------------------------- | ------------------------------------------- |
| `angularizeDirective` | Embed React component in AngularJS template   | `(Component, directiveName, app, bindings)` |
| `getService`          | Access AngularJS service from React component | `(moduleName, serviceName)`                 |

### Testing with `getService`

When testing React components that use `getService`, mock it in your Jest tests:

```javascript
import { getService } from 'Platform/js/Core/Util/AngularJSAdapter.js';

jest.mock('Platform/js/Core/Util/AngularJSAdapter.js', () => ({
    getService: jest.fn()
}));

describe('MyComponent', () => {
    beforeEach(() => {
        // Mock the service returned by getService
        getService.mockReturnValue({
            doSomething: jest.fn().mockReturnValue('mocked result')
        });
    });

    it('should use the AngularJS service', () => {
        // Your test that renders the component
        expect(getService).toHaveBeenCalledWith('myApp.module', 'MyService');
    });
});
```

### Important Considerations

1. **Module name is a string**: Unlike `angularizeDirective` which takes the app instance, `getService` takes the module name as a string
2. **Injector caching**: The adapter caches injectors per module for performance

---

## AngularJS to React Pattern Reference

### Replacing AngularJS Services

| AngularJS Service  | React Equivalent                          |
| ------------------ | ----------------------------------------- |
| `$http`            | `Platform/js/Core/Net/WebRequest.js`      |
| `$timeout`         | `setTimeout` or `useEffect` with cleanup  |
| `$interval`        | `setInterval` or custom hook with cleanup |
| `$q`               | Native `Promise`                          |
| `$scope.$watch`    | `useEffect` with dependency array         |
| `$scope.$on/$emit` | Context, custom events, or lifted state   |

### Determining the Correct Vertical for WebRequest

When migrating `$http` to `WebRequest`, you must specify a `Vertical`. Follow these steps to determine the correct one:

#### Step 1: Check for HTTP Interceptors

Search for `$httpProvider.interceptors` in the AngularJS app modules:

```javascript
// Example: in {app}.app.js
app.config([
    '$httpProvider',
    function ($httpProvider) {
        $httpProvider.interceptors.push('templateHttpInterceptor');
    }
]);
```

#### Step 2: Analyze Each Interceptor

Read each interceptor to understand what it does:

- **Adds headers only** (e.g., `x-cobalt-pcid` for billing): No vertical routing
- **Sets `x-cobalt-host` header**: Routes to a specific vertical
- **Modifies URL**: May indicate a specific backend service

#### Step 3: Determine the Vertical

**If no vertical-routing interceptor exists** (interceptor only adds headers like `x-cobalt-pcid`):

- Use `Vertical.Website` - requests stay on the **same origin**
- This matches AngularJS `$http` relative path behavior (e.g., `$http.get('/api/data')`)

**If interceptor sets `x-cobalt-host`**:

- Use the corresponding `Vertical.*` constant that matches the host

#### Key Insight: How Verticals Work

The `RequestInterceptor` in `Platform/js/Core/Net/RequestInterceptor.js` handles vertical routing:

```javascript
// From RequestInterceptor.js (line 111)
if (options.cobaltHost && options.cobaltHost !== Vertical.Website) {
    options.headers['x-cobalt-host'] = Vertical.GetHost(options.cobaltHost);
}
```

**`Vertical.Website` is special**: When used, the `x-cobalt-host` header is **NOT** added, so requests stay on the same origin. This replicates the default AngularJS `$http` behavior.

#### Example

```javascript
// AngularJS (original)
$http.get('/rulebook/children/' + params);

// React (migrated) - use Vertical.Website for same-origin requests
import WebRequest from 'Platform/js/Core/Net/WebRequest.js';
import Vertical from 'Platform/js/Core/Vertical.js';

const request = new WebRequest(Vertical.Website, `/rulebook/children/${params}`);
const response = await request.Get();
```

#### Common Verticals

| Vertical               | Use When                                   |
| ---------------------- | ------------------------------------------ |
| `Vertical.Website`     | Same-origin requests (default for `$http`) |
| `Vertical.Document`    | Document-related API calls                 |
| `Vertical.Search`      | Search service calls                       |
| `Vertical.RelatedInfo` | Related information service calls          |

See `Platform/js/Core/Vertical.json` for the full list of available verticals.

### Converting Bindings to Props

| AngularJS Binding | React Prop Pattern                |
| ----------------- | --------------------------------- |
| `'='` (two-way)   | `value` + `onChange` (controlled) |
| `'@'` (string)    | String prop                       |
| `'&'` (callback)  | Callback function prop            |
| `'<'` (one-way)   | Regular prop                      |

### Converting Template Directives

| AngularJS         | React/JSX                                 |
| ----------------- | ----------------------------------------- |
| `ng-repeat`       | `{array.map(item => ...)}`                |
| `ng-if`           | `{condition && <Element />}`              |
| `ng-show/ng-hide` | `style={{ display: condition ? ... }}`    |
| `ng-class`        | `className={condition ? 'class' : ''}`    |
| `ng-click`        | `onClick={handler}`                       |
| `ng-model`        | `value={state} onChange={handler}`        |
| `ng-bind`         | `{value}`                                 |
| `ng-bind-html`    | `dangerouslySetInnerHTML` (use carefully) |

---

## Step 7: Verify Dependencies Before Migration

Before migrating a component, check that its dependencies are migrated:

1. Look at the **Dependencies** field in the component's migration plan
2. For each internal dependency (other app components):
    - Check if the target file exists (e.g., `Utils/PathUtils.js`)
    - If not, migrate that dependency first (Wave 1 before Wave 2)
3. For external dependencies:
    - Platform utilities: Import directly, no migration needed
    - AngularJS services: Will be replaced during migration
    - Third-party libraries: Check if available in package.json

**Wave Order Matters**: Always migrate Wave 1 (leaf nodes) before Wave 2, and Wave 2 before Wave 3.

---

## Step 8: Code Review

Before marking a component as complete, perform a self-review and request human review.

### 8.1 Self-Review Checklist

Review the migrated code against these quality criteria:

**Code Quality**:

- [ ] No unused imports or variables
- [ ] No console.log statements left behind
- [ ] Consistent naming conventions (PascalCase for components, camelCase for functions/variables)
- [ ] No hardcoded values that should be props or constants

**Localization (i18n)**:

- [ ] No hard-coded user-facing strings in JSX (labels, messages, tooltips, aria attributes, placeholders)
- [ ] All user-facing strings should be localized, refer to the `/localize` skill
- [ ] Localizer calls should be extracted into variables for readability
- [ ] Properties file updated with new keys and matching default values

**React Patterns**:

- [ ] Hooks follow Rules of Hooks (no conditional hooks, proper dependency arrays)
- [ ] useEffect cleanup functions where needed (event listeners, timers, subscriptions)
- [ ] No direct DOM manipulation (use refs if necessary)
- [ ] Controlled components for form inputs

**Security**:

- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] No user input directly in URLs or queries without validation
- [ ] No sensitive data exposed in props or state

**Accessibility**:

- [ ] Interactive elements are keyboard accessible
- [ ] Proper ARIA attributes where needed
- [ ] Meaningful labels for form inputs
- [ ] Focus management for dynamic content

**Performance**:

- [ ] No unnecessary re-renders (useCallback/useMemo where appropriate)
- [ ] No expensive computations in render

### 8.2 Request Human Review

After self-review, inform the developer that human review is recommended:

> **Human Review Recommended**: The following files have been created/modified and should be reviewed before proceeding:
>
> - `{list of created/modified files}`
>
> Please review the code and let me know if any changes are needed before I mark this component as complete.

Wait for developer approval before proceeding to update Success Criteria.

---

## Step 9: Update Success Criteria

**Mark items as completed immediately after each task is done:**

1. After completing each task, update MIGRATION.md immediately
2. Change `- [ ]` to `- [x]` for the completed item
3. Example: `- [ ] PathUtils.js created and tested` → `- [x] PathUtils.js created and tested`

**For Initial Setup Completion:**

- Mark each item as you complete it (entry point, legacy app test, etc.)

**For Wave Completion:**

- Mark the specific component item when its migration and tests are done
- Only mark "All Wave N Jest tests pass" after running tests

**For Full Migration Completion:**

- These items are checked at the very end of the migration

**IMPORTANT**: Do NOT proceed to the next section until all items in the current section are marked as completed.

---

## Checklist Before Completing

For each migrated component, verify:

- [ ] React file created with correct naming convention
- [ ] All dependencies handled (internal and external)
- [ ] Props correctly typed with JSDoc
- [ ] Bridge registered in AngularJS module with `angularizeDirective` (if needed)
- [ ] Jest tests created and cover all scenarios from migration plan
- [ ] No AngularJS-specific code remains in the React file
- [ ] All user-facing strings localized (no hard-coded strings in JSX)
- [ ] Success Criteria checkbox updated in MIGRATION.md

---

## Reminders

1. **Follow Success Criteria order** - Complete Initial Setup before Wave 1, Wave 1 before Wave 2, etc.
2. **One section at a time** - Do NOT mix items from different Success Criteria sections
3. **Mark items as completed immediately** - Update `- [ ]` to `- [x]` right after completing each task
4. **ALWAYS read source code from disk** - Never rely on code snippets in MIGRATION.md
5. **MIGRATION.md location** - MIGRATION.md should ONLY exist in `{AppName}/` (modernized app), NOT in `{AppName}Legacy/`
6. **Entry point timing** - External modules use static import to entry point; entry point registers handlers first, then uses dynamic import inside to avoid race conditions
7. **Follow the Migration Instructions** - Each component has step-by-step instructions in the plan
8. **Use test scenarios from the plan** - The "Test scenarios to cover" section lists what to test
9. **Follow naming conventions** - PascalCase for Components/Providers/Utils, `use` prefix for Hooks
10. **Create bridge for hybrid period** - Import React component and use `angularizeDirective` to create bridge for hybrid period
11. **Handle all dependencies** - Replace AngularJS services with React equivalents
12. **Read the Notes section** - Contains important app-specific integration details
13. **One component at a time** - Complete migration fully before moving to next
14. **Do not directly use `fetch()`** - Use Platform/js/Core/Net/WebRequest.js instead. Use the data-fetching skill for more details
15. **Use existing packages and libraries** - Check `package.json` in the project root and prefer existing libraries over custom implementations
16. **Localize all user-facing strings** - Never copy hard-coded strings from AngularJS templates to JSX. See the `/localize` skill for details
