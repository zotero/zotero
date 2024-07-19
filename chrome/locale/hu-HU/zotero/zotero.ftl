general-print = Nyomtatás
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Eltávolítás
general-add = Hozzáadás
general-remind-me-later = Emlékeztessen később
general-choose-file = Choose File...
general-open-settings = Open Settings
general-help = Súgó
general-tag = Tag
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = Fájl megjelenítése
menu-file-show-files =
    .label = Show Files
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = Csatolmány hozzáadása
new-note = Új jegyzet
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
    .label = Fájlra mutató hivatkozás csatolása
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Új önálló jegyzet
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = Visszaállítás könyvtárba
menu-deletePermanently =
    .label = Törlés véglegesen…
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
    .label = Mentett keresés szerkesztése
item-creator-moveDown =
    .label = Mozgatás lefelé
item-creator-moveToTop =
    .label = Ugrás a tetejére
item-creator-moveUp =
    .label = Mozgatás felfelé
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
    .label = Fájl
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Web Link
view-online = Online megtekintés
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
    .title = Importálás
import-where-from = Honnét szeretné importálni?
import-online-intro-title = Bevezetés
import-source-file =
    .label = Egy fájl (BibTeX, RIS, Zotero RDF, stb.)
import-source-folder =
    .label = PDF-ek vagy más fájlok mappája
import-source-online =
    .label = { $targetApp } online import
import-options = Beállítások
import-importing = Importálás…
import-create-collection =
    .label = Importált elemek és gyűjtemények áthelyezése új gyűjteménybe
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Fájlkezelés
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Hivatkozás az eredeti helyen található fájlokhoz
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Csak új elemek letöltése; nem frissíti a korábban importált elemeket.
import-mendeley-username = Felhasználónév
import-mendeley-password = Jelszó
general-error = Hiba
file-interface-import-error = Hiba az kiválasztott fájl importálása során. Győződjön meg róla, hogy a fájl érvényes, és próbálja meg újra.
file-interface-import-complete = Importálás kész
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
import-online-relink-kb = További információ
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Hiba bejelentése...
rtfScan-wizard =
    .title = RTF átvizsgálása…
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = A kezdéshez, válasszon egy RTF bemeneti fájlt és egy kimenti fájlt alább:
rtfScan-input-file = Bemeneti fájl
rtfScan-output-file = Kimeneti fájl
rtfScan-no-file-selected = Nincs fájl kiválasztva
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = Bevezetés
rtfScan-scan-page =
    .label = Hivatkozások keresése
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = Hivatkozott elemek ellenőrzése
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = Dokumentum formázása
rtfScan-format-page =
    .label = Hivatkozás formázása
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = Az RTF átvizsgálása befejeződött
rtfScan-complete-page-description = A dokumentum átvizsgálása és feldolgozása megtörtént. Győződjön meg róla, hogy megfelelően van formázva.
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
bibliography-style-label = Hivatkozási stílus:
bibliography-locale-label = Nyelv:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Haladó beállítások
bibliography-outputMode-label = Kimeneti mód:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliográfia
bibliography-outputMethod-label = Kimeneti metódus:
bibliography-outputMethod-saveAsRTF =
    .label = Mentés RTF-ként
bibliography-outputMethod-saveAsHTML =
    .label = Mentés HTML-ként
bibliography-outputMethod-copyToClipboard =
    .label = Másolás a vágólapra
bibliography-outputMethod-print =
    .label = Nyomtatás
bibliography-manageStyles-label = Stílusok kezelése…
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = Hivatkozások megjelenítése:
integration-prefs-footnotes =
    .label = Lábjegyzetek
integration-prefs-endnotes =
    .label = Végjegyzetek
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = A könyvjelzők megoszthatók a Word és a LibreOffice között, de hibákat okozhatnak, ha véletlenül módosítják őket, és nem illeszthetők be lábjegyzetekbe.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Hivatkozások automatikus frissítése
    .tooltip = A függőben lévő, frissítésekkel ellátott idézetek kiemelésre kerülnek a dokumentumban
integration-prefs-automaticCitationUpdates-description = A frissítések letiltása felgyorsíthatja a hivatkozások beillesztését a nagy dokumentumokba. A hivatkozások manuális frissítéséhez kattintson a Frissítés gombra.
integration-prefs-automaticJournalAbbeviations =
    .label = Használja a MEDLINE folyóirat rövidítéseket
integration-prefs-automaticJournalAbbeviations-description = A "Journal Abbr" mező figyelmen kívül hagyása
integration-prefs-exportDocument =
    .label = Váltson egy másik szövegszerkesztőre…
publications-intro-page =
    .label = Saját publikációk
publications-intro = A Saját publikációkhoz hozzáadott elemek megjelennek a zotero.org profiloldalán. Ha úgy dönt, hogy fájlokat is csatol, azokat az ön által megadott licenc alapján nyilvánosan elérhetővé teszi. Csak akkor adjon hozzá munkát, amennyiben ön készítette és csak akkor tartalmazzon fájlokat, ha rendelkezik a terjesztési jogokkal, és ezt meg akarja tenni.
publications-include-checkbox-files =
    .label = Csatolmányokkal együtt.
publications-include-checkbox-notes =
    .label = Jegyzetekkel együtt.
publications-include-adjust-at-any-time = A Saját publikációk gyűjteményből bármikor beállíthatja, hogy mit jelenítsen meg.
publications-intro-authorship =
    .label = Én készítettem ezt a munkát.
publications-intro-authorship-files =
    .label = Én készítettem ezt a munkát, és jogosult vagyok a mellékelt fájlok terjesztésére.
publications-sharing-page =
    .label = Válassza ki, hogyan szeretné a munkáit megosztani
publications-sharing-keep-rights-field =
    .label = Keep the existing Rights field
publications-sharing-keep-rights-field-where-available =
    .label = Keep the existing Rights field where available
publications-sharing-text = Fenntarthatja a munkájához fűződő összes jogot, licencelheti a Creative Commons licenc alapján, vagy a köztulajdonnak nyilváníthatja. A munkát minden esetben nyilvánosan elérhetővé teszik a zotero.org oldalon.
publications-sharing-prompt = Engedélyezné, hogy mások is megosszák a munkáját?
publications-sharing-reserved =
    .label = Nem, csakis a zotero.org weboldalon publikálható a munkám
publications-sharing-cc =
    .label = Igen, Creative Commons licence szerint.
publications-sharing-cc0 =
    .label = Igen és tegye a munkám a közkincs (public domain) közé
publications-license-page =
    .label = Válasszon egy Creative Commons licencet.
publications-choose-license-text = A Creative Commons license allows others to copy and redistribute your work as long as they give appropriate credit, provide a link to the license, and indicate if changes were made. Additional conditions can be specified below.
publications-choose-license-adaptations-prompt = Engedélyezi az átdolgozott műveinek megosztását?
publications-choose-license-yes =
    .label = Igen
    .accesskey = Y
publications-choose-license-no =
    .label = Nem
    .accesskey = N
publications-choose-license-sharealike =
    .label = Igen, amíg mások is hasonlóan osztják meg.
    .accesskey = S
publications-choose-license-commercial-prompt = Engedélyezi kereskedelmi használatra a munkáját?
publications-buttons-add-to-my-publications =
    .label = Hozzáadása a Saját publikációkhoz
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Válasszon egy licencet
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by =
    Creative Commons Attribution 4.0 International License
    (Nevezd meg! 4.0 Nemzetközi Licence)
licenses-cc-by-nd =
    Creative Commons Attribution-NoDerivatives 4.0 International License
    (Nevezd meg!-Ne változtasd! 4.0 Nemzetközi Licence)
licenses-cc-by-sa =
    Creative Commons Attribution-ShareAlike 4.0 International License
    (Nevezd meg!-Így add tovább! 4.0 Nemzetközi Licence)
licenses-cc-by-nc =
    Creative Commons Attribution-NonCommercial 4.0 International License
    (Nevezd meg!-Ne add el! 4.0 Nemzetközi Licence)
licenses-cc-by-nc-nd =
    Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License
    (Nevezd meg!-Ne add el!-Ne változtasd! 4.0 Nemzetközi Licence)
licenses-cc-by-nc-sa =
    Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License
    (Nevezd meg!-Ne add el!-Így add tovább! 4.0 Nemzetközi Licence)
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = E
restart-in-troubleshooting-mode-dialog-title = Restart in Troubleshooting Mode
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Density
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-info = Info
pane-abstract = Kivonat
pane-attachments = Csatolmányok
pane-notes = Jegyzetek
pane-libraries-collections = Libraries and Collections
pane-tags = Címkék
pane-related = Kapcsolatok
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = Jegyzetek
pane-header-attachment-associated =
    .label = Kapcsolódó fájl átnevezése
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
    .title = Új gyűjtemény
    .buttonlabelaccept = Create Collection
new-collection-name = Név:
new-collection-create-in = Create in:
attachment-info-filename = Fájlnév
attachment-info-accessed = Hozzáférés dátuma
attachment-info-pages = Oldalak
attachment-info-modified = Módosítás dátuma
attachment-info-index = Indexelve
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
    .aria-label = Gyorskeresés
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = Egyik sem
item-pane-header-title =
    .label = Cím
item-pane-header-titleCreatorYear =
    .label = Cím, Szerző, Év
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
