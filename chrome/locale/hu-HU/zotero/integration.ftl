integration-docPrefs-window =
    .title = { -app-name } - Dokumentum beállításai
integration-addEditCitation-window =
    .title = { -app-name } - Hivatkozás hozzáadása/szerkesztése
integration-editBibliography-window =
    .title = { -app-name } - Bibliográfia szerkesztése
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Hivatkozás szerkesztése
-integration-editBibliography-include-uncited = Ha egy nem idézett elemet szeretne felvenni az irodalomjegyzékbe, jelölje ki azt az elemek listájából, és nyomja meg a { general-add } billentyűt.
-integration-editBibliography-exclude-cited = You can also exclude a cited item by selecting it from the list of references and pressing { general-remove }.
-integration-editBibliography-edit-reference = To change how a reference is formatted, use the text editor.
integration-editBibliography-wrapper =
    .aria-label = Edit Bibliography dialog
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
integration-citationDialog-details-suppressAuthor = Szerző kihagyása
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Hivatkozás beállításai
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] No selected, open, or cited items match the current search
       *[other] No selected or open items
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] No selected notes match the current search
       *[other] No notes are selected
    }
integration-citationDialog-settings-keepSorted = Keep sources sorted
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = Könyvtár
integration-citationDialog-mode-list = List
integration-citationDialog-btn-type-citation =
    .title = Hivatkozás hozzáadása/szerkesztése
integration-citationDialog-btn-type-add-note =
    .title = Jegyzet hozzáadása
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Use Left/Right-Arrow to navigate the items of this citation. Press Tab to select items to add to this citation.
integration-citationDialog-enter-to-add-item = Press { return-or-enter } to add this item to the citation.
integration-citationDialog-search-for-items = Search for items to add to the citation
integration-citationDialog-aria-bubble =
    .aria-description = This item is included in the citation. Press space bar to customize the item. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Press Tab to select items to add to this citation. Press Escape to discard the changes and close the dialog.
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Search for a note to insert into the document
integration-citationDialog-aria-item-list =
    .aria-description = Use Up/Down Arrow to change item selection. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Use Right/Left Arrow to change item selection. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Gyűjtemények.
    .aria-description = Select a collection and press Tab to navigate its items.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = This item has been added to the citation. Press { return-or-enter } to add it again or { delete-or-backspace } to remove it.
integration-citationDialog-add-all = Add all
integration-citationDialog-collapse-section =
    .title = Collapse section
integration-citationDialog-bubble-empty = (no title)
integration-citationDialog-add-to-citation = Add to Citation
integration-prefs-displayAs-label = Hivatkozások megjelenítése:
integration-prefs-footnotes =
    .label = Lábjegyzetek
integration-prefs-endnotes =
    .label = Végjegyzetek
integration-prefs-bookmarks =
    .label = Idézet könyvjelzőként való tárolása
integration-prefs-bookmarks-description = A könyvjelzők megoszthatók a Word és a LibreOffice között, de hibákat okozhatnak, ha véletlenül módosítják őket, és nem illeszthetők be lábjegyzetekbe.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Hivatkozások automatikus frissítése
    .tooltip = A függőben lévő, frissítésekkel ellátott idézetek kiemelésre kerülnek a dokumentumban
integration-prefs-automaticCitationUpdates-description = A frissítések letiltása felgyorsíthatja a hivatkozások beillesztését a nagy dokumentumokba. A hivatkozások manuális frissítéséhez kattintson a Frissítés gombra.
integration-prefs-automaticJournalAbbeviations =
    .label = Használja a MEDLINE folyóirat rövidítéseket
integration-prefs-automaticJournalAbbeviations-description = A "Journal Abbr" mező figyelmen kívül hagyása
integration-prefs-exportDocument =
    .label = Váltson egy másik szövegszerkesztőre…
integration-error-unable-to-find-winword = { -app-name } could not find a running Word instance.
integration-warning-citation-changes-will-be-lost = You have made changes to a citation that will be lost if you continue.
integration-warning-bibliography-changes-will-be-lost = You have made changes to the bibliography that will be lost if you continue.
integration-warning-documentPreferences-changes-will-be-lost = You have made changes to the document preferences that will be lost if you continue.
integration-warning-discard-changes = Discard Changes
integration-warning-command-is-running = A word processor integration command is already running.
