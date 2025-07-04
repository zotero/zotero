# DeepTutor Localhost Server Integration

This document describes the DeepTutor server integration that works with Zotero's existing HTTP server infrastructure. The integration provides an API endpoint that allows external applications to send text messages to DeepTutor, which will be displayed as popups.

## Overview

The DeepTutor server integration leverages Zotero's existing HTTP server infrastructure instead of creating a separate server. It registers custom endpoints with Zotero's server to provide text messaging functionality.

## Features

- **Zotero Integration**: Uses Zotero's existing HTTP server infrastructure
- **Automatic Startup**: The integration starts automatically when DeepTutor is initialized
- **Popup Display**: Shows received text in a styled popup with close functionality
- **Health Check**: Provides a health endpoint for monitoring server status
- **CORS Support**: Inherits CORS support from Zotero's server implementation

## How It Works

1. **Server Detection**: Checks if Zotero.Server is available
2. **Server Initialization**: Initializes Zotero's HTTP server if not already running
3. **Endpoint Registration**: Registers custom endpoints with Zotero's server
4. **Request Handling**: Processes incoming requests and displays popups

## API Endpoints

### POST /deeptutor/sendText

Sends text to be displayed as a popup in DeepTutor.

**Request:**
```json
{
  "text": "Your message here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Text received and popup displayed",
  "receivedText": "Your message here"
}
```

### GET /deeptutor/health

Checks the health status of the DeepTutor integration.

**Response:**
```json
{
  "status": "healthy",
  "server": "DeepTutor Integration with Zotero HTTP Server",
  "port": 23119,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Usage Examples

### 1. Using curl from command line

```bash
# First, find the Zotero server port (usually 23119)
curl -X POST http://localhost:23119/deeptutor/sendText \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from command line!"}'
```

### 2. Using JavaScript fetch API

```javascript
const response = await fetch("http://localhost:23119/deeptutor/sendText", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ text: "Hello from JavaScript!" })
});

const result = await response.json();
console.log(result);
```

### 3. Testing from browser console

```javascript
// Test the server integration
testDeepTutorServer();

// Test the DeepTutor instance
testDeepTutorInstance();

// Test environment detection
testEnvironment();
```

## Server Port

The DeepTutor integration uses Zotero's HTTP server port, which is typically **23119** by default. You can check the actual port by:

1. Looking at the console output when DeepTutor starts
2. Running `testEnvironment()` in the browser console
3. Checking `Zotero.Server.port` in the browser console

## Testing

### Browser Console Testing

Load the test script and run the following functions:

```javascript
// Test the server integration
testDeepTutorServer();

// Test the DeepTutor instance
testDeepTutorInstance();

// Test environment detection
testEnvironment();
```

### Manual Testing

1. **Health Check:**
   ```bash
   curl http://localhost:23119/deeptutor/health
   ```

2. **Send Text:**
   ```bash
   curl -X POST http://localhost:23119/deeptutor/sendText \
     -H "Content-Type: application/json" \
     -d '{"text":"Test message"}'
   ```

## Troubleshooting

### Server Not Starting

1. Check if Zotero.Server is available:
   ```javascript
   console.log(typeof Zotero?.Server);
   ```

2. Check if endpoints are registered:
   ```javascript
   console.log(Zotero.Server.Endpoints["/deeptutor/sendText"]);
   ```

3. Check server port:
   ```javascript
   console.log(Zotero.Server.port);
   ```

### Endpoints Not Working

1. Verify the server is running:
   ```javascript
   testEnvironment();
   ```

2. Check for endpoint registration:
   ```javascript
   console.log(Object.keys(Zotero.Server.Endpoints || {}));
   ```

3. Test with the provided test functions:
   ```javascript
   testDeepTutorServer();
   ```

## Integration Details

The DeepTutor server integration:

1. **Uses Zotero's Server Infrastructure**: Leverages the existing `Zotero.Server` implementation
2. **Registers Custom Endpoints**: Adds `/deeptutor/sendText` and `/deeptutor/health` endpoints
3. **Handles HTTP Requests**: Processes incoming requests using Zotero's request handling system
4. **Displays Popups**: Creates styled popups in the browser window
5. **Provides Error Handling**: Includes proper error handling and logging

## Security

- **Localhost Only**: The server only accepts connections from localhost
- **CORS Protection**: Inherits CORS protection from Zotero's server implementation
- **Input Validation**: Validates incoming requests and sanitizes text content
- **XSS Prevention**: Escapes HTML content to prevent XSS attacks

## Dependencies

- **Zotero.Server**: Requires Zotero's HTTP server infrastructure
- **Components**: Uses Mozilla's XPCOM components for server functionality
- **Browser APIs**: Uses standard browser APIs for popup display

## License

This localhost server is part of DeepTutor and is licensed under the GNU Affero General Public License v3.0. 