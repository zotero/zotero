# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Lêer
    .accesskey = L
menu-file-new-tab =
    .label = Nuwe oortjie
    .accesskey = o
menu-file-new-container-tab =
    .label = Nuwe konteksoortjie
    .accesskey = r
menu-file-new-window =
    .label = Nuwe venster
    .accesskey = N
menu-file-new-private-window =
    .label = Nuwe private venster
    .accesskey = v
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Open ligging…
menu-file-open-file =
    .label = Open lêer…
    .accesskey = O
menu-file-close =
    .label = Sluit
    .accesskey = S
menu-file-close-window =
    .label = Sluit venster
    .accesskey = v
menu-file-save-page =
    .label = Stoor bladsy as…
    .accesskey = a
menu-file-email-link =
    .label = E-pos skakel…
    .accesskey = E
menu-file-print-setup =
    .label = Bladsyopstelling…
    .accesskey = t
menu-file-print-preview =
    .label = Drukvoorskou
    .accesskey = v
menu-file-print =
    .label = Druk…
    .accesskey = D
menu-file-go-offline =
    .label = Werk vanlyn
    .accesskey = k

## Edit Menu

menu-edit =
    .label = Redigeer
    .accesskey = e
menu-edit-find-on =
    .label = Vind op hierdie bladsy…
    .accesskey = V
menu-edit-find-again =
    .label = Vind weer
    .accesskey = e
menu-edit-bidi-switch-text-direction =
    .label = Wissel teksrigting
    .accesskey = i

## View Menu

menu-view =
    .label = Bekyk
    .accesskey = k
menu-view-toolbars-menu =
    .label = Nutsbalke
    .accesskey = N
menu-view-customize-toolbar =
    .label = Doelmaak…
    .accesskey = D
menu-view-sidebar =
    .label = Kantbalk
    .accesskey = b
menu-view-bookmarks =
    .label = Boekmerke
menu-view-history-button =
    .label = Geskiedenis
menu-view-synced-tabs-sidebar =
    .label = Gesinkroniseerde oortjies
menu-view-full-zoom =
    .label = Zoem
    .accesskey = Z
menu-view-full-zoom-enlarge =
    .label = Zoem in
    .accesskey = i
menu-view-full-zoom-reduce =
    .label = Zoem uit
    .accesskey = u
menu-view-full-zoom-toggle =
    .label = Zoem net teks
    .accesskey = t
menu-view-page-style-menu =
    .label = Bladsystyl
    .accesskey = t
menu-view-page-style-no-style =
    .label = Geen styl nie
    .accesskey = G
menu-view-page-basic-style =
    .label = Basiese bladsystyl
    .accesskey = B
menu-view-charset =
    .label = Teksenkodering
    .accesskey = e

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Betree volskermmodus
    .accesskey = v
menu-view-exit-full-screen =
    .label = Sluit volskermmodus af
    .accesskey = v
menu-view-full-screen =
    .label = Volskerm
    .accesskey = V

##

menu-view-show-all-tabs =
    .label = Wys alle oortjies
    .accesskey = a
menu-view-bidi-switch-page-direction =
    .label = Verwissel bladsyrigting
    .accesskey = r

## History Menu

menu-history =
    .label = Geskiedenis
    .accesskey = s
menu-history-show-all-history =
    .label = Wys hele geskiedenis
menu-history-clear-recent-history =
    .label = Maak onlangse geskiedenis skoon…
menu-history-synced-tabs =
    .label = Gesinkroniseerde oortjies
menu-history-restore-last-session =
    .label = Laai vorige sessie terug
menu-history-undo-menu =
    .label = Onlangs gesluite oortjies
menu-history-undo-window-menu =
    .label = Onlangs gesluite vensters

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Boekmerke
    .accesskey = B
menu-bookmarks-show-all =
    .label = Wys alle boekmerke
menu-bookmark-this-page =
    .label = Boekmerk hierdie bladsy
menu-bookmark-edit =
    .label = Redigeer hierdie boekmerk
menu-bookmarks-all-tabs =
    .label = Boekmerk alle oortjies…
menu-bookmarks-toolbar =
    .label = Boekmerknutsbalk
menu-bookmarks-other =
    .label = Ander boekmerke

## Tools Menu

menu-tools =
    .label = Nutsgoed
    .accesskey = u
menu-tools-downloads =
    .label = Afgelaai
    .accesskey = A
menu-tools-addons =
    .label = Byvoegings
    .accesskey = B
menu-tools-sync-now =
    .label = Sinkroniseer nou
    .accesskey = S
menu-tools-web-developer =
    .label = Webontwikkelaar
    .accesskey = W
menu-tools-page-source =
    .label = Bladsybron
    .accesskey = r
menu-tools-page-info =
    .label = Bladsyinfo
    .accesskey = i
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Opsies
           *[other] Voorkeure
        }
    .accesskey =
        { PLATFORM() ->
            [windows] O
           *[other] k
        }

## Window Menu

menu-window-menu =
    .label = Venster
menu-window-bring-all-to-front =
    .label = Bring alles na vore

## Help Menu

menu-help =
    .label = Hulp
    .accesskey = H
menu-help-product =
    .label = { -brand-shorter-name }-hulp
    .accesskey = h
menu-help-show-tour =
    .label = { -brand-shorter-name }-toer
    .accesskey = o
menu-help-keyboard-shortcuts =
    .label = Sleutelbordkortpaaie
    .accesskey = k
menu-help-troubleshooting-info =
    .label = Inligting vir probleemoplossing
    .accesskey = p
menu-help-feedback-page =
    .label = Dien terugvoer in…
    .accesskey = D
menu-help-safe-mode-without-addons =
    .label = Herbegin met byvoegings gedeaktiveer…
    .accesskey = H
menu-help-safe-mode-with-addons =
    .label = Herbegin met byvoegings geaktiveer
    .accesskey = r
# Label of the Help menu item. Either this or
# safeb.palm.notdeceptive.label from
# phishing-afterload-warning-message.dtd is shown.
menu-help-report-deceptive-site =
    .label = Rapporteer misleidende werf…
    .accesskey = d
menu-help-not-deceptive =
    .label = Nié 'n misleidende werf nie…
    .accesskey = d
