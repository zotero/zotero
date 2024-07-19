general-print = Stampa
return-or-enter =
    { PLATFORM() ->
        [macos] Invio
       *[other] Invio
    }
general-remove = Rimuovi
general-add = Aggiungi
general-remind-me-later = Ricordamelo più tardi
general-choose-file = Scegli il file…
general-open-settings = Apri impostazioni
general-help = Aiuto
general-tag = Tag
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
    .label = Aggiungi da identificatore...
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Aggiungi file...
menu-add-standalone-linked-file-attachment =
    .label = Aggiungi collegamento al file...
menu-add-child-file-attachment =
    .label = Allega file...
menu-add-child-linked-file-attachment =
    .label = Allega collegamento al file...
menu-add-child-linked-url-attachment =
    .label = Allega link web...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nuova nota indipendente
menu-new-item-note =
    .label = Nuova nota dell'elemento
menu-restoreToLibrary =
    .label = Ripristina nella biblioteca
menu-deletePermanently =
    .label = Elimina definitivamente...
menu-tools-plugins =
    .label = Plugin
main-window-command =
    .label = { -app-name }
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
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Rinomina collezione
collections-menu-edit-saved-search =
    .label = Modifica ricerca salvata
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
                   *[other] Allegato
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Pagine web
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
rtfScan-introPage-description = { -app-name } è in grado di estrarre e riformattare automaticamente le citazioni e inserire una bibliografia nei file RTF. Per iniziare, seleziona un file RTF e un file di destinazione qui sotto.
rtfScan-introPage-description2 = Per iniziare, seleziona un file RTF e un file di destinazione qui sotto:
rtfScan-input-file = File di origine
rtfScan-output-file = File di destinazione
rtfScan-no-file-selected = Nessun file selezionato
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Scegli file di origine
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Scegli file di destinazione
rtfScan-intro-page =
    .label = Introduzione
rtfScan-scan-page =
    .label = Ricerca di citazioni in corso
rtfScan-scanPage-description = { -app-name } sta analizzando il documento in cerca di citazioni. Si prega di attendere.
rtfScan-citations-page =
    .label = Verifica gli elementi citati.
rtfScan-citations-page-description = Si prega di controllare la lista di citazioni riconosciute per assicurarsi che { -app-name } abbia selezionato correttamente gli elementi corrispondenti. Ogni citazione non associata ad alcun elemento o ambigua dovrà essere corretta prima di procedere alla prossima fase.
rtfScan-style-page =
    .label = Formattazione del documento
rtfScan-format-page =
    .label = Formattazione delle citazioni
rtfScan-format-page-description = { -app-name } sta elaborando e formattando il file RTF. Si prega di attendere.
rtfScan-complete-page =
    .label = Elaborazione RTF completata.
rtfScan-complete-page-description = Il tuo documento è stato elaborato. Per favore assicurati che sia stato formattato correttamente.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Esegui JavaScript
runJS-editor-label = Codice:
runJS-run = Esegui
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Valore restituito:
       *[other] Risultato:
    }
runJS-run-async = Esegui come funzione asincrona
bibliography-window =
    .title = { -app-name } - Crea Citazione/Bibliografia
bibliography-style-label = Stile di citazione:
bibliography-locale-label = Lingua:
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
integration-docPrefs-window =
    .title = { -app-name } - Preferenze del documento
integration-addEditCitation-window =
    .title = { -app-name } - Aggiungi/modifica citazione
integration-editBibliography-window =
    .title = { -app-name } - Modifica bibliografia
integration-quickFormatDialog-window =
    .title = { -app-name } - Citazione veloce
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
publications-intro-page =
    .label = Le mie pubblicazioni
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
publications-sharing-page =
    .label = Scegli il metodo di condivisione della tua opera
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
publications-license-page =
    .label = Scegli una licenza Creative Commons
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
restart-in-troubleshooting-mode-menuitem =
    .label = Riavvia in Modalità Provvisoria...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Riavvia in Modalità Provvisoria
restart-in-troubleshooting-mode-dialog-description = { -app-name } verrà riavviato con tutti i plugin disabilitati. Alcune caratteristiche potrebbero non funzionare correttamente in Modalità Provvisoria.
menu-ui-density =
    .label = Densità
menu-ui-density-comfortable =
    .label = Confortevole
menu-ui-density-compact =
    .label = Compatta
pane-info = Informazioni
pane-abstract = Abstract
pane-attachments = Allegati
pane-notes = Note
pane-libraries-collections = Biblioteche e Collezioni
pane-tags = Tag
pane-related = Correlazioni
pane-attachment-info = Informazioni sugli allegati
pane-attachment-preview = Anteprima
pane-attachment-annotations = Annotazioni
pane-header-attachment-associated =
    .label = Rinomina file associato
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
pin-section =
    .label = Fissa sezione
unpin-section =
    .label = Sblocca sezione
collapse-other-sections =
    .label = Comprimi altre sezioni
expand-all-sections =
    .label = Espandi tutte le sezioni
abstract-field =
    .placeholder = Aggiungi abstract...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtra i tag
context-notes-search =
    .placeholder = Cerca nelle note
new-collection-dialog =
    .title = Nuova collezione
    .buttonlabelaccept = Crea collezione
new-collection-name = Nome:
new-collection-create-in = Crea in:
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
attachment-preview-placeholder = Nessun allegato da mostrare
toggle-preview =
    .label =
        { $type ->
            [open] Nascondi
            [collapsed] Mostra
           *[unknown] Cambia visibilità
        } Attachment Preview
quickformat-general-instructions =
    Usa le frecce Sinistra/Destra per muoverti tra gli elementi della citazione. { $dialogMenu ->
        [active] Premi Shift-Tab per spostarti sul menu.
       *[other] { "" }
    } Premi { return-or-enter } per salvare le modifiche alla citazione. Press ESC per scartare le modifiche e chiudere il riquadro.
quickformat-aria-bubble = Questo elemento è incluso nella citazione. Premi la barra spaziatrice per personalizzare l'elemento. { quickformat-general-instructions }
quickformat-aria-input = Inizia a digitare per cercare un elemento da inserire nella citazione. Premi Tab per navigare la lista dei risultati di ricerca. { quickformat-general-instructions }
quickformat-aria-item = Premi { return-or-enter } per aggiungere questo elemento alla citazione. Premi Tab per tornare indietro al campo di ricerca.
quickformat-accept =
    .tooltiptext = Salva le modifiche alla citazione
quickformat-locator-type =
    .aria-label = Tipo di indicatore di posizione
quickformat-locator-value = Indicatore di posizione
quickformat-citation-options =
    .tooltiptext = Mostra le opzioni per le citazioni
insert-note-aria-input = Inizia a digitare per cercare una nota. Premi Tab per navigare la lista dei risultati di ricerca. Premi ESC per chiudere il riquadro.
insert-note-aria-item = Premi { return-or-enter } per selezionare la nota. Premi Tab per tornare indietro al campo di ricerca. Premi ESC per chiudere il riquadro.
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
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Unisci { $count } elemento
            [many] Unisci { $count } elementi
           *[other] Unisci { $count } elementi
        }
locate-library-lookup-no-resolver = È necessario selezionare un resolver dal pannello { $pane } delle impostazioni di { -app-name }.
architecture-win32-warning-message = { -app-name } è in esecuzione a 32-bit in una versione di Windows a 64-bit. { -app-name } sarà molto più efficiente con la versione a 64-bit.
architecture-warning-action = Scarica { -app-name } a 64-bit
first-run-guidance-quickFormat =
    Digita un titolo, un autore e/o un anno per cercare un riferimento.
    
    Dopo aver scelto il riferimento desiderato, clicca sulla bolla o selezionala con la tastiere quindi premi ↓/Spazio per mostrare le opzioni di citazione come il numero di pagina, prefisso e suffisso.
    
    È anche possibile aggiungere il numero di pagina direttamente includendolo tra i termini di ricerca o digitandolo dopo la bolla e premendo{ return-or-enter }.
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
