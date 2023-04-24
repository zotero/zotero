# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Preferències
menu-application-services =
    .label = Serveis
menu-application-hide-this =
    .label = Amaga el { -brand-shorter-name }
menu-application-hide-other =
    .label = Amaga altres
menu-application-show-all =
    .label = Mostra-ho tot
menu-application-touch-bar =
    .label = Personalitza la Touch Bar…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Surt
           *[other] Surt
        }
    .accesskey =
        { PLATFORM() ->
            [windows] u
           *[other] u
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Surt del { -brand-shorter-name }
menu-about =
    .label = Quant al { -brand-shorter-name }
    .accesskey = Q

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
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Tanca les { $tabCount } pestanyes
            [one] Tanca la pestanya
           *[other] Tanca les { $tabCount } pestanyes
        }
    .accesskey = p
menu-file-close-window =
    .label = Tanca la finestra
    .accesskey = f
menu-file-save-page =
    .label = Anomena i desa la pàgina…
    .accesskey = s
menu-file-email-link =
    .label = Envia l'enllaç per correu…
    .accesskey = E
menu-file-share-url =
    .label = Comparteix
    .accesskey = C
menu-file-print-setup =
    .label = Configuració de la pàgina…
    .accesskey = g
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
menu-edit-find-in-page =
    .label = Cerca a la pàgina…
    .accesskey = C
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
menu-view-customize-toolbar2 =
    .label = Personalitza la barra d'eines…
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
menu-view-repair-text-encoding =
    .label = Repara la codificació del text
    .accesskey = c

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

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Entra a la vista de lectura
    .accesskey = l
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Tanca la vista de lectura
    .accesskey = l

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
menu-history-reopen-all-tabs = Torna a obrir totes les pestanyes
menu-history-reopen-all-windows = Torna a obrir totes les finestres

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Adreces d'interès
    .accesskey = r
menu-bookmarks-manage =
    .label = Gestiona les adreces d'interès
menu-bookmark-current-tab =
    .label = Afegeix la pestanya actual a les adreces d'interès
menu-bookmark-edit =
    .label = Edita aquesta adreça d'interès
menu-bookmark-tab =
    .label = Afegeix la pestanya actual a les adreces d'interès…
menu-edit-bookmark =
    .label = Edita aquesta adreça d'interès…
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
menu-tools-addons-and-themes =
    .label = Complements i temes
    .accesskey = C
menu-tools-fxa-sign-in2 =
    .label = Inicia la sessió
    .accesskey = I
menu-tools-turn-on-sync2 =
    .label = Activa la sincronització…
    .accesskey = s
menu-tools-sync-now =
    .label = Sincronitza ara
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Torna a connectar al { -brand-product-name }…
    .accesskey = T
menu-tools-browser-tools =
    .label = Eines del navegador
    .accesskey = E
menu-tools-task-manager =
    .label = Gestor de tasques
    .accesskey = G
menu-tools-page-source =
    .label = Codi font de la pàgina
    .accesskey = o
menu-tools-page-info =
    .label = Informació de la pàgina
    .accesskey = I
menu-settings =
    .label = Paràmetres
    .accesskey =
        { PLATFORM() ->
            [windows] P
           *[other] m
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


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Ajuda
    .accesskey = A
menu-get-help =
    .label = Obteniu ajuda
    .accesskey = j
menu-help-more-troubleshooting-info =
    .label = Més informació de resolució de problemes
    .accesskey = i
menu-help-report-site-issue =
    .label = Informa d'un problema amb el lloc…
menu-help-share-ideas =
    .label = Compartiu idees i comentaris…
    .accesskey = s
menu-help-enter-troubleshoot-mode2 =
    .label = Mode de resolució de problemes…
    .accesskey = M
menu-help-exit-troubleshoot-mode =
    .label = Desactiva el mode de resolució de problemes
    .accesskey = m
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Informa que el lloc és enganyós…
    .accesskey = I
menu-help-not-deceptive =
    .label = No és cap lloc enganyós…
    .accesskey = N
