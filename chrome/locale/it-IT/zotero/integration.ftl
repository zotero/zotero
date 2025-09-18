integration-docPrefs-window =
    .title = { -app-name } - Preferenze del documento
integration-addEditCitation-window =
    .title = { -app-name } - Aggiungi/modifica citazione
integration-editBibliography-window =
    .title = { -app-name } - Modifica bibliografia
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Modifica riferimento
-integration-editBibliography-include-uncited = Per includere un elemento non citato nella bibliografia, selezionalo e premi { general-add }.
-integration-editBibliography-exclude-cited = Puoi anche escludere un elemento citato selezionandolo nella lista e premendo { general-remove }.
-integration-editBibliography-edit-reference = Per cambiare la formattazione di un riferimento, usa l'editor di testo.
integration-editBibliography-wrapper =
    .aria-label = Finestra di modifica della bibliografia
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Finestra di citazione
integration-citationDialog-section-open = Apri documenti ({ $count })
integration-citationDialog-section-selected = Elementi selezionati ({ $count }/{ $total })
integration-citationDialog-section-cited =
    { $count ->
        [0] Elementi citati
       *[other] Elementi citati ({ $count })
    }
integration-citationDialog-details-suffix = Suffisso
integration-citationDialog-details-prefix = Prefisso
integration-citationDialog-details-suppressAuthor = Ometti l'autore
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Impostazioni di citazione
integration-citationDialog-lib-no-items =
    { $search ->
        [true] Nessun elemento selezionato, aperto o citato corrisponde alla ricerca
       *[other] Nessun elemento selezionato o aperto
    }
integration-citationDialog-settings-keepSorted = Mantieni l'ordinamento delle fonti
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-btn-mode =
    .title =
        { $mode ->
            [library] Passa alla modalità lista
            [list] Passa alla modalità biblioteca
           *[other] Cambia modalità
        }
    .aria-label =
        { $mode ->
            [library] La finestra è in modalità biblioteca. Clicca per passare alla modalità lista.
            [list] La finestra è in modalità lista. Clicca per passare alla modalità biblioteca
           *[other] Cambia modalità
        }
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Usa le frecce sinistra/destra per navigare tra gli elementi in questa citazione. Premi Tab per selezionare gli elementi da aggiungere a questa citazione.
integration-citationDialog-enter-to-add-item = Premi { return-or-enter } per aggiungere questo elemento alla citazione.
integration-citationDialog-search-for-items = Cerca elementi da aggiungere alla citazione
integration-citationDialog-aria-bubble =
    .aria-description = Questo elemento è incluso nella citazione. Premi la barra spaziatrice per personalizzare l'elemento. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Premi Tab per selezionare gli elementi da aggiungere a questa citazione. Premi Esc per scartare le modifiche e chiudere la finestra
integration-citationDialog-input =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-aria-item-list =
    .aria-description = Usa le frecce su/giù per cambiare la selezione degli elementi. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Usa le frecce sinistra/destra per cambiare la selezione degli elementi. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Collezioni.
    .aria-description = Seleziona una collezione e premi Tab per navigare tra i suoi elementi.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = Questo elemento è stato aggiunto alla citazione. Premi { return-or-enter } per  aggiungerlo di nuovo o  { delete-or-backspace } per rimuoverlo.
integration-citationDialog-add-all = Aggiungi tutti
integration-citationDialog-collapse-section =
    .title = Comprimi sezione
integration-citationDialog-bubble-empty = (nessun titolo)
integration-citationDialog-add-to-citation = Aggiungi alla citazione
integration-prefs-displayAs-label = Mostra citazioni come:
integration-prefs-footnotes =
    .label = Note a piè di pagina
integration-prefs-endnotes =
    .label = Note finali
integration-prefs-bookmarks =
    .label = Salva citazioni come segnalibri
integration-prefs-bookmarks-description = I segnalibri possono essere condivisi tra Word e LibreOffice, ma possono causare errori se modificati accidentalmente e non possono essere inseriti nelle note a piè di pagina.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Il documento va salvato in .doc o .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Aggiorna le citazioni automaticamente
    .tooltip = Le citazioni con aggiornamenti in sospeso saranno evidenziate nel documeto
integration-prefs-automaticCitationUpdates-description = Disabilitare l'aggiornamento può velocizzare l'inserimento delle citazioni nei documenti di grandi dimensioni. Clicca su Ricarica per aggiornare le citazioni manualmente.
integration-prefs-automaticJournalAbbeviations =
    .label = Abbrevia i titoli delle riviste secondo lo standard MEDLINE
integration-prefs-automaticJournalAbbeviations-description = Il campo "Abbreviazione rivista" sarà ignorato.
integration-prefs-exportDocument =
    .label = Passa ad un altro programma di scrittura…
integration-error-unable-to-find-winword = { -app-name } non è stato in grado di individuare un'istanza di Word in esecuzione.
integration-warning-citation-changes-will-be-lost = Se continui le modifiche effettuate alla citazione verranno perse.
integration-warning-bibliography-changes-will-be-lost = Se continui le modifiche effettuate alla bibliografia verranno perse.
integration-warning-documentPreferences-changes-will-be-lost = Se continui le modifiche effettuate alle preferenze del documento verranno perse.
integration-warning-discard-changes = Scarta modifiche
integration-warning-command-is-running = Un comando dell'estensione del word processor è già in esecuzione
