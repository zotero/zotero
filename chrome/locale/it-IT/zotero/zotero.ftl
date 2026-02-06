general-sentence-separator = { " " }
general-key-control = Control
general-key-shift = Maiusc
general-key-alt = Alt
general-key-option = Option
general-key-command = Command
option-or-alt =
    { PLATFORM() ->
        [macos] { general-key-option }
       *[other] { general-key-alt }
    }
command-or-control =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-control }
    }
return-or-enter =
    { PLATFORM() ->
        [macos] Invio
       *[other] Invio
    }
delete-or-backspace =
    { PLATFORM() ->
        [macos] Invio
       *[other] Invio
    }
general-print = Stampa
general-remove = Rimuovi
general-add = Aggiungi
general-remind-me-later = Ricordamelo più tardi
general-dont-ask-again = Non chiedere più
general-choose-file = Scegli il file…
general-open-settings = Apri impostazioni
general-settings = Impostazioni...
general-help = Aiuto
general-tag = Tag
general-done = Fatto
general-view-troubleshooting-instructions = Vedi le istruzioni di risoluzione dei problemi
general-go-back = Indietro
general-accept = Accetta
general-cancel = Annulla
general-show-in-library = Mostra nella biblioteca
general-restartApp = Riavvia { -app-name }
general-restartInTroubleshootingMode = Riavvia in Modalità Provvisoria
general-save = Salva
general-clear = Cancella
general-update = Aggiorna
general-back = Indietro
general-edit = Modifica
general-cut = Taglia
general-copy = Copia
general-paste = Incolla
general-find = Trova
general-delete = Elimina
general-insert = Inserisci
general-and = e
general-et-al = et al.
general-previous = Precedente
general-next = Successivo
general-learn-more = Approfondisci
general-warning = Attenzione
general-type-to-continue = Digita “{ $text }” per continuare.
general-continue = Continua
general-red = Rosso
general-orange = Arancione
general-yellow = Giallo
general-green = Verde
general-teal = Foglia di tè
general-blue = Blu
general-purple = Rosa
general-magenta = Magenta
general-violet = Violetto
general-maroon = Bordeaux
general-gray = Grigio
general-black = Nero
general-loading = Caricamento in corso…
citation-style-label = Stile di citazione:
language-label = Lingua:
menu-custom-group-submenu =
    .label = Altre opzioni...
menu-file-show-in-finder =
    .label = Mostra nel Finder
menu-file-show-file =
    .label = Mostra il file
menu-file-show-files =
    .label = Mostra file
menu-print =
    .label = { general-print }
menu-density =
    .label = Densità
add-attachment = Aggiungi un allegato
new-note = Nuova nota
menu-add-by-identifier =
    .label = Aggiungi da identificatore…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Aggiungi file…
menu-add-standalone-linked-file-attachment =
    .label = Aggiungi collegamento al file…
menu-add-child-file-attachment =
    .label = Allega file...
menu-add-child-linked-file-attachment =
    .label = Allega collegamento al file…
menu-add-child-linked-url-attachment =
    .label = Allega link web…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nuova nota indipendente
menu-new-item-note =
    .label = Nuova nota dell'elemento
menu-restoreToLibrary =
    .label = Ripristina nella biblioteca
menu-deletePermanently =
    .label = Elimina definitivamente…
menu-tools-plugins =
    .label = Plugin
menu-view-columns-move-left =
    .label = Sposta colonna a sinistra
menu-view-columns-move-right =
    .label = Sposta colonna a destra
menu-view-hide-context-annotation-rows =
    .label = Nascondi le annotazioni non-corrispondenti
menu-view-note-font-size =
    .label = Dimensione del font nelle note
menu-view-note-tab-font-size =
    .label = Dimensione font nella scheda delle note
menu-show-tabs-menu =
    .label = Mostra menù delle schede
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Copia annotazione
            [many] Copia { $count } annotazioni
           *[other] Copia { $count } annotazioni
        }
main-window-command =
    .label = Biblioteca
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = Elenca tutte le schede
filter-collections = Filtra collezioni
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Cerca schede
zotero-tabs-menu-close-button =
    .title = Chiudi scheda
zotero-toolbar-tabs-scroll-forwards =
    .title = Scorri in avanti
zotero-toolbar-tabs-scroll-backwards =
    .title = Scorri indietro
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Rinomina collezione
collections-menu-edit-saved-search =
    .label = Modifica ricerca salvata
collections-menu-move-collection =
    .label = Sposta in
collections-menu-copy-collection =
    .label = Copia in
item-creator-moveDown =
    .label = Sposta in basso
item-creator-moveToTop =
    .label = Sposta in cima
item-creator-moveUp =
    .label = Sposta in alto
item-menu-viewAttachment =
    .label =
        Apri { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Pagina web
                    [note] Nota
                   *[other] Allegato
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Pagine web
                    [note] Note
                   *[other] Allegati
                }
        } { $openIn ->
            [tab] in nuova scheda
            [window] in nuova finestra
           *[other] { "" }
        }
item-menu-add-file =
    .label = File
item-menu-add-linked-file =
    .label = File collegato
item-menu-add-url =
    .label = Link web
item-menu-change-parent-item =
    .label = Cambia elemento genitore...
item-menu-relate-items =
    .label = Correla elementi
view-online = Visualizza online
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Il file è stato rinominato in { $filename }
itembox-button-options =
    .tooltiptext = Apri menu contestuale
itembox-button-merge =
    .aria-label = Scegli la versione del campo { $field }
create-parent-intro = Inserisci un DOI, ISBN, PMID, arXiv ID, o ADS Bibcode per identificare questo file:
reader-use-dark-mode-for-content =
    .label = Usa la modalità scura per il contenuto
update-updates-found-intro-minor = È disponibile un aggiornamento per { -app-name }:
update-updates-found-desc = È fortemente raccomandato di aggiornare il prima possibile.
import-window =
    .title = Importazione
import-where-from = Importa da:
import-online-intro-title = Introduzione
import-source-file =
    .label = File (BibTeX, RIS, Zotero RDF, ecc.)
import-source-folder =
    .label = Una cartella di PDF o altri file
import-source-online =
    .label = Importazione online da { $targetApp }
import-options = Opzioni
import-importing = Importazione in corso…
import-create-collection =
    .label = Inserisci le collezioni e gli elementi importati all'interno di una nuova collezione
import-recreate-structure =
    .label = Ricrea la struttura delle cartelle come collezioni
import-fileTypes-header = Tipi di file da importare:
import-fileTypes-pdf =
    .label = PDF
import-fileTypes-other =
    .placeholder = Altri file secondo uno schema, separati da virgola (es. *.jpg,*.png)
import-file-handling = Gestione dei file
import-file-handling-store =
    .label = Copia i file nella cartella di archiviazione di { -app-name }
import-file-handling-link =
    .label = Collegamento ai file nel percorso originale
import-fileHandling-description = { -app-name } non è stato in grado di sincronizzare i file collegati.
import-online-new =
    .label = Scarica solo i nuovi elementi; non aggiornare gli elementi importati in precedenza
import-mendeley-username = Nome utente
import-mendeley-password = Password
general-error = Errore
file-interface-import-error = Si è verificato un errore durante il tentativo di importazione del file selezionato. Assicurarsi che il file sia valido e riprovare.
file-interface-import-complete = Importazione completata
file-interface-items-were-imported =
    { $numItems ->
        [0] Nessun elemento importato
        [one] Un elemento importato
       *[other] { $numItems } elementi importati
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Nessun elemento ricollegato
        [one] Un elemento ricollegato
       *[other] { $numRelinked } elementi ricollegati
    }
import-mendeley-encrypted = Non è possibile leggere il database Mendeley selezionato, probabilmente perché crittografato. Leggi <a data-l10n-name="mendeley-import-kb">Come importare una biblioteca Mendeley in Zotero?</a> per ulteriori informazioni.
file-interface-import-error-translator = L'importazione del file selezionato con “{ $translator }” ha dato un errore. Si prega di controllare che sia un file valido e riprovare.
import-online-intro = Nel passaggio successivo verrà richiesto di autenticarsi in { $targetAppOnline } e fornire l'accesso a { -app-name }. Ciò è necessario per importare la biblioteca di { $targetApp } in { -app-name }.
import-online-intro2 = { -app-name } non sarà mai in grado di vedere o salvare la password di { $targetApp }.
import-online-form-intro = Inserisci le tue credenziali per autenticarti in  { $targetAppOnline }. Ciò è necessario per importare la biblioteca di { $targetApp } in { -app-name }.
import-online-wrong-credentials = L'autenticazione in { $targetApp } è fallita. Si prega di re-inserire le proprie credenziali e riprovare.
import-online-blocked-by-plugin = L'importazione non può proseguire se  { $plugin } è installato. Si prega di disabilitare questo plugin e riprovare.
import-online-relink-only =
    .label = Ricollega le citazioni di Mendeley Desktop
import-online-relink-kb = Ulteriori informazioni
import-online-connection-error = { -app-name } non è riuscito a connettersi a { $targetApp }. Si prega di verificare la propria connessione a internet e riprovare.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Nota
            [many] { $count } Note
           *[other] { $count } Note
        }
report-error =
    .label = Segnala un errore…
rtfScan-wizard =
    .title = Scansione RTF
rtfScan-introPage-description = { -app-name } può estrarre e riformattare automaticamente le citazioni e inserire una bibliografia in un file RTF. Al momento supporta citazioni in varianti di uno di questi formati:
rtfScan-introPage-description2 = Per iniziare, seleziona un file RTF e un file di destinazione qui sotto:
rtfScan-input-file = File di origine:
rtfScan-output-file = File di destinazione:
rtfScan-no-file-selected = Nessun file selezionato
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Scegli file di origine
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Scegli file di destinazione
rtfScan-intro-page = Introduzione
rtfScan-scan-page = Ricerca di citazioni in corso
rtfScan-scanPage-description = { -app-name } sta analizzando il documento in cerca di citazioni. Si prega di attendere.
rtfScan-citations-page = Verifica gli elementi citati
rtfScan-citations-page-description = Si prega di controllare la lista di citazioni riconosciute per assicurarsi che { -app-name } abbia selezionato correttamente gli elementi corrispondenti. Ogni citazione non associata ad alcun elemento o ambigua dovrà essere corretta prima di procedere alla prossima fase.
rtfScan-style-page = Formattazione del documento
rtfScan-format-page = Formattazione delle citazioni
rtfScan-format-page-description = { -app-name } sta elaborando e formattando il file RTF. Si prega di attendere.
rtfScan-complete-page = Elaborazione RTF completata
rtfScan-complete-page-description = Il tuo documento è stato elaborato. Per favore assicurati che sia stato formattato correttamente.
rtfScan-action-find-match =
    .title = Seleziona un elemento corrispondente
rtfScan-action-accept-match =
    .title = Accetta questa corrispondenza
runJS-title = Esegui JavaScript
runJS-editor-label = Codice:
runJS-run = Esegui
runJS-help = { general-help }
runJS-completed = completato con successo
runJS-result =
    { $type ->
        [async] Valore restituito:
       *[other] Risultato:
    }
runJS-run-async = Esegui come funzione asincrona
bibliography-window =
    .title = { -app-name } - Crea Citazione/Bibliografia
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Mostra citazioni come:
bibliography-advancedOptions-label = Opzioni avanzate
bibliography-outputMode-label = Modalità di output:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citazioni
            [note] Note
           *[other] Citazioni
        }
bibliography-outputMode-bibliography =
    .label = Bibliografia
bibliography-outputMethod-label = Metodo di output:
bibliography-outputMethod-saveAsRTF =
    .label = Salva come RTF
bibliography-outputMethod-saveAsHTML =
    .label = Salva come HTML
bibliography-outputMethod-copyToClipboard =
    .label = Copia negli appunti
bibliography-outputMethod-print =
    .label = Stampa
bibliography-manageStyles-label = Gestisci gli stili...
styleEditor-locatorType =
    .aria-label = Tipo di indicatore di posizione
styleEditor-locatorInput = Valore dell'indicatore di posizione
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Editor degli stili
styleEditor-preview =
    .aria-label = Anteprima
publications-intro-page = Le mie pubblicazioni
publications-intro = Gli elementi aggiunti a "Le mie pubblicazioni" verranno mostrati sulla tua pagina profilo su zotero.org. Se scegli di includere dei file allegati, questi verranno resi disponibili pubblicamente con la licenza da te specificata. Aggiungi soltanto lavori che tu stesso hai creato e includi i file solo se desideri diffonderli e se sei in possesso dei diritti per farlo.
publications-include-checkbox-files =
    .label = Includi i file
publications-include-checkbox-notes =
    .label = Includi le note
publications-include-adjust-at-any-time = Puoi decidere che cosa desideri mostrare nella collezione "Le mie pubblicazioni" in qualsiasi momento.
publications-intro-authorship =
    .label = Ho creato io quest'opera.
publications-intro-authorship-files =
    .label = Ho creato io quest'opera e ho diritto di distribuire i file inclusi.
publications-sharing-page = Scegli come condividere la tua opera
publications-sharing-keep-rights-field =
    .label = Mantieni il campo "diritti" esistente
publications-sharing-keep-rights-field-where-available =
    .label = Mantieni il campo "diritti" quando disponibile
publications-sharing-text = Puoi decidere di riservare tutti i diritti della tua opera, di pubblicarla sotto licenza Creative Commons oppure di assegnarla al pubblico dominio. In ogni caso, tieni presente che la tua opera verrà messa a disposizione del pubblico tramite zotero.org.
publications-sharing-prompt = Vuoi permettere che la tua opera sia condivisibile da altri?
publications-sharing-reserved =
    .label = No, pubblica la mia opera solo su zotero.org
publications-sharing-cc =
    .label = Sì, con una licenza Creative Commons
publications-sharing-cc0 =
    .label = Sì, assegnando la mia opera al pubblico dominio
publications-license-page = Scegli una licenza Creative Commons
publications-choose-license-text = Una licenza Creative Commons permette ad altri di copiare e ridistribuire la tua opera purché riconoscano correttamente chi è l'autore, forniscano un link alla licenza e indichino se hanno apportato modifiche. Ulteriori condizioni possono essere specificate di seguito.
publications-choose-license-adaptations-prompt = Vuoi permettere che adattamenti della tua opera siano condivisi?
publications-choose-license-yes =
    .label = Si
    .accesskey = Y
publications-choose-license-no =
    .label = No
    .accesskey = N
publications-choose-license-sharealike =
    .label = Sì, purché venga condivisa con la stessa licenza
    .accesskey = S
publications-choose-license-commercial-prompt = Vuoi permettere usi commerciali della tua opera?
publications-buttons-add-to-my-publications =
    .label = Aggiungi a "Le mie pubblicazioni"
publications-buttons-next-sharing =
    .label = Prossimo: Condivisione
publications-buttons-next-choose-license =
    .label = Scegli una Licenza
licenses-cc-0 = CC0 1.0 Universal (Pubblico Dominio)
licenses-cc-by = Licenza Creative Commons Attribuzione 4.0 Internazionale  (CC BY 4.0)
licenses-cc-by-nd = Licenza Creative Commons Attribuzione - Non opere derivate 4.0 Internazionale (CC BY-ND 4.0)
licenses-cc-by-sa = Licenza Creative Commons Attribuzione - Condividi allo stesso modo 4.0 Internazionale (CC BY-SA 4.0)
licenses-cc-by-nc = Licenza Creative Commons Attribuzione - Non commerciale 4.0 Internazionale (CC BY-NC 4.0)
licenses-cc-by-nc-nd = Licenza Creative Commons Attribuzione - Non commerciale - Non opere derivate 4.0 Internazionale (CC BY-NC-ND 4.0)
licenses-cc-by-nc-sa = Licenza Creative Commons Attribuzione - Non commerciale - Condividi allo stesso modo 4.0 Internazionale (CC BY-NC-SA 4.0)
licenses-cc-more-info = Si prega di leggere la pagina <a data-l10n-name="license-considerations">Considerations for licensors</a> (in inglese) prima di applicare una licenza CC alla propria opera. La licenza applicata non potrà essere revocata, nemmeno se in futuro deciderai di applicare differenti condizioni o di interrompere la pubblicazione dell'opera.
licenses-cc0-more-info = Si prega di leggere la pagina <a data-l10n-name="license-considerations">CC0 FAQ</a> (in inglese) prima di assegnare la propria opera al pubblico dominio con una CC0. Questa operazione è irreversibile, anche se in futuro deciderai di applicare differenti condizioni o di interrompere la pubblicazione dell'opera.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Riavvia in Modalità Provvisoria…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } verrà riavviato con tutti i plugin disabilitati. Alcune caratteristiche potrebbero non funzionare correttamente in Modalità Provvisoria.
menu-ui-density =
    .label = Densità
menu-ui-density-comfortable =
    .label = Confortevole
menu-ui-density-compact =
    .label = Compatta
pane-item-details = Dettagli dell'elemento
pane-info = Informazioni
pane-abstract = Abstract
pane-attachments = Allegati
pane-notes = Note
pane-note-info = Informazioni sulla nota
pane-libraries-collections = Biblioteche e Collezioni
pane-tags = Tag
pane-related = Correlazioni
pane-attachment-info = Informazioni sugli allegati
pane-attachment-preview = Anteprima
pane-attachment-annotations = Annotazioni
pane-header-attachment-associated =
    .label = Rinomina file associato
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } Allegato
            [many] { $count } Allegati
           *[other] { $count } Allegati
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } Annotazione
            [many] { $count } Annotazioni
           *[other] { $count } Annotazioni
        }
section-attachments-move-to-trash-message = Vuoi spostare “{ $title }” nel Cestino?
section-notes =
    .label =
        { $count ->
            [one] { $count } Nota
            [many] { $count } Note
           *[other] { $count } Note
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } Tag
            [many] { $count } Tag
           *[other] { $count } Tag
        }
section-related =
    .label = { $count } Correlazioni
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Espandi sezione
    .label = Espandi la sezione { $section }
section-button-collapse =
    .dynamic-tooltiptext = Comprimi sezione
    .label = Comprimi la sezione { $section }
annotations-count =
    { $count ->
        [one] { $count } Annotazione
        [many] { $count } Annotazioni
       *[other] { $count } Annotazioni
    }
section-button-annotations =
    .title = { annotations-count }
    .aria-label = { annotations-count }
attachment-preview =
    .aria-label = { pane-attachment-preview }
sidenav-info =
    .tooltiptext = { pane-info }
sidenav-abstract =
    .tooltiptext = { pane-abstract }
sidenav-attachments =
    .tooltiptext = { pane-attachments }
sidenav-notes =
    .tooltiptext = { pane-notes }
sidenav-note-info =
    .tooltiptext = { pane-note-info }
sidenav-attachment-info =
    .tooltiptext = { pane-attachment-info }
sidenav-attachment-preview =
    .tooltiptext = { pane-attachment-preview }
sidenav-attachment-annotations =
    .tooltiptext = { pane-attachment-annotations }
sidenav-libraries-collections =
    .tooltiptext = { pane-libraries-collections }
sidenav-tags =
    .tooltiptext = { pane-tags }
sidenav-related =
    .tooltiptext = { pane-related }
sidenav-main-btn-grouping =
    .aria-label = { pane-item-details }
sidenav-reorder-up =
    .label = Sposta la sezione in alto
sidenav-reorder-down =
    .label = Sposta la sezione in basso
sidenav-reorder-reset =
    .label = Ripristina l'ordine delle sezioni
toggle-item-pane =
    .tooltiptext = Apri/Chiudi riquadro degli elementi
toggle-context-pane =
    .tooltiptext = Apri/Chiudi riquadro contestuale
pin-section =
    .label = Fissa sezione
unpin-section =
    .label = Sblocca sezione
collapse-other-sections =
    .label = Comprimi altre sezioni
expand-all-sections =
    .label = Espandi tutte le sezioni
abstract-field =
    .placeholder = Aggiungi abstract…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtra i tag
context-notes-search =
    .placeholder = Cerca nelle note
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Nuova collezione…
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Nuova collezione
    .buttonlabelaccept = Crea collezione
new-collection-name = Nome:
new-collection-create-in = Crea in:
show-publications-menuitem =
    .label = Mostra Le mie pubblicazioni
attachment-info-title = Titolo
attachment-info-filename = Nome File
attachment-info-accessed = Consultato
attachment-info-pages = Pagine
attachment-info-modified = Data ultima modifica
attachment-info-index = Indicizzato
attachment-info-convert-note =
    .label =
        Converti in nota { $type ->
            [standalone] indipendente
            [child] dell'elemento
           *[unknown] nuova
        }
    .tooltiptext = Non è più possibile aggiungere note agli allegati, ma puoi modificare la nota corrente convertendola in una separata.
section-note-info =
    .label = { pane-note-info }
note-info-title = Titolo
note-info-parent-item = Elemento genitore
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] Nessuno
    }
    .title =
        { $hasParentItem ->
            [true] Vedi elemento genitore nella biblioteca
           *[false] Vedi la nota nella biblioteca
        }
note-info-date-created = Creato
note-info-date-modified = Data ultima modifica
note-info-size = Dimensione
note-info-word-count = Numero di parole
note-info-character-count = Numero di caratteri
item-title-empty-note = Nota senza titolo
attachment-preview-placeholder = Nessun allegato da mostrare
attachment-rename-from-parent =
    .tooltiptext = Rinominare il file in base ai metadati dell'elemento genitore
file-renaming-auto-rename-prompt-title = Modificate le impostazioni di auto-rinominazione
file-renaming-auto-rename-prompt-body = Vuoi rinominare i file nella tua biblioteca in accordo con le nuove impostazioni?
file-renaming-auto-rename-prompt-yes = Anteprima modifiche...
file-renaming-auto-rename-prompt-no = Mantieni i nomi correnti dei file
rename-files-preview =
    .buttonlabelaccept = Rinomina file
rename-files-preview-loading = In caricamento...
rename-files-preview-intro = { -app-name } rinominerà i seguenti file nella tua libreria secondo i metadati del rispettivo elemento genitore:
rename-files-preview-renaming = Rinominazione in corso...
rename-files-preview-no-files = Tutti i file corrispondono già al proprio elemento genitore. Nessuna modifica richiesta.
toggle-preview =
    .label =
        { $type ->
            [open] Nascondi
            [collapsed] Mostra
           *[unknown] Cambia visibilità
        } Attachment Preview
annotation-image-not-available = [Immagine non disponibile]
quicksearch-mode =
    .aria-label = Modalità Ricerca veloce
quicksearch-input =
    .aria-label = Ricerca veloce
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Visualizza come
item-pane-header-none =
    .label = Nessuno
item-pane-header-title =
    .label = Titolo
item-pane-header-titleCreatorYear =
    .label = Titolo, Autore, Anno
item-pane-header-bibEntry =
    .label = Riferimento bibliografico
item-pane-header-more-options =
    .label = Altre opzioni
item-pane-message-items-selected =
    { $count ->
        [0] Nessun elemento selezionato
        [one] { $count } elemento selezionato
       *[other] { $count } elementi selezionati
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } collezione selezionata
        [many] { $count } collezioni selezionate
       *[other] { $count } collezioni selezionate
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } ricerca selezionata
        [many] { $count } ricerche selezionate
       *[other] { $count } ricerche selezionate
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } oggetto selezionato
        [many] { $count } oggetti selezionati
       *[other] { $count } oggetti selezionati
    }
item-pane-message-unselected =
    { $count ->
        [0] Nessun elemento in questa schermata
        [one] { $count } elemento in questa schermata
       *[other] { $count } elementi in questa schermata
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] Nessun oggetto in questa schermata
        [one] { $count } oggetto in questa schermata
       *[other] { $count } oggetti in questa schermata
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Unisci { $count } elemento
            [many] Unisci { $count } elementi
           *[other] Unisci { $count } elementi
        }
locate-library-lookup-no-resolver = È necessario selezionare un resolver dal pannello { $pane } delle impostazioni di { -app-name }.
architecture-win32-warning-message = Passa alla versione a 64-bit di { -app-name } per ottenere prestazioni migliori. I tuoi dati non subiranno modifiche.
architecture-warning-action = Scarica { -app-name } a 64-bit
architecture-x64-on-arm64-message = { -app-name } è in esecuzione in modalità emulata. Una versione nativa di { -app-name } sarà più efficiente.
architecture-x64-on-arm64-action = Scarica { -app-name } per ARM64
first-run-guidance-authorMenu = { -app-name } permette di specificare anche i curatori e i traduttori. Puoi convertire un autore in un curatore o un traduttore tramite questo menu.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Condizioni di ricerca
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operatore
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Valore
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] { $count } file aggiunto
        [many] { $count } file aggiunti
       *[other] { $count } file aggiunti
    }
select-items-window =
    .title = Seleziona elementi
select-items-dialog =
    .buttonlabelaccept = Seleziona
select-items-convertToStandalone =
    .label = Converti in indipendente
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Converti in allegato indipendente
            [many] Converti in allegati indipendenti
           *[other] Converti in allegati indipendenti
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Converti in nota indipendente
            [many] Converti in note indipendenti
           *[other] Converti in note indipendenti
        }
file-type-webpage = Pagina web
file-type-image = Immagine
file-type-pdf = PDF
file-type-audio = File audio
file-type-video = File video
file-type-presentation = Presentazione
file-type-document = Documento
file-type-ebook = Ebook
post-upgrade-message = È stato effettuato l'aggiornamento a <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Scopri le <a data-l10n-name="new-features-link">novità</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Incolla e cerca
mac-word-plugin-install-message = Zotero richiede l'accesso alla cartella dati di Word per installare il plugin.
mac-word-plugin-install-action-button =
    .label = Installa il plugin Word
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
file-renaming-banner-message = { -app-name } ora mantiene automaticamente sincronizzati i nomi degli allegati mentre vengono modificati gli elementi.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = È necessario aggiornare { -app-name } Connector per poter funzionare con questa versione di { -app-name }.
userjs-pref-warning = Alcune impostazioni di { -app-name } sono state sovrascritte con un metodo sconosciuto. { -app-name } le riprisitinerà e si riavvierà.
migrate-extra-fields-progress-message = Migrazione dei nuovi campi dal campo Extra
long-tag-fixer-window-title =
    .title = Dividi tag
long-tag-fixer-button-dont-split =
    .label = Non dividere
menu-normalize-attachment-titles =
    .label = Normalizza i titoli degli allegati...
normalize-attachment-titles-title = Normalizza i titoli degli allegati
normalize-attachment-titles-text = { -app-name } rinomina automaticamente i file sul disco usando i metadati dell'elemento genitore; tuttavia, usa dei titoli semplificati come “Full Text PDF”, “Preprint PDF”, o “PDF” per gli allegati principali per mantenere una lista degli allegati più pulita, senza duplicare le informazioni. Nelle vecchie versioni di { -app-name }, o tramite l'uso di certi plugin, era possibile cambiare i titoli degli allegati così da renderli uguali ai nomi dei file.Vuoi aggiornare i titoli degli allegati selezionati usando il nuovo schema semplificato? Verranno modificati solo gli allegati principali il cui titolo corrisponde al nome del file.
