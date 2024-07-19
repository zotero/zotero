general-print = Natisni
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Odstrani
general-add = Dodaj
general-remind-me-later = Spomni me kasneje
general-choose-file = Izberite datoteko ...
general-open-settings = Open Settings
general-help = Pomoč
general-tag = Tag
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = Pokaži datoteko
menu-file-show-files =
    .label = Show Files
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = Dodaj priponko
new-note = Nova opomba
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
    .label = Pripni povezavo do datoteke ...
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nova samostojna opomba
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = Obnovi v knjižnico
menu-deletePermanently =
    .label = Izbriši trajno ...
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
    .label = Uredi shranjeno iskanje
item-creator-moveDown =
    .label = Premakni navzdol
item-creator-moveToTop =
    .label = Premakni na vrh
item-creator-moveUp =
    .label = Premakni navzgor
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
    .label = Datoteka
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Web Link
view-online = Pokaži na spletu
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
    .title = Uvozi
import-where-from = Od kod želite uvoziti?
import-online-intro-title = Uvod
import-source-file =
    .label = Datoteka (BibTeX, RIS, Zotero RDF itn.)
import-source-folder =
    .label = Mapa s PDF-ji ali drugimi datotekami
import-source-online =
    .label = { $targetApp } online import
import-options = Možnosti
import-importing = Uvažanje ...
import-create-collection =
    .label = Postavi uvožene zbirke in elemente v novo zbirko
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Ravnanje z datotekami
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Poveži z datotekami na izvornem mestu
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Prenesi le nove elemente; ne posodobi poprej uvoženih elementov
import-mendeley-username = Uporabniško ime
import-mendeley-password = Geslo
general-error = Napaka
file-interface-import-error = Pri uvozu izbrane datoteke je prišlo do napake. Zagotovite, da je datoteka veljavna, nato poskusite znova.
file-interface-import-complete = Uvoz dokončan
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
    .label = Ponovno poveži citate Mendeley Desktop
import-online-relink-kb = Podrobnosti
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Poročaj o napaki ...
rtfScan-wizard =
    .title = Pregled RTF
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = Za začetek spodaj izberite vhodno datoteko RTF in izhodno datoteko:
rtfScan-input-file = Vhodna datoteka
rtfScan-output-file = Izhodna datoteka
rtfScan-no-file-selected = Izbrana ni nobena datoteka
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = Uvod
rtfScan-scan-page =
    .label = Pregledovanje citatov
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = Preveri citirane vnose
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = Oblikovanje dokumenta
rtfScan-format-page =
    .label = Oblikovanje citatov
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = Pregled dokumenta RTF dokončan
rtfScan-complete-page-description = Vaš dokument je bil pregledan in obdelan. Zagotovite, da je oblikovan pravilno.
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
bibliography-style-label = Slog citiranja:
bibliography-locale-label = Jezik:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Napredne možnosti
bibliography-outputMode-label = Izhodni način:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliografija
bibliography-outputMethod-label = Izhodna metoda:
bibliography-outputMethod-saveAsRTF =
    .label = Shrani kot RTF
bibliography-outputMethod-saveAsHTML =
    .label = Shrani kot HTML
bibliography-outputMethod-copyToClipboard =
    .label = Kopiraj na odložišče
bibliography-outputMethod-print =
    .label = Natisni
bibliography-manageStyles-label = Upravljaj s slogi ...
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = Prikaži citate kot:
integration-prefs-footnotes =
    .label = sprotne opombe
integration-prefs-endnotes =
    .label = končne opombe
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = Zaznamki se lahko skupno rabijo v Microsoft Word in LibreOffice, vendar lahko povzročijo napako, če se ponesreči spremenijo,  ter jih ni mogoče vstavljati v sprotne opombe.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Samodejno posodobi navedke
    .tooltip = Navedki s čakajočimi posodobitvami bodo v dokumentu poudarjeni
integration-prefs-automaticCitationUpdates-description = Onemogočanje posodobitev lahko pohitri vstavljanje navedkov v večjih dokumentih. Za ročno posodobitev navedkov kliknite Osveži.
integration-prefs-automaticJournalAbbeviations =
    .label = Uporabi okrajšave revij MEDLINE
integration-prefs-automaticJournalAbbeviations-description = Polje »Journal Abbr« bo prezrto.
integration-prefs-exportDocument =
    .label = Preklopi v drug urejevalnik besedil ...
publications-intro-page =
    .label = Moje objave
publications-intro = Vnosi, ki jih dodate med Moje objave, bodo prikazane na strani vašega profila na zotero.org. Če izberete vključitev pripetih datotek, bodo javno objavljene pod pogoji dovoljenja, ki ga izberete. Dodajte le dela, ki ste jih ustvarili sami in za katera imate ustrezne pravice, da jih lahko (in jih tudi želite) razširjati na tak način.
publications-include-checkbox-files =
    .label = Vključi datoteke
publications-include-checkbox-notes =
    .label = Vključi opombe
publications-include-adjust-at-any-time = Kaj naj bo prikazano, lahko prilagodite kadar koli v zbirki Moje objave.
publications-intro-authorship =
    .label = Ustvaril(a) sem to delo.
publications-intro-authorship-files =
    .label = Ustvaril(a) sem to delo in imam pravice do razširjanja vključenih datotek.
publications-sharing-page =
    .label = Izberite, na kakšen način in pod kakšnimi pogoji želite svoje delo deliti z drugimi
publications-sharing-keep-rights-field =
    .label = Ohrani obstoječe polje Pravice
publications-sharing-keep-rights-field-where-available =
    .label = Ohrani obstoječe polje Pravice, kjer je na voljo
publications-sharing-text = Vse pravice glede svojega dela lahko obdržite, delo lahko objavite pod dovoljenjem Creative Commns ali pa ga predate v javno domeno. V vsakem primeru bo delo javno dostopno prek zotero.org
publications-sharing-prompt = Želite dovoliti, da drugi dajejo vaše delo v skupno rabo?
publications-sharing-reserved =
    .label = Ne, objavi moje delo le na zotero.org
publications-sharing-cc =
    .label = Da, pod pogoji dovoljenja Creative Commons
publications-sharing-cc0 =
    .label = Da, in daj moje delo v javno domeno
publications-license-page =
    .label = Izberite dovoljenje Creative Commons
publications-choose-license-text = Dovoljenje Creative Commns omogoča drugim kopiranje in razširjanje vašega dela, v kolikor ustrezno podajo zasluge, ponudijo povezavo na dovoljenje ter nakažejo, ali so bile opravljene kakršne koli spremembe. Morebitne dodatne pogoje lahko navedete spodaj.
publications-choose-license-adaptations-prompt = Želite dovoliti skupno rabo priredb svojega dela?
publications-choose-license-yes =
    .label = Da
    .accesskey = Y
publications-choose-license-no =
    .label = Ne
    .accesskey = N
publications-choose-license-sharealike =
    .label = Da, če drugi delijo naprej pod istimi pogoji
    .accesskey = S
publications-choose-license-commercial-prompt = Želite dovoliti komercialno uporabo svojega dela?
publications-buttons-add-to-my-publications =
    .label = Dodaj med moje objave
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Izberite dovoljenje
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Mednarodno dovoljenje Creative Commons 4.0: priznanje avtorstva
licenses-cc-by-nd = Mednarodno dovoljenje Creative Commons 4.0: priznanje avtorstva-brez predelav
licenses-cc-by-sa = Mednarodno dovoljenje Creative Commons 4.0: priznanje avtorstva-deljenje pod enakimi pogoji
licenses-cc-by-nc = Mednarodno dovoljenje Creative Commons 4.0: priznanje avtorstva-nekomercialno
licenses-cc-by-nc-nd = Mednarodno dovoljenje Creative Commons 4.0: priznanje avtorstva-nekomercialno-brez predelav
licenses-cc-by-nc-sa = Mednarodno dovoljenje Creative Commons 4.0: priznanje avtorstva-nekomercialno-deljenje pod podobnimi pogoji
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = d
restart-in-troubleshooting-mode-dialog-title = Restart in Troubleshooting Mode
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Density
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-info = Podatki
pane-abstract = Povzetek
pane-attachments = Priponke
pane-notes = Opombe
pane-libraries-collections = Libraries and Collections
pane-tags = Značke
pane-related = Sorodno
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = Zaznamki
pane-header-attachment-associated =
    .label = Preimenuj pridruženo datoteko
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
    .title = Nova zbirka
    .buttonlabelaccept = Create Collection
new-collection-name = Ime:
new-collection-create-in = Create in:
attachment-info-filename = Ime datoteke
attachment-info-accessed = Dostopano
attachment-info-pages = Strani
attachment-info-modified = Spremenjeno
attachment-info-index = Indeksirano
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
    .aria-label = Hitro iskanje
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = brez
item-pane-header-title =
    .label = Naslov
item-pane-header-titleCreatorYear =
    .label = Naslov, avtor, leto
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
