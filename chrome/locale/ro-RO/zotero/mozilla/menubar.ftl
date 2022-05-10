# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Fișier
    .accesskey = F
menu-file-new-tab =
    .label = Filă nouă
    .accesskey = T
menu-file-new-container-tab =
    .label = Filă container nouă
    .accesskey = B
menu-file-new-window =
    .label = Fereastră nouă
    .accesskey = N
menu-file-new-private-window =
    .label = Fereastră privată nouă
    .accesskey = W
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Deschide locația…
menu-file-open-file =
    .label = Deschide un fișier…
    .accesskey = O
menu-file-close =
    .label = Închide
    .accesskey = C
menu-file-close-window =
    .label = Închide fereastra
    .accesskey = d
menu-file-save-page =
    .label = Salvează pagina ca…
    .accesskey = A
menu-file-email-link =
    .label = Trimite linkul prin e-mail…
    .accesskey = E
menu-file-print-setup =
    .label = Aranjare în pagină…
    .accesskey = u
menu-file-print-preview =
    .label = Previzualizează pentru tipărire
    .accesskey = v
menu-file-print =
    .label = Tipărește…
    .accesskey = P
menu-file-import-from-another-browser =
    .label = Importă din alt browser…
    .accesskey = I
menu-file-go-offline =
    .label = Lucrează offline
    .accesskey = k

## Edit Menu

menu-edit =
    .label = Editare
    .accesskey = E
menu-edit-find-on =
    .label = Caută în pagină…
    .accesskey = F
menu-edit-find-again =
    .label = Caută din nou
    .accesskey = g
menu-edit-bidi-switch-text-direction =
    .label = Schimbă direcția textului
    .accesskey = w

## View Menu

menu-view =
    .label = Vizualizare
    .accesskey = V
menu-view-toolbars-menu =
    .label = Bare de instrumente
    .accesskey = T
menu-view-customize-toolbar =
    .label = Personalizează…
    .accesskey = C
menu-view-sidebar =
    .label = Bară laterală
    .accesskey = e
menu-view-bookmarks =
    .label = Marcaje
menu-view-history-button =
    .label = Istoric
menu-view-synced-tabs-sidebar =
    .label = File sincronizate
menu-view-full-zoom =
    .label = Zoom
    .accesskey = Z
menu-view-full-zoom-enlarge =
    .label = Mărește
    .accesskey = I
menu-view-full-zoom-reduce =
    .label = Micșorează
    .accesskey = O
menu-view-full-zoom-actual-size =
    .label = Mărime reală
    .accesskey = A
menu-view-full-zoom-toggle =
    .label = Zoom doar pe text
    .accesskey = T
menu-view-page-style-menu =
    .label = Stilul paginii
    .accesskey = y
menu-view-page-style-no-style =
    .label = Niciun stil
    .accesskey = n
menu-view-page-basic-style =
    .label = Stilul de bază al paginii
    .accesskey = b
menu-view-charset =
    .label = Codare de text
    .accesskey = C

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Intră în modul de ecran complet
    .accesskey = F
menu-view-exit-full-screen =
    .label = Ieși din modul de ecran complet
    .accesskey = F
menu-view-full-screen =
    .label = Ecran complet
    .accesskey = F

##

menu-view-show-all-tabs =
    .label = Afișează toate filele
    .accesskey = A
menu-view-bidi-switch-page-direction =
    .label = Schimbă direcția paginii
    .accesskey = D

## History Menu

menu-history =
    .label = Istoric
    .accesskey = s
menu-history-show-all-history =
    .label = Afișează tot istoricul
menu-history-clear-recent-history =
    .label = Șterge istoricul recent…
menu-history-synced-tabs =
    .label = File sincronizate
menu-history-restore-last-session =
    .label = Restaurează sesiunea anterioară
menu-history-hidden-tabs =
    .label = File ascunse
menu-history-undo-menu =
    .label = File închise recent
menu-history-undo-window-menu =
    .label = Ferestre închise recent

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Marcaje
    .accesskey = B
menu-bookmarks-show-all =
    .label = Afișează toate marcajele
menu-bookmark-this-page =
    .label = Marchează pagina
menu-bookmark-edit =
    .label = Editează acest marcaj
menu-bookmarks-all-tabs =
    .label = Marchează toate filele…
menu-bookmarks-toolbar =
    .label = Bară de marcaje
menu-bookmarks-other =
    .label = Alte marcaje
menu-bookmarks-mobile =
    .label = Marcaje mobile

## Tools Menu

menu-tools =
    .label = Unelte
    .accesskey = T
menu-tools-downloads =
    .label = Descărcări
    .accesskey = D
menu-tools-addons =
    .label = Suplimente
    .accesskey = A
menu-tools-fxa-sign-in =
    .label = Autentifică-te în { -brand-product-name }…
    .accesskey = g
menu-tools-turn-on-sync =
    .label = Activare { -sync-brand-short-name }…
    .accesskey = n
menu-tools-sync-now =
    .label = Sincronizează acum
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Reconectare la { -brand-product-name }…
    .accesskey = R
menu-tools-web-developer =
    .label = Dezvoltator web
    .accesskey = W
menu-tools-page-source =
    .label = Sursa paginii
    .accesskey = o
menu-tools-page-info =
    .label = Informații despre pagină
    .accesskey = I
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Opțiuni
           *[other] Preferințe
        }
    .accesskey =
        { PLATFORM() ->
            [windows] O
           *[other] n
        }
menu-tools-layout-debugger =
    .label = Depanator de așezare în pagină
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = Fereastră
menu-window-bring-all-to-front =
    .label = Adu toate în față

## Help Menu

menu-help =
    .label = Ajutor
    .accesskey = H
menu-help-product =
    .label = Ajutor { -brand-shorter-name }
    .accesskey = H
menu-help-show-tour =
    .label = Tur { -brand-shorter-name }
    .accesskey = o
menu-help-import-from-another-browser =
    .label = Importă din alt browser…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Comenzi rapide din tastatură
    .accesskey = K
menu-help-troubleshooting-info =
    .label = Informații pentru depanare
    .accesskey = T
menu-help-feedback-page =
    .label = Trimite feedback…
    .accesskey = S
menu-help-safe-mode-without-addons =
    .label = Repornește cu suplimentele dezactivate…
    .accesskey = R
menu-help-safe-mode-with-addons =
    .label = Repornește cu suplimentele activate
    .accesskey = R
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Raportează site-uri înșelătoare…
    .accesskey = d
menu-help-not-deceptive =
    .label = Nu este un site înșelător…
    .accesskey = d
