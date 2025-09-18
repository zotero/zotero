preferences-window =
    .title = { -app-name }-Einstellungen
preferences-appearance-title = Erscheinungsbild und Sprache
preferences-auto-recognize-files =
    .label = Automatisch Metadaten für PDFs und eBooks abrufen
preferences-file-renaming-title = Umbenennen von Dateien
preferences-file-renaming-intro = { -app-name } can automatically rename files based on the details of the parent item (title, author, etc.) and keep the filenames in sync as you make changes. Downloaded files are always initially named based on the parent item.
preferences-file-renaming-auto-rename-files =
    .label = Automatically rename files
preferences-file-renaming-file-types = Diese Dateitypen umbenennen:
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
    .label = Dateinamen-Format anpassen…
preferences-file-renaming-rename-now =
    .label = Rename Files…
preferences-file-renaming-format-title = Dateinamen-Format
preferences-file-renaming-format-instructions = Sie können das Muster anpassen, das { -app-name } verwendet, um Dateien nach den Metadaten des Elterneintrags umzubenennen.
preferences-file-renaming-format-instructions-example = Zum Beispiel wird „{ $example }“ in dieser Vorlage durch den Titel des übergeordneten Eintrags ersetzt, der nach 50 Zeichen abgeschnitten wird.
preferences-file-renaming-format-instructions-more = Lesen Sie die <label data-l10n-name="file-renaming-format-help-link">Hilfe</label> für mehr Informationen.
preferences-file-renaming-format-template = Dateinamen-Vorlage:
preferences-file-renaming-format-preview = Vorschau:
preferences-reader-title = Reader
preferences-reader-open-epubs-using = EPUBs öffnen mit
preferences-reader-open-snapshots-using = Snapshots öffnen mit
preferences-reader-open-in-new-window =
    .label = Dateien in neuen Fenstern statt neuen Tabs öffnen
preferences-reader-auto-disable-tool =
    .label = Turn off note, text, and image annotation tools after each use
preferences-reader-ebook-font = eBook-Schriftart:
preferences-reader-ebook-hyphenate =
    .label = Automatische Silbentrennung aktivieren
preferences-color-scheme = Farbschema:
preferences-color-scheme-auto =
    .label = Automatisch
preferences-color-scheme-light =
    .label = Hell
preferences-color-scheme-dark =
    .label = Dunkel
preferences-item-pane-header = Kopfleiste des Eintragsbereichs:
preferences-item-pane-header-style = Kopfleisten-Zitationsstil:
preferences-item-pane-header-locale = Sprache der Kopfleiste:
preferences-item-pane-header-missing-style = Fehlender Stil: <{ $shortName }>
preferences-locate-library-lookup-intro = Library Lookup kann Quellen online über den OpenURL-Resolver Ihrer Bibliothek finden
preferences-locate-resolver = Resolver:
preferences-locate-base-url = Basis URL:
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
    .tooltiptext = Stil aus Datei hinzufügen
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
    .label = Anderen Anwendungen auf diesem Computer erlauben, mit { -app-name } zu kommunizieren
preferences-advanced-local-api-available = Verfügbar unter <code data-l10n-name="url">{ $url } </span>
preferences-advanced-server-disabled = Der { -app-name }-HTTP-Server ist deaktiviert.
preferences-advanced-server-enable-and-restart =
    .label = Aktivieren und neu starten
preferences-advanced-language-and-region-title = Sprache und Region
preferences-advanced-enable-bidi-ui =
    .label = Werkzeuge für das Arbeiten mit bidirektionalem Text aktivieren
preferences-advanced-reset-data-dir =
    .label = Auf Standardverzeichnis zurücksetzen…
preferences-advanced-custom-data-dir =
    .label = Benutzerdefiniertes Verzeichnis verwenden...
preferences-advanced-default-data-dir =
    .value = (Standard: { $directory })
    .aria-label = Standardverzeichnis
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
preferences-sync-reset-restore-to-server-yes = Daten in Online-Bibliothek ersetzen
