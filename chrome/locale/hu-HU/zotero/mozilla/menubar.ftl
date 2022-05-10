# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


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
menu-file-close =
    .label = Bezárás
    .accesskey = B
menu-file-close-window =
    .label = Ablak bezárása
    .accesskey = A
menu-file-save-page =
    .label = Oldal mentése…
    .accesskey = m
menu-file-email-link =
    .label = Hivatkozás küldése e-mailben…
    .accesskey = d
menu-file-print-setup =
    .label = Oldalbeállítás…
    .accesskey = O
menu-file-print-preview =
    .label = Nyomtatási kép
    .accesskey = t
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
menu-edit-find-on =
    .label = Keresés ezen az oldalon…
    .accesskey = e
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
menu-view-customize-toolbar =
    .label = Testreszabás…
    .accesskey = T
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
menu-view-charset =
    .label = Szövegkódolás
    .accesskey = d

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

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Könyvjelzők
    .accesskey = K
menu-bookmarks-show-all =
    .label = Minden könyvjelző megjelenítése
menu-bookmark-this-page =
    .label = Oldal hozzáadása a könyvjelzőkhöz
menu-bookmark-edit =
    .label = Könyvjelző szerkesztése
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
menu-tools-addons =
    .label = Kiegészítők
    .accesskey = t
menu-tools-fxa-sign-in =
    .label = Bejelentkezés a { -brand-product-name }ba…
    .accesskey = B
menu-tools-turn-on-sync =
    .label = { -sync-brand-short-name } bekapcsolása…
    .accesskey = b
menu-tools-sync-now =
    .label = Szinkronizálás
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Újrakapcsolódás a { -brand-product-name }hoz…
    .accesskey = j
menu-tools-web-developer =
    .label = Webfejlesztő
    .accesskey = W
menu-tools-page-source =
    .label = Oldal forrása
    .accesskey = r
menu-tools-page-info =
    .label = Oldal adatai
    .accesskey = O
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Beállítások
           *[other] Beállítások
        }
    .accesskey =
        { PLATFORM() ->
            [windows] e
           *[other] e
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

menu-help =
    .label = Súgó
    .accesskey = S
menu-help-product =
    .label = { -brand-shorter-name } súgó
    .accesskey = s
menu-help-show-tour =
    .label = { -brand-shorter-name } bemutató
    .accesskey = u
menu-help-import-from-another-browser =
    .label = Importálás egy másik böngészőből…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Gyorsbillentyűk
    .accesskey = G
menu-help-troubleshooting-info =
    .label = Hibakeresési információ
    .accesskey = H
menu-help-feedback-page =
    .label = Visszajelzés beküldése…
    .accesskey = V
menu-help-safe-mode-without-addons =
    .label = Újraindítás letiltott kiegészítőkkel…
    .accesskey = r
menu-help-safe-mode-with-addons =
    .label = Újraindítás engedélyezett kiegészítőkkel
    .accesskey = r
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Félrevezető oldal jelentése…
    .accesskey = F
menu-help-not-deceptive =
    .label = Ez nem félrevezető oldal…
    .accesskey = n
