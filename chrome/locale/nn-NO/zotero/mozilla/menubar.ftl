# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Fil
    .accesskey = F
menu-file-new-tab =
    .label = Ny fane
    .accesskey = f
menu-file-new-container-tab =
    .label = Ny innhaldsfane
    .accesskey = i
menu-file-new-window =
    .label = Nytt vindauge
    .accesskey = N
menu-file-new-private-window =
    .label = Nytt privat vindauge
    .accesskey = v
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Opne adresse…
menu-file-open-file =
    .label = Opne fil…
    .accesskey = O
menu-file-close =
    .label = Lat att
    .accesskey = L
menu-file-close-window =
    .label = Lat att vindauge
    .accesskey = L
menu-file-save-page =
    .label = Lagre sida som…
    .accesskey = a
menu-file-email-link =
    .label = Send lenke på e-post…
    .accesskey = e
menu-file-print-setup =
    .label = Utskriftsformat…
    .accesskey = m
menu-file-print-preview =
    .label = Førehandsvis sida
    .accesskey = v
menu-file-print =
    .label = Skriv ut…
    .accesskey = u
menu-file-import-from-another-browser =
    .label = Importer frå ein annan nettlesar…
    .accesskey = I
menu-file-go-offline =
    .label = Arbeid fråkopla
    .accesskey = r

## Edit Menu

menu-edit =
    .label = Rediger
    .accesskey = R
menu-edit-find-on =
    .label = Søk på denne sida…
    .accesskey = S
menu-edit-find-again =
    .label = Søk igjen
    .accesskey = ø
menu-edit-bidi-switch-text-direction =
    .label = Byt tekstretning
    .accesskey = B

## View Menu

menu-view =
    .label = Vis
    .accesskey = V
menu-view-toolbars-menu =
    .label = Verktøylinjer
    .accesskey = V
menu-view-customize-toolbar =
    .label = Tilpass…
    .accesskey = T
menu-view-sidebar =
    .label = Sidestolpe
    .accesskey = d
menu-view-bookmarks =
    .label = Bokmerke
menu-view-history-button =
    .label = Historikk
menu-view-synced-tabs-sidebar =
    .label = Synkroniserte faner
menu-view-full-zoom =
    .label = Skalering
    .accesskey = r
menu-view-full-zoom-enlarge =
    .label = Større skrift
    .accesskey = S
menu-view-full-zoom-reduce =
    .label = Mindre skrift
    .accesskey = M
menu-view-full-zoom-actual-size =
    .label = Verkeleg storleik
    .accesskey = V
menu-view-full-zoom-toggle =
    .label = Forstørr berre tekst
    .accesskey = o
menu-view-page-style-menu =
    .label = Sidestil
    .accesskey = e
menu-view-page-style-no-style =
    .label = Ingen
    .accesskey = I
menu-view-page-basic-style =
    .label = Vanleg
    .accesskey = V
menu-view-charset =
    .label = Teiknkoding
    .accesskey = T

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Opne fullskjerm
    .accesskey = n
menu-view-exit-full-screen =
    .label = Avslutt fullskjerm
    .accesskey = v
menu-view-full-screen =
    .label = Fullskjerm
    .accesskey = F

##

menu-view-show-all-tabs =
    .label = Vis alle faner
    .accesskey = V
menu-view-bidi-switch-page-direction =
    .label = Byt tekstretning på sida
    .accesskey = r

## History Menu

menu-history =
    .label = Historikk
    .accesskey = s
menu-history-show-all-history =
    .label = Vis all historikk
menu-history-clear-recent-history =
    .label = Slett nyleg historikk…
menu-history-synced-tabs =
    .label = Synkronisterte faner
menu-history-restore-last-session =
    .label = Bygg oppatt siste programøkt
menu-history-hidden-tabs =
    .label = Skjulte faner
menu-history-undo-menu =
    .label = Nyleg attlatne faner
menu-history-undo-window-menu =
    .label = Nyleg attlatne vindauge

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Bokmerke
    .accesskey = B
menu-bookmarks-show-all =
    .label = Vis alle bokmerka
menu-bookmark-this-page =
    .label = Bokmerk denne sida
menu-bookmark-edit =
    .label = Rediger dette bokmerket
menu-bookmarks-all-tabs =
    .label = Bokmerk alle faner…
menu-bookmarks-toolbar =
    .label = Bokmerke
menu-bookmarks-other =
    .label = Andre bokmerke
menu-bookmarks-mobile =
    .label = Mobile bokmerke

## Tools Menu

menu-tools =
    .label = Verktøy
    .accesskey = e
menu-tools-downloads =
    .label = Nedlastingar
    .accesskey = N
menu-tools-addons =
    .label = Tillegg
    .accesskey = T
menu-tools-fxa-sign-in =
    .label = Logg inn på { -brand-product-name }…
    .accesskey = g
menu-tools-turn-on-sync =
    .label = Slå på { -sync-brand-short-name }…
    .accesskey = S
menu-tools-sync-now =
    .label = Synkroniser no
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Kople til { -brand-product-name } på nytt…
    .accesskey = K
menu-tools-web-developer =
    .label = Nettsideutvikling
    .accesskey = N
menu-tools-page-source =
    .label = Kjeldekode
    .accesskey = d
menu-tools-page-info =
    .label = Sideinformasjon
    .accesskey = d
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Innstillingar
           *[other] Innstillingar
        }
    .accesskey =
        { PLATFORM() ->
            [windows] I
           *[other] I
        }
menu-tools-layout-debugger =
    .label = Feilsøk layout
    .accesskey = F

## Window Menu

menu-window-menu =
    .label = Vindauge
menu-window-bring-all-to-front =
    .label = Send alle til framgrunnen

## Help Menu

menu-help =
    .label = Hjelp
    .accesskey = H
menu-help-product =
    .label = { -brand-shorter-name } Hjelp
    .accesskey = H
menu-help-show-tour =
    .label = Omvising i { -brand-shorter-name }
    .accesskey = m
menu-help-import-from-another-browser =
    .label = Importer frå ein annan nettlesar…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Tastatursnarvegar
    .accesskey = T
menu-help-troubleshooting-info =
    .label = Feilsøking
    .accesskey = e
menu-help-feedback-page =
    .label = Gje tilbakemelding…
    .accesskey = G
menu-help-safe-mode-without-addons =
    .label = Start på nytt med avslåtte tillegg…
    .accesskey = S
menu-help-safe-mode-with-addons =
    .label = Start på nytt med påslåtte tillegg
    .accesskey = S
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Rapporter villeiande nettstad…
    .accesskey = R
menu-help-not-deceptive =
    .label = Dette er ikkje ein villeiande nettstad…
    .accesskey = d
