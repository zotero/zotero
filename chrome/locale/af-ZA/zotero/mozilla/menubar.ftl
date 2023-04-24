# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-services =
    .label = Dienste
menu-application-hide-this =
    .label = Verskuil { -brand-shorter-name }
menu-application-hide-other =
    .label = Verskuil ander
menu-application-show-all =
    .label = Wys alle

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Afsluit
           *[other] Afsluit
        }
    .accesskey =
        { PLATFORM() ->
            [windows] s
           *[other] A
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Sluit { -brand-shorter-name } af
menu-about =
    .label = Aangaande { -brand-shorter-name }
    .accesskey = A

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

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Gebruik leesaansig
    .accesskey = l
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Sluit leesaansig
    .accesskey = l

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
menu-tools-sync-now =
    .label = Sinkroniseer nou
    .accesskey = S
menu-tools-page-source =
    .label = Bladsybron
    .accesskey = r
menu-tools-page-info =
    .label = Bladsyinfo
    .accesskey = i

## Window Menu

menu-window-menu =
    .label = Venster
menu-window-bring-all-to-front =
    .label = Bring alles na vore

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Hulp
    .accesskey = H
# Label of the Help menu item. Either this or
# safeb.palm.notdeceptive.label from
# phishing-afterload-warning-message.dtd is shown.
menu-help-report-deceptive-site =
    .label = Rapporteer misleidende werf…
    .accesskey = d
menu-help-not-deceptive =
    .label = Nié 'n misleidende werf nie…
    .accesskey = d
