# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Eelistused
menu-application-services =
    .label = Teenused
menu-application-hide-this =
    .label = Varja { -brand-shorter-name }
menu-application-hide-other =
    .label = Varja teised
menu-application-show-all =
    .label = Näita kõiki
menu-application-touch-bar =
    .label = Kohanda puuteriba…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Välju
           *[other] Välju
        }
    .accesskey =
        { PLATFORM() ->
            [windows] j
           *[other] j
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Välju { -brand-shorter-name }ist
menu-about =
    .label = { -brand-shorter-name }i teave
    .accesskey = e

## File Menu

menu-file =
    .label = Fail
    .accesskey = F
menu-file-new-tab =
    .label = Uus kaart
    .accesskey = k
menu-file-new-container-tab =
    .label = Uus konteinerkaart
    .accesskey = o
menu-file-new-window =
    .label = Uus aken
    .accesskey = U
menu-file-new-private-window =
    .label = Uus privaatne aken
    .accesskey = p
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Ava asukoht…
menu-file-open-file =
    .label = Ava fail…
    .accesskey = A
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Sulge kaart
            [one] Sulge kaart
           *[other] Sulge { $tabCount } kaarti
        }
    .accesskey = S
menu-file-close-window =
    .label = Sulge aken
    .accesskey = S
menu-file-save-page =
    .label = Salvesta veebileht kui…
    .accesskey = S
menu-file-email-link =
    .label = Saada link e-postiga…
    .accesskey = d
menu-file-share-url =
    .label = Jaga
    .accesskey = J
menu-file-print-setup =
    .label = Lehekülje sätted…
    .accesskey = L
menu-file-print =
    .label = Prindi…
    .accesskey = P
menu-file-import-from-another-browser =
    .label = Impordi teisest brauserist…
    .accesskey = I
menu-file-go-offline =
    .label = Tööta võrguta
    .accesskey = T

## Edit Menu

menu-edit =
    .label = Redigeerimine
    .accesskey = R
menu-edit-find-in-page =
    .label = Otsi lehelt…
    .accesskey = O
menu-edit-find-again =
    .label = Otsi uuesti
    .accesskey = u
menu-edit-bidi-switch-text-direction =
    .label = Muuda teksti suunda
    .accesskey = d

## View Menu

menu-view =
    .label = Vaade
    .accesskey = V
menu-view-toolbars-menu =
    .label = Tööriistaribad
    .accesskey = T
menu-view-customize-toolbar2 =
    .label = Kohanda tööriistariba…
    .accesskey = K
menu-view-sidebar =
    .label = Külgriba
    .accesskey = K
menu-view-bookmarks =
    .label = Järjehoidjad
menu-view-history-button =
    .label = Ajalugu
menu-view-synced-tabs-sidebar =
    .label = Sünkroniseeritud kaardid
menu-view-full-zoom =
    .label = Suurendamine
    .accesskey = u
menu-view-full-zoom-enlarge =
    .label = Suurenda
    .accesskey = S
menu-view-full-zoom-reduce =
    .label = Vähenda
    .accesskey = V
menu-view-full-zoom-actual-size =
    .label = Tegelik suurus
    .accesskey = T
menu-view-full-zoom-toggle =
    .label = Suurenda ainult teksti
    .accesskey = t
menu-view-page-style-menu =
    .label = Veebilehe stiil
    .accesskey = h
menu-view-page-style-no-style =
    .label = Stiil puudub
    .accesskey = p
menu-view-page-basic-style =
    .label = Veebilehe baasstiil
    .accesskey = b
menu-view-repair-text-encoding =
    .label = Paranda teksti kodeering
    .accesskey = P

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Lülitu täisekraanirežiimi
    .accesskey = t
menu-view-exit-full-screen =
    .label = Välju täisekraanirežiimist
    .accesskey = V
menu-view-full-screen =
    .label = Täisekraani režiim
    .accesskey = r

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Lülitu lugemisvaatesse
    .accesskey = L
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Sulge lugemisvaade
    .accesskey = S

##

menu-view-show-all-tabs =
    .label = Kuva kõiki kaarte
    .accesskey = K
menu-view-bidi-switch-page-direction =
    .label = Muuda lehe suunda
    .accesskey = h

## History Menu

menu-history =
    .label = Ajalugu
    .accesskey = A
menu-history-show-all-history =
    .label = Näita kogu ajalugu
menu-history-clear-recent-history =
    .label = Kustuta hiljutine ajalugu…
menu-history-synced-tabs =
    .label = Sünkroniseeritud kaardid
menu-history-restore-last-session =
    .label = Taasta eelmine seanss
menu-history-hidden-tabs =
    .label = Peidetud kaardid
menu-history-undo-menu =
    .label = Hiljuti suletud kaardid
menu-history-undo-window-menu =
    .label = Hiljuti suletud aknad
menu-history-reopen-all-tabs = Ava kõik kaardid uuesti
menu-history-reopen-all-windows = Ava kõik aknad uuesti

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Järjehoidjad
    .accesskey = J
menu-bookmarks-manage =
    .label = Halda järjehoidjaid
menu-bookmark-current-tab =
    .label = Lisa praegune kaart järjehoidjatesse
menu-bookmark-edit =
    .label = Muuda seda järjehoidjat
menu-bookmarks-all-tabs =
    .label = Lisa kõik kaardid järjehoidjatesse...
menu-bookmarks-toolbar =
    .label = Järjehoidjariba
menu-bookmarks-other =
    .label = Muud järjehoidjad
menu-bookmarks-mobile =
    .label = Mobiilsed järjehoidjad

## Tools Menu

menu-tools =
    .label = Tööriistad
    .accesskey = T
menu-tools-downloads =
    .label = Allalaadimised
    .accesskey = A
menu-tools-addons-and-themes =
    .label = Lisad ja teemad
    .accesskey = L
menu-tools-fxa-sign-in2 =
    .label = Logi sisse
    .accesskey = o
menu-tools-turn-on-sync2 =
    .label = Lülita Sync sisse…
    .accesskey = t
menu-tools-sync-now =
    .label = Sünkroniseeri kohe
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Ühenda { -brand-product-name } uuesti…
    .accesskey = h
menu-tools-browser-tools =
    .label = Brauseri tööriistad
    .accesskey = B
menu-tools-task-manager =
    .label = Tegumihaldur
    .accesskey = g
menu-tools-page-source =
    .label = Veebilehe lähtekood
    .accesskey = l
menu-tools-page-info =
    .label = Veebilehe info
    .accesskey = i
menu-settings =
    .label = Sätted
    .accesskey =
        { PLATFORM() ->
            [windows] S
           *[other] t
        }
menu-tools-layout-debugger =
    .label = Layout Debugger
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = Aken
menu-window-bring-all-to-front =
    .label = Too kõik ette

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Abi
    .accesskey = b
menu-get-help =
    .label = Otsi abi
    .accesskey = i
menu-help-more-troubleshooting-info =
    .label = Rohkem probleemide lahendamise teavet
    .accesskey = h
menu-help-report-site-issue =
    .label = Anna teada saidil olevast veast…
menu-help-share-ideas =
    .label = Jaga ideid ja tagasisidet…
    .accesskey = J
menu-help-enter-troubleshoot-mode2 =
    .label = Probleemide lahendamise režiim…
    .accesskey = m
menu-help-exit-troubleshoot-mode =
    .label = Lülita probleemide lahendamise režiim välja
    .accesskey = d
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Teata veebivõltsingust…
    .accesskey = T
menu-help-not-deceptive =
    .label = See ei ole veebivõltsing…
    .accesskey = b
