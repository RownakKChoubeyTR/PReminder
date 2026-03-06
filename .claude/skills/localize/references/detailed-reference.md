# Localize - Detailed Reference

## Fallback Rules

### Locale Resolution Order

When loading properties for locale `fr-CA`, the system resolves in this order:

1. Product View + locale (`fr-CA`)
2. Product View + language (`fr`)
3. Product View + default
4. Product + locale (`fr-CA`)
5. Product + language (`fr`)
6. Product + default
7. Platform + locale (`fr-CA`)
8. Platform + language (`fr`)
9. Platform + default

Lower levels (Product View) override higher levels (Platform). This means a Product View can override a Product key, which can override a Platform key.

### Default Locale Configuration

Products can specify default locales in `{product}/js/LocalizationResources/localization.json`:

```json
{
    "defaultLocales": ["en-US", "en-GB"]
}
```

When `en-GB` is listed as a default locale, the base `Messages.js` (without locale suffix) serves for both `en-US` and `en-GB`.

## Localization Contexts

### Available Contexts

Defined in `Platform/js/Localized/localization-contexts.json`:

```json
["Indigo", "IndigoPremium", "IndigoPremiumF1", "WLAU", "WLNZ", "PLCAU", "FolderRedesign"]
```

### How Context Overrides Work

The runtime context comes from `window['Server/Configuration'].LocalizerContext`.

When looking up `SC.Website.NotificationCenter.Title` with context `IndigoPremium`:

1. First tries: `SC.Website.NotificationCenter.IndigoPremium.Title`
2. Falls back to: `SC.Website.NotificationCenter.Title`

The context suffix is inserted **before the last segment** of the key.

### Adding Context Overrides

```properties
# Base key (in Website.properties)
SC.Website.NotificationCenter.Title=Notifications

# Context-specific override (in same file)
SC.Website.NotificationCenter.IndigoPremium.Title=My Notifications
```

## Validation Rules

### ESLint Rules (Automatic)

**`Localizer.lookup()`:**

- Must have exactly 2 arguments
- Second argument (defaultValue) cannot be empty string

**`Localizer.format()`:**

- Must have exactly 3 arguments
- Second argument must be a non-empty object (not null/undefined)
- Third argument must be a template literal with expressions
- Number of object properties must equal number of template expressions

**`Localizer.renderDate()`:**

- Must have at least 2 arguments

### Extended Validation (via `yarn run-lint`)

**Undefined properties:** Properties used in code but not defined in .properties files.

**Unused properties:** Properties defined in files but never referenced in code.

**Inconsistent defaults:** Default value in `Localizer.lookup()` doesn't match the value in the .properties file. Whitespace differences also fail.

**Dynamic keys:** Warning for dynamically constructed keys like:

```javascript
// Triggers warning - prefer static keys
const key = 'SC.Alerts.' + propertyName;
Localizer.lookup(key, 'Default Value');
```

### Property Key Format Rules

- Minimum 3 parts: `SC.<Context>.<KeyName>`
- First part must be `SC`
- Context must match the filename of the properties file
- No duplicate keys within a single file
- Child domain (Product/ProductView) properties must have different values than parent

## FloatingPointStyle API

```javascript
import FloatingPointStyle from 'Platform/js/Localized/FloatingPointStyle.js';

const style = FloatingPointStyle.builder()
    .fractionDigits(2) // Number of decimal places (default: 0)
    .grouped(true) // Thousands separator (default: true)
    .roundingMode('halfUp') // Rounding mode (default: 'halfUp')
    .build();

Localizer.renderFloatingPoint(1234.56, style); // "1,234.56" in en-US
Localizer.renderCurrency(1234.56, style, '$'); // "$1,234.56" in en-US
Localizer.renderPercentage(0.856, style); // "85.60%" in en-US
```

## Pseudo-Localization

- Auto-generated `*.xx.properties` files for testing
- Validates that all strings are properly internationalized
- Files starting with `Config.` are NOT pseudolocalized (they contain patterns, URLs, technical strings)
- Do NOT commit pseudo-localized files

## Properties File Organization by Level

### Platform Properties

Shared strings used across all products. Located in `Platform/js/LocalizationResources/`.

Some existing files:

- `Core.properties` - Core UI widgets, pagination, sidebar, progress indicators
- `Website.properties` - Website-level UI, navigation, headers
- `Search.properties` - Search functionality
- `Document.properties` - Document viewing
- `Alerts.properties` - Alert center and management
- `Browse.properties` - Browse/TOC functionality
- `Foldering.properties` - Folder management
- `Report.properties` - Reporting features
- `Config.Date.properties` - Date/time format patterns
- `Config.Website.properties` - Website configuration patterns
- `Config.Document.properties` - Document configuration patterns

### Product Properties

Product-specific strings and overrides of Platform strings. Located in `Products/<Product>/js/LocalizationResources/`.

### Product View Properties

Most specific overrides. Located in `Products/<Product>/productViews/<PV>/js/LocalizationResources/`.

## Active Localization Workflow (Step-by-Step)

When running `/localize <path>`:

1. **Read target files** - Identify all files in the specified path
2. **Scan for hard-coded strings** - Look for:
    - String literals in `textContent`, `innerText`, `innerHTML` assignments
    - JSX text content and string props (`title`, `aria-label`, `placeholder`, `alt`)
    - Template literals with user-facing text
    - Concatenated strings displayed to users
3. **Skip non-user-facing strings** - Ignore:
    - Log messages, CSS classes, API paths, test data
    - Strings already using Localizer
    - Configuration values and internal identifiers
4. **Determine properties file** - Match module path to the correct file
5. **Generate property keys** - Follow `SC.<FileContext>.<Feature>.<Component>.<KeyName>` convention
6. **Add to .properties file** - Include descriptive comment above each entry
7. **Update source code** - Replace hard-coded strings with Localizer calls
8. **Handle edge cases**:
    - Parameterized strings: use `Localizer.format()` with template literal default
    - React mixed content: use `<Localize>` component
    - Numbers: use `Localizer.renderInteger()` or `Localizer.renderFloatingPoint()`
    - Dates: use `Localizer.renderDate()` with appropriate style key
9. **Suggest running validation** - Recommend `yarn run-lint` to verify

## Common Mistakes to Avoid

### String Concatenation

```javascript
// BAD - concatenation breaks localization
const msg = 'Hello ' + name + ', you have ' + count + ' items';

// GOOD - parameterized format
const msg = Localizer.format('SC.Website.Greeting', { name, count }, `Hello ${name}, you have ${count} items`);
```

### Empty Default Values

```javascript
// BAD - ESLint will fail
Localizer.lookup('SC.Core.Label', '');

// GOOD - always provide meaningful default
Localizer.lookup('SC.Core.Label', 'Label');
```

### Localizer in Tests

```javascript
// BAD - tests should not depend on Localizer
expect(element.textContent).toBe(Localizer.lookup('SC.Key', 'Close'));

// GOOD - use the raw string
expect(element.textContent).toBe('Close');
```

### Dynamic Key Construction

```javascript
// BAD - validation cannot verify dynamic keys
const key = `SC.Alerts.${type}.Title`;
Localizer.lookup(key, 'Title');

// GOOD - use static keys with explicit branches
const title =
    type === 'email'
        ? Localizer.lookup('SC.Alerts.Email.Title', 'Email Alert')
        : Localizer.lookup('SC.Alerts.Push.Title', 'Push Alert');
```

### Mismatched Parameters

```javascript
// BAD - param count mismatch (ESLint error)
Localizer.format('SC.Key', { a, b }, `${a} and ${b} and ${c}`);

// GOOD - params and template expressions match
Localizer.format('SC.Key', { a, b, c }, `${a} and ${b} and ${c}`);
```
