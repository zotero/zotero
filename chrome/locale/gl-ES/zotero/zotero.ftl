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
-os-name =
    { PLATFORM() ->
        [macos] macOS
        [windows] Windows
       *[other] Linux
    }
general-print = Imprimir
general-remove = Remove
general-add = Engadir
general-remind-me-later = Acórdamo despois
general-dont-ask-again = Non preguntar de novo
general-choose-file = Escoller ficheiro...
general-open-settings = Abrir axustes
general-settings = Axustes...
general-help = Axuda
general-tag = Etiqueta
general-got-it = Got It
general-done = Feito
general-view-troubleshooting-instructions = Ver instrucións para solución de problemas
general-go-back = Voltar
general-accept = Aceptar
general-cancel = Cancelar
cancel-button =
    .label = { general-cancel }
general-show-in-library = Amosar na biblioteca
general-restartApp = Reiniciar { -app-name }
general-restartInTroubleshootingMode = Reiniciar en modo solución de erros
general-save = Gardar
general-clear = Borrar
clear-button =
    .label = { general-clear }
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
general-more-information = Máis información
general-warning = Advertencia
general-type-to-continue = Escribe “{ $text }” para continuar.
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
general-loading = Cargando...
db-checking-integrity = Checking database integrity…
db-repairing = Repairing database…
citation-style-label = Estilo de cita:
language-label = Lingua:
menu-custom-group-submenu =
    .label = Máis opcións...
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
    .label = Anexar ficheiro...
menu-add-child-linked-file-attachment =
    .label = Anexar a ligazón do ficheiro...
menu-add-child-linked-url-attachment =
    .label = Anexar ligazón web...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nova nota independente
menu-new-item-note =
    .label = Nova nota de elemento
menu-restoreToLibrary =
    .label = Restaurar na biblioteca
menu-deletePermanently =
    .label = Borrar permanentemente
menu-tools-plugins =
    .label = Complementos
menu-view-columns-move-left =
    .label = Move Column Left
menu-view-columns-move-right =
    .label = Move Column Right
menu-view-hide-context-annotation-rows =
    .label = Hide Non-Matching Annotations
menu-view-note-font-size =
    .label = Tamaño tipográfico das notas
menu-view-note-tab-font-size =
    .label = Note Tab Font Size
menu-show-tabs-menu =
    .label = Amosar menú das lapelas
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Copiar anotación
           *[other] Copiar { $count } anotacións
        }
main-window-command =
    .label = Biblioteca
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = Listar todas as lapelas
filter-collections = Filtrar coleccións
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Buscar lapelas
zotero-tabs-menu-close-button =
    .title = Pechar lapela
zotero-toolbar-tabs-scroll-forwards =
    .title = Scroll forwards
zotero-toolbar-tabs-scroll-backwards =
    .title = Scroll backwards
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
recently-read = Lido recentemente
collections-menu-show-recently-read =
    .label = Amosar { recently-read }
item-menu-remove-from-recently-read =
    .label = Eliminar de { recently-read }
items-section-collections-selected =
    { $count ->
        [one] { $count } colección seleccionada
       *[other] { $count } coleccións seleccionadas
    }
items-section-searches-selected =
    { $count ->
        [one] { $count } saved search selected
       *[other] { $count } saved searches selected
    }
items-section-sources-selected =
    { $count ->
        [one] { $count } source selected
       *[other] { $count } sources selected
    }
items-section-library-collections =
    { $count ->
        [one] { $library } ({ $count } collection selected)
       *[other] { $library } ({ $count } collections selected)
    }
items-section-library-searches =
    { $count ->
        [one] { $library } ({ $count } saved search selected)
       *[other] { $library } ({ $count } saved searches selected)
    }
items-section-library-sources =
    { $count ->
        [one] { $library } ({ $count } source selected)
       *[other] { $library } ({ $count } sources selected)
    }
items-section-library-recently-read = { $library } ({ recently-read })
items-section-library = { $library }
collections-menu-rename =
    .label = Rename
edit-saved-search = Editar Procura Gravada
collections-menu-edit-search =
    .label = Edit Search
collections-menu-duplicate-search =
    .label = Duplicate Search
collections-menu-move-collection =
    .label = Mover a
collections-menu-copy-collection =
    .label = Copiar a
collections-menu-export =
    .label = Exportar...
collections-menu-generate-report =
    .label = Generate Report…
collections-menu-create-bibliography =
    .label = Create Bibliography…
collections-menu-unsubscribe =
    .label = Unsubscribe…
collections-menu-delete =
    .label =
        { $count ->
            [one] Delete Collection…
           *[other] Delete Collections…
        }
collections-menu-delete-with-items =
    .label =
        { $count ->
            [one] Delete Collection and Items…
           *[other] Delete Collections and Items…
        }
collections-menu-delete-search =
    .label =
        { $count ->
            [one] Delete Search…
           *[other] Delete Searches…
        }
collections-delete-title =
    { $count ->
        [one] Delete Collection
       *[other] Delete Collections
    }
collections-delete-message =
    { $count ->
        [one] Are you sure you want to delete this collection?
       *[other] Are you sure you want to delete { $count } collections?
    }
collections-delete-keep-items =
    { $count ->
        [one] Items within this collection will not be deleted.
       *[other] Items within these collections will not be deleted.
    }
collections-delete-with-items-title =
    { $count ->
        [one] Delete Collection and Items
       *[other] Delete Collections and Items
    }
collections-delete-with-items-message =
    { $count ->
        [one] Are you sure you want to delete this collection and move all items within it to the Trash?
       *[other] Are you sure you want to delete { $count } collections and move all items within them to the Trash?
    }
collections-delete-search-title =
    { $count ->
        [one] Delete Search
       *[other] Delete Searches
    }
collections-delete-search-message =
    { $count ->
        [one] Are you sure you want to delete this search?
       *[other] Are you sure you want to delete { $count } searches?
    }
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
import-online-relink-kb = { general-more-information }
import-online-connection-error = { -app-name } non puido conectar con { $targetApp }. Por favor, comprobe a súa conexión a internet e vólvao intentar.
tab-title-multiple-collections = Multiple
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } nota
           *[other] { $count } notas
        }
items-column-added-by = Engadido por
items-column-modified-by = Modificado por
items-column-last-read = Lido por última vez
report-error =
    .label = Informar dun erro ...
rtfScan-wizard =
    .title = Esculcar RTF
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. It currently supports citations in variations of the following formats:
rtfScan-introPage-description2 = Para comezar escolla abaixo un ficheiro RTF de entrada e un ficheiro de saída:
rtfScan-input-file = Ficheiro de entrada:
rtfScan-output-file = Ficheiro de saída:
rtfScan-no-file-selected = Ningún ficheiro seleccionado
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Escoller ficheiro de entrada
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Escoller ficheiro de saída
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
    .label = Reiniciar en modo solución de erros...
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
pane-libraries-collections = Bibliotecas e coleccións
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
            [one] { $count } anexo
           *[other] { $count } anexos
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } anotación
           *[other] { $count } anotacións
        }
section-attachments-move-to-trash-message = Are you sure you want to move “{ $title }” to the trash?
section-notes =
    .label =
        { $count ->
            [one] { $count } nota
           *[other] { $count } notas
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } etiqueta
           *[other] { $count } etiquetas
        }
section-related =
    .label = { $count } relacionados
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Expandir sección
    .label = Expandir a sección { $section }
section-button-collapse =
    .dynamic-tooltiptext = Colapsar sección
    .label = Colapsar a sección { $section }
annotations-count =
    { $count ->
        [one] { $count } anotación
       *[other] { $count } anotacións
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
    .tooltiptext = Alternar panel de elementos
toggle-context-pane =
    .tooltiptext = Alternar panel de contexto
pin-section =
    .label = Fixar sección
unpin-section =
    .label = Desfixar sección
collapse-other-sections =
    .label = Colapsar outras seccións
expand-all-sections =
    .label = Expandir todas as seccións
abstract-field =
    .placeholder = Engadir resumo
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtrar etiquetas
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
note-info-word-count = Número de palabras
note-info-character-count = Número de caracteres
item-title-empty-note = Nota sen título
attachment-preview-placeholder = Non hai anexos para previsualizar
attachment-rename-from-parent =
    .tooltiptext = Rename File to Match Parent Item
account-log-in = Iniciar sesión
account-not-logged-in-text = Log in to your Zotero account to sync your data.
account-error-login-session-expired = Your login session has expired. Please try again.
toggle-preview =
    .label =
        { $type ->
            [open] Agochar
            [collapsed] Mostrar
           *[unknown] Alternar
        } previsualización de anexos
annotation-image-not-available = [Image not available]
quicksearch-mode =
    .aria-label = Quick Search mode
quicksearch-input =
    .aria-label = Busca rápida
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
advanced-search = Busca avanzada
menuitem-advanced-search =
    .label = { advanced-search }
quicksearch-advanced-search-button =
    .tooltiptext = { advanced-search }
    .aria-label = { advanced-search }
advanced-search-close =
    .tooltiptext = Close Advanced Search
advanced-search-expand =
    .tooltiptext = Expand Advanced Search
advanced-search-collapse =
    .tooltiptext = Collapse Advanced Search
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
        [one] { $count } colección seleccionada
       *[other] { $count } coleccións seleccionadas
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } busca seleccionada
       *[other] { $count } buscas seleccionadas
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } obxecto seleccionado
       *[other] { $count } obxectos seleccionados
    }
item-pane-message-unselected =
    { $count ->
        [0] Non hai elementos nesta vista
        [one] { $count } elemento nesta vista
       *[other] { $count } elementos nesta vista
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] Non hai obxectos nesta vista
        [one] { $count } obxecto nesta vista
       *[other] { $count } obxectos nesta vista
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Combinar { $count } elemento
           *[other] Combinar { $count } elementos
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = Switch to 64-bit { -app-name } for the best performance. Your data won’t be affected.
architecture-warning-action = Descargar { -app-name } 64-bit
architecture-x64-on-arm64-message = { -app-name } is running in emulated mode. A native version of { -app-name } will run more efficiently.
architecture-x64-on-arm64-action = Download { -app-name } for ARM64
first-run-guidance-authorMenu = { -app-name } lets you specify editors and translators too. You can turn an author into an editor or translator by selecting from this menu.
first-run-guidance-readAloud = { -app-name } can now read your documents to you using natural-sounding voices.
advanced-search-remove-btn =
    .tooltiptext = Remove Condition
advanced-search-add-btn =
    .tooltiptext = Add Condition
advanced-search-group-btn =
    .tooltiptext = Add Condition Group
advanced-search-remove-group-btn =
    .tooltiptext = Remove Group
advanced-search-ungroup-btn =
    .tooltiptext = Ungroup Conditions
advanced-search-result-level-menu =
    .aria-label = Result type
advanced-search-result-level-prefix-root =
    .value = Procurar
advanced-search-join-prefix-root =
    .value = matching
advanced-search-result-level-any =
    .label = any items
advanced-search-result-level-item =
    .label = top-level items
advanced-search-result-level-attachment =
    .label = attachments
advanced-search-result-level-note =
    .label = notes
advanced-search-result-level-annotation =
    .label = apuntamentos
advanced-search-binding-menu =
    .aria-label = Match against the same item
advanced-search-binding-separate =
    .label = separately
advanced-search-binding-same-attachment =
    .label = in the same attachment
advanced-search-binding-same-note =
    .label = in the same note
advanced-search-binding-same-annotation =
    .label = in the same annotation
advanced-search-of-the-following =
    .value = of the following
advanced-search-binding-hint-attachment =
    .value = These conditions can match separate attachments.
advanced-search-binding-hint-note =
    .value = These conditions can match separate notes.
advanced-search-binding-hint-annotation =
    .value = These conditions can match separate annotations.
advanced-search-level-warning-mixed = These conditions cannot all match the same item, so this search will never return results. Try matching “{ $matchAny }” of them, or set the result type to “{ $topLevelItems }”.
advanced-search-level-warning-unreachable = This search has a condition that cannot apply to the chosen result type. Set the result type to “{ $topLevelItems }” or remove the incompatible condition.
advanced-search-group-warning-unreachable =
    A condition here cannot be in the same { $entity ->
        [attachment] attachment
        [note] note
       *[annotation] annotation
    }. Match these separately or remove the incompatible condition.
advanced-search-group-warning-mixed = These conditions cannot all match the same item, so this group will never match. Try matching “{ $matchAny }” of them, or set the result type to “{ $topLevelItems }”.
advanced-search-bind-same-attachment =
    .label = Match the same attachment
advanced-search-bind-same-note =
    .label = Match the same note
advanced-search-bind-same-annotation =
    .label = Match the same annotation
advanced-search-conditions-menu =
    .aria-label = Buscar condición
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operador
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Valor
    .label = { $label }
search-operator-isEmpty = is empty
search-operator-isNotEmpty = is not empty
search-conditions-tooltip-fields = Campos:
search-conditions-collection = Colección:
search-conditions-savedSearch = Busca gardada
search-conditions-itemTypeID = Tipo de elemento
search-conditions-tag = Etiqueta
search-conditions-numTags = # of Tags
search-conditions-numNotes = # of Notes
search-conditions-numAttachments = # of Attachments
search-conditions-numAnnotations = # of Annotations
search-conditions-note = Nota
search-conditions-childNote = Nota filla
search-conditions-creator = Creador
search-conditions-thesisType = Tipo de tese
search-conditions-reportType = Tipo de informe
search-conditions-videoRecordingFormat = Formato de gravación de vídeo
search-conditions-audioFileType = Tipo de ficheiro de son
search-conditions-audioRecordingFormat = Formato de gravación de son
search-conditions-letterType = Tipo de carta
search-conditions-interviewMedium = Medio da entrevista
search-conditions-manuscriptType = Tipo de manuscrito
search-conditions-presentationType = Tipo de presentación
search-conditions-mapType = Tipo de mapa
search-conditions-artworkMedium = Medio de ilustracións
search-conditions-dateModified = Data na que se modificou
search-conditions-fulltextContent = Contido do adxunto
search-conditions-programmingLanguage = Linguaxe de programación
search-conditions-fileTypeID = Tipo de ficheiro adxunto
search-conditions-attachmentStorageType = Attachment Storage Type
search-conditions-lastRead = Attachment Last Read
search-conditions-annotationText = Texto da nota
search-conditions-annotationComment = Comentario da nota
search-conditions-annotationType = Annotation Type
search-conditions-annotationColor = Annotation Color
search-conditions-annotationAuthor = Annotation Author
search-conditions-anyField = Calquera campo
search-conditions-titleCreatorYear = Título, creador, ano
search-conditions-submenu-attachment = Anexo
search-conditions-submenu-annotation = Anotación
search-conditions-short-fulltextContent = Content
search-conditions-short-fileTypeID = Tipo de ficheiro
search-conditions-short-attachmentStorageType = Storage Type
search-conditions-short-lastRead = Lido por última vez
search-conditions-short-annotationText = Text
search-conditions-short-annotationComment = Comment
search-conditions-short-annotationType = Tipo
search-conditions-short-annotationColor = Color
search-conditions-short-annotationAuthor = Autor
find-pdf-files-added =
    { $count ->
        [one] { $count } ficheiro engadido
       *[other] { $count } ficheiros engadidos
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
file-type-webpage = Páxina web
file-type-image = Imaxe
file-type-pdf = PDF
file-type-audio = Son
file-type-video = Vídeo
file-type-presentation = Presentación
file-type-document = Documento
file-type-ebook = Libro electrónico
attachment-storage-type-storedFile = Stored File
attachment-storage-type-linkedFile = Linked File
attachment-storage-type-webLink = Web Link
post-upgrade-message = You’ve been upgraded to <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Learn about <a data-l10n-name="new-features-link">what’s new</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Pegar e buscar
mac-word-plugin-install-message = Zotero needs access to Word data to install the Word plugin.
mac-word-plugin-install-folder-message = { -app-name } needs access to Word’s startup folder to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = Install Word plugin
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Install the plugin in the Word startup folder
mac-word-plugin-install-folder-dialog-button = Instalar
mac-word-plugin-install-wrong-folder-selected = The suggested folder must be selected. Please try again without choosing a different folder.
file-renaming-banner-message = { -app-name } now automatically keeps attachment filenames in sync as you make changes to items.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = The { -app-name } Connector must be updated to work with this version of { -app-name }.
userjs-pref-warning = Some { -app-name } settings have been overridden using an unsupported method. { -app-name } will revert them and restart.
migrate-extra-fields-progress-message = Migrating new fields from Extra field
search-normalization-progress-message = Indexing items for search
long-tag-fixer-window-title =
    .title = Dividir etiquetas
long-tag-fixer-button-dont-split =
    .label = Non dividir
menu-normalize-attachment-titles =
    .label = Normalize Attachment Titles…
normalize-attachment-titles-title = Normalize Attachment Titles
normalize-attachment-titles-text =
    { -app-name } automatically renames files on disk using parent item metadata, but it uses separate, simpler titles such as “Full Text PDF”, “Preprint PDF”, or “PDF” for primary attachments to keep the items list cleaner and avoid duplicating information.
    
    In older versions of { -app-name }, as well as when using certain plugins, attachment titles could be changed unnecessarily to match the filenames.
    
    Would you like to update the selected attachments to use simpler titles? Only primary attachments with titles that match the filename will be changed.
banner-close-button =
    .aria-label = Dismiss notification
plugins-blocked-plugin =
    .message = This plugin has been disabled by { -app-name }.
data-dir-unsupported-storage = This can happen if the { -app-name } data directory is in a cloud storage folder (OneDrive, Dropbox, etc.) or on a network share.
login-manager-reset = { -app-name } was unable to read your saved login information, so it has been reset. Please log in again in the { preferences-pane-account } pane of the { -app-name } settings.
os-keystore-save-failed =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t access the { -os-name } Keychain to securely save your credentials. Make sure your Keychain is accessible and try again.
        [windows] { -app-name } couldn’t securely save your credentials. Try again or restart { -app-name }.
       *[other] { -app-name } couldn’t access your { -os-name } keyring to securely save your credentials. Make sure a keyring service is running and try again.
    }
os-keystore-migrate-failed =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t access the { -os-name } Keychain to encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Make sure your Keychain is accessible and restart { -app-name }.
        [windows] { -app-name } couldn’t encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Restart { -app-name } and try again.
       *[other] { -app-name } couldn’t access your { -os-name } keyring to encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Make sure a keyring service is running and restart { -app-name }.
    }
search-button =
    .label = Buscar
save-search-new-button =
    .label = Save Search…
save-search-edit-button =
    .label = Gardar
save-search-name-title = Gardar a busca
save-search-name-message = Enter a name for the saved search:
saved-search-close-confirmation-title = Editing Saved Search
saved-search-close-confirmation-body = Do you want to save changes you made to this saved search?
item-pane-batch-editing-prompt =
    .aria-label = Batch editing
item-pane-batch-editing-enable =
    .label = Edit Multiple Items…
item-pane-batch-editing-multiple-values-placeholder = Multiple
item-pane-batch-editing-clear-values = Clear all values
item-pane-batch-editing-header =
    { $count ->
        [one] Editing { $count } item
       *[other] Editing { $count } items
    }
item-pane-batch-editing-done =
    .label = { general-done }
undo-action-edit-metadata =
    { $count ->
        [one] Edit Metadata
       *[other] Edit Metadata for { $count } Items
    }
undo-action-edit-field =
    { $count ->
        [one] Edit of “{ $field }”
       *[other] Edit of “{ $field }” for { $count } Items
    }
undo-action-normalize-attachment-titles = Normalize Attachment Title
undo-action-trash =
    { $count ->
        [one] Trash Item
       *[other] Trash { $count } Items
    }
undo-action-restore-items =
    { $count ->
        [one] Restore Item
       *[other] Restore { $count } Items
    }
undo-action-trash-collection =
    { $count ->
        [one] Trash Collection
       *[other] Trash { $count } Collections
    }
undo-action-trash-search =
    { $count ->
        [one] Trash Saved Search
       *[other] Trash { $count } Saved Searches
    }
undo-action-restore-collection =
    { $count ->
        [one] Restore Collection
       *[other] Restore { $count } Collections
    }
undo-action-restore-objects =
    { $count ->
        [one] Restore Object
       *[other] Restore { $count } Objects
    }
undo-action-add-to-collection =
    { $count ->
        [one] Add to Collection
       *[other] Add { $count } Items to Collection
    }
undo-action-remove-from-collection =
    { $count ->
        [one] Remove from Collection
       *[other] Remove { $count } Items from Collection
    }
undo-action-move-to-collection =
    { $count ->
        [one] Move to Collection
       *[other] Move { $count } Items to Collection
    }
undo-action-rename-collection = Rename Collection
undo-action-move-collection = Move Collection
undo-action-add-tag =
    { $count ->
        [one] Add Tag
       *[other] Add Tag to { $count } Items
    }
undo-action-change-tag = Change Tag
undo-action-split-tag = Split Tag
undo-action-remove-tag =
    { $count ->
        [one] Remove Tag
       *[other] Remove Tag from { $count } Items
    }
undo-action-remove-tags-from-item =
    { $count ->
        [one] Remove Tag
       *[other] Remove { $count } Tags
    }
undo-action-remove-all-tags = Remove All Tags
undo-action-edit-note = Editar a nota
undo-action-add-creator = Add Creator
undo-action-remove-creator = Remove Creator
undo-action-edit-creator = Edit Creator
undo-action-reorder-creator = Reorder Creator
undo-action-change-type = Cambiar o tipo de elemento
undo-action-change-parent-item =
    { $count ->
        [one] Change Parent Item
       *[other] Change Parent for { $count } Items
    }
undo-action-convert-to-standalone =
    { $count ->
        [one] Convert to Standalone
       *[other] Convert { $count } Items to Standalone
    }
undo-action-add-related = Add Related
undo-action-remove-related = Remove Related
undo-action-merge-items =
    { $count ->
        [one] Merge Item
       *[other] Merge { $count } Items
    }
menu-edit-undo-action = Undo { $action }
menu-edit-redo-action = Redo { $action }
