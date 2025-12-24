general-sentence-separator = { " " }
general-key-control = Control
general-key-shift = Shift
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
        [macos] Return
       *[other] Enter
    }
delete-or-backspace =
    { PLATFORM() ->
        [macos] Delete
       *[other] Backspace
    }
general-print = Imprimir
general-remove = Remove
general-add = Engadir
general-remind-me-later = Acórdamo despois
general-dont-ask-again = Non preguntar de novo
general-choose-file = Escoller ficheiro...
general-open-settings = Abrir axustes
general-settings = Settings…
general-help = Axuda
general-tag = Etiqueta
general-done = Feito
general-view-troubleshooting-instructions = View Troubleshooting Instructions
general-go-back = Go Back
general-accept = Accept
general-cancel = Cancelar
general-show-in-library = Amosar na biblioteca
general-restartApp = Restart { -app-name }
general-restartInTroubleshootingMode = Restart in Troubleshooting Mode
general-save = Gardar
general-clear = Borrar
general-update = Actualizar
general-back = Atrás
general-edit = Editar
general-cut = Cortar
general-copy = Copiar
general-paste = Pegar
general-find = Procurar
general-delete = Eliminar
general-insert = Inserir
general-and = e
general-et-al = et al.
general-previous = Anterior
general-next = Seguinte
general-learn-more = Saber máis
general-warning = Advertencia
general-type-to-continue = Type “{ $text }” to continue.
general-continue = Continuar
general-red = Vermello
general-orange = Laranxa
general-yellow = Amarelo
general-green = Verde
general-teal = Turquesa
general-blue = Azul
general-purple = Morado
general-magenta = Maxenta
general-violet = Violeta
general-maroon = Marrón
general-gray = Gris
general-black = Negro
citation-style-label = Estilo de cita:
language-label = Lingua:
menu-custom-group-submenu =
    .label = More Options…
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = Mostrar o ficheiro
menu-file-show-files =
    .label = Mostrar ficheiros
menu-print =
    .label = { general-print }
menu-density =
    .label = Densidade
add-attachment = Engadir un anexo
new-note = Nota nova
menu-add-by-identifier =
    .label = Engadir por Identificador...
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Engadir ficheiro...
menu-add-standalone-linked-file-attachment =
    .label = Engadir ligazón a un ficheiro...
menu-add-child-file-attachment =
    .label = Attach File…
menu-add-child-linked-file-attachment =
    .label = Anexar a ligazón do ficheiro...
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nova nota independente
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = Restaurar na biblioteca
menu-deletePermanently =
    .label = Borrar permanentemente
menu-tools-plugins =
    .label = Plugins
menu-view-columns-move-left =
    .label = Move Column Left
menu-view-columns-move-right =
    .label = Move Column Right
menu-view-note-font-size =
    .label = Tamaño tipográfico das notas
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
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = List all tabs
filter-collections = Filter Collections
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Search Tabs
zotero-tabs-menu-close-button =
    .title = Close Tab
zotero-toolbar-tabs-scroll-forwards =
    .title = Scroll forwards
zotero-toolbar-tabs-scroll-backwards =
    .title = Scroll backwards
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Rename Collection
collections-menu-edit-saved-search =
    .label = Editar Procura Gravada
collections-menu-move-collection =
    .label = Move To
collections-menu-copy-collection =
    .label = Copy To
item-creator-moveDown =
    .label = Baixar
item-creator-moveToTop =
    .label = Mover a arriba
item-creator-moveUp =
    .label = Subir
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
    .label = Ficheiro
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Ligazón web
item-menu-change-parent-item =
    .label = Change Parent Item…
item-menu-relate-items =
    .label = Relate Items
view-online = Ver en liña
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = File renamed to { $filename }
itembox-button-options =
    .tooltiptext = Open context menu
itembox-button-merge =
    .aria-label = Select version of { $field } field
create-parent-intro = Introduce un DOI, ISBN, PMID, arXiv ID, ou bibcode ADS para identificar este ficheiro
reader-use-dark-mode-for-content =
    .label = Usar modo escuro para Contido
update-updates-found-intro-minor = An update for { -app-name } is available:
update-updates-found-desc = It is recommended that you apply this update as soon as possible.
import-window =
    .title = Importar
import-where-from = De onde queres importar?
import-online-intro-title = Introdución
import-source-file =
    .label = Un ficheiro (BibTeX, RIS, Zotero RDF, etc.)
import-source-folder =
    .label = Un cartafol de PDFs ou doutros ficheiros
import-source-online =
    .label = { $targetApp } online import
import-options = Opcións
import-importing = Importando...
import-create-collection =
    .label = Poñer as coleccións e elementos importados nunha nova colección
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Xestión de ficheiros
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Ligar os ficheiros coa posición orixinal
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Descargar só os novos elementos; non actualizar os elementos importados con anterioridade
import-mendeley-username = Nome de usuario
import-mendeley-password = Contrasinal
general-error = Erro
file-interface-import-error = Erro ao intentar importar o ficheiro seleccionado. Asegúrese de que o ficheiro é válido e volva intentalo.
file-interface-import-complete = Completouse a importación
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
    .label = Volver a ligar as citas de Mendeley Desktop
import-online-relink-kb = Máis información
import-online-connection-error = { -app-name } non puido conectar con { $targetApp }. Por favor, comprobe a súa conexión a internet e vólvao intentar.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Informar dun erro ...
rtfScan-wizard =
    .title = Esculcar RTF
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. It currently supports citations in variations of the following formats:
rtfScan-introPage-description2 = Para comezar escolla abaixo un ficheiro RTF de entrada e un ficheiro de saída:
rtfScan-input-file = Input File:
rtfScan-output-file = Output File:
rtfScan-no-file-selected = Ningún ficheiro seleccionado
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page = Introdución
rtfScan-scan-page = Esculcando as citas
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page = Comproba os elementos citados
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page = Formato de documentos
rtfScan-format-page = Formato de citas
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page = Esculcado completo do RTF
rtfScan-complete-page-description = O seu documento xa foi esculcado e procesado. Asegúrate de que o formato é correcto.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Run JavaScript
runJS-editor-label = Código:
runJS-run = Run
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
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Opcións avanzadas
bibliography-outputMode-label = Modo de saída:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliografía
bibliography-outputMethod-label = Método de saída:
bibliography-outputMethod-saveAsRTF =
    .label = Gardar como RTF
bibliography-outputMethod-saveAsHTML =
    .label = Gardar como HTML
bibliography-outputMethod-copyToClipboard =
    .label = Copiar no portaretallos
bibliography-outputMethod-print =
    .label = Imprimir
bibliography-manageStyles-label = Xestionar os estilos...
styleEditor-locatorType =
    .aria-label = Tipo de localizador
styleEditor-locatorInput = Locator input
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Style editor
styleEditor-preview =
    .aria-label = Vista previa
publications-intro-page = As miñas publicacións
publications-intro = Os elementos que se engaden ás Miñas publicacións móstranse no teu perfil público na páxina de zotero.org. Se escolleu engadir ficheiros anexos, estes van a estar accesibles ao público baixo a licenza que especificase. Engade só aquel traballo que fixeras ti, e só aqueles ficheiros dos cales teñas permiso e queiras distribuílos.
publications-include-checkbox-files =
    .label = Incluír ficheiros
publications-include-checkbox-notes =
    .label = Incluír notas
publications-include-adjust-at-any-time = Podes precisar que se amosa e cando desde a colección As miñas publicacións
publications-intro-authorship =
    .label = Creei este traballo.
publications-intro-authorship-files =
    .label = Creei eu este traballo co que teño todos os dereitos para difundir os ficheiros que inclúe.
publications-sharing-page = Escolle como se comparte a túa obra
publications-sharing-keep-rights-field =
    .label = Manter o campo de dereitos de propiedade
publications-sharing-keep-rights-field-where-available =
    .label = Manter os mesmos dereitos de autor onde sexa posible
publications-sharing-text = Pode reservar todos os dereitos da túa obra, darlle unha licenza Creative Commons ou cedela ao dominio público. En calquera caso, a obra estará dispoñible para o público en zotero.org.
publications-sharing-prompt = Queres permitir que a túa obra se comparta con outros?
publications-sharing-reserved =
    .label = Non, só publicala en zotero.org.
publications-sharing-cc =
    .label = Si, baixo unha licenza Creative Commons
publications-sharing-cc0 =
    .label = Si, e que esa obra estea baixo o dominio público.
publications-license-page = Escolle unha licenza Creative Commons
publications-choose-license-text = Unha licenza Creative Commons permítelle aos demais facer copias de redistribuír a túa obra sempre e cando che dean crédito pola obra e fornezan dunha ligazón coa licenza, así como indicar se se fixeron máis cambios na obra. Pódense especificar máis condicións embaixo.
publications-choose-license-adaptations-prompt = Permite facer adaptacións da obra e que se compartan?
publications-choose-license-yes =
    .label = Si
    .accesskey = Y
publications-choose-license-no =
    .label = Non
    .accesskey = N
publications-choose-license-sharealike =
    .label = Si, sempre que os demais fagan o mesmo
    .accesskey = G
publications-choose-license-commercial-prompt = Permite un uso comercial da obra?
publications-buttons-add-to-my-publications =
    .label = Engadir ás miñas publicacións
publications-buttons-next-sharing =
    .label = Seguinte: Compartir
publications-buttons-next-choose-license =
    .label = Escoller unha licenza
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Licenza Creative Commons Atribución 4.0 Internacional
licenses-cc-by-nd = Licenza Creative Commons Recoñecemento-Sen obra derivada  4.0 Internacional
licenses-cc-by-sa = Licenza Creative Commons Atribución - Compartir igual  4.0 Internacional
licenses-cc-by-nc = Licenza Creative Commons Recoñecemento-Non comercial  4.0 Internacional
licenses-cc-by-nc-nd = Licenza Creative Commons Atribución-Non comercial-Sen obra derivada  4.0 Internacional
licenses-cc-by-nc-sa = Licenza Creative Commons Atribución-Non comercial-Compartir igual  4.0 Internacional
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = P
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Densidade
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compacto
pane-item-details = Item Details
pane-info = Información
pane-abstract = Resumen
pane-attachments = Anexos
pane-notes = Notas
pane-note-info = Note Info
pane-libraries-collections = Libraries and Collections
pane-tags = Etiquetas
pane-related = Relacionados
pane-attachment-info = Información do anexo
pane-attachment-preview = Vista previa
pane-attachment-annotations = Anotacións
pane-header-attachment-associated =
    .label = Renomear o ficheiro asociado
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
    .dynamic-tooltiptext = Expand section
    .label = Expand { $section } section
section-button-collapse =
    .dynamic-tooltiptext = Collapse section
    .label = Collapse { $section } section
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
    .tooltiptext = Toggle Context Pane
pin-section =
    .label = Fixar sección
unpin-section =
    .label = Desfixar sección
collapse-other-sections =
    .label = Collapse Other Sections
expand-all-sections =
    .label = Expand All Sections
abstract-field =
    .placeholder = Engadir resumo
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filter Tags
context-notes-search =
    .placeholder = Buscar notas
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Colección nova
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Nova colección
    .buttonlabelaccept = Crear colección
new-collection-name = Nome:
new-collection-create-in = Crear en:
show-publications-menuitem =
    .label = Show My Publications
attachment-info-title = Título
attachment-info-filename = Nome de ficheiro
attachment-info-accessed = Consultado
attachment-info-pages = Páxinas
attachment-info-modified = Modificado
attachment-info-index = Indexado
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
note-info-title = Título
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
note-info-date-modified = Modificado
note-info-size = Tamaño
note-info-word-count = Word Count
note-info-character-count = Character Count
item-title-empty-note = Nota sen título
attachment-preview-placeholder = No attachment to preview
attachment-rename-from-parent =
    .tooltiptext = Rename File to Match Parent Item
file-renaming-auto-rename-prompt-title = Renaming Settings Changed
file-renaming-auto-rename-prompt-body = Would you like to rename existing files in your library to match the new settings?
file-renaming-auto-rename-prompt-yes = Preview Changes…
file-renaming-auto-rename-prompt-no = Keep Existing Filenames
rename-files-preview =
    .buttonlabelaccept = Rename Files
rename-files-preview-loading = Cargando...
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
    .aria-label = Quick Search mode
quicksearch-input =
    .aria-label = Busca rápida
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Ver como
item-pane-header-none =
    .label = Ningún
item-pane-header-title =
    .label = Título
item-pane-header-titleCreatorYear =
    .label = Título, creador, ano
item-pane-header-bibEntry =
    .label = Entrada de bibliografía
item-pane-header-more-options =
    .label = Máis opcións
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
            [one] Merge { $count } item
           *[other] Merge { $count } items
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = Switch to 64-bit { -app-name } for the best performance. Your data won’t be affected.
architecture-warning-action = Descargar { -app-name } 64-bit
architecture-x64-on-arm64-message = { -app-name } is running in emulated mode. A native version of { -app-name } will run more efficiently.
architecture-x64-on-arm64-action = Download { -app-name } for ARM64
first-run-guidance-authorMenu = { -app-name } lets you specify editors and translators too. You can turn an author into an editor or translator by selecting from this menu.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Buscar condición
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
    .title = Seleccionar elementos
select-items-dialog =
    .buttonlabelaccept = Select
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
file-type-webpage = Webpage
file-type-image = Imaxe
file-type-pdf = PDF
file-type-audio = Son
file-type-video = Vídeo
file-type-presentation = Presentación
file-type-document = Documento
file-type-ebook = Libro electrónico
post-upgrade-message = You’ve been upgraded to <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Learn about <a data-l10n-name="new-features-link">what’s new</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Paste and Search
mac-word-plugin-install-message = Zotero needs access to Word data to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = Install Word plugin
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
file-renaming-banner-message = { -app-name } now automatically keeps attachment filenames in sync as you make changes to items.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = The { -app-name } Connector must be updated to work with this version of { -app-name }.
userjs-pref-warning = Some { -app-name } settings have been overridden using an unsupported method. { -app-name } will revert them and restart.
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
