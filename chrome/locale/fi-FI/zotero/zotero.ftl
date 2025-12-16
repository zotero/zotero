general-sentence-separator = { " " }
general-key-control = control
general-key-shift = vaihto
general-key-alt = Alt
general-key-option = valinta
general-key-command = komento
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
        [macos] Palauta
       *[other] Syötä
    }
delete-or-backspace =
    { PLATFORM() ->
        [macos] Palauta
       *[other] Syötä
    }
general-print = Tulosta
general-remove = Poista
general-add = Lisää
general-remind-me-later = Muistuta myöhemmin
general-dont-ask-again = Älä kysy uudelleen
general-choose-file = Valitse tiedosto...
general-open-settings = Avaa asetukset
general-settings = Asetukset…
general-help = Ohje
general-tag = Merkki
general-done = Valmis
general-view-troubleshooting-instructions = Katso vianhakuohjeet
general-go-back = Siirry takaisinpäin
general-accept = Hyväksy
general-cancel = Peruuta
general-show-in-library = Näytä kirjastossa
general-restartApp = Uudelleenkäynnistä { -app-name }
general-restartInTroubleshootingMode = Käynnistä uudelleen virheenjäljitystilassa
general-save = Tallenna
general-clear = Tyhjennä
general-update = Päivitä
general-back = Takaisin
general-edit = Muokkaa
general-cut = Leikkaa
general-copy = Kopioi
general-paste = Liitä
general-find = Etsi
general-delete = Poista
general-insert = Lisää
general-and = ja
general-et-al = ym.
general-previous = Edellinen
general-next = Seuraava
general-learn-more = Lisätietoja
general-warning = Varoitus
general-type-to-continue = Kirjoita “{ $text }” jatkaaksesi.
general-red = Punainen
general-orange = Oranssi
general-yellow = Keltainen
general-green = Vihreä
general-teal = Sinivihreä
general-blue = Sininen
general-purple = Purppura
general-magenta = Magenta
general-violet = Violetti
general-maroon = Kastanjanruskea
general-gray = Harmaa
general-black = Musta
citation-style-label = Viittaustyyli:
language-label = Kieli:
menu-custom-group-submenu =
    .label = Lisää asetuksia…
menu-file-show-in-finder =
    .label = Näytä Finderissa
menu-file-show-file =
    .label = Näytä tiedosto
menu-file-show-files =
    .label = Näytä tiedostot
menu-print =
    .label = { general-print }
menu-density =
    .label = Tiheys
add-attachment = Lisää liite
new-note = Uusi muistiinpano
menu-add-by-identifier =
    .label = Uusi nimike tunnisteen perusteella...
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Lisää tiedosto...
menu-add-standalone-linked-file-attachment =
    .label = Lisää linkki tiedostoon...
menu-add-child-file-attachment =
    .label = Liitä tiedosto...
menu-add-child-linked-file-attachment =
    .label = Liitä linkki tiedostoon...
menu-add-child-linked-url-attachment =
    .label = Liitä verkkolinkki...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Uusi itsenäinen muistiinpano
menu-new-item-note =
    .label = Uusi muistiinpano nimikkeelle
menu-restoreToLibrary =
    .label = Palauta kirjastoon
menu-deletePermanently =
    .label = Poista pysyvästi…
menu-tools-plugins =
    .label = Lisäosat
menu-view-columns-move-left =
    .label = Siirrä sarake vasemmalle
menu-view-columns-move-right =
    .label = Siirrä sarake oikealle
menu-show-tabs-menu =
    .label = Näytä välilehtivalikko
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Kopioi huomautus
           *[other] Kopioi { $count } huomautusta
        }
main-window-command =
    .label = Kirjasto
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = Listaa kaikki välilehdet
filter-collections = Suodata kokoelmia
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Etsi välilehdistä
zotero-tabs-menu-close-button =
    .title = Sulje välilehti
zotero-toolbar-tabs-scroll-forwards =
    .title = Vieritä eteenpäin
zotero-toolbar-tabs-scroll-backwards =
    .title = Vieritä taaksepäin
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Nimeä kokoelma uudelleen
collections-menu-edit-saved-search =
    .label = Muokkaa tallennettua hakua
collections-menu-move-collection =
    .label = Siirrä kohteeseen
collections-menu-copy-collection =
    .label = Kopioi kohteeseen
item-creator-moveDown =
    .label = Siirrä alas
item-creator-moveToTop =
    .label = Siirrä ylimmäiseksi
item-creator-moveUp =
    .label = Siirrä ylös
item-menu-viewAttachment =
    .label =
        Open { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] tilannevedos
                   *[other] liite
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFää
                    [epub] EPUBia
                    [snapshot] tilannevedosta
                   *[other] liitettä
                }
        } { $openIn ->
            [tab] Uudella välilehdellä
            [window] Uudessa ikkunassa
           *[other] { "" }
        }
item-menu-add-file =
    .label = Tiedosto
item-menu-add-linked-file =
    .label = Linkitetty tiedosto
item-menu-add-url =
    .label = Verkko-osoite
item-menu-change-parent-item =
    .label = Vaihda tiedoston isäntänimikettä…
item-menu-relate-items =
    .label = Tee nimikkeistä toisiinsa liittyviä
view-online = Katso verkossa
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Tiedoston uusi nimi on nyt { $filename }
itembox-button-options =
    .tooltiptext = Avaa kontekstivalikko
itembox-button-merge =
    .aria-label = Valitse versio { $field }-kentälle
create-parent-intro = Syötä DOI, ISBN, PMID, arXiv ID tai ADS Bibcode tiedoston tunnistamiseksi:
reader-use-dark-mode-for-content =
    .label = Käytä tummaa tilaa sisällölle
update-updates-found-intro-minor = Päivitys { -app-name }lle on saatavilla:
update-updates-found-desc = On suositeltavaa asentaa tämä päivitys heti.
import-window =
    .title = Tuo
import-where-from = Mistä haluat tuoda?
import-online-intro-title = Johdanto
import-source-file =
    .label = Tiedosto (BibTeX, RIS, Zotero RDF, jne.)
import-source-folder =
    .label = Hakemisto, jossa on PDF:iä tai muita tiedostoja
import-source-online =
    .label = { $targetApp } tuonti verkosta
import-options = Asetukset
import-importing = Tuodaan...
import-create-collection =
    .label = Sijoita tuodut kokoelmat ja nimikkeet uuteen kokoelmaan.
import-recreate-structure =
    .label = Luo hakemistorakenne uudestaan kokoelmina
import-fileTypes-header = Tuotavat tiedostotyypit:
import-fileTypes-pdf =
    .label = PDF:t
import-fileTypes-other =
    .placeholder = Muut tiedostot hakulauseen perusteella, pilkulla erotettuna (esimerkiksi: *.jpg,*.png)
import-file-handling = Tiedostojen käsittely
import-file-handling-store =
    .label = Kopioi tiedostot { -app-name }n varastokansioon
import-file-handling-link =
    .label = Linkitä tiedostoihin alkuperäisessä sijainnissa
import-fileHandling-description = { -app-name } ei pysty synkronoimaan linkitettyjä tiedostoja.
import-online-new =
    .label = Lataa vain uudet kohteet; älä päivitä aikaisemmin tuotuja kohteita
import-mendeley-username = Käyttäjätunnus
import-mendeley-password = Salasana
general-error = Virhe
file-interface-import-error = Tapahtui virhe yrittäessä tuoda valittua tiedostoa. Varmista, että tiedosto on kunnossa, ja yritä uudelleen.
file-interface-import-complete = Tuonti valmis
file-interface-items-were-imported =
    { $numItems ->
        [0] Yhtään nimekettä ei tuotu
        [one] Yksi nimike tuotiin
       *[other] { $numItems } nimikettä tuotiin
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Yhtään nimikettä ei uudelleenlinkitetty
        [one] Yksi nimike uudelleenlinkitettiin
       *[other] { $numRelinked } nimikettä uudelleenlinkitettiin
    }
import-mendeley-encrypted = Valittua Mendeley-tietokantaa ei voitu lukea, todennäköisin syy on, että se on salattu. Katso lisätietoa ohjeesta <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> .
file-interface-import-error-translator = Tapahtui virhe tuotaessa tiedostoa “{ $translator }”lla. Varmista että tiedosto on kelvollinen ja yritä uudelleen.
import-online-intro = Seuraavassa vaiheessa sinua pyydetään kirjautumaan sisään sovellukseen { $targetAppOnline } ja antamaan { -app-name }lle pääsyoikeudet. Tämä on välttämätöntä, jotta { $targetApp }n kirjasto voidaan tuoda { -app-name }-sovellukseen.
import-online-intro2 = { -app-name } ei koskaan näe eikä tallenna { $targetApp } salasanaasi.
import-online-form-intro = Syötä kirjautumistiedot sovellusta { $targetAppOnline } varten. Tämä on välttämätöntä jotta kirjastosi kohteessa { $targetApp } voidaan tuoda ohjelmaan { -app-name }.
import-online-wrong-credentials = Kirjautuminen sovellukseen { $targetApp } epäonnistui. Anna tunnistautumistiedot ja yritä uudelleen.
import-online-blocked-by-plugin = Tuontia ei voida jatkaa kun { $plugin } on asennettu. Kytke tämä lisäosa pois päältä ja yritä uudelleen.
import-online-relink-only =
    .label = Linkitä uudelleen Mendeley Desktopin viittaukset
import-online-relink-kb = Lisätietoja
import-online-connection-error = { -app-name } ei saanut yhteyttä sovellukseen { $targetApp }. Tarkista internet-yhteytesi ja yritä uudelleen.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } muistiinpano
           *[other] { $count } muistiinpanoa
        }
report-error =
    .label = Raportoi virhe...
rtfScan-wizard =
    .title = RTF:n läpikäynti
rtfScan-introPage-description = { -app-name } voi automaattisesti poimia ja uudelleenmuotoilla viittaukset ja lisätä kirjallisuusluettelon RTF-tiedostoon. Tällä hetkellä ohjelma tukee seuraavia viittausmuotoja:
rtfScan-introPage-description2 = Valitse aluksi luettava RTF-tiedosto sekä kirjoitettava tiedosto:
rtfScan-input-file = Luettava tiedosto:
rtfScan-output-file = Kirjoitettava tiedosto:
rtfScan-no-file-selected = Tiedostoa ei ole valittu
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Valitse lähdetiedosto
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Kalitse kohdetiedosto
rtfScan-intro-page = Johdanto
rtfScan-scan-page = Etsitään viitteitä
rtfScan-scanPage-description = { -app-name } etsii asiakirjasta lähdeviitteitä. Malta vielä hetki.
rtfScan-citations-page = Varmenna siteeratut nimikkeet
rtfScan-citations-page-description = Käy läpi tunnistettujen viittausten lista ja varmista että { -app-name } on tunnistanut kohteet oikein. Kaikki kiinnittämättömät ja epäselvät sitaatit tulee selvittää ennen seuraavaan vaiheeseen etenemistä.
rtfScan-style-page = Asiakirjan muotoilu
rtfScan-format-page = Sitaattien muotoilu
rtfScan-format-page-description = { -app-name } käsitteleen ja muotoilee RTF-tiedostoasi. Malta vielä hetki.
rtfScan-complete-page = RTF-läpikäynti valmis
rtfScan-complete-page-description = Asiakirja on läpikäyty ja prosessoitu. Varmista vielä, että muotoilut ovat oikein.
rtfScan-action-find-match =
    .title = Valitse vastaava nimike
rtfScan-action-accept-match =
    .title = Hyväksy hakuosuma
runJS-title = Aja JavaScript
runJS-editor-label = Koodi:
runJS-run = Käynnistä
runJS-help = { general-help }
runJS-completed = suoritettu onnistuneesti
runJS-result =
    { $type ->
        [async] Paluuarvo:
       *[other] Tulos:
    }
runJS-run-async = Aja asynkronisena funktiona
bibliography-window =
    .title = { -app-name } - Luo viite/lähdeluettelo
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Näytä viitteet muodossa:
bibliography-advancedOptions-label = Lisäasetukset
bibliography-outputMode-label = Luettelotyyppi:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Viitettä
            [note] Muistiinpanoa
           *[other] Viitettä
        }
bibliography-outputMode-bibliography =
    .label = Kirjallisuusluettelo
bibliography-outputMethod-label = Vientitapa:
bibliography-outputMethod-saveAsRTF =
    .label = Tallenna RTF-muodossa
bibliography-outputMethod-saveAsHTML =
    .label = Tallenna HTML-muodossa
bibliography-outputMethod-copyToClipboard =
    .label = Kopioi leikepöydälle
bibliography-outputMethod-print =
    .label = Tulosta
bibliography-manageStyles-label = Hallitse tyylejä...
styleEditor-locatorType =
    .aria-label = Täsmenteen tyyppi
styleEditor-locatorInput = Täsmenteen syöttö
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Tyylieditori
styleEditor-preview =
    .aria-label = Esikatselu
publications-intro-page = Omat julkaisuni
publications-intro = Omat julkaisuni -kokoelmaan lisätyt nimikkeet näkyvät profiilisivullasi zotero.org:ssa. Jos päätät sisällyttää liitetiedostot, ne julkaistaan sivulla määrittelemälläsi lisenssillä. Lisää vain julkaisuja jotka olet itse tehnyt ja sisällytä vain tiedostot, joiden levittämiseen sinulla on oikeudet ja joita haluat levittää.
publications-include-checkbox-files =
    .label = Sisällytä tiedostot
publications-include-checkbox-notes =
    .label = Sisällytä muistiinpanot
publications-include-adjust-at-any-time = Voin milloin tahansa valita, mitä Omat julkaisuni -kokoelmassa näytetään.
publications-intro-authorship =
    .label = Olen itse luonut tämän teoksen.
publications-intro-authorship-files =
    .label = Olen luonut tämän julkaisun ja minulla on oikeudet levittää siihen kuuluvia tiedostoja.
publications-sharing-page = Valitse, millä ehdoilla julkaisujasi saa jakaa
publications-sharing-keep-rights-field =
    .label = Säilytä olemassaoleva Oikeudet-kenttä
publications-sharing-keep-rights-field-where-available =
    .label = Säilytä olemassaoleva Oikeudet-kenttä jos mahdollista
publications-sharing-text = Voit pidättää kaikki oikeudet julkaisuihisi, jakaa ne Creative Commons -lisenssillä tai vapauttaa ne tekijänoikeudettomiksi (public domain). Kaikissa tapauksissa työsi on julkisesti saatavilla zotero.org:ssa.
publications-sharing-prompt = Saavatko muut levittää julkaisujasi edelleen?
publications-sharing-reserved =
    .label = Ei, näytä julkaisuni vain zotero.org:ssa.
publications-sharing-cc =
    .label = Kyllä, Creative Commons -lisenssillä
publications-sharing-cc0 =
    .label = Kyllä, ja jaa julkaisuni tekijänoikeudettomana eli public domainina
publications-license-page = Valitse Creative Commons -lisenssi
publications-choose-license-text = Creative Commons -lisenssi sallii julkaisujesi levittämisen määrittelemilläsi ehdoilla, edellyttäen että tekijä mainitaan asianmukaisesti, lisenssiin linkitetään ja kerrotaan, mikäli teosta on muutettu. Alla voit määritellä lisäehtoja.
publications-choose-license-adaptations-prompt = Saako työtäsi muunnella?
publications-choose-license-yes =
    .label = Kyllä
    .accesskey = Y
publications-choose-license-no =
    .label = Ei
    .accesskey = N
publications-choose-license-sharealike =
    .label = Kyllä, mikäli jaetaan samalla lisenssillä
    .accesskey = S
publications-choose-license-commercial-prompt = Sallitaanko julkaisusi kaupallinen käyttö?
publications-buttons-add-to-my-publications =
    .label = Lisää Omiin julkaisuihini
publications-buttons-next-sharing =
    .label = Seuraava: Jakaminen
publications-buttons-next-choose-license =
    .label = Valitse lisenssi
licenses-cc-0 = CC0 1.0 Yleismaailmallinen Public Domain -lisenssi
licenses-cc-by = Creative Commons Nimeä 4.0 -lisenssi
licenses-cc-by-nd = Creative Commons Nimeä-EiMuutoksia 4.0 -lisenssi
licenses-cc-by-sa = Creative Commons Nimeä-JaaSamoin 4.0 -lisenssi
licenses-cc-by-nc = Creative Commons Nimeä-EiKaupallinen 4.0 -lisenssi
licenses-cc-by-nc-nd = Creative Commons Nimeä-EiKaupallinen-EiMuutoksia 4.0 -lisenssi
licenses-cc-by-nc-sa = Creative Commons Nimeä-EiKaupallinen-JaaSamoin 4.0 -lisenssi
licenses-cc-more-info = Lue ehdottomasti Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> ennen kuin sovellat CC-lisenssiä julkaisuusi. Huomaa, että lisenssin peruuttaminen on mahdotonta, vaikka haluaisit myöhemmin valita toisen lisenssin tai luopua julkaisun julkaisemisesta.
licenses-cc0-more-info = Lue ehdottomasti Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> ennen kuin sovellat CC0-lisenssiä julkaisuusi. Huomaa, että julkaisun vapauttaminen tekijänoikeudettomaan tilaan (public domain) on peruuttamaton toimenpide, vaikka haluaisit myöhemmin valita toisen lisenssin tai luopua julkaisun julkaisemisesta.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Käynnistä uudelleen virheenjäljitystilassa...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } käynnistyy uudelleen ilman lisäosia. Kaikki ominaisuudet eivät välttämättä toimi virheenjäljitystilassa.
menu-ui-density =
    .label = Tiheys
menu-ui-density-comfortable =
    .label = Väljempi
menu-ui-density-compact =
    .label = Tiivis
pane-item-details = Nimikkeen tiedot
pane-info = Tiedot
pane-abstract = Tiivistelmä
pane-attachments = Liitteet
pane-notes = Muistiinpanot
pane-libraries-collections = Kirjastot ja kokoelmat
pane-tags = Avainsanat
pane-related = Liittyvät
pane-attachment-info = Liitteen tiedot
pane-attachment-preview = Esikatselu
pane-attachment-annotations = Huomautukset
pane-header-attachment-associated =
    .label = Nimeä liitetty tiedosto uudelleen
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } Liite
           *[other] { $count } Liitteet
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } huomautus
           *[other] { $count } huomautusta
        }
section-attachments-move-to-trash-message = Haluatko varmasti siirtää nimikkeen “{ $title }” roskakoriin?
section-notes =
    .label =
        { $count ->
            [one] { $count } muistiinpano
           *[other] { $count } muistiinpanoa
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } asiasana
           *[other] { $count } asiasanaa
        }
section-related =
    .label = { $count } liittyvää
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Laajenna osa
    .label = Laajenna osio { $section }
section-button-collapse =
    .dynamic-tooltiptext = Kutista osa
    .label = Kutista osio { $section }
annotations-count =
    { $count ->
        [one] { $count } huomautus
       *[other] { $count } huomautusta
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
    .label = Siirrä osa ylöspäin
sidenav-reorder-down =
    .label = Siirrä osa alaspäin
sidenav-reorder-reset =
    .label = Nollaa osien järjestys
toggle-item-pane =
    .tooltiptext = Nimikeruutu päälle/pois
toggle-context-pane =
    .tooltiptext = Näytä kontekstiruutu
pin-section =
    .label = Kiinnitä osa
unpin-section =
    .label = Poista kiinnitys
collapse-other-sections =
    .label = Kutista muut osat
expand-all-sections =
    .label = Laajenna kaikki osat
abstract-field =
    .placeholder = Lisää tiivistelmä...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Suodata asiasanat
context-notes-search =
    .placeholder = Etsi muistiinpanoista
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Uusi kokoelma...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Uusi kokoelma
    .buttonlabelaccept = Luo kokoelma
new-collection-name = Nimi:
new-collection-create-in = Luo kohteeseen:
show-publications-menuitem =
    .label = Näytä Omat julkaisuni
attachment-info-title = Nimi
attachment-info-filename = Tiedostonimi
attachment-info-accessed = Viittaus noudettu
attachment-info-pages = Sivut
attachment-info-modified = Muokattu
attachment-info-index = Indeksoitu
attachment-info-convert-note =
    .label =
        Muuta tämä { $type ->
            [standalone] erilliseksi
            [child] nimikkeen
           *[unknown] uudeksi
        } muistiinpanoksi
    .tooltiptext = Muistiinpanojen lisäämistä liitteisiin ei enää tueta, mutta voit muokata tätä muistiinpanoa siirtämällä sen erilliseksi muistiinpanoksi.
attachment-preview-placeholder = Ei liitettä esikatseltavaksi
attachment-rename-from-parent =
    .tooltiptext = Uudelleennimeä tiedosto täsmäämään päänimikkeeseen
file-renaming-auto-rename-prompt-title = Uudelleennimeämisasetukset muutettu
file-renaming-auto-rename-prompt-body = Haluatko uudelleennimetä olemassaolevat tiedostot kirjastossasi täsmäämään uusiin asetuksiin?
file-renaming-auto-rename-prompt-yes = Esikatsele muutoksia…
file-renaming-auto-rename-prompt-no = Pidä olemassaolevat tiedostonnimet
rename-files-preview =
    .buttonlabelaccept = Nimeä tiedostot uudelleen
rename-files-preview-loading = Ladataan...
rename-files-preview-intro = { -app-name } will rename the following files in your library to match their parent items:
rename-files-preview-renaming = Uudelleennimeäminen…
rename-files-preview-no-files = Kaikki tiedostonimet täsmäävät jo nimikkeisiinsä. Muutoksia ei tarvittu.
toggle-preview =
    .label =
        { $type ->
            [open] Piilota
            [collapsed] Näytä
           *[unknown] Vaihda
        } Liitteen esikatselu
annotation-image-not-available = [Kuva ei saatavilla]
quicksearch-mode =
    .aria-label = Pikahakutila
quicksearch-input =
    .aria-label = Pikahaku
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Näytä muodossa
item-pane-header-none =
    .label = Ei mitään
item-pane-header-title =
    .label = Nimi
item-pane-header-titleCreatorYear =
    .label = Otsikko, kirjoittaja, vuosi
item-pane-header-bibEntry =
    .label = Kirjallisuusluettelon rivi
item-pane-header-more-options =
    .label = Lisää vaihtoehtoja
item-pane-message-items-selected =
    { $count ->
        [0] Ei valittuja nimikkeitä
        [one] { $count } nimike valittu
       *[other] { $count } nimikettä valittu
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } kokoelma valittu
       *[other] { $count } kokoelmaa valittu
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } haku valittu
       *[other] { $count } hakua valittu
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } kohde valittu
       *[other] { $count } kohdetta valittu
    }
item-pane-message-unselected =
    { $count ->
        [0] Ei nimikkeitä tässä näkymässä
        [one] { $count } nimike tässä näkymässä
       *[other] { $count } nimikettä tässä näkymässä
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] Ei kohteita tässä näkymässä
        [one] { $count } kohde tässä näkymässä
       *[other] { $count } kohdetta tässä näkymässä
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Yhdistä { $count } kohde
           *[other] Yhdistä { $count } kohdetta
        }
locate-library-lookup-no-resolver = Sinun täytyy valita hakutyökalu { -app-name }n asetusten { $pane }-ruudusta.
architecture-win32-warning-message = Vaihda 64-bittiseen { -app-name }on niin saat parhaan suorituskyvyn. Datasi säilyy ennallaan.
architecture-warning-action = Lataa 64-bittinen { -app-name }
architecture-x64-on-arm64-message = { -app-name }a ajetaan emulaattoritilassa. Natiiviversio { -app-name }sta toimii paljon tehokkaammin.
architecture-x64-on-arm64-action = Lataa { -app-name } ARM64-prosessorille
first-run-guidance-authorMenu = { -app-name } antaa sinun määritellä myös toimittajat ja kääntäjät. Voit tehdä kirjoittajasta toimittajan tai kääntäjän tästä valikosta.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Hakuehto
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operaattori
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Arvo
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] { $count } tiedosto lisätty
       *[other] { $count } tiedostoa lisätty
    }
select-items-window =
    .title = Valitse nimikkeet
select-items-dialog =
    .buttonlabelaccept = Valitse
select-items-convertToStandalone =
    .label = Muuta erilliseksi
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Muuta itsenäiseksi liitteeksi
           *[other] Muuta itsenäisiksi liitteiksi
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Muuta erilliseksi muistiinpanoksi
           *[other] Muuta erillisiksi muistiinpanoiksi
        }
file-type-webpage = Verkkosivu
file-type-image = Kuva
file-type-pdf = PDF
file-type-audio = Ääni
file-type-video = Video
file-type-presentation = Esitelmä
file-type-document = Asiakirja
file-type-ebook = E-kirja
post-upgrade-message = Lue <a data-l10n-name="new-features-link">uusista ominaisuuksista { -app-name }n versiossa { $version }</a>
post-upgrade-density = Valitse haluamasi ulkoasun tiheys:
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Liitä ja etsi
mac-word-plugin-install-message = Zotero vaatii pääsyn Wordin tietoihin jotta lisäosa voidaan asentaa
mac-word-plugin-install-action-button =
    .label = Asenna Word-lisäosa
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
    .title = Jaa avainsanat
long-tag-fixer-button-dont-split =
    .label = Älä jaa
