general-print = Εκτύπωση
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Απομάκρυνση
general-add = Προσθήκη
general-remind-me-later = Remind Me Later
general-choose-file = Επιλέξτε αρχείο...
general-open-settings = Open Settings
general-help = Βοήθεια
general-tag = Tag
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = Εμφάνιση αρχείου
menu-file-show-files =
    .label = Show Files
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = Προσθήκη προσαρτήματος
new-note = Νέα σημείωση
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
    .label = Προσκόληση συνδέσμου προς αρχείο...
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Νέα αυτόνομη σημείωση
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = Αποκατάσταση στην Βιβλιοθήκη
menu-deletePermanently =
    .label = Μόνιμη διαγραφή...;
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
    .label = Μετακίνηση Κάτω
item-creator-moveToTop =
    .label = Μετακίνηση προς τα επάνω
item-creator-moveUp =
    .label = Μετακίνηση Επάνω
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
    .label = Αρχείο
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Web Link
view-online = Προβολή στο Διαδίκτυο
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
    .title = Εισαγωγή
import-where-from = Από πού θέλετε να εισαγάγετε;
import-online-intro-title = Εισαγωγή
import-source-file =
    .label = Ένα αρχείο (BibTeX, RIS, Zotero RDF, κλπ.)
import-source-folder =
    .label = A folder of PDFs or other files
import-source-online =
    .label = { $targetApp } online import
import-options = Επιλογές
import-importing = Εισαγωγή ...
import-create-collection =
    .label = Τοποθετήστε τις εισαγόμενες συλλογές και τα αντικείμενα σε νέα συλλογή
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Χειρισμός Αρχείων
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Σύνδεση με αρχεία στην αρχική τοποθεσία
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Download new items only; don’t update previously imported items
import-mendeley-username = Όνομα χρήστη
import-mendeley-password = Κωδικός
general-error = Σφάλμα
file-interface-import-error = Παρουσιάστηκε σφάλμα κατά την προσπάθεια εισαγωγής του επιλεγμένου αρχείου. Βεβαιωθείτε ότι το αρχείο είναι έγκυρο και δοκιμάστε ξανά.
file-interface-import-complete = Import Complete
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
import-online-relink-kb = Περισσότερες πληροφορίες
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Report Error...
rtfScan-wizard =
    .title = Σάρωση RTF
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = Για να ξεκινήσετε επιλέξτε παρακάτω ένα αρχείο εισόδου RTF και ένα αρχείο εξόδου:
rtfScan-input-file = Αρχείο εισαγωγής
rtfScan-output-file = Αρχείο εξαγωγής
rtfScan-no-file-selected = Δεν επιλέχθηκε αρχείο
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = Εισαγωγή
rtfScan-scan-page =
    .label = Σάρωση για παραπομπές
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = Εξακρίβωση παρατιθέμενων στοιχείων
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = Μορφοποίηση εγγράφου
rtfScan-format-page =
    .label = Μορφοποίηση παπομπών/παραθέσεων
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = Η Σάρωση RTF ολοκληρώθηκε
rtfScan-complete-page-description = Το έγγραφό σας σαρώθηκε και επεξεργάστηκε. Παρααλώ βεβαιωθείτε ότι μοφροποιήθηκε σωστά.
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
bibliography-style-label = Στυλ παραπομπής:
bibliography-locale-label = Γλώσσα:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Προχωρημένες επιλογές
bibliography-outputMode-label = Λειτουργία αποτελέσματος:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Βιβλιογραφία
bibliography-outputMethod-label = Μέθοδος αποτελέσματος:
bibliography-outputMethod-saveAsRTF =
    .label = Αποθήκευση ως RTF
bibliography-outputMethod-saveAsHTML =
    .label = Αποθήκευση ως HTML
bibliography-outputMethod-copyToClipboard =
    .label = Αντιγραφή στο Πρόχειρο
bibliography-outputMethod-print =
    .label = Εκτύπωση
bibliography-manageStyles-label = Διαχείριση στυλ...
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = Προβολή παραπομπών ως:
integration-prefs-footnotes =
    .label = Υποσημειώσεις
integration-prefs-endnotes =
    .label = Σημειώσεις τέλους
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = Οι σελιδοδείκτες μπορούν να είναι κοινοί σε Word και LibreOffice αλλά αυτό ίσως προκαλέσει προβλήματα αν τροποποιηθούν κατά λάθος και δεν θα μπορούν να εισαχθούν μέσα σε υποσημειώσεις..
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Αυτόματη ενημέρωση αναφορών
    .tooltip = Οι αναφορές με εκκρεμείς ενημερώσεις θα επισημαίνονται στο έγγραφο
integration-prefs-automaticCitationUpdates-description = Η απενεργοποίηση ενημερώσεων μπορεί να επιταχύνει την εισαγωγή μιας παραπομπής σε μεγάλα έγγραφα. Κάντε κλικ στην επιλογή Ανανέωση για ενημέρωση.
integration-prefs-automaticJournalAbbeviations =
    .label = Χρήση των συντομεύσεων περιοδικών, MEDLINE
integration-prefs-automaticJournalAbbeviations-description = Το πεδίο «Συντομογραφία περιοδικού» θα αγνοηθεί.
integration-prefs-exportDocument =
    .label = Μετάβαση σε διαφορετικό επεξεργαστή κειμένου ...
publications-intro-page =
    .label = Οι Εκδόσεις μου
publications-intro = Τα στοιχεία που προσθέτετε στις Δημοσιεύσεις μου θα εμφανίζονται στη σελίδα του προφίλ σας στο zotero.org. Αν επιλέξετε να συμπεριλάβετε τα συνημμένα αρχεία, θα είναι διαθέσιμα στο κοινό με την άδεια που καθορίζετε. Προσθέστε μόνο την εργασία που έχετε δημιουργήσει εσείς και συμπεριλάβετε μόνο αρχεία εάν έχετε τα δικαιώματα διανομής και θέλετε να το κάνετε.
publications-include-checkbox-files =
    .label = Συμπεριλάβετε αρχεία
publications-include-checkbox-notes =
    .label = Συμπεριλάβετε σημειώσεις
publications-include-adjust-at-any-time = Μπορείτε να ρυθμίσετε τι να προβάλλετε ανά πάσα στιγμή από τη συλλογή οι Δημοσιεύσεις μου.
publications-intro-authorship =
    .label = Δημιούργησα αυτό το έργο.
publications-intro-authorship-files =
    .label = Δημιούργησα αυτό το έργο και έχω τα δικαιώματα να διανέμω τα αρχεία που περιλαμβάνονται.
publications-sharing-page =
    .label = Επιλέξτε τον τρόπο με τον οποίο μπορείτε να μοιραστείτε την εργασία σας
publications-sharing-keep-rights-field =
    .label = Διατηρήστε το υπάρχον πεδίο Δικαιώματα
publications-sharing-keep-rights-field-where-available =
    .label = Διατηρήστε το υπάρχον πεδίο Δικαιωμάτων όπου είναι διαθέσιμο
publications-sharing-text = Μπορείτε να διατηρήσετε όλα τα δικαιώματα της εργασία σας, να την εκχωρήσετε με άδεια Creative Commons ή να την αφιερώσετε στον δημόσιο τομέα. Σε όλες τις περιπτώσεις, οι εργασίες θα δημοσιοποιηθούν μέσω του zotero.org.
publications-sharing-prompt = Θέλετε να επιτρέψετε την κοινή χρήση της εργασίας σας από άλλους;
publications-sharing-reserved =
    .label = Όχι, δημοσιεύστε το έργο μου μόνο στο zotero.org
publications-sharing-cc =
    .label = Ναι, με άδεια Creative Commons
publications-sharing-cc0 =
    .label = Ναι, και τοποθετήστε την εργασία μου στον δημόσιο τομέα
publications-license-page =
    .label = Επιλέξτε μια άδεια Creative Commons
publications-choose-license-text = Μια άδεια Creative Commons επιτρέπει σε άλλους να αντιγράψουν και να αναδιανείμουν την εργασία σας, εφόσον παρέχουν τον κατάλληλο έπαινο, παρέχουν μια σύνδεση με την άδεια και υποδεικνύουν εάν έχουν γίνει αλλαγές. Πρόσθετες προϋποθέσεις μπορούν να καθοριστούν παρακάτω.
publications-choose-license-adaptations-prompt = Να επιτρέπεται η κοινή χρήση των αναπροσαρμογών της εργασίας σας;
publications-choose-license-yes =
    .label = Ναι
    .accesskey = Υ
publications-choose-license-no =
    .label = Όχι
    .accesskey = N
publications-choose-license-sharealike =
    .label = Ναι, όσο οι άλλοι διαμοιράζουν ομοίως
    .accesskey = S
publications-choose-license-commercial-prompt = Επιτρέψτε την χρησημοποίηση της εργασίας σας για εμπορικές χρήσεις ;
publications-buttons-add-to-my-publications =
    .label = Προσθήκη στις Εκδόσεις Μου
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Επιλέξτε μια Άδεια
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Αναφορά Διεθνής Άδεια 4.0
licenses-cc-by-nd = Creative Commons Αναφορά-Όχι παράγωγα έργα Διεθνής Άδεια 4.0
licenses-cc-by-sa = Creative Commons Αναφορά-Παρόμοια διανομή Διεθνής Άδεια 4.0
licenses-cc-by-nc = Creative Commons Αναφορά-Μη εμπορική χρήση Διεθνής Άδεια 4.0
licenses-cc-by-nc-nd = Creative Commons Αναφορά-Μη εμπορική χρήση-Όχι παράγωγα έργα Διεθνής Άδεια 4.0
licenses-cc-by-nc-sa = Creative Commons Αναφορά-Μη εμπορική χρήση-Παρόμοια διανομή Διεθνής Άδεια 4.0
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = Τ
restart-in-troubleshooting-mode-dialog-title = Restart in Troubleshooting Mode
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Density
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-info = Πληροφορίες
pane-abstract = Περίληψη
pane-attachments = Συνημμένα
pane-notes = Σημείωση
pane-libraries-collections = Libraries and Collections
pane-tags = Ετικέτες
pane-related = Σχετικό
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = Annotations
pane-header-attachment-associated =
    .label = Μετονομασία συσχετισμένου αρχείου
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
    .title = Νέα Συλλογή
    .buttonlabelaccept = Create Collection
new-collection-name = Όνομα:
new-collection-create-in = Create in:
attachment-info-filename = Όνομα αρχείου
attachment-info-accessed = Πρόσβαση
attachment-info-pages = Σελίδες
attachment-info-modified = Τροποποιήθηκε
attachment-info-index = Indexed
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
    .aria-label = Γρήγορη αναζήτηση
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = Κανένα
item-pane-header-title =
    .label = Τίτλος
item-pane-header-titleCreatorYear =
    .label = Title, Creator, Year
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
