general-sentence-separator = { " " }
general-key-control = Control
general-key-shift = Maj
general-key-alt = Alt
general-key-option = Opció
general-key-command = Ordre
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
        [macos] Return
       *[other] Enter
    }
delete-or-backspace =
    { PLATFORM() ->
        [macos] Delete
       *[other] Backspace
    }
general-print = Imprimeix
general-remove = Elimina
general-add = Afegeix
general-remind-me-later = Recorda-m'ho més tard
general-dont-ask-again = No m'ho tornis a demanar
general-choose-file = Trieu un fitxer...
general-open-settings = Obre els paràmetres
general-settings = Settings…
general-help = Ajuda
general-tag = Etiqueta
general-done = Fet
general-view-troubleshooting-instructions = Mostra les instruccions de resolució de problemes
general-go-back = Vés enrere
general-accept = Accept
general-cancel = Cancel·la
general-show-in-library = Mostra a la biblioteca
general-restartApp = Restart { -app-name }
general-restartInTroubleshootingMode = Restart in Troubleshooting Mode
general-save = Desa
general-clear = Neteja
general-update = Actualitza
general-back = Enrere
general-edit = Edita
general-cut = Retalla
general-copy = Copia
general-paste = Enganxa
general-find = Cerca
general-delete = Suprimeix
general-insert = Insereix
general-and = i
general-et-al = et al.
general-previous = Anterior
general-next = Següent
general-learn-more = Més informació
general-warning = Avís
general-type-to-continue = Type “{ $text }” to continue.
general-continue = Continua
general-red = Vermell
general-orange = Taronja
general-yellow = Groc
general-green = Verd
general-teal = Verd blavós
general-blue = Blau
general-purple = Lila
general-magenta = Magenta
general-violet = Violeta
general-maroon = Vermelló
general-gray = Gris
general-black = Negre
general-loading = Loading…
citation-style-label = Estil de la cita:
language-label = Llengua:
menu-custom-group-submenu =
    .label = More Options…
menu-file-show-in-finder =
    .label = Mostra-ho en el Finder
menu-file-show-file =
    .label = Mostra el fitxer
menu-file-show-files =
    .label = Mostra els fitxers
menu-print =
    .label = { general-print }
menu-density =
    .label = Densitat
add-attachment = Afegeix un adjunt
new-note = Nota nova
menu-add-by-identifier =
    .label = Afegeix per identificador…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Afegeix un fitxer...
menu-add-standalone-linked-file-attachment =
    .label = Afegeix un enllaç al fitxer…
menu-add-child-file-attachment =
    .label = Adjunta un fitxer...
menu-add-child-linked-file-attachment =
    .label = Adjunta un enllaç al fitxer...
menu-add-child-linked-url-attachment =
    .label = Adjunta un enllaç web…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nova nota independent
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = Restaura a la biblioteca
menu-deletePermanently =
    .label = Elimina permanentment…
menu-tools-plugins =
    .label = Connectors
menu-view-columns-move-left =
    .label = Mou la columna a l'esquerra
menu-view-columns-move-right =
    .label = Mou la columna a la dreta
menu-view-note-font-size =
    .label = Mida de lletra de les notes
menu-view-note-tab-font-size =
    .label = Note Tab Font Size
menu-show-tabs-menu =
    .label = Show Tabs Menu
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Copy Annotation
           *[other] Copy { $count } Annotations
        }
main-window-command =
    .label = Biblioteca
main-window-key =
    .key = g
zotero-toolbar-tabs-menu =
    .tooltiptext = Llista totes les pestanyes
filter-collections = Filtra les col·leccions
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Cerca a les pestanyes
zotero-tabs-menu-close-button =
    .title = Tanca la pestanya
zotero-toolbar-tabs-scroll-forwards =
    .title = Scroll forwards
zotero-toolbar-tabs-scroll-backwards =
    .title = Scroll backwards
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Reanomena la col·lecció
collections-menu-edit-saved-search =
    .label = Edita la cerca desada
collections-menu-move-collection =
    .label = Mou a
collections-menu-copy-collection =
    .label = Copia a
item-creator-moveDown =
    .label = Mou avall
item-creator-moveToTop =
    .label = Mou a dalt
item-creator-moveUp =
    .label = Mou amunt
item-menu-viewAttachment =
    .label =
        Open { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Snapshot
                    [note] Note
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                    [note] Notes
                   *[other] Attachments
                }
        } { $openIn ->
            [tab] in New Tab
            [window] in New Window
           *[other] { "" }
        }
item-menu-add-file =
    .label = Fitxer
item-menu-add-linked-file =
    .label = Fitxer enllaçat
item-menu-add-url =
    .label = Enllaç web
item-menu-change-parent-item =
    .label = Canvia l'element pare…
item-menu-relate-items =
    .label = Relate Items
view-online = Mira en línia
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = File renamed to { $filename }
itembox-button-options =
    .tooltiptext = Obre el menú contextual
itembox-button-merge =
    .aria-label = Select version of { $field } field
create-parent-intro = Afegiu un DOI, ISBN, PMID, arXiv ID o ADS Bibcode per identificar aquest fitxer:
reader-use-dark-mode-for-content =
    .label = Fes servir el mode fosc per al contingut
update-updates-found-intro-minor = An update for { -app-name } is available:
update-updates-found-desc = Es recomana que apliqueu l'actualització tan aviat com pugueu.
import-window =
    .title = Importa
import-where-from = D'on voldríeu importar?
import-online-intro-title = Introducció
import-source-file =
    .label = Un fitxer (BibTex, RIS, Zotero RDF, etc.)
import-source-folder =
    .label = Una carpeta amb fitxers PDF o d'altre tipus
import-source-online =
    .label = { $targetApp } online import
import-options = Opcions
import-importing = S'està important…
import-create-collection =
    .label = Col·loca les col·leccions importades i elements en una col·lecció nova
import-recreate-structure =
    .label = Recrea l'estructura de carpetes com a col·leccions
import-fileTypes-header = Tipus de fitxer per importar:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Gestió de fitxers
import-file-handling-store =
    .label = Copia els fitxers a la carpeta d'emmagatzematge del { -app-name }
import-file-handling-link =
    .label = Enllaça als fitxers en la ubicació original
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Baixa només els elements nous; no actualitzis els elements importats anteriorment
import-mendeley-username = Nom d'usuari
import-mendeley-password = Contrasenya
general-error = Error
file-interface-import-error = S'ha produït un error quan s'intentava importar el fitxer seleccionat. Assegureu-vos que el fitxer és correcte i torneu-ho a intentar.
file-interface-import-complete = S'ha completat la importació
file-interface-items-were-imported =
    { $numItems ->
        [0] No items were imported
        [one] One item was imported
       *[other] { $numItems } items were imported
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] No items were relinked
        [one] One item was relinked
       *[other] { $numRelinked } items were relinked
    }
import-mendeley-encrypted = The selected Mendeley database cannot be read, likely because it is encrypted. See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
file-interface-import-error-translator = An error occurred importing the selected file with “{ $translator }”. Please ensure that the file is valid and try again.
import-online-intro = In the next step you will be asked to log in to { $targetAppOnline } and grant { -app-name } access. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-intro2 = { -app-name } will never see or store your { $targetApp } password.
import-online-form-intro = Please enter your credentials to log in to { $targetAppOnline }. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-wrong-credentials = Login to { $targetApp } failed. Please re-enter credentials and try again.
import-online-blocked-by-plugin = The import cannot continue with { $plugin } installed. Please disable this plugin and try again.
import-online-relink-only =
    .label = Relink Mendeley Desktop citations
import-online-relink-kb = Més informació
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Notifica un error...
rtfScan-wizard =
    .title = Escaneig de l'RTF
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. It currently supports citations in variations of the following formats:
rtfScan-introPage-description2 = Per començar, seleccioneu un fitxer d'entrada RTF i un fitxer de sortida:
rtfScan-input-file = Fitxer d'entrada:
rtfScan-output-file = Fitxer de sortida:
rtfScan-no-file-selected = No heu seleccionat cap fitxer
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Trieu el fitxer d'entrada
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Trieu el fitxer de sortida
rtfScan-intro-page = Introducció
rtfScan-scan-page = Escaneig en cerca de cites
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page = Verifica els elements citats
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page = Formatació del document
rtfScan-format-page = Formatant les cites
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page = Escaneig de l'RFT completat
rtfScan-complete-page-description = El document ja s'ha analitzat i processat. Comproveu que s'ha formatat correctament.
rtfScan-action-find-match =
    .title = Selecciona l'element coincident
rtfScan-action-accept-match =
    .title = Accepta la coincidència
runJS-title = Executa el JavaScript
runJS-editor-label = Codi:
runJS-run = Executa
runJS-help = { general-help }
runJS-completed = completed successfully
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Run as async function
bibliography-window =
    .title = { -app-name } - Create Citation/Bibliography
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Mostra les cites com a:
bibliography-advancedOptions-label = Opcions avançades
bibliography-outputMode-label = Mode de sortida:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliografia
bibliography-outputMethod-label = Mètode de sortida:
bibliography-outputMethod-saveAsRTF =
    .label = Desa com a RTF
bibliography-outputMethod-saveAsHTML =
    .label = Desa com a HTML
bibliography-outputMethod-copyToClipboard =
    .label = Copia al portaretalls
bibliography-outputMethod-print =
    .label = Imprimeix
bibliography-manageStyles-label = Gestiona els estils…
styleEditor-locatorType =
    .aria-label = Tipus d'ubicador
styleEditor-locatorInput = Entrada de l'ubicador
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Editor d'estil
styleEditor-preview =
    .aria-label = Previsualització
publications-intro-page = Les meves publicacions
publications-intro = Els elements que afegiu a «Les meves publicacions» es mostraran en la pàgina de perfil de zotero.org. Si trieu incloure els fitxers adjunts, es posaran disponibles sota la llicència que hi especifiqueu. Només afegiu-hi treballs que hàgiu creat, i només incloeu-hi fitxers que tingueu els drets de distribució i vulgueu compartir.
publications-include-checkbox-files =
    .label = Inclou els fitxers
publications-include-checkbox-notes =
    .label = Inclou les notes
publications-include-adjust-at-any-time = Podeu ajustar el que voleu mostrar en qualsevol moment des de la col·lecció «Les meves publicacions».
publications-intro-authorship =
    .label = He creat aquesta obra.
publications-intro-authorship-files =
    .label = He creat aquest treball i tinc els drets per a distribuir els fitxers inclosos.
publications-sharing-page = Trieu com podeu compartir el vostre treball
publications-sharing-keep-rights-field =
    .label = Conserva el camp de Drets que existeix
publications-sharing-keep-rights-field-where-available =
    .label = Conserva el camp de Drets existent quan sigui disponible
publications-sharing-text = Podeu reservar-vos tots els drets del vostre treball, llicenciar-lo sota una llicència Creative Commons, o dedicar-lo al domini públic. En tots els casos el treball serà disponible públicament des de zotero.org.
publications-sharing-prompt = Voldríeu permetre que altres comparteixin el vostre treball?
publications-sharing-reserved =
    .label = No, només publica el meu treball a zotero.org
publications-sharing-cc =
    .label = Sí, i sota una llicència Creative Commons
publications-sharing-cc0 =
    .label = Sí, i posa el meu treball en domini públic
publications-license-page = Trieu una llicència de Creative Commons
publications-choose-license-text = Una llicència Creative Commons permet als altres copiar i redistribuir el vostre treball sempre que en proporcionin el reconeixement adequat, proporcionin un enllaç a la llicència i indiquin si s'han fet canvis. Es poden especificar condicions addicionals a continuació.
publications-choose-license-adaptations-prompt = Voldríeu permetre que es comparteixin adaptacions del vostre treball?
publications-choose-license-yes =
    .label = Sí
    .accesskey = Y
publications-choose-license-no =
    .label = No
    .accesskey = N
publications-choose-license-sharealike =
    .label = Sí, sempre que els altres també ho comparteixin així
    .accesskey = S
publications-choose-license-commercial-prompt = Voldríeu permetre'n usos comercials?
publications-buttons-add-to-my-publications =
    .label = Afegeix a les meves publicacions
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Trieu una llicència
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Reconeixement 4.0 Llicència Internacional
licenses-cc-by-nd = Creative Commons Reconeixement-SenseObraDerivada 4.0 Llicència Internacional
licenses-cc-by-sa = Creative Commons Reconeixement-CompartirIgual 4.0 Llicència Internacional
licenses-cc-by-nc = Creative Commons Reconeixement-NoComercial 4.0 Llicència Internacional
licenses-cc-by-nc-nd = Creative Commons Reconeixement-NoComercial-SenseObraDerivada 4.0 Llicència Internacional
licenses-cc-by-nc-sa = Creative Commons Reconeixement-NoComercial-CompartirIgual 4.0 Llicència Internacional
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = p
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Densitat
menu-ui-density-comfortable =
    .label = Confortable
menu-ui-density-compact =
    .label = Compacte
pane-item-details = Item Details
pane-info = Informació
pane-abstract = Resum
pane-attachments = Adjuncions
pane-notes = Notes
pane-note-info = Note Info
pane-libraries-collections = Biblioteques i col·leccions
pane-tags = Etiquetes
pane-related = Elements relacionats
pane-attachment-info = Attachment Info
pane-attachment-preview = Previsualització
pane-attachment-annotations = Anotacions
pane-header-attachment-associated =
    .label = Canvia el nom del fitxer associat
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } Attachment
           *[other] { $count } Attachments
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } Annotation
           *[other] { $count } Annotations
        }
section-attachments-move-to-trash-message = Are you sure you want to move “{ $title }” to the trash?
section-notes =
    .label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } Tag
           *[other] { $count } Tags
        }
section-related =
    .label = { $count } Related
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Amplia la secció
    .label = Amplia la secció { $section }
section-button-collapse =
    .dynamic-tooltiptext = Replega la secció
    .label = Replega la secció { $section }
annotations-count =
    { $count ->
        [one] { $count } Annotation
       *[other] { $count } Annotations
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
    .label = Move Section Up
sidenav-reorder-down =
    .label = Move Section Down
sidenav-reorder-reset =
    .label = Reset Section Order
toggle-item-pane =
    .tooltiptext = Toggle Item Pane
toggle-context-pane =
    .tooltiptext = Commuta la subfinestra contextual
pin-section =
    .label = Fixa la secció
unpin-section =
    .label = Desfixa la secció
collapse-other-sections =
    .label = Replega les altres seccions
expand-all-sections =
    .label = Amplia totes les seccions
abstract-field =
    .placeholder = Afegeix un resum...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtra les etiquetes
context-notes-search =
    .placeholder = Cerca notes
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Col·lecció nova...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Nova col·lecció
    .buttonlabelaccept = Crea una col·lecció
new-collection-name = Nom:
new-collection-create-in = Crea a:
show-publications-menuitem =
    .label = Show My Publications
attachment-info-title = Títol
attachment-info-filename = Nom de fitxer
attachment-info-accessed = Últim accés
attachment-info-pages = Nre. de pàgines
attachment-info-modified = Modificat
attachment-info-index = Indexat
attachment-info-convert-note =
    .label =
        Migrate to { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } Note
    .tooltiptext = Adding notes to attachments is no longer supported, but you can edit this note by migrating it to a separate note.
section-note-info =
    .label = { pane-note-info }
note-info-title = Títol
note-info-parent-item = Parent Item
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] None
    }
    .title =
        { $hasParentItem ->
            [true] View parent item in library
           *[false] View note item in library
        }
note-info-date-created = Created
note-info-date-modified = Modificat
note-info-size = Mida
note-info-word-count = Word Count
note-info-character-count = Character Count
item-title-empty-note = Nota sense títol
attachment-preview-placeholder = No attachment to preview
attachment-rename-from-parent =
    .tooltiptext = Rename File to Match Parent Item
file-renaming-auto-rename-prompt-title = Renaming Settings Changed
file-renaming-auto-rename-prompt-body = Would you like to rename existing files in your library to match the new settings?
file-renaming-auto-rename-prompt-yes = Preview Changes…
file-renaming-auto-rename-prompt-no = Keep Existing Filenames
rename-files-preview =
    .buttonlabelaccept = Rename Files
rename-files-preview-loading = S'està carregant…
rename-files-preview-intro = { -app-name } will rename the following files in your library to match their parent items:
rename-files-preview-renaming = Renaming…
rename-files-preview-no-files = All filenames already match parent items. No changes are required.
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } Attachment Preview
annotation-image-not-available = [Image not available]
quicksearch-mode =
    .aria-label = Mode de cerca ràpid
quicksearch-input =
    .aria-label = Cerca ràpida
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Mostra com a
item-pane-header-none =
    .label = Cap
item-pane-header-title =
    .label = Títol
item-pane-header-titleCreatorYear =
    .label = Títol, autor, any
item-pane-header-bibEntry =
    .label = Entrada de bibliografia
item-pane-header-more-options =
    .label = Més opcions
item-pane-message-items-selected =
    { $count ->
        [0] No items selected
        [one] { $count } item selected
       *[other] { $count } items selected
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } collection selected
       *[other] { $count } collections selected
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } search selected
       *[other] { $count } searches selected
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } object selected
       *[other] { $count } objects selected
    }
item-pane-message-unselected =
    { $count ->
        [0] No items in this view
        [one] { $count } item in this view
       *[other] { $count } items in this view
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] No objects in this view
        [one] { $count } object in this view
       *[other] { $count } objects in this view
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Fusiona { $count } element
           *[other] Fusiona { $count } elements
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = Switch to 64-bit { -app-name } for the best performance. Your data won’t be affected.
architecture-warning-action = Download 64-bit { -app-name }
architecture-x64-on-arm64-message = { -app-name } is running in emulated mode. A native version of { -app-name } will run more efficiently.
architecture-x64-on-arm64-action = Download { -app-name } for ARM64
first-run-guidance-authorMenu = { -app-name } lets you specify editors and translators too. You can turn an author into an editor or translator by selecting from this menu.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Condició de cerca
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operador
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Valor
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] { $count } file added
       *[other] { $count } files added
    }
select-items-window =
    .title = Selecciona elements
select-items-dialog =
    .buttonlabelaccept = Selecciona
select-items-convertToStandalone =
    .label = Convert to Standalone
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Convert to Standalone Attachment
           *[other] Convert to Standalone Attachments
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Convert to Standalone Note
           *[other] Convert to Standalone Notes
        }
file-type-webpage = Pàgina web
file-type-image = Imatge
file-type-pdf = PDF
file-type-audio = Àudio
file-type-video = Vídeo
file-type-presentation = Presentació
file-type-document = Document
file-type-ebook = Llibre electrònic
post-upgrade-message = You’ve been upgraded to <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Learn about <a data-l10n-name="new-features-link">what’s new</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Enganxa i cerca
mac-word-plugin-install-message = El Zotero necessita accés a les dades del Word per a instal·lar el connector de Word.
mac-word-plugin-install-action-button =
    .label = Instal·la el connector del Word
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
file-renaming-banner-message = { -app-name } now automatically keeps attachment filenames in sync as you make changes to items.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = The { -app-name } Connector must be updated to work with this version of { -app-name }.
userjs-pref-warning = Some { -app-name } settings have been overridden using an unsupported method. { -app-name } will revert them and restart.
migrate-extra-fields-progress-message = Migrating new fields from Extra field
long-tag-fixer-window-title =
    .title = Split Tags
long-tag-fixer-button-dont-split =
    .label = Don’t Split
menu-normalize-attachment-titles =
    .label = Normalize Attachment Titles…
normalize-attachment-titles-title = Normalize Attachment Titles
normalize-attachment-titles-text =
    { -app-name } automatically renames files on disk using parent item metadata, but it uses separate, simpler titles such as “Full Text PDF”, “Preprint PDF”, or “PDF” for primary attachments to keep the items list cleaner and avoid duplicating information.
    
    In older versions of { -app-name }, as well as when using certain plugins, attachment titles could be changed unnecessarily to match the filenames.
    
    Would you like to update the selected attachments to use simpler titles? Only primary attachments with titles that match the filename will be changed.
