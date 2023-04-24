# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Nuostatos
menu-application-services =
    .label = Paslaugos
menu-application-hide-this =
    .label = Nerodyti „{ -brand-shorter-name }“
menu-application-hide-other =
    .label = Nerodyti kitų
menu-application-show-all =
    .label = Rodyti viską
menu-application-touch-bar =
    .label = Tvarkyti lietimo juostą…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Baigti darbą
           *[other] Baigti darbą
        }
    .accesskey =
        { PLATFORM() ->
            [windows] B
           *[other] B
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Baigti „{ -brand-shorter-name }“ darbą
menu-about =
    .label = Apie „{ -brand-shorter-name }“
    .accesskey = A

## File Menu

menu-file =
    .label = Failas
    .accesskey = F
menu-file-new-tab =
    .label = Nauja kortelė
    .accesskey = k
menu-file-new-container-tab =
    .label = Nauja sudėtinė kortelė
    .accesskey = s
menu-file-new-window =
    .label = Naujas langas
    .accesskey = l
menu-file-new-private-window =
    .label = Naujas privataus naršymo langas
    .accesskey = p
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Atverti adresą…
menu-file-open-file =
    .label = Atverti…
    .accesskey = A
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Užverti kortelę
            [one] Užverti { $tabCount } kortelę
            [few] Užverti { $tabCount } korteles
           *[other] Užverti { $tabCount } kortelių
        }
    .accesskey = U
menu-file-close-window =
    .label = Užverti langą
    .accesskey = g
menu-file-save-page =
    .label = Įrašyti kaip…
    .accesskey = r
menu-file-email-link =
    .label = Išsiųsti saitą el. paštu…
    .accesskey = ų
menu-file-share-url =
    .label = Dalintis
    .accesskey = l
menu-file-print-setup =
    .label = Puslapio nuostatos…
    .accesskey = n
menu-file-print =
    .label = Spausdinti…
    .accesskey = S
menu-file-import-from-another-browser =
    .label = Importuoti iš kitos naršyklės…
    .accesskey = I
menu-file-go-offline =
    .label = Atsijungti nuo tinklo
    .accesskey = t

## Edit Menu

menu-edit =
    .label = Taisa
    .accesskey = T
menu-edit-find-in-page =
    .label = Rasti tinklalapyje
    .accesskey = R
menu-edit-find-again =
    .label = Ieškoti toliau
    .accesskey = o
menu-edit-bidi-switch-text-direction =
    .label = Pakeisti teksto kryptį
    .accesskey = k

## View Menu

menu-view =
    .label = Rodymas
    .accesskey = R
menu-view-toolbars-menu =
    .label = Priemonių juostos
    .accesskey = j
menu-view-customize-toolbar2 =
    .label = Tvarkyti priemonių juostą…
    .accesskey = T
menu-view-sidebar =
    .label = Parankinė
    .accesskey = P
menu-view-bookmarks =
    .label = Adresynas
menu-view-history-button =
    .label = Žurnalas
menu-view-synced-tabs-sidebar =
    .label = Sinchronizuotos kortelės
menu-view-full-zoom =
    .label = Mastelis
    .accesskey = M
menu-view-full-zoom-enlarge =
    .label = Padidinti
    .accesskey = d
menu-view-full-zoom-reduce =
    .label = Sumažinti
    .accesskey = m
menu-view-full-zoom-actual-size =
    .label = Tikras dydis
    .accesskey = T
menu-view-full-zoom-toggle =
    .label = Keisti tik teksto dydį
    .accesskey = t
menu-view-page-style-menu =
    .label = Tinklalapio stilius
    .accesskey = k
menu-view-page-style-no-style =
    .label = Nėra
    .accesskey = N
menu-view-page-basic-style =
    .label = Pagrindinis tinklalapio stilius
    .accesskey = P
menu-view-repair-text-encoding =
    .label = Sutvarkyti simbolių koduotę
    .accesskey = k

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Rodyti visame ekrane
    .accesskey = v
menu-view-exit-full-screen =
    .label = Grįžti iš viso ekrano
    .accesskey = v
menu-view-full-screen =
    .label = Visas ekranas
    .accesskey = V

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Pereiti į skaitymo rodinį
    .accesskey = s
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Išjungti skaitymo rodinį
    .accesskey = s

##

menu-view-show-all-tabs =
    .label = Rodyti visas korteles
    .accesskey = k
menu-view-bidi-switch-page-direction =
    .label = Pakeisti puslapio kryptį
    .accesskey = a

## History Menu

menu-history =
    .label = Žurnalas
    .accesskey = u
menu-history-show-all-history =
    .label = Rodyti visą žurnalą
menu-history-clear-recent-history =
    .label = Valyti žurnalą…
menu-history-synced-tabs =
    .label = Sinchronizuotos kortelės
menu-history-restore-last-session =
    .label = Atkurti paskiausiąjį seansą
menu-history-hidden-tabs =
    .label = Paslėptos kortelės
menu-history-undo-menu =
    .label = Paskiausiai užvertos kortelės
menu-history-undo-window-menu =
    .label = Paskiausiai užverti langai
menu-history-reopen-all-tabs = Įkelti visas korteles
menu-history-reopen-all-windows = Įkelti visus langus

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Adresynas
    .accesskey = A
menu-bookmarks-manage =
    .label = Tvarkyti adresyną
menu-bookmark-current-tab =
    .label = Įrašyti šią kortelę į adresyną
menu-bookmark-edit =
    .label = Taisyti adresyno įrašą
menu-bookmarks-all-tabs =
    .label = Visas korteles įtraukti į adresyną…
menu-bookmarks-toolbar =
    .label = Adresyno juosta
menu-bookmarks-other =
    .label = Kiti adresai
menu-bookmarks-mobile =
    .label = Mobilusis adresynas

## Tools Menu

menu-tools =
    .label = Priemonės
    .accesskey = P
menu-tools-downloads =
    .label = Atsiuntimai
    .accesskey = s
menu-tools-addons-and-themes =
    .label = Priedai ir grafiniai apvalkalai
    .accesskey = P
menu-tools-fxa-sign-in2 =
    .label = Prisijungti
    .accesskey = g
menu-tools-turn-on-sync2 =
    .label = Įjungti sinchronizavimą…
    .accesskey = n
menu-tools-sync-now =
    .label = Sinchronizuoti dabar
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Prisijungti prie „{ -brand-product-name }“ iš naujo…
    .accesskey = r
menu-tools-browser-tools =
    .label = Naršyklės priemonės
    .accesskey = N
menu-tools-task-manager =
    .label = Užduočių tvarkytuvė
    .accesskey = t
menu-tools-page-source =
    .label = Pirminis tekstas
    .accesskey = e
menu-tools-page-info =
    .label = Informacija apie tinklalapį
    .accesskey = I
menu-settings =
    .label = Nuostatos
    .accesskey =
        { PLATFORM() ->
            [windows] N
           *[other] N
        }
menu-tools-layout-debugger =
    .label = Išdėstymo derintuvė
    .accesskey = d

## Window Menu

menu-window-menu =
    .label = Langas
menu-window-bring-all-to-front =
    .label = Viską į priekinį planą

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Žinynas
    .accesskey = Ž
menu-get-help =
    .label = Žinynas ir pagalba
    .accesskey = Ž
menu-help-more-troubleshooting-info =
    .label = Daugiau informacijos problemų sprendimui
    .accesskey = p
menu-help-report-site-issue =
    .label = Pranešti apie svetainės problemą…
menu-help-share-ideas =
    .label = Pasidalinti idėjomis ir atsiliepimais…
    .accesskey = s
menu-help-enter-troubleshoot-mode2 =
    .label = Trikčių šalinimo veiksena…
    .accesskey = v
menu-help-exit-troubleshoot-mode =
    .label = Išjungti problemų sprendimo veikseną
    .accesskey = m
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Pranešti apie apgaulingą svetainę…
    .accesskey = a
menu-help-not-deceptive =
    .label = Tai nėra apgaulinga svetainė…
    .accesskey = g
