---
name: localize
description: Internationalization (i18n) and localization (l10n) for Cobalt Static Content. Use when localizing modules, adding user-facing strings, formatting numbers/dates, working with .properties files, or developing features that display text to users. Supports both active localization of existing code and passive guidance during new development, refactoring, or code reviews to ensure proper localization practices are followed.
argument-hint: <path-to-module-or-directory-to-localize>
---

# Localize

Handles internationalization (i18n) and localization in Cobalt Static Content using the `Localizer.js` API, `Localize.jsx` component, and `.properties` files.

## Quick Start

**Active mode** (localize existing code):

```
/localize Platform/js/Website/Widgets/MyWidget.js
```

**Passive mode** (automatically applied during development when user-facing strings are involved).

## Instructions

### Active Scenario: Localize a Module

When invoked with a path argument, scan the specified file(s) for hard-coded user-facing strings and localize them:

1. **Read the target file(s)** at the specified path
2. **Identify hard-coded user-facing strings** - text displayed in the UI (labels, messages, tooltips, aria attributes, placeholder text, error messages)
3. **Determine the correct properties file** based on the module's location and feature area
4. **Generate property keys** following the naming convention: `SC.<FileContext>.<Feature>.<Component>.<KeyName>`
5. **Add entries to the appropriate .properties file** with comments describing each string
6. **Replace hard-coded strings** in the source code with `Localizer.lookup()` or `Localizer.format()` calls
7. **Handle React mixed content (interpolation)** using `<Localize>` component where JSX is embedded in text
8. **Verify** no user-facing strings remain hard-coded

### Passive Scenario: Guide During Development

When working on new features or refactoring, ensure:

- All new user-facing strings use `Localizer.lookup()` or `Localizer.format()`
- Numbers displayed to users use `Localizer.renderInteger()` or `Localizer.renderFloatingPoint()`
- Dates displayed to users use `Localizer.renderDate()`, `Localizer.renderTime()`, or `Localizer.renderDateTime()`
- React components with mixed text/JSX use `<Localize>` component
- Properties files are updated with new keys
- No string concatenation is used for user-facing text

## Localizer API

### Strings

```javascript
import Localizer from 'Platform/js/Localized/Localizer.js';

// Simple lookup
Localizer.lookup('SC.Core.Widget.Lightbox.Close', 'Close');

// Parameterized format (interpolation) - default value MUST be a template literal with expressions
Localizer.format('SC.Website.ErrorMessage', { userName, count }, `User ${userName} has ${count} items`);
```

Corresponding properties entries:

```properties
# Core.properties
SC.Core.Widget.Lightbox.Close=Close

# Website.properties
SC.Website.ErrorMessage=User {userName} has {count} items
```

### Numbers

```javascript
Localizer.renderInteger(1234567); // "1,234,567" in en-US
Localizer.renderFloatingPoint(1234.56, style);
Localizer.renderCurrency(amount, style, '$');
Localizer.renderPercentage(0.85, style);
```

For custom number formatting, use `FloatingPointStyle`:

```javascript
import FloatingPointStyle from 'Platform/js/Localized/FloatingPointStyle.js';

const style = FloatingPointStyle.builder().fractionDigits(2).build();
Localizer.renderFloatingPoint(1234.56, style);
```

### Dates

```javascript
Localizer.renderDate(date, 'SC.Config.Date.ShortDate', 'M/d/yyyy');
Localizer.renderTime(date, 'SC.Config.Date.Core.ShortTime', 'h:mm a');
Localizer.renderDateTime(date, 'SC.Config.Date.Core.ShortDateTime', 'M/d/yyyy h:mm a');
```

Corresponding properties entries (in `Config.Date.properties`):

```properties
SC.Config.Date.ShortDate=M/d/yyyy
SC.Config.Date.Core.ShortTime=h:mm a
SC.Config.Date.Core.ShortDateTime=M/d/yyyy h:mm a
```

### React Mixed Content (Localize component)

When localized text contains JSX elements (links, bold, etc.):

```jsx
import Localizer from 'Platform/js/Localized/Localizer.js';
import Localize from 'Platform/js/Indigo/Core/Components/Localize.jsx';

const helpLabel = Localizer.lookup('SC.Report.Message.HelpLink', 'Help');
const supportLabel = Localizer.lookup('SC.Report.Message.SupportLink', 'Support');

<Localize
    format="SC.Report.Message.WithLinks"
    link1={<a href="/help">{helpLabel}</a>}
    link2={<a href="/support">{supportLabel}</a>}
>
    {'Get help from {link1} or contact {link2} for assistance'}
</Localize>;
```

Corresponding properties entries:

```properties
# Report.properties
SC.Report.Message.WithLinks=Get help from {link1} or contact {link2} for assistance
SC.Report.Message.HelpLink=Help
SC.Report.Message.SupportLink=Support
```

## Properties Files

### File Locations

| Level        | Path                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| Platform     | `Platform/js/LocalizationResources/<Context>.properties`                             |
| Product      | `Products/<Product>/js/LocalizationResources/<Context>.properties`                   |
| Product View | `Products/<Product>/productViews/<PV>/js/LocalizationResources/<Context>.properties` |

### Key Naming Convention

```
SC.<FileContext>.<Feature>.<Component>.<KeyName>=value
```

- **SC** prefix is always required
- **FileContext** must match the properties filename (e.g., keys in `Alerts.properties` start with `SC.Alerts.`)
- **KeyName** uses PascalCase

### Properties File Format

```properties
# Comment describing the string's purpose
SC.Alerts.Center.Edit.Alert=Edit Alert

# Parameterized string (curly braces for parameters)
SC.Core.Widgets.MenuButton.Selected.AriaLabel={name}: {value}

# Multi-line value (backslash continuation)
SC.Website.LongMessage=This is line 1. \
                        This is line 2.
```

### Choosing the Right Properties File

Match the feature area of the module being localized:

| Module Path Contains | Properties File        | Key Prefix      |
| -------------------- | ---------------------- | --------------- |
| Core/                | `Core.properties`      | `SC.Core.`      |
| Website/             | `Website.properties`   | `SC.Website.`   |
| Search/              | `Search.properties`    | `SC.Search.`    |
| Alerts/              | `Alerts.properties`    | `SC.Alerts.`    |
| Document/            | `Document.properties`  | `SC.Document.`  |
| Browse/              | `Browse.properties`    | `SC.Browse.`    |
| Foldering/           | `Foldering.properties` | `SC.Foldering.` |
| Report/              | `Report.properties`    | `SC.Report.`    |

For date/time patterns, and other config values, use `Config.*.properties`,
e.g. for date/time use `Config.Date.properties` with prefix `SC.Config.Date.`.

For new, relatively large and isolated features, you can create a **new properties file** (e.g., `MyFeature.properties` with keys `SC.MyFeature.*`). The filename and key prefix must match.

## Guidelines

### Critical Rules

- **Never hard-code user-facing strings** - use Localizer
- **Never concatenate strings** for user-facing text - use `Localizer.format()` with parameters
- **Never use Localizer in tests** - pass already-localized strings or use raw defaults
- **Never use Localizer in HTML templates** (lodash/underscore) - localize before passing to template
- **Never use `datejs`** for date formatting - use `Localizer.renderDate()` or Moment.js
- **Property key context must match filename** - `SC.Alerts.*` keys go in `Alerts.properties`
- **`Localizer.format()` requires exactly 3 arguments** - key, params object, template literal default
- **`Localizer.format()` default value must be a template literal** with expressions matching params
- **Do NOT pseudolocalize Config files** - files starting with `Config.` contain patterns/URLs

### Readability

- **Extract Localizer calls into variables**. Inline `Localizer` calls make code harder to read.

```jsx
// BAD - inline calls make JSX noisy
<input
    placeholder={Localizer.lookup('SC.Search.Facets.Placeholder', 'Search')}
    aria-label={Localizer.lookup('SC.Search.Facets.Placeholder', 'Search')}
/>;

// GOOD - extracted into variables
const searchPlaceholderLabel = Localizer.lookup('SC.Search.Facets.Placeholder', 'Search');

<input placeholder={searchPlaceholderLabel} aria-label={searchPlaceholderLabel} />;
```

### What to Localize

- UI labels and button text
- Error messages and validation messages
- Tooltip text and aria labels
- Placeholder text
- Status messages and notifications
- Column headers and table labels

### What NOT to Localize

- Log messages (not user-facing)
- CSS class names and IDs
- API endpoints and URLs
- Internal identifiers and keys
- Technical configuration values
- Test assertions and test data

### Localization Contexts

Some products override specific keys using context suffixes. Available contexts are defined in `Platform/js/Localized/localization-contexts.json`.

Context-specific override:

```properties
# Base key
SC.Website.NotificationCenter.Title=Notifications

# IndigoPremium context override
SC.Website.NotificationCenter.IndigoPremium.Title=My Notifications
```

For detailed reference on fallback rules, contexts, validation, and tooling, see [references/detailed-reference.md](references/detailed-reference.md).

## Examples

### Example 1: Localizing a Simple String

**Before:**

```javascript
const closeButton = document.createElement('button');
closeButton.textContent = 'Close';
```

**After:**

```javascript
import Localizer from 'Platform/js/Localized/Localizer.js';

const closeButton = document.createElement('button');
closeButton.textContent = Localizer.lookup('SC.Core.Widget.Lightbox.Close', 'Close');
```

### Example 2: Localizing a Parameterized String

**Before:**

```javascript
const message = `User ${userName} has ${count} items`;
```

**After:**

```javascript
import Localizer from 'Platform/js/Localized/Localizer.js';

const message = Localizer.format(
    'SC.Website.UserItems.Message',
    { userName, count },
    `User ${userName} has ${count} items`
);
```

**Properties entry:**

```properties
# User items count message
SC.Website.UserItems.Message=User {userName} has {count} items
```

### Example 3: Localizing a React Component

**Before:**

```jsx
function Banner({ helpUrl }) {
    return (
        <p>
            Need help? Visit <a href={helpUrl}>our help center</a> for more info.
        </p>
    );
}
```

**After:**

```jsx
import Localizer from 'Platform/js/Localized/Localizer.js';
import Localize from 'Platform/js/Indigo/Core/Components/Localize.jsx';

function Banner({ helpUrl }) {
    return (
        <Localize
            format="SC.Website.Banner.HelpMessage"
            helpLink={<a href={helpUrl}>{Localizer.lookup('SC.Website.Banner.HelpLinkText', 'our help center')}</a>}
        >
            {'Need help? Visit {helpLink} for more info.'}
        </Localize>
    );
}
```

**Properties entries:**

```properties
# Banner help message with link placeholder
SC.Website.Banner.HelpMessage=Need help? Visit {helpLink} for more info.
# Banner help link text
SC.Website.Banner.HelpLinkText=our help center
```

### Example 4: Localizing Numbers and Dates

**Before:**

```javascript
const count = group.members.length;
const dateStr = new Date().toLocaleDateString();
element.textContent = `${count} members - Updated ${dateStr}`;
```

**After:**

```javascript
import Localizer from 'Platform/js/Localized/Localizer.js';

const count = Localizer.renderInteger(group.members.length);
const dateStr = Localizer.renderDate(new Date(), 'SC.Config.Date.ShortDate', 'M/d/yyyy');
const message = Localizer.format(
    'SC.Website.Group.MembersUpdated',
    { count, dateStr },
    `${count} members - Updated ${dateStr}`
);
element.textContent = message;
```

**Properties entries:**

```properties
# Website.properties
SC.Website.Group.MembersUpdated={count} members - Updated {dateStr}
```

### Example 5: Localizing Aria Labels

**Before:**

```jsx
<button aria-label="Close dialog">X</button>
```

**After:**

```jsx
<button aria-label={Localizer.lookup('SC.Core.Dialog.CloseAriaLabel', 'Close dialog')}>X</button>
```

**Properties entry:**

```properties
# Core.properties
SC.Core.Dialog.CloseAriaLabel=Close dialog
```
