general-print = Drucken
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Entfernen
general-add = Hinzufügen
general-remind-me-later = Später erinnern
general-choose-file = Datei auswählen...
general-open-settings = Einstellungen öffnen
general-help = Hilfe
general-tag = Tag
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
main-window-command =
    .label = { -app-name }
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
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Sammlung umbenennen
collections-menu-edit-saved-search =
    .label = Gespeicherte Suche bearbeiten
item-creator-moveDown =
    .label = Nach unten verschieben
item-creator-moveToTop =
    .label = An den Anfang verschieben
item-creator-moveUp =
    .label = Nach oben verschieben
item-menu-viewAttachment =
    .label =
        Öffne { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Snapshot
                   *[other] Anhang
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                   *[other] Anhänge
                }
        } { $openIn ->
            [tab] in einem neuen Tab
            [window] in einem neuen Fenster
           *[other] { "" }
        }
item-menu-add-file =
    .label = Datei
item-menu-add-linked-file =
    .label = Verlinkte Datei
item-menu-add-url =
    .label = Weblink
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
import-online-relink-kb = Weitere Informationen
import-online-connection-error = { -app-name } konnte sich nicht mit { $targetApp } verbinden. Bitte überprüfen Sie Ihre Internetverbindung und wiederholen Sie den Vorgang.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Notiz ausgewählt
           *[other] { $count } Notizen ausgewählt
        }
report-error =
    .label = Fehler melden...
rtfScan-wizard =
    .title = RTF-Scan
rtfScan-introPage-description = { -app-name } Kann automatisch Zitationen aus einer RTF-Datei extrahieren, neu formatieren und eine Bibliographie erstellen. Wählen Sie unten eine RTF-Datei aus, um den Prozess zu beginnen.
rtfScan-introPage-description2 = Als ersten Schritt wählen Sie eine RTF-Datei als Input und eine Output-Datei aus:
rtfScan-input-file = Input-Datei
rtfScan-output-file = Output-Datei
rtfScan-no-file-selected = Keine Datei ausgewählt
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Input-Datei wählen
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Output-Datei wählen
rtfScan-intro-page =
    .label = Einführung
rtfScan-scan-page =
    .label = Scanne Zitationen
rtfScan-scanPage-description = { -app-name } scannt Ihr Dokument nach Zitationen. Bitte haben Sie Geduld.
rtfScan-citations-page =
    .label = Zitierte Einträge überprüfen
rtfScan-citations-page-description = Bitte überprüfen Sie die Liste der erkannten Zitationen, um sicher zu stellen, dass { -app-name } die zusammengehörigen Einträge korrekt erkannt hat. Alle nicht zugeordneten oder uneindeutigen Zitationen müssen korrigiert werden, bevor Sie fortfahren.
rtfScan-style-page =
    .label = Dokumenten-Formatierung
rtfScan-format-page =
    .label = Formatiere Zitationen
rtfScan-format-page-description = { -app-name } verarbeitet gerade Ihre RTF-Datei und formatiert sie. Bitte warten Sie.
rtfScan-complete-page =
    .label = RTF-Scan abgeschlossen
rtfScan-complete-page-description = Ihr Dokument wurde gescannt und bearbeitet. Bitte überprüfen Sie, ob es korrekt formatiert wurde.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = JavaScript ausführen
runJS-editor-label = Code:
runJS-run = Ausführen
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Rückgabewert:
       *[other] Ergebnis:
    }
runJS-run-async = Als async-Funktion ausführen
bibliography-window =
    .title = { -app-name } - Zitation/Bibliographie erstellen
bibliography-style-label = Zitierstil:
bibliography-locale-label = Sprache:
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
integration-docPrefs-window =
    .title = { -app-name } - Dokumenteinstellungen
integration-addEditCitation-window =
    .title = { -app-name } - Zitation hinzufügen/bearbeiten
integration-editBibliography-window =
    .title = { -app-name } - Literaturverzeichnis bearbeiten
integration-quickFormatDialog-window =
    .title = { -app-name } - Schnellformatierung Zitation
integration-prefs-displayAs-label = Literaturangaben anzeigen als:
integration-prefs-footnotes =
    .label = Fußnoten
integration-prefs-endnotes =
    .label = Endnoten
integration-prefs-bookmarks =
    .label = Zitation als Lesezeichen speichern
integration-prefs-bookmarks-description = Lesezeichen können zwischen Microsoft Word und OpenOffice.org geteilt werden, aber dies ist fehleranfällig falls diese versehentlich verändert werden und können nicht als Fußnoten benutzt werden.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Das Dokument muss als .doc oder .docx gespeichert werden
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Automatisch Zitationen aktualisieren
    .tooltip = Zitationen mit anstehenden Aktualisierungen werden im Dokument hervorgehoben
integration-prefs-automaticCitationUpdates-description = Das Deaktivieren von automatischen Aktualisierungen kann das Einfügen von Zitationen in großen Dokumenten beschleunigen. Zitationen können dann manuell aktualisiert werden durch das Klicken Sie auf Aktualisieren.
integration-prefs-automaticJournalAbbeviations =
    .label = Abgekürzte Zeitschriftentitel von MEDLINE verwenden
integration-prefs-automaticJournalAbbeviations-description = Das Feld "Zeitschriften-Abkürzung" wird ignoriert.
integration-prefs-exportDocument =
    .label = Textverarbeitungsprogramm wechseln...
publications-intro-page =
    .label = Meine Veröffentlichungen
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
publications-sharing-page =
    .label = Wählen Sie aus, wie Ihr Werk geteilt werden darf.
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
publications-license-page =
    .label = Wählen Sie eine Creative-Commons-Lizenz
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
restart-in-troubleshooting-mode-menuitem =
    .label = Im Problembehebungsmodus neustarten…
    .accesskey = P
restart-in-troubleshooting-mode-dialog-title = Im Problembehebungsmodus neustarten
restart-in-troubleshooting-mode-dialog-description = { -app-name } wird mit deaktivierten Plugins neu starten. Manche Funktionen funktionieren im Problembehebungsmodus möglicherweise nicht korrekt.
menu-ui-density =
    .label = Dichte
menu-ui-density-comfortable =
    .label = Locker
menu-ui-density-compact =
    .label = Kompakt
pane-info = Infos
pane-abstract = Zusammenfassung
pane-attachments = Anhänge
pane-notes = Notizen
pane-libraries-collections = Bibliotheken und Sammlungen
pane-tags = Tags
pane-related = Zugehörig
pane-attachment-info = Informationen zum Anhang
pane-attachment-preview = Vorschau
pane-attachment-annotations = Anmerkungen
pane-header-attachment-associated =
    .label = Zugehörige Datei umbenennen
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
new-collection-dialog =
    .title = Neue Sammlung
    .buttonlabelaccept = Sammlung erstellen
new-collection-name = Name:
new-collection-create-in = Erstellen in:
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
attachment-preview-placeholder = Kein Anhang für die Vorschau
toggle-preview =
    .label =
        Anhangsvorschau { $type ->
            [open] verstecken
            [collapsed] anzeigen
           *[unknown] umschalten
        }
quickformat-general-instructions =
    Die Pfeiltasten verwenden, um zwischen den Einträgen in dieser Zitation zu navigieren. { $dialogMenu ->
        [active] Shift+Tab drücken, um das Menü des Dialogs zu fokussieren
       *[other] { "" }
    } { return-or-enter } drücken, um Änderungen an dieser Zitation zu speichern. Mit Escape die Änderungen verwerfen und den Dialog schließen.
quickformat-aria-bubble = Dieser Eintrag ist Teil der Zitation. Drücken Sie die Leertaste, um ihn anzupassen. { quickformat-general-instructions }
quickformat-aria-input = Tippen um einen Eintrag zu suchen, der der Zitation hinzugefügt werden soll. Mit Tab lässt sich die Ergebnisliste navigieren. { quickformat-general-instructions }
quickformat-aria-item = { return-or-enter } drücken, um dieses Objekt zum Zitat hinzuzufügen. Tab drücken, um zum Suchfeld zurückzukehren.
quickformat-accept =
    .tooltiptext = Bearbeitungen für diese Zitation speichern
quickformat-locator-type =
    .aria-label = Art der Fundstelle
quickformat-locator-value = Fundstelle
quickformat-citation-options =
    .tooltiptext = Zitations-Optionen anzeigen
insert-note-aria-input = Tippen um eine Notiz zu finden. Tab drücken, um in der Ergebnisliste zu navigieren. Escape drücken, um den Dialog zu schließen.
insert-note-aria-item = { return-or-enter } drücken, um diese Notiz auszuwählen. Tab drücken, um zurück ins Suchfeld zu wechseln. Escape, um den Dialog zu schließen.
quicksearch-mode =
    .aria-label = Schnellsuche-Modus
quicksearch-input =
    .aria-label = Schnellsuche
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
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
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] { $count } Eintrag zusammenführen
           *[other] { $count } Einträge zusammenführen
        }
locate-library-lookup-no-resolver = Sie müssen in den { -app-name }-Einstellungen unter { $pane } einen Resolver auswählen.
architecture-win32-warning-message = { -app-name } wird aktuell im 32-Bit-Modus auf einer 64-Bit-Version von Windows ausgeführt. { -app-name } wird im 64-Bit-Modus effizienter laufen.
architecture-warning-action = 64-Bit { -app-name }-Version herunterladen
first-run-guidance-quickFormat =
    Einen Titel, Autor und/oder ein Jahr eintippen, um nach einer Literaturangabe zu suchen.
    
    Nachdem Sie eine Auswahl getroffen haben, klicken Sie die Blase oder wählen sie diese mit der Tastatur aus und drücken Sie  ↓/Leertaste, um Zitationsoptionen wie Seitenzahl, Präfix oder Suffix anzuzeigen.
    
    Sie können auch direkt eine Seitenzahl hinzufügen, wenn Sie diese ihrer Suche hinzufügen oder indem Sie diese hinter der Blase eintragen und { return-or-enter } drücken.
first-run-guidance-authorMenu = { -app-name } ermöglicht es Ihnen, auch Herausgeber und Übersetzer anzugeben. Sie können einen Autor zum Übersetzer machen, indem Sie in diesem Menü die entsprechende Auswahl treffen.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Suchbedingung
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Wert
    .label = { $label }
