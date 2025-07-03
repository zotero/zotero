# Source Highlight Button Implementation

## Overview

This implementation adds interactive source highlight buttons to the DeepTutorChatBox component using markdown-it-container. When users click these buttons, they can jump directly to the referenced document and page in the Zotero reader.

## Key Features

1. **Automatic Source Detection**: Converts `[<1>]`, `[<2>]`, etc. patterns in message text to clickable buttons
2. **Document Navigation**: Clicking a button opens the corresponding document at the specified page
3. **Text Highlighting**: Uses the existing search functionality to highlight referenced text
4. **Seamless Integration**: Works with the existing markdown-it rendering system

## Implementation Components

### 1. Markdown-it-Container Setup

```javascript
// Configure markdown-it-container for source buttons
md.use(markdownItContainer, 'source', {
  validate: function(params) {
    return params.trim().match(/^source\s+(\d+)\s+(.*)$/);
  },
  render: function (tokens, idx) {
    // Creates interactive HTML button elements
    // Includes source data and click handlers
  }
});
```

### 2. Text Preprocessing

The `formatResponseForMarkdown` function converts source references:

**Input**: `"Here is some text [<1>] with a source reference [<2>]."`

**Output**: 
```markdown
Here is some text :::source 1 %7B%22index%22%3A0%2C%22refinedIndex%22%3A0%2C%22page%22%3A5%2C%22referenceString%22%3A%22example%20text%22%7D
::: with a source reference :::source 2 %7B%22index%22%3A1%2C%22refinedIndex%22%3A1%2C%22page%22%3A7%2C%22referenceString%22%3A%22another%20reference%22%7D
:::.
```

### 3. Source Data Structure

Each source button contains encoded JSON data with:

```javascript
{
  index: 0,                    // Original source index
  refinedIndex: 0,             // Refined index for document mapping
  page: 5,                     // Page number in document
  referenceString: "example",   // Text to highlight
  sourceAnnotation: {          // Additional metadata
    pageNum: 5,
    startChar: 100,
    endChar: 150,
    success: true,
    similarity: 0.95
  }
}
```

### 4. Click Handler

Global click handler processes source button clicks:

```javascript
window.handleDeepTutorSourceClick = (encodedSourceData) => {
  try {
    const sourceData = JSON.parse(decodeURIComponent(encodedSourceData));
    handleSourceClick(sourceData);
  } catch (error) {
    Zotero.debug(`Error parsing source data: ${error.message}`);
  }
};
```

## Usage Examples

### Basic Source Reference

**API Response Text**:
```
"The study shows significant results [<1>] in the experimental group."
```

**Message Data**:
```javascript
{
  text: "The study shows significant results [<1>] in the experimental group.",
  sources: [
    {
      index: 0,
      refinedIndex: 0,
      page: 12,
      referenceString: "significant results",
      sourceAnnotation: { /* ... */ }
    }
  ]
}
```

**Rendered Output**:
```html
The study shows significant results <button class="deeptutor-source-button" onclick="...">1</button> in the experimental group.
```

### Multiple Sources

**API Response Text**:
```
"Previous research [<1>] indicates that the method [<2>] is effective."
```

**Rendered Output**:
```html
Previous research <button class="deeptutor-source-button">1</button> indicates that the method <button class="deeptutor-source-button">2</button> is effective.
```

## Button Styling

The source buttons are styled to match the existing design:

- **Color**: Blue (#0687E5) with 40% opacity
- **Shape**: Circular (2rem diameter)
- **Hover Effects**: Darker blue with 80% opacity and slight scale
- **Font**: Roboto, 0.875rem, weight 600
- **Position**: Inline with vertical alignment

## Integration Points

### 1. Message Processing Pipeline

```
API Response → formatResponseForMarkdown → markdown-it → processMarkdownResult → DOM
```

### 2. Click Handler Registration

```javascript
useEffect(() => {
  window.handleDeepTutorSourceClick = (encodedSourceData) => {
    // Process click and open document
  };
  
  return () => {
    delete window.handleDeepTutorSourceClick;
  };
}, [sessionId, documentIds]);
```

### 3. Document Opening Logic

Uses existing `handleSourceClick` function:
- Maps source index to document ID
- Opens document in Zotero reader
- Navigates to specified page
- Highlights referenced text

## Error Handling

1. **Missing Source Data**: Falls back to basic button without functionality
2. **Invalid JSON**: Logs error and continues rendering
3. **Document Not Found**: Gracefully handles missing documents
4. **Page Out of Range**: Reader handles invalid page numbers

## Testing

To test the implementation:

1. **Create Test Message**:
```javascript
const testMessage = {
  text: "This is a test [<1>] with source [<2>].",
  sources: [
    { index: 0, page: 1, referenceString: "test" },
    { index: 1, page: 5, referenceString: "source" }
  ]
};
```

2. **Check Button Rendering**: Verify buttons appear with correct styling
3. **Test Click Functionality**: Ensure clicks open correct documents
4. **Verify Highlighting**: Confirm text search works in reader

## Browser Compatibility

- **Chrome/Chromium**: Full support
- **Firefox**: Full support
- **Safari**: Full support (with webkit prefixes handled)
- **Edge**: Full support

## Performance Considerations

- **Minimal Overhead**: Text processing is lightweight
- **Lazy Loading**: Buttons only created when needed
- **Memory Management**: Global handler cleaned up on unmount
- **Efficient Rendering**: Uses existing markdown-it pipeline

## Future Enhancements

1. **Tooltip Improvements**: Show more detailed source information
2. **Keyboard Navigation**: Add tab support for accessibility
3. **Context Menu**: Right-click options for sources
4. **Batch Operations**: Select multiple sources at once 