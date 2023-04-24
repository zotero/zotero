# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Preferencias
menu-application-services =
    .label = Servicios
menu-application-hide-this =
    .label = Ocultar { -brand-shorter-name }
menu-application-hide-other =
    .label = Ocultar otros
menu-application-show-all =
    .label = Mostrar todo
menu-application-touch-bar =
    .label = Personalizar la barra táctil…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Salir
           *[other] Salir
        }
    .accesskey =
        { PLATFORM() ->
            [windows] S
           *[other] S
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Salir de { -brand-shorter-name }
menu-about =
    .label = Acerca de { -brand-shorter-name }
    .accesskey = A

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
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Cerrar pestaña
            [one] Cerrar { $tabCount } pestaña
           *[other] Cerrar { $tabCount } pestañas
        }
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
menu-file-share-url =
    .label = Compartir
    .accesskey = C
menu-file-print-setup =
    .label = Configurar página…
    .accesskey = u
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
menu-edit-find-in-page =
    .label = Buscar en la página…
    .accesskey = F
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
menu-view-customize-toolbar2 =
    .label = Personalizar la barra de herramientas…
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
menu-view-repair-text-encoding =
    .label = Reparar la codificación de texto
    .accesskey = c

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

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Abrir vista de lectura
    .accesskey = v
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Cerrar vista de lectura
    .accesskey = R

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
menu-history-reopen-all-tabs = Reabrir todas las pestañas
menu-history-reopen-all-windows = Reabrir todas las ventanas

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Marcadores
    .accesskey = M
menu-bookmarks-manage =
    .label = Administrar marcadores
menu-bookmark-current-tab =
    .label = Añadir pestaña actual a marcadores
menu-bookmark-edit =
    .label = Editar este marcador
menu-bookmark-tab =
    .label = Añadir pestaña actual a marcadores…
menu-edit-bookmark =
    .label = Editar este marcador…
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
menu-tools-addons-and-themes =
    .label = Complementos y temas
    .accesskey = C
menu-tools-fxa-sign-in2 =
    .label = Iniciar sesión
    .accesskey = i
menu-tools-turn-on-sync2 =
    .label = Activar la sincronización…
    .accesskey = n
menu-tools-sync-now =
    .label = Sincronizar ahora
    .accesskey = z
menu-tools-fxa-re-auth =
    .label = Reconectar a { -brand-product-name }…
    .accesskey = R
menu-tools-browser-tools =
    .label = Herramientas del navegador
    .accesskey = H
menu-tools-task-manager =
    .label = Administrador de tareas
    .accesskey = m
menu-tools-page-source =
    .label = Código fuente de la página
    .accesskey = f
menu-tools-page-info =
    .label = Información de la página
    .accesskey = I
menu-settings =
    .label = Ajustes
    .accesskey =
        { PLATFORM() ->
            [windows] S
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


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Ayuda
    .accesskey = u
menu-get-help =
    .label = Obtener ayuda
    .accesskey = O
menu-help-more-troubleshooting-info =
    .label = Más información para solucionar problemas
    .accesskey = T
menu-help-report-site-issue =
    .label = Informar de problema en sitio…
menu-help-share-ideas =
    .label = Compartir ideas y opiniones…
    .accesskey = s
menu-help-enter-troubleshoot-mode2 =
    .label = Modo de resolución de problemas…
    .accesskey = M
menu-help-exit-troubleshoot-mode =
    .label = Desactivar modo de resolución de problemas
    .accesskey = M
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Informar de sitio engañoso…
    .accesskey = I
menu-help-not-deceptive =
    .label = Este no es un sitio engañoso…
    .accesskey = E
