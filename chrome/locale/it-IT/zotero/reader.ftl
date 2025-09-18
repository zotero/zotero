reader-annotations = Annotazioni
reader-show-annotations = Mostra le annotazioni
reader-search-annotations = Cerca le annotazioni
reader-search-outline = Cerca nella struttura
reader-no-annotations = Crea un'annotazione per vederla nella barra laterale
reader-no-extracted-text = Nessun testo estratto
reader-add-comment = Aggiungi un commento
reader-annotation-comment = Commento dell'annotazione
reader-annotation-text = Testo dell'annotazione
reader-manage-tags = Gestisci tag per questa annotazione
reader-open-menu = Apri menu dell'annotazione
reader-thumbnails = Anteprime
reader-tag-selector-message = Filtra le annotazioni con questo tag
reader-add-tags = Aggiungi tag...
reader-highlight-text = Evidenzia il testo
reader-underline-text = Sottolinea il testo
reader-add-note = Aggiungi nota
reader-add-text = Aggiungi testo
reader-select-area = Seleziona area
reader-highlight-annotation = Annotazione: evidenziatura
reader-underline-annotation = Annotazione: sottolineatura
reader-note-annotation = Annotazione: commento
reader-text-annotation = Annotazione: testo
reader-image-annotation = Annotazione: immagine
reader-ink-annotation = Annotazione: scrittura a mano libera
reader-search-result-index = Risultato della ricerca
reader-search-result-total = Risultati totali
reader-draw = Disegna
reader-eraser = Gomma
reader-pick-color = Scegli un colore
reader-add-to-note = Aggiungi alla nota
reader-zoom-in = Zoom avanti
reader-zoom-out = Zoom indietro
reader-zoom-reset = Ripristina zoom
reader-zoom-auto = Ridimensiona automaticamente
reader-zoom-page-width = Adatta alla larghezza della pagina
reader-zoom-page-height = Adatta all'altezza della pagina
reader-split-vertically = Dividi verticalmente
reader-split-horizontally = Dividi orizzontalmente
reader-next-page = Pagina successiva
reader-previous-page = Pagina precedente
reader-page = Pagina
reader-location = Posizione
reader-read-only = Sola lettura
reader-prompt-transfer-from-pdf-title = Importa le annotazioni
reader-prompt-transfer-from-pdf-text = Le annotazioni presenti nel file PDF verranno spostate in { $target }.
reader-prompt-password-protected = L'operazione non è supportata per i file PDF protetti da password
reader-prompt-delete-pages-title = Elimina pagine
reader-prompt-delete-pages-text =
    { $count ->
        [one] Vuoi cancellare { $count } pagina dal file PDF?
        [many] Vuoi cancellare { $count } pagine dal file PDF?
       *[other] Vuoi cancellare { $count } pagine dal file PDF?
    }
reader-prompt-delete-annotations-title = Elimina annotazioni
reader-prompt-delete-annotations-text =
    { $count ->
        [one] Vuoi eliminare l'annotazione selezionata?
        [many] Vuoi eliminare le annotazioni selezionate?
       *[other] Vuoi eliminare le annotazioni selezionate?
    }
reader-rotate-left = Ruota a sinistra
reader-rotate-right = Ruota a destra
reader-edit-page-number = Modifica il numero di pagina...
reader-edit-annotation-text = Modifica il testo dell'annotazione
reader-copy-image = Copia immagine
reader-save-image-as = Salva immagine come...
reader-page-number-popup-header = Cambia il numero di pagina per:
reader-this-annotation = Questa annotazione
reader-selected-annotations = Annotazioni selezionate
reader-this-page = Questa pagina
reader-this-page-and-later-pages = Questa pagina e le successive
reader-all-pages = Tutte le pagine
reader-auto-detect = Rilevamento automatico
reader-enter-password = Inserisci la password per aprire questo file PDF
reader-include-annotations = Includi annotazioni
reader-preparing-document-for-printing = Preparazione del documento per la stampa...
reader-phrase-not-found = Frase non trovata
reader-find = Trova
reader-close = Chiudi
reader-show-thumbnails = Mostra anteprime
reader-show-outline = Mostra indice
reader-find-previous = Trova l'espressione nella posizione precedente
reader-find-next = Trova l'espressione nella posizione successiva
reader-toggle-sidebar = Apri/Chiudi Barra Laterale
reader-find-in-document = Trova nel documento
reader-toggle-context-pane = Apri/Chiudi riquadro contestuale
reader-highlight-all = Evidenzia tutto
reader-match-case = Maiuscole/minuscole
reader-whole-words = Parole intere
reader-appearance = Aspetto
reader-epub-appearance-line-height = Interlinea
reader-epub-appearance-word-spacing = Spaziatura tra le parole
reader-epub-appearance-letter-spacing = Spaziatura tra le lettere
reader-epub-appearance-page-width = Larghezza della pagina
reader-epub-appearance-use-original-font = Usa il font originale
reader-epub-appearance-line-height-revert = Usa interlinea predefinita
reader-epub-appearance-word-spacing-revert = Usa spaziatura predefinita tra le parole
reader-epub-appearance-letter-spacing-revert = Usa spaziatura predefinita tra le lettere
reader-epub-appearance-page-width-revert = Usa la larghezza di pagina predefinita
reader-convert-to-highlight = Converti in evidenziatura
reader-convert-to-underline = Converti in sottolineatura
reader-size = Dimensione
reader-merge = Unisci
reader-copy-link = Copia link
reader-theme-original = Originale
reader-theme-snow = Neve
reader-theme-sepia = Seppia
reader-theme-dark = Scuro
reader-add-theme = Aggiungi tema
reader-scroll-mode = Scorrimento
reader-spread-mode = Disposizione
reader-flow-mode = Layout di pagina
reader-columns = Colonne
reader-split-view = Vista divisa
reader-themes = Temi
reader-vertical = Verticale
reader-horizontal = Orizzontale
reader-wrapped = Affiancato
reader-none = Nessuno
reader-odd = Dispari
reader-even = Pari
reader-paginated = Impaginato
reader-scrolled = Scorrimento
reader-single = Singola
reader-double = Doppia
reader-theme-name = Nome del tema:
reader-background = Sfondo:
reader-foreground = Primo piano:
reader-focus-mode = Modalità Concentrazione
reader-clear-selection = Cancella la selezione
reader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
reader-a11y-move-annotation = Usa le frecce per spostare l'annotazione
reader-a11y-edit-text-annotation = Per spostarti alla fine dell'annotazione testuale, premi { general-key-shift } e usa i tasti freccia sinistra/destra. Per spostarti all'inizio dell'annotazione, premi { general-key-shift }-{ reader-move-annotation-start-key } e usa le frecce.
reader-a11y-resize-annotation = Per ridimensionare l'annotazione, premi { general-key-shift } e usa le frecce.
reader-a11y-annotation-popup-appeared = Usa il tasto Tab per navigare nel popup dell'annotazione
reader-a11y-annotation-created = Creata { $type }.
reader-a11y-annotation-selected = Selezionata { $type }.
-reader-a11y-textual-annotation-instruction = Per annotare il testo da tastiera, prima usa la funzione “{ reader-find-in-document }” per individuare la frase, quindi premi { general-key-control }-{ option-or-alt }-{ $number } per convertire il risultato della ricerca in un'annotazione.
-reader-a11y-annotation-instruction = Per aggiungere questa annotazione al documento, seleziona il documento e premi { general-key-control }-{ option-or-alt }-{ $number }.
reader-toolbar-highlight =
    .aria-description = { -reader-a11y-textual-annotation-instruction(number: 1) }
    .title = { reader-highlight-text }
reader-toolbar-underline =
    .aria-description = { -reader-a11y-textual-annotation-instruction(number: 2) }
    .title = { reader-underline-text }
reader-toolbar-note =
    .aria-description = { -reader-a11y-annotation-instruction(number: 3) }
    .title = { reader-note-annotation }
reader-toolbar-text =
    .aria-description = { -reader-a11y-annotation-instruction(number: 4) }
    .title = { reader-add-text }
reader-toolbar-area =
    .aria-description = { -reader-a11y-annotation-instruction(number: 5) }
    .title = { reader-select-area }
reader-toolbar-draw =
    .aria-description = Questo tipo di annotazione non può essere creato da tastiera.
    .title = { reader-draw }
reader-find-in-document-input =
    .title = Trova
    .placeholder = { reader-find-in-document }
    .aria-description = Per convertire il risultato di una ricerca in evidenziatura, premi { general-key-control }-{ option-or-alt }-1. Per convertire il risultato in sottolineatura, premi { general-key-control }-{ option-or-alt }-2.
reader-import-from-epub =
    .label = Importa annotazioni da Ebook...
reader-import-from-epub-prompt-title = Importa annotazioni da Ebook
reader-import-from-epub-prompt-text =
    { -app-name } ha individuato { $count ->
        [one] { $count } { $tool } annotazione
       *[other] { $count } { $tool } annotazioni
    }, ultima modifica { $lastModifiedRelative }.
    
    Le annotazioni di { -app-name } precedentemente importate verranno aggiornate.
reader-import-from-epub-no-annotations-current-file =
    Questo ebook non contiene annotazioni importabili.
    
    { -app-name } può importare annotazioni create in Calibre e KOReader.
reader-import-from-epub-no-annotations-other-file =
    “{ $filename }” non sembra contenere alcuna annotazione di Calibre o KOReader.
    
    Se questo file è stato annotato con KOReader, prova a selezionare un file “metadata.epub.lua” manualmente.
reader-import-from-epub-select-other = Seleziona altro file…
