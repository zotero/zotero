# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Einstellungen
menu-application-services =
    .label = Dienste
menu-application-hide-this =
    .label = { -brand-shorter-name } ausblenden
menu-application-hide-other =
    .label = Andere ausblenden
menu-application-show-all =
    .label = Alle einblenden
menu-application-touch-bar =
    .label = Touch Bar anpassen…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Beenden
           *[other] Beenden
        }
    .accesskey =
        { PLATFORM() ->
            [windows] B
           *[other] B
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = { -brand-shorter-name } beenden
menu-about =
    .label = Über { -brand-shorter-name }
    .accesskey = e

## File Menu

menu-file =
    .label = Datei
    .accesskey = D
menu-file-new-tab =
    .label = Neuer Tab
    .accesskey = T
menu-file-new-container-tab =
    .label = Neuer Tab in Umgebung
    .accesskey = m
menu-file-new-window =
    .label = ­Neues Fenster
    .accesskey = N
menu-file-new-private-window =
    .label = Neues privates Fenster
    .accesskey = p
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Adresse öffnen…
menu-file-open-file =
    .label = Datei öffnen…
    .accesskey = f
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Tab schließen
           *[other] { $tabCount } Tabs schließen
        }
    .accesskey = c
menu-file-close-window =
    .label = Fenster schließen
    .accesskey = h
menu-file-save-page =
    .label = Seite speichern unter…
    .accesskey = u
menu-file-email-link =
    .label = Link per E-Mail senden…
    .accesskey = s
menu-file-share-url =
    .label = Teilen
    .accesskey = e
menu-file-print-setup =
    .label = Seite einrichten…
    .accesskey = e
menu-file-print =
    .label = Drucken…
    .accesskey = D
menu-file-import-from-another-browser =
    .label = Daten aus einem anderen Browser importieren…
    .accesskey = r
menu-file-go-offline =
    .label = Offline arbeiten
    .accesskey = O

## Edit Menu

menu-edit =
    .label = Bearbeiten
    .accesskey = B
menu-edit-find-in-page =
    .label = Seite durchsuchen…
    .accesskey = S
menu-edit-find-again =
    .label = Weitersuchen
    .accesskey = n
menu-edit-bidi-switch-text-direction =
    .label = Textrichtung ändern
    .accesskey = ä

## View Menu

menu-view =
    .label = Ansicht
    .accesskey = A
menu-view-toolbars-menu =
    .label = Symbolleisten
    .accesskey = y
menu-view-customize-toolbar2 =
    .label = Symbolleiste anpassen…
    .accesskey = a
menu-view-sidebar =
    .label = Sidebar
    .accesskey = b
menu-view-bookmarks =
    .label = Lesezeichen
menu-view-history-button =
    .label = Chronik
menu-view-synced-tabs-sidebar =
    .label = Synchronisierte Tabs
menu-view-full-zoom =
    .label = Zoom
    .accesskey = o
menu-view-full-zoom-enlarge =
    .label = Vergrößern
    .accesskey = g
menu-view-full-zoom-reduce =
    .label = Verkleinern
    .accesskey = k
menu-view-full-zoom-actual-size =
    .label = Tatsächliche Größe
    .accesskey = T
menu-view-full-zoom-toggle =
    .label = Nur Text zoomen
    .accesskey = T
menu-view-page-style-menu =
    .label = Webseiten-Stil
    .accesskey = W
menu-view-page-style-no-style =
    .label = Kein Stil
    .accesskey = K
menu-view-page-basic-style =
    .label = Standard-Stil
    .accesskey = S
menu-view-repair-text-encoding =
    .label = Textkodierung reparieren
    .accesskey = T

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Vollbild ein
    .accesskey = V
menu-view-exit-full-screen =
    .label = Vollbild aus
    .accesskey = V
menu-view-full-screen =
    .label = Vollbild
    .accesskey = V

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Leseansicht öffnen
    .accesskey = L
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Leseansicht beenden
    .accesskey = L

##

menu-view-show-all-tabs =
    .label = Alle Tabs anzeigen
    .accesskey = z
menu-view-bidi-switch-page-direction =
    .label = Seitenrichtung ändern
    .accesskey = S

## History Menu

menu-history =
    .label = Chronik
    .accesskey = C
menu-history-show-all-history =
    .label = Gesamte Chronik anzeigen
menu-history-clear-recent-history =
    .label = Neueste Chronik löschen…
menu-history-synced-tabs =
    .label = Synchronisierte Tabs
menu-history-restore-last-session =
    .label = Vorherige Sitzung wiederherstellen
menu-history-hidden-tabs =
    .label = Ausgeblendete Tabs
menu-history-undo-menu =
    .label = Kürzlich geschlossene Tabs
menu-history-undo-window-menu =
    .label = Kürzlich geschlossene Fenster
menu-history-reopen-all-tabs = Alle Tabs wieder öffnen
menu-history-reopen-all-windows = Alle Fenster wieder öffnen

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Lesezeichen
    .accesskey = L
menu-bookmarks-manage =
    .label = Lesezeichen verwalten
menu-bookmark-current-tab =
    .label = Aktuellen Tab als Lesezeichen hinzufügen
menu-bookmark-edit =
    .label = Lesezeichen bearbeiten
menu-bookmark-tab =
    .label = Aktuellen Tab als Lesezeichen hinzufügen…
menu-edit-bookmark =
    .label = Dieses Lesezeichen bearbeiten…
menu-bookmarks-all-tabs =
    .label = Lesezeichen für alle Tabs hinzufügen…
menu-bookmarks-toolbar =
    .label = Lesezeichen-Symbolleiste
menu-bookmarks-other =
    .label = Weitere Lesezeichen
menu-bookmarks-mobile =
    .label = Mobile Lesezeichen

## Tools Menu

menu-tools =
    .label = Extras
    .accesskey = x
menu-tools-downloads =
    .label = Downloads
    .accesskey = o
menu-tools-addons-and-themes =
    .label = Add-ons und Themes
    .accesskey = A
menu-tools-fxa-sign-in2 =
    .label = Anmelden
    .accesskey = m
menu-tools-turn-on-sync2 =
    .label = Synchronisation aktivieren…
    .accesskey = n
menu-tools-sync-now =
    .label = Jetzt synchronisieren
    .accesskey = J
menu-tools-fxa-re-auth =
    .label = Wieder mit { -brand-product-name } verbinden…
    .accesskey = v
menu-tools-browser-tools =
    .label = Browser-Werkzeuge
    .accesskey = B
menu-tools-task-manager =
    .label = Task-Manager
    .accesskey = M
menu-tools-page-source =
    .label = Seitenquelltext anzeigen
    .accesskey = q
menu-tools-page-info =
    .label = Seiteninformationen
    .accesskey = S
menu-settings =
    .label = Einstellungen
    .accesskey =
        { PLATFORM() ->
            [windows] E
           *[other] E
        }
menu-tools-layout-debugger =
    .label = Layout-Debugger
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = Fenster
menu-window-bring-all-to-front =
    .label = Alle nach vorne bringen

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Hilfe
    .accesskey = H
menu-get-help =
    .label = Hilfe erhalten
    .accesskey = H
menu-help-more-troubleshooting-info =
    .label = Weitere Informationen zur Fehlerbehebung
    .accesskey = z
menu-help-report-site-issue =
    .label = Seitenproblem melden…
menu-help-share-ideas =
    .label = Ideen und Feedback teilen…
    .accesskey = I
menu-help-enter-troubleshoot-mode2 =
    .label = Fehlerbehebungsmodus…
    .accesskey = m
menu-help-exit-troubleshoot-mode =
    .label = Fehlerbehebungsmodus deaktivieren
    .accesskey = m
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Betrügerische Website melden…
    .accesskey = m
menu-help-not-deceptive =
    .label = Dies ist keine betrügerische Website…
    .accesskey = g
