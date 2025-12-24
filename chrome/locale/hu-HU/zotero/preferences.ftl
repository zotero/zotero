preferences-window =
    .title = { -app-name } Beállítások
preferences-appearance-title = Megjelenés és nyelv
preferences-auto-recognize-files =
    .label = A metaadat automatikus visszaállítása a PDF-ek és e-könyvek számára
preferences-file-renaming-title = Fájl átnevezése
preferences-file-renaming-intro = { -app-name } can automatically rename files based on the details of the parent item (title, author, etc.) and keep the filenames in sync as you make changes. Downloaded files are always initially named based on the parent item.
preferences-file-renaming-auto-rename-files =
    .label = Automatically rename files
preferences-file-renaming-file-types = Az ilyen típusú fájlok átnevezése:
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
preferences-file-renaming-format-title = Fájlnév formátuma
preferences-file-renaming-format-instructions = You can customize the filename pattern { -app-name } uses to rename attachment files from parent metadata.
preferences-file-renaming-format-instructions-example = For example, “{ $example }” in this template will be replaced with the title of the parent item, truncated at 50 characters.
preferences-file-renaming-format-instructions-more = További információkért lásd a <label data-l10n-name="file-renaming-format-help-link">dokumentációt</label>.
preferences-file-renaming-format-template = Filenév sablon:
preferences-file-renaming-format-preview = Előnézet:
preferences-attachment-titles-title = Attachment Titles
preferences-attachment-titles-intro = Attachment titles are <label data-l10n-name="wiki-link">different from filenames</label>. To support some workflows, { -app-name } can show filenames instead of attachment titles in the items list.
preferences-attachment-titles-show-filenames =
    .label = Show attachment filenames in the items list
preferences-reader-title = Olvasó
preferences-reader-open-epubs-using = Open EPUBs using
preferences-reader-open-snapshots-using = Open snapshots using
preferences-reader-open-in-new-window =
    .label = Open files in new windows instead of tabs
preferences-reader-auto-disable-tool =
    .label = Turn off note, text, and image annotation tools after each use
preferences-reader-ebook-font = Ebook font:
preferences-reader-ebook-hyphenate =
    .label = Enable automatic hyphenation
preferences-note-title = Jegyzetek
preferences-note-open-in-new-window =
    .label = Open notes in new windows instead of tabs
preferences-color-scheme = Színséma:
preferences-color-scheme-auto =
    .label = Automatikus
preferences-color-scheme-light =
    .label = Világos
preferences-color-scheme-dark =
    .label = Sötét
preferences-item-pane-header = Item Pane Header:
preferences-item-pane-header-style = Header Citation Style:
preferences-item-pane-header-locale = Header Language:
preferences-item-pane-header-missing-style = Hiányzó stílus: <{ $shortName }>
preferences-locate-library-lookup-intro = Library Lookup can find a resource online using your library’s OpenURL resolver.
preferences-locate-resolver = Linkfeloldó:
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
    .tooltiptext = Stílus hozzáadása fájlból
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
    .label = Engedélyezi, hogy más alkalmazások ezen a számítógépen kommunikáljanak a { -app-name }
preferences-advanced-local-api-available = Elérhető a(z)<code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = A { -app-name } HTTP-kiszolgáló le van tiltva.
preferences-advanced-server-enable-and-restart =
    .label = Engedélyezés és újraindítás
preferences-advanced-language-and-region-title = Nyelv és régió
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
