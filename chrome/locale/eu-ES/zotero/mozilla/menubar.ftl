# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Fitxategia
    .accesskey = F
menu-file-new-tab =
    .label = Fitxa berria
    .accesskey = t
menu-file-new-container-tab =
    .label = Edukiontzi-fitxa berria
    .accesskey = E
menu-file-new-window =
    .label = Leiho berria
    .accesskey = L
menu-file-new-private-window =
    .label = Leiho pribatu berria
    .accesskey = h
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Ireki helbidea…
menu-file-open-file =
    .label = Ireki fitxategia…
    .accesskey = f
menu-file-close =
    .label = Itxi
    .accesskey = x
menu-file-close-window =
    .label = Itxi leihoa
    .accesskey = h
menu-file-save-page =
    .label = Gorde orria honela…
    .accesskey = a
menu-file-email-link =
    .label = Bidali lotura postaz…
    .accesskey = s
menu-file-print-setup =
    .label = Prestatu orria…
    .accesskey = u
menu-file-print-preview =
    .label = Inprimatzeko aurrebista
    .accesskey = n
menu-file-print =
    .label = Inprimatu…
    .accesskey = p
menu-file-import-from-another-browser =
    .label = Inportatu beste nabigatzaile batetik…
    .accesskey = I
menu-file-go-offline =
    .label = Lan egin lineaz kanpo
    .accesskey = o

## Edit Menu

menu-edit =
    .label = Editatu
    .accesskey = E
menu-edit-find-on =
    .label = Bilatu orri honetan…
    .accesskey = B
menu-edit-find-again =
    .label = Bilatu berriro
    .accesskey = r
menu-edit-bidi-switch-text-direction =
    .label = Aldatu testuaren norabidea
    .accesskey = t

## View Menu

menu-view =
    .label = Ikusi
    .accesskey = I
menu-view-toolbars-menu =
    .label = Tresna-barrak
    .accesskey = T
menu-view-customize-toolbar =
    .label = Pertsonalizatu…
    .accesskey = P
menu-view-sidebar =
    .label = Alboko barra
    .accesskey = A
menu-view-bookmarks =
    .label = Laster-markak
menu-view-history-button =
    .label = Historia
menu-view-synced-tabs-sidebar =
    .label = Sinkronizatutako fitxak
menu-view-full-zoom =
    .label = Zooma
    .accesskey = Z
menu-view-full-zoom-enlarge =
    .label = Gerturatu
    .accesskey = G
menu-view-full-zoom-reduce =
    .label = Urrundu
    .accesskey = U
menu-view-full-zoom-actual-size =
    .label = Benetako tamaina
    .accesskey = B
menu-view-full-zoom-toggle =
    .label = Testua soilik
    .accesskey = T
menu-view-page-style-menu =
    .label = Orriaren estiloa
    .accesskey = e
menu-view-page-style-no-style =
    .label = Estilorik gabe
    .accesskey = E
menu-view-page-basic-style =
    .label = Oinarrizko orri-estiloa
    .accesskey = O
menu-view-charset =
    .label = Testuaren kodeketa
    .accesskey = k

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Sartu pantaila osoan
    .accesskey = o
menu-view-exit-full-screen =
    .label = Irten pantaila osotik
    .accesskey = p
menu-view-full-screen =
    .label = Pantaila osoa
    .accesskey = P

##

menu-view-show-all-tabs =
    .label = Erakutsi fitxa guztiak
    .accesskey = z
menu-view-bidi-switch-page-direction =
    .label = Aldatu orriaren norabidea
    .accesskey = n

## History Menu

menu-history =
    .label = Historia
    .accesskey = H
menu-history-show-all-history =
    .label = Erakutsi historia guztia
menu-history-clear-recent-history =
    .label = Garbitu azken historia…
menu-history-synced-tabs =
    .label = Sinkronizatutako fitxak
menu-history-restore-last-session =
    .label = Berreskuratu aurreko saioa
menu-history-hidden-tabs =
    .label = Ezkutatutako fitxak
menu-history-undo-menu =
    .label = Itxitako azken fitxak
menu-history-undo-window-menu =
    .label = Itxitako azken leihoak

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Laster-markak
    .accesskey = m
menu-bookmarks-show-all =
    .label = Erakutsi laster-marka guztiak
menu-bookmark-this-page =
    .label = Egin orriaren laster-marka
menu-bookmark-edit =
    .label = Editatu laster-marka
menu-bookmarks-all-tabs =
    .label = Egin fitxa guztien laster-marka…
menu-bookmarks-toolbar =
    .label = Laster-marken tresna-barra
menu-bookmarks-other =
    .label = Beste laster-markak
menu-bookmarks-mobile =
    .label = Mugikorreko laster-markak

## Tools Menu

menu-tools =
    .label = Tresnak
    .accesskey = T
menu-tools-downloads =
    .label = Deskargak
    .accesskey = D
menu-tools-addons =
    .label = Gehigarriak
    .accesskey = G
menu-tools-fxa-sign-in =
    .label = Hasi saioa { -brand-product-name }(e)n…
    .accesskey = H
menu-tools-turn-on-sync =
    .label = Aktibatu { -sync-brand-short-name }…
    .accesskey = A
menu-tools-sync-now =
    .label = Sinkronizatu orain
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Birkonektatu { -brand-product-name }(e)ra…
    .accesskey = B
menu-tools-web-developer =
    .label = Web garapena
    .accesskey = W
menu-tools-page-source =
    .label = Orriaren iturburua
    .accesskey = O
menu-tools-page-info =
    .label = Orriaren informazioa
    .accesskey = i
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Aukerak
           *[other] Hobespenak
        }
    .accesskey =
        { PLATFORM() ->
            [windows] A
           *[other] n
        }
menu-tools-layout-debugger =
    .label = Diseinuaren araztailea
    .accesskey = D

## Window Menu

menu-window-menu =
    .label = Leihoa
menu-window-bring-all-to-front =
    .label = Ekarri dena aurrera

## Help Menu

menu-help =
    .label = Laguntza
    .accesskey = L
menu-help-product =
    .label = { -brand-shorter-name }(r)en laguntza
    .accesskey = l
menu-help-show-tour =
    .label = { -brand-shorter-name }(r)en itzulia
    .accesskey = u
menu-help-import-from-another-browser =
    .label = Inportatu beste nabigatzaile batetik…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Laster-teklak
    .accesskey = s
menu-help-troubleshooting-info =
    .label = Arazoak konpontzeko informazioa…
    .accesskey = A
menu-help-feedback-page =
    .label = Bidali iritzia…
    .accesskey = d
menu-help-safe-mode-without-addons =
    .label = Berrabiarazi gehigarriak desgaituta…
    .accesskey = r
menu-help-safe-mode-with-addons =
    .label = Berrabiarazi gehigarriak gaituta
    .accesskey = r
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Eman gune iruzurtiaren berri…
    .accesskey = i
menu-help-not-deceptive =
    .label = Hau ez da gune iruzurtia…
    .accesskey = i
