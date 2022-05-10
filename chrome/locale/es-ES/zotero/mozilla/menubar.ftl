# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Archivo
    .accesskey = A
menu-file-new-tab =
    .label = Nueva pestaña
    .accesskey = T
menu-file-new-container-tab =
    .label = Nueva pestaña contenedora
    .accesskey = v
menu-file-new-window =
    .label = Nueva ventana
    .accesskey = N
menu-file-new-private-window =
    .label = Nueva ventana privada
    .accesskey = P
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Abrir dirección…
menu-file-open-file =
    .label = Abrir archivo…
    .accesskey = b
menu-file-close =
    .label = Cerrar
    .accesskey = C
menu-file-close-window =
    .label = Cerrar ventana
    .accesskey = v
menu-file-save-page =
    .label = Guardar como…
    .accesskey = A
menu-file-email-link =
    .label = Enviar enlace…
    .accesskey = E
menu-file-print-setup =
    .label = Configurar página…
    .accesskey = u
menu-file-print-preview =
    .label = Vista preliminar
    .accesskey = r
menu-file-print =
    .label = Imprimir…
    .accesskey = m
menu-file-import-from-another-browser =
    .label = Importar desde otro navegador…
    .accesskey = I
menu-file-go-offline =
    .label = Trabajar sin conexión
    .accesskey = x

## Edit Menu

menu-edit =
    .label = Editar
    .accesskey = E
menu-edit-find-on =
    .label = Buscar en esta página…
    .accesskey = B
menu-edit-find-again =
    .label = Repetir la búsqueda
    .accesskey = q
menu-edit-bidi-switch-text-direction =
    .label = Cambiar dirección del texto
    .accesskey = d

## View Menu

menu-view =
    .label = Ver
    .accesskey = V
menu-view-toolbars-menu =
    .label = Barras de herramientas
    .accesskey = T
menu-view-customize-toolbar =
    .label = Personalizar…
    .accesskey = P
menu-view-sidebar =
    .label = Panel lateral
    .accesskey = e
menu-view-bookmarks =
    .label = Marcadores
menu-view-history-button =
    .label = Historial
menu-view-synced-tabs-sidebar =
    .label = Pestañas sincronizadas
menu-view-full-zoom =
    .label = Tamaño
    .accesskey = m
menu-view-full-zoom-enlarge =
    .label = Aumentar
    .accesskey = A
menu-view-full-zoom-reduce =
    .label = Reducir
    .accesskey = d
menu-view-full-zoom-actual-size =
    .label = Tamaño real
    .accesskey = A
menu-view-full-zoom-toggle =
    .label = Sólo ampliar texto
    .accesskey = p
menu-view-page-style-menu =
    .label = Estilo de página
    .accesskey = g
menu-view-page-style-no-style =
    .label = Sin estilo
    .accesskey = n
menu-view-page-basic-style =
    .label = Estilo de página básico
    .accesskey = b
menu-view-charset =
    .label = Codif. de caracteres
    .accesskey = C

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Entrar a la pantalla completa
    .accesskey = P
menu-view-exit-full-screen =
    .label = Salir de la pantalla completa
    .accesskey = P
menu-view-full-screen =
    .label = Pantalla completa
    .accesskey = P

##

menu-view-show-all-tabs =
    .label = Mostrar todas las pestañas
    .accesskey = A
menu-view-bidi-switch-page-direction =
    .label = Cambiar dirección de la página
    .accesskey = D

## History Menu

menu-history =
    .label = Historial
    .accesskey = s
menu-history-show-all-history =
    .label = Mostrar todo el historial
menu-history-clear-recent-history =
    .label = Limpiar el historial reciente…
menu-history-synced-tabs =
    .label = Pestañas sincronizadas
menu-history-restore-last-session =
    .label = Restaurar sesión anterior
menu-history-hidden-tabs =
    .label = Pestañas ocultas
menu-history-undo-menu =
    .label = Pestañas cerradas recientemente
menu-history-undo-window-menu =
    .label = Ventanas cerradas recientemente

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Marcadores
    .accesskey = M
menu-bookmarks-show-all =
    .label = Mostrar todos los marcadores
menu-bookmark-this-page =
    .label = Añadir esta página a marcadores
menu-bookmark-edit =
    .label = Editar este marcador
menu-bookmarks-all-tabs =
    .label = Añadir pestañas a marcadores…
menu-bookmarks-toolbar =
    .label = Barra de herramientas de marcadores
menu-bookmarks-other =
    .label = Otros marcadores
menu-bookmarks-mobile =
    .label = Marcadores del móvil

## Tools Menu

menu-tools =
    .label = Herramientas
    .accesskey = T
menu-tools-downloads =
    .label = Descargas
    .accesskey = D
menu-tools-addons =
    .label = Complementos
    .accesskey = C
menu-tools-fxa-sign-in =
    .label = Iniciar sesión en { -brand-product-name }…
    .accesskey = I
menu-tools-turn-on-sync =
    .label = Activar { -sync-brand-short-name }...
    .accesskey = n
menu-tools-sync-now =
    .label = Sincronizar ahora
    .accesskey = z
menu-tools-fxa-re-auth =
    .label = Reconectar a { -brand-product-name }…
    .accesskey = R
menu-tools-web-developer =
    .label = Desarrollador web
    .accesskey = W
menu-tools-page-source =
    .label = Código fuente de la página
    .accesskey = f
menu-tools-page-info =
    .label = Información de la página
    .accesskey = I
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Opciones
           *[other] Preferencias
        }
    .accesskey =
        { PLATFORM() ->
            [windows] O
           *[other] n
        }
menu-tools-layout-debugger =
    .label = Depurador de representación
    .accesskey = D

## Window Menu

menu-window-menu =
    .label = Ventana
menu-window-bring-all-to-front =
    .label = Traer todo al frente

## Help Menu

menu-help =
    .label = Ayuda
    .accesskey = u
menu-help-product =
    .label = Ayuda de { -brand-shorter-name }
    .accesskey = u
menu-help-show-tour =
    .label = Paseo por { -brand-shorter-name }
    .accesskey = P
menu-help-import-from-another-browser =
    .label = Importar desde otro navegador…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Atajos de teclado
    .accesskey = t
menu-help-troubleshooting-info =
    .label = Información para solucionar problemas
    .accesskey = f
menu-help-feedback-page =
    .label = Enviar opinión…
    .accesskey = v
menu-help-safe-mode-without-addons =
    .label = Reiniciar con los complementos desactivados…
    .accesskey = R
menu-help-safe-mode-with-addons =
    .label = Reiniciar con los complementos activados
    .accesskey = R
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Informar de sitio engañoso…
    .accesskey = I
menu-help-not-deceptive =
    .label = Este no es un sitio engañoso…
    .accesskey = E
