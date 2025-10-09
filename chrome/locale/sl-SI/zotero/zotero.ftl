general-sentence-separator = { " " }
general-key-control = Krmilka (Control)
general-key-shift = Dvigalka
general-key-alt = Izmenjalka (Alt)
general-key-option = Izmenjalka (Option)
general-key-command = Ukazovalka (Command)
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
        [macos] Vračalka
       *[other] Vračalka
    }
delete-or-backspace =
    { PLATFORM() ->
        [macos] Vračalka
       *[other] Vračalka
    }
general-print = Natisni
general-remove = Odstrani
general-add = Dodaj
general-remind-me-later = Spomni me kasneje
general-dont-ask-again = Ne sprašuj več
general-choose-file = Izberite datoteko ...
general-open-settings = Odpri nastavitve
general-settings = Settings…
general-help = Pomoč
general-tag = Značka
general-done = Opravljeno
general-view-troubleshooting-instructions = Pokaži navodila za reševanje težav
general-go-back = Pojdi nazaj
general-accept = Accept
general-cancel = Prekliči
general-show-in-library = Pokaži v knjižnici
general-restartApp = Restart { -app-name }
general-restartInTroubleshootingMode = Restart in Troubleshooting Mode
general-save = Shrani
general-clear = Počisti
general-update = Posodobi
general-back = Nazaj
general-edit = Uredi
general-cut = Izreži
general-copy = Kopiraj
general-paste = Prilepi
general-find = Najdi
general-delete = Izbriši
general-insert = Vstavi
general-and = in
general-et-al = idr.
general-previous = Nazaj
general-next = Naprej
general-learn-more = Več o tem
general-warning = Opozorilo
general-type-to-continue = Type “{ $text }” to continue.
general-red = Rdeča
general-orange = Oranžna
general-yellow = Rumena
general-green = Zelena
general-teal = Turkizna
general-blue = Modra
general-purple = Škrlatna
general-magenta = Škrlatna
general-violet = Vijolična
general-maroon = Kostanjeva
general-gray = Siva
general-black = Črna
citation-style-label = Slog citiranja:
language-label = Jezik:
menu-custom-group-submenu =
    .label = More Options…
menu-file-show-in-finder =
    .label = Pokaži v Finderju
menu-file-show-file =
    .label = Pokaži datoteko
menu-file-show-files =
    .label = Pokaži datoteke
menu-print =
    .label = { general-print }
menu-density =
    .label = Gostota
add-attachment = Dodaj priponko
new-note = Nova opomba
menu-add-by-identifier =
    .label = Add by Identifier…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Dodaj datoteko ...
menu-add-standalone-linked-file-attachment =
    .label = Dodaj povezavo do datoteke ...
menu-add-child-file-attachment =
    .label = Pripni datoteko ...
menu-add-child-linked-file-attachment =
    .label = Pripni povezavo do datoteke ...
menu-add-child-linked-url-attachment =
    .label = Pripni spletno povezavo ...
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
    .label = Vstavki
menu-view-columns-move-left =
    .label = Premakni stolpec levo
menu-view-columns-move-right =
    .label = Premakni stolpec desno
menu-show-tabs-menu =
    .label = Show Tabs Menu
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Copy Annotation
           *[other] Copy { $count } Annotations
        }
main-window-command =
    .label = Knjižnica
main-window-key =
    .key = B
zotero-toolbar-tabs-menu =
    .tooltiptext = Izpiši vse zavihke
filter-collections = Filtriraj zbirke
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Search Tabs
zotero-tabs-menu-close-button =
    .title = Zapri zavihek
zotero-toolbar-tabs-scroll-forwards =
    .title = Scroll forwards
zotero-toolbar-tabs-scroll-backwards =
    .title = Scroll backwards
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Preimenuj zbirko
collections-menu-edit-saved-search =
    .label = Uredi shranjeno iskanje
collections-menu-move-collection =
    .label = Premakni v
collections-menu-copy-collection =
    .label = Kopiraj v
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
    .label = Povezana datoteka
item-menu-add-url =
    .label = Spletna povezava
item-menu-change-parent-item =
    .label = Spremeni nadrejeni vnos ...
item-menu-relate-items =
    .label = Relate Items
view-online = Pokaži na spletu
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Datoteka preimenovana v { $filename }
itembox-button-options =
    .tooltiptext = Odpri kontekstni meni
itembox-button-merge =
    .aria-label = Izberite različico polja { $field }
create-parent-intro = Vnesite kodo DOI, ISBN, PMID, arXiv ID ali ADS, da identificirate to datoteko:
reader-use-dark-mode-for-content =
    .label = Uporabi temni način za vsebino
update-updates-found-intro-minor = Na voljo je posodobitev za { -app-name }:
update-updates-found-desc = Priporočamo, da to posodobitev uveljavite čim prej.
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
    .label = PDF-ji
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
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. It currently supports citations in variations of the following formats:
rtfScan-introPage-description2 = Za začetek spodaj izberite vhodno datoteko RTF in izhodno datoteko:
rtfScan-input-file = Vhodna datoteka:
rtfScan-output-file = Izhodna datoteka:
rtfScan-no-file-selected = Izbrana ni nobena datoteka
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Izberite vhodno datoteko
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Izberite izhodno datoteko
rtfScan-intro-page = Uvod
rtfScan-scan-page = Pregledovanje citatov
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page = Preveri citirane vnose
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page = Oblikovanje dokumenta
rtfScan-format-page = Oblikovanje citatov
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page = Pregled dokumenta RTF dokončan
rtfScan-complete-page-description = Vaš dokument je bil pregledan in obdelan. Zagotovite, da je oblikovan pravilno.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Run JavaScript
runJS-editor-label = Koda:
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
styleEditor-locatorType =
    .aria-label = Locator type
styleEditor-locatorInput = Locator input
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Urejevalnik sloga
styleEditor-preview =
    .aria-label = Predogled
publications-intro-page = Moje objave
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
publications-sharing-page = Izberite, na kakšen način in pod kakšnimi pogoji želite svoje delo deliti z drugimi
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
publications-license-page = Izberite dovoljenje Creative Commons
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
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = d
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Gostota
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-item-details = Item Details
pane-info = Podatki
pane-abstract = Povzetek
pane-attachments = Priponke
pane-notes = Opombe
pane-libraries-collections = Libraries and Collections
pane-tags = Značke
pane-related = Sorodno
pane-attachment-info = Podatki o priponki
pane-attachment-preview = Predogled
pane-attachment-annotations = Zaznamki
pane-header-attachment-associated =
    .label = Preimenuj pridruženo datoteko
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
    .tooltiptext = Preklopi kontekstno podokno
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
new-collection = Nova zbirka ...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Nova zbirka
    .buttonlabelaccept = Ustvari zbirko
new-collection-name = Ime:
new-collection-create-in = Create in:
show-publications-menuitem =
    .label = Show My Publications
attachment-info-title = Naslov
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
attachment-rename-from-parent =
    .tooltiptext = Rename File to Match Parent Item
file-renaming-auto-rename-prompt-title = Renaming Settings Changed
file-renaming-auto-rename-prompt-body = Would you like to rename existing files in your library to match the new settings?
file-renaming-auto-rename-prompt-yes = Preview Changes…
file-renaming-auto-rename-prompt-no = Keep Existing Filenames
rename-files-preview =
    .buttonlabelaccept = Rename Files
rename-files-preview-loading = Nalaganje ...
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
    .aria-label = Način hitrega iskanja
quicksearch-input =
    .aria-label = Hitro iskanje
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Pokaži kot
item-pane-header-none =
    .label = brez
item-pane-header-title =
    .label = Naslov
item-pane-header-titleCreatorYear =
    .label = Naslov, avtor, leto
item-pane-header-bibEntry =
    .label = Bibliografski vnos
item-pane-header-more-options =
    .label = Dodatne možnosti
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
architecture-warning-action = Prenesi 64-bitni { -app-name }
architecture-x64-on-arm64-message = { -app-name } is running in emulated mode. A native version of { -app-name } will run more efficiently.
architecture-x64-on-arm64-action = Prenesi { -app-name } za ARM64
first-run-guidance-authorMenu = { -app-name } lets you specify editors and translators too. You can turn an author into an editor or translator by selecting from this menu.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Iskalni pogoj
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Vrednost
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] { $count } file added
       *[other] { $count } files added
    }
select-items-window =
    .title = Izberi vnose
select-items-dialog =
    .buttonlabelaccept = Izberi
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
file-type-webpage = Spletna stran
file-type-image = Slika
file-type-pdf = PDF
file-type-audio = Zvok
file-type-video = Video
file-type-presentation = Predstavitev
file-type-document = Dokument
file-type-ebook = E-knjiga
post-upgrade-message = Learn about the <a data-l10n-name="new-features-link">new features in { -app-name } { $version }</a>
post-upgrade-density = Izberite želeno gostoto postavitve:
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Prilepi in išči
mac-word-plugin-install-message = Zotero potrebuje dostop do podatkov Word za namestitev vstavka za Word.
mac-word-plugin-install-action-button =
    .label = Namesti dodatek za Word
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
file-renaming-banner-message = { -app-name } now automatically keeps attachment filenames in sync as you make changes to items.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = The { -app-name } Connector must be updated to work with this version of { -app-name }.
userjs-pref-warning = Some { -app-name } settings have been overridden using an unsupported method. { -app-name } will revert them and restart.
long-tag-fixer-window-title =
    .title = Split Tags
long-tag-fixer-button-dont-split =
    .label = Don’t Split
