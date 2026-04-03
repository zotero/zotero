integration-docPrefs-window =
    .title = { -app-name } - Dokumenteinstellungen
integration-addEditCitation-window =
    .title = { -app-name } - Zitation hinzufügen/bearbeiten
integration-editBibliography-window =
    .title = { -app-name } - Literaturverzeichnis bearbeiten
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Quellenangabe bearbeiten
-integration-editBibliography-include-uncited = Um einen nicht zitierten Eintrag in die Biographie aufzunehmen einen Eintrag aus der Liste auswählen und { general-add } drücken.
-integration-editBibliography-exclude-cited = Ein zitiertes Element kann ausgeschlossen werden, indem es in der Liste ausgewählt wird und { general-remove } gedrückt wird.
-integration-editBibliography-edit-reference = Texteditor benutzen, um das Format einer Quellenangabe zu verändern.
integration-editBibliography-wrapper =
    .aria-label = Literaturverzeichnis-Dialog bearbeiten
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Zitations-Dialog
integration-citationDialog-section-open = Öffne Dokumente  ({ $count })
integration-citationDialog-section-selected = Ausgewählte Einträge ({ $count }/{ $total })
integration-citationDialog-section-selectedAnnotations = Selected Annotations
integration-citationDialog-section-selectedItems = Ausgewählte Einträge
integration-citationDialog-section-cited =
    { $count ->
        [0] Cited Items
       *[other] Cited Items ({ $count })
    }
integration-citationDialog-details-suffix = Suffix
integration-citationDialog-details-prefix = Präfix
integration-citationDialog-details-suppressAuthor = Autor auslassen
integration-citationDialog-details-includeComments = Include Comments
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Zitationseinstellungen
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] No selected, open, or cited items match the current search
       *[other] No selected or open items
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] Keine ausgewählte Notizen entsprechen der aktuellen Suche
       *[other] Keine Notizen ausgewählt
    }
integration-citationDialog-lib-message-annotations =
    { $search ->
        [true] No items with annotations match the current search
       *[other] No selected or open items with annotations
    }
integration-citationDialog-settings-keepSorted = Quellen sortiert lassen
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = Bibliothek
integration-citationDialog-mode-list = Liste
integration-citationDialog-btn-type-citation =
    .title = Zitation hinzufügen/ändern
integration-citationDialog-btn-type-add-note =
    .title = Notiz hinzufügen
integration-citationDialog-btn-type-annotations =
    .title = Add Annotations
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Pfeiltasten verwenden, um zwischen den Einträgen in dieser Zitation zu navigieren. Einträge können mit Tab ausgewählt werden, um sie der Zitation hinzuzufügen.
integration-citationDialog-enter-to-add-item = { return-or-enter } drücken, um den Eintrag zur Zitation hinzuzufügen
integration-citationDialog-search-for-items = Suchen, um Einträge zur Zitation hinzuzufügen
integration-citationDialog-aria-bubble =
    .aria-description = Dieser Eintrag ist Teil der Zitation. Mit der Leertaste lässt sich der Eintrag anpassen. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Drücken Sie die Tabulatortaste, um Elemente auszuwählen, die Sie zu diesem Zitat hinzufügen möchten. Drücken Sie die Escape-Taste, um die Änderungen zu verwerfen und das Dialogfeld zu schließen.
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Eine Notiz suchen, um sie ins Dokument einzufügen
integration-citationDialog-single-input-annotations =
    .placeholder = Search for annotations to insert into the document
integration-citationDialog-aria-item-list =
    .aria-description = Mit Aufwärts-/Abwärts-Pfeiltaste die Eintragsauswahl wechseln. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Mit den Links-/Rechts-Pfeiltasten die Eintragsauswahl ändern. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Sammlungen.
    .aria-description = Sammlung auswählen und mit Tab durch die Einträge navigieren
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = Dieser Eintrag wurde der Zitation hinzugefügt.  { return-or-enter } drücken, um ihn erneut hinzuzufügen oder { delete-or-backspace } drücken, um ihn zu entfernen.
integration-citationDialog-add-all = Alle hinzufügen
integration-citationDialog-collapse-section =
    .title = Abschnitt einklappen
integration-citationDialog-bubble-empty = (Kein Titel)
integration-citationDialog-add-to-citation = Zur Zitation hinzufügen
integration-citationDialog-annotations-filter =
    .placeholder = Filter annotations
integration-citationDialog-annotations-empty = Select an item, attachment, or annotation to view annotation details
integration-prefs-displayAs-label = Literaturangaben anzeigen als:
integration-prefs-footnotes =
    .label = Fußnoten
integration-prefs-endnotes =
    .label = Endnoten
integration-prefs-bookmarks =
    .label = Zitation als Lesezeichen speichern
integration-prefs-bookmarks-description = Lesezeichen können zwischen Microsoft Word und OpenOffice.org geteilt werden, aber dies ist fehleranfällig falls diese versehentlich verändert werden und können nicht als Fußnoten benutzt werden.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Das Dokument muss als .doc oder .docx gespeichert werden
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Automatisch Zitationen aktualisieren
    .tooltip = Zitationen mit anstehenden Aktualisierungen werden im Dokument hervorgehoben
integration-prefs-automaticCitationUpdates-description = Das Deaktivieren von automatischen Aktualisierungen kann das Einfügen von Zitationen in großen Dokumenten beschleunigen. Zitationen können dann manuell aktualisiert werden durch das Klicken Sie auf Aktualisieren.
integration-prefs-automaticJournalAbbeviations =
    .label = Abgekürzte Zeitschriftentitel von MEDLINE verwenden
integration-prefs-automaticJournalAbbeviations-description = Das Feld "Zeitschriften-Abkürzung" wird ignoriert.
integration-prefs-exportDocument =
    .label = Textverarbeitungsprogramm wechseln...
integration-error-unable-to-find-winword = { -app-name } konnte keine laufende Word-Instanz finden.
integration-warning-citation-changes-will-be-lost = Sie haben Änderungen an einer Zitation vorgenommen, die beim Fortfahren verloren gehen werden.
integration-warning-bibliography-changes-will-be-lost = Sie haben Änderungen am Literaturverzeichnis vorgenommen, die beim Fortfahren verloren gehen werden.
integration-warning-documentPreferences-changes-will-be-lost = An den Dokumenteneinstellungen vorgenommene Änderungen gehen beim Fortfahren verloren.
integration-warning-discard-changes = Änderungen verwerfen
integration-warning-command-is-running = Ein Befehl der Integration des Textverarbeitungsprogramms wird bereits ausgeführt.
first-run-guidance-citationDialog =
    Geben Sie einen Titel, einen Autor und/oder ein Jahr ein, um nach einer Referenz zu suchen.
    Nachdem Sie Ihre Auswahl getroffen haben, klicken Sie auf die Blase oder wählen Sie sie über die Tastatur aus und drücken Sie ↓/Leertaste, um Zitieroptionen wie Seitenzahl, Präfix und Suffix anzuzeigen.
    
    Sie können auch eine Seitenzahl oder einen anderen Ortungsbegriff hinzufügen, indem Sie diesen in Ihre Suchbegriffe einfügen (z. B. „Geschichte { $locator }“) oder indem Sie ihn nach der Sprechblase eingeben und die Taste { return-or-enter } drücken.
