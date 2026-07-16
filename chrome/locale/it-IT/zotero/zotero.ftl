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
-os-name =
    { PLATFORM() ->
        [macos] macOS
        [windows] Windows
       *[other] Linux
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
general-got-it = Capito
general-done = Fatto
general-view-troubleshooting-instructions = Vedi le istruzioni di risoluzione dei problemi
general-go-back = Indietro
general-accept = Accetta
general-cancel = Annulla
cancel-button =
    .label = { general-cancel }
general-show-in-library = Mostra nella biblioteca
general-restartApp = Riavvia { -app-name }
general-restartInTroubleshootingMode = Riavvia in Modalità Provvisoria
general-save = Salva
general-clear = Cancella
clear-button =
    .label = { general-clear }
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
general-more-information = Ulteriori informazioni
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
db-checking-integrity = Checking database integrity…
db-repairing = Repairing database…
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
recently-read = Letti di recente
collections-menu-show-recently-read =
    .label = Mostra { recently-read }
item-menu-remove-from-recently-read =
    .label = Rimuovi da { recently-read }…
items-section-collections-selected =
    { $count ->
        [one] { $count } collezione selezionata
        [many] { $count } collezioni selezionate
       *[other] { $count } collezioni selezionate
    }
items-section-searches-selected =
    { $count ->
        [one] { $count } ricerca salvata selezionata
        [many] { $count } ricerche salvate selezionate
       *[other] { $count } ricerche salvate selezionate
    }
items-section-sources-selected =
    { $count ->
        [one] { $count } fonte selezionata
        [many] { $count } fonti selezionate
       *[other] { $count } fonti selezionate
    }
items-section-library-collections =
    { $count ->
        [one] { $library } ({ $count } collezione selezionata)
        [many] { $library } ({ $count } collezioni selezionate)
       *[other] { $library } ({ $count } collezioni selezionate)
    }
items-section-library-searches =
    { $count ->
        [one] { $library } ({ $count } ricerca salvata selezionata)
        [many] { $library } ({ $count } ricerche salvate selezionate)
       *[other] { $library } ({ $count } ricerche salvate selezionate)
    }
items-section-library-sources =
    { $count ->
        [one] { $library } ({ $count } fonte selezionata)
        [many] { $library } ({ $count } fonti selezionate)
       *[other] { $library } ({ $count } fonti selezionate)
    }
items-section-library-recently-read = { $library } ({ recently-read })
items-section-library = { $library }
collections-menu-rename =
    .label = Rinomina
edit-saved-search = Modifica ricerca salvata
collections-menu-edit-search =
    .label = Modifica ricerca
collections-menu-duplicate-search =
    .label = Duplica ricerca
collections-menu-move-collection =
    .label = Sposta in
collections-menu-copy-collection =
    .label = Copia in
collections-menu-export =
    .label = Esporta
collections-menu-generate-report =
    .label = Genera Report...
collections-menu-create-bibliography =
    .label = Crea bibliografia...
collections-menu-unsubscribe =
    .label = Disiscriviti...
collections-menu-delete =
    .label =
        { $count ->
            [one] Elimina la collezione…
            [many] Elimina le collezioni…
           *[other] Elimina le collezioni…
        }
collections-menu-delete-with-items =
    .label =
        { $count ->
            [one] Elimina la collezione e gli elementi contenuti…
            [many] Elimina le collezioni e gli elementi contenuti…
           *[other] Elimina le collezioni e gli elementi contenuti…
        }
collections-menu-delete-search =
    .label =
        { $count ->
            [one] Elimina ricerca...
            [many] Elimina ricerche...
           *[other] Elimina ricerche...
        }
collections-delete-title =
    { $count ->
        [one] Elimina la collezione
        [many] Elimina le collezioni
       *[other] Elimina le collezioni
    }
collections-delete-message =
    { $count ->
        [one] Desideri eliminare questa collezione
        [many] Desideri eliminare { $count } collezioni?
       *[other] Desideri eliminare { $count } collezioni?
    }
collections-delete-keep-items =
    { $count ->
        [one] Gli elementi contenuti in questa collezione non verranno eliminati.
        [many] Gli elementi contenuti in queste collezioni non verranno eliminati.
       *[other] Gli elementi contenuti in queste collezioni non verranno eliminati.
    }
collections-delete-with-items-title =
    { $count ->
        [one] Elimina la collezione e gli elementi contenuti
        [many] Elimina le collezioni e gli elementi contenuti
       *[other] Elimina le collezioni e gli elementi contenuti
    }
collections-delete-with-items-message =
    { $count ->
        [one] Desideri eliminare questa collezione e spostare tutti gli elementi nel cestino?
        [many] Desideri eliminare { $count } collezioni  e spostare tutti gli elementi nel cestino?
       *[other] Desideri eliminare { $count } collezioni e spostare tutti gli elementi nel cestino?
    }
collections-delete-search-title =
    { $count ->
        [one] Elimina ricerca
        [many] Elimina ricerche
       *[other] Elimina ricerche
    }
collections-delete-search-message =
    { $count ->
        [one] Vuoi eliminare questa ricerca?
        [many] Desideri eliminare { $count } ricerche?
       *[other] Desideri eliminare { $count } ricerche?
    }
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
update-updates-found-desc = Si prega di aggiornare il prima possibile.
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
import-online-relink-kb = { general-more-information }
import-online-connection-error = { -app-name } non è riuscito a connettersi a { $targetApp }. Si prega di verificare la connessione a Internet e riprovare.
tab-title-multiple-collections = Multiple
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Nota
            [many] { $count } Note
           *[other] { $count } Note
        }
items-column-added-by = Aggiunto da
items-column-modified-by = Modificato da
items-column-last-read = Ultima lettura
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
account-log-in = Accedi
account-not-logged-in-text = Accedi al tuo account Zotero per sincronizzare i dati.
account-error-login-session-expired = La sessione di accesso è scaduta. Riprova.
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
advanced-search = Ricerca avanzata
menuitem-advanced-search =
    .label = { advanced-search }
quicksearch-advanced-search-button =
    .tooltiptext = { advanced-search }
    .aria-label = { advanced-search }
advanced-search-close =
    .tooltiptext = Chiudi ricerca avanzata
advanced-search-expand =
    .tooltiptext = Espandi ricerca avanzata
advanced-search-collapse =
    .tooltiptext = Comprimi ricerca avanzata
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
first-run-guidance-readAloud = { -app-name } è ora in grado di leggere i documenti con sintesi vocale naturale.
advanced-search-remove-btn =
    .tooltiptext = Rimuovi condizione
advanced-search-add-btn =
    .tooltiptext = Aggiungi condizione
advanced-search-group-btn =
    .tooltiptext = Aggiungi gruppo di condizioni
advanced-search-remove-group-btn =
    .tooltiptext = Rimuovi gruppo
advanced-search-ungroup-btn =
    .tooltiptext = Separa condizioni
advanced-search-result-level-menu =
    .aria-label = Tipo dei risultati
advanced-search-result-level-prefix-root =
    .value = Trova
advanced-search-join-prefix-root =
    .value = che corrispondono a
advanced-search-result-level-any =
    .label = qualsiasi elemento
advanced-search-result-level-item =
    .label = elementi di livello superiore
advanced-search-result-level-attachment =
    .label = allegati
advanced-search-result-level-note =
    .label = note
advanced-search-result-level-annotation =
    .label = annotazioni
advanced-search-binding-menu =
    .aria-label = Trova nello stesso elemento
advanced-search-binding-separate =
    .label = separatamente
advanced-search-binding-same-attachment =
    .label = nello stesso allegato
advanced-search-binding-same-note =
    .label = nella stessa nota
advanced-search-binding-same-annotation =
    .label = nella stessa annotazione
advanced-search-of-the-following =
    .value = dei seguenti
advanced-search-binding-hint-attachment =
    .value = Queste condizioni possono applicarsi ad allegati separati.
advanced-search-binding-hint-note =
    .value = Queste condizioni possono applicarsi a note separate.
advanced-search-binding-hint-annotation =
    .value = Queste condizioni possono applicarsi ad annotazioni separate.
advanced-search-level-warning-mixed = Queste condizioni non possono essere soddisfatte tutte dallo stesso elemento, quindi questa ricerca non restituirà mai risultati. Riprova scegliendo “{ $matchAny }” di esse, oppure imposta il tipo di risultato su “{ $topLevelItems }”.
advanced-search-level-warning-unreachable = Questa ricerca ha una condizione che non è applicabile al tipo di risultato selezionato. Seleziona  “{ $topLevelItems }” o rimuovi la condizione incompatibile.
advanced-search-group-warning-unreachable =
    Una condizione inserita qui non può trovarsi { $entity ->
        [attachment] nello stesso allegato
        [note] nella stessa nota
       *[annotation] nella stessa annotazione
    }. Cerca questi elementi separatamente o rimuovi la condizione incompatibile.
advanced-search-group-warning-mixed = Queste condizioni non possono essere soddisfatte tutte dallo stesso elemento, quindi questo gruppo non restituirà mai risultati. Riprova scegliendo “{ $matchAny }” di esse, oppure imposta il tipo di risultato su “{ $topLevelItems }”.
advanced-search-bind-same-attachment =
    .label = Trova nello stesso allegato
advanced-search-bind-same-note =
    .label = Trova nella stessa nota
advanced-search-bind-same-annotation =
    .label = Trova nella stessa annotazione
advanced-search-conditions-menu =
    .aria-label = Condizioni di ricerca
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operatore
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Valore
    .label = { $label }
search-operator-isEmpty = is empty
search-operator-isNotEmpty = is not empty
search-conditions-tooltip-fields = Campi:
search-conditions-collection = Collezione
search-conditions-savedSearch = Ricerca salvata
search-conditions-itemTypeID = Tipo di elemento
search-conditions-tag = Tag
search-conditions-numTags = # of Tags
search-conditions-numNotes = # of Notes
search-conditions-numAttachments = # of Attachments
search-conditions-numAnnotations = # of Annotations
search-conditions-note = Nota
search-conditions-childNote = Nota figlia
search-conditions-creator = Autore
search-conditions-thesisType = Tipo di tesi
search-conditions-reportType = Tipo di report
search-conditions-videoRecordingFormat = Formato della registrazione video
search-conditions-audioFileType = Tipo di file audio
search-conditions-audioRecordingFormat = Formato della registrazione audio
search-conditions-letterType = Tipo di lettera
search-conditions-interviewMedium = Formato dell'intervista
search-conditions-manuscriptType = Tipo di manoscritto
search-conditions-presentationType = Tipo di presentazione
search-conditions-mapType = Tipo di mappa
search-conditions-artworkMedium = Formato dell'opera d'arte
search-conditions-dateModified = Data ultima modifica
search-conditions-fulltextContent = Contenuto dell'allegato
search-conditions-programmingLanguage = Linguaggio di programmazione
search-conditions-fileTypeID = Tipo di allegato
search-conditions-attachmentStorageType = Attachment Storage Type
search-conditions-lastRead = Ultima lettura dell'allegato
search-conditions-annotationText = Testo dell'annotazione
search-conditions-annotationComment = Commento all'annotazione
search-conditions-annotationType = Tipo di annotazione
search-conditions-annotationColor = Colore dell'annotazione
search-conditions-annotationAuthor = Autore dell'annotazione
search-conditions-anyField = Qualsiasi campo
search-conditions-titleCreatorYear = Titolo, Autore, Anno
search-conditions-submenu-attachment = Allegato
search-conditions-submenu-annotation = Annotazione
search-conditions-short-fulltextContent = Contenuto
search-conditions-short-fileTypeID = Tipo di file
search-conditions-short-attachmentStorageType = Storage Type
search-conditions-short-lastRead = Ultima lettura
search-conditions-short-annotationText = Testo
search-conditions-short-annotationComment = Commento
search-conditions-short-annotationType = Tipo
search-conditions-short-annotationColor = Colore
search-conditions-short-annotationAuthor = Autore
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
attachment-storage-type-storedFile = Stored File
attachment-storage-type-linkedFile = Linked File
attachment-storage-type-webLink = Web Link
post-upgrade-message = È stato effettuato l'aggiornamento a <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Scopri le <a data-l10n-name="new-features-link">novità</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Incolla e cerca
mac-word-plugin-install-message = Zotero richiede l'accesso alla cartella dati di Word per installare il plugin.
mac-word-plugin-install-folder-message = { -app-name } richiede l'accesso alla cartella di avvio di Word per installare il plugin.
mac-word-plugin-install-action-button =
    .label = Installa il plugin Word
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Installa il plugin nella cartella di avvio di Word
mac-word-plugin-install-folder-dialog-button = Installa
mac-word-plugin-install-wrong-folder-selected = È necessario selezionare la cartella suggerita. Si prega di riprovare senza scegliere una cartella diversa.
file-renaming-banner-message = { -app-name } ora mantiene automaticamente sincronizzati i nomi degli allegati mentre vengono modificati gli elementi.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = È necessario aggiornare { -app-name } Connector per poter funzionare con questa versione di { -app-name }.
userjs-pref-warning = Alcune impostazioni di { -app-name } sono state sovrascritte con un metodo sconosciuto. { -app-name } le riprisitinerà e si riavvierà.
migrate-extra-fields-progress-message = Migrazione dei nuovi campi dal campo Extra
search-normalization-progress-message = Indexing items for search
long-tag-fixer-window-title =
    .title = Dividi tag
long-tag-fixer-button-dont-split =
    .label = Non dividere
menu-normalize-attachment-titles =
    .label = Normalizza i titoli degli allegati...
normalize-attachment-titles-title = Normalizza i titoli degli allegati
normalize-attachment-titles-text = { -app-name } rinomina automaticamente i file sul disco usando i metadati dell'elemento genitore; tuttavia, usa dei titoli semplificati come “Full Text PDF”, “Preprint PDF”, o “PDF” per gli allegati principali per mantenere una lista degli allegati più pulita, senza duplicare le informazioni. Nelle vecchie versioni di { -app-name }, o tramite l'uso di certi plugin, era possibile cambiare i titoli degli allegati così da renderli uguali ai nomi dei file.Vuoi aggiornare i titoli degli allegati selezionati usando il nuovo schema semplificato? Verranno modificati solo gli allegati principali il cui titolo corrisponde al nome del file.
banner-close-button =
    .aria-label = Chiudi notifica
plugins-blocked-plugin =
    .message = Questo plugin è stato disabilitato da { -app-name }.
data-dir-unsupported-storage = Questo può succedere se la cartella dei dati di { -app-name } si trova in un servizio di storage cloud (OneDrive, Dropbox, ecc.) o su una rete condivisa.
login-manager-reset = { -app-name } non è riuscito a leggere i dati di accesso salvati, che sono stati quindi azzerati. Accedi nuovamente nel pannello { preferences-pane-account } delle impostazioni di { -app-name }.
os-keystore-save-failed =
    { PLATFORM() ->
        [macos] { -app-name } non è riuscito ad accedere al Portachiavi di { -os-name } per salvare in modo sicuro le tue credenziali. Assicurati che il Portachiavi sia accessibile e riprova.
        [windows] { -app-name } non è riuscito a salvare in modo sicuro le tue credenziali. Riprova o riavvia { -app-name }.
       *[other] { -app-name } non è riuscito ad accedere al portachiavi di { -os-name } per salvare in modo sicuro le tue credenziali. Assicurati che il servizio di portachiavi sia attivo e riprova.
    }
os-keystore-migrate-failed =
    { PLATFORM() ->
        [macos] { -app-name } non è riuscito ad accedere al Portachiavi di { -os-name } per crittografare le tue credenziali salvate. Le credenziali rimarranno memorizzate sul disco non crittografate. Assicurati che il Portachiavi sia accessibile e riavvia { -app-name }.
        [windows] { -app-name } non è riuscito a crittografare le tue credenziali salvate. Le credenziali rimarranno memorizzate sul disco non crittografate. Riavvia { -app-name } e riprova.
       *[other] { -app-name } non è riuscito ad accedere al portachiavi di { -os-name } per crittografare le tue credenziali salvate. Le credenziali rimarranno memorizzate sul disco non crittografate. Assicurati che il servizio di portachiavi sia attivo e riavvia { -app-name }.
    }
search-button =
    .label = Cerca
save-search-new-button =
    .label = Salva ricerca...
save-search-edit-button =
    .label = Salva
save-search-name-title = Salva la ricerca
save-search-name-message = Inserisci un nome per la ricerca salvata:
saved-search-close-confirmation-title = Modifica della ricerca salvata
saved-search-close-confirmation-body = Vuoi salvare le modifiche apportate a questa ricerca salvata?
item-pane-batch-editing-prompt =
    .aria-label = Modifica in blocco
item-pane-batch-editing-enable =
    .label = Modifica elementi selezionati...
item-pane-batch-editing-multiple-values-placeholder = Dati multipli
item-pane-batch-editing-clear-values = Cancella tutti i dati
item-pane-batch-editing-header =
    { $count ->
        [one] Modifica { $count } elemento
        [many] Modifica { $count } elementi
       *[other] Modifica { $count } elementi
    }
item-pane-batch-editing-done =
    .label = { general-done }
undo-action-edit-metadata =
    { $count ->
        [one] Modifica i metadati
        [many] Modifica i metadati di { $count } elementi
       *[other] Modifica i metadati di { $count } elementi
    }
undo-action-edit-field =
    { $count ->
        [one] Modifica del campo“{ $field }”
        [many] Modifica del campo“{ $field }” per { $count } elementi
       *[other] Modifica del campo“{ $field }” per { $count } elementi
    }
undo-action-normalize-attachment-titles = Normalizza il titolo dell'allegato
undo-action-trash =
    { $count ->
        [one] Sposta elemento nel cestino
        [many] Sposta { $count } elementi nel cestino
       *[other] Sposta { $count } elementi nel cestino
    }
undo-action-restore-items =
    { $count ->
        [one] Ripristina elemento
        [many] Ripristina { $count } elementi
       *[other] Ripristina { $count } elementi
    }
undo-action-trash-collection =
    { $count ->
        [one] Sposta collezione nel cestino
        [many] Sposta { $count } collezioni nel cestino
       *[other] Sposta { $count } collezioni nel cestino
    }
undo-action-trash-search =
    { $count ->
        [one] Sposta ricerca salvata nel cestino
        [many] Sposta { $count } ricerche salvate nel cestino
       *[other] Sposta { $count } ricerche salvate nel cestino
    }
undo-action-restore-collection =
    { $count ->
        [one] Ripristina collezione
        [many] Ripristina { $count } collezioni
       *[other] Ripristina { $count } collezioni
    }
undo-action-restore-objects =
    { $count ->
        [one] Ripristina oggetto
        [many] Ripristina { $count } oggetti
       *[other] Ripristina { $count } oggetti
    }
undo-action-add-to-collection =
    { $count ->
        [one] Aggiungi a una collezione
        [many] Aggiungi { $count } elementi a una collezione
       *[other] Aggiungi { $count } elementi a una collezione
    }
undo-action-remove-from-collection =
    { $count ->
        [one] Rimuovi dalla collezione
        [many] Rimuovi { $count } elementi da una collezione
       *[other] Rimuovi { $count } elementi da una collezione
    }
undo-action-move-to-collection =
    { $count ->
        [one] Sposta nella collezione
        [many] Sposta { $count } elementi nella collezione
       *[other] Sposta { $count } elementi nella collezione
    }
undo-action-rename-collection = Rinomina collezione
undo-action-move-collection = Sposta collezione
undo-action-add-tag =
    { $count ->
        [one] Aggiungi tag
        [many] Aggiungi tag a { $count } elementi
       *[other] Aggiungi tag a { $count } elementi
    }
undo-action-change-tag = Cambia tag
undo-action-split-tag = Dividi tag
undo-action-remove-tag =
    { $count ->
        [one] Rimuovi tag
        [many] Rimuovi tag da { $count } elementi
       *[other] Rimuovi tag da { $count } elementi
    }
undo-action-remove-tags-from-item =
    { $count ->
        [one] Rimuovi tag
        [many] Rimuovi { $count } tag
       *[other] Rimuovi { $count } tag
    }
undo-action-remove-all-tags = Rimuovi tutti i tag
undo-action-edit-note = Modifica nota
undo-action-add-creator = Aggiungi autore
undo-action-remove-creator = Rimuovi autore
undo-action-edit-creator = Modifica autore
undo-action-reorder-creator = Ordina autori
undo-action-change-type = Modifica tipo di elemento
undo-action-change-parent-item =
    { $count ->
        [one] Modifica elemento genitore
        [many] Modifica genitore per { $count } elementi
       *[other] Modifica genitore per { $count } elementi
    }
undo-action-convert-to-standalone =
    { $count ->
        [one] Rendi indipendente
        [many] Rendi indipendenti { $count } elementi
       *[other] Rendi indipendenti { $count } elementi
    }
undo-action-add-related = Aggiungi elemento correlato
undo-action-remove-related = Rimuovi elemento correlato
undo-action-merge-items =
    { $count ->
        [one] Unisci elemento
        [many] Unisci { $count } elementi
       *[other] Unisci { $count } elementi
    }
menu-edit-undo-action = Annulla { $action }
menu-edit-redo-action = Ripeti { $action }
