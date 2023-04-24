# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Preferências
menu-application-services =
    .label = Serviços
menu-application-hide-this =
    .label = Ocultar o { -brand-shorter-name }
menu-application-hide-other =
    .label = Ocultar outras aplicações
menu-application-show-all =
    .label = Mostrar tudo
menu-application-touch-bar =
    .label = Personalizar barra de toque…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Sair
           *[other] Sair
        }
    .accesskey =
        { PLATFORM() ->
            [windows] r
           *[other] r
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Sair do { -brand-shorter-name }
menu-about =
    .label = Acerca do { -brand-shorter-name }
    .accesskey = A

## File Menu

menu-file =
    .label = Ficheiro
    .accesskey = F
menu-file-new-tab =
    .label = Novo separador
    .accesskey = s
menu-file-new-container-tab =
    .label = Novo separador contentor
    .accesskey = c
menu-file-new-window =
    .label = Nova janela
    .accesskey = N
menu-file-new-private-window =
    .label = Nova janela privada
    .accesskey = j
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Abrir localização…
menu-file-open-file =
    .label = Abrir ficheiro…
    .accesskey = o
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Fechar separador
           *[other] Fechar { $tabCount } separadores
        }
    .accesskey = c
menu-file-close-window =
    .label = Fechar janela
    .accesskey = j
menu-file-save-page =
    .label = Guardar página como…
    .accesskey = a
menu-file-email-link =
    .label = Enviar ligação por email…
    .accesskey = E
menu-file-share-url =
    .label = Partilhar
    .accesskey = h
menu-file-print-setup =
    .label = Configurar página…
    .accesskey = C
menu-file-print =
    .label = Imprimir…
    .accesskey = p
menu-file-import-from-another-browser =
    .label = Importar de outro navegador…
    .accesskey = I
menu-file-go-offline =
    .label = Trabalhar offline
    .accesskey = o

## Edit Menu

menu-edit =
    .label = Editar
    .accesskey = E
menu-edit-find-in-page =
    .label = Localizar na página…
    .accesskey = L
menu-edit-find-again =
    .label = Localizar novamente
    .accesskey = g
menu-edit-bidi-switch-text-direction =
    .label = Mudar direção do texto
    .accesskey = x

## View Menu

menu-view =
    .label = Ver
    .accesskey = V
menu-view-toolbars-menu =
    .label = Barras de ferramentas
    .accesskey = t
menu-view-customize-toolbar2 =
    .label = Personalizar barra de ferramentas…
    .accesskey = f
menu-view-sidebar =
    .label = Barra lateral
    .accesskey = l
menu-view-bookmarks =
    .label = Marcadores
menu-view-history-button =
    .label = Histórico
menu-view-synced-tabs-sidebar =
    .label = Separadores sincronizados
menu-view-full-zoom =
    .label = Zoom
    .accesskey = Z
menu-view-full-zoom-enlarge =
    .label = Ampliar
    .accesskey = i
menu-view-full-zoom-reduce =
    .label = Reduzir
    .accesskey = d
menu-view-full-zoom-actual-size =
    .label = Tamanho atual
    .accesskey = a
menu-view-full-zoom-toggle =
    .label = Aplicar zoom apenas em texto
    .accesskey = t
menu-view-page-style-menu =
    .label = Estilo de página
    .accesskey = s
menu-view-page-style-no-style =
    .label = Sem estilo
    .accesskey = m
menu-view-page-basic-style =
    .label = Estilo de página básico
    .accesskey = b
menu-view-repair-text-encoding =
    .label = Corrigir a codificação de texto
    .accesskey = C

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Entrar em ecrã completo
    .accesskey = e
menu-view-exit-full-screen =
    .label = Sair de ecrã completo
    .accesskey = e
menu-view-full-screen =
    .label = Ecrã completo
    .accesskey = E

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Entrar na vista de leitura
    .accesskey = l
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Fechar vista de leitura
    .accesskey = l

##

menu-view-show-all-tabs =
    .label = Mostrar todos os separadores
    .accesskey = t
menu-view-bidi-switch-page-direction =
    .label = Mudar direção da página
    .accesskey = g

## History Menu

menu-history =
    .label = Histórico
    .accesskey = i
menu-history-show-all-history =
    .label = Mostrar todo o histórico
menu-history-clear-recent-history =
    .label = Limpar histórico recente…
menu-history-synced-tabs =
    .label = Separadores sincronizados
menu-history-restore-last-session =
    .label = Restaurar sessão anterior
menu-history-hidden-tabs =
    .label = Separadores ocultados
menu-history-undo-menu =
    .label = Separadores fechados recentemente
menu-history-undo-window-menu =
    .label = Janelas fechadas recentemente
menu-history-reopen-all-tabs = Reabrir todos os separadores
menu-history-reopen-all-windows = Reabrir todas as janelas

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Marcadores
    .accesskey = M
menu-bookmarks-manage =
    .label = Gerir marcadores
menu-bookmark-current-tab =
    .label = Adicionar separador aos marcadores
menu-bookmark-edit =
    .label = Editar este marcador
menu-bookmark-tab =
    .label = Adicionar separador atual aos marcadores…
menu-edit-bookmark =
    .label = Editar este marcador…
menu-bookmarks-all-tabs =
    .label = Adicionar todos os separadores aos marcadores…
menu-bookmarks-toolbar =
    .label = Barra de ferramentas de marcadores
menu-bookmarks-other =
    .label = Outros marcadores
menu-bookmarks-mobile =
    .label = Marcadores de dispositivo móvel

## Tools Menu

menu-tools =
    .label = Ferramentas
    .accesskey = t
menu-tools-downloads =
    .label = Transferências
    .accesskey = T
menu-tools-addons-and-themes =
    .label = Extras e temas
    .accesskey = x
menu-tools-fxa-sign-in2 =
    .label = Iniciar sessão
    .accesskey = c
menu-tools-turn-on-sync2 =
    .label = Ativar a sincronização…
    .accesskey = v
menu-tools-sync-now =
    .label = Sincronizar agora
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Restabelecer ligação ao { -brand-product-name }…
    .accesskey = R
menu-tools-browser-tools =
    .label = Ferramentas do navegador
    .accesskey = g
menu-tools-task-manager =
    .label = Gestor de tarefas
    .accesskey = f
menu-tools-page-source =
    .label = Fonte da página
    .accesskey = o
menu-tools-page-info =
    .label = Informação da página
    .accesskey = I
menu-settings =
    .label = Definições
    .accesskey =
        { PLATFORM() ->
            [windows] n
           *[other] n
        }
menu-tools-layout-debugger =
    .label = Depurador de layout
    .accesskey = l

## Window Menu

menu-window-menu =
    .label = Janela
menu-window-bring-all-to-front =
    .label = Trazer tudo para a frente

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Ajuda
    .accesskey = u
menu-get-help =
    .label = Obter ajuda
    .accesskey = j
menu-help-more-troubleshooting-info =
    .label = Mais informação para diagnóstico
    .accesskey = g
menu-help-report-site-issue =
    .label = Reportar problema no site…
menu-help-share-ideas =
    .label = Partilhe ideias e comentários…
    .accesskey = h
menu-help-enter-troubleshoot-mode2 =
    .label = Modo de diagnóstico…
    .accesskey = M
menu-help-exit-troubleshoot-mode =
    .label = Desligar o modo de diagnóstico
    .accesskey = m
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Reportar site decetivo…
    .accesskey = d
menu-help-not-deceptive =
    .label = Este não é um site decetivo…
    .accesskey = d
