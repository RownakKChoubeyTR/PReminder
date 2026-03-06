# Karma Testing Reference (Jasmine & QUnit)

**Applies to**: `**/Jasmine/**/*.test.js`, `**/QUnit/**/*.test.js`, `**/*.spec.ts`

## Global Hooks (Do NOT Duplicate)

### Karma hooks: `Platform/tests/TestHelpers/karma-hooks.js`

- Enables `sinon.useFakeTimers(Date.now())` globally
- Stubs `lodash.uniqueId` and `underscore.uniqueId` to deterministic implementations
- Rewires `WebRequest` to `Platform/tests/Fakes/Core/MockWebRequest.js`
- Replaces `UXEvents.postUXEvent/postPageEvent/postRestEvent` with fakes
- Removes document/window/body event listeners, clears `localStorage` and `sessionStorage`

### QUnit hooks: `Platform/tests/TestHelpers/qunit-hooks.js`

Includes everything in Karma hooks plus:

- Sets `QUnit.config.testTimeout = 1000`
- Wires `testStart(before)` / `testDone(after)` through Karma hooks
- Cleans stray `body` children and flushes a microtask via `setTimeout(0)` in `moduleDone`

## Isolating/Sandboxing With Sinon

Use a Sinon sandbox and always restore it.

### Jasmine

```javascript
const sandbox = sinon.createSandbox();

describe('MyModule', () => {
    afterEach(() => {
        sandbox.restore();
    });
});
```

### QUnit

```javascript
const sandbox = sinon.createSandbox();

QUnit.module('MyModule', {
    afterEach: function () {
        sandbox.restore();
    }
});
```

## waitFor Helper

Import from: `Platform/tests/TestHelpers/async-helpers.js`

Purpose: repeatedly checks a condition until it becomes truthy or times out.

Signature: `await waitFor(async () => booleanLike, count?)`

### Examples

```javascript
import { waitFor } from 'Platform/tests/TestHelpers/async-helpers.js';

// Wait for an element to exist
await waitFor(() => document.getElementById('testId'));

// Wait for a spy to be called
await waitFor(() => spy.calledOnce);
```

## QUnit: DOM and Fixtures

Manipulate elements inside `#qunit-fixture` so the DOM resets automatically.

```javascript
const fixture = document.getElementById('qunit-fixture');
fixture.innerHTML = '<div id="host"></div>';
```

## Dependency Injection

See [Dependency Injection](/docs/testing/dependency-injection).

Use `Platform/tests/di/ModuleInjector.js` to stub module exports:

```javascript
import * as SomeModule from 'Platform/js/Core/SomeModule.js';
import { rewire } from 'Platform/tests/di/ModuleInjector.js';

// Default export
rewire(SomeModule, sinon.stub().returns('x'));

// Named export
rewire(SomeModule, 'compute', sinon.stub().returns(42));
```

No need to call `restore()` in `afterEach`; hooks restore automatically.

## Timers

Sinon clock is already active via hooks. Advance deterministically:

```javascript
sinon.clock.tick(500);
```

## New Jasmine Test Template

```javascript
import ModuleUnderTest from '<path-to-module>';
import Dependency from '<path-to-dependency>';

describe('ModuleUnderTest', () => {
    it('does expected behavior', () => {
        const result = ModuleUnderTest.method();
        expect(result).toBe('expected');
    });

    it('handles dependency interaction', () => {
        spyOn(Dependency, 'method');
        ModuleUnderTest.doSomething();
        expect(Dependency.method).toHaveBeenCalledTimes(1);
    });
});
```

Note: Jasmine's built-in `spyOn()` auto-restores between tests, so no sinon sandbox is required.

## New QUnit Test Template

```javascript
import ModuleUnderTest from '<path-to-module>';

const sandbox = sinon.createSandbox();

QUnit.module('ModuleUnderTest', {
    afterEach: function () {
        sandbox.restore();
    }
});

QUnit.test('does expected behavior', function (assert) {
    const result = ModuleUnderTest.method();
    assert.equal(result, 'expected', 'returns expected value');
});

QUnit.test('handles dependency interaction', function (assert) {
    const spy = sandbox.spy(Dependency, 'method');
    ModuleUnderTest.doSomething();
    assert.ok(spy.calledOnce, 'dependency method called once');
});
```
