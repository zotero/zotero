# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


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
menu-file-close =
    .label = Schließen
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
menu-file-print-setup =
    .label = Seite einrichten…
    .accesskey = e
menu-file-print-preview =
    .label = Druckvorschau
    .accesskey = v
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
menu-edit-find-on =
    .label = Seite durchsuchen
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
menu-view-customize-toolbar =
    .label = Anpassen…
    .accesskey = A
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
menu-view-charset =
    .label = Textkodierung
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

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Lesezeichen
    .accesskey = L
menu-bookmarks-show-all =
    .label = Lesezeichen verwalten
menu-bookmark-this-page =
    .label = Lesezeichen hinzufügen
menu-bookmark-edit =
    .label = Lesezeichen bearbeiten
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
menu-tools-addons =
    .label = Add-ons
    .accesskey = d
menu-tools-fxa-sign-in =
    .label = Bei { -brand-product-name } anmelden…
    .accesskey = B
menu-tools-turn-on-sync =
    .label = { -sync-brand-short-name } aktivieren…
    .accesskey = n
menu-tools-sync-now =
    .label = Jetzt synchronisieren
    .accesskey = J
menu-tools-fxa-re-auth =
    .label = Wieder mit { -brand-product-name } verbinden…
    .accesskey = v
menu-tools-web-developer =
    .label = Web-Entwickler
    .accesskey = W
menu-tools-page-source =
    .label = Seitenquelltext anzeigen
    .accesskey = q
menu-tools-page-info =
    .label = Seiteninformationen
    .accesskey = S
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Einstellungen
           *[other] Einstellungen
        }
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

menu-help =
    .label = Hilfe
    .accesskey = H
menu-help-product =
    .label = { -brand-shorter-name }-Hilfe
    .accesskey = H
menu-help-show-tour =
    .label = Tour durch { -brand-shorter-name }
    .accesskey = o
menu-help-import-from-another-browser =
    .label = Daten aus einem anderen Browser importieren…
    .accesskey = r
menu-help-keyboard-shortcuts =
    .label = Tastenkombinationen
    .accesskey = T
menu-help-troubleshooting-info =
    .label = Informationen zur Fehlerbehebung
    .accesskey = z
menu-help-feedback-page =
    .label = Feedback senden…
    .accesskey = s
menu-help-safe-mode-without-addons =
    .label = Mit deaktivierten Add-ons neu starten…
    .accesskey = A
menu-help-safe-mode-with-addons =
    .label = Mit aktivierten Add-ons neu starten
    .accesskey = A
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Betrügerische Website melden…
    .accesskey = m
menu-help-not-deceptive =
    .label = Dies ist keine betrügerische Website…
    .accesskey = g
