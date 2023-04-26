# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Gwellvezioù
menu-application-services =
    .label = Gwazerezhioù
menu-application-hide-this =
    .label = Kuzhat { -brand-shorter-name }
menu-application-hide-other =
    .label = Kuzhat ar re all
menu-application-show-all =
    .label = Diskouez pep tra
menu-application-touch-bar =
    .label = Personelaat ar varrenn-stok…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Kuitaat
           *[other] Kuitaat
        }
    .accesskey =
        { PLATFORM() ->
            [windows] K
           *[other] K
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Kuitaat { -brand-shorter-name }
menu-about =
    .label = A-zivout { -brand-shorter-name }
    .accesskey = A

## File Menu

menu-file =
    .label = Restr
    .accesskey = R
menu-file-new-tab =
    .label = Ivinell nevez
    .accesskey = I
menu-file-new-container-tab =
    .label = Ivinell endalc'her nevez
    .accesskey = e
menu-file-new-window =
    .label = Prenestr nevez
    .accesskey = n
menu-file-new-private-window =
    .label = Prenestr merdeiñ prevez nevez
    .accesskey = v
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Digeriñ ul lec'hiadur…
menu-file-open-file =
    .label = Digeriñ ur restr…
    .accesskey = D
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Serriñ an ivinell
            [one] Serriñ { $tabCount } ivinell
            [two] Serriñ { $tabCount } ivinell
            [few] Serriñ { $tabCount } ivinell
            [many] Serriñ { $tabCount } a ivinelloù
           *[other] Serriñ { $tabCount } ivinell
        }
    .accesskey = S
menu-file-close-window =
    .label = Serriñ ar prenestr
    .accesskey = r
menu-file-save-page =
    .label = Enrollañ ar bajenn evel…
    .accesskey = a
menu-file-email-link =
    .label = Kas an ere dre bostel…
    .accesskey = K
menu-file-share-url =
    .label = Rannañ
    .accesskey = R
menu-file-print-setup =
    .label = Arventennoù ar bajenn…
    .accesskey = A
menu-file-print =
    .label = Moullañ…
    .accesskey = M
menu-file-import-from-another-browser =
    .label = Enporzhiañ eus ur merdeer all...
    .accesskey = E
menu-file-go-offline =
    .label = Labourat ezlinenn
    .accesskey = z

## Edit Menu

menu-edit =
    .label = Embann
    .accesskey = E
menu-edit-find-in-page =
    .label = Kavout er bajennad…
    .accesskey = K
menu-edit-find-again =
    .label = Klask c'hoazh
    .accesskey = h
menu-edit-bidi-switch-text-direction =
    .label = Kemmañ tuadur an destenn
    .accesskey = d

## View Menu

menu-view =
    .label = Gwelout
    .accesskey = w
menu-view-toolbars-menu =
    .label = Barrennoù ostilhoù
    .accesskey = B
menu-view-customize-toolbar2 =
    .label = Personelaat ar varrenn ostilhoù…
    .accesskey = P
menu-view-sidebar =
    .label = Barrenn gostez
    .accesskey = g
menu-view-bookmarks =
    .label = Sinedoù
menu-view-history-button =
    .label = Roll istor
menu-view-synced-tabs-sidebar =
    .label = Ivinelloù goubredet
menu-view-full-zoom =
    .label = Zoum
    .accesskey = Z
menu-view-full-zoom-enlarge =
    .label = Zoum brasaat
    .accesskey = b
menu-view-full-zoom-reduce =
    .label = Zoum bihanaat
    .accesskey = o
menu-view-full-zoom-actual-size =
    .label = Ment vremanel
    .accesskey = M
menu-view-full-zoom-toggle =
    .label = Zoumañ war an destenn hepken
    .accesskey = t
menu-view-page-style-menu =
    .label = Stil ar bajennad
    .accesskey = S
menu-view-page-style-no-style =
    .label = Stil ebet
    .accesskey = b
menu-view-page-basic-style =
    .label = Stil pajennad eeun
    .accesskey = e
menu-view-repair-text-encoding =
    .label = Ratreañ enkodadur an destenn
    .accesskey = k

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Kregiñ ar mod skramm a-bezh
    .accesskey = s
menu-view-exit-full-screen =
    .label = Kuitaat ar mod skramm a-bezh
    .accesskey = s
menu-view-full-screen =
    .label = Skramm a-bezh
    .accesskey = S

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Mont er mod lenn
    .accesskey = L
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Serriñ ar mod lenn
    .accesskey = L

##

menu-view-show-all-tabs =
    .label = Diskouez an holl ivinelloù
    .accesskey = a
menu-view-bidi-switch-page-direction =
    .label = Kemmañ tu ar bajenn
    .accesskey = b

## History Menu

menu-history =
    .label = Roll istor
    .accesskey = l
menu-history-show-all-history =
    .label = Diskouez ar roll istor a-bezh
menu-history-clear-recent-history =
    .label = Skarzhañ ar roll istor nevesañ…
menu-history-synced-tabs =
    .label = Ivinelloù goubredet
menu-history-restore-last-session =
    .label = Assav an estez kent
menu-history-hidden-tabs =
    .label = Ivinell kuzh
menu-history-undo-menu =
    .label = Ivinelloù serret nevez zo
menu-history-undo-window-menu =
    .label = Prenestroù serret nevez zo
menu-history-reopen-all-tabs = Digeriñ en-dro an holl ivinelloù
menu-history-reopen-all-windows = Digeriñ en-dro an holl brenestroù

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Sinedoù
    .accesskey = n
menu-bookmarks-manage =
    .label = Merañ ar sinedoù
menu-bookmark-current-tab =
    .label = Lakaat an ivinell vremanel er sinedoù
menu-bookmark-edit =
    .label = Embann ar sined-mañ
menu-bookmark-tab =
    .label = Lakaat an ivinell a-vremañ er sinedoù…
menu-edit-bookmark =
    .label = Embann ar sined-mañ…
menu-bookmarks-all-tabs =
    .label = Ouzhpennañ an holl ivinelloù d'ar sinedoù
menu-bookmarks-toolbar =
    .label = Barrenn ostilhoù ar sinedoù
menu-bookmarks-other =
    .label = Sinedoù all
menu-bookmarks-mobile =
    .label = Sinedoù hezoug

## Tools Menu

menu-tools =
    .label = Ostilhoù
    .accesskey = O
menu-tools-downloads =
    .label = Pellgargadurioù
    .accesskey = d
menu-tools-addons-and-themes =
    .label = Askouezhioù ha neuzioù
    .accesskey = E
menu-tools-fxa-sign-in2 =
    .label = Kennaskañ
    .accesskey = K
menu-tools-turn-on-sync2 =
    .label = Gweredekaat Sync
    .accesskey = n
menu-tools-sync-now =
    .label = Goubredañ bremañ
    .accesskey = G
menu-tools-fxa-re-auth =
    .label = Adkennaskañ ouzh { -brand-product-name }
    .accesskey = A
menu-tools-browser-tools =
    .label = Ostilhoù merdeer
    .accesskey = O
menu-tools-task-manager =
    .label = Ardoer trevelloù
    .accesskey = A
menu-tools-page-source =
    .label = Tarzh ar bajennad
    .accesskey = b
menu-tools-page-info =
    .label = Stlennoù ar bajennad
    .accesskey = t
menu-settings =
    .label = Arventennoù
    .accesskey =
        { PLATFORM() ->
            [windows] A
           *[other] A
        }
menu-tools-layout-debugger =
    .label = Diveuger ar pajennaozañ
    .accesskey = D

## Window Menu

menu-window-menu =
    .label = Prenestr
menu-window-bring-all-to-front =
    .label = Lakaat pep tra war ar rakleur

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Skoazell
    .accesskey = S
menu-get-help =
    .label = Kaout skoazell
    .accesskey = K
menu-help-more-troubleshooting-info =
    .label = Muioc'h a ditouroù disac’hañ
    .accesskey = M
menu-help-report-site-issue =
    .label = Danevell kudennoù al lec'hienn…
menu-help-share-ideas =
    .label = Kinnig mennozhioù hag alioù...
    .accesskey = K
menu-help-enter-troubleshoot-mode2 =
    .label = Mod disac’hañ
    .accesskey = M
menu-help-exit-troubleshoot-mode =
    .label = Diweredekaat ar mod disac’hañ
    .accesskey = D
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Danevelliñ al lec'hienn dagus…
    .accesskey = d
menu-help-not-deceptive =
    .label = N'eo ket ul lec’hienn dagus…
    .accesskey = d
