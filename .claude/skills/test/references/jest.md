# Jest Testing Reference

**Applies to**: `**/Jest/**/*.test.jsx`, `**/Jest/**/*.test.js`

## Global Configuration

### Jest Base Config

Location: `utils/jest/base.config.js`

Tests should respect the base Jest config and avoid adding redundant per-file setups/teardowns.
Key settings:

- `restoreMocks: true` - Automatically restore mock state and implementation before every test.
  Equivalent to calling `jest.restoreAllMocks()` before each test.
  This will lead to any mocks created with `jest.spyOn()` having their fake implementations removed and restores their initial implementation.

### Global Hooks

Location: `Platform/tests/TestHelpers/jest-hooks.js`

The setup automatically:

- Enforces `jest-fail-on-console` (warn/error fail the test)
- Runs `@testing-library/react` `cleanup()` automatically in `afterEach`
- Calls `restore()` and resets `MockHub`, `MockUserPreference`, and `MockWebRequest` in `afterEach`
- Stubs `lodash.uniqueId` and `underscore.uniqueId` with deterministic implementations in `beforeEach`

## Isolating/Sandboxing With Jest Built-ins

Prefer Jest's built-ins over Sinon in Jest tests.

### Spies

**Use `jest.spyOn()` for mocking object methods** - the `restoreMocks: true` config automatically restores them:

```javascript
// CORRECT - automatically restored by config
const spy = jest.spyOn(Math, 'max').mockReturnValue(42);
expect(Math.max(1, 2)).toBe(42);
expect(spy).toHaveBeenCalledWith(1, 2);
// No need to call spy.mockRestore() - handled automatically
```

### Mocks (functions)

```javascript
const onClick = jest.fn();
onClick('a');
expect(onClick).toHaveBeenCalledTimes(1);
expect(onClick).toHaveBeenCalledWith('a');
```

### Fake timers

```javascript
test('advances timers deterministically', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    setTimeout(fn, 1000);
    jest.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalled();
});
```

## Testing Library

See [Testing Library recommendations](/docs/testing/testing-library).

**Query priority** (most to least preferred):

1. `getByRole` - accessible queries
2. `getByLabelText` - form elements
3. `getByText` - visible text
4. `data-testid` - last resort

**Best practices**:

- Use `@testing-library/user-event` over `fireEvent` for realistic input
- Use `findBy*` or `waitFor` for async updates; avoid manual timeouts
- Use the `wrapper` render option to supply required contexts/providers
- Pass a `container` to `render` when elements require specific parents (e.g., `tbody` in `table`, `rect` in `svg`)
- Keep snapshots small and focused; avoid huge snapshots
- Avoid mocking child components by default; if necessary, use `MockReactComponent` to validate props

### Fake timers with user-event

If opting into fake timers, wire `advanceTimers` for `user-event`:

```javascript
jest.useFakeTimers();
const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
```

## waitFor Helper

Import from: `@testing-library/react`

```typescript
function waitFor<T>(
    callback: () => T | Promise<T>,
    options?: {
        container?: HTMLElement;
        timeout?: number;
        interval?: number;
        onTimeout?: (error: Error) => Error;
        mutationObserverOptions?: MutationObserverInit;
    }
): Promise<T>;
```

### Examples

```javascript
import { waitFor } from '@testing-library/react';

// Wait for a function to be called
await waitFor(() => expect(mockAPI).toHaveBeenCalledTimes(1));

// Wait for an element to have a class
await waitFor(() => expect(container.querySelector('button')).toHaveClass('ready'));
```

## Console Output

`jest-fail-on-console` is active. Avoid `console.warn`/`console.error` in Jest tests.

When validating logging, stub a logger or use spies instead of console.

## Dependency Injection

Use `jest.mock` to mock module dependencies:

```javascript
jest.mock('path/to/your/module', () => ({
    someExportedFunction: jest.fn(() => 'mocked value'),
    anotherExport: jest.fn()
}));
```

## New Jest Test Template

When creating a new Jest test file for a React component:

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComponentUnderTest from '<path-to-component>';

// Mock dependencies as needed
jest.mock('<dependency-path>', () => ({
    dependency: jest.fn()
}));

describe('ComponentUnderTest', () => {
    // Common test setup
    const defaultProps = {
        // minimal required props
    };

    function renderComponent(props = {}) {
        return render(<ComponentUnderTest {...defaultProps} {...props} />);
    }

    it('renders with default props', () => {
        renderComponent();
        expect(screen.getByRole('<role>')).toBeInTheDocument();
    });

    it('handles user interaction', async () => {
        const user = userEvent.setup();
        const onAction = jest.fn();
        renderComponent({ onAction });

        await user.click(screen.getByRole('button', { name: /action/i }));

        expect(onAction).toHaveBeenCalledTimes(1);
    });
});
```

When creating a new Jest test file for a plain module:

```javascript
import { functionA, functionB } from '<path-to-module>';

// Mock dependencies as needed
jest.mock('<dependency-path>', () => ({
    dependency: jest.fn()
}));

describe('ModuleName', () => {
    describe('functionA', () => {
        it('returns expected result for valid input', () => {
            const result = functionA('input');
            expect(result).toBe('expected');
        });

        it('handles edge case', () => {
            const result = functionA(null);
            expect(result).toBeNull();
        });
    });

    describe('functionB', () => {
        it('calls dependency with correct args', () => {
            functionB('arg');
            expect(dependency).toHaveBeenCalledWith('arg');
        });
    });
});
```
