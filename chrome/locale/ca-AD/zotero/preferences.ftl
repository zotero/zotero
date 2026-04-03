preferences-window =
    .title = { -app-name } Paràmetres
preferences-appearance-title = Aparença i llengua
preferences-auto-recognize-files =
    .label = Recupera metadades automàticament de PDF i llibres electrònics
preferences-file-renaming-title = Reanomenament de fitxers
preferences-file-renaming-intro = { -app-name } can automatically rename files based on the details of the parent item (title, author, etc.) and keep the filenames in sync as you make changes. Downloaded files are always initially named based on the parent item.
preferences-file-renaming-configure-button =
    .label = Configure File Renaming…
preferences-attachment-titles-title = Attachment Titles
preferences-attachment-titles-intro = Attachment titles are <label data-l10n-name="wiki-link">different from filenames</label>. To support some workflows, { -app-name } can show filenames instead of attachment titles in the items list.
preferences-attachment-titles-show-filenames =
    .label = Show attachment filenames in the items list
preferences-reader-title = Lector
preferences-reader-open-epubs-using = Obre els EPUB amb
preferences-reader-open-snapshots-using = Obre les captures de pantalla amb
preferences-reader-open-in-new-window =
    .label = Obre els fitxers en finestres noves en comptes de pestanyes
preferences-reader-auto-disable-tool =
    .label = Turn off note, text, and image annotation tools after each use
preferences-reader-ebook-font = Lletra tipogràfica de l'Ebook:
preferences-reader-ebook-hyphenate =
    .label = Enable automatic hyphenation
preferences-note-title = Notes
preferences-note-open-in-new-window =
    .label = Open notes in new windows instead of tabs
preferences-color-scheme = Esquema de color:
preferences-color-scheme-auto =
    .label = Automàtic
preferences-color-scheme-light =
    .label = Clar
preferences-color-scheme-dark =
    .label = Fosc
preferences-item-pane-header = Item Pane Header:
preferences-item-pane-header-style = Header Citation Style:
preferences-item-pane-header-locale = Header Language:
preferences-item-pane-header-missing-style = Missing style: <{ $shortName }>
preferences-locate-library-lookup-intro = Library Lookup can find a resource online using your library’s OpenURL resolver.
preferences-locate-resolver = Resolutor:
preferences-locate-base-url = URL base:
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
    .tooltiptext = Afegeix un estil d'un fitxer
    .label = Add from File…
preferences-styleManager-remove = Press { delete-or-backspace } to remove this style.
preferences-citation-dialog = Citation Dialog
preferences-citation-dialog-mode = Citation Dialog Mode:
preferences-citation-dialog-mode-last-used =
    .label = Last Used
preferences-citation-dialog-mode-list =
    .label = Mode llista
preferences-citation-dialog-mode-library =
    .label = Mode biblioteca
preferences-advanced-enable-local-api =
    .label = Allow other applications on this computer to communicate with { -app-name }
preferences-advanced-local-api-available = Disponible a <code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = The { -app-name } HTTP server is disabled.
preferences-advanced-server-enable-and-restart =
    .label = Habilita i reinicia
preferences-advanced-language-and-region-title = Idioma i regió
preferences-advanced-enable-bidi-ui =
    .label = Habilita les utilitats d'edició de text bidireccional
preferences-advanced-reset-data-dir =
    .label = Reverteix a la ubicació per defecte…
preferences-advanced-custom-data-dir =
    .label = Utilitza una ubicació personalitzada…
preferences-advanced-default-data-dir =
    .value = (Default: { $directory })
    .aria-label = Ubicació per defecte
-preferences-sync-data-syncing = Sincronització de dades
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
preferences-sync-reset-restore-to-server-yes = Reemplaça les dades en la biblioteca en línia
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
