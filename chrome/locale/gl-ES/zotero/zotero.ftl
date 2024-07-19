general-print = Imprimir
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Remove
general-add = Engadir
general-remind-me-later = Acórdamo despois
general-choose-file = Escoller ficheiro...
general-open-settings = Abrir axustes
general-help = Axuda
general-tag = Tag
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
main-window-command =
    .label = { -app-name }
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
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Rename Collection
collections-menu-edit-saved-search =
    .label = Editar Procura Gravada
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
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
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
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = Para comezar escolla abaixo un ficheiro RTF de entrada e un ficheiro de saída:
rtfScan-input-file = Ficheiro de entrada
rtfScan-output-file = Ficheiro de saída
rtfScan-no-file-selected = Ningún ficheiro seleccionado
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = Introdución
rtfScan-scan-page =
    .label = Esculcando as citas
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = Comproba os elementos citados
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = Formato de documentos
rtfScan-format-page =
    .label = Formato de citas
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = Esculcado completo do RTF
rtfScan-complete-page-description = O seu documento xa foi esculcado e procesado. Asegúrate de que o formato é correcto.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Run JavaScript
runJS-editor-label = Código:
runJS-run = Run
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Run as async function
bibliography-window =
    .title = { -app-name } - Create Citation/Bibliography
bibliography-style-label = Estilo de cita:
bibliography-locale-label = Lingua:
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
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = Mostrar as citas como:
integration-prefs-footnotes =
    .label = Notas ao pé de páxina
integration-prefs-endnotes =
    .label = Notas no rodapé
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = Os marcapáxinas pódense compartir entre Word e LibreOffice. Porén, se se modifican por erro xa non se poden introducir nas notas ao pé do texto.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Actualizar as citas automaticamente
    .tooltip = Vanse marcar as citas con actualizacións pendentes no documento
integration-prefs-automaticCitationUpdates-description = Desactivar as actualizacións pode acelerar a introdución de citas nos documentos grandes. Preme en refrescar para actualizar as citas de xeito manual.
integration-prefs-automaticJournalAbbeviations =
    .label = Empregar as abreviaturas de MEDLINE
integration-prefs-automaticJournalAbbeviations-description = O campo «Abrv. Xornal» hase ignorar.
integration-prefs-exportDocument =
    .label = Mudar a outro editor de textos...
publications-intro-page =
    .label = As miñas publicacións
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
publications-sharing-page =
    .label = Escolle como se comparte a túa obra
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
publications-license-page =
    .label = Escolle unha licenza Creative Commons
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
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = P
restart-in-troubleshooting-mode-dialog-title = Restart in Troubleshooting Mode
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Densidade
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compacto
pane-info = Información
pane-abstract = Resumen
pane-attachments = Anexos
pane-notes = Notas
pane-libraries-collections = Libraries and Collections
pane-tags = Etiquetas
pane-related = Relacionados
pane-attachment-info = Información do anexo
pane-attachment-preview = Vista previa
pane-attachment-annotations = Anotacións
pane-header-attachment-associated =
    .label = Renomear o ficheiro asociado
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
new-collection-dialog =
    .title = Nova colección
    .buttonlabelaccept = Crear colección
new-collection-name = Nome:
new-collection-create-in = Crear en:
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
attachment-preview-placeholder = No attachment to preview
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } Attachment Preview
quickformat-general-instructions =
    Use Left/Right Arrow to navigate the items of this citation. { $dialogMenu ->
        [active] Press Shift-Tab to focus the dialog's menu.
       *[other] { "" }
    } Press { return-or-enter } to save edits to this citation. Press Escape to discard the changes and close the dialog.
quickformat-aria-bubble = This item is included in the citation. Press space bar to customize the item. { quickformat-general-instructions }
quickformat-aria-input = Type to search for an item to include in this citation. Press Tab to navigate the list of search results. { quickformat-general-instructions }
quickformat-aria-item = Press { return-or-enter } to add this item to the citation. Press Tab to go back to the search field.
quickformat-accept =
    .tooltiptext = Save edits to this citation
quickformat-locator-type =
    .aria-label = Tipo de localizador
quickformat-locator-value = Localizador
quickformat-citation-options =
    .tooltiptext = Mostrar opcións de citado
insert-note-aria-input = Type to search for a note. Press Tab to navigate the list of results. Press Escape to close the dialog.
insert-note-aria-item = Press { return-or-enter } to select this note. Press Tab to go back to the search field. Press Escape to close the dialog.
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
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Merge { $count } item
           *[other] Merge { $count } items
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = { -app-name } is running in 32-bit mode on a 64-bit version of Windows. { -app-name } will run more efficiently in 64-bit mode.
architecture-warning-action = Descargar { -app-name } 64-bit
first-run-guidance-quickFormat =
    Type a title, author, and/or year to search for a reference.
    
    After you’ve made your selection, click the bubble or select it via the keyboard and press ↓/Space to show citation options such as page number, prefix, and suffix.
    
    You can also add a page number directly by including it with your search terms or typing it after the bubble and pressing { return-or-enter }.
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
