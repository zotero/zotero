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
general-print = Nyomtatás
general-remove = Eltávolítás
general-add = Hozzáadás
general-remind-me-later = Emlékeztessen később
general-dont-ask-again = Ne kérdezze újra
general-choose-file = Fájl kiválasztása...
general-open-settings = Beállítások megnyitása
general-settings = Beállítások…
general-help = Súgó
general-tag = Címke
general-done = Rendben
general-view-troubleshooting-instructions = View Troubleshooting Instructions
general-go-back = Vissza
general-accept = Beszúrás
general-cancel = Mégsem
general-show-in-library = Megjelenítés a könyvtárban
general-restartApp = { -app-name } Újraindítása
general-restartInTroubleshootingMode = Újraindítás hibakereső módban
general-save = Mentés
general-clear = Törlés
general-update = Frissítés
general-back = Vissza
general-edit = Szerkesztés
general-cut = Kivágás
general-copy = Másolás
general-paste = Beillesztés
general-find = Keresés
general-delete = Törlés
general-insert = Beillesztés
general-and = és
general-et-al = és mtsai.
general-previous = Előző
general-next = Következő
general-learn-more = Bővebben
general-warning = Figyelmeztetés
general-type-to-continue = Type “{ $text }” to continue.
general-continue = Folytatás
general-red = Piros
general-orange = Narancssárga
general-yellow = Sárga
general-green = Zöld
general-teal = Kékeszöld
general-blue = Kék
general-purple = Lila
general-magenta = Bíborvörös
general-violet = Ibolya
general-maroon = Vörösesbarna
general-gray = Szürke
general-black = Fekete
general-loading = Betöltés…
citation-style-label = Hivatkozási stílus:
language-label = Nyelv:
menu-custom-group-submenu =
    .label = More Options…
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = Fájl megjelenítése
menu-file-show-files =
    .label = Fájlok megjelenítése
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
    .label = Fájl hozzáadása...
menu-add-standalone-linked-file-attachment =
    .label = Link hozzáadása a fájlhoz…
menu-add-child-file-attachment =
    .label = Fájl csatolása...
menu-add-child-linked-file-attachment =
    .label = Fájlra mutató hivatkozás csatolása
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Új önálló jegyzet
menu-new-item-note =
    .label = Új elem jegyzete
menu-restoreToLibrary =
    .label = Visszaállítás könyvtárba
menu-deletePermanently =
    .label = Törlés véglegesen…
menu-tools-plugins =
    .label = Pluginek
menu-view-columns-move-left =
    .label = Move Column Left
menu-view-columns-move-right =
    .label = Move Column Right
menu-view-hide-context-annotation-rows =
    .label = Hide Non-Matching Annotations
menu-view-note-font-size =
    .label = Jegyzet betűmérete
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
    .label = Könyvtár
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = List all tabs
filter-collections = Filter Collections
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Keresés a fülek között
zotero-tabs-menu-close-button =
    .title = Fül bezárása
zotero-toolbar-tabs-scroll-forwards =
    .title = Scroll forwards
zotero-toolbar-tabs-scroll-backwards =
    .title = Scroll backwards
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Gyűjtemény átnevezése
collections-menu-edit-saved-search =
    .label = Mentett keresés szerkesztése
collections-menu-move-collection =
    .label = Move To
collections-menu-copy-collection =
    .label = Másolás a(z)
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
    .label = Fájl
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Web Link
item-menu-change-parent-item =
    .label = Change Parent Item…
item-menu-relate-items =
    .label = Relate Items
view-online = Online megtekintés
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = File renamed to { $filename }
itembox-button-options =
    .tooltiptext = Open context menu
itembox-button-merge =
    .aria-label = A { $field } mező verziójának kiválasztása
create-parent-intro = Adjon meg egy DOI-t, ISBN-t, PMID-t, arXiv ID-t vagy ADS Bibcode-ot a fájl azonosításához:
reader-use-dark-mode-for-content =
    .label = Sötét mód használata a tartalomhoz
update-updates-found-intro-minor = A { -app-name } frissítés elérhető:
update-updates-found-desc = Javasoljuk, hogy a lehető leghamarabb alkalmazza ezt a frissítést.
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
    .label = Mappaszerkezet újra létrehozása gyűjteményekként
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDF-ek
import-fileTypes-other =
    .placeholder = Egyéb fájlok minta szerint, vesszővel elválasztva (pl. *.jpg,*.png)
import-file-handling = Fájlkezelés
import-file-handling-store =
    .label = Fájlok másolása a { -app-name } tároló mappába
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
import-mendeley-encrypted = A kiválasztott Mendeley-adatbázis nem olvasható, valószínűleg azért, mert titkosítva van. További információkért lásd: <a data-l10n-name="mendeley-import-kb">Hogyan importálhatok egy Mendeley könyvtárat a Zotero programba?</a>
file-interface-import-error-translator = An error occurred importing the selected file with “{ $translator }”. Please ensure that the file is valid and try again.
import-online-intro = In the next step you will be asked to log in to { $targetAppOnline } and grant { -app-name } access. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-intro2 = { -app-name } soha nem fogja látni vagy tárolni a { $targetApp } jelszavát.
import-online-form-intro = Kérjük, adja meg hitelesítő adatait a { $targetAppOnline } bejelentkezéshez. Erre azért van szükség, hogy a { $targetApp } könyvtárat importálni tudja a { -app-name }-ba.
import-online-wrong-credentials = A { $targetApp } bejelentkezés sikertelen. Kérjük, adja meg újra a hitelesítő adatokat, és próbálja meg újra.
import-online-blocked-by-plugin = Az importálás nem folytatható a telepített { $plugin } esetén. Kérjük, tiltsa le ezt a plugint, és próbálja meg újra.
import-online-relink-only =
    .label = Relink Mendeley Desktop citations
import-online-relink-kb = További információ
import-online-connection-error = { -app-name } nem tudott csatlakozni { $targetApp }. Kérjük, ellenőrizze az internetkapcsolatot, és próbálja meg újra.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Jegyzet
           *[other] { $count } Jegyzetek
        }
report-error =
    .label = Hiba bejelentése...
rtfScan-wizard =
    .title = RTF átvizsgálása…
rtfScan-introPage-description = A { -app-name } automatikusan képes kinyerni és újraformázni a hivatkozásokat és bibliográfiát beilleszteni RTF fájlokba. Jelenleg az alábbi változatokban támogatja a hivatkozásokat:
rtfScan-introPage-description2 = A kezdéshez, válasszon egy RTF bemeneti fájlt és egy kimenti fájlt alább:
rtfScan-input-file = Bemeneti fájl:
rtfScan-output-file = Kimeneti fájl:
rtfScan-no-file-selected = Nincs fájl kiválasztva
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Bemeneti fájl kiválasztása
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Kimeneti fájl kiválasztása
rtfScan-intro-page = Bevezetés
rtfScan-scan-page = Hivatkozások keresése
rtfScan-scanPage-description = A { -app-name }hivatkozásokat keres a dokumentumban. Kérem várjon.
rtfScan-citations-page = Hivatkozott elemek ellenőrzése
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page = Dokumentum formázása
rtfScan-format-page = Hivatkozás formázása
rtfScan-format-page-description = { -app-name } feldolgozza és formázza RTF fájlját. Kérem várjon.
rtfScan-complete-page = Az RTF átvizsgálása befejeződött
rtfScan-complete-page-description = A dokumentum átvizsgálása és feldolgozása megtörtént. Győződjön meg róla, hogy megfelelően van formázva.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = JavaScript futtatása
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
styleEditor-locatorType =
    .aria-label = Locator type
styleEditor-locatorInput = Locator input
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Style editor
styleEditor-preview =
    .aria-label = Előnézet
publications-intro-page = Saját publikációk
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
publications-sharing-page = Válassza ki, hogyan szeretné a munkáit megosztani
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
publications-license-page = Válasszon egy Creative Commons licencet.
publications-choose-license-text = A Creative Commons licenc lehetővé teszi mások számára, hogy másolják és továbbadják a munkáját, amennyiben megfelelő módon hivatkoznak az eredeti műre és külön hivatkoznak a licencre is, valamint jelzik, hogy milyen változásokat eszközöltek. Az alábbiakban további feltételek is megadhatók.
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
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Újraindítás hibakereső módban…
    .accesskey = E
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
pane-abstract = Kivonat
pane-attachments = Csatolmányok
pane-notes = Jegyzetek
pane-note-info = Note Info
pane-libraries-collections = Könyvtárak és Gyűjtemények
pane-tags = Címkék
pane-related = Kapcsolatok
pane-attachment-info = Csatolmány információ
pane-attachment-preview = Előnézet
pane-attachment-annotations = Jegyzetek
pane-header-attachment-associated =
    .label = Kapcsolódó fájl átnevezése
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } Mellékletek
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
            [one] { $count } Jegyzet
           *[other] { $count } Jegyzetek
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
    .placeholder = Kivonat hozzáadása…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filter Tags
context-notes-search =
    .placeholder = Keresés a jegyzetek között
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Új gyűjtemény...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Új gyűjtemény
    .buttonlabelaccept = Létrehozás
new-collection-name = Név:
new-collection-create-in = Create in:
show-publications-menuitem =
    .label = Show My Publications
attachment-info-title = Cím
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
    .tooltiptext = A mellékletekhez megjegyzés hozzáadása már nem támogatott, de ezt a megjegyzést szerkesztheti egy külön jegyzetbe való áthelyezéssel.
section-note-info =
    .label = { pane-note-info }
note-info-title = Cím
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
note-info-date-modified = Módosítás dátuma
note-info-size = Méret
note-info-word-count = Word Count
note-info-character-count = Character Count
item-title-empty-note = Cím nélküli jegyzet
attachment-preview-placeholder = Nincs melléklet az előnézethez
attachment-rename-from-parent =
    .tooltiptext = Rename File to Match Parent Item
file-renaming-auto-rename-prompt-title = Renaming Settings Changed
file-renaming-auto-rename-prompt-body = Would you like to rename existing files in your library to match the new settings?
file-renaming-auto-rename-prompt-yes = Preview Changes…
file-renaming-auto-rename-prompt-no = Keep Existing Filenames
rename-files-preview =
    .buttonlabelaccept = Rename Files
rename-files-preview-loading = Betöltés…
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
    .aria-label = Gyorskeresés
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Megtekintés
item-pane-header-none =
    .label = Egyik sem
item-pane-header-title =
    .label = Cím
item-pane-header-titleCreatorYear =
    .label = Cím, Szerző, Év
item-pane-header-bibEntry =
    .label = Bibliography Entry
item-pane-header-more-options =
    .label = További lehetőségek
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
locate-library-lookup-no-resolver = A { -app-name } beállítások { $pane } ablaktábláján kell kiválasztania a feloldót.
architecture-win32-warning-message = Váltson 64 bites { -app-name } rendszerre a legjobb teljesítmény érdekében. Ez nem befolyásolja az adatait.
architecture-warning-action = 64 bites változat letöltése { -app-name }
architecture-x64-on-arm64-message = { -app-name } is running in emulated mode. A native version of { -app-name } will run more efficiently.
architecture-x64-on-arm64-action = { -app-name } letöltése ARM64-re
first-run-guidance-authorMenu = { -app-name } lehetővé teszi szerkesztők és fordítók megadását is. Ebből a menüből kiválasztva a szerzőt szerkesztővé vagy fordítóvá alakíthatja.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Keresési feltételek
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Érték
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] { $count } file added
       *[other] { $count } files added
    }
select-items-window =
    .title = Elemek kiválasztása
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
file-type-webpage = Weboldal
file-type-image = Kép
file-type-pdf = PDF
file-type-audio = Hang
file-type-video = Videó
file-type-presentation = Előadás
file-type-document = Dokumentum
file-type-ebook = Ebook
post-upgrade-message = Frissítve lett a <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span> verzióra! Ismerje meg az <a data-l10n-name="new-features-link">újdonságokat</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Beillesztés és keresés
mac-word-plugin-install-message = A Zotero a Word bővítmény telepítéséhez hozzáférést igényel a Word-fájlokhoz.
mac-word-plugin-install-action-button =
    .label = Word plugin telepítése
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
file-renaming-banner-message = A { -app-name } mostantól automatikusan szinkronizálja a mellékletek fájlneveit, amikor módosításokat hajt végre az elemekben.
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
