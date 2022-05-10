# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


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
    .label = Nuova finestra­
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
menu-file-close-window =
    .label = Chiudi finestra
    .accesskey = d
menu-file-save-page =
    .label = Salva pagina con nome…
    .accesskey = v
menu-file-email-link =
    .label = Invia link per email…
    .accesskey = I
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
menu-edit-find-on =
    .label = Trova in questa pagina…
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
menu-view-customize-toolbar =
    .label = Personalizza…
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
menu-view-charset =
    .label = Codifica del testo
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
    .label = Schermo intero­
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

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Segnalibri
    .accesskey = e
menu-bookmarks-show-all =
    .label = Visualizza tutti i segnalibri
menu-bookmark-this-page =
    .label = Aggiungi pagina ai segnalibri
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
menu-tools-addons =
    .label = Componenti aggiuntivi
    .accesskey = C
menu-tools-fxa-sign-in =
    .label = Accedi a { -brand-product-name }…
    .accesskey = c
menu-tools-turn-on-sync =
    .label = Attiva { -sync-brand-short-name }…
    .accesskey = v
menu-tools-sync-now =
    .label = Sincronizza adesso
    .accesskey = z
menu-tools-fxa-re-auth =
    .label = Riconnetti a { -brand-product-name }…
    .accesskey = R
menu-tools-web-developer =
    .label = Sviluppo web
    .accesskey = v
menu-tools-page-source =
    .label = Sorgente pagina
    .accesskey = o
menu-tools-page-info =
    .label = Informazioni sulla pagina
    .accesskey = I
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Opzioni
           *[other] Preferenze
        }
    .accesskey =
        { PLATFORM() ->
            [windows] O
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

menu-help =
    .label = Aiuto
    .accesskey = A
menu-help-product =
    .label = Guida di { -brand-shorter-name }
    .accesskey = G
menu-help-show-tour =
    .label = Panoramica di { -brand-shorter-name }
    .accesskey = o
menu-help-import-from-another-browser =
    .label = Importa da un altro browser…
    .accesskey = b
menu-help-keyboard-shortcuts =
    .label = Scorciatoie da tastiera
    .accesskey = S
menu-help-troubleshooting-info =
    .label = Risoluzione dei problemi
    .accesskey = R
menu-help-feedback-page =
    .label = Invia feedback…
    .accesskey = k
menu-help-safe-mode-without-addons =
    .label = Riavvia disattivando i componenti aggiuntivi…
    .accesskey = d
menu-help-safe-mode-with-addons =
    .label = Riavvia attivando i componenti aggiuntivi
    .accesskey = R
# Label of the Help menu item. Either this or
# safeb.palm.notdeceptive.label from
# phishing-afterload-warning-message.dtd is shown.
menu-help-report-deceptive-site =
    .label = Segnala un sito ingannevole…
    .accesskey = e
menu-help-not-deceptive =
    .label = Non è un sito ingannevole…
    .accesskey = e
