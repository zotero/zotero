general-print = Imprimir
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Eliminar
general-add = Añadir
general-remind-me-later = Recuérdamelo más tarde
general-choose-file = Elegir archivo...
general-open-settings = Abrir ajustes
general-help = Ayuda
general-tag = Tag
menu-file-show-in-finder =
    .label = Mostrar en el buscador
menu-file-show-file =
    .label = Mostrar archivo
menu-file-show-files =
    .label = Mostrar archivos
menu-print =
    .label = { general-print }
menu-density =
    .label = Densidad
add-attachment = Añadir adjunto
new-note = Nueva nota
menu-add-by-identifier =
    .label = Añadir por identificador
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Añadir archivo...
menu-add-standalone-linked-file-attachment =
    .label = Añadir enlace a archivo...
menu-add-child-file-attachment =
    .label = Adjuntar archivo...
menu-add-child-linked-file-attachment =
    .label = Adjuntar enlace a archivo...
menu-add-child-linked-url-attachment =
    .label = Adjuntar enlace web...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nueva nota independiente
menu-new-item-note =
    .label = Nueva nota de elemento
menu-restoreToLibrary =
    .label = Restaurar a la biblioteca
menu-deletePermanently =
    .label = Eliminar permanentemente...
menu-tools-plugins =
    .label = Extensiones
main-window-command =
    .label = { -app-name }
zotero-toolbar-tabs-menu =
    .tooltiptext = Listar todas las pestañas
filter-collections = Filtrar colecciones
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Buscar pestañas
zotero-tabs-menu-close-button =
    .title = Cerrar pestaña
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Renombrar colección
collections-menu-edit-saved-search =
    .label = Modificar la carpeta de búsqueda
item-creator-moveDown =
    .label = Bajar
item-creator-moveToTop =
    .label = Mover al principio
item-creator-moveUp =
    .label = Subir
item-menu-viewAttachment =
    .label =
        Abrir { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] instantánea
                   *[other] adjunto
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] instantáneas
                   *[other] adjuntos
                }
        } { $openIn ->
            [tab] en nueva pestaña
            [window] en nueva ventana
           *[other] { "" }
        }
item-menu-add-file =
    .label = Archivo
item-menu-add-linked-file =
    .label = Archivo enlazado
item-menu-add-url =
    .label = Enlace web
view-online = Ver en línea
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Archivo renombrado a { $filename }
itembox-button-options =
    .tooltiptext = Abrir menú contextual
itembox-button-merge =
    .aria-label = Seleccione la versión del campo { $field }
create-parent-intro = Introduzca un DOI, ISBN, PMID, arXiv ID o ADS Bibcode para identificar este archivo:
reader-use-dark-mode-for-content =
    .label = Usar el modo oscuro para el contenido
update-updates-found-intro-minor = Hay disponible una actualización para { -app-name }:
update-updates-found-desc = Se recomienda aplicar esta actualización lo antes posible.
import-window =
    .title = Importar
import-where-from = ¿Desde dónde quiere importar?
import-online-intro-title = Introducción
import-source-file =
    .label = Un archivo (BibTex, RIS, Zotero RDF, etc.)
import-source-folder =
    .label = Una carpeta de PDF u otros archivos
import-source-online =
    .label = importación en línea de { $targetApp }
import-options = Opciones
import-importing = Importando...
import-create-collection =
    .label = Coloca colecciones y elementos importados en una nueva colección
import-recreate-structure =
    .label = Volver a crear la estructura de carpetas como colecciones
import-fileTypes-header = Tipos de archivos a importar:
import-fileTypes-pdf =
    .label = PDF
import-fileTypes-other =
    .placeholder = Otros archivos por patrón, separados por comas (por ejemplo, *.jpg,*.png)
import-file-handling = Manejo de archivos
import-file-handling-store =
    .label = Copiar archivos a la carpeta de almacenamiento de { -app-name }
import-file-handling-link =
    .label = Enlazar a archivos en ubicación original
import-fileHandling-description = Los archivos enlazados no pueden ser sincronizados por { -app-name }.
import-online-new =
    .label = Descargar solo los elementos nuevos; no actualizar los elementos previamente importados
import-mendeley-username = Nombre de usuario
import-mendeley-password = Contraseña
general-error = Error
file-interface-import-error = Ha ocurrido un error al intentar importar el archivo seleccionado. Asegúrese de que el archivo es válido e inténtelo de nuevo.
file-interface-import-complete = Importación completada
file-interface-items-were-imported =
    { $numItems ->
        [0] No se importó ningún elemento
        [one] Se importó un elemento
       *[other] { $numItems } elementos se importaron
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] No se ha vuelto a vincular ningún elemento
        [one] Se ha vuelto a vincular un elemento
       *[other] { $numRelinked } elementos se han vuelto a vincular
    }
import-mendeley-encrypted = La base de datos Mendeley seleccionada no se puede leer, probablemente porque está encriptada. Consulte <a data-l10n-name="mendeley-import-kb">¿Cómo importo una biblioteca Mendeley a Zotero?</a> para obtener más información.
file-interface-import-error-translator = Se ha producido un error al importar el archivo seleccionado con "{ $translator }". Asegúrese de que el archivo es válido e inténtelo de nuevo.
import-online-intro = En el siguiente paso se le pedirá que inicie sesión en { $targetAppOnline } y conceda acceso a { -app-name }. Esto es necesario para importar su biblioteca { $targetApp } a { -app-name }.
import-online-intro2 = { -app-name } nunca verá ni almacenará su contraseña de { $targetApp }.
import-online-form-intro = Por favor, introduzca sus credenciales para iniciar sesión en { $targetAppOnline }. Esto es necesario para importar su biblioteca { $targetApp } a { -app-name }.
import-online-wrong-credentials = Error al iniciar sesión en { $targetApp }. Vuelva a introducir sus credenciales e inténtelo de nuevo.
import-online-blocked-by-plugin = La importación no puede continuar con { $plugin } instalado. Por favor, desactive esta extensión e inténtelo de nuevo.
import-online-relink-only =
    .label = Volver a vincular las citas de Mendeley Desktop
import-online-relink-kb = Más información
import-online-connection-error = { -app-name } no ha podido conectarse a { $targetApp }. Compruebe su conexión a Internet e inténtelo de nuevo.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Nota
            [many] { $count } Notas
           *[other] { $count } Notas
        }
report-error =
    .label = Informar de errores...
rtfScan-wizard =
    .title = Escaneo RTF
rtfScan-introPage-description = { -app-name } puede extraer y reformatear automáticamente citas e insertar una bibliografía en archivos RTF. Para empezar, elija un archivo RTF a continuación.
rtfScan-introPage-description2 = Para comenzar, seleccione a continuación un archivo de entrada RTF y un archivo de salida:
rtfScan-input-file = Archivo de entrada
rtfScan-output-file = Archivo de salida
rtfScan-no-file-selected = Ningún archivo seleccionado
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Elegir archivo de entrada
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Elegir archivo de salida
rtfScan-intro-page =
    .label = Introducción
rtfScan-scan-page =
    .label = Escaneando por citas
rtfScan-scanPage-description = { -app-name } está escaneando su documento en busca de citas. Por favor, tenga paciencia.
rtfScan-citations-page =
    .label = Verificar elementos citados
rtfScan-citations-page-description = Revise la lista de citas reconocidas que aparece a continuación para asegurarse de que { -app-name } ha seleccionado correctamente los elementos correspondientes. Cualquier cita no mapeada o ambigua debe resolverse antes de proceder al siguiente paso.
rtfScan-style-page =
    .label = Formato de documento
rtfScan-format-page =
    .label = Formato de citas
rtfScan-format-page-description = { -app-name } está procesando y formateando su archivo RTF. Tenga paciencia.
rtfScan-complete-page =
    .label = Escaneado RTF completado
rtfScan-complete-page-description = Su documento ha sido escaneado y procesado. Por favor, asegúrese de que esté formateado correctamente.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Ejecutar JavaScript
runJS-editor-label = Código:
runJS-run = Ejecutar
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Valor de retorno:
       *[other] Resultado:
    }
runJS-run-async = Ejecutar como función asíncrona
bibliography-window =
    .title = { -app-name } - Crear cita/bibliografía
bibliography-style-label = Estilo de cita:
bibliography-locale-label = Idioma:
bibliography-displayAs-label = Mostrar citas como:
bibliography-advancedOptions-label = Opciones avanzadas
bibliography-outputMode-label = Modo de salida:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citaciones
            [note] Notas
           *[other] Citaciones
        }
bibliography-outputMode-bibliography =
    .label = Bibliografí­a
bibliography-outputMethod-label = Método de salida:
bibliography-outputMethod-saveAsRTF =
    .label = Guardar como RTF
bibliography-outputMethod-saveAsHTML =
    .label = Guardar como HTML
bibliography-outputMethod-copyToClipboard =
    .label = Copiar al portapapeles
bibliography-outputMethod-print =
    .label = Imprimir
bibliography-manageStyles-label = Gestionar estilos...
integration-docPrefs-window =
    .title = { -app-name } - Preferencias del documento
integration-addEditCitation-window =
    .title = { -app-name } - Añadir/Editar cita
integration-editBibliography-window =
    .title = { -app-name } - Editar bibliografía
integration-quickFormatDialog-window =
    .title = { -app-name } - Formato rápido de cita
integration-prefs-displayAs-label = Mostrar citas como:
integration-prefs-footnotes =
    .label = Notas al pie
integration-prefs-endnotes =
    .label = Notas al final
integration-prefs-bookmarks =
    .label = Guardar citas como marcadores
integration-prefs-bookmarks-description = Los marcadores se pueden compartir entre Word y LibreOffice, pero pueden causar errores si se modifican accidentalmente y no se pueden insertar en notas a pie de página.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] El documento debe guardarse como .doc o .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Actualizar citas automáticamente
    .tooltip = Las citas pendientes de actualización se resaltarán en el documento
integration-prefs-automaticCitationUpdates-description = Deshabilitar las actualizaciones puede acelerar la inserción de citas en documentos grandes. Haga clic en Actualizar para actualizar manualmente las citas.
integration-prefs-automaticJournalAbbeviations =
    .label = Usar abreviaturas de la revista MEDLINE
integration-prefs-automaticJournalAbbeviations-description = El campo «Abrev. de la revista» será ignorado.
integration-prefs-exportDocument =
    .label = Cambiar a un procesador de texto diferente...
publications-intro-page =
    .label = Mis publicaciones
publications-intro = Los elementos que añada a Mis publicaciones se mostrarán en su página de perfil en zotero.org. Si elige incluir los archivos adjuntos, se pondrán a disposición del público bajo la licencia que especifique. Añada únicamente trabajos que usted mismo haya creado e incluya archivos solo si tiene los derechos para distribuirlos y desea hacerlo.
publications-include-checkbox-files =
    .label = Incluir archivos
publications-include-checkbox-notes =
    .label = Incluir notas
publications-include-adjust-at-any-time = Puedes ajustar lo que se mostrará en cualquier momento desde la colección Mis publicaciones.
publications-intro-authorship =
    .label = Yo creé este trabajo.
publications-intro-authorship-files =
    .label = Yo creé este trabajo y poseo los derechos para distribuirlo incluyendo sus archivos.
publications-sharing-page =
    .label = Elija cómo se puede compartir su trabajo
publications-sharing-keep-rights-field =
    .label = Mantener el campo Derechos existente
publications-sharing-keep-rights-field-where-available =
    .label = Mantener el campo de Derechos existente donde esté disponible
publications-sharing-text = Puede reservarse todos los derechos de su trabajo, licenciarlo bajo una licencia Creative Commons o publicarlo en dominio público. En todos los casos, el trabajo se pondrá a disposición del público a través de zotero.org.
publications-sharing-prompt = ¿Le gustaría permitir que otros compartan su trabajo?
publications-sharing-reserved =
    .label = No, publicar mi trabajo únicamente en zotero.org.
publications-sharing-cc =
    .label = Sí, bajo una licencia Creative Commons
publications-sharing-cc0 =
    .label = Sí, y colocar mi trabajo en el dominio público
publications-license-page =
    .label = Elija una licencia Creative Commons
publications-choose-license-text = Una licencia Creative Commons permite que otros copien y redistribuyan su trabajo siempre que proporcionen el crédito apropiado, proporcionen un enlace a la licencia e indiquen si se realizaron cambios. Las condiciones adicionales se pueden especificar a continuación.
publications-choose-license-adaptations-prompt = ¿Permitir compartir adaptaciones de su trabajo?
publications-choose-license-yes =
    .label = Sí
    .accesskey = Y
publications-choose-license-no =
    .label = No
    .accesskey = N
publications-choose-license-sharealike =
    .label = Sí, siempre que se comparta bajo la misma licencia
    .accesskey = S
publications-choose-license-commercial-prompt = ¿Permitir el uso comercial de su trabajo?
publications-buttons-add-to-my-publications =
    .label = Añadir a Mis publicaciones
publications-buttons-next-sharing =
    .label = Siguiente: Compartir
publications-buttons-next-choose-license =
    .label = Escoge una licencia
licenses-cc-0 = CC0 1.0 Dedicación Universal al Dominio Público
licenses-cc-by = Licencia Creative Commons Atribución 4.0 Internacional
licenses-cc-by-nd = Licencia Creative Commons Atribución-NoDerivadas 4.0 Internacional
licenses-cc-by-sa = Licencia Creative Commons Atribución-CompartirIgual 4.0 Internacional
licenses-cc-by-nc = Licencia Creative Commons Atribución-NoComercial 4.0 Internacional
licenses-cc-by-nc-nd = Licencia Creative Commons Atribución-NoComercial-NoDerivadas 4.0 Internacional
licenses-cc-by-nc-sa = Licencia Creative Commons Atribución-NoComercial-CompartirIgual 4.0 Internacional
licenses-cc-more-info = Asegúrese de haber leído las condiciones de uso de Creative Commons <a data-l10n-name="license-considerations">Consideraciones para los licenciantes</a> antes de poner su obra bajo una licencia CC. Tenga en cuenta que la licencia que aplique no puede revocarse, aunque más adelante elija condiciones diferentes o deje de publicar la obra.
licenses-cc0-more-info = Asegúrese de haber leído las condiciones de uso de Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> antes de poner su obra bajo licencia CC0. Tenga en cuenta que dedicar su obra al dominio público es irreversible, aunque más adelante elija condiciones diferentes o deje de publicar la obra.
restart-in-troubleshooting-mode-menuitem =
    .label = Reiniciar en modo de solución de problemas...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Reiniciar en modo de solución de problemas
restart-in-troubleshooting-mode-dialog-description = { -app-name } se reiniciará con todas las extensiones desactivadas. Es posible que algunas funciones no funcionen correctamente mientras esté activado el modo de solución de problemas.
menu-ui-density =
    .label = Densidad
menu-ui-density-comfortable =
    .label = Confortable
menu-ui-density-compact =
    .label = Compacto
pane-info = Información
pane-abstract = Resumen
pane-attachments = Adjuntos
pane-notes = Notas
pane-libraries-collections = Bibliotecas y colecciones
pane-tags = Etiquetas
pane-related = Relacionado
pane-attachment-info = Adjuntar información
pane-attachment-preview = Previsualizar
pane-attachment-annotations = Anotaciones
pane-header-attachment-associated =
    .label = Renombrar el archivo asociado
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } Adjunto
            [many] { $count } Adjuntos
           *[other] { $count } Adjuntos
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } Anotación
            [many] { $count } Anotaciones
           *[other] { $count } Anotaciones
        }
section-notes =
    .label =
        { $count ->
            [one] { $count } Nota
            [many] { $count } Notas
           *[other] { $count } Notas
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } Etiqueta
            [many] { $count } Etiquetas
           *[other] { $count } Etiquetas
        }
section-related =
    .label = { $count } Relacionado
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Ampliar sección
    .label = Expandir { $section }  sección
section-button-collapse =
    .dynamic-tooltiptext = Contraer sección
    .label = Contraer { $section } sección
annotations-count =
    { $count ->
        [one] { $count } Anotación
        [many] { $count } Anotaciones
       *[other] { $count } Anotaciones
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
    .label = Anclar sección
unpin-section =
    .label = Desanclar sección
collapse-other-sections =
    .label = Contraer otras secciones
expand-all-sections =
    .label = Ampliar todas las secciones
abstract-field =
    .placeholder = Añadir resumen...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtrar etiquetas
context-notes-search =
    .placeholder = Buscar notas
new-collection-dialog =
    .title = Nueva colección
    .buttonlabelaccept = Crear collección
new-collection-name = Nombre:
new-collection-create-in = Crear en:
attachment-info-filename = Nombre de archivo
attachment-info-accessed = Accedido
attachment-info-pages = Páginas
attachment-info-modified = Modificado
attachment-info-index = Indexado
attachment-info-convert-note =
    .label =
        Migrar a nota { $type ->
            [standalone] independiente
            [child] elemento
           *[unknown] nuevo
        }
    .tooltiptext = Ya no es posible añadir notas a los archivos adjuntos, pero puedes editar esta nota migrándola a una nota independiente.
attachment-preview-placeholder = No hay archivos adjuntos para la vista previa
toggle-preview =
    .label =
        { $type ->
            [open] Ocultar
            [collapsed] Mostrar
           *[unknown] Alternar
        } vista previa del archivo adjunto
quickformat-general-instructions =
    Use las flechas izquierda/derecha para navegar por los elementos de esta cita. { $dialogMenu ->
        [active] Pulse Mayúsculas-Tabulador para enfocar el menú de diálogo.
       *[other] { "" }
    } Pulse { return-or-enter } para guardar los cambios en esta cita. Pulse Escape para descartar los cambios y cerrar el diálogo.
quickformat-aria-bubble = Este elemento se incluye en la cita. Pulse la barra espaciadora para personalizar el elemento. { quickformat-general-instructions }
quickformat-aria-input = Escriba para buscar un elemento que incluir en esta cita. Pulse Tab para navegar por la lista de resultados de la búsqueda. { quickformat-general-instructions }
quickformat-aria-item = Pulse { return-or-enter } para añadir este elemento a la cita. Pulse Tab para volver al campo de búsqueda.
quickformat-accept =
    .tooltiptext = Guardar ediciones de esta cita
quickformat-locator-type =
    .aria-label = Tipo de localizador
quickformat-locator-value = Localizador
quickformat-citation-options =
    .tooltiptext = Mostrar opciones de citación
insert-note-aria-input = Escriba para buscar una nota. Pulse Tab para navegar por la lista de resultados. Pulse Escape para cerrar el cuadro de diálogo.
insert-note-aria-item = Pulse { return-or-enter } para seleccionar esta nota. Pulse Tab para volver al campo de búsqueda. Pulse Escape para cerrar el cuadro de diálogo.
quicksearch-mode =
    .aria-label = Modo de búsqueda rápida
quicksearch-input =
    .aria-label = Búsqueda rápida
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Ver como
item-pane-header-none =
    .label = Ninguno
item-pane-header-title =
    .label = Título
item-pane-header-titleCreatorYear =
    .label = Título, Creador, Año
item-pane-header-bibEntry =
    .label = Entrada bibliográfica
item-pane-header-more-options =
    .label = Más opciones
item-pane-message-items-selected =
    { $count ->
        [0] Sin elementos seleccionados
        [one] { $count } elemento seleccionado
       *[other] { $count } elementos seleccionados
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } colección seleccionada
        [many] { $count } colecciones seleccionadas
       *[other] { $count } colecciones seleccionadas
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } búsqueda seleccionada
        [many] { $count } búsquedas seleccionadas
       *[other] { $count } búsquedas seleccionadas
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } objeto seleccionado
        [many] { $count } objetos seleccionados
       *[other] { $count } objetos seleccionados
    }
item-pane-message-unselected =
    { $count ->
        [0] No hay elementos en esta vista
        [one] { $count } elemento en esta vista
       *[other] { $count } elementos en esta vista
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Fusionar { $count } elemento
            [many] Fusionar { $count } elementos
           *[other] Fusionar { $count } elementos
        }
locate-library-lookup-no-resolver = Debe elegir un sistema de resolución en el panel { $pane } de los ajustes de { -app-name }.
architecture-win32-warning-message = { -app-name } se ejecuta en modo de 32 bits en una versión de 64 bits de Windows. { -app-name } se ejecutará de forma más eficiente en modo de 64 bits.
architecture-warning-action = Descargar { -app-name } de 64-bit
first-run-guidance-quickFormat =
    Escriba un título, autor o año para buscar una referencia.
    
    Una vez hecha la selección, haga clic en la burbuja o selecciónela con el teclado y pulse ↓/Espacio para mostrar las opciones de citación, como el número de página, el prefijo y el sufijo.
    
    También puede añadir directamente un número de página incluyéndolo con sus términos de búsqueda o escribiéndolo después de la burbuja y pulsando { return-or-enter }.
first-run-guidance-authorMenu = { -app-name } le permite especificar también editores y traductores. Puede convertir un autor en editor o traductor seleccionándolo en este menú.
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
