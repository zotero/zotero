# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DeepTutorZotero** is a research sources manager based on Zotero, enhanced with AI capabilities powered by DeepTutor. This is a complex desktop application built on Mozilla Firefox/XULRunner technology with React components for the DeepTutor AI chat interface.

## Architecture

### Core Technologies
- **Mozilla XULRunner/Firefox**: The underlying platform for the desktop application
- **React**: Frontend components for DeepTutor AI chat interface
- **JavaScript/JSX**: Primary development language
- **SASS**: Styling system
- **Node.js**: Build toolchain and development server

### Key Directories
- `chrome/content/zotero/`: Core application logic and UI components
- `chrome/content/zotero/xpcom/`: Core Zotero XPCOM components
- `chrome/content/zotero/DeepTutor*.js`: AI chat interface components
- `js-build/`: Build system scripts and configuration
- `scss/`: Styling files
- `test/`: Test suite
- `translators/`: Citation format translators
- `resource/`: Static resources and third-party libraries

### DeepTutor Integration
The AI functionality is implemented through various DeepTutor components:
- `DeepTutor.jsx`: Main React component for AI interface
- `DeepTutorChatBox.js`: Chat interface component
- `DeepTutorSession.js`: Session management
- Authentication components for user management
- Streaming components for real-time AI responses

## Common Development Commands

### Build and Development
```bash
# Build the project
npm run build

# Start development with watching
npm start

# Clean build (removes previous build artifacts)
npm run clean-build

# Clean and start development
npm run clean-start

# Build individual components
npm run sass    # Build SASS files
npm run js      # Build JavaScript files
```

### Testing
```bash
# Run all tests
./test/runtests.sh

# Run tests with options
./test/runtests.sh -c           # Open console, don't quit
./test/runtests.sh -f           # Stop at first failure
./test/runtests.sh -d 5         # Enable debug logging
./test/runtests.sh -g pattern   # Run tests matching pattern
```

### Linting
```bash
# Lint JavaScript/JSX files
npx eslint chrome/content/zotero/
```

## Code Organization

### XPCOM Components
- Located in `chrome/content/zotero/xpcom/`
- Core Zotero functionality (database, sync, citations, etc.)
- Written in JavaScript with Mozilla-specific APIs

### React Components
- DeepTutor AI interface components
- Located in `chrome/content/zotero/`
- Modern React patterns with hooks and functional components

### Build System
- Custom Node.js build system in `js-build/`
- Handles compilation of JavaScript, SASS, and asset copying
- Supports development watching and production builds

## Development Guidelines

### JavaScript/JSX
- Uses ESLint with `@zotero` configuration
- Supports both Mozilla XUL/XPCOM and modern React code
- React components should use functional components with hooks
- Follow existing code patterns for Mozilla XPCOM components

### Styling
- SASS files organized by component and theme
- Platform-specific styles in `scss/mac/`, `scss/win/`, `scss/linux/`
- Dark and light theme support

### Testing
- Comprehensive test suite using Mocha
- Tests cover core functionality, UI components, and integration
- Use `./test/runtests.sh` for running tests with proper setup

## Mozilla-Specific Considerations

### Global Objects
The application has access to Mozilla-specific globals:
- `Zotero`: Main application object
- `Components`, `Cc`, `Ci`, `Cr`: XPCOM interfaces
- `Services`: Mozilla Services API
- `ChromeUtils`: Modern Mozilla utility functions

### File Structure
- `chrome.manifest`: Extension manifest
- `.xhtml` files: XUL-based UI definitions
- Mozilla-style localization in `chrome/locale/`

## AI Integration Notes

### DeepTutor Components
- Authentication system with AWS Cognito
- Session management for AI conversations
- Streaming response handling
- User subscription management
- Chat history and model selection

### API Integration
- Uses OpenAI API for AI responses
- Custom backend integration for user management
- Localhost server for development (`localhostServer.js`)

## Important Files to Understand

- `chrome/content/zotero/zotero.js`: Main application bootstrap
- `chrome/content/zotero/DeepTutor.jsx`: Main AI interface component
- `js-build/build.js`: Build system entry point
- `eslint.config.mjs`: Linting configuration
- `package.json`: Dependencies and scripts
- `test/runtests.sh`: Test runner script

## Browser Compatibility

This is a desktop application built on Mozilla Firefox technology, not a web application. It requires the Firefox/XULRunner platform to run and uses Mozilla-specific APIs throughout.