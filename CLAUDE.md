# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zotero is a Firefox-based desktop research management application. It runs as a XUL/XHTML application on a Mozilla platform (not Electron, not a web app). The UI uses a mix of XUL/XHTML, custom elements (Web Components), and React components.

## Build & Development Commands

```bash
npm install              # Install dependencies
npm run build            # Full build (Babel transpile JS/JSX, compile SCSS, browserify, symlink)
npm run clean-build      # Clean build output and rebuild
```

### Running Tests

Tests run inside a built Zotero application instance via `test/runtests.sh`:

```bash
test/runtests.sh                   # Run all tests
test/runtests.sh item              # Run a single test file (omit "Test" and .js extension)
test/runtests.sh item collections  # Run multiple test files
test/runtests.sh -g "pattern"      # Run only tests matching a grep pattern
test/runtests.sh -f                # Stop after first failure
test/runtests.sh -s item           # Start at a specific test file
test/runtests.sh -e item           # End at a specific test file
test/runtests.sh -c                # Open JS console, don't quit on completion
test/runtests.sh -b                # Skip bundled translator/style installation (for faster startup when not necessary)
test/runtests.sh -d 5              # Enable debug logging (level 1-5; default is 3)
```

Tests use Mocha + Chai (assert style) + Sinon. Test files live in `test/tests/` and follow the naming convention `<module>Test.js`. Test helpers are in `test/content/support.js`.

The test runner automatically triggers `npm run build` if the watch process isn't running, so it's not necessary to manually run a build before running tests.

Tips:

- Pass flags before test names (e.g., `test/runtests.sh -f item`).
- `-f` should almost always be used, since test failures can cause later spurious test failures.
- To view debug logging for a specific test when running multiple tests, add `Zotero.Debug.init(1)` at the beginning of the test and run with `-d 5`.


### Linting

```bash
npx eslint <file>        # Lint a specific file
```

ESLint v9 flat config is in `eslint.config.mjs`. Uses `@zotero/eslint-config`, Babel parser, and React plugin. Currently, the code base is not fully linted, so only worry about issues with new or modified code lines.

## Architecture

### Core Layers

- **XPCOM modules** (`chrome/content/zotero/xpcom/`) -- Core business logic. Loaded sequentially by `chrome/content/zotero/zotero.mjs`. All modules attach to the global `Zotero` namespace (e.g., `Zotero.Items`, `Zotero.Sync.Runner`).

- **Data model** (`chrome/content/zotero/xpcom/data/`) -- ORM-like classes for database entities. `Zotero.DataObject` is the base class; `Zotero.Item`, `Zotero.Collection`, `Zotero.Search`, `Zotero.Library`, etc. extend it. Plural classes (`Zotero.Items`, `Zotero.Collections`) manage object caches and queries. Data objects use an async `saveTx()` pattern for persistence.

- **Database** (`chrome/content/zotero/xpcom/db.js`) -- SQLite via Mozilla's mozStorage API. Accessed through `Zotero.DB.queryAsync()`, `Zotero.DB.executeTransaction()`.

- **Sync system** (`chrome/content/zotero/xpcom/sync/`) -- `syncRunner.js` orchestrates sync. `syncEngine.js` handles object-level sync logic. `syncAPIClient.js` communicates with the Zotero API server. `syncLocal.js` manages local sync state. Similar `storage*` files for file syncing, along with zfs.js (Zotero Storage) and webdav.js (WebDAV).

- **HTTP server** (`chrome/content/zotero/xpcom/server/`) -- Local HTTP server for browser connector integration and local API.

### UI Layers

- **Main window**: `chrome/content/zotero/zoteroPane.xhtml` + `zoteroPane.js`
- **Custom elements** (`chrome/content/zotero/elements/`) -- XUL custom elements inheriting from `XULElementBase` (defined in `elements/base.js`), which provides lifecycle helpers (`init()`, `destroy()`, `content` getter for templates). Registered via `customElements.define()`.
- **React components** (`chrome/content/zotero/components/`) -- Used for complex interactive UI (tag selector, virtualized table, item tree, collection tree). Major tree views are `itemTree.jsx` and `collectionTree.jsx`.
- **SCSS styles** (`scss/`) -- Compiled to CSS. Platform-specific overrides in `scss/mac/`, `scss/win/`, `scss/linux/`.
- **Localization** -- Fluent (`.ftl` files) in `chrome/locale/en-US/zotero/`. Accessed via `data-l10n-id` attributes or `Zotero.getString()` for legacy `.properties` strings.

### Submodules

Several features are developed in separate repos and included as Git submodules:

- `reader/` -- PDF/EPUB/snapshot reader with annotations
- `note-editor/` -- Rich text note editor
- `pdf-worker/` -- PDF processing (extraction, manipulation)
- `translators/` -- 760+ web translators for importing metadata from websites
- `styles/` -- CSL citation styles
- `chrome/content/zotero/xpcom/utilities/` -- Shared utility library
- `chrome/content/zotero/xpcom/translate/` -- Translation framework
- `resource/SingleFile/` -- Web page archiving

### Build System (`js-build/`)

Custom Node.js build system (not Webpack). `js-build/config.js` defines what gets built:
- **JS/JSX files** in `chrome/`, `components/`, `defaults/`, `test/` are transpiled via Babel (React JSX, CommonJS modules)
- **SCSS files** in `scss/` and `chrome/skin/` are compiled with Dart Sass
- **Browserify** bundles select npm packages (react-select, sinon, url) for use in the XUL environment
- **Symlinks** connect source files and submodules into the `build/` directory
- The built app reads from `build/`, not directly from source

## Code Style

- Tabs for indentation, not spaces
- Use `let` instead of `const` except for true scalar constants (e.g., `const MAX_SECONDS = 5 * 60;`)
- No cuddled braces (opening brace on same line, but `else`/`catch`/etc. on their own line)
- Use two hyphens `--` in comments, not an em dash
- Indent blank lines to match surrounding indentation level
- Objects attach to the `Zotero` global namespace rather than using ES module exports
- Async code uses `async`/`await` throughout
- Mozilla/XPCOM APIs are available globally: `Cc`, `Ci`, `Cu`, `Cr`, `Services`, `ChromeUtils`, `IOUtils`, `PathUtils`

## Translators

See `translators/CLAUDE.md` for guidelines. Key rules: **never** generate translators from scratch, **never** generate UUIDs, **never** generate test cases -- all of these must be done through Zotero's Scaffold tool.
