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
    .label = Ny innholdsfane
    .accesskey = i
menu-file-new-window =
    .label = Nytt vindu
    .accesskey = N
menu-file-new-private-window =
    .label = Nytt privat vindu
    .accesskey = r
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Åpne adresse …
menu-file-open-file =
    .label = Åpne fil …
    .accesskey = Å
menu-file-close =
    .label = Lukk
    .accesskey = L
menu-file-close-window =
    .label = Lukk vindu
    .accesskey = L
menu-file-save-page =
    .label = Lagre side som …
    .accesskey = a
menu-file-email-link =
    .label = Send lenke med e-post…
    .accesskey = S
menu-file-print-setup =
    .label = Utskriftsformat …
    .accesskey = k
menu-file-print-preview =
    .label = Forhåndsvis side
    .accesskey = v
menu-file-print =
    .label = Skriv ut …
    .accesskey = u
menu-file-import-from-another-browser =
    .label = Importer fra en annen nettleser…
    .accesskey = I
menu-file-go-offline =
    .label = Arbeid frakoblet
    .accesskey = r

## Edit Menu

menu-edit =
    .label = Rediger
    .accesskey = R
menu-edit-find-on =
    .label = Søk på denne siden …
    .accesskey = S
menu-edit-find-again =
    .label = Søk igjen
    .accesskey = ø
menu-edit-bidi-switch-text-direction =
    .label = Bytt tekstretning
    .accesskey = B

## View Menu

menu-view =
    .label = Vis
    .accesskey = V
menu-view-toolbars-menu =
    .label = Verktøylinjer
    .accesskey = V
menu-view-customize-toolbar =
    .label = Tilpass …
    .accesskey = T
menu-view-sidebar =
    .label = Sidestolpe
    .accesskey = d
menu-view-bookmarks =
    .label = Bokmerker
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
    .label = Virkelig størrelse
    .accesskey = V
menu-view-full-zoom-toggle =
    .label = Forstørr bare tekst
    .accesskey = o
menu-view-page-style-menu =
    .label = Sidestil
    .accesskey = e
menu-view-page-style-no-style =
    .label = Ingen
    .accesskey = I
menu-view-page-basic-style =
    .label = Vanlig
    .accesskey = V
menu-view-charset =
    .label = Tekstkoding
    .accesskey = T

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Åpne fullskjerm
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
    .label = Bytt tekstretning på siden
    .accesskey = r

## History Menu

menu-history =
    .label = Historikk
    .accesskey = s
menu-history-show-all-history =
    .label = Vis all historikk
menu-history-clear-recent-history =
    .label = Slett nylig historikk …
menu-history-synced-tabs =
    .label = Synkroniserte faner
menu-history-restore-last-session =
    .label = Gjenopprett forrige programøkt
menu-history-hidden-tabs =
    .label = Skjulte faner
menu-history-undo-menu =
    .label = Nylig lukkede faner
menu-history-undo-window-menu =
    .label = Nylig lukkede vinduer

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Bokmerker
    .accesskey = B
menu-bookmarks-show-all =
    .label = Vis alle bokmerker
menu-bookmark-this-page =
    .label = Bokmerk denne siden
menu-bookmark-edit =
    .label = Rediger dette bokmerket
menu-bookmarks-all-tabs =
    .label = Bokmerk alle faner …
menu-bookmarks-toolbar =
    .label = Bokmerker
menu-bookmarks-other =
    .label = Andre bokmerker
menu-bookmarks-mobile =
    .label = Mobile bokmerker

## Tools Menu

menu-tools =
    .label = Verktøy
    .accesskey = e
menu-tools-downloads =
    .label = Nedlastinger
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
    .label = Synkroniser nå
    .accesskey = r
menu-tools-fxa-re-auth =
    .label = Koble til { -brand-product-name } på nytt…
    .accesskey = K
menu-tools-web-developer =
    .label = Nettsideutvikling
    .accesskey = t
menu-tools-page-source =
    .label = Kildekode
    .accesskey = d
menu-tools-page-info =
    .label = Sideinformasjon
    .accesskey = d
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Innstillinger
           *[other] Innstillinger
        }
    .accesskey =
        { PLATFORM() ->
            [windows] I
           *[other] I
        }
menu-tools-layout-debugger =
    .label = Feilsøk layout
    .accesskey = l

## Window Menu

menu-window-menu =
    .label = Vindu
menu-window-bring-all-to-front =
    .label = Send alle til forgrunnen

## Help Menu

menu-help =
    .label = Hjelp
    .accesskey = H
menu-help-product =
    .label = { -brand-shorter-name } Hjelp
    .accesskey = H
menu-help-show-tour =
    .label = Omvisning i { -brand-shorter-name }
    .accesskey = m
menu-help-import-from-another-browser =
    .label = Importer fra en annen nettleser…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Tastatursnarveier
    .accesskey = T
menu-help-troubleshooting-info =
    .label = Feilsøking
    .accesskey = F
menu-help-feedback-page =
    .label = Gi tilbakemelding …
    .accesskey = G
menu-help-safe-mode-without-addons =
    .label = Start på nytt med utvidelser avslått …
    .accesskey = r
menu-help-safe-mode-with-addons =
    .label = Start på nytt med utvidelser påslått
    .accesskey = S
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Rapporter villedende nettsted …
    .accesskey = R
menu-help-not-deceptive =
    .label = Dette er ikke et villedende nettsted …
    .accesskey = d
