general-sentence-separator = { " " }
general-key-control = Control
general-key-shift = Shift
general-key-alt = Alt
general-key-option = Option
general-key-command = Command
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
general-print = Afdrukken
general-remove = Verwijderen
general-add = Toevoegen
general-remind-me-later = Herinner mij later
general-dont-ask-again = Niet meer vragen
general-choose-file = Kies bestand…
general-open-settings = Instellingen
general-settings = Settings…
general-help = Help
general-tag = Label
general-done = Klaar
general-view-troubleshooting-instructions = View Troubleshooting Instructions
general-go-back = Go Back
general-accept = Accept
general-cancel = Annuleren
general-show-in-library = In bibliotheek tonen
general-restartApp = Restart { -app-name }
general-restartInTroubleshootingMode = Restart in Troubleshooting Mode
general-save = Opslaan
general-clear = Wissen
general-update = Update
general-back = Terug
general-edit = Bewerken
general-cut = Knippen
general-copy = Kopiëren
general-paste = Plakken
general-find = Zoeken
general-delete = Verwijder
general-insert = Invoegen
general-and = en
general-et-al = e.a.
general-previous = Previous
general-next = Next
general-learn-more = Meer info
general-warning = Waarschuwing
general-type-to-continue = Type “{ $text }” to continue.
general-continue = Doorgaan
general-red = Rood
general-orange = Oranje
general-yellow = Geel
general-green = Groen
general-teal = Teal
general-blue = Blauw
general-purple = Paars
general-magenta = Magenta
general-violet = Violet
general-maroon = Maroon
general-gray = Grijs
general-black = Zwart
general-loading = Laden…
citation-style-label = Citation Style:
language-label = Taal:
menu-custom-group-submenu =
    .label = More Options…
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = Bestand tonen
menu-file-show-files =
    .label = Bestanden tonen
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = Bijlage toevoegen
new-note = Nieuwe aantekening
menu-add-by-identifier =
    .label = Add by Identifier…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Bestand Toevoegen...
menu-add-standalone-linked-file-attachment =
    .label = Koppeling naar bestand maken…
menu-add-child-file-attachment =
    .label = Bestand Toevoegen...
menu-add-child-linked-file-attachment =
    .label = Koppeling naar bestand toevoegen…
menu-add-child-linked-url-attachment =
    .label = Web Koppeling Toevoegen...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nieuwe zelfstandige aantekening
menu-new-item-note =
    .label = Hoofditem maken...
menu-restoreToLibrary =
    .label = Terugzetten in bibliotheek
menu-deletePermanently =
    .label = Permanent verwijderen…
menu-tools-plugins =
    .label = Plugins
menu-view-columns-move-left =
    .label = Kolom Naar Links Verplaatsen
menu-view-columns-move-right =
    .label = Kolom Naar Rechts Verplaatsen
menu-view-hide-context-annotation-rows =
    .label = Hide Non-Matching Annotations
menu-view-note-font-size =
    .label = Lettergrootte notities
menu-view-note-tab-font-size =
    .label = Note Tab Font Size
menu-show-tabs-menu =
    .label = Show Tabs Menu
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Copy Annotation
           *[other] Copy { $count } Annotations
        }
main-window-command =
    .label = Bibliotheek
main-window-key =
    .key = b
zotero-toolbar-tabs-menu =
    .tooltiptext = Alle tabbladen tonen
filter-collections = Verzameling Filteren
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = In Tabbladen Zoeken
zotero-tabs-menu-close-button =
    .title = Tabblad Sluiten
zotero-toolbar-tabs-scroll-forwards =
    .title = Scroll forwards
zotero-toolbar-tabs-scroll-backwards =
    .title = Scroll backwards
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Verzameling Hernoemen
collections-menu-edit-saved-search =
    .label = Bewaarde zoekopdracht bewerken
collections-menu-move-collection =
    .label = Verplaats Naar
collections-menu-copy-collection =
    .label = Kopieer Naar
item-creator-moveDown =
    .label = Verplaats naar beneden
item-creator-moveToTop =
    .label = Naar bovenkant verplaatsen
item-creator-moveUp =
    .label = Verplaats naar boven
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
    .label = Bestand
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Web Link
item-menu-change-parent-item =
    .label = Hoofditem wijzigen
item-menu-relate-items =
    .label = Relate Items
view-online = Bekijk online
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = File renamed to { $filename }
itembox-button-options =
    .tooltiptext = Open context menu
itembox-button-merge =
    .aria-label = Select version of { $field } field
create-parent-intro = Enter a DOI, ISBN, PMID, arXiv ID, or ADS Bibcode to identify this file:
reader-use-dark-mode-for-content =
    .label = Use Dark Mode for Content
update-updates-found-intro-minor = An update for { -app-name } is available:
update-updates-found-desc = It is recommended that you apply this update as soon as possible.
import-window =
    .title = Importeren
import-where-from = Waaruit wilt u importeren?
import-online-intro-title = Introductie
import-source-file =
    .label = Een bestand (BibTeX, RIS, Zotero RDF, etc.)
import-source-folder =
    .label = Een map met PDF's of andere bestanden
import-source-online =
    .label = { $targetApp } online import
import-options = Opties
import-importing = Importeren…
import-create-collection =
    .label = Geïmporteerde verzamelingen en items in een nieuwe verzameling plaatsen
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDF Bestanden
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Bestandsverwerking
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Link to files in original location
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Nieuwe items alleen downloaden; eerder geïmporteerde items niet bijwerken
import-mendeley-username = Gebruikersnaam
import-mendeley-password = Wachtwoord
general-error = Fout
file-interface-import-error = Er is een fout opgetreden bij het importeren van het geselecteerde bestand. Controleer dat het bestand correct is en probeer opnieuw.
file-interface-import-complete = Importeren voltooid
file-interface-items-were-imported =
    { $numItems ->
        [0] No items were imported
        [one] One item was imported
       *[other] { $numItems } items were imported
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] No items were relinked
        [one] One item was relinked
       *[other] { $numRelinked } items were relinked
    }
import-mendeley-encrypted = The selected Mendeley database cannot be read, likely because it is encrypted. See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
file-interface-import-error-translator = An error occurred importing the selected file with “{ $translator }”. Please ensure that the file is valid and try again.
import-online-intro = In the next step you will be asked to log in to { $targetAppOnline } and grant { -app-name } access. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-intro2 = { -app-name } will never see or store your { $targetApp } password.
import-online-form-intro = Please enter your credentials to log in to { $targetAppOnline }. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-wrong-credentials = Login to { $targetApp } failed. Please re-enter credentials and try again.
import-online-blocked-by-plugin = The import cannot continue with { $plugin } installed. Please disable this plugin and try again.
import-online-relink-only =
    .label = Relink Mendeley Desktop citations
import-online-relink-kb = Meer informatie
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Fout rapporteren…
rtfScan-wizard =
    .title = RTF Scan
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. It currently supports citations in variations of the following formats:
rtfScan-introPage-description2 = Selecteer een RTF-invoerbestand en een uitvoerbestand om te beginnen:
rtfScan-input-file = Input File:
rtfScan-output-file = Output File:
rtfScan-no-file-selected = Geen bestand geselecteerd
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page = Introductie
rtfScan-scan-page = Bezig met zoeken naar verwijzingen
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page = Geciteerde items controleren
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page = Opmaken van het document
rtfScan-format-page = Verwijzingen opmaken
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page = RTF-scan voltooid
rtfScan-complete-page-description = Uw document is gescand en verwerkt. Controleer of de tekst goed is opgemaakt.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Run JavaScript
runJS-editor-label = Code:
runJS-run = Run
runJS-help = { general-help }
runJS-completed = completed successfully
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Run as async function
bibliography-window =
    .title = { -app-name } - Create Citation/Bibliography
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Geavanceerde opties
bibliography-outputMode-label = Weergavemodus:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliografie
bibliography-outputMethod-label = Weergavemethode:
bibliography-outputMethod-saveAsRTF =
    .label = Bewaar als RTF
bibliography-outputMethod-saveAsHTML =
    .label = Bewaar als HTML
bibliography-outputMethod-copyToClipboard =
    .label = Kopieer naar klembord
bibliography-outputMethod-print =
    .label = Afdrukken
bibliography-manageStyles-label = Stijlen beheren…
styleEditor-locatorType =
    .aria-label = Locator type
styleEditor-locatorInput = Locator input
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Style editor
styleEditor-preview =
    .aria-label = Preview
publications-intro-page = Mijn Publicaties
publications-intro = Items you add to My Publications will be shown on your profile page on zotero.org. If you choose to include attached files, they will be made publicly available under the license you specify. Only add work you yourself have created, and only include files if you have the rights to distribute them and wish to do so.
publications-include-checkbox-files =
    .label = Include files
publications-include-checkbox-notes =
    .label = Include notes
publications-include-adjust-at-any-time = You can adjust what to show at any time from the My Publications collection.
publications-intro-authorship =
    .label = I created this work.
publications-intro-authorship-files =
    .label = I created this work and have the rights to distribute included files.
publications-sharing-page = Kiezen hoe uw werk gedeeld mag worden
publications-sharing-keep-rights-field =
    .label = Keep the existing Rights field
publications-sharing-keep-rights-field-where-available =
    .label = Keep the existing Rights field where available
publications-sharing-text = You can reserve all rights to your work, license it under a Creative Commons license, or dedicate it to the public domain. In all cases, the work will be made publicly available via zotero.org.
publications-sharing-prompt = Wilt u anderen toestaan om uw werk te delen?
publications-sharing-reserved =
    .label = Nee, publiceer mijn werk alleen op zotero.org
publications-sharing-cc =
    .label = Ja, onder een Creative Commons-licentie
publications-sharing-cc0 =
    .label = Yes, and place my work in the public domain
publications-license-page = Een Creative Commons-licentie kiezen
publications-choose-license-text = A Creative Commons license allows others to copy and redistribute your work as long as they give appropriate credit, provide a link to the license, and indicate if changes were made. Additional conditions can be specified below.
publications-choose-license-adaptations-prompt = Allow adaptations of your work to be shared?
publications-choose-license-yes =
    .label = Ja
    .accesskey = Y
publications-choose-license-no =
    .label = Nee
    .accesskey = N
publications-choose-license-sharealike =
    .label = Yes, as long as others share alike
    .accesskey = S
publications-choose-license-commercial-prompt = Staat u commercieel gebruik van uw werk toe?
publications-buttons-add-to-my-publications =
    .label = Toevoegen aan Mijn publicaties
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Kies een licentie
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Attribution 4.0 International License
licenses-cc-by-nd = Creative Commons Attribution-NoDerivatives 4.0 International License
licenses-cc-by-sa = Creative Commons Attribution-ShareAlike 4.0 International License
licenses-cc-by-nc = Creative Commons Attribution-NonCommercial 4.0 International License
licenses-cc-by-nc-nd = Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License
licenses-cc-by-nc-sa = Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = O
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Density
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-item-details = Item Details
pane-info = Info
pane-abstract = Samenvatting
pane-attachments = Bijlagen
pane-notes = Aantekeningen
pane-note-info = Note Info
pane-libraries-collections = Libraries and Collections
pane-tags = Labels
pane-related = Gerelateerd
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = Annotations
pane-header-attachment-associated =
    .label = Wijzig naam geassocieerd bestand
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } Attachment
           *[other] { $count } Attachments
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } Annotation
           *[other] { $count } Annotations
        }
section-attachments-move-to-trash-message = Are you sure you want to move “{ $title }” to the trash?
section-notes =
    .label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } Tag
           *[other] { $count } Tags
        }
section-related =
    .label = { $count } Related
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Expand section
    .label = Expand { $section } section
section-button-collapse =
    .dynamic-tooltiptext = Collapse section
    .label = Collapse { $section } section
annotations-count =
    { $count ->
        [one] { $count } Annotation
       *[other] { $count } Annotations
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
    .label = Move Section Up
sidenav-reorder-down =
    .label = Move Section Down
sidenav-reorder-reset =
    .label = Reset Section Order
toggle-item-pane =
    .tooltiptext = Toggle Item Pane
toggle-context-pane =
    .tooltiptext = Toggle Context Pane
pin-section =
    .label = Pin Section
unpin-section =
    .label = Unpin Section
collapse-other-sections =
    .label = Collapse Other Sections
expand-all-sections =
    .label = Expand All Sections
abstract-field =
    .placeholder = Add abstract…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filter Tags
context-notes-search =
    .placeholder = Search Notes
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Nieuwe verzameling…
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Nieuwe verzameling
    .buttonlabelaccept = Create Collection
new-collection-name = Naam:
new-collection-create-in = Create in:
show-publications-menuitem =
    .label = Show My Publications
attachment-info-title = Titel
attachment-info-filename = Bestandsnaam
attachment-info-accessed = Geraadpleegd
attachment-info-pages = Pagina's
attachment-info-modified = Bewerkt
attachment-info-index = Geïndexeerd
attachment-info-convert-note =
    .label =
        Migrate to { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } Note
    .tooltiptext = Adding notes to attachments is no longer supported, but you can edit this note by migrating it to a separate note.
section-note-info =
    .label = { pane-note-info }
note-info-title = Titel
note-info-parent-item = Parent Item
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] None
    }
    .title =
        { $hasParentItem ->
            [true] View parent item in library
           *[false] View note item in library
        }
note-info-date-created = Created
note-info-date-modified = Bewerkt
note-info-size = Grootte
note-info-word-count = Word Count
note-info-character-count = Character Count
item-title-empty-note = Aantekening zonder titel
attachment-preview-placeholder = No attachment to preview
attachment-rename-from-parent =
    .tooltiptext = Rename File to Match Parent Item
file-renaming-auto-rename-prompt-title = Renaming Settings Changed
file-renaming-auto-rename-prompt-body = Would you like to rename existing files in your library to match the new settings?
file-renaming-auto-rename-prompt-yes = Preview Changes…
file-renaming-auto-rename-prompt-no = Keep Existing Filenames
rename-files-preview =
    .buttonlabelaccept = Rename Files
rename-files-preview-loading = Laden…
rename-files-preview-intro = { -app-name } will rename the following files in your library to match their parent items:
rename-files-preview-renaming = Renaming…
rename-files-preview-no-files = All filenames already match parent items. No changes are required.
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } Attachment Preview
annotation-image-not-available = [Image not available]
quicksearch-mode =
    .aria-label = Quick Search mode
quicksearch-input =
    .aria-label = Snelzoeken
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = Geen
item-pane-header-title =
    .label = Titel
item-pane-header-titleCreatorYear =
    .label = Titel, Maker, Jaar
item-pane-header-bibEntry =
    .label = Bibliography Entry
item-pane-header-more-options =
    .label = More Options
item-pane-message-items-selected =
    { $count ->
        [0] No items selected
        [one] { $count } item selected
       *[other] { $count } items selected
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } collection selected
       *[other] { $count } collections selected
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } search selected
       *[other] { $count } searches selected
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } object selected
       *[other] { $count } objects selected
    }
item-pane-message-unselected =
    { $count ->
        [0] No items in this view
        [one] { $count } item in this view
       *[other] { $count } items in this view
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] No objects in this view
        [one] { $count } object in this view
       *[other] { $count } objects in this view
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Merge { $count } item
           *[other] Merge { $count } items
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = Switch to 64-bit { -app-name } for the best performance. Your data won’t be affected.
architecture-warning-action = Download 64-bit { -app-name }
architecture-x64-on-arm64-message = { -app-name } is running in emulated mode. A native version of { -app-name } will run more efficiently.
architecture-x64-on-arm64-action = Download { -app-name } for ARM64
first-run-guidance-authorMenu = { -app-name } lets you specify editors and translators too. You can turn an author into an editor or translator by selecting from this menu.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Search condition
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Value
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] { $count } file added
       *[other] { $count } files added
    }
select-items-window =
    .title = Items selecteren
select-items-dialog =
    .buttonlabelaccept = Select
select-items-convertToStandalone =
    .label = Convert to Standalone
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Convert to Standalone Attachment
           *[other] Convert to Standalone Attachments
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Convert to Standalone Note
           *[other] Convert to Standalone Notes
        }
file-type-webpage = Webpage
file-type-image = Afbeelding
file-type-pdf = PDF
file-type-audio = Audio
file-type-video = Video
file-type-presentation = Presentatie
file-type-document = Document
file-type-ebook = Ebook
post-upgrade-message = You’ve been upgraded to <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Learn about <a data-l10n-name="new-features-link">what’s new</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Paste and Search
mac-word-plugin-install-message = Zotero needs access to Word data to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = Install Word plugin
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
file-renaming-banner-message = { -app-name } now automatically keeps attachment filenames in sync as you make changes to items.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = The { -app-name } Connector must be updated to work with this version of { -app-name }.
userjs-pref-warning = Some { -app-name } settings have been overridden using an unsupported method. { -app-name } will revert them and restart.
migrate-extra-fields-progress-message = Migrating new fields from Extra field
long-tag-fixer-window-title =
    .title = Split Tags
long-tag-fixer-button-dont-split =
    .label = Don’t Split
menu-normalize-attachment-titles =
    .label = Normalize Attachment Titles…
normalize-attachment-titles-title = Normalize Attachment Titles
normalize-attachment-titles-text =
    { -app-name } automatically renames files on disk using parent item metadata, but it uses separate, simpler titles such as “Full Text PDF”, “Preprint PDF”, or “PDF” for primary attachments to keep the items list cleaner and avoid duplicating information.
    
    In older versions of { -app-name }, as well as when using certain plugins, attachment titles could be changed unnecessarily to match the filenames.
    
    Would you like to update the selected attachments to use simpler titles? Only primary attachments with titles that match the filename will be changed.
