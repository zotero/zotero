# CLAUDE.md

Guidance for Claude Code when working on this Zotero plugin. Read this before
making changes; verify your assumptions against the linked upstream sources
rather than trusting training data, because the Zotero plugin API surface
changes between major releases and your model's cutoff is almost certainly
behind.

## What this plugin is

A bootstrapped Zotero plugin that adds:

- An item-pane info row for **Reading Status** (Unread / In Progress / Done /
  Abandoned).
- A sortable items-table column for the same value.
- A right-click submenu (`Set Reading Status` → value) on library items.
- A **View → Open Kanban Board** menu item that opens a tab with 5 columns and
  drag-and-drop card reassignment, scoped to the selected collection/library.

Status is stored as a structured `Reading-Status: <value>` line in each item's
existing `extra` field, the same pattern Better BibTeX uses for `Citation
Key`. No schema migration; syncs natively.

## Target Zotero version

| Property            | Value                                              |
| ------------------- | -------------------------------------------------- |
| Stable release      | **Zotero 9.0.3** (released 6 May 2026)             |
| Minimum supported   | Zotero 7.0 (`strict_min_version` in manifest.json) |
| Maximum supported   | Zotero 9.0.x (`strict_max_version: "9.0.*"`)       |
| Mozilla platform    | Firefox ESR 140 (Zotero 8/9)                       |

When a new Zotero major ships, bump `strict_max_version` in `manifest.json`
**after** testing — per Zotero's guidance, set it to the latest version you've
actually tested with.

## Canonical documentation sources

There is **no separate Zotero 9 dev page**. The Zotero 7 page is still the
canonical reference for the plugin model; the Zotero 8 page documents what
changed between 7 and 8 (Mozilla 115 → 140, ESM-only imports, the new
`Zotero.MenuManager` API). Both apply to Zotero 9.

| Topic                                       | URL                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Plugin model (canonical)                    | https://www.zotero.org/support/dev/zotero_7_for_developers                                 |
| Mozilla 140 + MenuManager additions         | https://www.zotero.org/support/dev/zotero_8_for_developers                                 |
| Release history & breaking changes          | https://www.zotero.org/support/changelog                                                   |
| Plugin install flow (user-facing)           | https://www.zotero.org/support/plugins                                                     |
| Community reference (windingwind)           | https://windingwind.github.io/doc-for-zotero-plugin-dev/                                   |
| **Plugin API source of truth (read this)**  | https://github.com/zotero/zotero/tree/main/chrome/content/zotero/xpcom/pluginAPI           |

The pluginAPI directory currently contains exactly four files:
`pluginAPIBase.mjs`, `itemPaneManager.js`, `itemTreeManager.js`,
`menuManager.js`. **If you need a documented plugin API and it's not in one of
those files, it doesn't exist.** Anything else is reaching into private Zotero
internals.

### Fetching upstream docs

`www.zotero.org` returns **HTTP 403** to `WebFetch`. Use either:

- **Exa**: `mcp__d66eb3c4-...__web_fetch_exa` with the URL
- **GitHub raw**: `https://raw.githubusercontent.com/zotero/zotero/main/...` —
  this works with WebFetch and is the fastest way to verify plugin-API
  behavior

The GitHub MCP in this environment is restricted to `mbradaschia/zotero` and
**cannot** read from `zotero/zotero`. Use Exa or WebFetch on raw URLs.

## Plugin APIs we use (and where they're defined)

All three are documented in the linked source files; the JSDoc there is more
complete than any prose doc.

### `Zotero.ItemPaneManager.registerInfoRow(options)`

Used in `content/main.mjs` to add the Reading Status row.

- File: `chrome/content/zotero/xpcom/pluginAPI/itemPaneManager.js`
- Required keys: `rowID`, `pluginID`, `label.l10nID`, `onGetData`
- Optional: `position` (`"start"` | `"afterCreators"` | `"end"`), `multiline`,
  `nowrap`, `editable`, `onSetData`, `onItemChange`
- Cleanup: `unregisterInfoRow(rowID)` (auto-removed when the plugin
  uninstalls, but we still do it in `shutdown()`)
- **Undocumented but available**: `Zotero.ItemPaneManager.refreshInfoRow(rowID)`
  forces a refresh of an open info row. Not currently called by us — the
  framework refreshes automatically on item-modify notifications — but useful
  if you ever need to push a change that doesn't go through `saveTx()`.

### `Zotero.ItemTreeManager.registerColumn(option)`

Used in `content/main.mjs` for the Reading Status column.

- File: `chrome/content/zotero/xpcom/pluginAPI/itemTreeManager.js`
- Required: `dataKey`, `label`, `pluginID`
- We pass `columnPickerSubMenu: true` so it shows under "More Columns"
- Note: `registerColumns` (plural) is **deprecated**; use the singular form
- The returned `dataKey` is prefixed with the plugin ID — keep the return
  value if you need to call `unregisterColumn` later
- **Undocumented but available**: `Zotero.ItemTreeManager.refreshColumns()`,
  `Zotero.ItemTreeManager.isCustomColumn(dataKey)`,
  `Zotero.ItemTreeManager.getCustomCellData(item, dataKey)`. Not currently
  needed; flagging for future feature work.

### `Zotero.MenuManager.registerMenu(options)`

Added in Zotero 8 (April 2026). Used twice in `content/main.mjs`: the
right-click submenu and the View-menu item.

- File: `chrome/content/zotero/xpcom/pluginAPI/menuManager.js`
- Required: `menuID`, `pluginID`, `target`, `menus`
- Valid `target` values (full list — only some are in the prose docs):
  - `main/menubar/file` `edit` `view` `go` `tools` `help`
  - `main/library/item` `main/library/collection`
  - `main/library/addAttachment` `main/library/addNote`
  - `main/tab` — **tab right-click**, undocumented in prose docs
  - `reader/menubar/file` `edit` `view` `go` `window`
  - `itemPane/info/row` — **info-row right-click**, undocumented in prose
  - `notesPane/addItemNote` `notesPane/addStandaloneNote`
  - `sidenav/locate`
- `menuType`: `"menuitem"` | `"separator"` | `"submenu"`
- Hooks: `onShowing`, `onShown`, `onHiding`, `onHidden`, `onCommand`
- **Context object passed to hooks** (richer than prose docs suggest):
  `menuElem`, `setL10nArgs(args)`, `setEnabled(bool)`, `setVisible(bool)`,
  `setIcon(icon, darkIcon)` plus target-specific fields like `items` for
  library item menus.

### Tabs — *no plugin API exists*

There is no `Zotero.TabManager`. To open a tab, use the per-window global
`Zotero_Tabs.add({ type, title, select, data, onClose })`. **Track the
returned `id` yourself**; do not iterate `Zotero_Tabs._tabs`, it is private
and the shape can change. See `content/kanbanTab.js` (accepts `onOpen`/
`onClose` callbacks so `main.mjs` can maintain its own
`WeakMap<window, Set<tabID>>`).

The custom `type` value (we use `"kanban"`) is not registered with any
type-system — tabs do not persist across restarts.

## Localization

- Drop `.ftl` files under `locale/<locale>/`. Zotero auto-registers them; no
  `chrome.manifest` needed.
- **Menu items resolve `data-l10n-attrs="label"`.** A bare Fluent message
  value like `reading-status-unread = Unread` will render an empty label on a
  XUL menuitem. Use the dual-attribute form for any id that's used in a
  menu:
  ```
  reading-status-unread = Unread
      .label = Unread
  ```
  The text value is what `Zotero.getString` / Fluent text bindings see; the
  `.label` attribute is what `Zotero.MenuManager` applies via `data-l10n-id`.
- The `reading-status.ftl` file in this repo follows that convention for all
  ids used in menus.

### `Zotero.getString` vs Fluent

`Zotero.getString(id)` was originally for `.properties` files. In Zotero 7+
it may or may not resolve Fluent ids; behavior is inconsistent. For
synchronous label lookup, prefer `document.l10n.formatValueSync(...)` once
the FTL is loaded into the document, or hard-code English fallbacks if the
value is also the storage key (as in `getLocalizedLabel` in
`content/readingStatus.js`).

## Install flow (user-facing)

Zotero 9 renamed the addons panel.

- **Tools → Plugins** (not "Tools → Add-ons")
- Drag the `.xpi` onto the Plugins window — there is no longer an "Install
  Add-on From File…" gear menu item.

## Project layout

```
manifest.json              WebExtensions manifest. strict_max_version is "9.0.*".
bootstrap.js               Loads content/main.mjs, forwards lifecycle hooks.
content/
  main.mjs                 startup/shutdown, registers info-row, column, menus,
                           stylesheet. Tracks open Kanban tab IDs in a WeakMap
                           keyed by main window.
  readingStatus.js         Pure storage helpers (no DOM); the only file with
                           unit tests.
  kanbanTab.js             Kanban view, vanilla DOM + drag-and-drop. Takes
                           onOpen/onClose callbacks so main.mjs can track tabs
                           without reading Zotero_Tabs._tabs.
  icons/icon-32.svg
locale/en-US/
  reading-status.ftl       All plugin strings; menu-targeted ids include both
                           a text value AND a .label attribute.
styles/kanban.css          Loaded via nsIStyleSheetService in startup().
scripts/
  build.sh                 Zips repo into dist/zotero-reading-status.xpi.
  dev-link.sh              Writes a proxy file into a Zotero dev profile so
                           edits land without repacking the XPI.
test/
  readingStatus.test.js    `node --test`. Unit tests for the extra-field
                           parser / writer. Pure JS, no Zotero runtime.
```

## Development commands

```bash
npm test                  # node --test, runs the storage-helper unit tests
npm run lint              # eslint
npm run build             # produce dist/zotero-reading-status.xpi
npm run link -- <profile> # write proxy file into a dev profile
```

Smoke test loop:

1. `npm run link -- /path/to/profile` (once per profile)
2. In the profile's `prefs.js` (Zotero closed):
   ```
   user_pref("xpinstall.signatures.required", false);
   user_pref("extensions.autoDisableScopes", 0);
   user_pref("extensions.experiments.enabled", true);
   ```
3. Launch Zotero with `-purgecaches` after every code edit.

## Code style

Match the upstream Zotero codebase conventions (tabs, no cuddled braces,
`let` rather than `const`, etc.). The project root has no `.editorconfig` or
prettier config; ESLint isn't wired up yet.

## Things you should NOT do

- Don't reach into `Zotero_Tabs._tabs`, `Zotero.ItemTreeManager._columnManager`,
  or any other underscore-prefixed property. They are private. If you need
  something that isn't on the documented surface, read the relevant manager
  file in `chrome/content/zotero/xpcom/pluginAPI/` and use the public method
  there (some are undocumented in prose but still public).
- Don't add new strings to `.properties` or `.dtd` files. Use Fluent.
- Don't assume the Zotero source matches your training data. Check the
  current `main` branch in `zotero/zotero` via raw GitHub URLs.
- Don't change the plugin ID without coordinating: it is the identity Zotero
  uses to scope registered columns, info rows, and menus, and to remove them
  on uninstall. Currently `reading-status@placeholder` — replace before
  release, then any installed copy needs a fresh install (no auto-upgrade
  path from one id to another).

## Quick reference: where each upstream API is implemented

| What                                | File                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Zotero.ItemPaneManager.*`          | `chrome/content/zotero/xpcom/pluginAPI/itemPaneManager.js`                                                    |
| `Zotero.ItemTreeManager.*`          | `chrome/content/zotero/xpcom/pluginAPI/itemTreeManager.js`                                                    |
| `Zotero.MenuManager.*`              | `chrome/content/zotero/xpcom/pluginAPI/menuManager.js`                                                        |
| `Zotero.Reader.registerEventListener` | `chrome/content/zotero/xpcom/reader.js`                                                                     |
| `Zotero.PreferencePanes.register`   | `chrome/content/zotero/xpcom/preferencePanes.js`                                                              |
| `Zotero_Tabs.add` (per-window)      | `chrome/content/zotero/tabs.js` (loaded into the main window, not on the `Zotero` global)                     |
