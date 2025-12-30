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
integration-citationDialog = Viittausikkuna
integration-citationDialog-section-open = Avoimia asiakirjoja: ({ $count })
integration-citationDialog-section-selected = Valittuja nimikkeitä ({ $count }/{ $total })
integration-citationDialog-section-cited =
    { $count ->
        [0] Viitatut nimikkeet
       *[other] Viitatut nimikkeet ({ $count })
    }
integration-citationDialog-details-suffix = Jälkiliite
integration-citationDialog-details-prefix = Etuliite
integration-citationDialog-details-suppressAuthor = Piilota tekijä
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Viittausasetukset
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] Ei tämänhetkiseen hakuun täsmääviä valittuja, avoimia tai viitattuja nimikkeitä
       *[other] Ei valittuja eikä avoimia nimikkeitä
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] Yksikään valituista muistiinpanoista ei täsmää tämänhetkiseen hakuun
       *[other] Ei muistiinpanoja valittuna
    }
integration-citationDialog-settings-keepSorted = Pidä lähteet lajiteltuna
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = Kirjasto
integration-citationDialog-mode-list = Lista
integration-citationDialog-btn-type-citation =
    .title = Lisää/muokkaa viitettä
integration-citationDialog-btn-type-add-note =
    .title = Lisää muistiinpano
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Käytä vasenta ja oikeaa nuolinäppäintä siirtyäksesi tämän viittauksen nimikkeissä. Valitse lisättäviä nimikkeitä painamalla sarkainta.
integration-citationDialog-enter-to-add-item = Lisää tämä nimike viittaukseen painamalla { return-or-enter }.
integration-citationDialog-search-for-items = Etsi lisättäviä nimikkeitä tähän viittaukseen
integration-citationDialog-aria-bubble =
    .aria-description = Tämä nimike sisältyy viittaukseeen. Paina välilyöntiä muokataksesi nimikettä. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Paina sarkainnäppäintä valitaksesi nimikkeitä tähän viittaukseen lisättävaäksi. Paina Esc hylätäksesi muutokset ja sulkeaksesi valintaikkunan.
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Etsi muistiinpanoa lisättäväksi tähän asiakirjaan
integration-citationDialog-aria-item-list =
    .aria-description = Muuta nimikkeen valintaa ylä- ja alanuolinäppäimellä. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Muuta nimikkeen valintaa vasemmalla ja oikealla nuolinäppäimellä. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Kokoelmat.
    .aria-description = Valitse kokoelma ja paina sarkainnäppäintä selataksesi nimikkeitä.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = Tämä nimike on lisätty viittaukseen. Paina { return-or-enter } lisätäksesi sen uudestaan tai { delete-or-backspace } poistaaksesi sen.
integration-citationDialog-add-all = Lisää kaikki
integration-citationDialog-collapse-section =
    .title = Kutista osa
integration-citationDialog-bubble-empty = (ei otsikkoa)
integration-citationDialog-add-to-citation = Lisää viittaukseen
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
integration-warning-citation-changes-will-be-lost = Viittaukseen tekemäsi muutokset menetetään jos jatkat.
integration-warning-bibliography-changes-will-be-lost = Lähdeluetteloon tekemäsi muutokset menetetään jos jatkat.
integration-warning-documentPreferences-changes-will-be-lost = Asiakirjan ominaisuuksiin tekemäsi muutokset menetetään jos jatkat.
integration-warning-discard-changes = Hylkää muutokset
integration-warning-command-is-running = Tekstinkäsittelyohjelman integrointikomento on jo käynnissä.
