# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Beállítások
menu-application-services =
    .label = Szolgáltatások
menu-application-hide-this =
    .label = A { -brand-shorter-name } elrejtése
menu-application-hide-other =
    .label = A több elrejtése
menu-application-show-all =
    .label = Mindet mutat
menu-application-touch-bar =
    .label = Érintősár testreszabása…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Kilépés
           *[other] Kilépés
        }
    .accesskey =
        { PLATFORM() ->
            [windows] K
           *[other] K
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Kilépés a { -brand-shorter-name }ból
menu-about =
    .label = A { -brand-shorter-name } névjegye
    .accesskey = A

## File Menu

menu-file =
    .label = Fájl
    .accesskey = F
menu-file-new-tab =
    .label = Új lap
    .accesskey = l
menu-file-new-container-tab =
    .label = Új konténerlap
    .accesskey = k
menu-file-new-window =
    .label = Új ablak
    .accesskey = a
menu-file-new-private-window =
    .label = Új privát ablak
    .accesskey = v
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Hely megnyitása…
menu-file-open-file =
    .label = Fájl megnyitása…
    .accesskey = F
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Lap bezárása
            [one] Lap bezárása
           *[other] { $tabCount } lap bezárása
        }
    .accesskey = b
menu-file-close-window =
    .label = Ablak bezárása
    .accesskey = A
menu-file-save-page =
    .label = Oldal mentése…
    .accesskey = m
menu-file-email-link =
    .label = Hivatkozás küldése e-mailben…
    .accesskey = d
menu-file-share-url =
    .label = Megosztás
    .accesskey = M
menu-file-print-setup =
    .label = Oldalbeállítás…
    .accesskey = O
menu-file-print =
    .label = Nyomtatás…
    .accesskey = N
menu-file-import-from-another-browser =
    .label = Importálás egy másik böngészőből…
    .accesskey = I
menu-file-go-offline =
    .label = Kapcsolat nélküli munka
    .accesskey = p

## Edit Menu

menu-edit =
    .label = Szerkesztés
    .accesskey = z
menu-edit-find-in-page =
    .label = Keresés az oldalon…
    .accesskey = K
menu-edit-find-again =
    .label = Következő keresése
    .accesskey = z
menu-edit-bidi-switch-text-direction =
    .label = Szöveg irányának átváltása
    .accesskey = z

## View Menu

menu-view =
    .label = Nézet
    .accesskey = N
menu-view-toolbars-menu =
    .label = Eszköztárak
    .accesskey = E
menu-view-customize-toolbar2 =
    .label = Eszköztár testreszabása…
    .accesskey = t
menu-view-sidebar =
    .label = Oldalsáv
    .accesskey = O
menu-view-bookmarks =
    .label = Könyvjelzők
menu-view-history-button =
    .label = Előzmények
menu-view-synced-tabs-sidebar =
    .label = Szinkronizált lapok
menu-view-full-zoom =
    .label = Nagyítás
    .accesskey = N
menu-view-full-zoom-enlarge =
    .label = Nagyítás
    .accesskey = N
menu-view-full-zoom-reduce =
    .label = Kicsinyítés
    .accesskey = K
menu-view-full-zoom-actual-size =
    .label = Valódi méret
    .accesskey = V
menu-view-full-zoom-toggle =
    .label = Csak a szöveg nagyítása
    .accesskey = C
menu-view-page-style-menu =
    .label = Oldalstílus
    .accesskey = s
menu-view-page-style-no-style =
    .label = Nincs stílus
    .accesskey = n
menu-view-page-basic-style =
    .label = Alap oldalstílus
    .accesskey = A
menu-view-repair-text-encoding =
    .label = Szövegkódolás javítása
    .accesskey = k

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Belépés a teljes képernyős módba
    .accesskey = B
menu-view-exit-full-screen =
    .label = Kilépés a teljes képernyős módból
    .accesskey = K
menu-view-full-screen =
    .label = Teljes képernyő
    .accesskey = T

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Belépés olvasó nézetbe
    .accesskey = O
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Olvasó nézet bezárása
    .accesskey = O

##

menu-view-show-all-tabs =
    .label = Az összes böngészőlap megjelenítése
    .accesskey = m
menu-view-bidi-switch-page-direction =
    .label = Oldal irányának átváltása
    .accesskey = l

## History Menu

menu-history =
    .label = Előzmények
    .accesskey = m
menu-history-show-all-history =
    .label = Minden előzmény megjelenítése
menu-history-clear-recent-history =
    .label = Előzmények törlése…
menu-history-synced-tabs =
    .label = Szinkronizált lapok
menu-history-restore-last-session =
    .label = Előző munkamenet helyreállítása
menu-history-hidden-tabs =
    .label = Rejtett lapok
menu-history-undo-menu =
    .label = Nemrég bezárt lapok
menu-history-undo-window-menu =
    .label = Nemrég bezárt ablakok
menu-history-reopen-all-tabs = Összes lap újranyitása
menu-history-reopen-all-windows = Összes ablak újranyitása

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Könyvjelzők
    .accesskey = K
menu-bookmarks-manage =
    .label = Könyvjelzők kezelése
menu-bookmark-current-tab =
    .label = Jelenlegi lap könyvjelzőzése
menu-bookmark-edit =
    .label = Könyvjelző szerkesztése
menu-bookmark-tab =
    .label = Jelenlegi lap könyvjelzőzése…
menu-edit-bookmark =
    .label = Könyvjelző szerkesztése…
menu-bookmarks-all-tabs =
    .label = Minden lap egy könyvjelzőbe…
menu-bookmarks-toolbar =
    .label = Könyvjelző eszköztár
menu-bookmarks-other =
    .label = Más könyvjelzők
menu-bookmarks-mobile =
    .label = Mobil könyvjelzők

## Tools Menu

menu-tools =
    .label = Eszközök
    .accesskey = E
menu-tools-downloads =
    .label = Letöltések
    .accesskey = L
menu-tools-addons-and-themes =
    .label = Kiegészítők és témák
    .accesskey = K
menu-tools-fxa-sign-in2 =
    .label = Bejelentkezés
    .accesskey = j
menu-tools-turn-on-sync2 =
    .label = Szinkronizálás bekapcsolása…
    .accesskey = b
menu-tools-sync-now =
    .label = Szinkronizálás
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Újrakapcsolódás a { -brand-product-name }hoz…
    .accesskey = j
menu-tools-browser-tools =
    .label = Böngészőeszközök
    .accesskey = B
menu-tools-task-manager =
    .label = Feladatkezelő
    .accesskey = F
menu-tools-page-source =
    .label = Oldal forrása
    .accesskey = r
menu-tools-page-info =
    .label = Oldal adatai
    .accesskey = O
menu-settings =
    .label = Beállítások
    .accesskey =
        { PLATFORM() ->
            [windows] B
           *[other] B
        }
menu-tools-layout-debugger =
    .label = Elrendezési hibakereső
    .accesskey = E

## Window Menu

menu-window-menu =
    .label = Ablak
menu-window-bring-all-to-front =
    .label = Előtérbe hozás

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Súgó
    .accesskey = S
menu-get-help =
    .label = Segítség kérése
    .accesskey = S
menu-help-more-troubleshooting-info =
    .label = Több hibakeresési információ
    .accesskey = T
menu-help-report-site-issue =
    .label = Hibás webhely bejelentése…
menu-help-share-ideas =
    .label = Ötletek és visszajelzések megosztása…
    .accesskey = o
menu-help-enter-troubleshoot-mode2 =
    .label = Hibaelhárítási mód…
    .accesskey = m
menu-help-exit-troubleshoot-mode =
    .label = Hibakeresési mód bekapcsolása
    .accesskey = b
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Félrevezető oldal jelentése…
    .accesskey = F
menu-help-not-deceptive =
    .label = Ez nem félrevezető oldal…
    .accesskey = n
