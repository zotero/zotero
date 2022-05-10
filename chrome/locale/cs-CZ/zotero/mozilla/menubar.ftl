# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Soubor
    .accesskey = S
menu-file-new-tab =
    .label = Nový panel
    .accesskey = p
menu-file-new-container-tab =
    .label = Nový kontejnerový panel
    .accesskey = j
menu-file-new-window =
    .label = Nové okno
    .accesskey = N
menu-file-new-private-window =
    .label = Nové anonymní okno
    .accesskey = a
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Otevřít umístění…
menu-file-open-file =
    .label = Otevřít soubor…
    .accesskey = s
menu-file-close =
    .label = Zavřít
    .accesskey = Z
menu-file-close-window =
    .label = Zavřít okno
    .accesskey = v
menu-file-save-page =
    .label = Uložit stránku jako…
    .accesskey = U
menu-file-email-link =
    .label = Poslat odkaz e-mailem…
    .accesskey = e
menu-file-print-setup =
    .label = Vzhled stránky…
    .accesskey = V
menu-file-print-preview =
    .label = Náhled tisku
    .accesskey = h
menu-file-print =
    .label = Vytisknout stránku…
    .accesskey = T
menu-file-import-from-another-browser =
    .label = Importovat z jiného prohlížeče…
    .accesskey = m
menu-file-go-offline =
    .label = Pracovat offline
    .accesskey = l

## Edit Menu

menu-edit =
    .label = Úpravy
    .accesskey = a
menu-edit-find-on =
    .label = Najít na této stránce…
    .accesskey = N
menu-edit-find-again =
    .label = Najít další
    .accesskey = t
menu-edit-bidi-switch-text-direction =
    .label = Změnit směr textu
    .accesskey = r

## View Menu

menu-view =
    .label = Zobrazit
    .accesskey = Z
menu-view-toolbars-menu =
    .label = Nástrojové lišty
    .accesskey = N
menu-view-customize-toolbar =
    .label = Nastavení tlačítek a lišt…
    .accesskey = V
menu-view-sidebar =
    .label = Postranní lišta
    .accesskey = P
menu-view-bookmarks =
    .label = Záložky
menu-view-history-button =
    .label = Historie
menu-view-synced-tabs-sidebar =
    .label = Synchronizované panely
menu-view-full-zoom =
    .label = Velikost stránky
    .accesskey = V
menu-view-full-zoom-enlarge =
    .label = Zvětšit
    .accesskey = v
menu-view-full-zoom-reduce =
    .label = Zmenšit
    .accesskey = m
menu-view-full-zoom-actual-size =
    .label = Skutečná velikost
    .accesskey = k
menu-view-full-zoom-toggle =
    .label = Pouze velikost textu
    .accesskey = t
menu-view-page-style-menu =
    .label = Styl stránky
    .accesskey = y
menu-view-page-style-no-style =
    .label = Bez stylu
    .accesskey = B
menu-view-page-basic-style =
    .label = Základní styl
    .accesskey = Z
menu-view-charset =
    .label = Znaková sada textu
    .accesskey = k

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Spustit režim celé obrazovky
    .accesskey = r
menu-view-exit-full-screen =
    .label = Ukončit režim celé obrazovky
    .accesskey = r
menu-view-full-screen =
    .label = Celá obrazovka
    .accesskey = C

##

menu-view-show-all-tabs =
    .label = Zobrazit všechny panely
    .accesskey = b
menu-view-bidi-switch-page-direction =
    .label = Změnit orientaci stránky
    .accesskey = o

## History Menu

menu-history =
    .label = Historie
    .accesskey = H
menu-history-show-all-history =
    .label = Zobrazit celou historii
menu-history-clear-recent-history =
    .label = Vymazat nedávnou historii…
menu-history-synced-tabs =
    .label = Synchronizované panely
menu-history-restore-last-session =
    .label = Obnovit předchozí relaci
menu-history-hidden-tabs =
    .label = Skryté panely
menu-history-undo-menu =
    .label = Naposledy zavřené panely
menu-history-undo-window-menu =
    .label = Naposledy zavřená okna

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Záložky
    .accesskey = o
menu-bookmarks-show-all =
    .label = Zobrazit všechny záložky
menu-bookmark-this-page =
    .label = Přidat stránku do záložek
menu-bookmark-edit =
    .label = Upravit záložku
menu-bookmarks-all-tabs =
    .label = Přidat všechny panely do záložek…
menu-bookmarks-toolbar =
    .label = Lišta záložek
menu-bookmarks-other =
    .label = Ostatní záložky
menu-bookmarks-mobile =
    .label = Záložky z mobilu

## Tools Menu

menu-tools =
    .label = Nástroje
    .accesskey = N
menu-tools-downloads =
    .label = Stahování
    .accesskey = t
menu-tools-addons =
    .label = Doplňky
    .accesskey = D
menu-tools-fxa-sign-in =
    .label =
        Přihlásit se k { -brand-product-name.gender ->
            [masculine] { -brand-product-name(case: "dat") }
            [feminine] { -brand-product-name(case: "dat") }
            [neuter] { -brand-product-name(case: "dat") }
           *[other] aplikaci { -brand-product-name }
        }…
    .accesskey = p
menu-tools-turn-on-sync =
    .label = Zapnout { -sync-brand-short-name(case: "acc") }…
    .accesskey = n
menu-tools-sync-now =
    .label = Synchronizovat
    .accesskey = S
menu-tools-fxa-re-auth =
    .label =
        Znovu připojit k účtu { -brand-product-name.gender ->
            [masculine] { -brand-product-name(case: "gen") }
            [feminine] { -brand-product-name(case: "gen") }
            [neuter] { -brand-product-name(case: "gen") }
           *[other] aplikace { -brand-product-name }
        }…
    .accesskey = n
menu-tools-web-developer =
    .label = Nástroje pro vývojáře
    .accesskey = v
menu-tools-page-source =
    .label = Zdrojový kód stránky
    .accesskey = j
menu-tools-page-info =
    .label = Informace o stránce
    .accesskey = I
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Možnosti
           *[other] Předvolby
        }
    .accesskey =
        { PLATFORM() ->
            [windows] M
           *[other] v
        }
menu-tools-layout-debugger =
    .label = Debugger rozložení
    .accesskey = l

## Window Menu

menu-window-menu =
    .label = Okno
menu-window-bring-all-to-front =
    .label = Přenést vše do popředí

## Help Menu

menu-help =
    .label = Nápověda
    .accesskey = v
menu-help-product =
    .label =
        Nápověda { -brand-shorter-name.gender ->
            [masculine] { -brand-shorter-name(case: "gen") }
            [feminine] { -brand-shorter-name(case: "gen") }
            [neuter] { -brand-shorter-name(case: "gen") }
           *[other] aplikace { -brand-shorter-name }
        }
    .accesskey = N
menu-help-show-tour =
    .label =
        Průvodce { -brand-shorter-name.gender ->
            [masculine] { -brand-shorter-name(case: "ins") }
            [feminine] { -brand-shorter-name(case: "ins") }
            [neuter] { -brand-shorter-name(case: "ins") }
           *[other] aplikací { -brand-shorter-name }
        }
    .accesskey = P
menu-help-import-from-another-browser =
    .label = Importovat z jiného prohlížeče…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Klávesové zkratky
    .accesskey = K
menu-help-troubleshooting-info =
    .label = Technické informace
    .accesskey = T
menu-help-feedback-page =
    .label = Odeslat zpětnou vazbu…
    .accesskey = d
menu-help-safe-mode-without-addons =
    .label = Restartovat se zakázanými doplňky…
    .accesskey = R
menu-help-safe-mode-with-addons =
    .label = Restartovat s povolenými doplňky
    .accesskey = R
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Nahlásit klamavou stránku…
    .accesskey = l
menu-help-not-deceptive =
    .label = Tato stránka není klamavá…
    .accesskey = l
