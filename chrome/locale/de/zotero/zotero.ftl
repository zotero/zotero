general-sentence-separator = { " " }
general-key-control = Steuerung
general-key-shift = Shift
general-key-alt = Alt
general-key-option = Option
general-key-command = Befehlstaste
option-or-alt =
    { PLATFORM() ->
        [macos] { general-key-option }
       *[other] { general-key-alt }
    }
command-or-control =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-control }
    }
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
delete-or-backspace =
    { PLATFORM() ->
        [macos] Delete
       *[other] Backspace
    }
-os-name =
    { PLATFORM() ->
        [macos] macOS
        [windows] Windows
       *[other] Linux
    }
general-print = Drucken
general-remove = Entfernen
general-add = Hinzufügen
general-remind-me-later = Später erinnern
general-dont-ask-again = Nicht erneut fragen
general-choose-file = Datei auswählen...
general-open-settings = Einstellungen öffnen
general-settings = Einstellungen...
general-help = Hilfe
general-tag = Tag
general-got-it = Verstanden
general-done = Erledigt
general-view-troubleshooting-instructions = Anleitung zur Problembehebung anzeigen
general-go-back = Zurück
general-accept = Akzeptieren
general-cancel = Abbrechen
cancel-button =
    .label = { general-cancel }
general-show-in-library = In Bibliothek anzeigen
general-restartApp = { -app-name } neustarten
general-restartInTroubleshootingMode = Im Problembehebungsmodus neustarten
general-save = Speichern
general-clear = Zurücksetzen
clear-button =
    .label = { general-clear }
general-update = Aktualisieren
general-back = Zurück
general-edit = Bearbeiten
general-cut = Ausschneiden
general-copy = Kopieren
general-paste = Einfügen
general-find = Suchen
general-delete = Löschen
general-insert = Objekt einfügen
general-and = und
general-et-al = et al.
general-previous = Nächstes
general-next = Vorheriges
general-learn-more = Mehr erfahren
general-more-information = Weitere Informationen
general-warning = Warnung
general-type-to-continue = Drücke "{ $text }" um fortzufahren.
general-continue = Weiter
general-red = Rot
general-orange = Orange
general-yellow = Gelb
general-green = Grün
general-teal = Türkis
general-blue = Blau
general-purple = Lila
general-magenta = Magenta
general-violet = Violett
general-maroon = Braun
general-gray = Grau
general-black = Schwarz
general-loading = Lädt...
db-checking-integrity = Checking database integrity…
db-repairing = Repairing database…
citation-style-label = Zitierstil:
language-label = Sprache:
menu-custom-group-submenu =
    .label = Mehr Optionen…
menu-file-show-in-finder =
    .label = In Finder anzeigen
menu-file-show-file =
    .label = Datei anzeigen
menu-file-show-files =
    .label = Dateien anzeigen
menu-print =
    .label = { general-print }
menu-density =
    .label = Dichte
add-attachment = Anhang hinzufügen
new-note = Neue Notiz
menu-add-by-identifier =
    .label = Über Identifier hinzufügen…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Datei hinzufügen…
menu-add-standalone-linked-file-attachment =
    .label = Link zu Datei hinzufügen…
menu-add-child-file-attachment =
    .label = Datei anhängen…
menu-add-child-linked-file-attachment =
    .label = Link auf Datei anhängen...
menu-add-child-linked-url-attachment =
    .label = Weblink anhängen…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Neue eigenständige Notiz
menu-new-item-note =
    .label = Neue Eintragsnotiz
menu-restoreToLibrary =
    .label = In der Bibliothek wiederherstellen
menu-deletePermanently =
    .label = Endgültig löschen…
menu-tools-plugins =
    .label = Plugins
menu-view-columns-move-left =
    .label = Spalte nach links verschieben
menu-view-columns-move-right =
    .label = Spalte nach rechts verschieben
menu-view-hide-context-annotation-rows =
    .label = Nicht passende Anmerkungen ausblenden
menu-view-note-font-size =
    .label = Schriftgröße Notizen
menu-view-note-tab-font-size =
    .label = Schriftgröße des Notizen-Tabs
menu-show-tabs-menu =
    .label = Zeige Tabs-Menü
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Kopiere Annotation
           *[other] Kopiere { $count } Annotationen
        }
main-window-command =
    .label = Bibliothek
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = Alle Tabs auflisten
filter-collections = Sammlungen filtern
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Tabs durchsuchen
zotero-tabs-menu-close-button =
    .title = Tab schließen
zotero-toolbar-tabs-scroll-forwards =
    .title = Vorwärts scrollen
zotero-toolbar-tabs-scroll-backwards =
    .title = Rückwärts scrollen
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
recently-read = Kürzlich Gelesene
collections-menu-show-recently-read =
    .label = { recently-read } anzeigen
item-menu-remove-from-recently-read =
    .label = Aus { recently-read } entfernen…
items-section-collections-selected =
    { $count ->
        [one] { $count } Sammlung ausgewählt
       *[other] { $count } Sammlungen ausgewählt
    }
items-section-searches-selected =
    { $count ->
        [one] { $count } saved search selected
       *[other] { $count } saved searches selected
    }
items-section-sources-selected =
    { $count ->
        [one] { $count } source selected
       *[other] { $count } sources selected
    }
items-section-library-collections =
    { $count ->
        [one] { $library } ({ $count } collection selected)
       *[other] { $library } ({ $count } collections selected)
    }
items-section-library-searches =
    { $count ->
        [one] { $library } ({ $count } saved search selected)
       *[other] { $library } ({ $count } saved searches selected)
    }
items-section-library-sources =
    { $count ->
        [one] { $library } ({ $count } source selected)
       *[other] { $library } ({ $count } sources selected)
    }
items-section-library-recently-read = { $library } ({ recently-read })
items-section-library = { $library }
collections-menu-rename =
    .label = Rename
edit-saved-search = Gespeicherte Suche bearbeiten
collections-menu-edit-search =
    .label = Edit Search
collections-menu-duplicate-search =
    .label = Duplicate Search
collections-menu-move-collection =
    .label = Verschieben nach
collections-menu-copy-collection =
    .label = Kopieren nach
collections-menu-export =
    .label = Exportieren...
collections-menu-generate-report =
    .label = Generate Report…
collections-menu-create-bibliography =
    .label = Create Bibliography…
collections-menu-unsubscribe =
    .label = Unsubscribe…
collections-menu-delete =
    .label =
        { $count ->
            [one] Delete Collection…
           *[other] Delete Collections…
        }
collections-menu-delete-with-items =
    .label =
        { $count ->
            [one] Delete Collection and Items…
           *[other] Delete Collections and Items…
        }
collections-menu-delete-search =
    .label =
        { $count ->
            [one] Delete Search…
           *[other] Delete Searches…
        }
collections-delete-title =
    { $count ->
        [one] Delete Collection
       *[other] Delete Collections
    }
collections-delete-message =
    { $count ->
        [one] Are you sure you want to delete this collection?
       *[other] Are you sure you want to delete { $count } collections?
    }
collections-delete-keep-items =
    { $count ->
        [one] Items within this collection will not be deleted.
       *[other] Items within these collections will not be deleted.
    }
collections-delete-with-items-title =
    { $count ->
        [one] Delete Collection and Items
       *[other] Delete Collections and Items
    }
collections-delete-with-items-message =
    { $count ->
        [one] Are you sure you want to delete this collection and move all items within it to the Trash?
       *[other] Are you sure you want to delete { $count } collections and move all items within them to the Trash?
    }
collections-delete-search-title =
    { $count ->
        [one] Delete Search
       *[other] Delete Searches
    }
collections-delete-search-message =
    { $count ->
        [one] Are you sure you want to delete this search?
       *[other] Are you sure you want to delete { $count } searches?
    }
item-creator-moveDown =
    .label = Nach unten verschieben
item-creator-moveToTop =
    .label = An den Anfang verschieben
item-creator-moveUp =
    .label = Nach oben verschieben
item-menu-viewAttachment =
    .label =
        Open { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Snapshot
                    [note] Note
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                    [note] Notes
                   *[other] Attachments
                }
        } { $openIn ->
            [tab] in New Tab
            [window] in New Window
           *[other] { "" }
        }
item-menu-add-file =
    .label = Datei
item-menu-add-linked-file =
    .label = Verlinkte Datei
item-menu-add-url =
    .label = Weblink
item-menu-change-parent-item =
    .label = Übergeordneten Eintrag ändern...
item-menu-relate-items =
    .label = Verwandte Artikel
view-online = Online anzeigen
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Datei als { $filename } umbenannt
itembox-button-options =
    .tooltiptext = Kontextmenü öffnen
itembox-button-merge =
    .aria-label = Version des { $field }-Feldes auswählen
create-parent-intro = Geben Sie eine DOI, ISBN, PMID, arXiv ID oder einen ADS Bibcode ein, um diese Datei zu identifizieren:
reader-use-dark-mode-for-content =
    .label = Dunklen Modus für Inhalt verwenden
update-updates-found-intro-minor = Ein Update für  { -app-name } ist verfügbar:
update-updates-found-desc = Es wird empfohlen, das Update so bald wie möglich durchzuführen
import-window =
    .title = Importieren
import-where-from = Von wo aus möchten Sie importieren?
import-online-intro-title = Einführung
import-source-file =
    .label = Einer Datei (BibTeX, RIS, Zotero RDF, etc.)
import-source-folder =
    .label = Ein Ordner mit PDFs oder anderen Dateien
import-source-online =
    .label = { $targetApp } Online-Import
import-options = Optionen
import-importing = Importieren...
import-create-collection =
    .label = Importierte Sammlungen und Einträge in neue Sammlungen einstellen
import-recreate-structure =
    .label = Ordnerstruktur durch Sammlungen nachbilden
import-fileTypes-header = Dateitypen, die importiert werden sollen:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Andere Dateien nach Muster, durch Komma getrennt (z.B. *.jpg, *.png)
import-file-handling = Dateiverarbeitung
import-file-handling-store =
    .label = Dateien in den  { -app-name }-Speicherordner kopieren
import-file-handling-link =
    .label = Link zu Dateien am ursprünglichen Speicherort
import-fileHandling-description = Verlinkte Dateien können nicht von { -app-name } synchronisiert werden.
import-online-new =
    .label = Nur neue Einträge herunterladen; zuvor importierte Einträge nicht aktualisieren
import-mendeley-username = Benutzername
import-mendeley-password = Passwort
general-error = Fehler
file-interface-import-error = Beim Importieren der ausgewählten Datei ist ein Fehler aufgetreten. Bitte überprüfen Sie, ob die Datei korrekt ist, und versuchen Sie es erneut.
file-interface-import-complete = Importieren abgeschlossen
file-interface-items-were-imported =
    { $numItems ->
        [0] Kein Eintrag importiert
        [one] Ein Eintrag importiert
       *[other] { $numItems } Einträge importiert
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Kein Eintrag wurde erneut verknüpft
        [one] Ein Eintrag wurde erneut verknüpft
       *[other] { $numRelinked } Einträge wurden erneut verknüpft
    }
import-mendeley-encrypted = Die ausgewählte Mendeley-Datenbank kann nicht gelesen werden, wahrscheinlich weil sie verschlüsselt ist. Lesen Sie <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero? (Englisch)</a> für mehr Informationen.
file-interface-import-error-translator = Beim Importieren der ausgewählten Datei mit „{ $translator }“ ist ein Fehler aufgetreten. Bitte überprüfen Sie, ob die Datei korrekt ist, und versuchen Sie es erneut.
import-online-intro = Im nächsten Schritt werden Sie gebeten, sich in { $targetAppOnline } einzuloggen und { -app-name } Zugriff zu gewähren. Dies ist notwendig, um Ihre { $targetApp }-Bibliothek in { -app-name } zu importieren.
import-online-intro2 = { -app-name } wird ihr { $targetApp }-Passwort niemals sehen oder speichern.
import-online-form-intro = Bitte geben Sie Ihre Anmeldedaten für { $targetAppOnline } ein. Dies ist notwendig, um Ihre { $targetApp }-Bibliothek in { -app-name } zu importieren.
import-online-wrong-credentials = Anmeldung bei { $targetApp } fehlgeschlagen. Bitte geben Sie Ihre Anmeldedaten erneut ein und versuchen Sie es noch einmal.
import-online-blocked-by-plugin = Der Import kann nicht fortgesetzt werden, wenn { $plugin } installiert ist. Bitte deaktivieren Sie dieses Plugin und versuchen Sie es erneut.
import-online-relink-only =
    .label = Zitationen aus Mendeley Desktop erneut vernküfen
import-online-relink-kb = { general-more-information }
import-online-connection-error = { -app-name } konnte sich nicht mit { $targetApp } verbinden. Bitte überprüfen Sie Ihre Internetverbindung und wiederholen Sie den Vorgang.
tab-title-multiple-collections = Multiple
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Notiz ausgewählt
           *[other] { $count } Notizen ausgewählt
        }
items-column-added-by = Hinzugefügt durch
items-column-modified-by = Geändert durch
items-column-last-read = Zuletzt gelesen
report-error =
    .label = Fehler melden...
rtfScan-wizard =
    .title = RTF-Scan
rtfScan-introPage-description = { -app-name } kann Zitationen automatisch extrahieren und neu formatieren und ein Literaturverzeichnis in RTF-Dateien einfügen. Das RTF-Scan-Modul unterstützt im Moment Zitationen in Variationen der folgenden Formate:
rtfScan-introPage-description2 = Als ersten Schritt wählen Sie eine RTF-Datei als Input und eine Output-Datei aus:
rtfScan-input-file = Input-Datei:
rtfScan-output-file = Output-Datei:
rtfScan-no-file-selected = Keine Datei ausgewählt
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Input-Datei wählen
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Output-Datei wählen
rtfScan-intro-page = Einführung
rtfScan-scan-page = Scanne Zitationen
rtfScan-scanPage-description = { -app-name } scannt Ihr Dokument nach Zitationen. Bitte haben Sie Geduld.
rtfScan-citations-page = Zitierte Einträge überprüfen
rtfScan-citations-page-description = Bitte überprüfen Sie die Liste der erkannten Zitationen, um sicher zu stellen, dass { -app-name } die zusammengehörigen Einträge korrekt erkannt hat. Alle nicht zugeordneten oder uneindeutigen Zitationen müssen korrigiert werden, bevor Sie fortfahren.
rtfScan-style-page = Dokument-Formatierung
rtfScan-format-page = Formatiere Zitationen
rtfScan-format-page-description = { -app-name } verarbeitet gerade Ihre RTF-Datei und formatiert sie. Bitte warten Sie.
rtfScan-complete-page = RTF-Scan abgeschlossen
rtfScan-complete-page-description = Ihr Dokument wurde gescannt und bearbeitet. Bitte überprüfen Sie, ob es korrekt formatiert wurde.
rtfScan-action-find-match =
    .title = Zugehörigen Eintrag auswählen
rtfScan-action-accept-match =
    .title = Diesen Treffer annehmen
runJS-title = JavaScript ausführen
runJS-editor-label = Code:
runJS-run = Ausführen
runJS-help = { general-help }
runJS-completed = erfolgreich abgeschlossen
runJS-result =
    { $type ->
        [async] Rückgabewert:
       *[other] Ergebnis:
    }
runJS-run-async = Als async-Funktion ausführen
bibliography-window =
    .title = { -app-name } - Zitation/Bibliographie erstellen
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Literaturangaben anzeigen als:
bibliography-advancedOptions-label = Erweiterte Einstellungen
bibliography-outputMode-label = Ausgabemodus:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Zitationen
            [note] Notizen
           *[other] Zitationen
        }
bibliography-outputMode-bibliography =
    .label = Bibliografie
bibliography-outputMethod-label = Ausgabemethode:
bibliography-outputMethod-saveAsRTF =
    .label = Als RTF speichern
bibliography-outputMethod-saveAsHTML =
    .label = Als HTML speichern
bibliography-outputMethod-copyToClipboard =
    .label = In die Zwischenablage kopieren
bibliography-outputMethod-print =
    .label = Drucken
bibliography-manageStyles-label = Stile verwalten...
styleEditor-locatorType =
    .aria-label = Art der Fundstelle
styleEditor-locatorInput = Fundstellen-Eingabe
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Zitierstil-Editor
styleEditor-preview =
    .aria-label = Vorschau
publications-intro-page = Meine Veröffentlichungen
publications-intro = Einträge, die Sie zu Meine Veröffentlichungen hinzufügen, werden auf Ihrer Profilseite auf Zotero.org angezeigt. Wenn Sie die Option "Dateien verfügbar machen" auswählen, werden die Dateianhänge unter der von Ihnen gewählten Lizenz öffentlich verfügbar gemacht. Fügen Sie nur Werke hinzu, die Sie selbst erstellt haben, und laden wählen Sie diese Option nur dann, wenn Sie zur Verbreitung der Dateien berechtigt sind und sie öffentlich verfügbar machen wollen.
publications-include-checkbox-files =
    .label = Anhänge verfügbar machen
publications-include-checkbox-notes =
    .label = Notizen verfügbar machen
publications-include-adjust-at-any-time = Sie können das, was angezeigt wird, jederzeit über die Sammlung Meine Veröffentlichungen ändern.
publications-intro-authorship =
    .label = Ich habe dieses Werk erstellt.
publications-intro-authorship-files =
    .label = Ich habe dieses Werk erstellt und ich habe die Nutzungsrechte, um die enthaltenen Dateien zu verbreiten.
publications-sharing-page = Wählen Sie aus, wie Ihr Werk geteilt werden darf.
publications-sharing-keep-rights-field =
    .label = Existierendes Rechte-Feld beibehalten
publications-sharing-keep-rights-field-where-available =
    .label = Existierende Rechte-Felder (wenn vorhanden) beibehalten
publications-sharing-text = Sie können sich alle Rechte auf Ihr Werk vorbehalten, es unter einer Creative-Commons-Lizenz stellen oder das Werk gemeinfrei machen. Unter jeder dieser Optionen wird das Werk auf zotero.org öffentlich zugänglich gemacht.
publications-sharing-prompt = Wollen Sie anderen erlauben, Ihr Werk zu teilen?
publications-sharing-reserved =
    .label = Nein, ich möchte mein Werk nur auf zotero.org verfügbar machen
publications-sharing-cc =
    .label = Ja, unter einer Creative-Commons-Lizenz
publications-sharing-cc0 =
    .label = Ja, und ich stelle mein Werk gemeinfrei
publications-license-page = Wählen Sie eine Creative-Commons-Lizenz
publications-choose-license-text = Eine Creative-Commons-Lizenz erlaubt es anderen, Ihr Werk zu vervielfältigen und weiterzuvertreiben, solange Sie als Urheber korrekt aufgeführt werden, ein Link zur Lizenz vorhanden ist und kenntlich gemacht wird, ob Bearbeitungen am ursprünglichen Werk gemacht wurden. Sie können zusätzliche Bedingungen unten auswählen.
publications-choose-license-adaptations-prompt = Erlauben, dass Bearbeitungen Ihres Werkes geteilt werden?
publications-choose-license-yes =
    .label = Ja
    .accesskey = Y
publications-choose-license-no =
    .label = Nein
    .accesskey = N
publications-choose-license-sharealike =
    .label = Ja, solange andere unter denselben Bedingungen weitergeben
    .accesskey = S
publications-choose-license-commercial-prompt = Kommerzielle Nutzungen Ihres Werkes erlauben?
publications-buttons-add-to-my-publications =
    .label = Zu Meine Veröffentlichungen hinzufügen
publications-buttons-next-sharing =
    .label = Weiter: Teilen
publications-buttons-next-choose-license =
    .label = Wählen Sie eine Lizenz
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Namensnennung 4.0 Internationale Lizenz
licenses-cc-by-nd = Creative Commons Namensnennung - Keine Bearbeitungen 4.0 Internationale Lizenz
licenses-cc-by-sa = Creative Commons Namensnennung - Weitergabe unter gleichen Bedingungen 4.0 Internationale Lizenz
licenses-cc-by-nc = Creative Commons Namensnennung - Nicht kommerziell 4.0 Internationale Lizenz
licenses-cc-by-nc-nd = Creative Commons Namensnennung - Nicht kommerziell - Keine Bearbeitungen 4.0 Internationale Lizenz
licenses-cc-by-nc-sa = Creative Commons Namensnennung - Nicht kommerziell - Weitergabe unter gleichen Bedingungen 4.0 Internationale Lizenz
licenses-cc-more-info = Stellen Sie sicher, dass Sie die <a data-l10n-name="license-considerations">Informationen über Creative-Commons-Lizenzen</a> gelesen haben, bevor Sie Ihr Arbeit unter einer CC-Lizenz veröffentlichen. Beachten Sie, dass die verwendete Lizenz unwiderruflich ist, auch wenn sie später eine andere Lizenz verwenden oder die Veröffentlichung einstellen
licenses-cc0-more-info = Stellen Sie sicher, dass Sie die <a data-l10n-name="license-considerations">CC0-FAQ</a> gelesen haben, bevor Sie Ihre Arbeit unter der CC0-Lizenz veröffentlichen. Beachten Sie, dass Sie die damit erteilte Freigabe nicht widerrufen können, auch wenn sie später eine andere Lizenz verwenden oder die Veröffentlichung einstellen.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Im Problembehebungsmodus neustarten…
    .accesskey = P
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } wird mit deaktivierten Plugins neu starten. Manche Funktionen funktionieren im Problembehebungsmodus möglicherweise nicht korrekt.
menu-ui-density =
    .label = Dichte
menu-ui-density-comfortable =
    .label = Locker
menu-ui-density-compact =
    .label = Kompakt
pane-item-details = Eintragsdetails
pane-info = Infos
pane-abstract = Zusammenfassung
pane-attachments = Anhänge
pane-notes = Notizen
pane-note-info = Notizinformation
pane-libraries-collections = Bibliotheken und Sammlungen
pane-tags = Tags
pane-related = Zugehörig
pane-attachment-info = Informationen zum Anhang
pane-attachment-preview = Vorschau
pane-attachment-annotations = Anmerkungen
pane-header-attachment-associated =
    .label = Zugehörige Datei umbenennen
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } Anhang
           *[other] { $count } Anhänge
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } Anmerkung ausgewählt.
           *[other] { $count } Anmerkungen ausgewählt
        }
section-attachments-move-to-trash-message = Sind Sie sicher, dass Sie den “{ $title }” in den Papierkorb verschieben wollen?
section-notes =
    .label =
        { $count ->
            [one] { $count } Notiz ausgewählt
           *[other] { $count } Notizen ausgewählt
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } Tag ausgewählt
           *[other] { $count } Tags ausgewählt
        }
section-related =
    .label = { $count } verwandt
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Abschnitt ausklappen
    .label = { $section }-Abschnitt ausklappen
section-button-collapse =
    .dynamic-tooltiptext = Abschnitt einklappen
    .label = { $section }-Abschnitt einklappen
annotations-count =
    { $count ->
        [one] { $count } Anmerkung ausgewählt.
       *[other] { $count } Anmerkungen ausgewählt
    }
section-button-annotations =
    .title = { annotations-count }
    .aria-label = { annotations-count }
attachment-preview =
    .aria-label = { pane-attachment-preview }
sidenav-info =
    .tooltiptext = { pane-info }
sidenav-abstract =
    .tooltiptext = { pane-abstract }
sidenav-attachments =
    .tooltiptext = { pane-attachments }
sidenav-notes =
    .tooltiptext = { pane-notes }
sidenav-note-info =
    .tooltiptext = { pane-note-info }
sidenav-attachment-info =
    .tooltiptext = { pane-attachment-info }
sidenav-attachment-preview =
    .tooltiptext = { pane-attachment-preview }
sidenav-attachment-annotations =
    .tooltiptext = { pane-attachment-annotations }
sidenav-libraries-collections =
    .tooltiptext = { pane-libraries-collections }
sidenav-tags =
    .tooltiptext = { pane-tags }
sidenav-related =
    .tooltiptext = { pane-related }
sidenav-main-btn-grouping =
    .aria-label = { pane-item-details }
sidenav-reorder-up =
    .label = Abschnitt nach oben schieben
sidenav-reorder-down =
    .label = Abschnitt nach unten schieben
sidenav-reorder-reset =
    .label = Abschnitts-Sortierung zurücksetzen
toggle-item-pane =
    .tooltiptext = Eintragungsbereich umschalten
toggle-context-pane =
    .tooltiptext = Kontextbereich umschalten
pin-section =
    .label = Abschnitt anpinnen
unpin-section =
    .label = Abschnitt nicht mehr anpinnen
collapse-other-sections =
    .label = Andere Abschnitte einklappen
expand-all-sections =
    .label = Alle Abschnitte ausklappen
abstract-field =
    .placeholder = Abstract hinzufügen…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Tags filtern
context-notes-search =
    .placeholder = Notizen durchsuchen
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Neue Sammlung...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Neue Sammlung
    .buttonlabelaccept = Sammlung erstellen
new-collection-name = Name:
new-collection-create-in = Erstellen in:
show-publications-menuitem =
    .label = Zeige meine Veröffentlichungen
attachment-info-title = Titel
attachment-info-filename = Dateiname
attachment-info-accessed = Zugriffsdatum
attachment-info-pages = Seiten
attachment-info-modified = Geändert am
attachment-info-index = Indiziert
attachment-info-convert-note =
    .label =
        Zu { $type ->
            [standalone] eigenständiger Notiz
            [child] Eintragsnotiz
           *[unknown] neuer Notiz
        } migrieren
    .tooltiptext = Es ist nicht mehr möglich, Notizen zu Anhängen hinzuzufügen, aber Sie können diese Notiz bearbeiten, indem Sie diese zu einer separaten Notiz umwandeln.
section-note-info =
    .label = { pane-note-info }
note-info-title = Titel
note-info-parent-item = Übergeordneter Eintrag
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] None
    }
    .title =
        { $hasParentItem ->
            [true] Übergeordneten Eintrag in der Bibliothek ansehen
           *[false] Notiz in der Bibliothek ansehen
        }
note-info-date-created = Erstellt
note-info-date-modified = Geändert am
note-info-size = Größe
note-info-word-count = Wortzahl
note-info-character-count = Zeichenzahl
item-title-empty-note = Notiz ohne Titel
attachment-preview-placeholder = Kein Anhang für die Vorschau
attachment-rename-from-parent =
    .tooltiptext = Dateien nach übergeordnetem Eintrag umbenennen
account-log-in = Anmelden
account-not-logged-in-text = Mit einem Zotero-Account anmelden, um die Daten zu synchronisieren.
account-error-login-session-expired = Ihre Sitzung ist abgelaufen. Bitte versuchen Sie es erneut.
toggle-preview =
    .label =
        Anhangsvorschau { $type ->
            [open] verstecken
            [collapsed] anzeigen
           *[unknown] umschalten
        }
annotation-image-not-available = [Bild nicht verfügbar]
quicksearch-mode =
    .aria-label = Schnellsuche-Modus
quicksearch-input =
    .aria-label = Schnellsuche
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
advanced-search = Erweiterte Suche
menuitem-advanced-search =
    .label = { advanced-search }
quicksearch-advanced-search-button =
    .tooltiptext = { advanced-search }
    .aria-label = { advanced-search }
advanced-search-close =
    .tooltiptext = Close Advanced Search
advanced-search-expand =
    .tooltiptext = Expand Advanced Search
advanced-search-collapse =
    .tooltiptext = Collapse Advanced Search
item-pane-header-view-as =
    .label = Ansehen als
item-pane-header-none =
    .label = Kein Icon
item-pane-header-title =
    .label = Titel
item-pane-header-titleCreatorYear =
    .label = Titel, Verfasser, Jahr
item-pane-header-bibEntry =
    .label = Bibliographieeintrag
item-pane-header-more-options =
    .label = Mehr Optionen
item-pane-message-items-selected =
    { $count ->
        [0] Kein EIntrag ausgewählt
        [one] { $count } Eintrag ausgewählt
       *[other] { $count } Einträge ausgewählt
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } Sammlung ausgewählt
       *[other] { $count } Sammlungen ausgewählt
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } Suche ausgewählt
       *[other] { $count } Suchen ausgewählt
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } Objekt ausgewählt
       *[other] { $count } Objekte ausgewählt
    }
item-pane-message-unselected =
    { $count ->
        [0] Keine Einträge in dieser Ansicht
        [one] { $count } Eintrag in dieser Ansicht
       *[other] { $count } Einträge in dieser Ansicht
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] Kein Objekt in dieser Ansicht
        [one] { $count } Objekt in dieser Ansicht
       *[other] { $count } Objekte in dieser Ansicht
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] { $count } Eintrag zusammenführen
           *[other] { $count } Einträge zusammenführen
        }
locate-library-lookup-no-resolver = Sie müssen in den { -app-name }-Einstellungen unter { $pane } einen Resolver auswählen.
architecture-win32-warning-message = Für die beste Leistung zur 64-Bit-Version von { -app-name } wechseln. Ihre Daten werden dadurch nicht verändert.
architecture-warning-action = 64-Bit { -app-name }-Version herunterladen
architecture-x64-on-arm64-message = { -app-name } wird aktuell im emulierten Modus ausgeführt. Eine native Version von { -app-name } wird effizienter laufen.
architecture-x64-on-arm64-action = { -app-name } für ARM64 herunterladen
first-run-guidance-authorMenu = { -app-name } ermöglicht es Ihnen, auch Herausgeber und Übersetzer anzugeben. Sie können einen Autor zum Übersetzer machen, indem Sie in diesem Menü die entsprechende Auswahl treffen.
first-run-guidance-readAloud = { -app-name } kann jetzt Ihre Dokumente mit natürlich klingenden Stimmen vorlesen.
advanced-search-remove-btn =
    .tooltiptext = Remove Condition
advanced-search-add-btn =
    .tooltiptext = Add Condition
advanced-search-group-btn =
    .tooltiptext = Add Condition Group
advanced-search-remove-group-btn =
    .tooltiptext = Remove Group
advanced-search-ungroup-btn =
    .tooltiptext = Ungroup Conditions
advanced-search-result-level-menu =
    .aria-label = Result type
advanced-search-result-level-prefix-root =
    .value = Suchen
advanced-search-join-prefix-root =
    .value = matching
advanced-search-result-level-any =
    .label = any items
advanced-search-result-level-item =
    .label = top-level items
advanced-search-result-level-attachment =
    .label = attachments
advanced-search-result-level-note =
    .label = notes
advanced-search-result-level-annotation =
    .label = Anmerkungen
advanced-search-binding-menu =
    .aria-label = Match against the same item
advanced-search-binding-separate =
    .label = separately
advanced-search-binding-same-attachment =
    .label = in the same attachment
advanced-search-binding-same-note =
    .label = in the same note
advanced-search-binding-same-annotation =
    .label = in the same annotation
advanced-search-of-the-following =
    .value = of the following
advanced-search-binding-hint-attachment =
    .value = These conditions can match separate attachments.
advanced-search-binding-hint-note =
    .value = These conditions can match separate notes.
advanced-search-binding-hint-annotation =
    .value = These conditions can match separate annotations.
advanced-search-level-warning-mixed = These conditions cannot all match the same item, so this search will never return results. Try matching “{ $matchAny }” of them, or set the result type to “{ $topLevelItems }”.
advanced-search-level-warning-unreachable = This search has a condition that cannot apply to the chosen result type. Set the result type to “{ $topLevelItems }” or remove the incompatible condition.
advanced-search-group-warning-unreachable =
    A condition here cannot be in the same { $entity ->
        [attachment] attachment
        [note] note
       *[annotation] annotation
    }. Match these separately or remove the incompatible condition.
advanced-search-group-warning-mixed = These conditions cannot all match the same item, so this group will never match. Try matching “{ $matchAny }” of them, or set the result type to “{ $topLevelItems }”.
advanced-search-bind-same-attachment =
    .label = Match the same attachment
advanced-search-bind-same-note =
    .label = Match the same note
advanced-search-bind-same-annotation =
    .label = Match the same annotation
advanced-search-conditions-menu =
    .aria-label = Suchbedingung
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Wert
    .label = { $label }
search-operator-isEmpty = is empty
search-operator-isNotEmpty = is not empty
search-conditions-tooltip-fields = Felder:
search-conditions-collection = Sammlung
search-conditions-savedSearch = Gespeicherte Suche
search-conditions-itemTypeID = Eintragsart
search-conditions-tag = Tag
search-conditions-numTags = # of Tags
search-conditions-numNotes = # of Notes
search-conditions-numAttachments = # of Attachments
search-conditions-numAnnotations = # of Annotations
search-conditions-note = Fußnote
search-conditions-childNote = Unter-Notiz
search-conditions-creator = Ersteller
search-conditions-thesisType = Art der Dissertation
search-conditions-reportType = Art des Berichts
search-conditions-videoRecordingFormat = Videoformat
search-conditions-audioFileType = Art der Audiodatei
search-conditions-audioRecordingFormat = Audioformat
search-conditions-letterType = Art des Briefs
search-conditions-interviewMedium = Medium des Interviews
search-conditions-manuscriptType = Art des Manuskripts
search-conditions-presentationType = Art des Vortrags
search-conditions-mapType = Art der Karte
search-conditions-artworkMedium = Medium des Kunstwerks
search-conditions-dateModified = geändert am
search-conditions-fulltextContent = Inhalt des Anhangs
search-conditions-programmingLanguage = Programmiersprache
search-conditions-fileTypeID = Dateityp des Anhangs
search-conditions-attachmentStorageType = Attachment Storage Type
search-conditions-lastRead = Zuletzt gelesener Anhang
search-conditions-annotationText = Text der Anmerkung
search-conditions-annotationComment = Kommentar zur Anmerkung
search-conditions-annotationType = Annotation Type
search-conditions-annotationColor = Annotation Color
search-conditions-annotationAuthor = Annotation Author
search-conditions-anyField = Beliebiges Feld
search-conditions-titleCreatorYear = Titel, Verfasser, Jahr
search-conditions-submenu-attachment = Anhang
search-conditions-submenu-annotation = Anmerkung
search-conditions-short-fulltextContent = Content
search-conditions-short-fileTypeID = Dateityp
search-conditions-short-attachmentStorageType = Storage Type
search-conditions-short-lastRead = Zuletzt gelesen
search-conditions-short-annotationText = Text
search-conditions-short-annotationComment = Comment
search-conditions-short-annotationType = Art
search-conditions-short-annotationColor = Color
search-conditions-short-annotationAuthor = Autor
find-pdf-files-added =
    { $count ->
        [one] { $count } Datei hinzugefügt
       *[other] { $count } Dateien hinzugefügt
    }
select-items-window =
    .title = Einträge auswählen
select-items-dialog =
    .buttonlabelaccept = Auswählen
select-items-convertToStandalone =
    .label = Zu eigenständigem Eintrag umwandeln
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Zu eigenständigem Anhang umwandeln
           *[other] Zu eigenständigen Anhängen umwandeln
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Zu eigenständiger Notiz umwandeln
           *[other] Zu eigenständigen Notizen umwandeln
        }
file-type-webpage = Webseite
file-type-image = Bild
file-type-pdf = PDF
file-type-audio = Audio
file-type-video = Video
file-type-presentation = Vortrag
file-type-document = Dokument
file-type-ebook = eBook
attachment-storage-type-storedFile = Stored File
attachment-storage-type-linkedFile = Linked File
attachment-storage-type-webLink = Web Link
post-upgrade-message = Es wurde ein Update auf <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span> vorgenommen! Erfahren Sie mehr über die <a data-l10n-name="new-features-link">Änderungen</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Einfügen und suchen
mac-word-plugin-install-message = Zotero muss auf die Daten von Word zugreifen, um das Word-Plugin zu installieren.
mac-word-plugin-install-folder-message = { -app-name } needs access to Word’s startup folder to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = Word-Plugin installieren
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Install the plugin in the Word startup folder
mac-word-plugin-install-folder-dialog-button = Installieren
mac-word-plugin-install-wrong-folder-selected = The suggested folder must be selected. Please try again without choosing a different folder.
file-renaming-banner-message = { -app-name } synchronisiert nun automatisch die Dateinamen von angehängten Dateien mit den Einträgen, wenn diese geändert werden.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = Der { -app-name } Connector muss aktualisiert werden um mit dieser Version von { -app-name } zu funktionieren.
userjs-pref-warning = Einige Einstellungen von { -app-name } wurden mit einer nicht unterstützten Methode überschrieben. { -app-name } wird diese zurücksetzen und neu starten.
migrate-extra-fields-progress-message = Daten aus dem Extra-Feld in neue Felder migrieren
search-normalization-progress-message = Indexing items for search
long-tag-fixer-window-title =
    .title = Tags aufteilen
long-tag-fixer-button-dont-split =
    .label = Nicht aufteilen
menu-normalize-attachment-titles =
    .label = Bezeichnungen von Anhängen normalisieren…
normalize-attachment-titles-title = Bezeichnungen von Anhängen normalisieren
normalize-attachment-titles-text =
    { -app-name } benennt Dateien auf der Festplatte automatisch anhand der Metadaten des übergeordneten Eintrags um. Innerhalb des Programms werden aber davon unabhängige, einfachere Bezeichnungen wie "Full Text PDF" oder "Preprint PDF" für die primären Anhänge verwendet, um die Liste übersichtlicher zu halten und redundante Informationen zu vermeiden.
    
    In vorangegangenen Versionen von { -app-name } und bei der Verwendung bestimmter Plugins konnte es vorgenommen, dass die Bezeichnung von Anhängen unnötigerweise geändert worden sind, um den Dateinamen zu entsprechen.
    
    Sollen die ausgewählten Anhänge mit vereinfachten Bezeichnungen aktualisiert werden? Nur die primären Anhänge mit Bezeichnungen, die dem Dateinamen entsprechen, werden geändert.
banner-close-button =
    .aria-label = Benachrichtigung verwerfen
plugins-blocked-plugin =
    .message = Dieses Plugin wurde durch { -app-name } deaktiviert.
data-dir-unsupported-storage = Das kann passieren, wenn das { -app-name } Datenverzeichnis in einem Cloudspeicher-Ordner (OneDrive, Dropbox etc.) oder in einem Netzwerkverzeichnis liegt.
login-manager-reset = { -app-name } was unable to read your saved login information, so it has been reset. Please log in again in the { preferences-pane-account } pane of the { -app-name } settings.
os-keystore-save-failed =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t access the { -os-name } Keychain to securely save your credentials. Make sure your Keychain is accessible and try again.
        [windows] { -app-name } couldn’t securely save your credentials. Try again or restart { -app-name }.
       *[other] { -app-name } couldn’t access your { -os-name } keyring to securely save your credentials. Make sure a keyring service is running and try again.
    }
os-keystore-migrate-failed =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t access the { -os-name } Keychain to encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Make sure your Keychain is accessible and restart { -app-name }.
        [windows] { -app-name } couldn’t encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Restart { -app-name } and try again.
       *[other] { -app-name } couldn’t access your { -os-name } keyring to encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Make sure a keyring service is running and restart { -app-name }.
    }
search-button =
    .label = Suche
save-search-new-button =
    .label = Save Search…
save-search-edit-button =
    .label = Speichern
save-search-name-title = Suche speichern
save-search-name-message = Enter a name for the saved search:
saved-search-close-confirmation-title = Editing Saved Search
saved-search-close-confirmation-body = Do you want to save changes you made to this saved search?
item-pane-batch-editing-prompt =
    .aria-label = Batch editing
item-pane-batch-editing-enable =
    .label = Edit Multiple Items…
item-pane-batch-editing-multiple-values-placeholder = Multiple
item-pane-batch-editing-clear-values = Clear all values
item-pane-batch-editing-header =
    { $count ->
        [one] Editing { $count } item
       *[other] Editing { $count } items
    }
item-pane-batch-editing-done =
    .label = { general-done }
undo-action-edit-metadata =
    { $count ->
        [one] Edit Metadata
       *[other] Edit Metadata for { $count } Items
    }
undo-action-edit-field =
    { $count ->
        [one] Edit of “{ $field }”
       *[other] Edit of “{ $field }” for { $count } Items
    }
undo-action-normalize-attachment-titles = Normalize Attachment Title
undo-action-trash =
    { $count ->
        [one] Trash Item
       *[other] Trash { $count } Items
    }
undo-action-restore-items =
    { $count ->
        [one] Restore Item
       *[other] Restore { $count } Items
    }
undo-action-trash-collection =
    { $count ->
        [one] Trash Collection
       *[other] Trash { $count } Collections
    }
undo-action-trash-search =
    { $count ->
        [one] Trash Saved Search
       *[other] Trash { $count } Saved Searches
    }
undo-action-restore-collection =
    { $count ->
        [one] Restore Collection
       *[other] Restore { $count } Collections
    }
undo-action-restore-objects =
    { $count ->
        [one] Restore Object
       *[other] Restore { $count } Objects
    }
undo-action-add-to-collection =
    { $count ->
        [one] Add to Collection
       *[other] Add { $count } Items to Collection
    }
undo-action-remove-from-collection =
    { $count ->
        [one] Remove from Collection
       *[other] Remove { $count } Items from Collection
    }
undo-action-move-to-collection =
    { $count ->
        [one] Move to Collection
       *[other] Move { $count } Items to Collection
    }
undo-action-rename-collection = Sammlung umbenennen
undo-action-move-collection = Move Collection
undo-action-add-tag =
    { $count ->
        [one] Add Tag
       *[other] Add Tag to { $count } Items
    }
undo-action-change-tag = Change Tag
undo-action-split-tag = Split Tag
undo-action-remove-tag =
    { $count ->
        [one] Remove Tag
       *[other] Remove Tag from { $count } Items
    }
undo-action-remove-tags-from-item =
    { $count ->
        [one] Remove Tag
       *[other] Remove { $count } Tags
    }
undo-action-remove-all-tags = Remove All Tags
undo-action-edit-note = Notiz bearbeiten
undo-action-add-creator = Add Creator
undo-action-remove-creator = Remove Creator
undo-action-edit-creator = Edit Creator
undo-action-reorder-creator = Reorder Creator
undo-action-change-type = Eintragsart ändern
undo-action-change-parent-item =
    { $count ->
        [one] Change Parent Item
       *[other] Change Parent for { $count } Items
    }
undo-action-convert-to-standalone =
    { $count ->
        [one] Convert to Standalone
       *[other] Convert { $count } Items to Standalone
    }
undo-action-add-related = Add Related
undo-action-remove-related = Remove Related
undo-action-merge-items =
    { $count ->
        [one] Merge Item
       *[other] Merge { $count } Items
    }
menu-edit-undo-action = Undo { $action }
menu-edit-redo-action = Redo { $action }
