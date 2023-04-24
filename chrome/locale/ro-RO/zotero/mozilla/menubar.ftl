# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Preferințe
menu-application-services =
    .label = Servicii
menu-application-hide-this =
    .label = Ascunde { -brand-shorter-name }
menu-application-hide-other =
    .label = Ascunde-le pe celelalte
menu-application-show-all =
    .label = Afișează toate
menu-application-touch-bar =
    .label = Personalizează bara tactilă…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Ieși
           *[other] Ieși
        }
    .accesskey =
        { PLATFORM() ->
            [windows] x
           *[other] Q
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Ieși din { -brand-shorter-name }
menu-about =
    .label = Despre { -brand-shorter-name }
    .accesskey = A

## File Menu

menu-file =
    .label = Fișier
    .accesskey = F
menu-file-new-tab =
    .label = Filă nouă
    .accesskey = T
menu-file-new-container-tab =
    .label = Filă container nouă
    .accesskey = B
menu-file-new-window =
    .label = Fereastră nouă
    .accesskey = N
menu-file-new-private-window =
    .label = Fereastră privată nouă
    .accesskey = W
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Deschide locația…
menu-file-open-file =
    .label = Deschide un fișier…
    .accesskey = O
menu-file-close-window =
    .label = Închide fereastra
    .accesskey = d
menu-file-save-page =
    .label = Salvează pagina ca…
    .accesskey = A
menu-file-email-link =
    .label = Trimite linkul prin e-mail…
    .accesskey = E
menu-file-print-setup =
    .label = Aranjare în pagină…
    .accesskey = u
menu-file-print =
    .label = Tipărește…
    .accesskey = P
menu-file-import-from-another-browser =
    .label = Importă din alt browser…
    .accesskey = I
menu-file-go-offline =
    .label = Lucrează offline
    .accesskey = k

## Edit Menu

menu-edit =
    .label = Editare
    .accesskey = E
menu-edit-find-in-page =
    .label = Caută în pagină…
    .accesskey = F
menu-edit-find-again =
    .label = Caută din nou
    .accesskey = g
menu-edit-bidi-switch-text-direction =
    .label = Schimbă direcția textului
    .accesskey = w

## View Menu

menu-view =
    .label = Vizualizare
    .accesskey = V
menu-view-toolbars-menu =
    .label = Bare de instrumente
    .accesskey = T
menu-view-customize-toolbar2 =
    .label = Personalizează bara de instrumente…
    .accesskey = C
menu-view-sidebar =
    .label = Bară laterală
    .accesskey = e
menu-view-bookmarks =
    .label = Marcaje
menu-view-history-button =
    .label = Istoric
menu-view-synced-tabs-sidebar =
    .label = File sincronizate
menu-view-full-zoom =
    .label = Zoom
    .accesskey = Z
menu-view-full-zoom-enlarge =
    .label = Mărește
    .accesskey = I
menu-view-full-zoom-reduce =
    .label = Micșorează
    .accesskey = O
menu-view-full-zoom-actual-size =
    .label = Mărime reală
    .accesskey = A
menu-view-full-zoom-toggle =
    .label = Zoom doar pe text
    .accesskey = T
menu-view-page-style-menu =
    .label = Stilul paginii
    .accesskey = y
menu-view-page-style-no-style =
    .label = Niciun stil
    .accesskey = n
menu-view-page-basic-style =
    .label = Stilul de bază al paginii
    .accesskey = b
menu-view-repair-text-encoding =
    .label = Repară codarea de text
    .accesskey = c

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Intră în modul ecran complet
    .accesskey = F
menu-view-exit-full-screen =
    .label = Ieși din modul ecran complet
    .accesskey = F
menu-view-full-screen =
    .label = Ecran complet
    .accesskey = F

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Intră în modul de lectură
    .accesskey = R
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Închide modul de lectură
    .accesskey = R

##

menu-view-show-all-tabs =
    .label = Afișează toate filele
    .accesskey = A
menu-view-bidi-switch-page-direction =
    .label = Schimbă direcția paginii
    .accesskey = D

## History Menu

menu-history =
    .label = Istoric
    .accesskey = s
menu-history-show-all-history =
    .label = Afișează tot istoricul
menu-history-clear-recent-history =
    .label = Șterge istoricul recent…
menu-history-synced-tabs =
    .label = File sincronizate
menu-history-restore-last-session =
    .label = Restaurează sesiunea anterioară
menu-history-hidden-tabs =
    .label = File ascunse
menu-history-undo-menu =
    .label = File închise recent
menu-history-undo-window-menu =
    .label = Ferestre închise recent
menu-history-reopen-all-tabs = Redeschide toate filele
menu-history-reopen-all-windows = Redeschise toate ferestrele

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Marcaje
    .accesskey = B
menu-bookmarks-manage =
    .label = Gestionează marcajele
menu-bookmark-current-tab =
    .label = Marchează fila actuală
menu-bookmark-edit =
    .label = Editează acest marcaj
menu-bookmark-tab =
    .label = Marchează fila actuală…
menu-bookmarks-all-tabs =
    .label = Marchează toate filele…
menu-bookmarks-toolbar =
    .label = Bară de marcaje
menu-bookmarks-other =
    .label = Alte marcaje
menu-bookmarks-mobile =
    .label = Marcaje mobile

## Tools Menu

menu-tools =
    .label = Instrumente
    .accesskey = T
menu-tools-downloads =
    .label = Descărcări
    .accesskey = D
menu-tools-addons-and-themes =
    .label = Suplimente și teme
    .accesskey = A
menu-tools-fxa-sign-in2 =
    .label = Autentifică-te
    .accesskey = g
menu-tools-turn-on-sync2 =
    .label = Activează sincronizarea
    .accesskey = n
menu-tools-sync-now =
    .label = Sincronizează acum
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Reconectare la { -brand-product-name }…
    .accesskey = R
menu-tools-browser-tools =
    .label = Uneltele browserului
    .accesskey = B
menu-tools-task-manager =
    .label = Manager de activități
    .accesskey = M
menu-tools-page-source =
    .label = Sursa paginii
    .accesskey = o
menu-tools-page-info =
    .label = Informații despre pagină
    .accesskey = I
menu-settings =
    .label = Setări
    .accesskey =
        { PLATFORM() ->
            [windows] S
           *[other] n
        }
menu-tools-layout-debugger =
    .label = Depanator de așezare în pagină
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = Fereastră
menu-window-bring-all-to-front =
    .label = Adu toate în față

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Ajutor
    .accesskey = H
menu-get-help =
    .label = Obține ajutor
    .accesskey = H
menu-help-more-troubleshooting-info =
    .label = Mai multe informații de depanare
    .accesskey = T
menu-help-report-site-issue =
    .label = Raportează problemă cu site-ul…
menu-help-share-ideas =
    .label = Împărtășește idei și feedbackuri…
    .accesskey = S
menu-help-enter-troubleshoot-mode2 =
    .label = Mod de depanare…
    .accesskey = M
menu-help-exit-troubleshoot-mode =
    .label = Oprește modul de depanare
    .accesskey = M
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Raportează site-uri înșelătoare…
    .accesskey = d
menu-help-not-deceptive =
    .label = Nu este un site înșelător…
    .accesskey = d
