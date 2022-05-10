# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Skrá
    .accesskey = S
menu-file-new-tab =
    .label = Nýr flipi
    .accesskey = f
menu-file-new-container-tab =
    .label = Nýr hópaflipi
    .accesskey = h
menu-file-new-window =
    .label = Nýr gluggi
    .accesskey = N
menu-file-new-private-window =
    .label = Nýr huliðsgluggi
    .accesskey = g
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Opna tengil…
menu-file-open-file =
    .label = Opna skrá…
    .accesskey = O
menu-file-close =
    .label = Loka
    .accesskey = L
menu-file-close-window =
    .label = Loka glugga
    .accesskey = k
menu-file-save-page =
    .label = Vista síðu sem…
    .accesskey = V
menu-file-email-link =
    .label = Senda tengil…
    .accesskey = e
menu-file-print-setup =
    .label = Uppsetning síðu…
    .accesskey = U
menu-file-print-preview =
    .label = Prentskoðun
    .accesskey = r
menu-file-print =
    .label = Prenta…
    .accesskey = P
menu-file-import-from-another-browser =
    .label = Flytja inn gögn frá öðrum vafa…
    .accesskey = I
menu-file-go-offline =
    .label = Vinna án nettengingar
    .accesskey = g

## Edit Menu

menu-edit =
    .label = Breyta
    .accesskey = e
menu-edit-find-on =
    .label = Leita á síðu…
    .accesskey = t
menu-edit-find-again =
    .label = Leita aftur
    .accesskey = u
menu-edit-bidi-switch-text-direction =
    .label = Skipta um texta átt
    .accesskey = t

## View Menu

menu-view =
    .label = Skoða
    .accesskey = k
menu-view-toolbars-menu =
    .label = Verkfæraslár
    .accesskey = V
menu-view-customize-toolbar =
    .label = Sérsníða…
    .accesskey = S
menu-view-sidebar =
    .label = Hliðslá
    .accesskey = H
menu-view-bookmarks =
    .label = Bókamerki
menu-view-history-button =
    .label = Ferill
menu-view-synced-tabs-sidebar =
    .label = Samstilltir flipar
menu-view-full-zoom =
    .label = Aðdráttur
    .accesskey = ð
menu-view-full-zoom-enlarge =
    .label = Stækka
    .accesskey = S
menu-view-full-zoom-reduce =
    .label = Minnka
    .accesskey = M
menu-view-full-zoom-toggle =
    .label = Stækka/minnka einungis texta
    .accesskey = t
menu-view-page-style-menu =
    .label = Síðustíll
    .accesskey = u
menu-view-page-style-no-style =
    .label = Enginn stíll
    .accesskey = E
menu-view-page-basic-style =
    .label = Almennur síðustíll
    .accesskey = A
menu-view-charset =
    .label = Stafatafla
    .accesskey = f

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Fara í fullan skjá
    .accesskey = F
menu-view-exit-full-screen =
    .label = Hætta í fullum skjá
    .accesskey = f
menu-view-full-screen =
    .label = Fylla skjá
    .accesskey = y

##

menu-view-show-all-tabs =
    .label = Sýna alla flipa
    .accesskey = a
menu-view-bidi-switch-page-direction =
    .label = Skipta um síðu átt
    .accesskey = s

## History Menu

menu-history =
    .label = Ferill
    .accesskey = F
menu-history-show-all-history =
    .label = Skoða alla ferla
menu-history-clear-recent-history =
    .label = Hreinsa nýlega ferla…
menu-history-synced-tabs =
    .label = Samstilltir flipar
menu-history-restore-last-session =
    .label = Sækja fyrri vafralotu
menu-history-hidden-tabs =
    .label = Faldir flipar
menu-history-undo-menu =
    .label = Nýlega lokaðir flipar
menu-history-undo-window-menu =
    .label = Nýlega lokaðir gluggar

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Bókamerki
    .accesskey = B
menu-bookmarks-show-all =
    .label = Sýna öll bókamerki
menu-bookmark-this-page =
    .label = Setja síðu í bókamerki
menu-bookmark-edit =
    .label = Breyta bókamerki
menu-bookmarks-all-tabs =
    .label = Setja alla flipa í bókamerki…
menu-bookmarks-toolbar =
    .label = Bókamerkjaslá
menu-bookmarks-other =
    .label = Önnur bókamerki
menu-bookmarks-mobile =
    .label = Bókamerki farsíma

## Tools Menu

menu-tools =
    .label = Verkfæri
    .accesskey = V
menu-tools-downloads =
    .label = Niðurhal
    .accesskey = N
menu-tools-addons =
    .label = Viðbætur
    .accesskey = i
menu-tools-sync-now =
    .label = Samstilla núna
    .accesskey = S
menu-tools-web-developer =
    .label = Vefforritari
    .accesskey = f
menu-tools-page-source =
    .label = Frumkóði síðu
    .accesskey = k
menu-tools-page-info =
    .label = Upplýsingar síðu
    .accesskey = U
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Valkostir
           *[other] Valkostir
        }
    .accesskey =
        { PLATFORM() ->
            [windows] V
           *[other] V
        }
menu-tools-layout-debugger =
    .label = Útlits aflúsari
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = Gluggi
menu-window-bring-all-to-front =
    .label = Endurheimta

## Help Menu

menu-help =
    .label = Hjálp
    .accesskey = H
menu-help-product =
    .label = { -brand-shorter-name } Hjálp
    .accesskey = H
menu-help-show-tour =
    .label = { -brand-shorter-name } Skoðunarferð
    .accesskey = o
menu-help-keyboard-shortcuts =
    .label = Flýtilyklar
    .accesskey = k
menu-help-troubleshooting-info =
    .label = Upplýsingar fyrir úrræðaleit
    .accesskey = t
menu-help-feedback-page =
    .label = Senda álit…
    .accesskey = S
menu-help-safe-mode-without-addons =
    .label = Endurræsa með viðbætur óvirkar…
    .accesskey = r
menu-help-safe-mode-with-addons =
    .label = Endurræsa með viðbætur virkar
    .accesskey = r
# Label of the Help menu item. Either this or
# safeb.palm.notdeceptive.label from
# phishing-afterload-warning-message.dtd is shown.
menu-help-report-deceptive-site =
    .label = Tilkynna svindlsvæði…
    .accesskey = d
menu-help-not-deceptive =
    .label = Þetta er ekki svindlsvæði…
    .accesskey = d
