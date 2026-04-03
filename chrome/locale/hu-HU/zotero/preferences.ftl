preferences-window =
    .title = { -app-name } Beállítások
preferences-appearance-title = Megjelenés és nyelv
preferences-auto-recognize-files =
    .label = A metaadat automatikus visszaállítása a PDF-ek és e-könyvek számára
preferences-file-renaming-title = Fájl átnevezése
preferences-file-renaming-intro = A { -app-name } automatikusan átnevezheti a fájlokat a szülőelem adatai (cím, szerző stb.) alapján, és a fájlneveket automatikusan szinkronizálja, amikor változtatásokat hajt végre. A letöltött fájlok neve mindig a szülőelem alapján kerül megadásra.
preferences-file-renaming-configure-button =
    .label = Configure File Renaming…
preferences-attachment-titles-title = Csatolmányok címei
preferences-attachment-titles-intro = Attachment titles are <label data-l10n-name="wiki-link">different from filenames</label>. To support some workflows, { -app-name } can show filenames instead of attachment titles in the items list.
preferences-attachment-titles-show-filenames =
    .label = A mellékletek fájlneveinek megjelenítése az elemek listájában
preferences-reader-title = Olvasó
preferences-reader-open-epubs-using = EPUB fájlok megnyitása
preferences-reader-open-snapshots-using = Képernyőkép megnyitása
preferences-reader-open-in-new-window =
    .label = Fájlok megnyitása új ablakokban a fülek helyett
preferences-reader-auto-disable-tool =
    .label = Kapcsolja ki a jegyzet-, szöveg- és képjelölő eszközöket minden használat után.
preferences-reader-ebook-font = Ebook font:
preferences-reader-ebook-hyphenate =
    .label = Automatikus elválasztás engedélyezése
preferences-note-title = Jegyzetek
preferences-note-open-in-new-window =
    .label = A jegyzeteket új ablakokban nyissa meg, ne füleken
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
    .label = Egyedi hely megadása…
preferences-advanced-default-data-dir =
    .value = (Default: { $directory })
    .aria-label = Default location
-preferences-sync-data-syncing = Adatok szinkronizálása
preferences-sync-data-syncing-groupbox =
    .aria-label = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-heading = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-description = Log in with your { -app-name } account to sync your data between devices, collaborate with others, and more.
preferences-account-log-out =
    .label = Log Out…
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
preferences-account-switch-text = Switching to a different account will remove all { -app-name } data on this computer. Before continuing, make sure all data and files you wish to keep have been synced with the “{ $username }” account or you have a backup of your { -app-name } data directory.
preferences-account-switch-confirmation-text = remove local data
preferences-account-switch-accept = Remove Data and Restart
