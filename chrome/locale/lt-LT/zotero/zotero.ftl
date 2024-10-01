general-print = Spausdinti
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Įvesti
    }
general-remove = Pašalinti
general-add = Pridėti
general-remind-me-later = Priminti vėliau
general-dont-ask-again = Nebeklausti
general-choose-file = Rinkmenos pasirinkimas...
general-open-settings = Atverti nuostatas
general-help = Žinynas
general-tag = Gairė
general-done = Atlikta
general-view-troubleshooting-instructions = Peržiūrėti nesklandumų sprendimo instrukcijas
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
    .placeholder = Kortelių paieška
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
    .label = Tinklalapio nuoroda
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
integration-error-unable-to-find-winword = { -app-name } negali rasti paleistos Word programos.
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
new-collection-dialog =
    .title = Naujas rinkinys
    .buttonlabelaccept = Sukurti rinkinį
new-collection-name = Pavadinimas:
new-collection-create-in = Kur sukurti:
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
    .aria-label = Ieškiklio tipas
quickformat-locator-value = Ieškiklis
quickformat-citation-options =
    .tooltiptext = Rodyti citavimo parinktis
insert-note-aria-input = Norėdami ieškoti pastabos, tiesiog rašykite čia. Pereiti per rezultatus galėsite naudodami Tab. Norėdami užverti, spauskite Gr(įžties) klavišą.
insert-note-aria-item = Norėdami pasirinkti šią pastabą, spauskite { return-or-enter }. Paspaudę Tab grįšite į paieškos lauką. Norėdami užverti, spauskite Gr(įžties) klavišą.
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
        [0] No objects in this view
        [one] { $count } object in this view
       *[other] { $count } objects in this view
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
select-items-dialog =
    .buttonlabelaccept = Pasirinkti
file-type-webpage = Tinklalapis
file-type-image = paveikslą
file-type-pdf = PDF
file-type-audio = Garsas
file-type-video = Vaizdas
file-type-presentation = Pateiktis
file-type-document = Dokumentas
file-type-ebook = El. knyga
post-upgrade-message = Sužinokite apie <a data-l10n-name="new-features-link">naujas { -app-name } { $version } galimybes</a>
post-upgrade-density = Pasirinkite pageidaujamą išdėstymo tankumą:
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Įdėti ir ieškoti
mac-word-plugin-install-message = Zotero needs access to Word data to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = Install Word plugin
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
