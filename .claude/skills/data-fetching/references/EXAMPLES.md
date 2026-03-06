# Real-World WebRequest Examples

This document showcases actual usage patterns from the Cobalt Static Content codebase.

## Table of Contents

- [GET Requests](#get-requests)
- [POST Requests with JSON](#post-requests-with-json)
- [FormData File Uploads](#formdata-file-uploads)
- [AbortController for Cancellation](#abortcontroller-for-cancellation)
- [PUT and DELETE Requests](#put-and-delete-requests)
- [Error Handling Patterns](#error-handling-patterns)
- [React Component Patterns](#react-component-patterns)

---

## GET Requests

### Basic GET with Custom Headers

**Source:** `Platform/js/Foldering/Util/Request.js`

```javascript
export async function GetRequest(options) {
    if (!options.vertical) {
        options.vertical = Vertical.Foldering;
    }
    await GetRequestWithVerticalIdentifier(options);
}

async function GetRequestWithVerticalIdentifier(options) {
    const headers = new Headers({
        'x-cobalt-timezone': GetUserTimeZone()
    });
    if (options.contentType) {
        headers.set('Content-Type', options.contentType);
    }
    if (options.targetAccountKey) {
        headers.set(TARGET_ACCOUNT_KEY_HEADER, options.targetAccountKey);
    }

    const request = new WebRequest(options.vertical, `${options.url}${getData ? `?${getData}` : ''}`, {
        timeout: options.timeout,
        headers
    });
    const response = await request.Get();
    return HandleResponse(response, options);
}
```

**Key Points:**

- Defaults to `Vertical.Foldering` for the vertical, but allows overriding this value
- Adds timezone and content-type headers
- Supports optional target account key header

---

### Polling for Status

**Source:** `Platform/js/Indigo/Report/DocumentAnalyzer/Upload/Provider.js`

```javascript
function PollReportStatus(documentGuid) {
    const url = Url.Relative({
        Path: `/Report/BriefAnalyzer/v1/Reports/${documentGuid}/metadata`
    });

    const request = new WebRequest(Vertical.Report, url);
    return request.Get().then(r => (r.ok ? r.json() : handleError(r)));
}
```

**Key Points:**

- Uses `Vertical.Report` for report services
- Simple one-liner for polling async operations
- Returns parsed JSON or handles error

---

## POST Requests with JSON

### Simple Fire-and-Forget POST

**Source:** `Platform/js/Indigo/Website/Notification/Services/NotificationService.js`

```javascript
function setLastSeenToastMessage() {
    var request = new WebRequest(
        Vertical.Website,
        Url.Relative(Url.Rest.SetLastSeenNotificationToastMessageTime(null))
    );
    request.Post({ lastSeen: moment().toISOString() });
}
```

**Key Points:**

- No response handling needed
- Uses `Vertical.Website`
- Simple object body (automatically serialized as a url-encoded form)

---

### POST with JSON Body and Error Handling

**Source:** `Platform/js/Indigo/Website/Redline/Services/SnippetCompareService.js`

```javascript
async function createComparison(originalDocGuid, revisedDocGuid) {
    const parameters = {
        OriginalDocGuid: originalDocGuid,
        RevisedDocGuid: revisedDocGuid
    };

    const request = new WebRequest(Vertical.Website, '/Redline/Report');
    const response = await request.Post(JSON.stringify(parameters));

    if (response.ok) {
        return response.json();
    }
    throw new Error(`Failed to create comparison. HTTP status: ${response.status}`);
}
```

**Key Points:**

- Manually stringifies JSON body
- Checks `response.ok` before parsing
- Throws descriptive error on failure

---

### POST with Content-Type Header

**Source:** `Platform/js/Indigo/Report/DocumentAnalyzer/Upload/Provider.js`

```javascript
function UploadPlainText(document, uploadOption) {
    const plainDocument = {
        DocumentName: document.title,
        PlainText: document.text,
        LegalIssueTitle: document.legalIssueTitle
    };

    const request = new WebRequest(Vertical.Report, '/Report/BriefAnalyzer/v1/Reports/PlainText', {
        headers: {
            'Content-Type': 'application/json'
        }
    });

    return request.Post(JSON.stringify(plainDocument)).then(r => (r.ok ? r.json() : handleError(r)));
}
```

**Key Points:**

- Explicitly sets `Content-Type: application/json`
- Uses `Vertical.Report` for report services
- Promise chain for response handling

---

## FormData File Uploads

### Basic File Upload with Extended Timeout

**Source:** `Platform/js/Alerts/Bellows/Common/UploadFile.js`

```javascript
const formData = new FormData();
formData.append('fileUpload', files[0]);

const url = `/Alerts/AlertsFileUpload?alertsUri=${encodeURIComponent(self._getFileUploadUri())}`;
const request = new WebRequest(Vertical.Website, url, {
    headers: {
        Accept: 'application/json'
    },
    timeout: 120000 // 2 minute timeout for file uploads
});

try {
    const response = await request.Post(formData);
    const obj = await response.json();
    callback(obj);
} catch (error) {
    const message = Localizer.lookup('SC.Alerts.FileUploadFailed', 'File upload failed');
    ValidationError(message);
    throw error;
}
```

**Key Points:**

- Uses `FormData` for file uploads
- **Do NOT set Content-Type** - browser sets it automatically with boundary
- Extended timeout (120s) for large files

---

## AbortController for Cancellation

### Passing Signal Through Service Layer

**Source:** `Platform/js/FormsAssembly/ClientPortal/Widget/DataService.js`

```javascript
async function request(url, type, data, signal) {
    const request = new WebRequest(Vertical.Website, url, {
        signal,  // AbortController signal passed in
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
        }
    });

    let response;
    switch (type) {
        case 'GET':
            response = await request.Get();
            break;
        case 'POST':
            response = await request.Post(data ? JSON.stringify(data) : null);
            break;
    }

    if (!response.ok) {
        if (response.status === 401) {
            window.location.reload();  // Handle auth failure
        }
        throw new Error(`Request failed. HTTP status: ${response.status}`);
    }

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
},

// Usage with AbortController:
function dupCheck(projectId, fileName, signal){
    return this.request(
        '/api/v1/dupCheck?projectId=' + projectId + '&fileName=' + fileName,
        'GET',
        null,
        signal  // Signal passed through
    );
}
```

**Key Points:**

- Signal parameter flows through service layer
- Handles 401 with page reload
- Graceful JSON parsing with text fallback

---

## PUT and DELETE Requests

### PUT with JSON Body

**Source:** `Platform/js/Foldering/Util/Request.js`

```javascript
async function PutRequest(options, vertical) {
    if (vertical == null) {
        vertical = Vertical.Foldering;
    }

    const postData = JSON.stringify(options.data);
    const headers = new Headers({
        'Content-Type': 'application/json;charset=UTF-8',
        'x-cobalt-timezone': GetUserTimeZone()
    });

    if (options.targetAccountKey) {
        headers.set(TARGET_ACCOUNT_KEY_HEADER, options.targetAccountKey);
    }

    const request = new WebRequest(vertical, options.url, {
        timeout: options.timeout,
        headers
    });

    const response = await request.Put(postData);
    return HandleResponse(response, options);
}
```

**Key Points:**

- Defaults to `Vertical.Foldering`
- Sets charset in Content-Type
- Includes timezone header

---

### DELETE Request

**Source:** `Platform/js/Indigo/Report/DocumentAnalyzer/Upload/Provider.js`

```javascript
function CancelReport(documentGuid) {
    const url = Url.Relative({
        Path: `/Report/BriefAnalyzer/v2/Reports/${documentGuid}/Cancel`
    });

    const request = new WebRequest(Vertical.Report, url);
    return request.Delete();
}
```

**Key Points:**

- Simple DELETE with no body
- Uses `Vertical.Report`
- Returns promise directly

---

## Error Handling Patterns

### Comprehensive Error Handling

**Source:** `Platform/js/Indigo/Website/Redline/Services/SnippetCompareService.js`

```javascript
async function getComparisonHtml(compareId, chunkNumber) {
    const request = new WebRequest(Vertical.Website, `/Redline/Report/${compareId}?chunkNumber=${chunkNumber}`);

    const response = await request.Get();

    if (response.ok) {
        const text = await response.text(); // Plain text response
        return getHtml(text);
    }

    throw new Error(`Failed to retrieve comparison HTML. HTTP status: ${response.status}`);
}
```

**Key Points:**

- Checks `response.ok` before processing
- Uses `response.text()` for non-JSON responses
- Throws error with HTTP status for debugging

---

### Chained Error Handler

**Source:** `Platform/js/Indigo/Report/DocumentAnalyzer/Upload/Provider.js`

```javascript
function handleError(response) {
    return response
        .json()
        .catch(() => null)
        .then(body => {
            const error = new Error(body?.message || `Request failed with status ${response.status}`);
            error.status = response.status;
            error.body = body;
            throw error;
        });
}

// Usage:
const request = new WebRequest(Vertical.Report, url);
return request.Get().then(r => (r.ok ? r.json() : handleError(r)));
```

**Key Points:**

- Attempts to parse error body as JSON
- Attaches status and body to error object
- Graceful fallback if body isn't JSON

---

## React Component Patterns

### Class Component with AbortController

**Source:** `Platform/js/Website/Widgets/LegalNews/AlertsWidget/AlertsWidget.jsx`

```javascript
export class AlertsWidget extends React.PureComponent {
    constructor(props) {
        super(props);
        this.controller = new AbortController();
        // ... other initialization
    }

    async fetchData() {
        const request = new WebRequest(Vertical.Website, '/api/alerts', {
            signal: this.controller.signal
        });

        try {
            const response = await request.Get();
            if (response.ok) {
                const data = await response.json();
                this.setState({ alerts: data });
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                // Handle real errors, ignore abort
                console.error('Failed to fetch alerts', e);
            }
        }
    }

    componentWillUnmount() {
        this.controller.abort();
    }
}
```

**Key Points:**

- AbortController created in constructor
- Signal passed to all requests
- Abort called on unmount to prevent memory leaks
- AbortError is expected and ignored

---

### Functional Component with useEffect

**Recommended Pattern:**

```javascript
function DocumentList({ folderId }) {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        async function fetchDocuments() {
            setLoading(true);
            setError(null);

            const request = new WebRequest(Vertical.Foldering, `/api/folders/${folderId}/documents`, {
                signal: controller.signal
            });

            try {
                const response = await request.Get();
                if (response.ok) {
                    const data = await response.json();
                    setDocuments(data);
                } else {
                    setError(`Failed to load documents: ${response.status}`);
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    setError('Network error occurred');
                }
            } finally {
                setLoading(false);
            }
        }

        fetchDocuments();

        return () => controller.abort();
    }, [folderId]);

    // ... render
}
```

**Key Points:**

- Creates AbortController inside useEffect
- Cleanup function aborts on unmount or dependency change
- Ignores AbortError in catch block
- Tracks loading and error states
