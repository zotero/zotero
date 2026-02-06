general-sentence-separator = { " " }
general-key-control = Vald
general-key-shift = Lyg2
general-key-alt = Alt
general-key-option = Parinktis
general-key-command = Komanda
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
       *[other] Įvesti
    }
delete-or-backspace =
    { PLATFORM() ->
        [macos] Delete
       *[other] Įvesti
    }
general-print = Spausdinti
general-remove = Pašalinti
general-add = Pridėti
general-remind-me-later = Priminti vėliau
general-dont-ask-again = Nebeklausti
general-choose-file = Rinkmenos pasirinkimas...
general-open-settings = Atverti nuostatas
general-settings = Settings…
general-help = Žinynas
general-tag = Gairė
general-done = Atlikta
general-view-troubleshooting-instructions = Peržiūrėti nesklandumų sprendimo instrukcijas
general-go-back = Atgal
general-accept = Accept
general-cancel = Atsisakyti
general-show-in-library = Rodyti bibliotekoje
general-restartApp = Restart { -app-name }
general-restartInTroubleshootingMode = Paleisti gedimų nustatymo veiksenoje
general-save = Įrašyti
general-clear = Išvalyti
general-update = Atnaujinti
general-back = Atgal
general-edit = Taisa
general-cut = Iškirpti
general-copy = Kopijuoti
general-paste = Įdėti
general-find = Ieškoti
general-delete = Pašalinti
general-insert = Įterpti
general-and = ir
general-et-al = ir kt.
general-previous = Ankstesnis
general-next = Tolesnis
general-learn-more = Parodyti išsamiau
general-warning = Įspėjimas
general-type-to-continue = Type “{ $text }” to continue.
general-continue = Tęsti
general-red = raudona
general-orange = morkinė
general-yellow = geltona
general-green = žalia
general-teal = žalsvai mėlyna
general-blue = mėlyna
general-purple = purpurinė
general-magenta = rausvai violetinė
general-violet = violetinė
general-maroon = kaštoninė
general-gray = pilka
general-black = juoda
general-loading = Įkeliama...
citation-style-label = Citavimo stilius:
language-label = Kalba:
menu-custom-group-submenu =
    .label = More Options…
menu-file-show-in-finder =
    .label = Rodyti ieškyklėje
menu-file-show-file =
    .label = Atverti rinkmenos aplanką
menu-file-show-files =
    .label = Rodyti rinkmenas
menu-print =
    .label = { general-print }
menu-density =
    .label = Tankumas
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
    .label = Pridėti tinklalapio nuorodą...
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
menu-view-columns-move-left =
    .label = Perkelti stulpelį kairėn
menu-view-columns-move-right =
    .label = Perkelti stulpelį dešinėn
menu-view-hide-context-annotation-rows =
    .label = Hide Non-Matching Annotations
menu-view-note-font-size =
    .label = Pastabos šrifto dydis
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
    .label = Biblioteka
main-window-key =
    .key = D
zotero-toolbar-tabs-menu =
    .tooltiptext = Visų kortelių sąrašas
filter-collections = Rinkinių atranka
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Kortelių paieška
zotero-tabs-menu-close-button =
    .title = Užverti kortelę
zotero-toolbar-tabs-scroll-forwards =
    .title = Scroll forwards
zotero-toolbar-tabs-scroll-backwards =
    .title = Scroll backwards
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Pervadinti rinkinį
collections-menu-edit-saved-search =
    .label = Taisyti įsimintąją paiešką
collections-menu-move-collection =
    .label = Perkelti į
collections-menu-copy-collection =
    .label = Kopijuoti į
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
    .label = Rinkmena
item-menu-add-linked-file =
    .label = Susieta rinkmena
item-menu-add-url =
    .label = Tinklalapio nuoroda
item-menu-change-parent-item =
    .label = Priskirti kitam aukštesniam įrašui…
item-menu-relate-items =
    .label = Relate Items
view-online = Atverti tinklalapį
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Rinkmena pervadinta į { $filename }
itembox-button-options =
    .tooltiptext = Atverti kontekstinį meniu
itembox-button-merge =
    .aria-label = Pasirinkite lauko „{ $field }“ atmainą
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
    .label = Internetinis imporatavimas į { $targetApp }
import-options = Parinktys
import-importing = Importuojama...
import-create-collection =
    .label = Importuotą rinkinį ir įrašus patalpinti naujame rinkinyje
import-recreate-structure =
    .label = Aplankų struktūrą atkurti kaip rinkinius
import-fileTypes-header = Importuotinų rinkmenų tipai:
import-fileTypes-pdf =
    .label = PDF
import-fileTypes-other =
    .placeholder = Kitos importuotinos rinkmenos pagal šabloną atskiriant kableliu (pvz., *.jpg, *.png)
import-file-handling = Rinkmenų tvarkymas
import-file-handling-store =
    .label = Kopijuoti rinkmenas į  { -app-name } saugyklos aplanką
import-file-handling-link =
    .label = Sukurti nuorodas į esamas vietas
import-fileHandling-description = { -app-name } negali sinchronizuoti susietųjų rinkmenų.
import-online-new =
    .label = Parsisiųsti tik naujus įrašus; neatnaujinti anksčiau importuotųjų
import-mendeley-username = Naudotojo vardas
import-mendeley-password = Slaptažodis
general-error = Klaida
file-interface-import-error = Klaida bandant importuoti pasirinktas rinkmenas. Įsitikinkite, ar rinkmena tinkama ir mėginkite iš naujo.
file-interface-import-complete = Importavimas baigtas
file-interface-items-were-imported =
    { $numItems ->
        [0] Nebuvo ką importuoti
        [one] Importuotas vienas įrašas
       *[other] Importuota įrašų: { $numItems }
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Nebuvo iš naujo susietų
        [one] Iš naujo susietas vienas įrašas
       *[other] Iš naujo susieta įrašų: { $numRelinked }
    }
import-mendeley-encrypted = Nepavyksta nuskaityti Mendeley duombazės, galbūt ji užšifruota. Daugiau informacijos rasite straipsnelyje <a data-l10n-name="mendeley-import-kb">Kaip importuoti Mendeley biblioteką į Zotero?</a>.
file-interface-import-error-translator = Klaida importuojant pasirinktą rinkmeną su „{ $translator }“. Įsitikinkite, kad rinkmena yra tinkama ir bandykite iš naujo.
import-online-intro = Kitame žingsnyje prašysime prisijungti prie { $targetAppOnline } paskyros ir suteikti prieigą programai { -app-name } . Tai būtina norint importuoti biblioteką iš { $targetApp } į { -app-name }.
import-online-intro2 = { -app-name } niekada nematys ir nesaugos jūsų { $targetApp } slaptažodžio.
import-online-form-intro = Įveskite prisijungimo prie { $targetAppOnline } paskyros duomenis. Tai būtina norint importuoti biblioteką iš { $targetApp } į { -app-name }.
import-online-wrong-credentials = Nepavyko prisijungti prie { $targetApp }. Iš naujo įveskite prisijungimo duomenis ir bandykite vėl.
import-online-blocked-by-plugin = Importavimo negalima tęsti, jei veikia { $plugin }. Prašome išjungti šį papildinį, tada bandykite iš naujo.
import-online-relink-only =
    .label = Iš naujo susieti Mendeley Desktop citatas
import-online-relink-kb = Daugiau informacijos
import-online-connection-error = { -app-name } negali prisijungti { $targetApp }. Prašome patikrinti  interneto ryšį ir bandykite vėl.
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
rtfScan-introPage-description = { -app-name } gali automatiškai aptikti citavimus, pakeisti jų formatą ir įterpti bibliografiją į raiškiojo teksto formato (RTF) dokumentus. Palaikomi įvairiausi citavimo formatai:
rtfScan-introPage-description2 = Norėdami pradėti,  įvedimui pasirinkite RTF dokumentą ir dokumentą išvedimui:
rtfScan-input-file = Įvedimo rinkmena:
rtfScan-output-file = Išvedimo rinkmena:
rtfScan-no-file-selected = Nepasirinkote rinkmenos
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Pasirinkite įvedimo rinkmeną
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Pasirinkite išvedimo rinkmeną
rtfScan-intro-page = Įvadas
rtfScan-scan-page = Peržvlgiame citavimus
rtfScan-scanPage-description = { -app-name } ieško citatų jūsų dokumente. Kantriai palaukite.
rtfScan-citations-page = Tikrinti cituotus įrašus
rtfScan-citations-page-description = Peržiūrėkite atpažintų citatų sąrašą ir įsitikinkite, kad { -app-name } teisingai parinko atitinkamus įrašus. Būtinai išspręskite nesusietas arba dviprasmiškas citatas prieš eidami prie kito žingsnio.
rtfScan-style-page = Dokumento formatavimas
rtfScan-format-page = Formatuojame citavimus
rtfScan-format-page-description = { -app-name } apdoroja ir formatuoja jūsų RTF rinkmeną. Būkite kantrūs.
rtfScan-complete-page = Raiškiojo teksto formato dokumentų peržvelgimas baigtas
rtfScan-complete-page-description = Jūsiškis dokumentas peržvelgtas ir apdorotas. Pažiūrėkite, ar jis tinkamai suformatuotas.
rtfScan-action-find-match =
    .title = Pasirinkti atitinkantį įrašą
rtfScan-action-accept-match =
    .title = Patvirtinti šį atitikmenį
runJS-title = Paleisti JavaScript
runJS-editor-label = Kodas:
runJS-run = Vykdyti
runJS-help = { general-help }
runJS-completed = completed successfully
runJS-result =
    { $type ->
        [async] Grąžinta reikšmė:
       *[other] Rezultatas:
    }
runJS-run-async = Vykdyti kaip nesinchronizuotą funkciją
bibliography-window =
    .title = { -app-name } - Sukurti citatą / literatūros sąrašą
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Citavimo rodymo pavidalas:
bibliography-advancedOptions-label = Kitos parinktys
bibliography-outputMode-label = Išvedimo veiksena:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] citatos
            [note] pastabos
           *[other] citatos
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
styleEditor-locatorType =
    .aria-label = Ieškiklio tipas
styleEditor-locatorInput = Locator input
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Stilių rengyklė
styleEditor-preview =
    .aria-label = Peržiūra
publications-intro-page = Nuosavos publikacijos
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
publications-sharing-page = Nurodykite, kaip jūsų darbas gali būti platinamas
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
publications-license-page = Pasirinkite „Creative Commons“ licenciją
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
    .label = Toliau: platinimas
publications-buttons-next-choose-license =
    .label = pasirinkti licenciją
licenses-cc-0 = CC0 1.0 universalus viešas priskyrimas
licenses-cc-by = CC BY 4.0 tarptautinė licencija: priskyrimas
licenses-cc-by-nd = CC BY-ND 4.0 tarptautinė licencija: priskyrimas, jokių išvestinių darbų
licenses-cc-by-sa = CC BY-SA 4.0 tarptautinė licencija: priskyrimas, analogiškas platinimas
licenses-cc-by-nc = CC BY-NC 4.0 tarptautinė licencija: priskyrimas, nekomercinis platinimas
licenses-cc-by-nc-nd = CC BY-NC-ND 4.0 tarptautinė licencija: priskyrimas, nekomercinis platinimas, jokių išvestinių darbų
licenses-cc-by-nc-sa = CC BY-NC-SA 4.0 tarptautinė licencija: priskyrimas, nekomercinis, analogiškas platinimas
licenses-cc-more-info = Prieš platindami darbą pagal CC licenciją, perskaitykite „Creative Commons“ <a data-l10n-name="license-considerations">licencijos davėjams svarbias aplinkybes</a>. Atminkite, kad pasirinktos licencijos negalėsite atšaukti, net jei vėliau pasirinksite kitokias sąlygas ar apskritai nustosite platinti dokumentą.
licenses-cc0-more-info = Prieš platindami darbą pagal CC0 licenciją, perskaitykite „Creative Commons“ <a data-l10n-name="license-considerations">CC0 D.U.K.</a>. Atminkite, kad sprendimo, jog darbas bus viešas, negalėsite pakeisti, net jei vėliau pasirinksite kitokias sąlygas ar apskritai nustosite platinti dokumentą.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Paleisti gedimų nustatymo veiksenoje...
    .accesskey = I
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } pasileis iš naujo išjungus visus papildinius. Įgalinus gedimų nustatymo veikseną, kai kurios galimybės gali neveikti tinkamai.
menu-ui-density =
    .label = Tankumas
menu-ui-density-comfortable =
    .label = Patogus
menu-ui-density-compact =
    .label = Glaustas
pane-item-details = Item Details
pane-info = Informacija
pane-abstract = Santrauka
pane-attachments = Priedai
pane-notes = Pastabos
pane-note-info = Note Info
pane-libraries-collections = Bibliotekos ir rinkiniai
pane-tags = Gairės
pane-related = Susiję
pane-attachment-info = Priedo informacija
pane-attachment-preview = Peržiūra
pane-attachment-annotations = Anotacijos
pane-header-attachment-associated =
    .label = Pervadinti susijusią rinkmeną
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } priedas
            [few] { $count } priedai
            [many] { $count } priedų
           *[other] { $count } priedas
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } anotacija
            [few] { $count } anotacijos
            [many] { $count } anotacijų
           *[other] { $count } anotacija
        }
section-attachments-move-to-trash-message = Are you sure you want to move “{ $title }” to the trash?
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
            [one] { $count } gairė
            [few] { $count } gairės
            [many] { $count } gairių
           *[other] { $count } gairė
        }
section-related =
    .label = Susijusių: { $count }
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Išskleisti lauką
    .label = Išskleisti lauką „{ $section }“
section-button-collapse =
    .dynamic-tooltiptext = Suskleisti lauką
    .label = Suskleisti lauką „{ $section }“
annotations-count =
    { $count ->
        [one] { $count } anotacija
        [few] { $count } anotacijos
        [many] { $count } anotacijų
       *[other] { $count } anotacija
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
    .tooltiptext = Perjungti kontekstinę sritį
pin-section =
    .label = Prisegti lauką
unpin-section =
    .label = Atsegti lauką
collapse-other-sections =
    .label = Suskleisti kitus laukus
expand-all-sections =
    .label = Išskleisti visus laukus
abstract-field =
    .placeholder = Pridėti santrauką...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Atrinkti gaires
context-notes-search =
    .placeholder = Pastabų paieška
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Naujas rinkinys...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Naujas rinkinys
    .buttonlabelaccept = Sukurti rinkinį
new-collection-name = Pavadinimas:
new-collection-create-in = Kur sukurti:
show-publications-menuitem =
    .label = Show My Publications
attachment-info-title = Pavadinimas
attachment-info-filename = Rinkmenos vardas
attachment-info-accessed = Žiūrėta
attachment-info-pages = Puslapiai
attachment-info-modified = Pakeista
attachment-info-index = Suindeksuota
attachment-info-convert-note =
    .label =
        Pereiti į { $type ->
            [standalone] paskirą
            [child] įrašo
           *[unknown] naują
        } pastabą
    .tooltiptext = Pastabų pridėjimas prie priedų nebepalaikomas, tačiau galite redaguoti šią pastabą perkeldami ją kaip atskirą pastabą.
section-note-info =
    .label = { pane-note-info }
note-info-title = Pavadinimas
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
note-info-date-modified = Pakeista
note-info-size = Dydis
note-info-word-count = Word Count
note-info-character-count = Character Count
item-title-empty-note = Bevardė pastaba
attachment-preview-placeholder = Nėra peržiūrėtinų priedų
attachment-rename-from-parent =
    .tooltiptext = Rename File to Match Parent Item
file-renaming-auto-rename-prompt-title = Renaming Settings Changed
file-renaming-auto-rename-prompt-body = Would you like to rename existing files in your library to match the new settings?
file-renaming-auto-rename-prompt-yes = Preview Changes…
file-renaming-auto-rename-prompt-no = Keep Existing Filenames
rename-files-preview =
    .buttonlabelaccept = Rename Files
rename-files-preview-loading = Įkeliama...
rename-files-preview-intro = { -app-name } will rename the following files in your library to match their parent items:
rename-files-preview-renaming = Renaming…
rename-files-preview-no-files = All filenames already match parent items. No changes are required.
toggle-preview =
    .label =
        { $type ->
            [open] Slėpti
            [collapsed] Rodyti
           *[unknown] Perjungti
        } priedą
annotation-image-not-available = [Image not available]
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
        [0] Nepasirinktas nei vienas
        [one] Pasirinktas { $count } įrašas
        [few] Pasirinkti { $count } įrašai
        [many] Pasirinkta { $count } įrašų
       *[other] Pasirinktas { $count } įrašas
    }
item-pane-message-collections-selected =
    { $count ->
        [one] Pasirinktas { $count } rinkinys
        [few] Pasirinkti { $count } rinkiniai
        [many] Pasirinkta { $count } rinkinių
       *[other] Pasirinktas { $count } rinkinys
    }
item-pane-message-searches-selected =
    { $count ->
        [one] Pasirinkta { $count } paieška
        [few] Pasirinktos { $count } paieškos
        [many] Pasirinkta { $count } paieškų
       *[other] Pasirinkta { $count } paieška
    }
item-pane-message-objects-selected =
    { $count ->
        [one] Pasirinktas { $count } objektas
        [few] Pasirinkti { $count } objektai
        [many] Pasirinkta { $count } objektų
       *[other] Pasirinktas { $count } objektas
    }
item-pane-message-unselected =
    { $count ->
        [0] Šiame rodinyje įrašų nėra
        [one] { $count } įrašas šiame rodinyje
        [few] { $count } įrašai šiame rodinyje
        [many] { $count } įrašų šiame rodinyje
       *[other] { $count } įrašas šiame rodinyje
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] Šiame rodinyje objektų nėra
        [one] { $count } objektas šiame rodinyje
        [few] { $count } objektai šiame rodinyje
        [many] { $count } objektų šiame rodinyje
       *[other] { $count } objektas šiame rodinyje
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Apjungti { $count } įrašą
            [few] Apjungti { $count } įrašus
            [many] Apjungti { $count } įrašų
           *[other] Apjungti { $count } įrašus
        }
locate-library-lookup-no-resolver = Jums reikia { -app-name } nuostatų { $pane } skydelyje pasirinkti sprendiklį.
architecture-win32-warning-message = Didžiausias našumas būtų perėjus prie 64 bitų { -app-name } programos. Jūsų duomenys dėl to nenukentės.
architecture-warning-action = Parsisiųsti 64 bitų { -app-name }
architecture-x64-on-arm64-message = { -app-name } paleista emuliavimo veiksenoje. Įprasta { -app-name } versija veiktų našiau.
architecture-x64-on-arm64-action = Parsisiųsti { -app-name } programos ARM64 versiją
first-run-guidance-authorMenu = { -app-name } leidžia jums dar nurodyti sudarytojus (redaktorius) ir vertėjus. Per šį meniu galite pasirinkto vaidmenį žmogaus, kuris šiuo metu nurodytas esąs autorius, pakeisti į sudarytojo arba vertėjo vaidmenį.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Paieškos sąlyga
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operatorius
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Reikšmė
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] Pridėta { $count } rinkmena
        [few] Pridėta { $count } rinkmenos
        [many] Pridėta { $count } rinkmenų
       *[other] Pridėta { $count } rinkmena
    }
select-items-window =
    .title = Pasirinkti įrašus
select-items-dialog =
    .buttonlabelaccept = Pasirinkti
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
file-type-webpage = Tinklalapis
file-type-image = Paveikslas
file-type-pdf = PDF
file-type-audio = Garso įr.
file-type-video = Vaizdas
file-type-presentation = Pateiktis
file-type-document = Dokumentas
file-type-ebook = El. knyga
post-upgrade-message = You’ve been upgraded to <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Learn about <a data-l10n-name="new-features-link">what’s new</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Įdėti ir ieškoti
mac-word-plugin-install-message = Zotero turi galėti prieiti prie „Word“ duomenų tam, kad galėtų įdiegti papildinį „Word“ programai.
mac-word-plugin-install-action-button =
    .label = Įdiegti papildinį „Word“ programai
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
