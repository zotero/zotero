general-print = Moullañ
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Dilemel
general-add = Ouzhpennañ
general-remind-me-later = Remind Me Later
general-choose-file = Diuzañ ur restr...
general-open-settings = Open Settings
general-help = Sikour
general-tag = Tag
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = Diskouez ar restr
menu-file-show-files =
    .label = Show Files
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = Ouzhpennañ ur pezh-stag
new-note = Notenn nevez
menu-add-by-identifier =
    .label = Add by Identifier…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Add File…
menu-add-standalone-linked-file-attachment =
    .label = Add Link to File…
menu-add-child-file-attachment =
    .label = Attach File…
menu-add-child-linked-file-attachment =
    .label = Stagañ ul liamm d'ar restr...
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Notenn dizalc'h nevez
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = Adsevel d'al levraoueg
menu-deletePermanently =
    .label = Dilemel da virviken...
menu-tools-plugins =
    .label = Plugins
main-window-command =
    .label = { -app-name }
zotero-toolbar-tabs-menu =
    .tooltiptext = List all tabs
filter-collections = Filter Collections
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Search Tabs
zotero-tabs-menu-close-button =
    .title = Close Tab
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Rename Collection
collections-menu-edit-saved-search =
    .label = Edit Saved Search
item-creator-moveDown =
    .label = War-draoñ
item-creator-moveToTop =
    .label = Fiñval d'al laez
item-creator-moveUp =
    .label = War-grec'h
item-menu-viewAttachment =
    .label =
        Open { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Snapshot
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                   *[other] Attachments
                }
        } { $openIn ->
            [tab] in New Tab
            [window] in New Window
           *[other] { "" }
        }
item-menu-add-file =
    .label = Restr
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Web Link
view-online = Diskouez enlinenn
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
    .title = Emporzhiañ
import-where-from = Deus pelec'h ho peus c'hoant emporzhiañ?
import-online-intro-title = Digoradur
import-source-file =
    .label = Ur restr (BibTeX, RIS, Zotero RDF, hag all hag all...)
import-source-folder =
    .label = A folder of PDFs or other files
import-source-online =
    .label = { $targetApp } online import
import-options = Dibarzhioù
import-importing = Oc'h emporzhiañ...
import-create-collection =
    .label = Plasit an dastumadegoù hag an teuliadoù emporzhiet e-barzh un dastumadeg nevez
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Meradur ar restroù
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Liammañ d'ar restroù el lec'hiadur orin
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Download new items only; don’t update previously imported items
import-mendeley-username = Username
import-mendeley-password = Password
general-error = Fazi
file-interface-import-error = Ur fazi a zo c'hoarvezet en ur glask emporzhiañ ar restr ziuzet. Klaskit gwelet hag-eñ eo ur restr talvoudus ha klaskit en-dro, mar plij.
file-interface-import-complete = Emporzhiañ echuet
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
import-online-relink-kb = Muioc'h a ditouroù
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Danevell fazi...
rtfScan-wizard =
    .title = Skan RTF
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = Evit stagañ ganti, diuzit ur restr RTF enmont hag ur restr ezvont dindan:
rtfScan-input-file = Restr enmont
rtfScan-output-file = Restr ezvont
rtfScan-no-file-selected = Restr ebet diuzet
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = Digoradur
rtfScan-scan-page =
    .label = Skanañ evit kavout arroudennoù
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = Gwiriañ an elfennoù arroudennet
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = Teuliad-aozañ
rtfScan-format-page =
    .label = Arroudenn-aozañ
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = Skan RTF klokaet
rtfScan-complete-page-description = Ho teuliad a zo bet skanet ha tretet bremañ. Grit e-seurt da vezañ asur eo bet stummet ez-reizh.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Run JavaScript
runJS-editor-label = Code:
runJS-run = Run
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Run as async function
bibliography-window =
    .title = { -app-name } - Create Citation/Bibliography
bibliography-style-label = Doare arroudenn:
bibliography-locale-label = Yezh:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Dibarzhioù araokaet
bibliography-outputMode-label = Mod ezvont:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Levrlennadur
bibliography-outputMethod-label = Hentenn ezvont:
bibliography-outputMethod-saveAsRTF =
    .label = Enrollañ dindan ar stumm RTF
bibliography-outputMethod-saveAsHTML =
    .label = Enrollañ dindan ar stumm HTML
bibliography-outputMethod-copyToClipboard =
    .label = Eilañ er golver
bibliography-outputMethod-print =
    .label = Moullañ
bibliography-manageStyles-label = Merañ ar stiloù...
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = Diskouez an arroudennoù evel:
integration-prefs-footnotes =
    .label = notennoù traoñ
integration-prefs-endnotes =
    .label = Notennoù fin
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = Ar sinedoù a c'hall bezañ rannet kenetre Word ha LibreOffice, gellout a reont degas fazioù padal ma vezont kemmet en ur gwallzarvoud ha n'hallint ket bezañ enlakaet evel notennoù traoñ.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Em-hizivaat an arroudennoù
    .tooltip = An arroudennoù o c'hortoz hizivadurioù a vo usskedet e-barzh an teuliad
integration-prefs-automaticCitationUpdates-description = Lazhañ an hizivadurioù a c'hall fonnusaat an enlakaat arroudennoù e-barzh an teuliadoù hir. Klikit war Freskaat evit hizivaat an arroudennoù gant an dorn.
integration-prefs-automaticJournalAbbeviations =
    .label = Implijout ar berradurioù kelaouennoù MEDLINE
integration-prefs-automaticJournalAbbeviations-description = Ar vaezienn Zotero "Berradur kelaouenn" a vo graet van outi.
integration-prefs-exportDocument =
    .label = Tremen d'un treter testennoù all…
publications-intro-page =
    .label = Ma Embannadennoù
publications-intro = Elfennoù da ouzhpennañ D'am Embannadennoù hag a vo diskouezet war pajenn ho profil war zotero.org. Ma tibabit enklozañ restroù-stag, lakaet e vint hegerz en un doare foran dindan al lisañs a vo termenet ganeoc'h. Ouzhpennit labourioù a zo bet krouet ganeoc'h hepken, hag enklozit ar restroù ho peus ar gwir rannañ warno hag ho peus c'hoant d'en ober.
publications-include-checkbox-files =
    .label = Enklozañ restroù
publications-include-checkbox-notes =
    .label = Enklozañ notennoù
publications-include-adjust-at-any-time = Gellout a rit keidañ petra diskouez forzh peur diwar Ma dastumadeg Embannadennoù.
publications-intro-authorship =
    .label = Krouet eo bet al labour-se ganin.
publications-intro-authorship-files =
    .label = Krouet eo bet al labour-se ganin hag ar gwir em eus da zasparzhañ ar restroù endalc'het.
publications-sharing-page =
    .label = Dibabit penaos e rank bezañ rannet ho labour
publications-sharing-keep-rights-field =
    .label = Mirout ar vaezienn Gwirioù a zo anezhi
publications-sharing-keep-rights-field-where-available =
    .label = Mirout ar vaezienn Gwirioù a zo anezhi p'emañ hegerz
publications-sharing-text = Gellout a rit mirout kement gwir d'ho labour, lakaat anezhañ dindan ul lisañs Creative Commons, pe dediet d'an domani foran. E kement degouezh e vo lakaet hegerz en un doare foran dre zotero.org.
publications-sharing-prompt = Ha fellout a rafe deoc'h aotren ar fet ma vefe rannet ho labour gant tud all?
publications-sharing-reserved =
    .label = Ket, embann ma labour war zotero.org hepken
publications-sharing-cc =
    .label = Ya, dindan ul lisañs Creative Commons
publications-sharing-cc0 =
    .label = Ya, ha lakait ma labour en domani foran
publications-license-page =
    .label = Dibab ul lisañs Creative Commons
publications-choose-license-text = Ul lisañs Creative Commons a ro an aotre da dud all da eilañ ha dasparzhañ ho labour keit ha ma vo roet ganto kreditoù a-zere deoc'h, pourvezet ul liamm davet al lisañs, ha termeniñ m'eo bet degaset cheñchamantoù. Termenoù ouzhpenn a c'hall bezañ termenet dindan.
publications-choose-license-adaptations-prompt = Aotren rannadur azasadurioù ho labour?
publications-choose-license-yes =
    .label = Ya
    .accesskey = Y
publications-choose-license-no =
    .label = Ket
    .accesskey = N
publications-choose-license-sharealike =
    .label = Ya, keit ha ma vez rannet gant ar re all ar memestra
    .accesskey = S
publications-choose-license-commercial-prompt = Aotren implijoù kenwerzhel ho labour?
publications-buttons-add-to-my-publications =
    .label = Ouzhpennañ d'Am Embannadennoù
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Dibab ul lisañs
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Lisañs Creative Commons Dereiñ 4.0 Etrebroadel
licenses-cc-by-nd = Lisañs Creative Commons Dereiñ-Stumm-Deveret-Ebet 4.0 Etrebroadel
licenses-cc-by-sa = Lisañs Creative Commons Dereiñ-Rannañ-Evel-M'emañ 4.0 Etrebroadel
licenses-cc-by-nc = Lisañs Creative Commons Dereiñ-Implij-Kenwerzhel-Ebet 4.0 Etrebroadel
licenses-cc-by-nc-nd = Lisañs Creative Commons Dereiñ-Implij-Kenwerzhel Na-StummDeveret-Ebet 4.0 Etrebroadel
licenses-cc-by-nc-sa = Lisañs Creative Commons Dereiñ-Implij-Kenwerzhel-Ebet-Rannañ-Evel-M'emañ 4.0 Etrebroadel
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Restart in Troubleshooting Mode
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Density
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-info = Titou.
pane-abstract = Berradenn
pane-attachments = Pezhioù-stag
pane-notes = Notennoù
pane-libraries-collections = Libraries and Collections
pane-tags = Balizoù
pane-related = Kevreet
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = Ennotadurioù
pane-header-attachment-associated =
    .label = Adenvel ar restr kevelet
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
new-collection-dialog =
    .title = Dastumadeg nevez
    .buttonlabelaccept = Create Collection
new-collection-name = Anv:
new-collection-create-in = Create in:
attachment-info-filename = Anv ar restr
attachment-info-accessed = Gwelet d'an/ar/al
attachment-info-pages = Pajennoù
attachment-info-modified = Deiziad kemmañ
attachment-info-index = Indekset
attachment-info-convert-note =
    .label =
        Migrate to { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } Note
    .tooltiptext = Adding notes to attachments is no longer supported, but you can edit this note by migrating it to a separate note.
attachment-preview-placeholder = No attachment to preview
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } Attachment Preview
quickformat-general-instructions =
    Use Left/Right Arrow to navigate the items of this citation. { $dialogMenu ->
        [active] Press Shift-Tab to focus the dialog's menu.
       *[other] { "" }
    } Press { return-or-enter } to save edits to this citation. Press Escape to discard the changes and close the dialog.
quickformat-aria-bubble = This item is included in the citation. Press space bar to customize the item. { quickformat-general-instructions }
quickformat-aria-input = Type to search for an item to include in this citation. Press Tab to navigate the list of search results. { quickformat-general-instructions }
quickformat-aria-item = Press { return-or-enter } to add this item to the citation. Press Tab to go back to the search field.
quickformat-accept =
    .tooltiptext = Save edits to this citation
quickformat-locator-type =
    .aria-label = Locator type
quickformat-locator-value = Locator
quickformat-citation-options =
    .tooltiptext = Show citation options
insert-note-aria-input = Type to search for a note. Press Tab to navigate the list of results. Press Escape to close the dialog.
insert-note-aria-item = Press { return-or-enter } to select this note. Press Tab to go back to the search field. Press Escape to close the dialog.
quicksearch-mode =
    .aria-label = Quick Search mode
quicksearch-input =
    .aria-label = Enklask prim
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = Hini ebet
item-pane-header-title =
    .label = Titl
item-pane-header-titleCreatorYear =
    .label = Titl, Krouer, Bloavezh
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
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Merge { $count } item
           *[other] Merge { $count } items
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = { -app-name } is running in 32-bit mode on a 64-bit version of Windows. { -app-name } will run more efficiently in 64-bit mode.
architecture-warning-action = Download 64-bit { -app-name }
first-run-guidance-quickFormat =
    Type a title, author, and/or year to search for a reference.
    
    After you’ve made your selection, click the bubble or select it via the keyboard and press ↓/Space to show citation options such as page number, prefix, and suffix.
    
    You can also add a page number directly by including it with your search terms or typing it after the bubble and pressing { return-or-enter }.
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
