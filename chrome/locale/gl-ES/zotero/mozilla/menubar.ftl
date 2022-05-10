# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


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
menu-file-close =
    .label = Pechar
    .accesskey = c
menu-file-close-window =
    .label = Pechar xanela
    .accesskey = P
menu-file-save-page =
    .label = Gardar páxina como…
    .accesskey = G
menu-file-email-link =
    .label = Enviar a ligazón por correo…
    .accesskey = E
menu-file-print-setup =
    .label = Configuración da páxina…
    .accesskey = o
menu-file-print-preview =
    .label = Previsualización da impresión
    .accesskey = r
menu-file-print =
    .label = Imprimir…
    .accesskey = I
menu-file-go-offline =
    .label = Traballar sen conexión
    .accesskey = T

## Edit Menu

menu-edit =
    .label = Editar
    .accesskey = E
menu-edit-find-on =
    .label = Localizar nesta páxina…
    .accesskey = L
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
menu-view-customize-toolbar =
    .label = Personalizar…
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
menu-view-charset =
    .label = Codificación do texto
    .accesskey = C

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

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Marcadores
    .accesskey = M
menu-bookmarks-show-all =
    .label = Amosar todos os marcadores
menu-bookmark-this-page =
    .label = Marcar esta páxina
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
menu-tools-addons =
    .label = Complementos
    .accesskey = C
menu-tools-sync-now =
    .label = Sincronizar agora
    .accesskey = S
menu-tools-web-developer =
    .label = Web Developer
    .accesskey = W
menu-tools-page-source =
    .label = Código da páxina
    .accesskey = C
menu-tools-page-info =
    .label = Información da páxina
    .accesskey = n
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Opcións
           *[other] Preferencias
        }
    .accesskey =
        { PLATFORM() ->
            [windows] O
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

menu-help =
    .label = Axuda
    .accesskey = A
menu-help-product =
    .label = Axuda do { -brand-shorter-name }
    .accesskey = x
menu-help-show-tour =
    .label = Visita guiada por { -brand-shorter-name }
    .accesskey = V
menu-help-keyboard-shortcuts =
    .label = Atallos de teclado
    .accesskey = l
menu-help-troubleshooting-info =
    .label = Información para solucionar problemas
    .accesskey = b
menu-help-feedback-page =
    .label = Enviar opinión…
    .accesskey = o
menu-help-safe-mode-without-addons =
    .label = Reiniciar cos complementos desactivados…
    .accesskey = R
menu-help-safe-mode-with-addons =
    .label = Reiniciar cos complementos activados
    .accesskey = R
# Label of the Help menu item. Either this or
# safeb.palm.notdeceptive.label from
# phishing-afterload-warning-message.dtd is shown.
menu-help-report-deceptive-site =
    .label = Informar de sitio enganoso…
    .accesskey = d
menu-help-not-deceptive =
    .label = Non é un sitio enganoso…
    .accesskey = g
