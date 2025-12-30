preferences-window =
    .title = { -app-name }-Einstellungen
preferences-appearance-title = Erscheinungsbild und Sprache
preferences-auto-recognize-files =
    .label = Automatisch Metadaten für PDFs und eBooks abrufen
preferences-file-renaming-title = Umbenennen von Dateien
preferences-file-renaming-intro = { -app-name } kann, basierend auf den Details der übergeordneten Einträge (Titel, Autor, usw.), Dateien umbenennen und diese bei Änderungen synchron halten. Heruntergeladene Dateien werden zuerst immer nach den übergeordneten Einträgen benannt.
preferences-file-renaming-auto-rename-files =
    .label = Dateien automatisch umbenennen
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
    .label = Benennen Dateien um....
preferences-file-renaming-format-title = Dateinamen-Format
preferences-file-renaming-format-instructions = Sie können das Muster anpassen, das { -app-name } verwendet, um Dateien nach den Metadaten des Elterneintrags umzubenennen.
preferences-file-renaming-format-instructions-example = Zum Beispiel wird „{ $example }“ in dieser Vorlage durch den Titel des übergeordneten Eintrags ersetzt, der nach 50 Zeichen abgeschnitten wird.
preferences-file-renaming-format-instructions-more = Lesen Sie die <label data-l10n-name="file-renaming-format-help-link">Hilfe</label> für mehr Informationen.
preferences-file-renaming-format-template = Dateinamen-Vorlage:
preferences-file-renaming-format-preview = Vorschau:
preferences-attachment-titles-title = Attachment Titles
preferences-attachment-titles-intro = Attachment titles are <label data-l10n-name="wiki-link">different from filenames</label>. To support some workflows, { -app-name } can show filenames instead of attachment titles in the items list.
preferences-attachment-titles-show-filenames =
    .label = Dateinamen von Anhängen in der Eintragsliste anzeigen
preferences-reader-title = Reader
preferences-reader-open-epubs-using = EPUBs öffnen mit
preferences-reader-open-snapshots-using = Snapshots öffnen mit
preferences-reader-open-in-new-window =
    .label = Dateien in neuen Fenstern statt neuen Tabs öffnen
preferences-reader-auto-disable-tool =
    .label = Schalte Notiz-, Text- und Bildannotations-Werkzeuge nach jeder Nutzung aus
preferences-reader-ebook-font = eBook-Schriftart:
preferences-reader-ebook-hyphenate =
    .label = Automatische Silbentrennung aktivieren
preferences-note-title = Notizen
preferences-note-open-in-new-window =
    .label = Notizen in neuen Fenstern statt Tabs öffnen
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
preferences-styleManager-intro = { -app-name } kann Zitationen und Bibliogaphien in über 10.000 Zitations.Stilen erzeugen. Füge Stile hier hinzu, um sie in der Auswahl der Stile überall in { -app-name } verfügbar zu machen.
preferences-styleManager-get-additional-styles =
    .label = Zusätzliche Stile Erhalten...
preferences-styleManager-restore-default =
    .label = Standard-Stile Wiederherstellen...
preferences-styleManager-add-from-file =
    .tooltiptext = Stil aus Datei hinzufügen
    .label = Aus Datei hinzufügen
preferences-styleManager-remove = Drücke { delete-or-backspace } um diesen Stil zu löschen.
preferences-citation-dialog = Zitations-Dialog
preferences-citation-dialog-mode = Modus des Zitations-Dialogs:
preferences-citation-dialog-mode-last-used =
    .label = Zuletzt Verwendet
preferences-citation-dialog-mode-list =
    .label = Listen-Modus
preferences-citation-dialog-mode-library =
    .label = Bibliotheks-Modus
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
preferences-sync-reset-restore-to-server-body = { -app-name } wird “{ $libraryName }” auf { $domain } mit Daten von diesem Computer ersetzen.
preferences-sync-reset-restore-to-server-deleted-items-text =
    { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] Eintrag
       *[other] Einträge
    } in der Online-Bibliothek werden dauerhaft gelöscht.
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] The library on this computer and the online library will be empty.
        [one] 1 item will remain on this computer and in the online library.
       *[other] { $localItemsCount } items will remain on this computer and in the online library.
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
        [one] 1 Eintrag löschen
       *[other] { $remoteItemsDeletedCount } Einträge löschen
    }
preferences-sync-reset-restore-to-server-confirmation-text = Online-Bibliothek löschen
preferences-sync-reset-restore-to-server-yes = Daten in Online-Bibliothek ersetzen
