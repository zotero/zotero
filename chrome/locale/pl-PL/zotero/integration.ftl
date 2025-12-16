integration-docPrefs-window =
    .title = { -app-name } - Ustawienia dokumentu
integration-addEditCitation-window =
    .title = { -app-name } - Dodaj/Edytuj cytowanie
integration-editBibliography-window =
    .title = { -app-name } - Edytuj bibliografię
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Edytuj cytowanie
-integration-editBibliography-include-uncited = To include an uncited item in your bibliography, select it from the items list and press { general-add }.
-integration-editBibliography-exclude-cited = You can also exclude a cited item by selecting it from the list of references and pressing { general-remove }.
-integration-editBibliography-edit-reference = Aby zmienić formatowanie cytowania, użyj edytora tekstu.
integration-editBibliography-wrapper =
    .aria-label = Edytuj bibliografię
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Okno cytowania
integration-citationDialog-section-open = Open Documents ({ $count })
integration-citationDialog-section-selected = Selected Items ({ $count }/{ $total })
integration-citationDialog-section-cited =
    { $count ->
        [0] Cited Items
       *[other] Cited Items ({ $count })
    }
integration-citationDialog-details-suffix = Przyrostek
integration-citationDialog-details-prefix = Przedrostek
integration-citationDialog-details-suppressAuthor = Pomiń autora
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Ustawienia cytowania
integration-citationDialog-lib-no-items =
    { $search ->
        [true] No selected, open, or cited items match the current search
       *[other] No selected or open items
    }
integration-citationDialog-settings-keepSorted = Utrzymaj źródła posortowane
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
integration-citationDialog-search-for-items = Wyszukaj elementy aby dodać je do cytowania
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
    .aria-label = Kolekcje.
    .aria-description = Wybierz kolekcję i wciśnij Tab, aby nawigować po jego elementach.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = This item has been added to the citation. Press { return-or-enter } to add it again or { delete-or-backspace } to remove it.
integration-citationDialog-add-all = Dodaj wszystko
integration-citationDialog-collapse-section =
    .title = Zwiń sekcję
integration-citationDialog-bubble-empty = (brak tytułu)
integration-citationDialog-add-to-citation = Dodaj do cytowania
integration-prefs-displayAs-label = Wyświetl cytowania jako:
integration-prefs-footnotes =
    .label = Przypisy dolne
integration-prefs-endnotes =
    .label = Przypisy końcowe
integration-prefs-bookmarks =
    .label = Zapisz cytowanie jako zakładki
integration-prefs-bookmarks-description = Zakładki mogą być współdzielone między edytorami Word i LibreOffice Writer, ale w razie ich przypadkowej modyfikacji mogą wystąpić błędy i nie mogą być one wstawiane do przypisów dolnych.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Automatycznie aktualizuj cytowania
    .tooltip = Cytowania z oczekującymi aktualizacjami będą podświetlone w dokumencie
integration-prefs-automaticCitationUpdates-description = Wyłączenie aktualizacji cytowań może przyspieszyć wstawianie cytowań w dużych dokumentach. Wciśnij Odśwież, aby ręcznie zaktualizować cytowania.
integration-prefs-automaticJournalAbbeviations =
    .label = Użyj skrótów czasopism w formacie MEDLINE
integration-prefs-automaticJournalAbbeviations-description = Pole "Skrót czasopisma" będzie ignorowane.
integration-prefs-exportDocument =
    .label = Przełącz na inny edytor tekstu...
integration-error-unable-to-find-winword = { -app-name } nie może znaleźć uruchomionego edytora Word.
integration-warning-citation-changes-will-be-lost = Dokonano zmian w cytowaniu, które zostaną utracone, jeśli będziesz kontynuować.
integration-warning-bibliography-changes-will-be-lost = Dokonano zmian w bibliografii, które zostaną utracone, jeśli będziesz kontynuować.
integration-warning-documentPreferences-changes-will-be-lost = Dokonano zmian w ustawieniach dokumentu, które zostaną utracone, jeśli będziesz kontynuować.
integration-warning-discard-changes = Porzuć zmiany
integration-warning-command-is-running = Polecenie integracji z edytorem tekstów jest już uruchomione.
