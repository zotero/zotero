integration-docPrefs-window =
    .title = { -app-name } – Dokumentinställningar
integration-addEditCitation-window =
    .title = { -app-name } – Lägg till/redigera citering
integration-editBibliography-window =
    .title = { -app-name } – Redigera referenslista
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Redigera referens
-integration-editBibliography-include-uncited = För att ta med ett ociterat objekt i referenslistan väljer du det i objektlistan och trycker på { general-add }.
-integration-editBibliography-exclude-cited = Du kan också utesluta ett citerat objekt genom att välja det i referenslistan och trycka på { general-remove }.
-integration-editBibliography-edit-reference = Använd textredigeraren för att ändra formateringen av en referens.
integration-editBibliography-wrapper =
    .aria-label = Dialogrutan Redigera referenslista
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Citeringsdialogruta
integration-citationDialog-section-open = Öppna dokument ({ $count })
integration-citationDialog-section-selected = Markerade poster ({ $count }/{ $total })
integration-citationDialog-section-selectedAnnotations = Markerade annoteringar
integration-citationDialog-section-selectedItems = Valda objekt
integration-citationDialog-section-cited =
    { $count ->
        [0] Citerade poster
       *[other] Citerade poster ({ $count })
    }
integration-citationDialog-details-suffix = Suffix
integration-citationDialog-details-prefix = Prefix
integration-citationDialog-details-suppressAuthor = Utelämna författare
integration-citationDialog-details-locator-info = Tips: Du kan också skriva sidnummer och andra sidangivelser direkt i huvudfältet. <a data-l10n-name="docs-link">Läs mer</a>
integration-citationDialog-details-includeComments = Inkludera kommentarer
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Referensinställningar
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] Inga markerade, öppna eller citerade poster matchar den aktuella sökningen
       *[other] Inga markerade eller öppna poster
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] Inga markerade eller öppna anteckningar matchar den aktuella sökningen
       *[other] Inga markerade eller öppna anteckningar
    }
integration-citationDialog-lib-message-annotations =
    { $search ->
        [true] Inga poster med annoteringar matchar den aktuella sökningen
       *[other] Inga markerade eller öppna poster med annoteringar
    }
integration-citationDialog-settings-keepSorted = Håll källorna sorterade
integration-citationDialog-preview-error = Förhandsvisning är inte tillgänglig
integration-citationDialog-btn-displayPreview =
    .title = Visa förhandsgranskning av citering
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = Bibliotek
integration-citationDialog-mode-list = Lista
integration-citationDialog-btn-type-citation =
    .title = Lägg till/redigera källhänvisning
integration-citationDialog-btn-type-add-note =
    .title = Lägg till anteckning
integration-citationDialog-btn-type-annotations =
    .title = Lägg till anteckningar
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Använd vänster-/högerpilen för att navigera mellan objekten i denna citering. Tryck på Tabb för att välja objekt att lägga till i citeringen.
integration-citationDialog-enter-to-add-item = Tryck på { return-or-enter } för att lägga till objektet i citeringen.
integration-citationDialog-search-for-items = Sök efter objekt att lägga till i citeringen
integration-citationDialog-aria-bubble =
    .aria-description = Detta objekt ingår i citeringen. Tryck på mellanslag för att anpassa objektet. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Tryck på Tabb för att välja objekt att lägga till i citeringen. Tryck på Escape för att förkasta ändringarna och stänga dialogrutan.
integration-citationDialog-just-added-input-placeholder = Skriv ”10–15” för att citera sidor eller sök efter objekt
integration-citationDialog-just-added-input-citation =
    .placeholder = { $placeholder }
    .title = { $title }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Sök efter en anteckning att infoga i dokumentet
integration-citationDialog-single-input-annotations =
    .placeholder = Sök efter anteckningar att infoga i dokumentet
integration-citationDialog-aria-item-list =
    .aria-description = Använd upp-/nedpilen för att ändra objektvalet. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Använd höger-/vänsterpilen för att ändra objektvalet. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Samlingar.
    .aria-description = Välj en samling och tryck på Tabb för att navigera bland dess objekt.
integration-citationDialog-items-table =
    .title = { integration-citationDialog-add-to-citation-tooltip }
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .title = { integration-citationDialog-add-to-citation-tooltip }
    .aria-label = Detta objekt har lagts till i citeringen. Tryck på { return-or-enter } för att lägga till det igen eller { delete-or-backspace } för att ta bort det.
integration-citationDialog-add-to-citation-tooltip =
    { $count ->
        [one] Lägg till i citering
       *[other] Lägg till { $count } objekt i citeringen
    }
integration-citationDialog-add-all = Lägg till alla
integration-citationDialog-collapse-section =
    .title = Stäng avsnitt
integration-citationDialog-bubble-empty = (namnlös)
integration-citationDialog-add-to-citation = Lägg till i citering
integration-citationDialog-annotations-filter =
    .placeholder = Filtrera anteckningar
integration-citationDialog-annotations-empty = Välj ett objekt, en bilaga eller en anteckning för att visa information om anteckningen
integration-prefs-displayAs-label = Visa källor som:
integration-prefs-footnotes =
    .label = Fotnoter
integration-prefs-endnotes =
    .label = Slutnoter
integration-prefs-bookmarks =
    .label = Spara citering som bokmärken
integration-prefs-bookmarks-description = Bokmärken kan delas mellan Word och LibreOffice, men kan orsaka fel om de ändras av misstag. De kan inte infogas i fotnoter.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Dokumentet måste sparas som .doc eller .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Uppdatera referenser automatiskt
    .tooltip = Referenser med väntande uppdateringar markeras i dokumentet
integration-prefs-automaticCitationUpdates-description = Slå av uppdateringar för att snabba upp infogandet av referenser i stora dokument. Klicka på Uppdatera för att manuellt uppdatera referenserna.
integration-prefs-automaticJournalAbbeviations =
    .label = Använd MEDLINE:s tidskriftsförkortningar
integration-prefs-automaticJournalAbbeviations-description = Tidskriftsförkortningsfältet kommer att ignoreras.
integration-prefs-exportDocument =
    .label = Byt till en annan ordbehandlare…
integration-error-unable-to-find-winword = { -app-name } kunde inte hitta en aktiv Word-instans.
integration-warning-citation-changes-will-be-lost = Du har gjort ändringar i en citering som går förlorade om du fortsätter.
integration-warning-bibliography-changes-will-be-lost = Du har gjort ändringar i referenslistan som går förlorade om du fortsätter.
integration-warning-documentPreferences-changes-will-be-lost = Du har gjort ändringar i dokumentinställningarna som går förlorade om du fortsätter.
integration-warning-discard-changes = Förkasta ändringar
integration-warning-command-is-running = Ett integrationskommando för ordbehandlaren körs redan.
first-run-guidance-citationDialog =
    Klicka på bubblan eller använd tangenterna ← och ↓ för att visa citeringsdetaljerna och anpassa alternativ såsom sidnummer, prefix och suffix.
    
    Du kan också lägga till ett sidnummer eller en annan platsangivelse genom att ta med den i söktermerna (t.ex. ”history { $locator }”) eller genom att skriva den efter bubblan och trycka på { return-or-enter }.
