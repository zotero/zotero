# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Innstillinger
menu-application-services =
    .label = Tjenester
menu-application-hide-this =
    .label = Skjul { -brand-shorter-name }
menu-application-hide-other =
    .label = Skjul andre
menu-application-show-all =
    .label = Vis alle
menu-application-touch-bar =
    .label = Tilpass Touch Bar…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Avslutt
           *[other] Avslutt
        }
    .accesskey =
        { PLATFORM() ->
            [windows] t
           *[other] t
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Avslutt { -brand-shorter-name }
menu-about =
    .label = Om { -brand-shorter-name }
    .accesskey = O

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
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Lukk fane
           *[other] Lukk { $tabCount } faner
        }
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
menu-file-share-url =
    .label = Del
    .accesskey = e
menu-file-print-setup =
    .label = Utskriftsformat …
    .accesskey = k
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
menu-edit-find-in-page =
    .label = Søk på siden …
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
menu-view-customize-toolbar2 =
    .label = Tilpass verktøylinje …
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
menu-view-repair-text-encoding =
    .label = Reparer tekstkoding
    .accesskey = e

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

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Gå til lesevisning
    .accesskey = R
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Lukk lesevisning
    .accesskey = R

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
menu-history-reopen-all-tabs = Åpne alle faner på nytt
menu-history-reopen-all-windows = Åpne alle vinduer på nytt

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Bokmerker
    .accesskey = B
menu-bookmarks-manage =
    .label = Behandle bokmerker
menu-bookmark-current-tab =
    .label = Bokmerk gjeldende fane
menu-bookmark-edit =
    .label = Rediger dette bokmerket
menu-bookmark-tab =
    .label = Bokmerk gjeldende fane …
menu-edit-bookmark =
    .label = Rediger dette bokmerket …
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
menu-tools-addons-and-themes =
    .label = Tillegg og temaer
    .accesskey = T
menu-tools-fxa-sign-in2 =
    .label = Logg inn
    .accesskey = L
menu-tools-turn-on-sync2 =
    .label = Slå på synkronisering …
    .accesskey = S
menu-tools-sync-now =
    .label = Synkroniser nå
    .accesskey = r
menu-tools-fxa-re-auth =
    .label = Koble til { -brand-product-name } på nytt…
    .accesskey = K
menu-tools-browser-tools =
    .label = Nettleserverktøy
    .accesskey = N
menu-tools-task-manager =
    .label = Oppgavebehandler
    .accesskey = O
menu-tools-page-source =
    .label = Kildekode
    .accesskey = d
menu-tools-page-info =
    .label = Sideinformasjon
    .accesskey = d
menu-settings =
    .label = Innstillinger
    .accesskey =
        { PLATFORM() ->
            [windows] n
           *[other] n
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


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Hjelp
    .accesskey = H
menu-get-help =
    .label = Få hjelp
    .accesskey = F
menu-help-more-troubleshooting-info =
    .label = Mer feilsøkingsinformasjon
    .accesskey = M
menu-help-report-site-issue =
    .label = Rapporter problem med nettsted…
menu-help-share-ideas =
    .label = Del ideer og tilbakemeldinger…
    .accesskey = D
menu-help-enter-troubleshoot-mode2 =
    .label = Feilsøkingsmodus…
    .accesskey = F
menu-help-exit-troubleshoot-mode =
    .label = Slå av feilsøkingsmodus
    .accesskey = S
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Rapporter villedende nettsted …
    .accesskey = R
menu-help-not-deceptive =
    .label = Dette er ikke et villedende nettsted …
    .accesskey = d
