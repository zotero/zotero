preferences-window =
    .title = Impostazioni di { -app-name }
preferences-appearance-title = Aspetto e lingua
preferences-auto-recognize-files =
    .label = Recupera automaticamente i metadati di PDF e ebook
preferences-file-renaming-title = Rinominazione dei file
preferences-file-renaming-intro = { -app-name } può rinominare automaticamente i file in accordo con i metadati dell'elemento genitore (titolo, autore, ecc.) e mantenerli sincronizzati con eventuali modifiche. I file scaricati sono sempre rinominati in accordo con l'elemento genitore.
preferences-file-renaming-configure-button =
    .label = Configure File Renaming…
preferences-attachment-titles-title = Titoli degli allegati
preferences-attachment-titles-intro = I titoli degli allegati sono <label data-l10n-name="wiki-link">diversi dai nomi dei file</label>. A supporto di certi flussi di lavoro, { -app-name } può mostrare i nomi dei file al posto dei titoli degli allegati nella lista degli elementi.
preferences-attachment-titles-show-filenames =
    .label = Mostra i nomi dei file degli allegati nella lista degli elementi
preferences-reader-title = Lettore
preferences-reader-open-epubs-using = Apre EPUB con
preferences-reader-open-snapshots-using = Apri pagina web con
preferences-reader-open-in-new-window =
    .label = Apri i file in nuove finestre invece di nuove schede
preferences-reader-auto-disable-tool =
    .label = Disattiva le annotazioni testuale e grafiche dopo ciascun uso
preferences-reader-ebook-font = Font per gli ebook:
preferences-reader-ebook-hyphenate =
    .label = Attiva sillabazionie automatica
preferences-note-title = Note
preferences-note-open-in-new-window =
    .label = Apri le note in una nuova finestra invece che nelle schede
preferences-color-scheme = Schema di colori:
preferences-color-scheme-auto =
    .label = Automatico
preferences-color-scheme-light =
    .label = Chiaro
preferences-color-scheme-dark =
    .label = Scuro
preferences-item-pane-header = Intestazione del riquadro degli elementi:
preferences-item-pane-header-style = Stile di citazione dell'intestazione:
preferences-item-pane-header-locale = Lingua dell'intestazione:
preferences-item-pane-header-missing-style = Stile mancante: <{ $shortName }>
preferences-locate-library-lookup-intro = Il servizio Trova può individuare una risorsa online usando il resolver OpenURL della tua biblioteca.
preferences-locate-resolver = Resolver:
preferences-locate-base-url = URL di base:
preferences-quickCopy-minus =
    .aria-label = { general-remove }
    .label = { $label }
preferences-quickCopy-plus =
    .aria-label = { general-add }
    .label = { $label }
preferences-styleManager-intro = { -app-name } può generare riferimenti bibliografici e bibliografie in più di 10'000 stili citazionali. Aggiungi qui altri stili per renderli disponibili quando selezioni uno stile in  { -app-name }.
preferences-styleManager-get-additional-styles =
    .label = Scarica altri stili…
preferences-styleManager-restore-default =
    .label = Ripristina gli stili predefiniti...
preferences-styleManager-add-from-file =
    .tooltiptext = Aggiungi uno stile da file
    .label = Aggiungi da file…
preferences-styleManager-remove = Premi { delete-or-backspace } per rimuovere questo stile.
preferences-citation-dialog = Finestra di citazione
preferences-citation-dialog-mode = Modalità della finestra di citazione:
preferences-citation-dialog-mode-last-used =
    .label = Ultimo usato
preferences-citation-dialog-mode-list =
    .label = Modalità lista
preferences-citation-dialog-mode-library =
    .label = Modalità biblioteca
preferences-advanced-enable-local-api =
    .label = Autorizza altre applicazione nel computer a comunicare con { -app-name }
preferences-advanced-local-api-available = Disponibile sul sito <code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = Il server HTTP di { -app-name } è disabilitato.
preferences-advanced-server-enable-and-restart =
    .label = Attiva e riavvia
preferences-advanced-language-and-region-title = Lingua e impostazioni regionali
preferences-advanced-enable-bidi-ui =
    .label = Abilita le funzionalità di modifica bidirezionale per il testo
preferences-advanced-reset-data-dir =
    .label = Riprista posizione predefinita…
preferences-advanced-custom-data-dir =
    .label = Usa posizione personalizzata…
preferences-advanced-default-data-dir =
    .value = (Default: { $directory })
    .aria-label = Posizione predefinita
-preferences-sync-data-syncing = Sincronizzazione dei dati
preferences-sync-data-syncing-groupbox =
    .aria-label = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-heading = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-description = Accedi con il tuo account { -app-name } per sincronizzare i dati tra più dispositivi, collaborare con altre persone e molto di più.
preferences-account-log-out =
    .label = Scollega l'account
preferences-sync-reset-restore-to-server-body = { -app-name } sostituirà “{ $libraryName }” su { $domain } con i dati presenti su questo computer.
preferences-sync-reset-restore-to-server-deleted-items-text =
    { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] elemento
       *[other] elementi
    } nella biblioteca online saranno cancellati definitivamente.
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] La biblioteca su questo computer e quella online saranno vuote
        [one] rimarrà 1 elemento nella biblioteca su questo computer e in quella online.
       *[other] rimarranno { $localItemsCount } elementi nella biblioteca su questo computer e in quella online.
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
        [one] Cancella 1 elemento
        [many] Cancella { $remoteItemsDeletedCount } elementi
       *[other] Cancella { $remoteItemsDeletedCount } elementi
    }
preferences-sync-reset-restore-to-server-confirmation-text = cancella biblioteca online
preferences-sync-reset-restore-to-server-yes = Sostituisci i dati nella biblioteca online
preferences-account-log-in =
    .label = Accedi
preferences-account-waiting-for-login =
    .value = Waiting for login…
preferences-account-cancel-button =
    .label = { general-cancel }
preferences-account-logged-out-status =
    .value = (logged out)
preferences-account-email-label =
    .value = Email:
preferences-account-switch-accounts =
    .label = Switch Accounts…
preferences-account-switch-text = Switching to a different account will remove all { -app-name } data on this computer. Before continuing, make sure all data and files you wish to keep have been synced with the “{ $username }” account or you have a backup of your { -app-name } data directory.
preferences-account-switch-confirmation-text = remove local data
preferences-account-switch-accept = Remove Data and Restart
