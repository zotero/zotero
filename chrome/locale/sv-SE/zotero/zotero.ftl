general-sentence-separator = { " " }
general-key-control = Control
general-key-shift = Skift
general-key-alt = Alt
general-key-option = Alternativ
general-key-command = Kommando
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
general-print = Skriv ut
general-remove = Ta bort
general-add = Lägg till
general-remind-me-later = Påminn mig senare
general-dont-ask-again = Fråga inte igen
general-choose-file = Välj fil...
general-open-settings = Öppna inställningar
general-settings = Inställningar…
general-help = Hjälp
general-tag = Etikett
general-done = Klar
general-view-troubleshooting-instructions = View Troubleshooting Instructions
general-go-back = Gå bakåt
general-accept = Acceptera
general-cancel = Avbryt
general-show-in-library = Visa i biblioteket
general-restartApp = Starta om { -app-name }
general-restartInTroubleshootingMode = Starta om i felsökningsläge
general-save = Spara
general-clear = Rensa
general-update = Uppdatera
general-back = Bakåt
general-edit = Redigera
general-cut = Klipp ut
general-copy = Kopiera
general-paste = Klistra in
general-find = Hitta
general-delete = Radera
general-insert = Infoga
general-and = och
general-et-al = m. fl.
general-previous = Föregående
general-next = Nästa
general-learn-more = Läs mer
general-warning = Varning
general-type-to-continue = Type “{ $text }” to continue.
general-continue = Fortsätt
general-red = Röd
general-orange = Orange
general-yellow = Gul
general-green = Grön
general-teal = Teal
general-blue = Blå
general-purple = Lila
general-magenta = Magenta
general-violet = Violet
general-maroon = Maroon
general-gray = Grå
general-black = Svart
general-loading = Laddar…
citation-style-label = Referensstil
language-label = Språk:
menu-custom-group-submenu =
    .label = Fler alternativ...
menu-file-show-in-finder =
    .label = Visa i Finder
menu-file-show-file =
    .label = Visa fil
menu-file-show-files =
    .label = Visa filer
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = Lägg till bilaga
new-note = Ny anteckning
menu-add-by-identifier =
    .label = Add by Identifier…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Lägg till fil...
menu-add-standalone-linked-file-attachment =
    .label = Add Link to File…
menu-add-child-file-attachment =
    .label = Bifoga fil...
menu-add-child-linked-file-attachment =
    .label = Bifoga länk till fil...
menu-add-child-linked-url-attachment =
    .label = Bifoga webblänk...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Ny fristående anteckning
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = Återställ till bibliotek
menu-deletePermanently =
    .label = Radera permanent…
menu-tools-plugins =
    .label = Tillägg
menu-view-columns-move-left =
    .label = Flytta kolumn till vänster
menu-view-columns-move-right =
    .label = Flytta kolumn till höger
menu-view-note-font-size =
    .label = Teckenstorlek för anteckning
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
    .label = Bibliotek
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = List all tabs
filter-collections = Filtrera samlingar
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Search Tabs
zotero-tabs-menu-close-button =
    .title = Stäng flik
zotero-toolbar-tabs-scroll-forwards =
    .title = Rulla framåt
zotero-toolbar-tabs-scroll-backwards =
    .title = Rulla bakåt
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Byt namn på samling
collections-menu-edit-saved-search =
    .label = Redigera sparad sökning
collections-menu-move-collection =
    .label = Flytta till
collections-menu-copy-collection =
    .label = Kopiera till
item-creator-moveDown =
    .label = Flytta ner
item-creator-moveToTop =
    .label = Flytta överst
item-creator-moveUp =
    .label = Flytta upp
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
    .label = Arkiv
item-menu-add-linked-file =
    .label = Länkad fil
item-menu-add-url =
    .label = Webblänk
item-menu-change-parent-item =
    .label = Change Parent Item…
item-menu-relate-items =
    .label = Relate Items
view-online = Visa online
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
update-updates-found-intro-minor = En uppdatering för { -app-name } finns tillgänglig:
update-updates-found-desc = It is recommended that you apply this update as soon as possible.
import-window =
    .title = Importera
import-where-from = Varifrån vill du importera?
import-online-intro-title = Introduktion
import-source-file =
    .label = En fil (BibTeX, RIS, Zotero RDF, etc.)
import-source-folder =
    .label = A folder of PDFs or other files
import-source-online =
    .label = { $targetApp } online import
import-options = Alternativ
import-importing = Importerar…
import-create-collection =
    .label = Lägg importerade samlingar och källor i en ny samling
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = Filtyper att importera:
import-fileTypes-pdf =
    .label = PDF:er
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Filhantering
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Länka till filer i sin ursprungliga plats
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Download new items only; don’t update previously imported items
import-mendeley-username = Användarnamn
import-mendeley-password = Lösenord
general-error = Fel
file-interface-import-error = Ett fel uppstod när den valda filen skulle importeras. Var vänlig se till att filen är giltig och försök sedan igen.
file-interface-import-complete = Importering färdig
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
import-online-relink-kb = Mer information
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } anteckning
           *[other] { $count } anteckningar
        }
report-error =
    .label = Rapportera felet...
rtfScan-wizard =
    .title = RTF skanning
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. It currently supports citations in variations of the following formats:
rtfScan-introPage-description2 = Välj en RTF-fil nedan att ladda in och en att spara till:
rtfScan-input-file = Input File:
rtfScan-output-file = Output File:
rtfScan-no-file-selected = Ingen fil vald
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page = Introduktion
rtfScan-scan-page = Letar efter hänvisningar
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page = Bekräfta hänvisade källor
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page = Dokumentformat
rtfScan-format-page = Justerar källhänvisningar
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page = RTF-scanning färdig
rtfScan-complete-page-description = Ditt dokument har blivit bearbetat. Försäkra dig om att det är korrekt formaterat.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Kör JavaScript
runJS-editor-label = Kod:
runJS-run = Kör
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
bibliography-advancedOptions-label = Avancerade alternativ
bibliography-outputMode-label = Utmatningsläge
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Källförteckning
bibliography-outputMethod-label = Utmatningsmetod
bibliography-outputMethod-saveAsRTF =
    .label = Spara som RTF
bibliography-outputMethod-saveAsHTML =
    .label = Spara som HTML
bibliography-outputMethod-copyToClipboard =
    .label = Kopiera till urklipp
bibliography-outputMethod-print =
    .label = Skriv ut
bibliography-manageStyles-label = Hantera stilar…
styleEditor-locatorType =
    .aria-label = Locator type
styleEditor-locatorInput = Locator input
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Style editor
styleEditor-preview =
    .aria-label = Förhandsvisa
publications-intro-page = Mina publikationer
publications-intro = Källor du lägger till i Mina publikationer kommer att visas på din profilsida på zotero.org. Om du väljer att inkludera bifogade filer blir de tillgängliga enligt den licens du anger. Lägg endast till verk som du själv har skapat och bifoga bara filer om du har rätt att dela dem vidare och önskar att göra så.
publications-include-checkbox-files =
    .label = Inkludera filer
publications-include-checkbox-notes =
    .label = Inkludera anteckningar
publications-include-adjust-at-any-time = Du kan när som helst justera vad som ska visas från Mina publikationer-samlingen.
publications-intro-authorship =
    .label = Jag skapade detta verk.
publications-intro-authorship-files =
    .label = Jag skapade detta verk och har rättigheterna att distribuera bifogade filer.
publications-sharing-page = Välj hur ditt verk får delas
publications-sharing-keep-rights-field =
    .label = Behåll nuvarande rättighetsfält
publications-sharing-keep-rights-field-where-available =
    .label = Behåll nuvarande rättighetsfält om det är möjligt
publications-sharing-text = Du kan reservera alla rättigheter till det verk, licensiera det enligt en Creative Commons-licens eller överlämna det som allmän egendom (public domain). I samtliga fall kommer verket att vara tillgängligt för allmänheten via zotero.org.
publications-sharing-prompt = Medger du att ditt verk delas med andra?
publications-sharing-reserved =
    .label = Nej, publicera mitt verk endast på zotero.org
publications-sharing-cc =
    .label = Ja, med Creative Commns-licens
publications-sharing-cc0 =
    .label = Ja, gör mitt verk till allmän egendom
publications-license-page = Välj en Creative Commons-licens
publications-choose-license-text = En Creative Commons licens tillåter andra att kopiera och vidaredistribuera ditt verk, så länge de lämnar uppgifter om upphovspersonen, lämnar en länk till licensen and anger om de har gjort några ändringar. Ytterligare villkor kan anges nedan.
publications-choose-license-adaptations-prompt = Tillåtelse att bearbetningar av ditt verk delas?
publications-choose-license-yes =
    .label = Ja
    .accesskey = Y
publications-choose-license-no =
    .label = Nej
    .accesskey = N
publications-choose-license-sharealike =
    .label = Ja, så länge andra delar med samma villkor
    .accesskey = S
publications-choose-license-commercial-prompt = Tillåtelse att verket används kommersiellt?
publications-buttons-add-to-my-publications =
    .label = Lägg till Mina publikationer
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Välj en licens
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Attribution 4.0 International licens
licenses-cc-by-nd = Creative Commons Attribution-NoDerivatives 4.0 International licens
licenses-cc-by-sa = Creative Commons Attribution-ShareAlike 4.0 International licens
licenses-cc-by-nc = Creative Commons Attribution-NonCommercial 4.0 International licens
licenses-cc-by-nc-nd = Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International licens
licenses-cc-by-nc-sa = Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International licens
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Density
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Kompakt
pane-item-details = Item Details
pane-info = Information
pane-abstract = Sammanfattning
pane-attachments = Bilagor
pane-notes = Anteckningar
pane-note-info = Note Info
pane-libraries-collections = Bibliotek och samlingar
pane-tags = Etiketter
pane-related = Liknande källor
pane-attachment-info = Information om bilaga
pane-attachment-preview = Förhandsvisa
pane-attachment-annotations = Anteckningar
pane-header-attachment-associated =
    .label = Ändra namn på bifogad fil
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } bilaga
           *[other] { $count } bilagor
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
            [one] { $count } anteckning
           *[other] { $count } anteckningar
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } etikett
           *[other] { $count } etiketter
        }
section-related =
    .label = { $count } liknande
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
    .dynamic-tooltiptext = Stäng avsnitt
    .label = Stäng { $section } avsnitt
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
    .label = Stäng övriga avsnitt
expand-all-sections =
    .label = Expand All Sections
abstract-field =
    .placeholder = Lägg till sammanfattning …
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtrera etiketter
context-notes-search =
    .placeholder = Search Notes
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Ny samling...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Ny samling
    .buttonlabelaccept = Skapa samling
new-collection-name = Namn:
new-collection-create-in = Skapa i:
show-publications-menuitem =
    .label = Show My Publications
attachment-info-title = Titel
attachment-info-filename = Filnamn
attachment-info-accessed = Hämtdatum
attachment-info-pages = Sidor
attachment-info-modified = Ändrad den
attachment-info-index = Indexerad
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
note-info-date-modified = Ändrad den
note-info-size = Storlek
note-info-word-count = Word Count
note-info-character-count = Character Count
item-title-empty-note = Anteckning utan titel
attachment-preview-placeholder = Ingen bilaga att förhandsvisa
attachment-rename-from-parent =
    .tooltiptext = Rename File to Match Parent Item
file-renaming-auto-rename-prompt-title = Renaming Settings Changed
file-renaming-auto-rename-prompt-body = Would you like to rename existing files in your library to match the new settings?
file-renaming-auto-rename-prompt-yes = Preview Changes…
file-renaming-auto-rename-prompt-no = Behåll befintliga filnamn
rename-files-preview =
    .buttonlabelaccept = Byt namn på filer
rename-files-preview-loading = Laddar…
rename-files-preview-intro = { -app-name } will rename the following files in your library to match their parent items:
rename-files-preview-renaming = Byter namn...
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
    .aria-label = Snabbsökning
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Visa som
item-pane-header-none =
    .label = ingen ikon
item-pane-header-title =
    .label = Titel
item-pane-header-titleCreatorYear =
    .label = Titel, skapare, år
item-pane-header-bibEntry =
    .label = Bibliography Entry
item-pane-header-more-options =
    .label = Fler alternativ
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
architecture-warning-action = Hämta ner 64-bitars { -app-name }
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
    .aria-label = Värde
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] { $count } file added
       *[other] { $count } files added
    }
select-items-window =
    .title = Markera källor
select-items-dialog =
    .buttonlabelaccept = Välj
select-items-convertToStandalone =
    .label = Konvertera till fristående
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
file-type-webpage = Webbsida
file-type-image = Bild
file-type-pdf = PDF
file-type-audio = Ljud
file-type-video = Video
file-type-presentation = Presentation
file-type-document = Dokument
file-type-ebook = E-bok
post-upgrade-message = You’ve been upgraded to <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Learn about <a data-l10n-name="new-features-link">what’s new</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Klistra in och sök
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
