general-print = Tulosta
return-or-enter =
    { PLATFORM() ->
        [macos] Palauta
       *[other] Syötä
    }
general-remove = Poista
general-add = Lisää
general-remind-me-later = Muistuta myöhemmin
general-choose-file = Valitse tiedosto...
general-open-settings = Avaa asetukset
general-help = Ohje
general-tag = Tag
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
main-window-command =
    .label = { -app-name }
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
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Nimeä kokoelma uudelleen
collections-menu-edit-saved-search =
    .label = Muokkaa tallennettua hakua
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
rtfScan-introPage-description = { -app-name } osaa automaattisesti tunnistaa ja uudelleenmuotoilla viittaukset ja lisätä kirjallisuusluettelon RTF-tiedostoon. Aloittaaksesi, valitse RTF-tiedosto alta.
rtfScan-introPage-description2 = Valitse aluksi luettava RTF-tiedosto sekä kirjoitettava tiedosto:
rtfScan-input-file = Luettava tiedosto
rtfScan-output-file = Kirjoitettava tiedosto
rtfScan-no-file-selected = Tiedostoa ei ole valittu
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Valitse lähdetiedosto
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Kalitse kohdetiedosto
rtfScan-intro-page =
    .label = Johdanto
rtfScan-scan-page =
    .label = Etsitään viitteitä
rtfScan-scanPage-description = { -app-name } etsii asiakirjasta lähdeviitteitä. Malta vielä hetki.
rtfScan-citations-page =
    .label = Varmenna siteeratut nimikkeet
rtfScan-citations-page-description = Käy läpi tunnistettujen viittausten lista ja varmista että { -app-name } on tunnistanut kohteet oikein. Kaikki kiinnittämättömät ja epäselvät sitaatit tulee selvittää ennen seuraavaan vaiheeseen etenemistä.
rtfScan-style-page =
    .label = Asiakirjan muotoilu
rtfScan-format-page =
    .label = Sitaattien muotoilu
rtfScan-format-page-description = { -app-name } käsitteleen ja muotoilee RTF-tiedostoasi. Malta vielä hetki.
rtfScan-complete-page =
    .label = RTF-läpikäynti valmis
rtfScan-complete-page-description = Asiakirja on läpikäyty ja prosessoitu. Varmista vielä, että muotoilut ovat oikein.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Aja JavaScript
runJS-editor-label = Koodi:
runJS-run = Käynnistä
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Paluuarvo:
       *[other] Tulos:
    }
runJS-run-async = Aja asynkronisena funktiona
bibliography-window =
    .title = { -app-name } - Luo viite/lähdeluettelo
bibliography-style-label = Viittaustyyli:
bibliography-locale-label = Kieli:
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
integration-docPrefs-window =
    .title = { -app-name } - Asiakirjan ominaisuudet
integration-addEditCitation-window =
    .title = { -app-name } - Lisää viite tai muokkaa sitä
integration-editBibliography-window =
    .title = { -app-name } - Muokkaa lähdeluetteloa
integration-quickFormatDialog-window =
    .title = { -app-name } - Pikamuotoile viite
integration-prefs-displayAs-label = Näytä sitaatit muodossa:
integration-prefs-footnotes =
    .label = Alaviitteet
integration-prefs-endnotes =
    .label = Loppuviitteet
integration-prefs-bookmarks =
    .label = Tallenna viitteet kirjanmerkkeinä
integration-prefs-bookmarks-description = Kirjanmerkkejä voidaan jakaa Wordin ja LibreOfficen välillä, mutta se saattaa aiheuttaa ongelmia, mikäli niitä muutetaan vahingossa. Kirjanmerkkejä ei voi myöskään lisätä alaviitteisiin.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Asiakirja tulee tallentaa .doc tai .docx -muodossa.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Päivitä viitteet automaattisesti
    .tooltip = Viitteet, joilla on odottavia päivityksiä, korostetaan asiakirjassa
integration-prefs-automaticCitationUpdates-description = Päivittämisen poiskytkentä voi nopeuttaa viitteiden lisäämistä pitkissä asiakirjoissa. Päivitä asiakirjan viitteet käsin valitsemalla Päivitä.
integration-prefs-automaticJournalAbbeviations =
    .label = Käytä MEDLINEn lehtilyhenteitä
integration-prefs-automaticJournalAbbeviations-description = Lehden lyhenne -kenttää ei huomioida.
integration-prefs-exportDocument =
    .label = Vaihda eri tekstinkäsittelyohjelmaan…
publications-intro-page =
    .label = Omat julkaisuni
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
publications-sharing-page =
    .label = Valitse, millä ehdoilla julkaisujasi saa jakaa
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
publications-license-page =
    .label = Valitse Creative Commons -lisenssi
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
restart-in-troubleshooting-mode-menuitem =
    .label = Käynnistä uudelleen virheenjäljitystilassa...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Käynnistä uudelleen virheenjäljitystilassa
restart-in-troubleshooting-mode-dialog-description = { -app-name } käynnistyy uudelleen ilman lisäosia. Kaikki ominaisuudet eivät välttämättä toimi virheenjäljitystilassa.
menu-ui-density =
    .label = Tiheys
menu-ui-density-comfortable =
    .label = Väljempi
menu-ui-density-compact =
    .label = Tiivis
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
new-collection-dialog =
    .title = Uusi kokoelma
    .buttonlabelaccept = Luo kokoelma
new-collection-name = Nimi:
new-collection-create-in = Luo kohteeseen:
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
toggle-preview =
    .label =
        { $type ->
            [open] Piilota
            [collapsed] Näytä
           *[unknown] Vaihda
        } Liitteen esikatselu
quickformat-general-instructions =
    Käytä vasenta ja oikeaa nuolta siirtyäksesi eri kenttien välillä.  { $dialogMenu ->
        [active] Paina shift-tab siirtyäksesi valikkoon
       *[other] { "" }
    } Paina { return-or-enter } tallentaaksesi muutokset viitteeseen. Paina Esc hylätäksesi muutokset ja sulkeaksesi valikon.
quickformat-aria-bubble = Tämä nimike on mukana viittauksessa. Paina välilyöntiä muokataksesi. { quickformat-general-instructions }
quickformat-aria-input = Kirjoita hakeaksesi kohdetta joka lisätään tähän viittaukseen. Paina tabia siirtyäksesi hakutuloksesta toiseen. { quickformat-general-instructions }
quickformat-aria-item = Paina { return-or-enter } lisätäksesi tämän nimikkeen viittaukseen. Paina tabia palataksesi hakukenttään.
quickformat-accept =
    .tooltiptext = Tallenna muokkaukset tähän viittaukseen
quickformat-locator-type =
    .aria-label = Täsmenteen tyyppi
quickformat-locator-value = Täsmenne
quickformat-citation-options =
    .tooltiptext = Näytä viittausasetukset
insert-note-aria-input = Kirjoita hakeaksesi muistiinpanoa. Paina tabia siirtyäksesi hakuosumasta toiseen. Esc sulkee valikon.
insert-note-aria-item = Paina { return-or-enter } valitaksesi tämän muistiinpanon. Paina tabia palataksesi hakukenttään. Esc sulkee valikon.
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
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Yhdistä { $count } kohde
           *[other] Yhdistä { $count } kohdetta
        }
locate-library-lookup-no-resolver = Sinun täytyy valita hakutyökalu { -app-name }n asetusten { $pane }-ruudusta.
architecture-win32-warning-message = { -app-name } on käynnissä 32-bittisessä tilassa 64-bitisessä Windowsissa. { -app-name } toimii paremmin 64-bittisessä tilassa.
architecture-warning-action = Lataa 64-bittinen { -app-name }
first-run-guidance-quickFormat =
    Hae lähdettä kirjoittamalla otsikko, tekijä tai vuosi.
    
    Kun olet tehnyt valintasi, klikkaa kuplaa tai valitse se näppäimistöllä ja paina ↓ tai välilyönti niin näet viittausvaihtoehdot kuten sivunumeron ja etu- tai jälkiliitteet.
    
    Voit lisätä sivunumeron myös suoraan syöttämällä sen hakutermeihin tai kirjoittamalla sen kuplan jälkeen ja painamalla { return-or-enter }.
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
