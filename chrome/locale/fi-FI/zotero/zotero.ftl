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
-os-name =
    { PLATFORM() ->
        [macos] macOS
        [windows] Windows
       *[other] Linux
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
general-got-it = Selvä
general-done = Valmis
general-view-troubleshooting-instructions = Katso vianhakuohjeet
general-go-back = Siirry takaisinpäin
general-accept = Hyväksy
general-cancel = Peruuta
cancel-button =
    .label = { general-cancel }
general-show-in-library = Näytä kirjastossa
general-restartApp = Uudelleenkäynnistä { -app-name }
general-restartInTroubleshootingMode = Käynnistä uudelleen virheenjäljitystilassa
general-save = Tallenna
general-clear = Tyhjennä
clear-button =
    .label = { general-clear }
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
general-more-information = Lisätietoja
general-warning = Varoitus
general-type-to-continue = Kirjoita “{ $text }” jatkaaksesi.
general-continue = Jatka
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
general-loading = Ladataan...
db-checking-integrity = Checking database integrity…
db-repairing = Repairing database…
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
menu-view-hide-context-annotation-rows =
    .label = Piilota ei-täsmäävät huomautukset
menu-view-note-font-size =
    .label = Muistiinpanojen fonttikoko
menu-view-note-tab-font-size =
    .label = Muistilapun kirjasinkoko
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
recently-read = Viimeaikoina luetut
collections-menu-show-recently-read =
    .label = Näytä { recently-read }
item-menu-remove-from-recently-read =
    .label = Poista listalta { recently-read }…
items-section-collections-selected =
    { $count ->
        [one] { $count } kokoelma valittu
       *[other] { $count } kokoelmaa valittu
    }
items-section-searches-selected =
    { $count ->
        [one] { $count } saved search selected
       *[other] { $count } saved searches selected
    }
items-section-sources-selected =
    { $count ->
        [one] { $count } source selected
       *[other] { $count } sources selected
    }
items-section-library-collections =
    { $count ->
        [one] { $library } ({ $count } collection selected)
       *[other] { $library } ({ $count } collections selected)
    }
items-section-library-searches =
    { $count ->
        [one] { $library } ({ $count } saved search selected)
       *[other] { $library } ({ $count } saved searches selected)
    }
items-section-library-sources =
    { $count ->
        [one] { $library } ({ $count } source selected)
       *[other] { $library } ({ $count } sources selected)
    }
items-section-library-recently-read = { $library } ({ recently-read })
items-section-library = { $library }
collections-menu-rename =
    .label = Rename
edit-saved-search = Muokkaa tallennettua hakua
collections-menu-edit-search =
    .label = Edit Search
collections-menu-duplicate-search =
    .label = Duplicate Search
collections-menu-move-collection =
    .label = Siirrä kohteeseen
collections-menu-copy-collection =
    .label = Kopioi kohteeseen
collections-menu-export =
    .label = Vie...
collections-menu-generate-report =
    .label = Generate Report…
collections-menu-create-bibliography =
    .label = Create Bibliography…
collections-menu-unsubscribe =
    .label = Unsubscribe…
collections-menu-delete =
    .label =
        { $count ->
            [one] Delete Collection…
           *[other] Delete Collections…
        }
collections-menu-delete-with-items =
    .label =
        { $count ->
            [one] Delete Collection and Items…
           *[other] Delete Collections and Items…
        }
collections-menu-delete-search =
    .label =
        { $count ->
            [one] Delete Search…
           *[other] Delete Searches…
        }
collections-delete-title =
    { $count ->
        [one] Delete Collection
       *[other] Delete Collections
    }
collections-delete-message =
    { $count ->
        [one] Are you sure you want to delete this collection?
       *[other] Are you sure you want to delete { $count } collections?
    }
collections-delete-keep-items =
    { $count ->
        [one] Items within this collection will not be deleted.
       *[other] Items within these collections will not be deleted.
    }
collections-delete-with-items-title =
    { $count ->
        [one] Delete Collection and Items
       *[other] Delete Collections and Items
    }
collections-delete-with-items-message =
    { $count ->
        [one] Are you sure you want to delete this collection and move all items within it to the Trash?
       *[other] Are you sure you want to delete { $count } collections and move all items within them to the Trash?
    }
collections-delete-search-title =
    { $count ->
        [one] Delete Search
       *[other] Delete Searches
    }
collections-delete-search-message =
    { $count ->
        [one] Are you sure you want to delete this search?
       *[other] Are you sure you want to delete { $count } searches?
    }
item-creator-moveDown =
    .label = Siirrä alas
item-creator-moveToTop =
    .label = Siirrä ylimmäiseksi
item-creator-moveUp =
    .label = Siirrä ylös
item-menu-viewAttachment =
    .label =
        Avaa { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Snapshot
                    [note] Muistiinpano
                   *[other] Liite
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBit
                    [snapshot] Snapshotit
                    [note] Muistiinpanot
                   *[other] Liitteet
                }
        } { $openIn ->
            [tab] Uudessa välilehdessä
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
import-online-relink-kb = { general-more-information }
import-online-connection-error = { -app-name } ei saanut yhteyttä sovellukseen { $targetApp }. Tarkista internet-yhteytesi ja yritä uudelleen.
tab-title-multiple-collections = Multiple
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } muistiinpano
           *[other] { $count } muistiinpanoa
        }
items-column-added-by = Lisännyt
items-column-modified-by = Muokannut
items-column-last-read = Viimeksi luettu
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
pane-note-info = Muistiinpanon tiedot
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
section-note-info =
    .label = { pane-note-info }
note-info-title = Nimi
note-info-parent-item = Ylänimike
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] None
    }
    .title =
        { $hasParentItem ->
            [true] Näytä ylänimike kirjastossa
           *[false] Näytä muistiinpano kirjastossa
        }
note-info-date-created = Luotu
note-info-date-modified = Muokattu
note-info-size = Koko
note-info-word-count = Sanamäärä
note-info-character-count = Merkkimäärä
item-title-empty-note = Otsikoimaton muistiinpano
attachment-preview-placeholder = Ei liitettä esikatseltavaksi
attachment-rename-from-parent =
    .tooltiptext = Uudelleennimeä tiedosto täsmäämään päänimikkeeseen
account-log-in = Kirjaudu sisään
account-not-logged-in-text = Kirjaudu Zotero-tilillesi synkronoidaksesi tietosi.
account-error-login-session-expired = Sisäänkirjautumisesi on vanhentunut. Yritä uudestaan.
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
advanced-search = Tarkennettu haku
menuitem-advanced-search =
    .label = { advanced-search }
quicksearch-advanced-search-button =
    .tooltiptext = { advanced-search }
    .aria-label = { advanced-search }
advanced-search-close =
    .tooltiptext = Close Advanced Search
advanced-search-expand =
    .tooltiptext = Expand Advanced Search
advanced-search-collapse =
    .tooltiptext = Collapse Advanced Search
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
first-run-guidance-readAloud = { -app-name } osaa nyt lukea asiakirjasi ääneen luonnolliselta kuulostavalla äänellä.
advanced-search-remove-btn =
    .tooltiptext = Remove Condition
advanced-search-add-btn =
    .tooltiptext = Add Condition
advanced-search-group-btn =
    .tooltiptext = Add Condition Group
advanced-search-remove-group-btn =
    .tooltiptext = Remove Group
advanced-search-ungroup-btn =
    .tooltiptext = Ungroup Conditions
advanced-search-result-level-menu =
    .aria-label = Result type
advanced-search-result-level-prefix-root =
    .value = Etsi
advanced-search-join-prefix-root =
    .value = matching
advanced-search-result-level-any =
    .label = any items
advanced-search-result-level-item =
    .label = top-level items
advanced-search-result-level-attachment =
    .label = attachments
advanced-search-result-level-note =
    .label = notes
advanced-search-result-level-annotation =
    .label = huomautukset
advanced-search-binding-menu =
    .aria-label = Match against the same item
advanced-search-binding-separate =
    .label = separately
advanced-search-binding-same-attachment =
    .label = in the same attachment
advanced-search-binding-same-note =
    .label = in the same note
advanced-search-binding-same-annotation =
    .label = in the same annotation
advanced-search-of-the-following =
    .value = of the following
advanced-search-binding-hint-attachment =
    .value = These conditions can match separate attachments.
advanced-search-binding-hint-note =
    .value = These conditions can match separate notes.
advanced-search-binding-hint-annotation =
    .value = These conditions can match separate annotations.
advanced-search-level-warning-mixed = These conditions cannot all match the same item, so this search will never return results. Try matching “{ $matchAny }” of them, or set the result type to “{ $topLevelItems }”.
advanced-search-level-warning-unreachable = This search has a condition that cannot apply to the chosen result type. Set the result type to “{ $topLevelItems }” or remove the incompatible condition.
advanced-search-group-warning-unreachable =
    A condition here cannot be in the same { $entity ->
        [attachment] attachment
        [note] note
       *[annotation] annotation
    }. Match these separately or remove the incompatible condition.
advanced-search-group-warning-mixed = These conditions cannot all match the same item, so this group will never match. Try matching “{ $matchAny }” of them, or set the result type to “{ $topLevelItems }”.
advanced-search-bind-same-attachment =
    .label = Match the same attachment
advanced-search-bind-same-note =
    .label = Match the same note
advanced-search-bind-same-annotation =
    .label = Match the same annotation
advanced-search-conditions-menu =
    .aria-label = Hakuehto
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operaattori
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Arvo
    .label = { $label }
search-operator-isEmpty = is empty
search-operator-isNotEmpty = is not empty
search-conditions-tooltip-fields = Kentät:
search-conditions-collection = Kokoelma
search-conditions-savedSearch = Tallennettu haku
search-conditions-itemTypeID = Nimikkeen tyyppi
search-conditions-tag = Merkki
search-conditions-numTags = # of Tags
search-conditions-numNotes = # of Notes
search-conditions-numAttachments = # of Attachments
search-conditions-numAnnotations = # of Annotations
search-conditions-note = Muistiinpano
search-conditions-childNote = Alimuistiinpano
search-conditions-creator = Tekijä
search-conditions-thesisType = Opinnäytteen tyyppi
search-conditions-reportType = Raportin tyyppi
search-conditions-videoRecordingFormat = Videon nauhoitusmuoto
search-conditions-audioFileType = Äänitiedoston tyyppi
search-conditions-audioRecordingFormat = Nauhoitusformaatti
search-conditions-letterType = Kirjeen tyyppi
search-conditions-interviewMedium = Haastatteluväline
search-conditions-manuscriptType = Käsikirjoituksen tyyppi
search-conditions-presentationType = Esitelmän tyyppi
search-conditions-mapType = Kartan tyyppi
search-conditions-artworkMedium = Taideteoksen medium
search-conditions-dateModified = Muokattu
search-conditions-fulltextContent = Liitteen sisältö
search-conditions-programmingLanguage = Ohjelmointikieli
search-conditions-fileTypeID = Liitetiedoston tyyppi
search-conditions-attachmentStorageType = Attachment Storage Type
search-conditions-lastRead = Viimeksi luettu liite
search-conditions-annotationText = Huomautusteksti
search-conditions-annotationComment = Huomautuskommentti
search-conditions-annotationType = Annotation Type
search-conditions-annotationColor = Annotation Color
search-conditions-annotationAuthor = Annotation Author
search-conditions-anyField = Mikä tahansa kenttä
search-conditions-titleCreatorYear = Otsikko, kirjoittaja, vuosi
search-conditions-submenu-attachment = Liite
search-conditions-submenu-annotation = Huomautus
search-conditions-short-fulltextContent = Content
search-conditions-short-fileTypeID = Tiedostomuoto
search-conditions-short-attachmentStorageType = Storage Type
search-conditions-short-lastRead = Viimeksi luettu
search-conditions-short-annotationText = Text
search-conditions-short-annotationComment = Comment
search-conditions-short-annotationType = Tyyppi
search-conditions-short-annotationColor = Color
search-conditions-short-annotationAuthor = Tekijä
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
attachment-storage-type-storedFile = Stored File
attachment-storage-type-linkedFile = Linked File
attachment-storage-type-webLink = Web Link
post-upgrade-message = Olet päivittänyt versioon <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Tutustu <a data-l10n-name="new-features-link">uusiin ominaisuuksiin </a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Liitä ja etsi
mac-word-plugin-install-message = Zotero vaatii pääsyn Wordin tietoihin jotta lisäosa voidaan asentaa
mac-word-plugin-install-folder-message = { -app-name } needs access to Word’s startup folder to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = Asenna Word-lisäosa
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Install the plugin in the Word startup folder
mac-word-plugin-install-folder-dialog-button = Asenna
mac-word-plugin-install-wrong-folder-selected = The suggested folder must be selected. Please try again without choosing a different folder.
file-renaming-banner-message = { -app-name } pitää nyt automaattisesti tiedostonnimet ajan tasalla kun teet muutoksia nimikkeisiin.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = { -app-name } Connector jotta se toimii tämän { -app-name }n version kanssa.
userjs-pref-warning = Jotkus { -app-name }n asetukset on ohitettu käyttämällä ei-tuettua menetelmää. { -app-name } palauttaa ne ja käynnistyy uudelleen.
migrate-extra-fields-progress-message = Uusien kenttien tuominen Ylim. -kentästä
search-normalization-progress-message = Indexing items for search
long-tag-fixer-window-title =
    .title = Jaa avainsanat
long-tag-fixer-button-dont-split =
    .label = Älä jaa
menu-normalize-attachment-titles =
    .label = Normalisoi liitteiden otsikot...
normalize-attachment-titles-title = Normalisoi liitteiden otsikot
normalize-attachment-titles-text =
    { -app-name } uudelleennimeää automaattisesti tiedostot levyllä nimikkeen metatietojen mukaan käyttämällä yksinkertaisia otsikoita kuten “Full Text PDF”, “Preprint PDF”, tai “PDF” pääliitteille, jotta liiteluettelo pysyy siistinä.
    
    Aikaisemmissa { -app-name }n versioissa, kuten myös tiettyjä liitännäisiä käytettäessä, liitetiedostojen otsikot saattoivat tarpeettomasti muuttua täsmäämään tiedostonimiin.
    
    Haluatko päivittää valitut liitteet käyttämään yksinkertaisempia otsikoita? Vain ensisijaiset liitteet, joiden nimet vastaavat tiedostonimeä, muutetaan.
banner-close-button =
    .aria-label = Hylkää ilmoitus
plugins-blocked-plugin =
    .message = { -app-name } on kytkenyt tämän lisäosan pois päältä.
data-dir-unsupported-storage = This can happen if the { -app-name } data directory is in a cloud storage folder (OneDrive, Dropbox, etc.) or on a network share.
login-manager-reset = { -app-name } was unable to read your saved login information, so it has been reset. Please log in again in the { preferences-pane-account } pane of the { -app-name } settings.
os-keystore-save-failed =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t access the { -os-name } Keychain to securely save your credentials. Make sure your Keychain is accessible and try again.
        [windows] { -app-name } couldn’t securely save your credentials. Try again or restart { -app-name }.
       *[other] { -app-name } couldn’t access your { -os-name } keyring to securely save your credentials. Make sure a keyring service is running and try again.
    }
os-keystore-migrate-failed =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t access the { -os-name } Keychain to encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Make sure your Keychain is accessible and restart { -app-name }.
        [windows] { -app-name } couldn’t encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Restart { -app-name } and try again.
       *[other] { -app-name } couldn’t access your { -os-name } keyring to encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Make sure a keyring service is running and restart { -app-name }.
    }
search-button =
    .label = Haku
save-search-new-button =
    .label = Save Search…
save-search-edit-button =
    .label = Tallenna
save-search-name-title = Tallenna haku
save-search-name-message = Enter a name for the saved search:
saved-search-close-confirmation-title = Editing Saved Search
saved-search-close-confirmation-body = Do you want to save changes you made to this saved search?
item-pane-batch-editing-prompt =
    .aria-label = Batch editing
item-pane-batch-editing-enable =
    .label = Edit Multiple Items…
item-pane-batch-editing-multiple-values-placeholder = Multiple
item-pane-batch-editing-clear-values = Clear all values
item-pane-batch-editing-header =
    { $count ->
        [one] Editing { $count } item
       *[other] Editing { $count } items
    }
item-pane-batch-editing-done =
    .label = { general-done }
undo-action-edit-metadata =
    { $count ->
        [one] Edit Metadata
       *[other] Edit Metadata for { $count } Items
    }
undo-action-edit-field =
    { $count ->
        [one] Edit of “{ $field }”
       *[other] Edit of “{ $field }” for { $count } Items
    }
undo-action-normalize-attachment-titles = Normalize Attachment Title
undo-action-trash =
    { $count ->
        [one] Trash Item
       *[other] Trash { $count } Items
    }
undo-action-restore-items =
    { $count ->
        [one] Restore Item
       *[other] Restore { $count } Items
    }
undo-action-trash-collection =
    { $count ->
        [one] Trash Collection
       *[other] Trash { $count } Collections
    }
undo-action-trash-search =
    { $count ->
        [one] Trash Saved Search
       *[other] Trash { $count } Saved Searches
    }
undo-action-restore-collection =
    { $count ->
        [one] Restore Collection
       *[other] Restore { $count } Collections
    }
undo-action-restore-objects =
    { $count ->
        [one] Restore Object
       *[other] Restore { $count } Objects
    }
undo-action-add-to-collection =
    { $count ->
        [one] Add to Collection
       *[other] Add { $count } Items to Collection
    }
undo-action-remove-from-collection =
    { $count ->
        [one] Remove from Collection
       *[other] Remove { $count } Items from Collection
    }
undo-action-move-to-collection =
    { $count ->
        [one] Move to Collection
       *[other] Move { $count } Items to Collection
    }
undo-action-rename-collection = Nimeä kokoelma uudelleen
undo-action-move-collection = Move Collection
undo-action-add-tag =
    { $count ->
        [one] Add Tag
       *[other] Add Tag to { $count } Items
    }
undo-action-change-tag = Change Tag
undo-action-split-tag = Split Tag
undo-action-remove-tag =
    { $count ->
        [one] Remove Tag
       *[other] Remove Tag from { $count } Items
    }
undo-action-remove-tags-from-item =
    { $count ->
        [one] Remove Tag
       *[other] Remove { $count } Tags
    }
undo-action-remove-all-tags = Remove All Tags
undo-action-edit-note = Muokkaa muistiinpanoa
undo-action-add-creator = Add Creator
undo-action-remove-creator = Remove Creator
undo-action-edit-creator = Edit Creator
undo-action-reorder-creator = Reorder Creator
undo-action-change-type = Vaihda kohteen tyyppi
undo-action-change-parent-item =
    { $count ->
        [one] Change Parent Item
       *[other] Change Parent for { $count } Items
    }
undo-action-convert-to-standalone =
    { $count ->
        [one] Convert to Standalone
       *[other] Convert { $count } Items to Standalone
    }
undo-action-add-related = Add Related
undo-action-remove-related = Remove Related
undo-action-merge-items =
    { $count ->
        [one] Merge Item
       *[other] Merge { $count } Items
    }
menu-edit-undo-action = Undo { $action }
menu-edit-redo-action = Redo { $action }
