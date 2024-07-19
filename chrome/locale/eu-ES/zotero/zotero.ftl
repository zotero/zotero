general-print = Inprimatu
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Ezabatu
general-add = Gehitu
general-remind-me-later = Geroago gogorarazi
general-choose-file = Fitxategia aukeratu...
general-open-settings = Open Settings
general-help = Laguntza
general-tag = Tag
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = Erakutsi fitxategia
menu-file-show-files =
    .label = Show Files
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = Eranskina gehitu
new-note = Ohar berria
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
    .label = Fitxategi baterako esteka erantsi...
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Ohar autonomo berria...
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = Leheneratu liburutegira
menu-deletePermanently =
    .label = Betirako ezabatu...
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
    .label = Editatu gordetako bilaketa
item-creator-moveDown =
    .label = Mugitu behera
item-creator-moveToTop =
    .label = Gora mugitu
item-creator-moveUp =
    .label = Mugitu gora
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
    .label = Fitxategia
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Web Link
view-online = Linean ikusi
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
    .title = Inportatu
import-where-from = Nondik inportatu nahi duzu?
import-online-intro-title = Sarrera
import-source-file =
    .label = Fitxategi bat (BibTex, RIS, Zotero RDF etab.)
import-source-folder =
    .label = PDF edo bestelako fitxategidun karpeta
import-source-online =
    .label = { $targetApp } online import
import-options = Aukerak
import-importing = Inportatzen...
import-create-collection =
    .label = Inportatutako bilduma eta elementuak bilduma berri batean kokatu
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Fitxategien erabilera
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Fitxategien kokaleku originalera estekatu
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Deskargatu elementu berriak bakarrik; ez eguneratu lehenago inportatutako elementurik
import-mendeley-username = Erabiltzaile-izena
import-mendeley-password = Pasahitza
general-error = Errore
file-interface-import-error = Errore bat gertatu da fitxategia inportatzekotan. Egiaztatu fitxategiaren balioa eta saiatu berriro.
file-interface-import-complete = Inportatzea osatu da
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
import-online-relink-kb = Informazio gehiago
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Errore-txostena...
rtfScan-wizard =
    .title = RTF eskaneatzea
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = Hasteko, aukeratu RTF sarrera eta irteera fitxategiak behean:
rtfScan-input-file = Sarrera fitxategia
rtfScan-output-file = Irteera fitxategia
rtfScan-no-file-selected = Ez dago hautatutako fitxategirik
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = Sarrera
rtfScan-scan-page =
    .label = Aipuak eskaneatzen
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = Baieztatu aipatutako elementuak
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = Dokumentuaren formatua
rtfScan-format-page =
    .label = Aipuen formatua
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = RTF eskaneatzea amaituta
rtfScan-complete-page-description = Zure dokumentua eskaneatua eta prozesatua izan da. Mesedez, ziurtatu egoki formateatua dagoela.
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
bibliography-style-label = Aipu estiloa:
bibliography-locale-label = Hizkuntza:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Aukera aurreratuak
bibliography-outputMode-label = Irteera modua:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliografia
bibliography-outputMethod-label = Irteera metodoa:
bibliography-outputMethod-saveAsRTF =
    .label = RTF gisa gorde
bibliography-outputMethod-saveAsHTML =
    .label = HTML gisa gorde
bibliography-outputMethod-copyToClipboard =
    .label = Arbelera kopiatu
bibliography-outputMethod-print =
    .label = Inprimatu
bibliography-manageStyles-label = Estiloak kudeatu...
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = Aipuak honela erakutsi:
integration-prefs-footnotes =
    .label = Oin-oharrak
integration-prefs-endnotes =
    .label = Amaiera-oharrak
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = Lastermarkak Word eta LibreOffice-en artean parteka daitezke, baina erroreak sor ditzakete nahi gabe aldatuko balira eta ezin dira oin-oharretan gehitu.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Aipuak automatikoki eguneratu
    .tooltip = Burutu gabeko eguneraketak dituzten aipuak nabarmenduta agertuko dira dokumentuan
integration-prefs-automaticCitationUpdates-description = Eguneraketak ezgaitzeak aipuak azkarrago sartzen lagun dezake dokumentu handietan. Klik egin Freskatu aukeran aipuak eskuz eguneratzeko.
integration-prefs-automaticJournalAbbeviations =
    .label = MEDLINE aldizkari laburdurak erabili
integration-prefs-automaticJournalAbbeviations-description = "Aldizkariaren labur." eremua baztertua izango da
integration-prefs-exportDocument =
    .label = Beste testu prozesatzaile batera aldatu...
publications-intro-page =
    .label = Nire argitalpenak
publications-intro = Nire argitalpenak atalean gehitzen dituzun elementuak zure profilean erakutsiko dira zotero.org webgunean. Atxikitako fitxategiak erakustea hautatzen baduzu, publikoki eskuragarri jarriko dira zehazten duzun lizentziarekin. Zuk zeuk sortutako lanak bakarrik gehitu, eta zabaltzeko eskumena daukazun eta zabaldu nahi dituzun fitxategiak gehitu bakarrik.
publications-include-checkbox-files =
    .label = Fitxategiak gehitu
publications-include-checkbox-notes =
    .label = Oharrak gehitu
publications-include-adjust-at-any-time = Edozein unetan doitu dezakezu zer erakutsi Nire argitalpenak bildumatik.
publications-intro-authorship =
    .label = Nik sortu dut lan hau.
publications-intro-authorship-files =
    .label = Lan hau nik neuk sortu dut eta erantsitako fitxategiak zabaltzeko baimena daukat.
publications-sharing-page =
    .label = Hautatu zure lana nola partekatu daitekeen
publications-sharing-keep-rights-field =
    .label = Gorde uneko Eskubideak eremua
publications-sharing-keep-rights-field-where-available =
    .label = Gorde uneko Eskubideak eremua posible den guztietan
publications-sharing-text = Zure lanaren inguruko eskubide guztiak gorde ditzakezu, Creative Commons lizentzia baten pean eskuragarri jarri, ala domeinu publikoko egin. Edozein kasutan, lana publikoki eskuragarri jarriko da zotero.org wegunean.
publications-sharing-prompt = Besteek zure lana partekatzea baimendu nahi al duzu?
publications-sharing-reserved =
    .label = Ez, nire lana zotero.org-en argitaratu soilik
publications-sharing-cc =
    .label = Bai, Creative Commons lizentziapean
publications-sharing-cc0 =
    .label = Bai, domeinu publikoan
publications-license-page =
    .label = Hautatu Creative Commons lizentzia bat
publications-choose-license-text = Creative Commons lizentzia batek zure lana kopiatu eta birbanatzeko ahalbidetzen ditu besteak, beti ere iturria behar bezala aitortu, lizentzia estekatu eta aldaketarik ote duen adierazten badute. Baldintza gehigarriak beherago zehaztu daitezke.
publications-choose-license-adaptations-prompt = Zure lanaren moldaketak partekatzea baimendu nahi al duzu?
publications-choose-license-yes =
    .label = Bai
    .accesskey = Y
publications-choose-license-no =
    .label = Ez
    .accesskey = N
publications-choose-license-sharealike =
    .label = Bai, besteek baldintza berdinetan partekatzen badute
    .accesskey = S
publications-choose-license-commercial-prompt = Zure lanaren erabilera komertzialik baimendu nahi al duzu?
publications-buttons-add-to-my-publications =
    .label = Gehitu Nire argitalpenetara
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Hautatu lizentzia bat
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Aitortu 4.0 Nazioarteko lizentzia
licenses-cc-by-nd = Creative Commons Aitortu-LanEratorririkGabe 4.0 Nazioarteko lizentzia
licenses-cc-by-sa = Creative Commons Aitortu-PartekatuBerdin 4.0 Nazioarteko lizentzia
licenses-cc-by-nc = Creative Commons Aitortu-EzKomertziala 4.0 Nazioarteko lizentzia
licenses-cc-by-nc-nd = Creative Commons Aitortu-EzKomertziala-LanEratorririkGabe 4.0 Nazioarteko lizentzia
licenses-cc-by-nc-sa = Creative Commons Aitortu-EzKomertziala-PartekatuBerdin 4.0 Nazioarteko lizentzia
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
pane-abstract = Laburpena
pane-attachments = Eranskinak
pane-notes = Oharrak
pane-libraries-collections = Libraries and Collections
pane-tags = Etiketak
pane-related = Erlazionatutakoak
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = Oharpenak
pane-header-attachment-associated =
    .label = Aldatu fitxategi asoziatuaren izena
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
    .title = Bilduma berria
    .buttonlabelaccept = Create Collection
new-collection-name = Izena:
new-collection-create-in = Create in:
attachment-info-filename = Fitxategiaren izena
attachment-info-accessed = Sartua
attachment-info-pages = Orrialdeak
attachment-info-modified = Noiz aldatua
attachment-info-index = Indexatuta
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
    .aria-label = Bilatu:
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = Kendu
item-pane-header-title =
    .label = Izenburua
item-pane-header-titleCreatorYear =
    .label = Izenburua, sortzailea, urtea
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
