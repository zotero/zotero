preferences-window =
    .title = Ajustes de { -app-name }
preferences-appearance-title = Apariencia y idioma
preferences-auto-recognize-files =
    .label = Recuperación automática de metadatos de PDF y libros electrónicos
preferences-file-renaming-title = Renombrar archivos
preferences-file-renaming-intro = { -app-name } puede renombrar automáticamente los archivos basándose en los detalles del elemento principal (título, autor, etc.) y mantener los nombres de los archivos sincronizados a medida que realiza cambios. Los archivos descargados siempre se nombran inicialmente basándose en el elemento principal.
preferences-file-renaming-configure-button =
    .label = Configurar el cambio de nombre de archivos…
preferences-attachment-titles-title = Títulos de los archivos adjuntos
preferences-attachment-titles-intro = Los títulos de los archivos adjuntos son <label data-l10n-name="wiki-link">diferentes de los nombres de los archivos</label>. Para admitir algunos flujos de trabajo, { -app-name }  puede mostrar los nombres de los archivos en lugar de los títulos de los archivos adjuntos en la lista de elementos.
preferences-attachment-titles-show-filenames =
    .label = Mostrar los nombres de los archivos adjuntos en la lista de elementos
preferences-reader-title = Lector
preferences-reader-open-epubs-using = Abrir EPUB con
preferences-reader-open-snapshots-using = Abrir instantáneas con
preferences-reader-open-in-new-window =
    .label = Abrir archivos en ventanas nuevas en lugar de pestañas
preferences-reader-auto-disable-tool =
    .label = Desactivar las herramientas de anotación de notas, texto e imágenes después de cada uso.
preferences-reader-ebook-font = Fuente del libro electrónico:
preferences-reader-ebook-hyphenate =
    .label = Activar la separación silábica automática
preferences-note-title = Notas
preferences-note-open-in-new-window =
    .label = Abrir notas en ventanas nuevas en lugar de pestañas
preferences-color-scheme = Esquema de color:
preferences-color-scheme-auto =
    .label = Automático
preferences-color-scheme-light =
    .label = Claro
preferences-color-scheme-dark =
    .label = Oscuro
preferences-item-pane-header = Encabezamiento del panel de elementos:
preferences-item-pane-header-style = Estilo de citación del encabezamiento:
preferences-item-pane-header-locale = Idioma del encabezamiento:
preferences-item-pane-header-missing-style = Falta estilo: <{ $shortName }>
preferences-locate-library-lookup-intro = Library Lookup puede encontrar un recurso en línea utilizando la resolución OpenURL de su biblioteca.
preferences-locate-resolver = Sistema de resolución:
preferences-locate-base-url = URL base:
preferences-quickCopy-minus =
    .aria-label = { general-remove }
    .label = { $label }
preferences-quickCopy-plus =
    .aria-label = { general-add }
    .label = { $label }
preferences-styleManager-intro = { -app-name } puede generar citas y bibliografías en más de 10 000 estilos de citas. Añada estilos aquí para que estén disponibles al seleccionar estilos en { -app-name }.
preferences-styleManager-get-additional-styles =
    .label = Obtener estilos adicionales...
preferences-styleManager-restore-default =
    .label = Restaurar estilos predeterminados...
preferences-styleManager-add-from-file =
    .tooltiptext = Añadir un estilo desde un archivo
    .label = Añadir desde archivo...
preferences-styleManager-remove = Presione { delete-or-backspace } para eliminar este estilo.
preferences-citation-dialog = Diálogo de citas
preferences-citation-dialog-mode = Modo de diálogo de citas:
preferences-citation-dialog-mode-last-used =
    .label = Último uso
preferences-citation-dialog-mode-list =
    .label = Modo lista
preferences-citation-dialog-mode-library =
    .label = Modo biblioteca
preferences-advanced-enable-local-api =
    .label = Permitir que otras aplicaciones de este equipo se comuniquen con { -app-name }
preferences-advanced-local-api-available = Disponible en <code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = El servidor HTTP { -app-name } está desactivado.
preferences-advanced-server-enable-and-restart =
    .label = Habilitar y reiniciar
preferences-advanced-language-and-region-title = Idioma y región
preferences-advanced-enable-bidi-ui =
    .label = Habilitar utilidades bidireccionales de edición de texto
preferences-advanced-reset-data-dir =
    .label = Volver a la ubicación predeterminada…
preferences-advanced-custom-data-dir =
    .label = Usar ubicación personalizada…
preferences-advanced-default-data-dir =
    .value = (Predeterminado: { $directory })
    .aria-label = Ubicación predeterminada
-preferences-sync-data-syncing = Sincronizando datos
preferences-sync-data-syncing-groupbox =
    .aria-label = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-heading = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-description = Inicie sesión con su cuenta de { -app-name } para sincronizar sus datos entre dispositivos, colaborar con otras personas y mucho más.
preferences-account-log-out =
    .label = Cerrar sesión…
preferences-sync-reset-restore-to-server-body = { -app-name } reemplazará “{ $libraryName }” en { $domain } con datos de este equipo.
preferences-sync-reset-restore-to-server-deleted-items-text =
    { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] elemento
       *[other] elementos
    } en la biblioteca en línea se eliminará de forma permanente.
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] La biblioteca de este equipo y la biblioteca en línea estarán vacías.
        [one] 1 elemento permanecerá en este equipo y en la biblioteca en línea.
       *[other] { $localItemsCount } Los elementos permanecerán en este equipo y en la biblioteca en línea.
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
        [one] Eliminar 1 elemento
        [many] Eliminar { $remoteItemsDeletedCount } elementos
       *[other] Eliminar { $remoteItemsDeletedCount } elementos
    }
preferences-sync-reset-restore-to-server-confirmation-text = Eliminar biblioteca en línea
preferences-sync-reset-restore-to-server-yes = Reemplazar datos en la biblioteca en línea.
preferences-account-log-in =
    .label = Iniciar sesión
preferences-account-waiting-for-login =
    .value = Esperando a que se inicie sesión…
preferences-account-cancel-button =
    .label = { general-cancel }
preferences-account-logged-out-status =
    .value = (ha cerrado sesión)
preferences-account-email-label =
    .value = Correo electrónico:
preferences-account-switch-accounts =
    .label = Cambiar de cuenta…
preferences-account-switch-text = Si cambia a otra cuenta, se eliminarán todos los datos de { -app-name } de este equipo. Antes de continuar, asegúrese de que todos los datos y archivos que desea conservar se hayan sincronizado con la cuenta «{ $username }» o de que tenga una copia de seguridad del directorio de datos de { -app-name }.
preferences-account-switch-confirmation-text = borrar los datos locales
preferences-account-switch-accept = Borrar datos y reiniciar
