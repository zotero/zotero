# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Bestand
    .accesskey = B
menu-file-new-tab =
    .label = Nieuw tabblad
    .accesskey = t
menu-file-new-container-tab =
    .label = Nieuw containertabblad
    .accesskey = c
menu-file-new-window =
    .label = Nieuw venster
    .accesskey = N
menu-file-new-private-window =
    .label = Nieuw privévenster
    .accesskey = r
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Locatie openen…
menu-file-open-file =
    .label = Bestand openen…
    .accesskey = o
menu-file-close =
    .label = Sluiten
    .accesskey = S
menu-file-close-window =
    .label = Venster sluiten
    .accesskey = e
menu-file-save-page =
    .label = Pagina opslaan als…
    .accesskey = p
menu-file-email-link =
    .label = Koppeling e-mailen…
    .accesskey = m
menu-file-print-setup =
    .label = Pagina-instellingen…
    .accesskey = i
menu-file-print-preview =
    .label = Afdrukvoorbeeld
    .accesskey = v
menu-file-print =
    .label = Afdrukken…
    .accesskey = d
menu-file-import-from-another-browser =
    .label = Importeren vanuit een andere browser…
    .accesskey = b
menu-file-go-offline =
    .label = Offline werken
    .accesskey = f

## Edit Menu

menu-edit =
    .label = Bewerken
    .accesskey = w
menu-edit-find-on =
    .label = Zoeken op deze pagina…
    .accesskey = Z
menu-edit-find-again =
    .label = Opnieuw zoeken
    .accesskey = w
menu-edit-bidi-switch-text-direction =
    .label = Tekstrichting omkeren
    .accesskey = t

## View Menu

menu-view =
    .label = Beeld
    .accesskey = l
menu-view-toolbars-menu =
    .label = Werkbalken
    .accesskey = W
menu-view-customize-toolbar =
    .label = Aanpassen…
    .accesskey = A
menu-view-sidebar =
    .label = Zijbalk
    .accesskey = Z
menu-view-bookmarks =
    .label = Bladwijzers
menu-view-history-button =
    .label = Geschiedenis
menu-view-synced-tabs-sidebar =
    .label = Gesynchroniseerde tabbladen
menu-view-full-zoom =
    .label = Zoomen
    .accesskey = o
menu-view-full-zoom-enlarge =
    .label = Inzoomen
    .accesskey = I
menu-view-full-zoom-reduce =
    .label = Uitzoomen
    .accesskey = U
menu-view-full-zoom-actual-size =
    .label = Werkelijke grootte
    .accesskey = W
menu-view-full-zoom-toggle =
    .label = Alleen tekst zoomen
    .accesskey = t
menu-view-page-style-menu =
    .label = Paginastijl
    .accesskey = P
menu-view-page-style-no-style =
    .label = Geen stijl
    .accesskey = G
menu-view-page-basic-style =
    .label = Basisstijl
    .accesskey = B
menu-view-charset =
    .label = Tekstcodering
    .accesskey = c

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Schermvullende weergave
    .accesskey = S
menu-view-exit-full-screen =
    .label = Volledig scherm verlaten
    .accesskey = V
menu-view-full-screen =
    .label = Volledig scherm
    .accesskey = d

##

menu-view-show-all-tabs =
    .label = Alle tabbladen tonen
    .accesskey = A
menu-view-bidi-switch-page-direction =
    .label = Paginarichting omkeren
    .accesskey = a

## History Menu

menu-history =
    .label = Geschiedenis
    .accesskey = G
menu-history-show-all-history =
    .label = Alle geschiedenis tonen
menu-history-clear-recent-history =
    .label = Recente geschiedenis wissen…
menu-history-synced-tabs =
    .label = Gesynchroniseerde tabbladen
menu-history-restore-last-session =
    .label = Vorige sessie herstellen
menu-history-hidden-tabs =
    .label = Verborgen tabbladen
menu-history-undo-menu =
    .label = Onlangs gesloten tabbladen
menu-history-undo-window-menu =
    .label = Onlangs gesloten vensters

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Bladwijzers
    .accesskey = a
menu-bookmarks-show-all =
    .label = Alle bladwijzers tonen
menu-bookmark-this-page =
    .label = Bladwijzer voor deze pagina maken
menu-bookmark-edit =
    .label = Deze bladwijzer bewerken
menu-bookmarks-all-tabs =
    .label = Bladwijzer voor alle tabbladen maken…
menu-bookmarks-toolbar =
    .label = Bladwijzerwerkbalk
menu-bookmarks-other =
    .label = Andere bladwijzers
menu-bookmarks-mobile =
    .label = Mobiel-bladwijzers

## Tools Menu

menu-tools =
    .label = Extra
    .accesskey = x
menu-tools-downloads =
    .label = Downloads
    .accesskey = D
menu-tools-addons =
    .label = Add-ons
    .accesskey = A
menu-tools-fxa-sign-in =
    .label = Aanmelden bij { -brand-product-name }…
    .accesskey = m
menu-tools-turn-on-sync =
    .label = { -sync-brand-short-name } inschakelen…
    .accesskey = n
menu-tools-sync-now =
    .label = Nu synchroniseren
    .accesskey = N
menu-tools-fxa-re-auth =
    .label = Opnieuw verbinden met { -brand-product-name }…
    .accesskey = O
menu-tools-web-developer =
    .label = Webontwikkelaar
    .accesskey = W
menu-tools-page-source =
    .label = Paginabron
    .accesskey = b
menu-tools-page-info =
    .label = Pagina-info
    .accesskey = i
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Opties
           *[other] Voorkeuren
        }
    .accesskey =
        { PLATFORM() ->
            [windows] O
           *[other] V
        }
menu-tools-layout-debugger =
    .label = Lay-out-debugger
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = Venster
menu-window-bring-all-to-front =
    .label = Alles naar voren brengen

## Help Menu

menu-help =
    .label = Help
    .accesskey = H
menu-help-product =
    .label = { -brand-shorter-name } Help
    .accesskey = H
menu-help-show-tour =
    .label = { -brand-shorter-name }-rondleiding
    .accesskey = d
menu-help-import-from-another-browser =
    .label = Importeren vanuit een andere browser…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Sneltoetsen
    .accesskey = S
menu-help-troubleshooting-info =
    .label = Probleemoplossingsinformatie
    .accesskey = P
menu-help-feedback-page =
    .label = Feedback verzenden…
    .accesskey = v
menu-help-safe-mode-without-addons =
    .label = Herstarten met uitgeschakelde add-ons…
    .accesskey = r
menu-help-safe-mode-with-addons =
    .label = Herstarten met ingeschakelde add-ons
    .accesskey = r
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Misleidende website rapporteren…
    .accesskey = M
menu-help-not-deceptive =
    .label = Dit is geen misleidende website…
    .accesskey = m
