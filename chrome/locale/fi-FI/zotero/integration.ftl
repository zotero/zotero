integration-docPrefs-window =
    .title = { -app-name } - Asiakirjan ominaisuudet
integration-addEditCitation-window =
    .title = { -app-name } - Lisää viite tai muokkaa sitä
integration-editBibliography-window =
    .title = { -app-name } - Muokkaa lähdeluetteloa
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Vuokkaa viitettä
-integration-editBibliography-include-uncited = Sisällyttääksesi viittaamattoman nimikkeen lähdeluetteloosi, valitse se nimikelistalta ja paina { general-add }.
-integration-editBibliography-exclude-cited = Voit myös jättää pois viitatun nimikkeen lähdeluettelosta valitsemalla sen ja painamalla { general-remove }.
-integration-editBibliography-edit-reference = Muuttaaksesi viitteen muotoilua, käytä tekstieditoria.
integration-editBibliography-wrapper =
    .aria-label = Muokkaa lähdeluetteloa -valintaikkuna
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
integration-citationDialog-details-suppressAuthor = Piilota tekijä
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
    .aria-label = Kokoelmat.
    .aria-description = Select a collection and press Tab to navigate its items.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = This item has been added to the citation. Press { return-or-enter } to add it again or { delete-or-backspace } to remove it.
integration-citationDialog-add-all = Add all
integration-citationDialog-collapse-section =
    .title = Kutista osa
integration-citationDialog-bubble-empty = (no title)
integration-citationDialog-add-to-citation = Add to Citation
integration-prefs-displayAs-label = Näytä sitaatit muodossa:
integration-prefs-footnotes =
    .label = Alaviitteet
integration-prefs-endnotes =
    .label = Loppuviitteet
integration-prefs-bookmarks =
    .label = Tallenna viitteet kirjanmerkkeinä
integration-prefs-bookmarks-description = Kirjanmerkkejä voidaan jakaa Wordin ja LibreOfficen välillä, mutta se saattaa aiheuttaa ongelmia, mikäli niitä muutetaan vahingossa. Kirjanmerkkejä ei voi myöskään lisätä alaviitteisiin.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Asiakirja tulee tallentaa .doc tai .docx -muodossa.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Päivitä viitteet automaattisesti
    .tooltip = Viitteet, joilla on odottavia päivityksiä, korostetaan asiakirjassa
integration-prefs-automaticCitationUpdates-description = Päivittämisen poiskytkentä voi nopeuttaa viitteiden lisäämistä pitkissä asiakirjoissa. Päivitä asiakirjan viitteet käsin valitsemalla Päivitä.
integration-prefs-automaticJournalAbbeviations =
    .label = Käytä MEDLINEn lehtilyhenteitä
integration-prefs-automaticJournalAbbeviations-description = Lehden lyhenne -kenttää ei huomioida.
integration-prefs-exportDocument =
    .label = Vaihda eri tekstinkäsittelyohjelmaan…
integration-error-unable-to-find-winword = { -app-name } ei löydä käynnissä olevaa Word-sovellusta.
integration-warning-citation-changes-will-be-lost = You have made changes to a citation that will be lost if you continue.
integration-warning-bibliography-changes-will-be-lost = You have made changes to the bibliography that will be lost if you continue.
integration-warning-documentPreferences-changes-will-be-lost = You have made changes to the document preferences that will be lost if you continue.
integration-warning-discard-changes = Hylkää muutokset
integration-warning-command-is-running = A word processor integration command is already running.
