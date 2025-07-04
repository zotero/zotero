# DeepTutor Server Integration Guide

## Overview

The DeepTutor server integration works with Zotero's existing HTTP server infrastructure to provide API endpoints for external applications to communicate with DeepTutor.

## How It Works

### 1. **Server Architecture**
- **Base Server**: Zotero's built-in HTTP server (typically on port 23119)
- **Integration**: DeepTutor registers custom endpoints with Zotero's server
- **CORS Support**: Inherits CORS handling from Zotero's server implementation

### 2. **Endpoint Registration Process**
```javascript
// Endpoints are registered as constructor functions
Zotero.Server.Endpoints["/deeptutor/sendText"] = function() {
    this.init = function(request) {
        // Handle the request
        return [statusCode, contentType, body];
    };
    this.supportedMethods = ["POST"];
    this.supportedDataTypes = ["application/json"];
    this.permitBookmarklet = true;
};
```

### 3. **Request Flow**
1. **Request Arrives**: HTTP request hits Zotero's server
2. **Path Matching**: Server looks up endpoint by pathname
3. **Constructor Call**: `new this.endpoint()` creates endpoint instance
4. **Method Check**: Verifies HTTP method is supported
5. **CORS Check**: Validates origin and sets CORS headers
6. **Data Processing**: Parses request body based on content type
7. **Handler Execution**: Calls `endpoint.init()` with processed data
8. **Response**: Returns HTTP response to client

## Available Endpoints

### POST /deeptutor/sendText
**Purpose**: Send text messages to be displayed as popups in DeepTutor

**Request**:
```json
{
  "text": "Your message here"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Text received and popup displayed",
  "receivedText": "Your message here"
}
```

**Error Responses**:
- `400`: Missing 'text' field
- `405`: Wrong HTTP method
- `500`: Internal server error

### GET /deeptutor/health
**Purpose**: Check server status and list available endpoints

**Response**:
```json
{
  "status": "healthy",
  "server": "DeepTutor Integration with Zotero HTTP Server",
  "port": 23119,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "endpoints": ["/deeptutor/sendText", "/deeptutor/health"]
}
```

## CORS Support

The server supports cross-origin requests from:
- `https://deeptutor.knowhiz.us`
- `https://staging.deeptutor.knowhiz.us`
- `http://deeptutor.knowhiz.us`
- `http://staging.deeptutor.knowhiz.us`
- `http://localhost:3000`

CORS headers are automatically set for these origins.

## Testing the Server

### 1. **Browser Test**
Open `chrome/content/zotero/test-server.html` in your browser to run interactive tests.

### 2. **Command Line Test**
```bash
# Run the test script
./chrome/content/zotero/test-server.sh

# Test with custom port
./chrome/content/zotero/test-server.sh 23120
```

### 3. **Manual Testing with curl**

**Health Check**:
```bash
curl http://localhost:23119/deeptutor/health
```

**Send Text**:
```bash
curl -X POST http://localhost:23119/deeptutor/sendText \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from curl!"}'
```

**CORS Preflight**:
```bash
curl -X OPTIONS http://localhost:23119/deeptutor/health \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

### 4. **JavaScript Testing**
```javascript
// Test from browser console
fetch("http://localhost:23119/deeptutor/health")
  .then(response => response.json())
  .then(data => console.log(data));

// Send a message
fetch("http://localhost:23119/deeptutor/sendText", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Hello from JavaScript!" })
})
.then(response => response.json())
.then(data => console.log(data));
```

## Troubleshooting

### Common Issues

1. **"No endpoint found" Error**
   - Check if DeepTutor is loaded in Zotero
   - Verify endpoints are registered: `console.log(Zotero.Server.Endpoints)`
   - Restart Zotero and reload DeepTutor

2. **CORS Errors**
   - Ensure your origin is in the whitelist
   - Check that CORS headers are being set correctly
   - Verify the request includes proper headers

3. **Server Not Starting**
   - Check if Zotero.Server is available
   - Verify port is not in use
   - Check Zotero debug logs for errors

### Debug Commands

**Check Server Status**:
```javascript
console.log("Server port:", Zotero.Server.port);
console.log("Endpoints:", Object.keys(Zotero.Server.Endpoints));
```

**Test DeepTutor Integration**:
```javascript
// If DeepTutor is loaded
window.deepTutorInstance.testLocalhostServer();
```

**Check Endpoint Registration**:
```javascript
console.log("SendText endpoint:", Zotero.Server.Endpoints["/deeptutor/sendText"]);
console.log("Health endpoint:", Zotero.Server.Endpoints["/deeptutor/health"]);
```

## Integration Examples

### From a Web Application
```javascript
class DeepTutorAPI {
    constructor(serverUrl = "http://localhost:23119") {
        this.baseUrl = serverUrl;
    }

    async sendMessage(text) {
        const response = await fetch(`${this.baseUrl}/deeptutor/sendText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });
        return response.json();
    }

    async checkHealth() {
        const response = await fetch(`${this.baseUrl}/deeptutor/health`);
        return response.json();
    }
}

// Usage
const api = new DeepTutorAPI();
api.sendMessage("Hello from my app!");
```

### From Node.js
```javascript
const fetch = require('node-fetch');

async function sendToDeepTutor(text) {
    try {
        const response = await fetch('http://localhost:23119/deeptutor/sendText', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to send message:', error);
    }
}

sendToDeepTutor('Hello from Node.js!');
```

## Security Considerations

1. **Local Access Only**: Server only accepts connections from localhost
2. **Origin Validation**: CORS headers only set for whitelisted domains
3. **Input Validation**: All inputs are validated and sanitized
4. **Error Handling**: Sensitive information is not exposed in error messages

## Performance Notes

- **Lightweight**: Minimal overhead as it uses Zotero's existing server
- **Fast Response**: Direct endpoint execution without additional routing
- **Memory Efficient**: Endpoints are created on-demand
- **Scalable**: Can handle multiple concurrent requests

## Future Enhancements

Potential additions to the server:
- Authentication endpoints
- Session management
- File upload/download
- Real-time messaging
- WebSocket support
- Rate limiting
- Request logging 