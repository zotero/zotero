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
integration-citationDialog = Citation Dialog
integration-citationDialog-section-open = Open Documents ({ $count })
integration-citationDialog-section-selected = Selected Items ({ $count }/{ $total })
integration-citationDialog-section-cited =
    { $count ->
        [0] Cited Items
       *[other] Cited Items ({ $count })
    }
integration-citationDialog-details-suffix = Suffix
integration-citationDialog-details-prefix = Prefix
integration-citationDialog-details-suppressAuthor = Autor auslassen
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Citation Settings
integration-citationDialog-lib-no-items =
    { $search ->
        [true] No selected, open, or cited items match the current search
       *[other] No selected or open items
    }
integration-citationDialog-settings-keepSorted = Keep sources sorted
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-btn-mode =
    .title =
        { $mode ->
            [library] Switch to List Mode
            [list] Switch to Library Mode
           *[other] Switch Mode
        }
    .aria-label =
        { $mode ->
            [library] The dialog is in Library mode. Click to switch to List Mode.
            [list] The dialog is in List mode. Click to switch to Library Mode.
           *[other] Switch Mode
        }
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Use Left/Right-Arrow to navigate the items of this citation. Press Tab to select items to add to this citation.
integration-citationDialog-enter-to-add-item = Press { return-or-enter } to add this item to the citation.
integration-citationDialog-search-for-items = Search for items to add to the citation
integration-citationDialog-aria-bubble =
    .aria-description = This item is included in the citation. Press space bar to customize the item. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Press Tab to select items to add to this citation. Press Escape to discard the changes and close the dialog.
integration-citationDialog-input =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-aria-item-list =
    .aria-description = Use Up/Down Arrow to change item selection. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Use Right/Left Arrow to change item selection. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Collections.
    .aria-description = Select a collection and press Tab to navigate its items.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = This item has been added to the citation. Press { return-or-enter } to add it again or { delete-or-backspace } to remove it.
integration-citationDialog-add-all = Add all
integration-citationDialog-collapse-section =
    .title = Abschnitt einklappen
integration-citationDialog-bubble-empty = (no title)
integration-citationDialog-add-to-citation = Add to Citation
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
integration-warning-citation-changes-will-be-lost = You have made changes to a citation that will be lost if you continue.
integration-warning-bibliography-changes-will-be-lost = You have made changes to the bibliography that will be lost if you continue.
integration-warning-documentPreferences-changes-will-be-lost = You have made changes to the document preferences that will be lost if you continue.
integration-warning-discard-changes = Discard Changes
integration-warning-command-is-running = A word processor integration command is already running.
