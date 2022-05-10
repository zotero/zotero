# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Fitxer
    .accesskey = F
menu-file-new-tab =
    .label = Pestanya nova
    .accesskey = t
menu-file-new-container-tab =
    .label = Pestanya de contenidor nova
    .accesskey = v
menu-file-new-window =
    .label = Finestra nova
    .accesskey = n
menu-file-new-private-window =
    .label = Finestra privada nova
    .accesskey = i
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Obre la ubicació…
menu-file-open-file =
    .label = Obre un fitxer…
    .accesskey = O
menu-file-close =
    .label = Tanca
    .accesskey = c
menu-file-close-window =
    .label = Tanca la finestra
    .accesskey = f
menu-file-save-page =
    .label = Anomena i desa la pàgina…
    .accesskey = s
menu-file-email-link =
    .label = Envia l'enllaç per correu…
    .accesskey = E
menu-file-print-setup =
    .label = Configuració de la pàgina…
    .accesskey = g
menu-file-print-preview =
    .label = Exemple d'impressió
    .accesskey = l
menu-file-print =
    .label = Imprimeix…
    .accesskey = p
menu-file-import-from-another-browser =
    .label = Importa d'un altre navegador…
    .accesskey = I
menu-file-go-offline =
    .label = Treballa fora de línia
    .accesskey = b

## Edit Menu

menu-edit =
    .label = Edita
    .accesskey = E
menu-edit-find-on =
    .label = Cerca en aquesta pàgina…
    .accesskey = r
menu-edit-find-again =
    .label = Torna a cercar
    .accesskey = o
menu-edit-bidi-switch-text-direction =
    .label = Canvia la direcció del text
    .accesskey = v

## View Menu

menu-view =
    .label = Visualitza
    .accesskey = V
menu-view-toolbars-menu =
    .label = Barres d'eines
    .accesskey = a
menu-view-customize-toolbar =
    .label = Personalitza…
    .accesskey = P
menu-view-sidebar =
    .label = Barra lateral
    .accesskey = e
menu-view-bookmarks =
    .label = Adreces d'interès
menu-view-history-button =
    .label = Historial
menu-view-synced-tabs-sidebar =
    .label = Pestanyes sincronitzades
menu-view-full-zoom =
    .label = Mida de la pàgina
    .accesskey = d
menu-view-full-zoom-enlarge =
    .label = Amplia
    .accesskey = A
menu-view-full-zoom-reduce =
    .label = Redueix
    .accesskey = d
menu-view-full-zoom-actual-size =
    .label = Mida Real
    .accesskey = M
menu-view-full-zoom-toggle =
    .label = Amplia només el text
    .accesskey = t
menu-view-page-style-menu =
    .label = Estil de pàgina
    .accesskey = i
menu-view-page-style-no-style =
    .label = Sense estil
    .accesskey = n
menu-view-page-basic-style =
    .label = Estil de pàgina bàsic
    .accesskey = b
menu-view-charset =
    .label = Codificació del text
    .accesskey = C

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Obre a pantalla completa
    .accesskey = p
menu-view-exit-full-screen =
    .label = Surt de la pantalla completa
    .accesskey = p
menu-view-full-screen =
    .label = Pantalla completa
    .accesskey = P

##

menu-view-show-all-tabs =
    .label = Mostra totes les pestanyes
    .accesskey = a
menu-view-bidi-switch-page-direction =
    .label = Canvia la direcció de la pàgina
    .accesskey = g

## History Menu

menu-history =
    .label = Historial
    .accesskey = s
menu-history-show-all-history =
    .label = Mostra tot l'historial
menu-history-clear-recent-history =
    .label = Neteja l'historial recent…
menu-history-synced-tabs =
    .label = Pestanyes sincronitzades
menu-history-restore-last-session =
    .label = Restaura la sessió anterior
menu-history-hidden-tabs =
    .label = Pestanyes ocultes
menu-history-undo-menu =
    .label = Pestanyes tancades recentment
menu-history-undo-window-menu =
    .label = Finestres tancades recentment

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Adreces d'interès
    .accesskey = r
menu-bookmarks-show-all =
    .label = Mostra totes les adreces d'interès
menu-bookmark-this-page =
    .label = Afegeix la pàgina a les adreces d'interès
menu-bookmark-edit =
    .label = Edita aquesta adreça d'interès
menu-bookmarks-all-tabs =
    .label = Afegeix-hi totes les pestanyes…
menu-bookmarks-toolbar =
    .label = Barra de les adreces d'interès
menu-bookmarks-other =
    .label = Altres adreces d'interès
menu-bookmarks-mobile =
    .label = Adreces del mòbil

## Tools Menu

menu-tools =
    .label = Eines
    .accesskey = n
menu-tools-downloads =
    .label = Baixades
    .accesskey = d
menu-tools-addons =
    .label = Complements
    .accesskey = m
menu-tools-fxa-sign-in =
    .label = Inicia la sessió al { -brand-product-name }…
    .accesskey = F
menu-tools-turn-on-sync =
    .label = Activa el { -sync-brand-short-name }…
    .accesskey = n
menu-tools-sync-now =
    .label = Sincronitza ara
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Torna a connectar al { -brand-product-name }…
    .accesskey = T
menu-tools-web-developer =
    .label = Desenvolupador web
    .accesskey = w
menu-tools-page-source =
    .label = Codi font de la pàgina
    .accesskey = o
menu-tools-page-info =
    .label = Informació de la pàgina
    .accesskey = I
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Opcions
           *[other] Preferències
        }
    .accesskey =
        { PLATFORM() ->
            [windows] O
           *[other] n
        }
menu-tools-layout-debugger =
    .label = Depurador de disposició
    .accesskey = D

## Window Menu

menu-window-menu =
    .label = Finestra
menu-window-bring-all-to-front =
    .label = Porta-ho tot a davant

## Help Menu

menu-help =
    .label = Ajuda
    .accesskey = j
menu-help-product =
    .label = Ajuda del { -brand-shorter-name }
    .accesskey = j
menu-help-show-tour =
    .label = Visita guiada del { -brand-shorter-name }
    .accesskey = V
menu-help-import-from-another-browser =
    .label = Importa d'un altre navegador…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Dreceres de teclat
    .accesskey = D
menu-help-troubleshooting-info =
    .label = Informació de resolució de problemes
    .accesskey = r
menu-help-feedback-page =
    .label = Envia comentaris…
    .accesskey = E
menu-help-safe-mode-without-addons =
    .label = Reinicia amb els complements inhabilitats…
    .accesskey = R
menu-help-safe-mode-with-addons =
    .label = Reinicia amb els complements habilitats
    .accesskey = R
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Informa que el lloc és enganyós…
    .accesskey = I
menu-help-not-deceptive =
    .label = No és cap lloc enganyós…
    .accesskey = N
