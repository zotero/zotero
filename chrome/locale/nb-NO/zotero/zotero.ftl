general-print = Skriv ut
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Fjern
general-add = Legg til
general-remind-me-later = Minn meg på det senere
general-choose-file = Velg fil…
general-open-settings = Åpne innstillinger
general-help = Hjelp
general-tag = Emneord
general-done = Ferdig
general-view-troubleshooting-instructions = Se instruksjoner for feilsøking
menu-file-show-in-finder =
    .label = Vis i Finder
menu-file-show-file =
    .label = Vis fil
menu-file-show-files =
    .label = Vis filer
menu-print =
    .label = { general-print }
menu-density =
    .label = Tetthet
add-attachment = Legg til vedlegg
new-note = Nytt notat
menu-add-by-identifier =
    .label = Legg til ved hjelp av identifikator…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Legg til fil…
menu-add-standalone-linked-file-attachment =
    .label = Legg til lenke til fil…
menu-add-child-file-attachment =
    .label = Legg ved fil…
menu-add-child-linked-file-attachment =
    .label = Legg ved lenke til fil…
menu-add-child-linked-url-attachment =
    .label = Legg ved nettlenke…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nytt enkeltstående notat
menu-new-item-note =
    .label = Legg til notat til element
menu-restoreToLibrary =
    .label = Gjenopprett til bibliotek
menu-deletePermanently =
    .label = Slett permanent…
menu-tools-plugins =
    .label = Tillegg
main-window-command =
    .label = { -app-name }
zotero-toolbar-tabs-menu =
    .tooltiptext = Vis alle fanene
filter-collections = Filtrer samlinger
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Søk faner
zotero-tabs-menu-close-button =
    .title = Lukk fane
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Gi samlingen nytt navn
collections-menu-edit-saved-search =
    .label = Rediger lagret søk
item-creator-moveDown =
    .label = Flytt ned
item-creator-moveToTop =
    .label = Flytt til toppen
item-creator-moveUp =
    .label = Flytt opp
item-menu-viewAttachment =
    .label =
        Åpne { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Øyeblikksbilde
                   *[other] Vedlegg
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDF-filer
                    [epub] EPUB-filer
                    [snapshot] Øyeblikksbilder
                   *[other] Vedlegg
                }
        } { $openIn ->
            [tab] i ny fane
            [window] i nytt vindu
           *[other] { "" }
        }
item-menu-add-file =
    .label = Fil
item-menu-add-linked-file =
    .label = Lenket fil
item-menu-add-url =
    .label = Nettlenke
view-online = Vis på nett
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Fil endret navn til { $filename }
itembox-button-options =
    .tooltiptext = Åpne kontekstmenyen
itembox-button-merge =
    .aria-label = Velg versjon av { $field } feltet
create-parent-intro = Skriv inn en DOI, ISBN, PMID, arXiv ID eller ADS Bibcode for å identifisere denne filen:
reader-use-dark-mode-for-content =
    .label = Bruk mørk modus for innhold
update-updates-found-intro-minor = En oppdatering for { -app-name } er tilgjengelig:
update-updates-found-desc = Det anbefales at du foretar denne oppdateringen så snart som mulig.
import-window =
    .title = Importer
import-where-from = Hvor ønsker du å importere fra?
import-online-intro-title = Introduksjon
import-source-file =
    .label = En fil (BibTeX, RIS, Zotero RDF, etc.)
import-source-folder =
    .label = En mappe med PDF-filer eller andre filer
import-source-online =
    .label = { $targetApp } online import
import-options = Valg
import-importing = Importerer…
import-create-collection =
    .label = Legg importerte samlinger og elementer i en ny samling
import-recreate-structure =
    .label = Gjenopprett mappestrukturen som samlinger
import-fileTypes-header = Filtyper som skal importeres:
import-fileTypes-pdf =
    .label = PDF-filer
import-fileTypes-other =
    .placeholder = Andre filer etter mønster, kommaseparert (f.eks. *.jpg,*.png)
import-file-handling = Filbehandling
import-file-handling-store =
    .label = Kopier filer til lagringsmappen { -app-name }.
import-file-handling-link =
    .label = Lenke til filer i opprinnelig plassering
import-fileHandling-description = Koblede filer kan ikke synkroniseres av { -app-name }.
import-online-new =
    .label = Last kun ned nye elementer, ikke oppdater allerede importerte elementer
import-mendeley-username = Brukernavn
import-mendeley-password = Passord
general-error = Feil
file-interface-import-error = En feil oppstod under importen av den valgte filen. Forsikre deg om at filen er gyldig og forsøk igjen.
file-interface-import-complete = Import ferdig
file-interface-items-were-imported =
    { $numItems ->
        [0] Ingen elementer ble importert
        [one] Ett element ble importert
       *[other] { $numItems } elementer ble importert
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Ingen elementer ble koblet sammen
        [one] Ett elementer ble koblet sammen
       *[other] { $numRelinked } elementer ble koblet sammen
    }
import-mendeley-encrypted = Den valgte Mendeley-databasen kan ikke leses, sannsynligvis fordi den er kryptert. Se  <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero? (Engelsk)</a> for mer informasjon.
file-interface-import-error-translator = Det oppstod en feil ved import av den valgte filen med "{ $translator }". Kontroller at filen er gyldig, og prøv på nytt.
import-online-intro = I neste trinn blir du bedt om å logge inn på { $targetAppOnline } og gi { -app-name } tilgang. Dette er nødvendig for å importere { $targetApp }-biblioteket ditt til { -app-name }.
import-online-intro2 = { -app-name } vil aldri se eller lagre passordet ditt { $targetApp }.
import-online-form-intro = Vennligst skriv inn påloggingsinformasjonen din for å logge på { $targetAppOnline }. Dette er nødvendig for å importere { $targetApp }-biblioteket ditt til { -app-name }.
import-online-wrong-credentials = Innlogging til { $targetApp } mislyktes. Vennligst skriv inn påloggingsinformasjonen på nytt og prøv igjen.
import-online-blocked-by-plugin = Importen kan ikke fortsette med { $plugin } installert. Deaktiver denne program-tillegget og prøv på nytt.
import-online-relink-only =
    .label = Koble sammen igjen Mendeley Desktop henvisninger
import-online-relink-kb = Mer informasjon
import-online-connection-error = { -app-name } kunne ikke koble til { $targetApp }. Kontroller Internett-tilkoblingen din og prøv igjen.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Notat
           *[other] { $count } Notater
        }
report-error =
    .label = Rapporter feil…
rtfScan-wizard =
    .title = RTF skann
rtfScan-introPage-description = { -app-name } kan automatisk trekke ut og omformatere henvisninger og sette inn en bibliografi i RTF-filer. Programmet støtter for øyeblikket henvisninger i varianter av følgende formater:
rtfScan-introPage-description2 = For å komme i gang, velg en RTF inndatafil og en utdatafil nedenfor:
rtfScan-input-file = Inndatafil:
rtfScan-output-file = Utdatafil:
rtfScan-no-file-selected = Ingen fil valgt
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Velg inndatafil
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Velg utdatafil
rtfScan-intro-page = Introduksjon
rtfScan-scan-page = Skanner etter henvisninger
rtfScan-scanPage-description = { -app-name } skanner dokumentet ditt for henvisninger. Vennligst vær tålmodig.
rtfScan-citations-page = Bekreft elementer henvist til
rtfScan-citations-page-description = Gå gjennom listen over gjenkjente henvisninger nedenfor for å sikre at { -app-name } har valgt de tilsvarende elementene riktig. Eventuelle ikke-tilordnede eller tvetydige henvisninger må korrigeres før du går videre til neste trinn.
rtfScan-style-page = Dokument formatering
rtfScan-format-page = Formaterer henvisninger
rtfScan-format-page-description = { -app-name } behandler og formaterer RTF-filen din. Vennligst vær tålmodig.
rtfScan-complete-page = RTF skann komplett
rtfScan-complete-page-description = Zotero har nå gått gjennom dokumentet ditt. Sjekk at det er korrekt formatert.
rtfScan-action-find-match =
    .title = Velg matchende element
rtfScan-action-accept-match =
    .title = Godta dette treffet
runJS-title = Kjør JavaScript
runJS-editor-label = Kode:
runJS-run = Kjør
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Returverdi:
       *[other] Resultat:
    }
runJS-run-async = Kjør som asynkron funksjon
bibliography-window =
    .title = { -app-name } - Opprett henvisning/bibliografi
bibliography-style-label = Henvisningsstil:
bibliography-locale-label = Språk:
bibliography-displayAs-label = Vis henvisninger som:
bibliography-advancedOptions-label = Avanserte valg
bibliography-outputMode-label = Utdata modus:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Henvisninger
            [note] Notater
           *[other] Henvisninger
        }
bibliography-outputMode-bibliography =
    .label = Bibliografi
bibliography-outputMethod-label = Utdata metode:
bibliography-outputMethod-saveAsRTF =
    .label = Lagre som RTF
bibliography-outputMethod-saveAsHTML =
    .label = Lagre som HTML
bibliography-outputMethod-copyToClipboard =
    .label = Kopier til utklippstavle
bibliography-outputMethod-print =
    .label = Skriv ut
bibliography-manageStyles-label = Behandle stiler…
integration-docPrefs-window =
    .title = { -app-name } - Innstillinger for dokument
integration-addEditCitation-window =
    .title = { -app-name } - Legg til/rediger henvisning
integration-editBibliography-window =
    .title = { -app-name } - Rediger bibliografi
integration-quickFormatDialog-window =
    .title = { -app-name } - Hurtigformater henvisning
integration-prefs-displayAs-label = Vis henvisninger som:
integration-prefs-footnotes =
    .label = Fotnoter
integration-prefs-endnotes =
    .label = Sluttnoter
integration-prefs-bookmarks =
    .label = Lagre henvisninger som bokmerker
integration-prefs-bookmarks-description = Bokmerker kan bli delt mellom Word og LibreOffice, men kan forårsake feil dersom de blir endret ved en tilfeldighet og kan ikke settes inn i fotnoter.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Dokumentet må lagres som .doc eller .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Automatisk oppdater henvisninger
    .tooltip = Henvisninger som venter på å bli oppdatert er markert i dokumentet
integration-prefs-automaticCitationUpdates-description = Ved å slå av oppdateringer kan du gjøre innsetting av henvisninger raskere i store dokumenter. Klikk på Oppdater for å oppdatere henvisninger manuelt.
integration-prefs-automaticJournalAbbeviations =
    .label = Bruk MEDLINE forkortelser for tidsskrift
integration-prefs-automaticJournalAbbeviations-description = Feltet "Tidsskriftsforkortelse" vil bli ignorert.
integration-prefs-exportDocument =
    .label = Bytt til en annen tekstbehandler…
integration-error-unable-to-find-winword = { -app-name } kunne ikke finne en Word-versjon som kjører.
publications-intro-page = Mine publikasjoner
publications-intro = Elementer du legger til Mine publikasjoner vil bli vist på din profilside på zotero.org. Hvis du velger å inkludere vedlegg vil de bli gjort offentlig tilgjengelig under lisensen du angir. Legg kun til arbeid du selv har opprettet og inkluder vedlegg kun dersom du har rettighetene til å distribuere de og ønsker å gjøre det.
publications-include-checkbox-files =
    .label = Inkluder filer
publications-include-checkbox-notes =
    .label = Inkluder notater
publications-include-adjust-at-any-time = Du kan tilpasse hva som skal vises fra Mine publikasjoner samlingen når som helst.
publications-intro-authorship =
    .label = Jeg opprettet dette arbeidet.
publications-intro-authorship-files =
    .label = Jeg opprettet dette arbeidet og har rettighetene til å distribuere inkluderte filer.
publications-sharing-page = Velg hvordan ditt arbeid kan bli delt
publications-sharing-keep-rights-field =
    .label = Behold det eksisterende rettighetsfeltet
publications-sharing-keep-rights-field-where-available =
    .label = Behold det eksisterende rettighetsfeltet der det er tilgjengelig
publications-sharing-text = Du kan forbeholde deg alle rettigheter til ditt arbeid, lisensere det under en Creative Commons lisens, eller gjøre det offentlig tilgjengelig. I alle tilfeller, arbeidet vil bli gjort tilgjengelig via zotero.org.
publications-sharing-prompt = Vil du tillate at arbeidet ditt blir delt med andre?
publications-sharing-reserved =
    .label = Nei, kun publiser mitt arbeid på zotero.org
publications-sharing-cc =
    .label = Ja, under en Creative Commons lisens
publications-sharing-cc0 =
    .label = Ja, og gjør arbeidet mitt offentlig tilgjengelig
publications-license-page = Velg en Creative Commons lisens
publications-choose-license-text = En Creative Commons lisens tillater andre å kopiere og videredistribuere arbeidet ditt så lenge de gir deg passende kreditt, angir en lenke til lisensen, og gjør oppmerksom på om det er gjort endringer. Tilleggsbetingelser kan bli angitt nedenfor.
publications-choose-license-adaptations-prompt = Tillat deling av bearbeidinger av ditt arbeid
publications-choose-license-yes =
    .label = Ja
    .accesskey = Y
publications-choose-license-no =
    .label = Nei
    .accesskey = N
publications-choose-license-sharealike =
    .label = Ja, så lenge andre deler på samme vis
    .accesskey = S
publications-choose-license-commercial-prompt = Tillat kommersiell bruk av ditt arbeid?
publications-buttons-add-to-my-publications =
    .label = Legg til i Mine publikasjoner
publications-buttons-next-sharing =
    .label = Neste: Deling
publications-buttons-next-choose-license =
    .label = Velg en lisens
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Attribution 4.0 internasjonal lisens
licenses-cc-by-nd = Creative Commons Attribution-NoDerivatives 4.0 internasjonal lisens
licenses-cc-by-sa = Creative Commons Attribution-ShareAlike 4.0 internasjonal lisens
licenses-cc-by-nc = Creative Commons Attribution-NonCommercial 4.0 internasjonal lisens
licenses-cc-by-nc-nd = Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 internasjonal lisens
licenses-cc-by-nc-sa = Creative Commons Attribution-NonCommercial-ShareAlike 4.0 internasjonal lisens
licenses-cc-more-info = Sørg for at du har lest Creative Commons <a data-l10n-name="license-considerations">Betraktninger for lisensgivere</a> før du utgir verket ditt under en CC-lisens. Vær oppmerksom på at lisensen du bruker, ikke kan tilbakekalles, selv om du senere velger andre vilkår eller slutter å publisere verket.
licenses-cc0-more-info = Sørg for at du har lest Creative Commons  <a data-l10n-name="license-considerations">CC0 FAQ</a> før du dediserer verket ditt under CC0 vilkårene. Vær oppmerksom på at det er irreversibelt å dedisere verket ditt til det fri, selv om du senere velger andre vilkår eller slutter å publisere verket.
restart-in-troubleshooting-mode-menuitem =
    .label = Start på nytt i feilsøkingsmodus…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Start på nytt i feilsøkingsmodus
restart-in-troubleshooting-mode-dialog-description = { -app-name } vil starte på nytt med alle programtillegg deaktivert. Det kan hende at enkelte funksjoner ikke fungerer som de skal når feilsøkingsmodus er aktivert.
menu-ui-density =
    .label = Tetthet
menu-ui-density-comfortable =
    .label = Romslig
menu-ui-density-compact =
    .label = Kompakt
pane-info = Info
pane-abstract = Sammendrag
pane-attachments = Vedlegg
pane-notes = Notater
pane-libraries-collections = Biblioteker og samlinger
pane-tags = Emneord
pane-related = Relatert
pane-attachment-info = Vedleggsinformasjon
pane-attachment-preview = Forhåndsvisning
pane-attachment-annotations = Markeringer
pane-header-attachment-associated =
    .label = Gi nytt navn til tilknyttet fil
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } vedlegg
           *[other] { $count } vedlegg
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } markering
           *[other] { $count } markeringer
        }
section-notes =
    .label =
        { $count ->
            [one] { $count } notat
           *[other] { $count } notater
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } emneord
           *[other] { $count } emneord
        }
section-related =
    .label = { $count } relatert
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Utvid seksjon
    .label = Utvid { $section } seksjon
section-button-collapse =
    .dynamic-tooltiptext = Skjul seksjon
    .label = Skjul { $section } seksjon
annotations-count =
    { $count ->
        [one] { $count } markering
       *[other] { $count } markeringer
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
    .label = Fest seksjon
unpin-section =
    .label = Løsne seksjon
collapse-other-sections =
    .label = Skjul andre seksjoner
expand-all-sections =
    .label = Utvid alle seksjoner
abstract-field =
    .placeholder = Legg til abstrakt…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtrer emneord
context-notes-search =
    .placeholder = Søk i notater
new-collection-dialog =
    .title = Ny samling
    .buttonlabelaccept = Opprett samling
new-collection-name = Navn:
new-collection-create-in = Opprett i:
attachment-info-filename = Filnavn
attachment-info-accessed = Lest
attachment-info-pages = Sider
attachment-info-modified = Endret
attachment-info-index = Indeksert
attachment-info-convert-note =
    .label =
        Migrer til { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } notat
    .tooltiptext = Det er ikke lenger støtte for å legge til notater i vedlegg, men du kan redigere dette notatet ved å migrere det til et eget notat.
attachment-preview-placeholder = Intet vedlegg å forhåndsvise
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } Forhåndsvisning av vedlegg
quickformat-general-instructions =
    Bruk pil venstre/høyre for å navigere mellom elementene i denne henvisningen. { $dialogMenu ->
        [active] Trykk på Shift-Tab for å fokusere på dialogboksens meny.
       *[other] { "" }
    } Trykk på { return-or-enter } for å lagre endringene i henvisningen. Trykk på Escape for å forkaste endringene og lukke dialogboksen.
quickformat-aria-bubble = Dette elementet er inkludert i henvisningen. Trykk på mellomromstasten for å tilpasse elementet. { quickformat-general-instructions }
quickformat-aria-input = Skriv inn for å søke etter et element som skal inkluderes i henvisningen. Trykk på Tab for å navigere i listen over søkeresultater. { quickformat-general-instructions }
quickformat-aria-item = Trykk { return-or-enter } for å legge til dette elementet i henvisningen. Trykk på Tab for å gå tilbake til søkefeltet.
quickformat-accept =
    .tooltiptext = Lagre endringer i denne henvisningen
quickformat-locator-type =
    .aria-label = Type oppslagsmotor
quickformat-locator-value = Oppslagsmotor
quickformat-citation-options =
    .tooltiptext = Vis alternativer for henvisning
insert-note-aria-input = Skriv inn for å søke etter et notat. Trykk på Tab for å navigere i listen over resultater. Trykk på Escape for å lukke dialogboksen.
insert-note-aria-item = Trykk på { return-or-enter } for å velge dette notatet. Trykk på Tab for å gå tilbake til søkefeltet. Trykk på Escape for å lukke dialogboksen.
quicksearch-mode =
    .aria-label = Hurtigsøk-modus
quicksearch-input =
    .aria-label = Hurtigsøk
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Vis som
item-pane-header-none =
    .label = Ingen
item-pane-header-title =
    .label = Tittel
item-pane-header-titleCreatorYear =
    .label = Tittel, opphaver, år
item-pane-header-bibEntry =
    .label = Bibliografi oppføring
item-pane-header-more-options =
    .label = Flere valg
item-pane-message-items-selected =
    { $count ->
        [0] Ingen elementer valgt
        [one] { $count } element valgt
       *[other] { $count } elementer valgt
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } samling valgt
       *[other] { $count } samlinger valgt
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } søk valgt
       *[other] { $count } søk valgt
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } valgt objekt
       *[other] { $count } valgte objekter
    }
item-pane-message-unselected =
    { $count ->
        [0] Ingen elementer i denne visningen
        [one] { $count } element i denne visningen
       *[other] { $count } elementer i denne visningen
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Slå sammen { $count } element
           *[other] Slå sammen { $count } elementer
        }
locate-library-lookup-no-resolver = Du må velge en lenketjener fra { $pane }-ruten i { -app-name }-innstillingene.
architecture-win32-warning-message = Bytt til 64-bit { -app-name } for å få best mulig ytelse. Dataene dine vil ikke bli påvirket.
architecture-warning-action = Last ned 64-bit { -app-name }
architecture-x64-on-arm64-message = { -app-name } kjører i emulert modus. En plattformavhengig versjon av { -app-name } vil kjøre mer effektivt.
architecture-x64-on-arm64-action = Last ned { -app-name } for ARM64
first-run-guidance-quickFormat =
    Skriv inn tittel, forfatter og/eller årstall for å søke etter en referanse.
    
    Når du har gjort et valg, klikker du på boblen eller velger den via tastaturet og trykker på ↓/mellomrom for å vise henvisningsalternativer som sidetall, prefiks og suffiks.
    
    Du kan også legge til et sidetall direkte ved å inkludere det i søkeordene eller skrive det inn etter boblen og trykke { return-or-enter }.
first-run-guidance-authorMenu = { -app-name } kan du også angi redaktører og oversettere. Du kan gjøre en forfatter om til en redaktør eller oversetter ved å velge fra denne menyen.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Søketilstand
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operatør
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Verdi
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] { $count } fil lagt til
       *[other] { $count } filer lagt til
    }
select-items-dialog =
    .buttonlabelaccept = Velg
file-type-webpage = Nettside
file-type-image = Bilde
file-type-pdf = PDF
file-type-audio = Lyd
file-type-video = Video
file-type-presentation = Presentasjon
file-type-document = Dokument
file-type-ebook = E-bok
post-upgrade-message = Lær om de <a data-l10n-name="new-features-link">nye funksjonene i { -app-name } { $version }</a>
post-upgrade-density = Velg ønsket tetthet på oppsettet:
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Lim inn og søk
