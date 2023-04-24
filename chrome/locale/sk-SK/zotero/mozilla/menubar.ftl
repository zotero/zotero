# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Možnosti
menu-application-services =
    .label = Služby
menu-application-hide-this =
    .label = Skryť { -brand-shorter-name }
menu-application-hide-other =
    .label = Skryť ostatné
menu-application-show-all =
    .label = Zobraziť všetko
menu-application-touch-bar =
    .label = Prispôsobiť touch bar…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Ukončiť prehliadač
           *[other] Ukončiť prehliadač
        }
    .accesskey =
        { PLATFORM() ->
            [windows] U
           *[other] U
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Ukončiť { -brand-shorter-name }
menu-about =
    .label = O aplikácii { -brand-shorter-name }
    .accesskey = O

## File Menu

menu-file =
    .label = Súbor
    .accesskey = S
menu-file-new-tab =
    .label = Nová karta
    .accesskey = a
menu-file-new-container-tab =
    .label = Nová kontajnerová karta
    .accesskey = k
menu-file-new-window =
    .label = Nové okno
    .accesskey = o
menu-file-new-private-window =
    .label = Nové súkromné okno
    .accesskey = k
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Otvoriť umiestnenie…
menu-file-open-file =
    .label = Otvoriť súbor…
    .accesskey = s
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Zavrieť kartu
            [one] Zavrieť kartu
            [few] Zavrieť { $tabCount } karty
           *[other] Zavrieť { $tabCount } kariet
        }
    .accesskey = Z
menu-file-close-window =
    .label = Zavrieť okno
    .accesskey = v
menu-file-save-page =
    .label = Uložiť stránku ako…
    .accesskey = r
menu-file-email-link =
    .label = Odoslať odkaz…
    .accesskey = l
menu-file-share-url =
    .label = Zdieľať
    .accesskey = Z
menu-file-print-setup =
    .label = Nastavenie tlače…
    .accesskey = N
menu-file-print =
    .label = Tlačiť…
    .accesskey = T
menu-file-import-from-another-browser =
    .label = Importovať z iného prehliadača…
    .accesskey = I
menu-file-go-offline =
    .label = Pracovať offline
    .accesskey = f

## Edit Menu

menu-edit =
    .label = Upraviť
    .accesskey = U
menu-edit-find-in-page =
    .label = Hľadať na stránke…
    .accesskey = H
menu-edit-find-again =
    .label = Hľadať znova
    .accesskey = d
menu-edit-bidi-switch-text-direction =
    .label = Zmeniť smer textu
    .accesskey = m

## View Menu

menu-view =
    .label = Zobraziť
    .accesskey = Z
menu-view-toolbars-menu =
    .label = Panely s nástrojmi
    .accesskey = P
menu-view-customize-toolbar2 =
    .label = Upraviť panel nástrojov…
    .accesskey = U
menu-view-sidebar =
    .label = Bočný panel
    .accesskey = B
menu-view-bookmarks =
    .label = Záložky
menu-view-history-button =
    .label = História
menu-view-synced-tabs-sidebar =
    .label = Synchronizované karty
menu-view-full-zoom =
    .label = Lupa
    .accesskey = L
menu-view-full-zoom-enlarge =
    .label = Priblížiť
    .accesskey = P
menu-view-full-zoom-reduce =
    .label = Vzdialiť
    .accesskey = V
menu-view-full-zoom-actual-size =
    .label = Skutočná veľkosť
    .accesskey = S
menu-view-full-zoom-toggle =
    .label = Meniť iba veľkosť textu
    .accesskey = M
menu-view-page-style-menu =
    .label = Štýl stránky
    .accesskey = n
menu-view-page-style-no-style =
    .label = Žiadny štýl
    .accesskey = a
menu-view-page-basic-style =
    .label = Základný štýl stránky
    .accesskey = Z
menu-view-repair-text-encoding =
    .label = Opraviť kódovanie textu
    .accesskey = O

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Prejsť do režimu celej obrazovky
    .accesskey = c
menu-view-exit-full-screen =
    .label = Ukončiť režim celej obrazovky
    .accesskey = c
menu-view-full-screen =
    .label = Na celú obrazovku
    .accesskey = c

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Zapnúť zobrazenie Čítačka
    .accesskey = Z
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Zavrieť zobrazenie Čítačka
    .accesskey = Z

##

menu-view-show-all-tabs =
    .label = Zobraziť všetky karty
    .accesskey = a
menu-view-bidi-switch-page-direction =
    .label = Zmeniť smer stránky
    .accesskey = m

## History Menu

menu-history =
    .label = História
    .accesskey = H
menu-history-show-all-history =
    .label = Zobraziť celú históriu
menu-history-clear-recent-history =
    .label = Vymazať históriu prehliadania…
menu-history-synced-tabs =
    .label = Synchronizované karty
menu-history-restore-last-session =
    .label = Obnoviť predchádzajúcu reláciu
menu-history-hidden-tabs =
    .label = Skryté karty
menu-history-undo-menu =
    .label = Nedávno zatvorené karty
menu-history-undo-window-menu =
    .label = Nedávno zatvorené okná
menu-history-reopen-all-tabs = Obnoviť všetky karty
menu-history-reopen-all-windows = Obnoviť všetky okná

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Záložky
    .accesskey = o
menu-bookmarks-manage =
    .label = Spravovať záložky
menu-bookmark-current-tab =
    .label = Pridať túto kartu medzi záložky
menu-bookmark-edit =
    .label = Upraviť túto záložku
menu-bookmark-tab =
    .label = Pridať túto kartu medzi záložky
menu-edit-bookmark =
    .label = Upraviť túto záložku…
menu-bookmarks-all-tabs =
    .label = Pridať všetky karty medzi záložky…
menu-bookmarks-toolbar =
    .label = Panel záložiek
menu-bookmarks-other =
    .label = Ostatné záložky
menu-bookmarks-mobile =
    .label = Záložky mobilného Firefoxu

## Tools Menu

menu-tools =
    .label = Nástroje
    .accesskey = N
menu-tools-downloads =
    .label = Správca sťahovania súborov
    .accesskey = S
menu-tools-addons-and-themes =
    .label = Doplnky a témy
    .accesskey = D
menu-tools-fxa-sign-in2 =
    .label = Prihlásiť sa
    .accesskey = P
menu-tools-turn-on-sync2 =
    .label = Zapnúť synchronizáciu…
    .accesskey = c
menu-tools-sync-now =
    .label = Synchronizovať teraz
    .accesskey = c
menu-tools-fxa-re-auth =
    .label = Znovu pripojiť k aplikácii { -brand-product-name }…
    .accesskey = r
menu-tools-browser-tools =
    .label = Nástroje prehliadača
    .accesskey = h
menu-tools-task-manager =
    .label = Správca úloh
    .accesskey = c
menu-tools-page-source =
    .label = Zdrojový kód stránky
    .accesskey = d
menu-tools-page-info =
    .label = Informácie o stránke
    .accesskey = I
menu-settings =
    .label = Nastavenia
    .accesskey =
        { PLATFORM() ->
            [windows] N
           *[other] N
        }
menu-tools-layout-debugger =
    .label = Ladenie rozloženia
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = Okno
menu-window-bring-all-to-front =
    .label = Preniesť všetko do popredia

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Pomocník
    .accesskey = P
menu-get-help =
    .label = Získať pomoc
    .accesskey = Z
menu-help-more-troubleshooting-info =
    .label = Ďalšie informácie pre riešenie problémov
    .accesskey = a
menu-help-report-site-issue =
    .label = Nahlásiť problém so stránkou…
menu-help-share-ideas =
    .label = Zdieľať nápady a spätnú väzbu…
    .accesskey = d
menu-help-enter-troubleshoot-mode2 =
    .label = Režim riešenia problémov…
    .accesskey = R
menu-help-exit-troubleshoot-mode =
    .label = Vypnúť režim riešenia problémov
    .accesskey = r
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Nahlásenie podvodnej stránky…
    .accesskey = N
menu-help-not-deceptive =
    .label = Toto nie je podvodná stránka…
    .accesskey = T
