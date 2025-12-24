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
-integration-editBibliography-include-uncited = Aby dołączyć niezacytowany element do Twojej bibliografii, wybierz go z listy elementów i wciśnij { general-add }.
-integration-editBibliography-exclude-cited = Możesz również usunąć zacytowany element, wybierając go z listy cytowań i wciskając { general-remove }.
-integration-editBibliography-edit-reference = Aby zmienić formatowanie cytowania, użyj edytora tekstu.
integration-editBibliography-wrapper =
    .aria-label = Edytuj bibliografię
    .aria-description = { -integration-editBibliography-include-uncited }{ -integration-editBibliography-exclude-cited }{ -integration-editBibliography-edit-reference }
integration-citationDialog = Okno cytowania
integration-citationDialog-section-open = Open Documents ({ $count })
integration-citationDialog-section-selected = Wybrane elementy ({ $count }/{ $total })
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
integration-citationDialog-settings-keepSorted = Utrzymaj źródła posortowane
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = Biblioteka
integration-citationDialog-mode-list = Lista
integration-citationDialog-btn-type-citation =
    .title = Dodaj/Edytuj cytowanie
integration-citationDialog-btn-type-add-note =
    .title = Dodaj notatkę
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Użyj klawiszy strzałki w lewo/prawo, aby nawigować między elementami tego cytowania. Wciśnij Tab, aby wybrać elementy do dodania do tego cytowania.
integration-citationDialog-enter-to-add-item = Wciśnij { return-or-enter }, aby dodać ten element do cytowania.
integration-citationDialog-search-for-items = Wyszukaj elementy aby dodać je do cytowania
integration-citationDialog-aria-bubble =
    .aria-description = Ten element jest już zawarty w cytowaniu. Wciśnij spację, aby dostosować ten element. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Wciśnij Tab, aby wybrać elementy, które mają być dodane do tego cytowania. Wciśnij Escape, aby zapobiec zmianom i zamknąć ten komunikat.
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Wyszukaj notatkę, aby wstawić ją do dokumentu
integration-citationDialog-aria-item-list =
    .aria-description = Użyj klawiszy strzałki w górę/w dół, aby zmienić wybór elementu. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Użyj klawiszy strzałki w lewo/prawo, aby zmienić wybór elementu. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Kolekcje.
    .aria-description = Wybierz kolekcję i wciśnij Tab, aby nawigować po jego elementach.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = Ten element został dodany do cytowania. Wciśnij { return-or-enter }, aby dodać go ponownie lub { delete-or-backspace }, aby go usunąć.
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
        [true] Dokument musi być zapisany jako .doc or .docx.
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
