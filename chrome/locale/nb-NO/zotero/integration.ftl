integration-docPrefs-window =
    .title = { -app-name } - Innstillinger for dokument
integration-addEditCitation-window =
    .title = { -app-name } - Legg til/rediger henvisning
integration-editBibliography-window =
    .title = { -app-name } - Rediger bibliografi
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Rediger referanse
-integration-editBibliography-include-uncited = Hvis du vil inkludere et usitert element i bibliografien, velger du det i listen over elementer og trykker på { general-add }.
-integration-editBibliography-exclude-cited = Du kan også ekskludere et sitert element ved å velge det fra referanselisten og trykke { general-remove }.
-integration-editBibliography-edit-reference = For å endre formatering for en referanse, bruk tekstredigerer.
integration-editBibliography-wrapper =
    .aria-label = Dialogboks for å rediger bibliografi
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Henvisningsdialogboks
integration-citationDialog-section-open = Åpne dokumenter ({ $count })
integration-citationDialog-section-selected = Valgte elementer ({ $count }/{ $total })
integration-citationDialog-section-cited =
    { $count ->
        [0] Henviste elementer
       *[other] Henviste elementer ({ $count })
    }
integration-citationDialog-details-suffix = Suffiks
integration-citationDialog-details-prefix = Prefiks
integration-citationDialog-details-suppressAuthor = Utelat forfatter
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Innstillinger for henvisnger
integration-citationDialog-lib-no-items =
    { $search ->
        [true] Ingen valgte, åpne eller henviste elementer samsvarer med det aktuelle søket
       *[other] Ingen valgte eller åpne elementer
    }
integration-citationDialog-settings-keepSorted = Behold sortering av kildene
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-btn-mode =
    .title =
        { $mode ->
            [library] Bytt til listemodus
            [list] Bytt til biblioteksmodus
           *[other] Bytt modus
        }
    .aria-label =
        { $mode ->
            [library] Dialogboksen er i biblioteksmodus. Klikk for å bytte til listemodus.
            [list] Dialogboksen er i listemodus. Klikk for å bytte til biblioteksmodus.
           *[other] Bytt modus
        }
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Bruk venstre/høyre pil for å navigere mellom elementene i denne henvisningen. Trykk Tab for å velge elementer som skal legges til i denne henvisningen.
integration-citationDialog-enter-to-add-item = Trykk { return-or-enter } for å legge til dette elementet i henvisningen.
integration-citationDialog-search-for-items = Søk etter elementer for å legge til henvisningen
integration-citationDialog-aria-bubble =
    .aria-description = Dette elementet er inkludert i referansen. Trykk mellomromstasten for å tilpasse elementet. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Trykk på Tab for å velge elementer som skal legges til i denne henvisningen. Trykk på Escape for å forkaste endringene og lukke dialogboksen.
integration-citationDialog-input =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-aria-item-list =
    .aria-description = Bruk opp-/nedpilen for å endre valg av element. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Bruk høyre/venstre pil for å endre valg av element. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Samlinger.
    .aria-description = Velg en samling og trykk Tab for å bla gjennom elementene.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = Dette elementet er lagt til i henvisningen. Trykk { return-or-enter } for å legge den til igjen, eller { delete-or-backspace } for å fjerne den.
integration-citationDialog-add-all = Legg til alle
integration-citationDialog-collapse-section =
    .title = Skjul seksjon
integration-citationDialog-bubble-empty = (ingen tittel)
integration-citationDialog-add-to-citation = Legg til henvisning
integration-prefs-displayAs-label = Vis henvisninger som:
integration-prefs-footnotes =
    .label = Fotnoter
integration-prefs-endnotes =
    .label = Sluttnoter
integration-prefs-bookmarks =
    .label = Lagre henvisninger som bokmerker
integration-prefs-bookmarks-description = Bokmerker kan bli delt mellom Word og LibreOffice, men kan forårsake feil dersom de blir endret ved en tilfeldighet og kan ikke settes inn i fotnoter.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Dokumentet må lagres som .doc eller .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Automatisk oppdater henvisninger
    .tooltip = Henvisninger som venter på å bli oppdatert er uthevet i dokumentet
integration-prefs-automaticCitationUpdates-description = Ved å slå av oppdateringer kan du gjøre innsetting av henvisninger raskere i store dokumenter. Klikk på Oppdater for å oppdatere henvisninger manuelt.
integration-prefs-automaticJournalAbbeviations =
    .label = Bruk MEDLINE forkortelser for tidsskrift
integration-prefs-automaticJournalAbbeviations-description = Feltet "Tidsskriftsforkortelse" vil bli ignorert.
integration-prefs-exportDocument =
    .label = Bytt til en annen tekstbehandler…
integration-error-unable-to-find-winword = { -app-name } kunne ikke finne en Word-versjon som kjører.
integration-warning-citation-changes-will-be-lost = Du har gjort endringer i en henvisning som vil gå tapt hvis du fortsetter.
integration-warning-bibliography-changes-will-be-lost = Du har gjort endringer i bibliografien som vil gå tapt hvis du fortsetter.
integration-warning-documentPreferences-changes-will-be-lost = Du har gjort endringer i innstillingene for dokumentet som vil gå tapt hvis du fortsetter.
integration-warning-discard-changes = Forkast endringer
integration-warning-command-is-running = En kommando for tekstbehandlingsintegrasjon kjører allerede.
