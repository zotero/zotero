general-print = Print
return-or-enter =
    { PLATFORM() ->
        [macos] Return
        *[other] Enter
    }

general-remove = Remove
general-add = Add
general-remind-me-later = Remind Me Later
general-choose-file = Choose File…
general-open-settings = Open Settings
general-help = Help
general-tag = Tag

menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = Show File
menu-file-show-files =
    .label = Show Files
menu-print =
    .label = { general-print }

menu-density =
    .label = Density

add-attachment = Add Attachment
new-note = New Note

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
    .label = Attach Link to File…
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…

menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = New Standalone Note
menu-new-item-note =
    .label = New Item Note

menu-restoreToLibrary =
    .label = Restore to Library
menu-deletePermanently =
    .label = Delete Permanently…

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
    .label = Move Down
item-creator-moveToTop =
    .label = Move to Top
item-creator-moveUp =
    .label = Move Up

item-menu-viewAttachment =
    .label = Open { $numAttachments ->
        [one] { $attachmentType ->
            [pdf] PDF
            [epub] EPUB
            [snapshot] Snapshot
            *[other] Attachment
        }
        *[other] { $attachmentType ->
            [pdf] PDFs
            [epub] EPUBs
            [snapshot] Snapshots
            *[other] Attachments
        }
    } {
        $openIn ->
            [tab] in New Tab
            [window] in New Window
            *[other] { "" }
    }

item-menu-add-file =
     .label = File
item-menu-add-linked-file =
     .label = Linked File
item-menu-add-url =
     .label = Web Link

view-online = View Online
item-menu-option-view-online =
    .label = {view-online}
item-button-view-online =
    .tooltiptext = {view-online}

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
    .title = Import

import-where-from = Where do you want to import from?
import-online-intro-title = Introduction

import-source-file =
    .label = A file (BibTeX, RIS, Zotero RDF, etc.)

import-source-folder =
    .label = A folder of PDFs or other files

import-source-online =
    .label = { $targetApp } online import

import-options = Options
import-importing = Importing…

import-create-collection =
    .label = Place imported collections and items into new collection

import-recreate-structure =
    .label = Recreate folder structure as collections

import-fileTypes-header = File Types to Import:

import-fileTypes-pdf = 
    .label = PDFs

import-fileTypes-other = 
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)

import-file-handling = File Handling
import-file-handling-store = 
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link = 
    .label = Link to files in original location
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Download new items only; don’t update previously imported items
import-mendeley-username = Username
import-mendeley-password = Password

general-error = Error
file-interface-import-error = An error occurred while trying to import the selected file. Please ensure that the file is valid and try again.
file-interface-import-complete = Import Complete
file-interface-items-were-imported = { $numItems ->
    [0] No items were imported
    [one] One item was imported
    *[other] { $numItems } items were imported
    }
file-interface-items-were-relinked = { $numRelinked ->
    [0] No items were relinked
    [one] One item was relinked
    *[other] { $numRelinked } items were relinked
    }

import-mendeley-encrypted = The selected Mendeley database cannot be read, likely because it is encrypted. See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
                            
file-interface-import-error-translator = An error occurred importing the selected file with “{ $translator }”. Please ensure that the file is valid and try again.

import-online-intro=In the next step you will be asked to log in to { $targetAppOnline } and grant { -app-name } access. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-intro2={ -app-name } will never see or store your { $targetApp } password.
import-online-form-intro = Please enter your credentials to log in to { $targetAppOnline }. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-wrong-credentials = Login to { $targetApp } failed. Please re-enter credentials and try again.
import-online-blocked-by-plugin = The import cannot continue with { $plugin } installed. Please disable this plugin and try again.
import-online-relink-only =
    .label = Relink Mendeley Desktop citations
import-online-relink-kb = More Information
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.

items-table-cell-notes =
    .aria-label = { $count ->
        [one] { $count } Note
        *[other] { $count } Notes
    }

report-error =
    .label = Report Error…

rtfScan-wizard =
    .title = RTF Scan

rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. The RTF Scan feature currently supports citations in variations upon the following formats:
rtfScan-introPage-description2 = To get started, select an RTF input file and an output file below:

rtfScan-input-file = Input File:
rtfScan-output-file = Output File:

rtfScan-no-file-selected = No file selected
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File

rtfScan-intro-page = 
    .label = Introduction

rtfScan-scan-page =
    .label = Scanning for Citations

rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.

rtfScan-citations-page =
    .label = Verify Cited Items

rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.

rtfScan-style-page =
    .label = Document Formatting

rtfScan-format-page =
    .label = Formatting Citations

rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.

rtfScan-complete-page =
    .label = RTF Scan Complete

rtfScan-complete-page-description = Your document has now been scanned and processed. Please ensure that it is formatted correctly.
rtfScan-action-find-match =
    .title = Select matching item

rtfScan-action-accept-match =
    .title = Accept this match

runJS-title = Run JavaScript
runJS-editor-label = Code:
runJS-run = Run
runJS-help = { general-help }
runJS-result = {
    $type ->
        [async] Return value:
        *[other] Result:
}
runJS-run-async = Run as async function

bibliography-window =
    .title = { -app-name } - Create Citation/Bibliography
bibliography-style-label = Citation Style:
bibliography-locale-label = Language:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Advanced Options
bibliography-outputMode-label = Output Mode:
bibliography-outputMode-citations =
    .label = {
        $type ->
            [citation] Citations
            [note] Notes
            *[other] Citations
    }
bibliography-outputMode-bibliography =
    .label = Bibliography
bibliography-outputMethod-label = Output Method:
bibliography-outputMethod-saveAsRTF =
    .label = Save as RTF
bibliography-outputMethod-saveAsHTML =
    .label = Save as HTML
bibliography-outputMethod-copyToClipboard =
    .label = Copy to Clipboard
bibliography-outputMethod-print =
    .label = Print
bibliography-manageStyles-label = Manage Styles…


integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation

integration-prefs-displayAs-label = Display Citations As:
integration-prefs-footnotes = 
    .label = Footnotes
integration-prefs-endnotes =
    .label = Endnotes
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = Bookmarks can be shared between Word and LibreOffice, but may cause errors if accidentally modified and cannot be inserted into footnotes.
integration-prefs-bookmarks-formatNotice = {
    $show ->
        [true] The document must be saved as .doc or .docx.
        *[other] {""}
}
integration-prefs-automaticCitationUpdates =
    .label = Automatically update citations
    .tooltip = Citations with pending updates will be highlighted in the document
integration-prefs-automaticCitationUpdates-description = Disabling updates can speed up citation insertion in large documents. Click Refresh to update citations manually.
integration-prefs-automaticJournalAbbeviations =
    .label = Use MEDLINE journal abbreviations
integration-prefs-automaticJournalAbbeviations-description = The “Journal Abbr” field will be ignored.
integration-prefs-exportDocument =
    .label = Switch to a Different Word Processor…


publications-intro-page =
    .label = My Publications

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

publications-sharing-page =
    .label = Choose how your work may be shared

publications-sharing-keep-rights-field = 
    .label = Keep the existing Rights field
publications-sharing-keep-rights-field-where-available = 
    .label = Keep the existing Rights field where available
publications-sharing-text = You can reserve all rights to your work, license it under a Creative Commons license, or dedicate it to the public domain. In all cases, the work will be made publicly available via zotero.org.
publications-sharing-prompt = Would you like to allow your work to be shared by others?
publications-sharing-reserved =
    .label = No, only publish my work on zotero.org
publications-sharing-cc =
    .label = Yes, under a Creative Commons license
publications-sharing-cc0 =
    .label = Yes, and place my work in the public domain

publications-license-page =
    .label = Choose a Creative Commons license
publications-choose-license-text = A Creative Commons license allows others to copy and redistribute your work as long as they give appropriate credit, provide a link to the license, and indicate if changes were made. Additional conditions can be specified below.
publications-choose-license-adaptations-prompt = Allow adaptations of your work to be shared?

publications-choose-license-yes =
    .label = Yes
    .accesskey = Y
publications-choose-license-no =
    .label = No
    .accesskey = N
publications-choose-license-sharealike =
    .label = Yes, as long as others share alike
    .accesskey = S

publications-choose-license-commercial-prompt = Allow commercial uses of your work?
publications-buttons-add-to-my-publications =
    .label = Add to My Publications
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Choose a License

licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Attribution 4.0 International License
licenses-cc-by-nd = Creative Commons Attribution-NoDerivatives 4.0 International License
licenses-cc-by-sa = Creative Commons Attribution-ShareAlike 4.0 International License
licenses-cc-by-nc = Creative Commons Attribution-NonCommercial 4.0 International License
licenses-cc-by-nc-nd = Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License
licenses-cc-by-nc-sa = Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License
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

pane-info = Info
pane-abstract = Abstract
pane-attachments = Attachments
pane-notes = Notes
pane-libraries-collections = Libraries and Collections
pane-tags = Tags
pane-related = Related
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = Annotations

pane-header-attachment-associated =
    .label = Rename associated file

section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label = { $count ->
                 [one] { $count } Attachment
                 *[other] { $count } Attachments
             }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label = { $count ->
                 [one] { $count } Annotation
                 *[other] { $count } Annotations
             }
section-notes =
    .label = { $count ->
                 [one] { $count } Note
                 *[other] { $count } Notes
             }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label = { $count ->
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
    .title = New Collection
    .buttonlabelaccept = Create Collection
new-collection-name = Name:
new-collection-create-in = Create in:

attachment-info-filename = Filename
attachment-info-accessed = Accessed
attachment-info-pages = Pages
attachment-info-modified = Modified
attachment-info-index = Indexed
attachment-info-convert-note =
    .label = Migrate to {
        $type ->
            [standalone] Standalone
            [child] Item
            *[unknown] New
    } Note
    .tooltiptext = Adding notes to attachments is no longer supported, but you can edit this note by migrating it to a separate note.

attachment-preview-placeholder = No attachment to preview

toggle-preview =
    .label = {
        $type ->
            [open] Hide
            [collapsed] Show
            *[unknown] Toggle
    } Attachment Preview

quickformat-general-instructions = Use Left/Right Arrow to navigate the items of this citation. {
    $dialogMenu ->
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
quickformat-locator-value =  Locator
quickformat-citation-options =
    .tooltiptext = Show citation options

insert-note-aria-input = Type to search for a note. Press Tab to navigate the list of results. Press Escape to close the dialog.
insert-note-aria-item = Press { return-or-enter } to select this note. Press Tab to go back to the search field. Press Escape to close the dialog.
quicksearch-mode =
    .aria-label = Quick Search mode
quicksearch-input =
    .aria-label = Quick Search
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }

item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = None
item-pane-header-title =
    .label = Title
item-pane-header-titleCreatorYear =
    .label = Title, Creator, Year
item-pane-header-bibEntry =
    .label = Bibliography Entry
item-pane-header-more-options =
    .label = More Options

item-pane-message-items-selected = { $count ->
                                             [0] No items selected
                                             [one] { $count } item selected
                                            *[other] { $count } items selected
                                    }
item-pane-message-collections-selected = { $count ->
                                             [one] { $count } collection selected
                                            *[other] { $count } collections selected
                                         }
item-pane-message-searches-selected = { $count ->
                                          [one] { $count } search selected
                                         *[other] { $count } searches selected
                                      }
item-pane-message-objects-selected = { $count ->
                                          [one] { $count } object selected
                                         *[other] { $count } objects selected
                                     }

item-pane-message-unselected = { $count ->
    [0] No items in this view
    [one] { $count } item in this view
   *[other] { $count } items in this view
}

item-pane-duplicates-merge-items =
    .label = { $count ->
         [one] Merge { $count } item
        *[other] Merge { $count } items
     }

locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.

architecture-win32-warning-message = { -app-name } is running in 32-bit mode on a 64-bit version of Windows. { -app-name } will run more efficiently in 64-bit mode.
architecture-warning-action = Download 64-bit { -app-name }

first-run-guidance-quickFormat = Type a title, author, and/or year to search for a reference.
    
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
