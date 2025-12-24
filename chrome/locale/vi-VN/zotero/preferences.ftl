preferences-window =
    .title = { -app-name } Settings
preferences-appearance-title = Appearance and Language
preferences-auto-recognize-files =
    .label = Automatically retrieve metadata for PDFs and ebooks
preferences-file-renaming-title = File Renaming
preferences-file-renaming-intro = { -app-name } can automatically rename files based on the details of the parent item (title, author, etc.) and keep the filenames in sync as you make changes. Downloaded files are always initially named based on the parent item.
preferences-file-renaming-auto-rename-files =
    .label = Automatically rename files
preferences-file-renaming-file-types = Rename files of these types:
preferences-file-renaming-file-type-pdf =
    .label = { file-type-pdf }
preferences-file-renaming-file-type-epub =
    .label = { file-type-ebook }
preferences-file-renaming-file-type-image =
    .label = { file-type-image }
preferences-file-renaming-file-type-audio =
    .label = { file-type-audio }
preferences-file-renaming-file-type-video =
    .label = { file-type-video }
preferences-file-renaming-customize-button =
    .label = Customize Filename Format…
preferences-file-renaming-rename-now =
    .label = Rename Files…
preferences-file-renaming-format-title = Filename Format
preferences-file-renaming-format-instructions = You can customize the filename pattern { -app-name } uses to rename attachment files from parent metadata.
preferences-file-renaming-format-instructions-example = For example, “{ $example }” in this template will be replaced with the title of the parent item, truncated at 50 characters.
preferences-file-renaming-format-instructions-more = See the <label data-l10n-name="file-renaming-format-help-link">documentation</label> for more information.
preferences-file-renaming-format-template = Filename Template:
preferences-file-renaming-format-preview = Preview:
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
preferences-note-title = Ghi chép
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
preferences-locate-resolver = Bộ phân giải:
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
preferences-advanced-server-disabled = The { -app-name } HTTP server is disabled.
preferences-advanced-server-enable-and-restart =
    .label = Enable and Restart
preferences-advanced-language-and-region-title = Language and Region
preferences-advanced-enable-bidi-ui =
    .label = Enable bidirectional text editing utilities
preferences-advanced-reset-data-dir =
    .label = Revert to Default Location…
preferences-advanced-custom-data-dir =
    .label = Use Custom Location…
preferences-advanced-default-data-dir =
    .value = (Default: { $directory })
    .aria-label = Default location
preferences-sync-reset-restore-to-server-body = { -app-name } will replace “{ $libraryName }” on { $domain } with data from this computer.
preferences-sync-reset-restore-to-server-deleted-items-text =
    { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] item
       *[other] items
    } in the online library will be permanently deleted.
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] The library on this computer and the online library will be empty.
        [one] 1 item will remain on this computer and in the online library.
       *[other] { $localItemsCount } items will remain on this computer and in the online library.
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
        [one] Delete 1 item
       *[other] Delete { $remoteItemsDeletedCount } items
    }
preferences-sync-reset-restore-to-server-confirmation-text = delete online library
preferences-sync-reset-restore-to-server-yes = Replace Data in Online Library
