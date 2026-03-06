---
name: data-fetching
description: HTTP data fetching patterns for Cobalt Static Content. Use when making API requests, fetching resources, handling network errors, or working with verticals. Every web request requires a vertical identifier.
---

# Data Fetching in Cobalt Static Content

> For real-world code examples from the codebase, see [references/EXAMPLES.md](references/EXAMPLES.md).

This skill covers making HTTP requests using the `WebRequest` module and understanding the vertical-based routing system.

## Critical Rule: Every Request Needs a Vertical

**Every web request in Cobalt must specify a vertical.** Verticals are enumerated identifiers representing different backend services that handle routing.

```javascript
import WebRequest from 'Platform/js/Core/Net/WebRequest.js';
import Vertical from 'Platform/js/Core/Vertical.js';

// ✅ Correct - vertical is REQUIRED as first parameter
const request = new WebRequest(Vertical.Document, '/api/documents');

// ❌ Wrong - missing vertical will throw an error
const request = new WebRequest('/api/documents');
```

## Available Verticals

Import verticals from the Vertical module:

```javascript
import Vertical from 'Platform/js/Core/Vertical.js';
```

See `Platform/js/Core/Vertical.json` for a complete list of available verticals.

## WebRequest API

### Constructor

```javascript
new WebRequest(vertical, url, options);
```

| Parameter  | Type     | Required | Description                                         |
| ---------- | -------- | -------- | --------------------------------------------------- |
| `vertical` | `number` | **Yes**  | The vertical identifier (e.g., `Vertical.Document`) |
| `url`      | `string` | **Yes**  | The endpoint URL (relative path)                    |
| `options`  | `object` | No       | Request configuration options                       |

### Options Object

| Option        | Type                | Default     | Description                      |
| ------------- | ------------------- | ----------- | -------------------------------- |
| `headers`     | `object \| Headers` | `{}`        | HTTP headers for the request     |
| `timeout`     | `number`            | `30000`     | Timeout in milliseconds          |
| `signal`      | `AbortSignal`       | `undefined` | Signal to abort the request      |
| `credentials` | `string`            | `undefined` | Credentials mode for the request |

### HTTP Methods

```javascript
const request = new WebRequest(vertical, url, options);

// All methods return Promise<WebResponseType>
const response = await request.Get();
const response = await request.Post(body);
const response = await request.Put(body);
const response = await request.Delete();
```

## Usage Patterns

### Basic GET Request

```javascript
import WebRequest from 'Platform/js/Core/Net/WebRequest.js';
import Vertical from 'Platform/js/Core/Vertical.js';

const request = new WebRequest(Vertical.Document, '/api/documents/123');

try {
    const response = await request.Get();
    if (response.ok) {
        const data = await response.json();
        // Process data
    } else {
        // Handle non-2xx status codes
    }
} catch (e) {
    // Handle network errors
}
```

### POST Request with JSON Body

```javascript
import WebRequest from 'Platform/js/Core/Net/WebRequest.js';
import Vertical from 'Platform/js/Core/Vertical.js';

const request = new WebRequest(Vertical.Foldering, '/api/folders', {
    headers: {
        'Content-Type': 'application/json;charset=UTF-8'
    }
});

try {
    const response = await request.Post(JSON.stringify({ name: 'New Folder' }));
    if (response.ok) {
        const result = await response.json();
        // Handle success
    }
} catch (e) {
    // Handle errors
}
```

### Request with Timeout and Abort Support

```javascript
import WebRequest from 'Platform/js/Core/Net/WebRequest.js';
import Vertical from 'Platform/js/Core/Vertical.js';

// Create an abort controller for manual cancellation
const controller = new AbortController();

const request = new WebRequest(Vertical.Search, '/api/search', {
    signal: controller.signal,
    timeout: 10000, // 10 seconds
    headers: {
        Accept: 'application/json'
    }
});

try {
    const response = await request.Get();
    if (response.ok) {
        const data = await response.json();
        // Process search results
    }
} catch (e) {
    if (e.name === 'TimeoutError') {
        // Request timed out
        console.error('Request timed out');
    }
    if (e.name === 'AbortError') {
        // Request was manually aborted
        console.log('Request was cancelled');
    }
    // Handle other errors
}

// Abort the request if needed (e.g., user navigates away)
controller.abort();
```

### Using FormData for File Uploads

```javascript
import WebRequest from 'Platform/js/Core/Net/WebRequest.js';
import Vertical from 'Platform/js/Core/Vertical.js';

const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('description', 'Document upload');

// Note: Do NOT set Content-Type header when using FormData
// The browser will set it automatically with the correct boundary
const request = new WebRequest(Vertical.Document, '/api/upload');

try {
    const response = await request.Post(formData);
    if (response.ok) {
        const result = await response.json();
        // Handle successful upload
    }
} catch (e) {
    // Handle errors
}
```

## Error Handling

### Recommended Pattern

```javascript
import WebRequest from 'Platform/js/Core/Net/WebRequest.js';
import Vertical from 'Platform/js/Core/Vertical.js';
import Localizer from 'Platform/js/Localized/Localizer.js';

const request = new WebRequest(Vertical.Website, '/api/data', {
    timeout: 15000
});

try {
    const response = await request.Get();

    if (response.ok) {
        const data = await response.json();
        return data;
    } else {
        // Handle HTTP error status codes (4xx, 5xx)
        const userMessage = Localizer.lookup(
            'SC.Website.Core.UnexpectedError',
            'An unexpected error occurred processing your request. Please try again later.'
        );
        showError(userMessage);
    }
} catch (e) {
    if (e.name === 'TimeoutError') {
        // Handle timeout - show user-friendly message
        const timeoutMessage = Localizer.lookup(
            'SC.Website.Core.TimeoutError',
            'The request took too long. Please try again.'
        );
        showError(timeoutMessage);
    } else if (e.name === 'AbortError') {
        // Request was cancelled - usually no user notification needed
        console.log('Request cancelled');
    } else {
        // Network error or other unexpected error
        TrackError(e);
        throw e;
    }
}
```

### Error Types

| Error Name     | Cause                                              | Handling                              |
| -------------- | -------------------------------------------------- | ------------------------------------- |
| `TimeoutError` | Request exceeded timeout duration                  | Show user-friendly timeout message    |
| `AbortError`   | Request was manually aborted via `AbortController` | Usually silent - no user notification |
| Network errors | Connection issues, CORS, etc.                      | Log error, show generic error message |

## Best Practices

### 1. Always Specify a Vertical

```javascript
// ✅ Correct - vertical is required
const request = new WebRequest(Vertical.Document, '/api/documents');

// ❌ Wrong - missing vertical
const request = new WebRequest('/api/documents');
```

### 2. Use Appropriate Timeouts

```javascript
// Quick operations (typeahead, autocomplete)
const request = new WebRequest(Vertical.TypeAhead, '/api/suggest', {
    timeout: 5000 // 5 seconds
});

// Standard operations
const request = new WebRequest(Vertical.Document, '/api/documents', {
    timeout: 30000 // 30 seconds (default)
});

// Long operations (reports, exports)
const request = new WebRequest(Vertical.Report, '/api/generate-report', {
    timeout: 120000 // 2 minutes
});
```

### 3. Implement Cancellation for User-Triggered Operations

```javascript
// In a React component
useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
        const request = new WebRequest(Vertical.Search, '/api/search', {
            signal: controller.signal
        });
        // ... fetch logic
    };

    fetchData();

    // Cleanup: abort request when component unmounts
    return () => controller.abort();
}, []);
```

### 4. Set Appropriate Content-Type Headers

```javascript
// JSON payload
const request = new WebRequest(Vertical.Website, '/api/data', {
    headers: {
        'Content-Type': 'application/json;charset=UTF-8'
    }
});
await request.Post(JSON.stringify(data));

// Form data - let browser set Content-Type automatically
const request = new WebRequest(Vertical.Website, '/api/upload');
await request.Post(formData);

// URL-encoded (default for POST without FormData)
const request = new WebRequest(Vertical.Website, '/api/submit');
await request.Post({ key: 'value' }); // Automatically URL-encoded
```

### 5. Handle All Response States

```javascript
try {
    const response = await request.Get();

    if (response.ok) {
        // 2xx responses
    } else if (response.status === 404) {
        // Not found - specific handling
    } else if (response.status >= 400 && response.status < 500) {
        // Client errors (4xx)
    } else if (response.status >= 500) {
        // Server errors (5xx)
    }
} catch (e) {
    // Network-level errors
}
```

## Angular Integration

For Angular applications, use `HttpClient` with the `x-cobalt-host` header:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import Vertical from 'Platform/js/Core/Vertical.js';

@Injectable()
export class DataService {
    constructor(private http: HttpClient) {}

    getData(): Observable<Record<string, unknown>> {
        return this.http.get('/api/data', {
            headers: new HttpHeaders({
                'x-cobalt-host': Vertical.GetHost(Vertical.Document)
            })
        });
    }

    postData(data: unknown): Observable<Record<string, unknown>> {
        return this.http.post('/api/data', data, {
            headers: new HttpHeaders({
                'x-cobalt-host': Vertical.GetHost(Vertical.Document),
                'Content-Type': 'application/json'
            })
        });
    }
}
```

## Vertical Utility Methods

### Getting Vertical Host

```javascript
import Vertical from 'Platform/js/Core/Vertical.js';

// Get the host name for a vertical
const documentHost = Vertical.GetHost(Vertical.Document);
// Returns something like "document.thomsonreuters.com"
```

### Getting Full URLs

```javascript
import Vertical from 'Platform/js/Core/Vertical.js';

// Get full URL for a resource
const imageUrl = Vertical.GetUrl(Vertical.Images, '/images/logo.png');
// Returns "https://images.example.com/images/logo.png"

// Get root URL for a vertical
const rootUrl = Vertical.GetRootUrl(Vertical.CSS);
// Returns "https://css.example.com"
```

### Getting Vertical Name

```javascript
import Vertical from 'Platform/js/Core/Vertical.js';

// Get the string name of a vertical
const name = Vertical.GetName(Vertical.Document);
// Returns "Document"
```

## Common Pitfalls

### 1. Forgetting to await async operations

```javascript
// ❌ Wrong - not awaiting
const response = request.Get();
console.log(response); // Promise, not response

// ✅ Correct
const response = await request.Get();
console.log(response); // Actual response
```

### 2. Not handling errors

```javascript
// ❌ Wrong - no error handling
const response = await request.Get();
const data = await response.json();

// ✅ Correct - with error handling
try {
    const response = await request.Get();
    if (response.ok) {
        const data = await response.json();
    }
} catch (e) {
    // Handle errors appropriately
}
```

### 3. Setting Content-Type with FormData

```javascript
// ❌ Wrong - manually setting Content-Type breaks multipart boundary
const request = new WebRequest(Vertical.Document, '/api/upload', {
    headers: { 'Content-Type': 'multipart/form-data' }
});
await request.Post(formData);

// ✅ Correct - let browser set Content-Type automatically
const request = new WebRequest(Vertical.Document, '/api/upload');
await request.Post(formData);
```
