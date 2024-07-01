general-print = Spausdinti
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Pašalinti
general-add = Pridėti
general-remind-me-later = Priminti vėliau
general-choose-file = Rinkmenos pasirinkimas...
general-open-settings = Atverti nuostatas
general-help = Žinynas
menu-file-show-in-finder =
    .label = Rodyti ieškyklėje
menu-file-show-file =
    .label = Atverti rinkmenos aplanką
menu-file-show-files =
    .label = Rodyti rinkmenas
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = Įtraukti priedą
new-note = Nauja pastaba
menu-add-by-identifier =
    .label = Pridėti pagal identifikatorių...
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Pridėti rinkmeną...
menu-add-standalone-linked-file-attachment =
    .label = Pridėti nuorodą iki rinkmenos...
menu-add-child-file-attachment =
    .label = Pridėti rinkmeną...
menu-add-child-linked-file-attachment =
    .label = Pridėti nuorodą iki rinkmenos...
menu-add-child-linked-url-attachment =
    .label = Pridėti žiniatinklio nuorodą...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nauja nesusieta pastaba
menu-new-item-note =
    .label = Nauja įrašo pastaba
menu-restoreToLibrary =
    .label = Atkurti į biblioteką
menu-deletePermanently =
    .label = Pašalinti negrįžtamai...
menu-tools-plugins =
    .label = Papildiniai
main-window-command =
    .label = { -app-name }
zotero-toolbar-tabs-menu =
    .tooltiptext = Visų kortelių sąrašas
filter-collections = Rinkinių atranka
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Paieškų kortelės
zotero-tabs-menu-close-button =
    .title = Užverti kortelę
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Pervadinti rinkinį
collections-menu-edit-saved-search =
    .label = Taisyti įsimintąją paiešką
item-creator-moveDown =
    .label = Nuleisti žemyn
item-creator-moveToTop =
    .label = Perkelti į viršų
item-creator-moveUp =
    .label = Kelti aukštyn
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
    .label = Rinkmena
item-menu-add-linked-file =
    .label = Susieta rinkmena
item-menu-add-url =
    .label = Žiniatinklio nuoroda
view-online = Atverti tinklalapį
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
itembox-button-options =
    .tooltiptext = Atverti kontekstinį meniu
itembox-button-merge =
    .aria-label = Select version of { $field } field
create-parent-intro = Įveskite šios rinkmenos DOI, ISBN, PMID, arXiv ID arba ADS bibkodą:
reader-use-dark-mode-for-content =
    .label = Tamsus turinio apipavidalinimas
update-updates-found-intro-minor = Siūlome atnaujinti { -app-name }:
update-updates-found-desc = Patariame kaip galima greičiau pritaikyti šį atnaujinimą.
import-window =
    .title = Importavimas
import-where-from = Iš kur norėtumėte importuoti?
import-online-intro-title = Įvadas
import-source-file =
    .label = iš rinkmenos (BibTeX, RIS, Zotero RDF ar kt.)
import-source-folder =
    .label = PDF ir kitų rinkmenų katalogas
import-source-online =
    .label = { $targetApp } online import
import-options = Parinktys
import-importing = Importuojama...
import-create-collection =
    .label = Importuotą rinkinį ir įrašus patalpinti naujame rinkinyje
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = Importuotinų rinkmenų tipai:
import-fileTypes-pdf =
    .label = PDF
import-fileTypes-other =
    .placeholder = Kitos importuotinos rinkmenos pagal šabloną atskiriant kableliu (pvz., *.jpg, *.png)
import-file-handling = Rinkmenų tvarkymas
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Sukurti nuorodas į esamas vietas
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Parsisiųsti tik naujus įrašus; neatnaujinti anksčiau importuotųjų
import-mendeley-username = Naudotojo vardas
import-mendeley-password = Slaptažodis
general-error = Klaida
file-interface-import-error = Klaida bandant importuoti pasirinktas rinkmenas. Įsitikinkite, ar rinkmena tinkama ir mėginkite iš naujo.
file-interface-import-complete = Importavimas baigtas
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
import-online-relink-kb = Daugiau informacijos
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] Pastabų: { $count }
            [few] Pastabų: { $count }
            [many] Pastabų: { $count }
           *[other] Pastabų: { $count }
        }
report-error =
    .label = Pranešti apie klaidą...
rtfScan-wizard =
    .title = RTF peržvelgimas
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = Norėdami pradėti,  įvedimui pasirinkite RTF dokumentą ir dokumentą išvedimui:
rtfScan-input-file = Įvedimo rinkmena
rtfScan-output-file = Išvedimo rinkmena
rtfScan-no-file-selected = Nepasirinkote rinkmenos
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Pasirinkite įvedimo rinkmeną
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Pasirinkite išvedimo rinkmeną
rtfScan-intro-page =
    .label = Įvadas
rtfScan-scan-page =
    .label = Peržvlgiame citavimus
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = Tikrinti cituotus įrašus
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = Dokumento formatavimas
rtfScan-format-page =
    .label = Formatuojame citavimus
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = Raiškiojo teksto formato dokumentų peržvelgimas baigtas
rtfScan-complete-page-description = Jūsiškis dokumentas peržvelgtas ir apdorotas. Pažiūrėkite, ar jis tinkamai suformatuotas.
runJS-title = Paleisti JavaScript
runJS-editor-label = Kodas:
runJS-run = Vykdyti
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Run as async function
bibliography-window =
    .title = { -app-name } - Create Citation/Bibliography
bibliography-style-label = Citavimo stilius:
bibliography-locale-label = Kalba:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Kitos parinktys
bibliography-outputMode-label = Išvedimo veiksena:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliografija
bibliography-outputMethod-label = Išvedimo būdas:
bibliography-outputMethod-saveAsRTF =
    .label = Įrašyti RTF formatu
bibliography-outputMethod-saveAsHTML =
    .label = Įrašyti HTML formatu
bibliography-outputMethod-copyToClipboard =
    .label = Kopijuoti į iškarpinę
bibliography-outputMethod-print =
    .label = Spausdinti
bibliography-manageStyles-label = Tvarkyti stilius...
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = Citavimo rodymo pavidalas:
integration-prefs-footnotes =
    .label = Išnaša
integration-prefs-endnotes =
    .label = Galinė išnaša
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = Žymelės išlaikomos tiek „Word“, tiek „LibreOffice“ programose, tačiau netyčia jas pakeitus, gali atsirasti klaidų. Žymelių negalite įterpti į išnašas ar galines išnašas.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Automatiškai atnaujinti citavimus
    .tooltip = Citavimai, kurių laukia atnaujinimai, dokumente paryškinsimi
integration-prefs-automaticCitationUpdates-description = Atnaujinimų išjungimas gali pagreitinti citavimų įterpimą dideliuose dokumentuose. Tuomet spauskite „atnaujinti“, jei norite tą padaryti rankiniu būdu.
integration-prefs-automaticJournalAbbeviations =
    .label = Naudoti MEDLINE žurnalų santrumpas
integration-prefs-automaticJournalAbbeviations-description = Ignoruosima reikšmė „žurnalo santrumpos“ laukelyje
integration-prefs-exportDocument =
    .label = Persijungti į kitą raštinės programą...
publications-intro-page =
    .label = Nuosavos publikacijos
publications-intro = „Nuosavose publikacijose“ patalpinti įrašai rodysimi Zotero.org svetainėje jūsų profilyje. Jei pasirenkate įtraukti prisegtas rinkmenas, jos bus viešai prieinamos pagal jūsų pasirinktą licenciją. „Nuosavoms publikacijoms“ priskirkite tik tuos darbus, kuriuos patys kūrėte, o rinkmenas viešinkite tik jei turite teisę tą daryti.
publications-include-checkbox-files =
    .label = Įtraukti rinkmenas
publications-include-checkbox-notes =
    .label = Įtraukti pastabas
publications-include-adjust-at-any-time = Tai, ką rodyti, galėsite bet kada vėliau pasirinkti „Nuosavų publikacijų“ rinkinyje.
publications-intro-authorship =
    .label = Esu šio darbo kūrėjas.
publications-intro-authorship-files =
    .label = Esu šio darbo kūrėjas ir turiu teisę platinti dokumentus.
publications-sharing-page =
    .label = Nurodykite, kaip jūsų darbas gali būti platinamas
publications-sharing-keep-rights-field =
    .label = Išlaikyti esamą teisių lauką
publications-sharing-keep-rights-field-where-available =
    .label = Išlaikyti esamą teisių lauką ten, kur įmanoma
publications-sharing-text = Galite išlaikyti visas savo teises į darbą, galite platinti pagal „Creative Commons“ (CC) licenciją arba galite jį priskirti viešai sričiai (CC0). Bet kuriuo atveju publikacija paviešinsima per zotero.org.
publications-sharing-prompt = Ar leidžiate kitiems dalintis jūsų darbu?
publications-sharing-reserved =
    .label = Ne, tik paviešinti darbą per zotero.org
publications-sharing-cc =
    .label = Taip, pagal „Creative Commons“ licenciją
publications-sharing-cc0 =
    .label = Taip, priskiriant mano darbą viešai sričiai (angl. „Creative Commons Public Domain“, CC0)
publications-license-page =
    .label = Pasirinkite „Creative Commons“ licenciją
publications-choose-license-text = „Creative Commons“ licencija leidžia kitiems kopijuoti ir platinti jūsų darbą su sąlyga, kad jie nurodo jus kaip autorių, pateikia nuorodą į licenciją ir nurodo, ar jūsų originalus darbas buvo pakeistas. Žemiau galite pasirinkti papildomas sąlygas.
publications-choose-license-adaptations-prompt = Ar leisti platinti pakeistą/perdarytą jūsų darbą?
publications-choose-license-yes =
    .label = Taip
    .accesskey = T
publications-choose-license-no =
    .label = Ne
    .accesskey = N
publications-choose-license-sharealike =
    .label = Taip, jeigu kiti platina tokiomis pačiomis licencijos sąlygomis
    .accesskey = S
publications-choose-license-commercial-prompt = Leisti jūsų darbus naudoti komerciniais tikslais?
publications-buttons-add-to-my-publications =
    .label = Pridėti prie „Nuosavų publikacijų“
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = pasirinkti licenciją
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = CC BY 4.0 tarptautinė licencija: priskyrimas
licenses-cc-by-nd = CC BY-ND 4.0 tarptautinė licencija: priskyrimas, jokių išvestinių darbų
licenses-cc-by-sa = CC BY-SA 4.0 tarptautinė licencija: priskyrimas, analogiškas platinimas
licenses-cc-by-nc = CC BY-NC 4.0 tarptautinė licencija: priskyrimas, nekomercinis platinimas
licenses-cc-by-nc-nd = CC BY-NC-ND 4.0 tarptautinė licencija: priskyrimas, nekomercinis platinimas, jokių išvestinių darbų
licenses-cc-by-nc-sa = CC BY-NC-SA 4.0 tarptautinė licencija: priskyrimas, nekomercinis, analogiškas platinimas
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = I
restart-in-troubleshooting-mode-dialog-title = Restart in Troubleshooting Mode
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Density
menu-ui-density-comfortable =
    .label = Patogus
menu-ui-density-compact =
    .label = Glaustas
pane-info = Informacija
pane-abstract = Santrauka
pane-attachments = Priedai
pane-notes = Pastabos
pane-libraries-collections = Bibliotekos ir rinkiniai
pane-tags = Gairės
pane-related = Susiję
pane-attachment-info = Priedo informacija
pane-attachment-preview = Peržiūra
pane-attachment-annotations = Anotacijos
pane-header-attachment-associated =
    .label = Pervadinti susijusią rinkmeną
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
            [one] Pastabų: { $count }
            [few] Pastabų: { $count }
            [many] Pastabų: { $count }
           *[other] Pastabų: { $count }
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
    .tooltiptext = Expand section
section-button-collapse =
    .tooltiptext = Collapse section
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
    .placeholder = Pridėti santrauką...
tagselector-search =
    .placeholder = Atrinkti gaires
context-notes-search =
    .placeholder = Pastabų paieška
new-collection-dialog =
    .title = Naujas rinkinys
    .buttonlabelaccept = Sukurti rinkinį
new-collection-name = Pavadinimas:
new-collection-create-in = Kur sukurti:
attachment-info-filename = Rinkmenos vardas
attachment-info-accessed = Žiūrėta
attachment-info-pages = Puslapiai
attachment-info-modified = Pakeista
attachment-info-index = Suindeksuota
attachment-info-convert-note =
    .label =
        Migrate to { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } Note
    .tooltiptext = Pastabų pridėjimas prie priedų nebepalaikomas, tačiau galite redaguoti šią pastabą perkeldami ją kaip atskirą pastabą.
attachment-preview-placeholder = Nėra peržiūrėtinų priedų
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
    .tooltiptext = Rodyti citavimo parinktis
insert-note-aria-input = Type to search for a note. Press Tab to navigate the list of results. Press Escape to close the dialog.
insert-note-aria-item = Press { return-or-enter } to select this note. Press Tab to go back to the search field. Press Escape to close the dialog.
quicksearch-mode =
    .aria-label = Greitosios paieškos veiksena
quicksearch-input =
    .aria-label = Greitoji paieška
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Rodyti kaip
item-pane-header-none =
    .label = Jokio
item-pane-header-title =
    .label = Pavadinimas
item-pane-header-titleCreatorYear =
    .label = Pavadinimas, autoriai, metai
item-pane-header-bibEntry =
    .label = Bibliografinis įrašas
item-pane-header-more-options =
    .label = Daugiau parinkčių
item-pane-message-items-selected =
    { $count ->
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
    .aria-label = Paieškos sąlyga
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Reikšmė
    .label = { $label }
