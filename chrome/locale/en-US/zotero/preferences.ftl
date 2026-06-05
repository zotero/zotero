preferences-window =
    .title = { -app-name } Settings

preferences-appearance-title = Appearance and Language

preferences-auto-recognize-files =
    .label = Automatically retrieve metadata for PDFs and ebooks

preferences-file-renaming-title = File Renaming
preferences-file-renaming-intro =
    { -app-name } can automatically rename files based on the details of the parent item (title, author, etc.) and keep the filenames in sync as you make changes. Downloaded files are always initially named based on the parent item.
preferences-file-renaming-configure-button =
    .label = Configure File Renaming…

preferences-attachment-titles-title = Attachment Titles
preferences-attachment-titles-intro = Attachment titles are <label data-l10n-name="wiki-link">different from filenames</label>. To support some workflows, { -app-name } can show filenames instead of attachment titles in the items list.
preferences-attachment-titles-show-filenames =
    .label = Show attachment filenames in the items list

preferences-reader-title = Reader
preferences-reader-open-epubs-using = Open EPUBs using
preferences-reader-open-snapshots-using = Open snapshots using
preferences-reader-open-in-new-window =
    .label = Open files in new windows instead of tabs
preferences-reader-auto-disable-tool =
    .label = Turn off note, text, and image annotation tools after each use
preferences-reader-ebook-font = Ebook font:
preferences-reader-ebook-hyphenate =
    .label = Enable automatic hyphenation

preferences-read-aloud-title = Read Aloud
preferences-read-aloud-highlight-granularity = Highlight current
preferences-read-aloud-highlight-granularity-paragraph =
    .label = paragraph
preferences-read-aloud-highlight-granularity-sentence =
    .label = sentence
preferences-read-aloud-highlight-granularity-word =
    .label = word

preferences-note-title = Notes
preferences-note-open-in-new-window =
    .label = Open notes in new windows instead of tabs

preferences-color-scheme = Color Scheme:
preferences-color-scheme-auto =
    .label = Automatic
preferences-color-scheme-light =
    .label = Light
preferences-color-scheme-dark =
    .label = Dark

preferences-item-pane-header = Item Pane Header:
preferences-item-pane-header-style = Header Citation Style:
preferences-item-pane-header-locale = Header Language:
preferences-item-pane-header-missing-style = Missing style: <{ $shortName }>

preferences-locate-library-lookup-intro = Library Lookup can find a resource online using your library’s OpenURL resolver.
preferences-locate-resolver = Resolver:
preferences-locate-base-url = Base URL:

preferences-quickCopy-minus =
    .aria-label = { general-remove }
    .label = { $label }
preferences-quickCopy-plus =
    .aria-label = { general-add }
    .label = { $label }

preferences-styleManager-intro = { -app-name } can generate citations and bibliographies in over 10,000 citation styles. Add styles here to make them available when selecting styles throughout { -app-name }.
preferences-styleManager-get-additional-styles =
    .label = Get Additional Styles…
preferences-styleManager-restore-default =
    .label = Restore Default Styles…
preferences-styleManager-add-from-file =
    .tooltiptext = Add a style from a file
    .label = Add from File…
preferences-styleManager-remove = Press { delete-or-backspace } to remove this style.
preferences-citation-dialog = Citation Dialog
preferences-citation-dialog-mode = Citation Dialog Mode:
preferences-citation-dialog-mode-last-used =
    .label = Last Used
preferences-citation-dialog-mode-list =
    .label = List Mode
preferences-citation-dialog-mode-library =
    .label = Library Mode

preferences-advanced-enable-local-api =
    .label = Allow other applications on this computer to communicate with { -app-name }
preferences-advanced-local-api-available = Available at <code data-l10n-name="url">{ $url }</span>
preferences-advanced-local-api-clear-authorizations =
    .label = Clear Write Authorizations
preferences-advanced-server-disabled = The { -app-name } HTTP server is disabled.
preferences-advanced-server-enable-and-restart =
    .label = Enable and Restart
preferences-advanced-language-and-region-title = Language and Region
preferences-advanced-enable-bidi-ui =
    .label = Enable bidirectional text editing utilities
preferences-advanced-data-dir =
    .value = Data Directory:
preferences-advanced-reset-data-dir =
    .label = Revert to Default Location…
preferences-advanced-custom-data-dir =
    .label = Use Custom Location…
preferences-advanced-default-data-dir =
    .value = (Default: { $directory })
    .aria-label = Default location

preferences-pane-account = Account

-preferences-sync-data-syncing = Data Syncing
preferences-sync-data-syncing-groupbox =
    .aria-label = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-heading = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-description = Log in with your { -app-name } account to sync your data between devices, collaborate with others, and more.
preferences-sync-settings-heading = Sync
preferences-sync-settings-intro = { -app-name } can sync your library data and files across devices. <label data-l10n-name="sync-link">Learn more</label>
preferences-sync-reset-heading = Sync Reset
preferences-sync-fileSyncing-groups =
    .label = Sync attachment files in group libraries using { -app-name } Storage
preferences-sync-fileSyncing-tos = By using { -app-name } Storage, you agree to become bound by its <label data-l10n-name="terms-link">terms and conditions</label>.
preferences-account-log-out =
    .label = Log Out…

preferences-sync-reset-restore-to-server-body = { -app-name } will replace “{ $libraryName }” on { $domain } with data from this computer.
preferences-sync-reset-restore-to-server-deleted-items-text = { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] item
        *[other] items
    } in the online library will be permanently deleted.
preferences-sync-reset-restore-to-server-remaining-items-text = { general-sentence-separator }{ $localItemsCount ->
        [0] The library on this computer and the online library will be empty.
        [one] 1 item will remain on this computer and in the online library.
        *[other] { $localItemsCount } items will remain on this computer and in the online library.
    }
preferences-sync-reset-restore-to-server-checkbox-label = { $remoteItemsDeletedCount ->
        [one] Delete 1 item
        *[other] Delete { $remoteItemsDeletedCount } items
    }
preferences-sync-reset-restore-to-server-confirmation-text = delete online library
preferences-sync-reset-restore-to-server-yes = Replace Data in Online Library

preferences-account-log-in =
    .label = Log In
preferences-account-waiting-for-login =
    .value = Waiting for login…
preferences-account-cancel-button =
    .label = { general-cancel }

preferences-account-logged-out-status =
    .value = (logged out)

preferences-account-email-label =
    .value = Email:

preferences-account-switch-accounts =
    .label = Switch Accounts…
preferences-account-switch-text =
    Switching to a different account will remove all { -app-name } data on this computer. Before continuing, make sure all data and files you wish to keep have been synced with the “{ $username }” account or you have a backup of your { -app-name } data directory.
preferences-account-switch-confirmation-text = remove local data
preferences-account-switch-accept = Remove Data and Restart

fulltext-index-status-indexing = Indexing { $indexed } of { $total }…
fulltext-index-status-complete = Search index is up to date
fulltext-stats-attachments-indexed = Attachments indexed:
fulltext-stats-partially-indexed = Partially indexed:
fulltext-stats-not-available = Full-text content or file not available:
fulltext-stats-notes-indexed = Notes indexed:
preferences-pane-plugin-permissions = Permissions

preferences-plugin-permissions = Permissions
preferences-plugin-permissions-intro = Manage plugin permissions and data.
preferences-plugin-permissions-empty = No plugins.

preferences-plugin-permissions-delete-db-button =
    .label = Delete Database

preferences-plugin-permissions-delete-db-confirm-title = Delete Plugin Database
preferences-plugin-permissions-delete-db-confirm-body = Delete the database for { $name }? This cannot be undone.
preferences-plugin-permissions-delete-db-confirm-action = Delete

preferences-plugin-permissions-edit-subpane = Edit Plugin Permissions
preferences-plugin-permissions-edit-data-heading = Data Directory
preferences-plugin-permissions-edit-no-data = No data directory.
preferences-plugin-permissions-edit-db-heading = Database
preferences-plugin-permissions-edit-no-db = No database.
preferences-plugin-permissions-grants-heading = File Access Permissions
preferences-plugin-permissions-grants-empty = No remembered permissions.

preferences-plugin-permissions-edit-status-disabled = This plugin is disabled.
preferences-plugin-permissions-edit-status-uninstalled = This plugin is no longer installed.

preferences-plugin-permissions-edit-remove-all-heading = Remove All Data
preferences-plugin-permissions-edit-remove-all-intro = Delete the data directory, database, stored preferences,and remembered permissions for this plugin.
preferences-plugin-permissions-edit-remove-all-button =
    .label = Remove All Data…
preferences-plugin-permissions-edit-remove-all-confirm-title = Remove All Plugin Data
preferences-plugin-permissions-edit-remove-all-confirm-body = Remove all data stored for { $name }? This cannot be undone.
preferences-plugin-permissions-edit-remove-all-confirm-action = Remove
preferences-plugin-permissions-show-in-folder =
    .label = Show in Folder
preferences-plugin-permissions-clear-folder =
    .label = Remove Folder
preferences-plugin-permissions-add-grant-file =
    .label = Add File…
preferences-plugin-permissions-add-grant-folder =
    .label = Add Folder…
preferences-plugin-permissions-remove-grant =
    .aria-label = Remove

preferences-plugin-permissions-clear-folder-confirm-title = Clear Data Folder
preferences-plugin-permissions-clear-folder-confirm-body = Remove all files in { $name }'s data folder? This cannot be undone.
preferences-plugin-permissions-clear-folder-confirm-action = Clear

preferences-plugin-permissions-add-grant-mode-title = Choose file access permission type:
preferences-plugin-permissions-add-grant-mode-label = What should the plugin be allowed to do with this file/folder?

preferences-plugin-permissions-col-plugin = Plugin
preferences-plugin-permissions-col-permissions = Permissions
preferences-plugin-permissions-col-prefs = Prefs
preferences-plugin-permissions-col-file-access = File Access
preferences-plugin-permissions-col-data = File
preferences-plugin-permissions-col-db = DB
preferences-plugin-permissions-edit-row = Edit
preferences-plugin-permissions-legacy-badge = Legacy
preferences-plugin-permissions-legacy-hint = Legacy plugin is not managed by Zotero. Contact the author of the plugin to update.
preferences-plugin-permissions-installed-heading = Declared permissions:

preferences-plugin-permissions-edit-prefs-heading = Stored Preferences
preferences-plugin-permissions-edit-prefs-empty = This plugin has not stored any preferences.
preferences-plugin-permissions-prefs-reset = Reset to default
preferences-plugin-permissions-prefs-delete = Delete preference
preferences-plugin-permissions-prefs-toggle = Toggle value
preferences-plugin-permissions-prefs-add-button =
    .label = Add Preference…
preferences-plugin-permissions-prefs-reset-all-button =
    .label = Reset All to Defaults
preferences-plugin-permissions-prefs-add-title = Add
preferences-plugin-permissions-prefs-add-name = Name:
preferences-plugin-permissions-prefs-add-type = Type:
preferences-plugin-permissions-prefs-add-value = Value:
preferences-plugin-permissions-prefs-add-name-invalid = Preference name is required.
preferences-plugin-permissions-prefs-add-exists = A preference with that name already exists.
preferences-plugin-permissions-prefs-reset-all-confirm-title = Reset All
preferences-plugin-permissions-prefs-reset-all-confirm-body = Reset all preferences to default? This cannot be undone.
preferences-plugin-permissions-prefs-reset-all-confirm-action = Reset

preferences-plugin-permissions-grants-remove-all-button =
    .label = Remove All Grants
preferences-plugin-permissions-grants-remove-all-confirm-title = Remove All File-Access Grants
preferences-plugin-permissions-grants-remove-all-confirm-body = Remove all persisted file-access grants for this plugin? The plugin will re-prompt on next access.
preferences-plugin-permissions-grants-remove-all-confirm-action = Remove All
