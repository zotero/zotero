general-print = Spausdinti
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Įvesti
    }
general-remove = Pašalinti
general-add = Pridėti
general-remind-me-later = Priminti vėliau
general-choose-file = Rinkmenos pasirinkimas...
general-open-settings = Atverti nuostatas
general-help = Žinynas
general-tag = Tag
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
        Atverti { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] momentinę kopiją
                   *[other] priedą
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] momentines kopijas
                   *[other] priedus
                }
        } { $openIn ->
            [tab] naujoje kortelėje
            [window] naujame lange
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
file-renaming-file-renamed-to = File renamed to { $filename }
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
rtfScan-introPage-description = { -app-name } gali automatiškai ištraukti ir pertvarkyti citatų formatą, taip pat įterpti literatūros sąrašą į RTF rinkmenas. Norėdami pradėti, žemiau pasirinkite RTF rinkmeną.
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
rtfScan-scanPage-description = { -app-name } ieško citatų jūsų dokumente. Kantriai palaukite.
rtfScan-citations-page =
    .label = Tikrinti cituotus įrašus
rtfScan-citations-page-description = Peržiūrėkite atpažintų citatų sąrašą ir įsitikinkite, kad { -app-name } teisingai parinko atitinkamus įrašus. Būtinai išspręskite nesusietas arba dviprasmiškas citatas prieš eidami prie kito žingsnio.
rtfScan-style-page =
    .label = Dokumento formatavimas
rtfScan-format-page =
    .label = Formatuojame citavimus
rtfScan-format-page-description = { -app-name } apdoroja ir formatuoja jūsų RTF rinkmeną. Būkite kantrūs.
rtfScan-complete-page =
    .label = Raiškiojo teksto formato dokumentų peržvelgimas baigtas
rtfScan-complete-page-description = Jūsiškis dokumentas peržvelgtas ir apdorotas. Pažiūrėkite, ar jis tinkamai suformatuotas.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Paleisti JavaScript
runJS-editor-label = Kodas:
runJS-run = Vykdyti
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Grąžinta reikšmė:
       *[other] Rezultatas:
    }
runJS-run-async = Vykdyti kaip nesinchronizuotą funkciją
bibliography-window =
    .title = { -app-name } - Sukurti citatą / literatūros sąrašą
bibliography-style-label = Citavimo stilius:
bibliography-locale-label = Kalba:
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
integration-docPrefs-window =
    .title = { -app-name } - Dokumento parinktys
integration-addEditCitation-window =
    .title = { -app-name } - Pridėti/keisti citatą
integration-editBibliography-window =
    .title = { -app-name } - Keisti literatūros sąrašą
integration-quickFormatDialog-window =
    .title = { -app-name } - Greitasis citatų formatavimas
integration-prefs-displayAs-label = Citavimo rodymo pavidalas:
integration-prefs-footnotes =
    .label = Išnaša
integration-prefs-endnotes =
    .label = Galinė išnaša
integration-prefs-bookmarks =
    .label = Citatas saugoti kaip žymeles
integration-prefs-bookmarks-description = Žymelės išlaikomos tiek „Word“, tiek „LibreOffice“ programose, tačiau netyčia jas pakeitus, gali atsirasti klaidų. Žymelių negalite įterpti į išnašas ar galines išnašas.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Dokumentą reikia įrašyti .doc arba .docx formatu.
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
restart-in-troubleshooting-mode-menuitem =
    .label = Paleisti gedimų nustatymo veiksenoje...
    .accesskey = I
restart-in-troubleshooting-mode-dialog-title = Paleisti gedimų nustatymo veiksenoje
restart-in-troubleshooting-mode-dialog-description = { -app-name } pasileis iš naujo išjungus visus papildinius. Įgalinus gedimų nustatymo veikseną, kai kurios galimybės gali neveikti tinkamai.
menu-ui-density =
    .label = Tankumas
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
    .dynamic-tooltiptext = Expand section
    .label = Expand { $section } section
section-button-collapse =
    .dynamic-tooltiptext = Collapse section
    .label = Collapse { $section } section
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
tag-field =
    .aria-label = { general-tag }
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
        Pereiti į { $type ->
            [standalone] paskirą
            [child] įrašo
           *[unknown] naują
        } pastabą
    .tooltiptext = Pastabų pridėjimas prie priedų nebepalaikomas, tačiau galite redaguoti šią pastabą perkeldami ją kaip atskirą pastabą.
attachment-preview-placeholder = Nėra peržiūrėtinų priedų
toggle-preview =
    .label =
        { $type ->
            [open] Slėpti
            [collapsed] Rodyti
           *[unknown] Perjungti
        } priedą
quickformat-general-instructions =
    Norėdami pereiti per šio citavimo įrašus, judėkite rodyklių klavišais kairėn ir dešinėn. { $dialogMenu ->
        [active] Norėdami pereiti į lango meniu, spauskite Lyg2+Tab.
       *[other] { "" }
    } Norėdami patvirtinti šio citavimo pakeitimus, spauskite { return-or-enter }. Jei atmesti keitimus, spauskite grįžties (Gr, angl. Esc) klavišą.
quickformat-aria-bubble = Šis įrašas įtrauktas į citavimą. Norėdami jį pataisyti, spauskite tarpo klavišą. { quickformat-general-instructions }
quickformat-aria-input = Norėdami įtraukti citatą, pradėkite vesti tarsi įrašo paiešką. Norėdami naršyti paieškos rezultatus, spauskite Tab. { quickformat-general-instructions }
quickformat-aria-item = Paspaudę { return-or-enter } pridėsite šį įrašą prie citavimo. Norėdami grįžti į paieškos lauką, spauskite Tab.
quickformat-accept =
    .tooltiptext = Išsaugoti šio citavimo pakeitimus
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
architecture-win32-warning-message = { -app-name } paleista 32 bitų veiksenoje 64 bitų Windows sistemoje. { -app-name } veiks veiksmingiau 64 bitų veiksenoje.
architecture-warning-action = Parsisiųsti 64 bitų { -app-name }
first-run-guidance-quickFormat =
    Įveskite pavadinimą, autorių ir (arba) metus ir ieškokite informacijos šaltinio.
    
    Išsirinkę šaltinius, spustelėkite burbuliuką arba pažymėkite jį klaviatūra ir paspauskite ↓/ tarpą norėdami pamatyti citavimo parinktis, pavyzdžiui, puslapio numerį, priešdėlį ir priesagą.
    
    Taip pat galite tiesiogiai pridėti puslapio numerį, įvesdami jį kartu su paieškos žodžiais arba įrašydami jį po burbulu ir paspausdami { return-or-enter }.
first-run-guidance-authorMenu = { -app-name } leidžia jums dar nurodyti sudarytojus (redaktorius) ir vertėjus. Per šį meniu galite pasirinkto vaidmenį žmogaus, kuris šiuo metu nurodytas esąs autorius, pakeisti į sudarytojo arba vertėjo vaidmenį.
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
