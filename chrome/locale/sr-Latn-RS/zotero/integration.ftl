integration-docPrefs-window =
    .title = { -app-name } - postavke dokumenta
integration-addEditCitation-window =
    .title = { -app-name } - dodavanje/uređivanje citata
integration-editBibliography-window =
    .title = { -app-name } - uređivanje bibliografije
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Uredi referencu
-integration-editBibliography-include-uncited = Da biste uključili necitiranu stavku u svoju bibliografiju, izaberite je sa liste stavki i pritisnite { general-add }.
-integration-editBibliography-exclude-cited = Takođe možete isključiti citiranu stavku tako što ćete je izabrati sa liste referenci i pritisnuti { general-remove }.
-integration-editBibliography-edit-reference = Da biste promenili formatiranje reference, koristite uređivač teksta.
integration-editBibliography-wrapper =
    .aria-label = Dijalog za uređivanje bibliografije
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Dijalog za citiranje
integration-citationDialog-section-open = Otvoreni dokumenti ({ $count })
integration-citationDialog-section-selected = Izabrane stavke ({ $count }/{ $total })
integration-citationDialog-section-selectedAnnotations = Izabrane napomene
integration-citationDialog-section-selectedItems = Izabrane stavke
integration-citationDialog-section-cited =
    { $count ->
        [0] Citirane stavke
       *[other] Citirane stavke ({ $count })
    }
integration-citationDialog-details-suffix = Sufiks
integration-citationDialog-details-prefix = Prefiks
integration-citationDialog-details-suppressAuthor = Preskoči autora
integration-citationDialog-details-locator-info = Savet: Možete i direktno uneti brojeve stranica i druge lokatore u glavno polje. <a data-l10n-name="docs-link">Saznajte više</a>
integration-citationDialog-details-includeComments = Uključi komentare
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Podešavanja citiranja
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] Nijedna izabrana, otvorena ili citirana stavka se ne poklapa sa trenutnom pretragom
       *[other] Nema izabranih ili otvorenih stavki
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] Nijedna izabrana ili otvorena beleška se ne poklapa sa trenutnom pretragom
       *[other] Nema izabranih ili otvorenih beleški
    }
integration-citationDialog-lib-message-annotations =
    { $search ->
        [true] Nijedna stavka sa napomenama ne odgovara trenutnoj pretrazi
       *[other] Nema izabranih ili otvorenih stavki sa napomenama
    }
integration-citationDialog-settings-keepSorted = Zadrži izvore poređane
integration-citationDialog-preview-error = Pregled nije dostupan
integration-citationDialog-btn-displayPreview =
    .title = Prikaži pregled citata
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = Biblioteka
integration-citationDialog-mode-list = Lista
integration-citationDialog-btn-type-citation =
    .title = Dodaj/uredi citat
integration-citationDialog-btn-type-add-note =
    .title = Dodaj belešku
integration-citationDialog-btn-type-annotations =
    .title = Dodaj napomene
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Koristite strelice levo/desno za navigaciju kroz stavke ovog citata. Pritisnite Tab da izaberete stavke za dodavanje u ovaj citat.
integration-citationDialog-enter-to-add-item = Pritisnite { return-or-enter } da dodate ovu stavku u citat.
integration-citationDialog-search-for-items = Pretražite stavke za dodavanje u citat
integration-citationDialog-aria-bubble =
    .aria-description = Ova stavka je uključena u citat. Pritisnite razmaknicu da prilagodite stavku. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Pritisnite Tab da izaberete stavke za dodavanje u ovaj citat. Pritisnite Escape da odbacite izmene i zatvorite dijalog.
integration-citationDialog-just-added-input-placeholder = Ukucajte „10-15” da citirate stranice, ili pretražite stavke
integration-citationDialog-just-added-input-citation =
    .placeholder = { $placeholder }
    .title = { $title }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Pretražite belešku za umetanje u dokument
integration-citationDialog-single-input-annotations =
    .placeholder = Pretražite napomene za umetanje u dokument
integration-citationDialog-aria-item-list =
    .aria-description = Koristite strelice gore/dole da promenite izbor stavke. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Koristite strelice desno/levo da promenite izbor stavke. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Zbirke.
    .aria-description = Izaberite zbirku i pritisnite Tab za navigaciju kroz njene stavke.
integration-citationDialog-items-table =
    .title = { integration-citationDialog-add-to-citation-tooltip }
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .title = { integration-citationDialog-add-to-citation-tooltip }
    .aria-label = Ova stavka je dodata u citat. Pritisnite { return-or-enter } da je ponovo dodate ili { delete-or-backspace } da je uklonite.
integration-citationDialog-add-to-citation-tooltip =
    { $count ->
        [one] Dodaj u citat
        [few] Dodaj { $count } stavke u citat
       *[other] Dodaj { $count } stavki u citat
    }
integration-citationDialog-add-all = Dodaj sve
integration-citationDialog-collapse-section =
    .title = Skupi odeljak
integration-citationDialog-bubble-empty = (bez naslova)
integration-citationDialog-add-to-citation = Dodaj u citat
integration-citationDialog-annotations-filter =
    .placeholder = Filtriraj napomene
integration-citationDialog-annotations-empty = Izaberite stavku, prilog ili napomenu da biste videli detalje napomene
integration-prefs-displayAs-label = Prikaži citate kao:
integration-prefs-footnotes =
    .label = Fusnote
integration-prefs-endnotes =
    .label = Endnote
integration-prefs-bookmarks =
    .label = Sačuvaj citat u obeleživače
integration-prefs-bookmarks-description = Obeleživači se mogu deliti između programa Word i LibreOffice, ali mogu napraviti probleme ukoliko ih slučajno promenite i ne mogu biti umetnuti kao fusnote.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Morate da sačuvate dokument kao .doc ili .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Automatski ažuriraj citate
    .tooltip = Citati koji čekaju na ažuriranje će biti istaknuti unutar dokumenta
integration-prefs-automaticCitationUpdates-description = Onemogućavanjem ažuriranja možete ubrzati dodavanje citata kada radite sa velikim dokumentima. Uvek možete kliknite na „Osveži“ kako bi ručno ažurirali citate.
integration-prefs-automaticJournalAbbeviations =
    .label = Koristi skraćenice časopisa iz Medlajna
integration-prefs-automaticJournalAbbeviations-description = Polje „Skraćenica časopisa“ će biti zanemareno.
integration-prefs-exportDocument =
    .label = Prebacite se na drugi program za obradu teksta…
integration-error-unable-to-find-winword = { -app-name } ne može da pronađe pokrenuti Word program.
integration-warning-citation-changes-will-be-lost = Napravili ste izmene u citatu koje će biti izgubljene ako nastavite.
integration-warning-bibliography-changes-will-be-lost = Napravili ste izmene u bibliografiji koje će biti izgubljene ako nastavite.
integration-warning-documentPreferences-changes-will-be-lost = Napravili ste izmene u podešavanjima dokumenta koje će biti izgubljene ako nastavite.
integration-warning-discard-changes = Odbaci izmene
integration-warning-command-is-running = Komanda za integraciju sa procesorom teksta je već pokrenuta.
first-run-guidance-citationDialog =
    Kliknite na oblačić ili koristite tastere ← i ↓ da biste videli detalje citata i prilagodili opcije kao što su broj stranice, prefiks i sufiks.
    
    Takođe možete dodati broj stranice ili drugi lokator tako što ćete ga uključiti u svoje termine za pretragu (npr. „istorija { $locator }”) ili tako što ćete ga ukucati nakon oblačića i pritisnuti { return-or-enter }.
