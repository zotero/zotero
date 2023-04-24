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
    .label = Servizos
menu-application-hide-this =
    .label = Agochar { -brand-shorter-name }
menu-application-hide-other =
    .label = Agochar outros
menu-application-show-all =
    .label = Amosar todo
menu-application-touch-bar =
    .label = Personalizar a barra táctil…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Saír
           *[other] Saír
        }
    .accesskey =
        { PLATFORM() ->
            [windows] S
           *[other] S
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Saír do { -brand-shorter-name }
menu-about =
    .label = Sobre o { -brand-shorter-name }
    .accesskey = S

## File Menu

menu-file =
    .label = Ficheiro
    .accesskey = F
menu-file-new-tab =
    .label = Nova lapela
    .accesskey = v
menu-file-new-container-tab =
    .label = Nova lapela contedor
    .accesskey = l
menu-file-new-window =
    .label = Nova xanela
    .accesskey = N
menu-file-new-private-window =
    .label = Nova xanela privada
    .accesskey = x
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Abrir localización…
menu-file-open-file =
    .label = Abrir ficheiro…
    .accesskey = A
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Pechar lapela
            [one] Pechar { $tabCount } lapela
           *[other] Pechar { $tabCount } lapelas
        }
    .accesskey = P
menu-file-close-window =
    .label = Pechar xanela
    .accesskey = P
menu-file-save-page =
    .label = Gardar páxina como…
    .accesskey = G
menu-file-email-link =
    .label = Enviar a ligazón por correo…
    .accesskey = E
menu-file-share-url =
    .label = Compartir
    .accesskey = C
menu-file-print-setup =
    .label = Configuración da páxina…
    .accesskey = o
menu-file-print =
    .label = Imprimir…
    .accesskey = I
menu-file-import-from-another-browser =
    .label = Importar doutro navegador…
    .accesskey = I
menu-file-go-offline =
    .label = Traballar sen conexión
    .accesskey = T

## Edit Menu

menu-edit =
    .label = Editar
    .accesskey = E
menu-edit-find-in-page =
    .label = Atopar na páxina…
    .accesskey = A
menu-edit-find-again =
    .label = Localizar de novo
    .accesskey = n
menu-edit-bidi-switch-text-direction =
    .label = Cambiar a orientación do texto
    .accesskey = b

## View Menu

menu-view =
    .label = Ver
    .accesskey = V
menu-view-toolbars-menu =
    .label = Barras de ferramentas
    .accesskey = f
menu-view-customize-toolbar2 =
    .label = Personalizar barra de ferramentas…
    .accesskey = P
menu-view-sidebar =
    .label = Barra lateral
    .accesskey = B
menu-view-bookmarks =
    .label = Marcadores
menu-view-history-button =
    .label = Historial
menu-view-synced-tabs-sidebar =
    .label = Lapelas sincronizadas
menu-view-full-zoom =
    .label = Zoom
    .accesskey = z
menu-view-full-zoom-enlarge =
    .label = Ampliar
    .accesskey = A
menu-view-full-zoom-reduce =
    .label = Reducir
    .accesskey = e
menu-view-full-zoom-actual-size =
    .label = Tamaño real
    .accesskey = A
menu-view-full-zoom-toggle =
    .label = Ampliar só o texto
    .accesskey = t
menu-view-page-style-menu =
    .label = Estilo de páxina
    .accesskey = E
menu-view-page-style-no-style =
    .label = Sen estilo
    .accesskey = S
menu-view-page-basic-style =
    .label = Estilo de páxina básico
    .accesskey = b
menu-view-repair-text-encoding =
    .label = Reparar codificación do texto
    .accesskey = R

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Pasar a pantalla completa
    .accesskey = a
menu-view-exit-full-screen =
    .label = Saír de pantalla completa
    .accesskey = a
menu-view-full-screen =
    .label = Pantalla completa
    .accesskey = a

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Activar a vista de lectura
    .accesskey = r
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Pechar a vista de lectura
    .accesskey = r

##

menu-view-show-all-tabs =
    .label = Amosar todas as lapelas
    .accesskey = a
menu-view-bidi-switch-page-direction =
    .label = Cambiar a orientación da páxina
    .accesskey = x

## History Menu

menu-history =
    .label = Historial
    .accesskey = H
menu-history-show-all-history =
    .label = Amosar todo o historial
menu-history-clear-recent-history =
    .label = Borrar historial recente…
menu-history-synced-tabs =
    .label = Lapelas sincronizadas
menu-history-restore-last-session =
    .label = Restaurar a sesión anterior
menu-history-hidden-tabs =
    .label = Lapelas agochadas
menu-history-undo-menu =
    .label = Lapelas pechadas recentemente
menu-history-undo-window-menu =
    .label = Xanelas pechadas recentemente
menu-history-reopen-all-tabs = Reabrir todas as lapelas
menu-history-reopen-all-windows = Reabrir todas as xanelas

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Marcadores
    .accesskey = M
menu-bookmarks-manage =
    .label = Xestionar marcadores
menu-bookmark-current-tab =
    .label = Marcar lapela actual
menu-bookmark-edit =
    .label = Editar este marcador
menu-bookmarks-all-tabs =
    .label = Marcar todas as lapelas…
menu-bookmarks-toolbar =
    .label = Barra de marcadores
menu-bookmarks-other =
    .label = Outros marcadores
menu-bookmarks-mobile =
    .label = Marcadores do móbil

## Tools Menu

menu-tools =
    .label = Ferramentas
    .accesskey = t
menu-tools-downloads =
    .label = Descargas
    .accesskey = D
menu-tools-addons-and-themes =
    .label = Complementos e temas
    .accesskey = C
menu-tools-fxa-sign-in2 =
    .label = Identificarse
    .accesskey = I
menu-tools-turn-on-sync2 =
    .label = Activar a sincronización ...
    .accesskey = n
menu-tools-sync-now =
    .label = Sincronizar agora
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Conectarse de novo a { -brand-product-name } ...
    .accesskey = R
menu-tools-browser-tools =
    .label = Ferramentas do navegador
    .accesskey = F
menu-tools-task-manager =
    .label = Xestor de tarefas
    .accesskey = X
menu-tools-page-source =
    .label = Código da páxina
    .accesskey = C
menu-tools-page-info =
    .label = Información da páxina
    .accesskey = n
menu-settings =
    .label = Configuración
    .accesskey =
        { PLATFORM() ->
            [windows] S
           *[other] n
        }
menu-tools-layout-debugger =
    .label = Depurador de deseño
    .accesskey = p

## Window Menu

menu-window-menu =
    .label = Xanela
menu-window-bring-all-to-front =
    .label = Traer todo á fronte

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Axuda
    .accesskey = A
menu-get-help =
    .label = Obter axuda
    .accesskey = a
menu-help-more-troubleshooting-info =
    .label = Máis información para solucionar problemas
    .accesskey = P
menu-help-report-site-issue =
    .label = Informar dunha incidencia no sitio…
menu-help-enter-troubleshoot-mode2 =
    .label = Modo de resolución de problemas…
    .accesskey = r
menu-help-exit-troubleshoot-mode =
    .label = Desactivar o modo de resolución de problemas
    .accesskey = M
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Informar de sitio enganoso…
    .accesskey = d
menu-help-not-deceptive =
    .label = Non é un sitio enganoso…
    .accesskey = g
