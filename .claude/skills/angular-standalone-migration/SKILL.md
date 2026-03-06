---
name: angular-standalone-migration
description: Migration Angular applications from a module based configuration to a modern standalone component configuration.
disable-model-invocation: true
argument-hint: <path-to-main.ts> [application entry point]
---

# Angular Standalone Migration

These instructions guide manual adjustments required after running the `ng generate @angular/core:standalone` codemod. The codemod handles most conversions, but certain patterns require manual fixes.

**Arguments**: $ARGUMENTS

The argument to this skill is the path to the main.ts file that serves as the Angular applications entry point.

**Usage Example**:

- `/angular-standalone-migration Products/WestlawNext/ts/shared-app/main.ts` - Run standalone migration on shared-app in Westlaw

## Angular 19 Standalone Default Behavior

**Important:** In Angular 19, `standalone: true` is the default for components, directives, and pipes. This means:

- New components without a `standalone` property are automatically standalone
- You can omit `standalone: true` entirely - it's implied by default

## When to Apply

Apply these rules when:

- Migrating Angular modules to standalone components
- Fixing errors after running the Angular standalone codemod
- Converting `platformBrowserDynamic().bootstrapModule()` to `bootstrapApplication()`

## Required Post-Codemod Adjustments

### 1. Convert `standalone: false` to Standalone Components

Components with `standalone: false` are NgModule-based and need to be converted to standalone. In Angular 19, simply removing `standalone: false` makes the component standalone by default.

```typescript
// Before - NgModule-based component
@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    standalone: false
})
export class HeaderComponent {}

// After - Standalone component (Angular 19+)
@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    imports: [CommonModule] // Add required imports
})
export class HeaderComponent {}
```

**Steps to convert:**

1. Remove `standalone: false` (component becomes standalone by default in Angular 19)
2. Add `imports` array with required dependencies (CommonModule, pipes, directives, child components)
3. Remove the component from its NgModule's `declarations` array
4. If the component was exported from the NgModule, remove it from `exports` as well

**Note:** In Angular 19, omitting the `standalone` property defaults to `standalone: true`. There is no need to explicitly add `standalone: true`.

### 2. Replace BrowserModule with CommonModule in Feature Modules

When using `bootstrapApplication()`, `BrowserModule` providers are already included. Feature modules must use `CommonModule` instead.

```typescript
// Before
import { BrowserModule } from '@angular/platform-browser';

@NgModule({
    imports: [BrowserModule, CommonModule, HttpClientModule],
    // ...
})

// After
import { CommonModule } from '@angular/common';

@NgModule({
    imports: [CommonModule, HttpClientModule],
    // ...
})
```

**Error if not fixed**:

```
ERROR RuntimeError: NG05100: Providers from the `BrowserModule` have already been loaded.
```

### 3. Fix Component Selector Collisions

Standalone components generate unique IDs based on selectors. Duplicate selectors cause NG0912 errors.

```
NG0912: Component ID generation collision detected. Components 'HtmlComponent' and 'HtmlComponent' with selector 'fb-html-component' generated the same component ID.
```

**Fix**: Rename one component's selector to be unique.

```typescript
// Before - two components with same selector
@Component({ selector: 'fb-html-component', ... })

// After - rename one to be unique
@Component({ selector: 'fb-bsi-html-component', ... })
```

**Remember**: Update all template usages of the renamed selector.

### 4. Fix Track Expressions in @for Loops

The `track` expression should use a unique identifier, not the object itself.

```html
<!-- Before - causes NG0956 warning -->
@for (group of groups; track group) {
<fb-group [group]="group"></fb-group>
}

<!-- After - use unique property -->
@for (group of groups; track group.name) {
<fb-group [group]="group"></fb-group>
}
```

**Warning if not fixed**:

```
NG0956: The configured tracking expression (track by identity) caused re-creation of the entire collection.
```

### 5. Fix ExpressionChangedAfterItHasBeenCheckedError (NG0100)

Standalone bootstrap can surface timing issues with async data loading.

```typescript
// Before - may cause NG0100 in standalone mode
this.dataService.getData().subscribe(data => {
    this.data = data;
    this.isLoaded = true;
});

// After - trigger change detection after async updates
import { ChangeDetectorRef } from '@angular/core';

constructor(private cdr: ChangeDetectorRef) {}

this.dataService.getData().subscribe(data => {
    this.data = data;
    this.isLoaded = true;
    this.cdr.detectChanges();
});
```

### 6. Update Tests for Standalone Components

Standalone components simplify testing - no need to import the component into TestBed.

```typescript
// Before - NgModule style testing
beforeEach(() => {
    fixture = TestBed.configureTestingModule({
        imports: [MyComponent, CommonModule], // Component in imports
        providers: [MyService]
    }).createComponent(MyComponent);
});

// After - Standalone component testing (simplified)
beforeEach(() => {
    TestBed.configureTestingModule({
        providers: [MyService] // Only providers needed
    });

    fixture = TestBed.createComponent(MyComponent);
});
```

**For simple components with no dependencies**, skip `configureTestingModule` entirely:

```typescript
// Simplest form - no configureTestingModule needed
beforeEach(() => {
    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
});
```

**`configureTestingModule` is required when:**

- The component has dependencies that need to be injected (services, tokens)
- The component uses child components that need to be compiled
- The component requires providers to be configured (mocking services, providing values)
- The component uses Angular features like routing, forms, or HTTP
- The component needs template compilation and change detection testing

**Setting inputs** - Use `setInput()` instead of direct property assignment:

```typescript
// Before
component.myInput = 'value';
fixture.detectChanges();

// After - signal-friendly approach (Angular 17.3+)
fixture.componentRef.setInput('myInput', 'value');
await fixture.whenStable();
```

**Key points:**

- Standalone components are self-contained - no need to import them into TestBed
- Use `setInput()` for setting inputs (works with signals)
- Use `fixture.whenStable()` for async operations

### 7. Update main.ts Bootstrap Pattern

Convert from NgModule bootstrap to standalone bootstrap.

**Note:** We have a custom webpack configuration that swaps bootstrap files for production builds. Ensure both `bootstrap.ts` and `bootstrap.prod.ts` are updated.

```typescript
// Before
// main.ts
import bootstrap from './bootstrap';
import { AppModule } from './app.module';

export const runApp = (): void => {
    bootstrap(AppModule);
};

// bootstrap.ts
import '@angular/compiler';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import type { NgModuleRef, Type } from '@angular/core';

export default function bootstrap<M>(module: Type<M>): Promise<NgModuleRef<M>> {
    return platformBrowserDynamic().bootstrapModule(module);
}

// bootstrap.prod.ts
import { enableProdMode } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
import type { NgModuleRef, Type } from '@angular/core';

export default function bootstrap<M>(module: Type<M>): Promise<NgModuleRef<M>> {
    enableProdMode();
    return platformBrowser().bootstrapModule(module);
}

// After
// main.ts
import bootstrap from './bootstrap';
import { importProvidersFrom } from '@angular/core';
import { AppComponent } from './components/app.component';
import { FormsModule } from '@angular/forms';

export const runApp = (): void => {
    bootstrap(AppComponent, {
        providers: [importProvidersFrom(FormsModule)]
    });
};

// bootstrap.ts
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import type { NgModuleRef, Type, ApplicationRef, ApplicationConfig, BootstrapContext } from '@angular/core';

export default function bootstrap(
    component: Type<unknown>,
    options?: ApplicationConfig,
    context?: BootstrapContext
): Promise<ApplicationRef> {
    return bootstrapApplication(component, options, context);
}

// bootstrap.prod.ts
import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import type { NgModuleRef, Type, ApplicationRef, ApplicationConfig, BootstrapContext } from '@angular/core';

export default function bootstrap(
    component: Type<unknown>,
    options?: ApplicationConfig,
    context?: BootstrapContext
): Promise<ApplicationRef> {
    enableProdMode();
    return bootstrapApplication(component, options, context);
}
```
