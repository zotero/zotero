# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Hobespenak
menu-application-services =
    .label = Zerbitzuak
menu-application-hide-this =
    .label = Ezkutatu { -brand-shorter-name }
menu-application-hide-other =
    .label = Ezkutatu besteak
menu-application-show-all =
    .label = Erakutsi denak
menu-application-touch-bar =
    .label = Pertsonalizatu Touch Bar-a…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Irten
           *[other] Irten
        }
    .accesskey =
        { PLATFORM() ->
            [windows] I
           *[other] I
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Irten { -brand-shorter-name }(e)tik
menu-about =
    .label = { -brand-shorter-name }(r)i buruz
    .accesskey = b

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
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Itxi fitxa
           *[other] Itxi { $tabCount } fitxa
        }
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
menu-file-share-url =
    .label = Partekatu
    .accesskey = P
menu-file-print-setup =
    .label = Prestatu orria…
    .accesskey = u
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
menu-edit-find-in-page =
    .label = Bilatu orrian…
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
menu-view-customize-toolbar2 =
    .label = Pertsonalizatu tresna-barra…
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
menu-view-repair-text-encoding =
    .label = Konpondu testu-kodeketa
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

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Sartu irakurtzeko ikuspegian
    .accesskey = i
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Irten irakurtzeko ikuspegitik
    .accesskey = I

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
menu-history-reopen-all-tabs = Ireki berriro fitxa guztiak
menu-history-reopen-all-windows = Ireki berriro leiho guztiak

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Laster-markak
    .accesskey = m
menu-bookmarks-manage =
    .label = Kudeatu laster-markak
menu-bookmark-current-tab =
    .label = Egin uneko fitxaren laster-marka
menu-bookmark-edit =
    .label = Editatu laster-marka
menu-bookmark-tab =
    .label = Egin uneko fitxaren laster-marka…
menu-edit-bookmark =
    .label = Editatu laster-marka…
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
menu-tools-addons-and-themes =
    .label = Gehigarriak eta itxurak
    .accesskey = G
menu-tools-fxa-sign-in2 =
    .label = Hasi saioa
    .accesskey = H
menu-tools-turn-on-sync2 =
    .label = Gaitu sinkronizazioa…
    .accesskey = G
menu-tools-sync-now =
    .label = Sinkronizatu orain
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Birkonektatu { -brand-product-name }(e)ra…
    .accesskey = B
menu-tools-browser-tools =
    .label = Nabigatzailearen tresnak
    .accesskey = b
menu-tools-task-manager =
    .label = Ataza-kudeatzailea
    .accesskey = k
menu-tools-page-source =
    .label = Orriaren iturburua
    .accesskey = O
menu-tools-page-info =
    .label = Orriaren informazioa
    .accesskey = i
menu-settings =
    .label = Ezarpenak
    .accesskey =
        { PLATFORM() ->
            [windows] E
           *[other] E
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


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Laguntza
    .accesskey = L
menu-get-help =
    .label = Lortu laguntza
    .accesskey = L
menu-help-more-troubleshooting-info =
    .label = Arazoak konpontzeko informazio gehiago
    .accesskey = f
menu-help-report-site-issue =
    .label = Eman gunearen arazoaren berri…
menu-help-share-ideas =
    .label = Partekatu ideiak eta iritzia…
    .accesskey = P
menu-help-enter-troubleshoot-mode2 =
    .label = Arazoak konpontzeko modua…
    .accesskey = m
menu-help-exit-troubleshoot-mode =
    .label = Desaktibatu arazoak konpontzeko modua
    .accesskey = s
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Eman gune iruzurtiaren berri…
    .accesskey = i
menu-help-not-deceptive =
    .label = Hau ez da gune iruzurtia…
    .accesskey = i
