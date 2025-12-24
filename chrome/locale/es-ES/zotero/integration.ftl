integration-docPrefs-window =
    .title = { -app-name } - Preferencias del documento
integration-addEditCitation-window =
    .title = { -app-name } - Añadir/Editar cita
integration-editBibliography-window =
    .title = { -app-name } - Editar bibliografía
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Editar referencia
-integration-editBibliography-include-uncited = Para incluir un elemento no citado en su bibliografía, selecciónelo en la lista de elementos y pulse { general-add }.
-integration-editBibliography-exclude-cited = También puede excluir un elemento citado seleccionándolo de la lista de referencias y pulsando { general-remove }.
-integration-editBibliography-edit-reference = Para cambiar el formato de una referencia, use el editor de texto.
integration-editBibliography-wrapper =
    .aria-label = Diálogo de edición de bibliografía
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Diálogo de citas
integration-citationDialog-section-open = Abrir documentos ({ $count })
integration-citationDialog-section-selected = Elementos seleccionados ({ $count }/{ $total })
integration-citationDialog-section-cited =
    { $count ->
        [0] Elementos citados
       *[other] Elementos citados ({ $count })
    }
integration-citationDialog-details-suffix = Sufijo
integration-citationDialog-details-prefix = Prefijo
integration-citationDialog-details-suppressAuthor = Omitir autor
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Ajustes de citas
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] No hay elementos seleccionados, abiertos o citados que coincidan con la búsqueda actual.
       *[other] No hay elementos seleccionados ni abiertos.
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] No hay notas seleccionadas que coincidan con la búsqueda actual
       *[other] No hay notas seleccionadas
    }
integration-citationDialog-settings-keepSorted = Mantener las fuentes ordenadas.
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = Biblioteca
integration-citationDialog-mode-list = Lista
integration-citationDialog-btn-type-citation =
    .title = Añadir/Editar cita
integration-citationDialog-btn-type-add-note =
    .title = Añadir nota
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Use las flechas izquierda/derecha para navegar por los elementos de esta cita. Pulse la tecla Tab para seleccionar los elementos que desea añadir a esta cita.
integration-citationDialog-enter-to-add-item = Presione { return-or-enter } para añadir este elemento a la cita.
integration-citationDialog-search-for-items = Buscar elementos para añadir a la cita
integration-citationDialog-aria-bubble =
    .aria-description = Este elemento se incluye en la cita. Presione la barra espaciadora para personalizar el elemento. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Presione la tecla Tab para seleccionar los elementos que desea añadir a esta cita. Presione la tecla Escape para descartar los cambios y cerrar el cuadro de diálogo.
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Buscar una nota para insertar en el documento
integration-citationDialog-aria-item-list =
    .aria-description = Use las flechas arriba/abajo para cambiar la selección de elementos. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Use las flechas derecha/izquierda para cambiar la selección de elementos. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Colecciones.
    .aria-description = Seleccione una colección y pulse la tecla Tab para navegar por sus elementos.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = Este elemento se ha añadido a la cita. Pulse { return-or-enter } para añadirlo de nuevo o { delete-or-backspace } para eliminarlo.
integration-citationDialog-add-all = Añadir todo
integration-citationDialog-collapse-section =
    .title = Contraer sección
integration-citationDialog-bubble-empty = (sin título)
integration-citationDialog-add-to-citation = Añadir a cita
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
integration-error-unable-to-find-winword = { -app-name } no pudo encontrar una instancia de Word en ejecución.
integration-warning-citation-changes-will-be-lost = Ha realizado cambios en una cita que se perderán si continúa.
integration-warning-bibliography-changes-will-be-lost = Ha realizado cambios en la bibliografía que se perderán si continúa.
integration-warning-documentPreferences-changes-will-be-lost = Ha realizado cambios en las preferencias del documento que se perderán si continúa.
integration-warning-discard-changes = Descartar cambios
integration-warning-command-is-running = Ya se está ejecutando un comando de integración del procesador de textos.
