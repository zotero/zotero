# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Nastavitve
menu-application-services =
    .label = Storitve
menu-application-hide-this =
    .label = Skrij { -brand-shorter-name }
menu-application-hide-other =
    .label = Skrij ostale
menu-application-show-all =
    .label = Prikaži vse
menu-application-touch-bar =
    .label = Prilagodi vrstico na dotik …

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Izhod
           *[other] Izhod
        }
    .accesskey =
        { PLATFORM() ->
            [windows] h
           *[other] I
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Izhod iz { -brand-shorter-name }a
menu-about =
    .label = O { -brand-shorter-name }u
    .accesskey = O

## File Menu

menu-file =
    .label = Datoteka
    .accesskey = D
menu-file-new-tab =
    .label = Nov zavihek
    .accesskey = Z
menu-file-new-container-tab =
    .label = Nov vsebniški zavihek
    .accesskey = v
menu-file-new-window =
    .label = Novo okno
    .accesskey = N
menu-file-new-private-window =
    .label = Novo zasebno okno
    .accesskey = a
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Odpri mesto …
menu-file-open-file =
    .label = Odpri datoteko …
    .accesskey = O
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [one] Zapri zavihek
            [two] Zapri { $tabCount } zavihka
            [few] Zapri { $tabCount } zavihke
           *[other] Zapri { $tabCount } zavihkov
        }
    .accesskey = Z
menu-file-close-window =
    .label = Zapri okno
    .accesskey = o
menu-file-save-page =
    .label = Shrani stran kot …
    .accesskey = S
menu-file-email-link =
    .label = Pošlji povezavo po e-pošti …
    .accesskey = P
menu-file-share-url =
    .label = Deli
    .accesskey = D
menu-file-print-setup =
    .label = Priprava strani …
    .accesskey = r
menu-file-print =
    .label = Natisni …
    .accesskey = N
menu-file-import-from-another-browser =
    .label = Uvozi iz drugega brskalnika …
    .accesskey = U
menu-file-go-offline =
    .label = Nepovezan način
    .accesskey = e

## Edit Menu

menu-edit =
    .label = Uredi
    .accesskey = U
menu-edit-find-in-page =
    .label = Najdi na strani …
    .accesskey = d
menu-edit-find-again =
    .label = Ponovno najdi
    .accesskey = j
menu-edit-bidi-switch-text-direction =
    .label = Spremeni smer besedila
    .accesskey = b

## View Menu

menu-view =
    .label = Pogled
    .accesskey = P
menu-view-toolbars-menu =
    .label = Orodne vrstice
    .accesskey = T
menu-view-customize-toolbar2 =
    .label = Prilagodi orodno vrstico …
    .accesskey = P
menu-view-sidebar =
    .label = Stranska vrstica
    .accesskey = v
menu-view-bookmarks =
    .label = Zaznamki
menu-view-history-button =
    .label = Zgodovina
menu-view-synced-tabs-sidebar =
    .label = Sinhronizirani zavihki
menu-view-full-zoom =
    .label = Povečava
    .accesskey = P
menu-view-full-zoom-enlarge =
    .label = Povečaj
    .accesskey = V
menu-view-full-zoom-reduce =
    .label = Pomanjšaj
    .accesskey = M
menu-view-full-zoom-actual-size =
    .label = Dejanska velikost
    .accesskey = D
menu-view-full-zoom-toggle =
    .label = Povečaj le besedilo
    .accesskey = B
menu-view-page-style-menu =
    .label = Slog strani
    .accesskey = g
menu-view-page-style-no-style =
    .label = Brez sloga
    .accesskey = b
menu-view-page-basic-style =
    .label = Osnovni slog strani
    .accesskey = o
menu-view-repair-text-encoding =
    .label = Popravi kodiranje besedila
    .accesskey = r

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Celoten zaslon
    .accesskey = C
menu-view-exit-full-screen =
    .label = Izhod iz celozaslonskega načina
    .accesskey = C
menu-view-full-screen =
    .label = Celoten zaslon
    .accesskey = C

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Odpri bralni pogled
    .accesskey = B
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Zapri bralni pogled
    .accesskey = B

##

menu-view-show-all-tabs =
    .label = Prikaži vse zavihke
    .accesskey = A
menu-view-bidi-switch-page-direction =
    .label = Spremeni smer strani
    .accesskey = s

## History Menu

menu-history =
    .label = Zgodovina
    .accesskey = v
menu-history-show-all-history =
    .label = Prikaži vso zgodovino
menu-history-clear-recent-history =
    .label = Počisti nedavno zgodovino …
menu-history-synced-tabs =
    .label = Sinhronizirani zavihki
menu-history-restore-last-session =
    .label = Obnovi prejšnjo sejo
menu-history-hidden-tabs =
    .label = Skriti zavihki
menu-history-undo-menu =
    .label = Nedavno zaprti zavihki
menu-history-undo-window-menu =
    .label = Nedavno zaprta okna
menu-history-reopen-all-tabs = Ponovno odpri vse zavihke
menu-history-reopen-all-windows = Ponovno odpri vsa okna

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Zaznamki
    .accesskey = Z
menu-bookmarks-manage =
    .label = Upravljanje zaznamkov
menu-bookmark-current-tab =
    .label = Dodaj trenutni zavihek med zaznamke
menu-bookmark-edit =
    .label = Uredi ta zaznamek
menu-bookmark-tab =
    .label = Dodaj trenutni zavihek med zaznamke …
menu-edit-bookmark =
    .label = Uredi ta zaznamek …
menu-bookmarks-all-tabs =
    .label = Dodaj vse zavihke med zaznamke …
menu-bookmarks-toolbar =
    .label = Vrstica zaznamkov
menu-bookmarks-other =
    .label = Drugi zaznamki
menu-bookmarks-mobile =
    .label = Mobilni zaznamki

## Tools Menu

menu-tools =
    .label = Orodja
    .accesskey = O
menu-tools-downloads =
    .label = Prenosi
    .accesskey = P
menu-tools-addons-and-themes =
    .label = Dodatki in teme
    .accesskey = D
menu-tools-fxa-sign-in2 =
    .label = Prijava
    .accesskey = j
menu-tools-turn-on-sync2 =
    .label = Vklopi sinhronizacijo …
    .accesskey = V
menu-tools-sync-now =
    .label = Sinhroniziraj
    .accesskey = n
menu-tools-fxa-re-auth =
    .label = Ponovno poveži { -brand-product-name } …
    .accesskey = n
menu-tools-browser-tools =
    .label = Orodja brskalnika
    .accesskey = O
menu-tools-task-manager =
    .label = Upravitelj opravil
    .accesskey = U
menu-tools-page-source =
    .label = Izvorna koda strani
    .accesskey = v
menu-tools-page-info =
    .label = Podatki o strani
    .accesskey = I
menu-settings =
    .label = Nastavitve
    .accesskey =
        { PLATFORM() ->
            [windows] N
           *[other] N
        }
menu-tools-layout-debugger =
    .label = Razhroščevalnik postavitve
    .accesskey = P

## Window Menu

menu-window-menu =
    .label = Okno
menu-window-bring-all-to-front =
    .label = Vse v ospredje

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Pomoč
    .accesskey = M
menu-get-help =
    .label = Pomoč
    .accesskey = P
menu-help-more-troubleshooting-info =
    .label = Več podatkov za odpravljanje težav
    .accesskey = r
menu-help-report-site-issue =
    .label = Prijavi napako strani …
menu-help-share-ideas =
    .label = Sporoči ideje in povratne informacije …
    .accesskey = D
menu-help-enter-troubleshoot-mode2 =
    .label = Način za odpravljanje težav …
    .accesskey = r
menu-help-exit-troubleshoot-mode =
    .label = Izključi način za odpravljanje težav
    .accesskey = I
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Prijavi zavajajočo stran …
    .accesskey = P
menu-help-not-deceptive =
    .label = To ni zavajajoča stran …
    .accesskey = z
