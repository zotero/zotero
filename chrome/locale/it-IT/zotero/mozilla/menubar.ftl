# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Preferenze
menu-application-services =
    .label = Servizi
menu-application-hide-this =
    .label = Nascondi { -brand-shorter-name }
menu-application-hide-other =
    .label = Nascondi altre
menu-application-show-all =
    .label = Mostra tutte
menu-application-touch-bar =
    .label = Personalizza Touch Bar…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label = Esci
    .accesskey = E

# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Esci da { -brand-shorter-name }

# This menu-quit-button string is only used on Linux.
menu-quit-button =
    .label = { menu-quit.label }

# This menu-quit-button-win string is only used on Windows.
menu-quit-button-win =
    .label = { menu-quit.label }
    .tooltip = Chiudi { -brand-shorter-name }

menu-about =
    .label = Informazioni su { -brand-shorter-name }
    .accesskey = I

## File Menu

menu-file =
    .label = File
    .accesskey = F
menu-file-new-tab =
    .label = Nuova scheda
    .accesskey = h
menu-file-new-container-tab =
    .label = Nuova scheda contenitore
    .accesskey = c
menu-file-new-window =
    .label = Nuova finestra
    .accesskey = f
menu-file-new-private-window =
    .label = Nuova finestra anonima
    .accesskey = u
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Apri indirizzo…
menu-file-open-file =
    .label = Apri file…
    .accesskey = A
menu-file-close =
    .label = Chiudi
    .accesskey = C
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Chiudi scheda
           *[other] Chiudi { $tabCount } schede
        }
    .accesskey = C
menu-file-close-window =
    .label = Chiudi finestra
    .accesskey = d
menu-file-save-page =
    .label = Salva pagina con nome…
    .accesskey = v
menu-file-email-link =
    .label = Invia link per email…
    .accesskey = I
menu-file-share-url =
    .label = Condividi
    .accesskey = d
menu-file-print-setup =
    .label = Imposta pagina…
    .accesskey = t
menu-file-print-preview =
    .label = Anteprima di stampa
    .accesskey = p
menu-file-print =
    .label = Stampa…
    .accesskey = m
menu-file-import-from-another-browser =
    .label = Importa da un altro browser…
    .accesskey = b
menu-file-go-offline =
    .label = Lavora non in linea
    .accesskey = L

## Edit Menu

menu-edit =
    .label = Modifica
    .accesskey = M
menu-edit-find-in-page =
    .label = Trova nella pagina…
    .accesskey = v
menu-edit-find-again =
    .label = Trova successivo
    .accesskey = u
menu-edit-bidi-switch-text-direction =
    .label = Cambia direzione testo
    .accesskey = d

## View Menu

menu-view =
    .label = Visualizza
    .accesskey = V
menu-view-toolbars-menu =
    .label = Barre degli strumenti
    .accesskey = B
menu-view-customize-toolbar2 =
    .label = Personalizza barra degli strumenti…
    .accesskey = P
menu-view-sidebar =
    .label = Barra laterale
    .accesskey = e
menu-view-bookmarks =
    .label = Segnalibri
menu-view-history-button =
    .label = Cronologia
menu-view-synced-tabs-sidebar =
    .label = Schede sincronizzate
menu-view-full-zoom =
    .label = Zoom
    .accesskey = Z
menu-view-full-zoom-enlarge =
    .label = Aumenta zoom
    .accesskey = u
menu-view-full-zoom-reduce =
    .label = Riduci zoom
    .accesskey = z
menu-view-full-zoom-actual-size =
    .label = Dimensioni effettive
    .accesskey = D
menu-view-full-zoom-toggle =
    .label = Ingrandisci solo il testo
    .accesskey = t
menu-view-page-style-menu =
    .label = Stile pagina
    .accesskey = a
menu-view-page-style-no-style =
    .label = Nessuno stile
    .accesskey = N
menu-view-page-basic-style =
    .label = Stile pagina di base
    .accesskey = S

menu-view-repair-text-encoding =
    .label = Correggi codifica testo
    .accesskey = C

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Passa a schermo intero
    .accesskey = h
menu-view-exit-full-screen =
    .label = Esci da schermo intero
    .accesskey = h
menu-view-full-screen =
    .label = Schermo intero
    .accesskey = S

##

menu-view-show-all-tabs =
    .label = Visualizza tutte le schede
    .accesskey = h
menu-view-bidi-switch-page-direction =
    .label = Cambia orientamento pagina
    .accesskey = g

## History Menu

menu-history =
    .label = Cronologia
    .accesskey = C
menu-history-show-all-history =
    .label = Visualizza la cronologia
menu-history-clear-recent-history =
    .label = Cancella la cronologia recente…
menu-history-synced-tabs =
    .label = Schede sincronizzate
menu-history-restore-last-session =
    .label = Ripristina la sessione precedente
menu-history-hidden-tabs =
    .label = Schede nascoste
menu-history-undo-menu =
    .label = Schede chiuse di recente
menu-history-undo-window-menu =
    .label = Finestre chiuse di recente

menu-history-reopen-all-tabs = Riapri tutte le schede
menu-history-reopen-all-windows = Riapri tutte le finestre

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Segnalibri
    .accesskey = e
menu-bookmarks-manage =
    .label = Gestisci segnalibri
menu-bookmark-current-tab =
    .label = Aggiungi scheda corrente ai segnalibri
menu-bookmark-edit =
    .label = Modifica segnalibro
menu-bookmarks-all-tabs =
    .label = Tutte le schede nei segnalibri…
menu-bookmarks-toolbar =
    .label = Barra dei segnalibri
menu-bookmarks-other =
    .label = Altri segnalibri
menu-bookmarks-mobile =
    .label = Segnalibri da dispositivi mobile

## Tools Menu

menu-tools =
    .label = Strumenti
    .accesskey = S
menu-tools-downloads =
    .label = Download
    .accesskey = D
menu-tools-addons-and-themes =
    .label = Estensioni e temi
    .accesskey = E
menu-tools-fxa-sign-in2 =
    .label = Accedi
    .accesskey = c
menu-tools-turn-on-sync2 =
    .label = Attiva sincronizzazione…
    .accesskey = v
menu-tools-sync-now =
    .label = Sincronizza adesso
    .accesskey = z
menu-tools-fxa-re-auth =
    .label = Riconnetti a { -brand-product-name }…
    .accesskey = R
menu-tools-browser-tools =
    .label = Strumenti del browser
    .accesskey = w
menu-tools-task-manager =
    .label = Gestione attività
    .accesskey = G
menu-tools-page-source =
    .label = Sorgente pagina
    .accesskey = o
menu-tools-page-info =
    .label = Informazioni sulla pagina
    .accesskey = I
menu-settings =
    .label = Impostazioni
    .accesskey =
        { PLATFORM() ->
            [windows] o
           *[other] n
        }
menu-tools-layout-debugger =
    .label = Debugger layout
    .accesskey = y

## Window Menu

menu-window-menu =
    .label = Finestra
menu-window-bring-all-to-front =
    .label = Porta tutto in primo piano

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-help-product
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Aiuto
    .accesskey = A
menu-get-help =
    .label = Ottieni assistenza
    .accesskey = n
menu-help-more-troubleshooting-info =
    .label = Altre informazioni per la risoluzione di problemi
    .accesskey = r
menu-help-report-site-issue =
    .label = Segnala problema con questo sito…
menu-help-feedback-page =
    .label = Invia feedback…
    .accesskey = k
menu-help-share-ideas =
    .label = Condividi idee e feedback…
    .accesskey = k
menu-help-enter-troubleshoot-mode2 =
    .label = Modalità risoluzione problemi…
    .accesskey = M
menu-help-exit-troubleshoot-mode =
    .label = Disattiva Modalità risoluzione problemi
    .accesskey = m
# Label of the Help menu item. Either this or
# safeb.palm.notdeceptive.label from
# phishing-afterload-warning-message.dtd is shown.
menu-help-report-deceptive-site =
    .label = Segnala un sito ingannevole…
    .accesskey = e
menu-help-not-deceptive =
    .label = Non è un sito ingannevole…
    .accesskey = e
