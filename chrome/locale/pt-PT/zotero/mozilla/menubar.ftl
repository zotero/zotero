# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


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
menu-file-close =
    .label = Fechar
    .accesskey = F
menu-file-close-window =
    .label = Fechar janela
    .accesskey = j
menu-file-save-page =
    .label = Guardar página como…
    .accesskey = a
menu-file-email-link =
    .label = Enviar ligação por email…
    .accesskey = E
menu-file-print-setup =
    .label = Configurar página…
    .accesskey = C
menu-file-print-preview =
    .label = Pré-visualizar impressão
    .accesskey = v
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
menu-edit-find-on =
    .label = Localizar nesta página…
    .accesskey = E
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
menu-view-customize-toolbar =
    .label = Personalizar…
    .accesskey = P
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
menu-view-charset =
    .label = Codificação de texto
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

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Marcadores
    .accesskey = M
menu-bookmarks-show-all =
    .label = Mostrar todos os marcadores
menu-bookmark-this-page =
    .label = Adicionar esta página aos marcadores
menu-bookmark-edit =
    .label = Editar este marcador
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
menu-tools-addons =
    .label = Extras
    .accesskey = E
menu-tools-fxa-sign-in =
    .label = Iniciar sessão no { -brand-product-name }…
    .accesskey = I
menu-tools-turn-on-sync =
    .label = Ligar { -sync-brand-short-name }…
    .accesskey = L
menu-tools-sync-now =
    .label = Sincronizar agora
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Restabelecer ligação ao { -brand-product-name }…
    .accesskey = R
menu-tools-web-developer =
    .label = Ferramentas de programação
    .accesskey = g
menu-tools-page-source =
    .label = Fonte da página
    .accesskey = o
menu-tools-page-info =
    .label = Informação da página
    .accesskey = I
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Opções
           *[other] Preferências
        }
    .accesskey =
        { PLATFORM() ->
            [windows] O
           *[other] f
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

menu-help =
    .label = Ajuda
    .accesskey = u
menu-help-product =
    .label = Ajuda do { -brand-shorter-name }
    .accesskey = u
menu-help-show-tour =
    .label = Visita ao { -brand-shorter-name }
    .accesskey = o
menu-help-import-from-another-browser =
    .label = Importar de outro navegador…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Atalhos de teclado
    .accesskey = h
menu-help-troubleshooting-info =
    .label = Informação para resolução de problemas
    .accesskey = r
menu-help-feedback-page =
    .label = Submeter feedback…
    .accesskey = S
menu-help-safe-mode-without-addons =
    .label = Reiniciar com os extras desativados…
    .accesskey = R
menu-help-safe-mode-with-addons =
    .label = Reiniciar com os extras ativados
    .accesskey = R
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Reportar site decetivo…
    .accesskey = d
menu-help-not-deceptive =
    .label = Este não é um site decetivo…
    .accesskey = d
