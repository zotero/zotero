general-sentence-separator = { " " }
general-key-control = Control
general-key-shift = Skift
general-key-alt = Alt
general-key-option = Alternativ
general-key-command = Kommando
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
        [macos] Retur
       *[other] Enter
    }
delete-or-backspace =
    { PLATFORM() ->
        [macos] Delete
       *[other] Backsteg
    }
-os-name =
    { PLATFORM() ->
        [macos] macOS
        [windows] Windows
       *[other] Linux
    }
general-print = Skriv ut
general-remove = Ta bort
general-add = Lägg till
general-remind-me-later = Påminn mig senare
general-dont-ask-again = Fråga inte igen
general-choose-file = Välj fil...
general-open-settings = Öppna inställningar
general-settings = Inställningar…
general-help = Hjälp
general-tag = Etikett
general-got-it = Jag förstår
general-done = Klar
general-view-troubleshooting-instructions = Visa felsökningsinstruktioner
general-go-back = Gå bakåt
general-accept = Acceptera
general-cancel = Avbryt
cancel-button =
    .label = { general-cancel }
general-show-in-library = Visa i biblioteket
general-restartApp = Starta om { -app-name }
general-restartInTroubleshootingMode = Starta om i felsökningsläge
general-save = Spara
general-clear = Rensa
clear-button =
    .label = { general-clear }
general-update = Uppdatera
general-reset-to-default = Återställ till standard
general-back = Bakåt
general-edit = Redigera
general-cut = Klipp ut
general-copy = Kopiera
general-paste = Klistra in
general-find = Hitta
general-delete = Radera
general-insert = Infoga
general-and = och
general-et-al = m. fl.
general-previous = Föregående
general-next = Nästa
general-learn-more = Läs mer
general-more-information = Mer information
general-warning = Varning
general-type-to-continue = Skriv ”{ $text }” för att fortsätta.
general-continue = Fortsätt
general-allow = Tillåt
general-always-allow = Tillåt alltid
general-deny = Neka
general-red = Röd
general-orange = Orange
general-yellow = Gul
general-green = Grön
general-teal = Turkosgrön
general-blue = Blå
general-purple = Lila
general-magenta = Magenta
general-violet = Violett
general-maroon = Mörkröd
general-gray = Grå
general-black = Svart
general-loading = Laddar…
db-checking-integrity = Kontrollerar databasens integritet…
db-repairing = Reparerar databasen…
citation-style-label = Referensstil
language-label = Språk:
menu-custom-group-submenu =
    .label = Fler alternativ...
menu-file-show-in-finder =
    .label = Visa i Finder
menu-file-show-file =
    .label = Visa fil
menu-file-show-files =
    .label = Visa filer
menu-print =
    .label = { general-print }
menu-density =
    .label = Täthet
add-attachment = Lägg till bilaga
new-note = Ny anteckning
menu-add-by-identifier =
    .label = Lägg till med identifierare…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Lägg till fil...
menu-add-standalone-linked-file-attachment =
    .label = Lägg till länk till fil…
menu-add-child-file-attachment =
    .label = Bifoga fil...
menu-add-child-linked-file-attachment =
    .label = Bifoga länk till fil...
menu-add-child-linked-url-attachment =
    .label = Bifoga webblänk...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Ny fristående anteckning
menu-new-item-note =
    .label = Ny objektanteckning
menu-restoreToLibrary =
    .label = Återställ till bibliotek
menu-deletePermanently =
    .label = Radera permanent…
menu-tools-plugins =
    .label = Tillägg
menu-view-columns-move-left =
    .label = Flytta kolumn till vänster
menu-view-columns-move-right =
    .label = Flytta kolumn till höger
menu-view-hide-context-annotation-rows =
    .label = Dölj icke-matchande kommentarer
menu-view-note-font-size =
    .label = Teckenstorlek för anteckning
menu-view-note-tab-font-size =
    .label = Teckenstorlek på anteckningsflik
menu-show-tabs-menu =
    .label = Visa flikmeny
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Kopiera { $count } kommentar
           *[other] Kopiera { $count } kommentarer
        }
main-window-command =
    .label = Bibliotek
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = Lista alla flikar
filter-collections = Filtrera samlingar
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Sök flikar
zotero-tabs-menu-close-button =
    .title = Stäng flik
zotero-toolbar-tabs-scroll-forwards =
    .title = Rulla framåt
zotero-toolbar-tabs-scroll-backwards =
    .title = Rulla bakåt
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
recently-read = Senast lästa
collections-menu-show-recently-read =
    .label = Visa { recently-read }
item-menu-remove-from-recently-read =
    .label = Ta bort från { recently-read }…
collections-menu-clear-all-last-read =
    .label = Rensa alla senast läst-datum…
recently-read-clear-all-confirm = Alla datum för senast läst i det här biblioteket raderas.
items-list-load-error-plugin = Error loading items list. Disabling the “{ $plugin }” plugin and restarting { -app-name } may fix this.
items-section-collections-selected =
    { $count ->
        [one] { $count } samling vald
       *[other] { $count } samlingar valda
    }
items-section-searches-selected =
    { $count ->
        [one] { $count } sparad sökning vald
       *[other] { $count } sparade sökningar valda
    }
items-section-sources-selected =
    { $count ->
        [one] { $count } källa vald
       *[other] { $count } källor valda
    }
items-section-library-collections =
    { $count ->
        [one] { $library } ({ $count } samling vald)
       *[other] { $library } ({ $count } samlingar valda)
    }
items-section-library-searches =
    { $count ->
        [one] { $library } ({ $count } sparad sökning vald)
       *[other] { $library } ({ $count } sparade sökningar valda)
    }
items-section-library-sources =
    { $count ->
        [one] { $library } ({ $count } källa vald)
       *[other] { $library } ({ $count } källor valda)
    }
items-section-library-recently-read = { $library } ({ recently-read })
items-section-library = { $library }
collections-menu-rename =
    .label = Byt namn
edit-saved-search = Redigera sparad sökning
collections-menu-edit-search =
    .label = Redigera sökning
collections-menu-duplicate-search =
    .label = Duplicera sökning
collections-menu-move-collection =
    .label = Flytta till
collections-menu-copy-collection =
    .label = Kopiera till
collections-menu-export =
    .label = Exportera...
collections-menu-generate-report =
    .label = Skapa rapport…
collections-menu-create-bibliography =
    .label = Skapa referenslista…
collections-menu-unsubscribe =
    .label = Avsluta prenumeration…
collections-menu-delete =
    .label =
        { $count ->
            [one] Ta bort samling…
           *[other] Ta bort samlingar…
        }
collections-menu-delete-with-items =
    .label =
        { $count ->
            [one] Ta bort samling och objekt…
           *[other] Ta bort samlingar och objekt…
        }
collections-menu-delete-search =
    .label =
        { $count ->
            [one] Ta bort sökning…
           *[other] Ta bort sökningar…
        }
collections-delete-title =
    { $count ->
        [one] Ta bort samling
       *[other] Ta bort samlingar
    }
collections-delete-message =
    { $count ->
        [one] Vill du ta bort den här samlingen?
       *[other] Vill du ta bort { $count } samlingar?
    }
collections-delete-keep-items =
    { $count ->
        [one] Objekten i den här samlingen tas inte bort.
       *[other] Objekten i de här samlingarna tas inte bort.
    }
collections-delete-with-items-title =
    { $count ->
        [one] Ta bort samling och objekt
       *[other] Ta bort samlingar och objekt
    }
collections-delete-with-items-message =
    { $count ->
        [one] Vill du ta bort den här samlingen och flytta alla objekt i den till papperskorgen?
       *[other] Vill du ta bort { $count } samlingar och flytta alla objekt i dem till papperskorgen?
    }
collections-delete-search-title =
    { $count ->
        [one] Ta bort sökning
       *[other] Ta bort sökningar
    }
collections-delete-search-message =
    { $count ->
        [one] Vill du ta bort den här sökningen?
       *[other] Vill du ta bort { $count } sökningar?
    }
item-creator-moveDown =
    .label = Flytta ner
item-creator-moveToTop =
    .label = Flytta överst
item-creator-moveUp =
    .label = Flytta upp
item-menu-viewAttachment =
    .label =
        Öppna { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] ögonblicksbild
                    [note] anteckning
                   *[other] bilaga
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDF-filer
                    [epub] EPUB-filer
                    [snapshot] ögonblicksbilder
                    [note] anteckningar
                   *[other] bilagor
                }
        } { $openIn ->
            [tab] i ny flik
            [window] i nytt fönster
           *[other] { "" }
        }
item-menu-add-file =
    .label = Arkiv
item-menu-add-linked-file =
    .label = Länkad fil
item-menu-add-url =
    .label = Webblänk
item-menu-change-parent-item =
    .label = Ändra överordnat objekt…
item-menu-relate-items =
    .label = Koppla samman objekt
view-online = Visa online
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Filen har bytt namn till { $filename }
file-access-error-fs-corrupted = { -os-name } reported that the file or disk is corrupted. Run a disk check on the drive containing the file.
itembox-button-options =
    .tooltiptext = Öppna snabbmeny
itembox-button-merge =
    .aria-label = Välj version av fältet { $field }
create-parent-intro = Ange ett DOI, ISBN, PMID, arXiv-id eller ADS Bibcode för att identifiera filen:
reader-use-dark-mode-for-content =
    .label = Använd mörkt läge för innehåll
update-updates-found-intro-minor = En uppdatering för { -app-name } finns tillgänglig:
update-updates-found-desc = Vi rekommenderar att du installerar uppdateringen så snart som möjligt.
import-window =
    .title = Importera
import-where-from = Varifrån vill du importera?
import-online-intro-title = Introduktion
import-source-file =
    .label = En fil (BibTeX, RIS, Zotero RDF, etc.)
import-source-folder =
    .label = En mapp med PDF-filer eller andra filer
import-source-online =
    .label = Onlineimport från { $targetApp }
import-options = Alternativ
import-importing = Importerar…
import-create-collection =
    .label = Lägg importerade samlingar och källor i en ny samling
import-recreate-structure =
    .label = Återskapa mappstrukturen som samlingar
import-fileTypes-header = Filtyper att importera:
import-fileTypes-pdf =
    .label = PDF:er
import-fileTypes-other =
    .placeholder = Andra filer efter mönster, kommaseparerade (t.ex. *.jpg,*.png)
import-file-handling = Filhantering
import-file-handling-store =
    .label = Kopiera filer till lagringsmappen för { -app-name }
import-file-handling-link =
    .label = Länka till filer i sin ursprungliga plats
import-fileHandling-description = Länkade filer kan inte synkroniseras av { -app-name }.
import-online-new =
    .label = Hämta endast nya objekt; uppdatera inte tidigare importerade objekt
import-mendeley-username = Användarnamn
import-mendeley-password = Lösenord
general-error = Fel
file-interface-import-error = Ett fel uppstod när den valda filen skulle importeras. Var vänlig se till att filen är giltig och försök sedan igen.
file-interface-import-complete = Importering färdig
file-interface-items-were-imported =
    { $numItems ->
        [0] Inga objekt importerades
        [one] Ett objekt importerades
       *[other] { $numItems } objekt importerades
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Inga objekt länkades om
        [one] Ett objekt länkades om
       *[other] { $numRelinked } objekt länkades om
    }
import-mendeley-cannot-decrypt = The selected Mendeley database could not be decrypted. This can happen if the database file has been renamed. See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
import-mendeley-unsupported = The selected file does not appear to be a Mendeley database. See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
import-mendeley-db-in-use = The selected Mendeley database is in use. Please quit Mendeley Desktop and try again.
file-interface-import-error-translator = Ett fel uppstod när den valda filen importerades med ”{ $translator }”. Kontrollera att filen är giltig och försök igen.
import-online-intro = I nästa steg ombeds du logga in på { $targetAppOnline } och ge { -app-name } åtkomst. Detta behövs för att importera ditt { $targetApp }-bibliotek till { -app-name }.
import-online-intro2 = { -app-name } kommer aldrig att se eller lagra ditt lösenord för { $targetApp }.
import-online-form-intro = Ange dina inloggningsuppgifter för att logga in på { $targetAppOnline }. Detta behövs för att importera ditt { $targetApp }-bibliotek till { -app-name }.
import-online-wrong-credentials = Inloggning på { $targetApp } misslyckades. Ange inloggningsuppgifterna igen och försök igen.
import-online-blocked-by-plugin = Importen kan inte fortsätta när insticksmodulen { $plugin } är installerad. Inaktivera den och försök igen.
import-online-relink-only =
    .label = Länka om citeringar från Mendeley Desktop
import-online-relink-kb = { general-more-information }
import-online-connection-error = { -app-name } kunde inte ansluta till { $targetApp }. Kontrollera internetanslutningen och försök igen.
tab-title-multiple-collections = Flera
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } anteckning
           *[other] { $count } anteckningar
        }
items-column-added-by = Tillagd av
items-column-modified-by = Ändrad av
items-column-last-read = Senast läst
report-error =
    .label = Rapportera felet...
rtfScan-wizard =
    .title = RTF skanning
rtfScan-introPage-description = { -app-name } kan automatiskt extrahera och formatera om citeringar samt infoga en referenslista i RTF-filer. Det stöder för närvarande citeringar i varianter av följande format:
rtfScan-introPage-description2 = Välj en RTF-fil nedan att ladda in och en att spara till:
rtfScan-input-file = Indatafil:
rtfScan-output-file = Utdatafil:
rtfScan-no-file-selected = Ingen fil vald
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Välj indatafil
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Välj utdatafil
rtfScan-intro-page = Introduktion
rtfScan-scan-page = Letar efter hänvisningar
rtfScan-scanPage-description = { -app-name } söker igenom dokumentet efter citeringar. Vänta lite.
rtfScan-citations-page = Bekräfta hänvisade källor
rtfScan-citations-page-description = Granska listan med identifierade citeringar nedan så att { -app-name } har valt motsvarande objekt korrekt. Alla omappade eller tvetydiga citeringar måste lösas innan du går vidare till nästa steg.
rtfScan-style-page = Dokumentformat
rtfScan-format-page = Justerar källhänvisningar
rtfScan-format-page-description = { -app-name } bearbetar och formaterar RTF-filen. Vänta lite.
rtfScan-complete-page = RTF-scanning färdig
rtfScan-complete-page-description = Ditt dokument har blivit bearbetat. Försäkra dig om att det är korrekt formaterat.
rtfScan-action-find-match =
    .title = Välj matchande objekt
rtfScan-action-accept-match =
    .title = Godkänn denna matchning
runJS-title = Kör JavaScript
runJS-editor-label = Kod:
runJS-run = Kör
runJS-help = { general-help }
runJS-completed = slutfördes utan fel
runJS-result =
    { $type ->
        [async] Returvärde:
       *[other] Resultat:
    }
runJS-run-async = Kör som asynkron funktion
bibliography-window =
    .title = { -app-name } – skapa citering/referenslista
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Visa citeringar som:
bibliography-advancedOptions-label = Avancerade alternativ
bibliography-outputMode-label = Utmatningsläge
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citeringar
            [note] Anteckningar
           *[other] Citeringar
        }
bibliography-outputMode-bibliography =
    .label = Källförteckning
bibliography-outputMethod-label = Utmatningsmetod
bibliography-outputMethod-saveAsRTF =
    .label = Spara som RTF
bibliography-outputMethod-saveAsHTML =
    .label = Spara som HTML
bibliography-outputMethod-copyToClipboard =
    .label = Kopiera till urklipp
bibliography-outputMethod-print =
    .label = Skriv ut
bibliography-manageStyles-label = Hantera stilar…
styleEditor-locatorType =
    .aria-label = Platshållartyp
styleEditor-locatorInput = Platshållarinmatning
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Stilredigerare
styleEditor-preview =
    .aria-label = Förhandsvisa
stylePreview-generating = Skapar förhandsvisningar…
publications-intro-page = Mina publikationer
publications-intro = Källor du lägger till i Mina publikationer kommer att visas på din profilsida på zotero.org. Om du väljer att inkludera bifogade filer blir de tillgängliga enligt den licens du anger. Lägg endast till verk som du själv har skapat och bifoga bara filer om du har rätt att dela dem vidare och önskar att göra så.
publications-include-checkbox-files =
    .label = Inkludera filer
publications-include-checkbox-notes =
    .label = Inkludera anteckningar
publications-include-adjust-at-any-time = Du kan när som helst justera vad som ska visas från Mina publikationer-samlingen.
publications-intro-authorship =
    .label = Jag skapade detta verk.
publications-intro-authorship-files =
    .label = Jag skapade detta verk och har rättigheterna att distribuera bifogade filer.
publications-sharing-page = Välj hur ditt verk får delas
publications-sharing-keep-rights-field =
    .label = Behåll nuvarande rättighetsfält
publications-sharing-keep-rights-field-where-available =
    .label = Behåll nuvarande rättighetsfält om det är möjligt
publications-sharing-text = Du kan reservera alla rättigheter till det verk, licensiera det enligt en Creative Commons-licens eller överlämna det som allmän egendom (public domain). I samtliga fall kommer verket att vara tillgängligt för allmänheten via zotero.org.
publications-sharing-prompt = Medger du att ditt verk delas med andra?
publications-sharing-reserved =
    .label = Nej, publicera mitt verk endast på zotero.org
publications-sharing-cc =
    .label = Ja, med Creative Commns-licens
publications-sharing-cc0 =
    .label = Ja, gör mitt verk till allmän egendom
publications-license-page = Välj en Creative Commons-licens
publications-choose-license-text = En Creative Commons licens tillåter andra att kopiera och vidaredistribuera ditt verk, så länge de lämnar uppgifter om upphovspersonen, lämnar en länk till licensen and anger om de har gjort några ändringar. Ytterligare villkor kan anges nedan.
publications-choose-license-adaptations-prompt = Tillåtelse att bearbetningar av ditt verk delas?
publications-choose-license-yes =
    .label = Ja
    .accesskey = Y
publications-choose-license-no =
    .label = Nej
    .accesskey = N
publications-choose-license-sharealike =
    .label = Ja, så länge andra delar med samma villkor
    .accesskey = S
publications-choose-license-commercial-prompt = Tillåtelse att verket används kommersiellt?
publications-buttons-add-to-my-publications =
    .label = Lägg till Mina publikationer
publications-buttons-next-sharing =
    .label = Nästa: delning
publications-buttons-next-choose-license =
    .label = Välj en licens
licenses-cc-0 = CC0 1.0-universell överlåtelse till allmän egendom
licenses-cc-by = Creative Commons Attribution 4.0 International licens
licenses-cc-by-nd = Creative Commons Attribution-NoDerivatives 4.0 International licens
licenses-cc-by-sa = Creative Commons Attribution-ShareAlike 4.0 International licens
licenses-cc-by-nc = Creative Commons Attribution-NonCommercial 4.0 International licens
licenses-cc-by-nc-nd = Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International licens
licenses-cc-by-nc-sa = Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International licens
licenses-cc-more-info = Kontrollera att du har läst Creative Commons <a data-l10n-name="license-considerations">överväganden för licensgivare</a> innan du licensierar ditt verk med en CC-licens. Observera att licensen du använder inte kan återkallas, även om du senare väljer andra villkor eller slutar publicera verket.
licenses-cc0-more-info = Kontrollera att du har läst Creative Commons <a data-l10n-name="license-considerations">vanliga frågor om CC0</a> innan du använder CC0 för ditt verk. Observera att en överlåtelse av verket till allmän egendom inte kan återkallas, även om du senare väljer andra villkor eller slutar publicera verket.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Starta om i felsökningsläge…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } startas om med alla insticksmoduler inaktiverade. Vissa funktioner kanske inte fungerar korrekt när felsökningsläge är aktiverat.
menu-ui-density =
    .label = Täthet
menu-ui-density-comfortable =
    .label = Rymlig
menu-ui-density-compact =
    .label = Kompakt
pane-item-details = Objektinformation
pane-info = Information
pane-abstract = Sammanfattning
pane-attachments = Bilagor
pane-notes = Anteckningar
pane-note-info = Anteckningsinformation
pane-libraries-collections = Bibliotek och samlingar
pane-tags = Etiketter
pane-related = Liknande källor
pane-attachment-info = Information om bilaga
pane-attachment-preview = Förhandsvisa
pane-attachment-annotations = Anteckningar
pane-header-attachment-associated =
    .label = Ändra namn på bifogad fil
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } bilaga
           *[other] { $count } bilagor
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } anteckning
           *[other] { $count } anteckningar
        }
section-attachments-move-to-trash-message = Är du säker på att du vill flytta ”{ $title }” till papperskorgen?
section-notes =
    .label =
        { $count ->
            [one] { $count } anteckning
           *[other] { $count } anteckningar
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } etikett
           *[other] { $count } etiketter
        }
section-related =
    .label = { $count } liknande
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Fäll ut avsnitt
    .label = Fäll ut avsnittet { $section }
section-button-collapse =
    .dynamic-tooltiptext = Stäng avsnitt
    .label = Stäng { $section } avsnitt
annotations-count =
    { $count ->
        [one] { $count } anteckning
       *[other] { $count } anteckningar
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
    .label = Flytta avsnitt uppåt
sidenav-reorder-down =
    .label = Flytta avsnitt nedåt
sidenav-reorder-reset =
    .label = Återställ avsnittsordning
toggle-item-pane =
    .tooltiptext = Visa/dölj objektpanel
toggle-context-pane =
    .tooltiptext = Växla kontextpanel
pin-section =
    .label = Fäst avsnitt
unpin-section =
    .label = Lossa avsnitt
collapse-other-sections =
    .label = Stäng övriga avsnitt
expand-all-sections =
    .label = Fäll ut alla avsnitt
abstract-field =
    .placeholder = Lägg till sammanfattning …
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtrera etiketter
context-notes-search =
    .placeholder = Sök anteckningar
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Ny samling...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Ny samling
    .buttonlabelaccept = Skapa samling
new-collection-name = Namn:
new-collection-create-in = Skapa i:
show-publications-menuitem =
    .label = Visa mina publikationer
attachment-info-title = Titel
attachment-info-filename = Filnamn
attachment-info-accessed = Hämtdatum
attachment-info-pages = Sidor
attachment-info-modified = Ändrad den
attachment-info-index = Indexerad
attachment-info-convert-note =
    .label =
        Flytta till { $type ->
            [standalone] fristående
            [child] objekt
           *[unknown] ny
        } anteckning
    .tooltiptext = Det går inte längre att lägga till anteckningar i bilagor, men du kan redigera den här anteckningen genom att flytta den till en separat anteckning.
section-note-info =
    .label = { pane-note-info }
note-info-title = Titel
note-info-parent-item = Överordnat objekt
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] Inget
    }
    .title =
        { $hasParentItem ->
            [true] Visa överordnat objekt i biblioteket
           *[false] Visa anteckningsobjekt i biblioteket
        }
note-info-date-created = Skapad
note-info-date-modified = Ändrad den
note-info-size = Storlek
note-info-word-count = Antal ord
note-info-character-count = Antal tecken
item-title-empty-note = Anteckning utan titel
attachment-preview-placeholder = Ingen bilaga att förhandsvisa
attachment-rename-from-parent =
    .tooltiptext = Byt filnamn så att det matchar överordnat objekt
account-log-in = Logga in
account-not-logged-in-text = Logga in på ditt Zotero-konto för att synkronisera dina data.
account-error-login-session-expired = Din inloggningssession har gått ut. Försök igen.
toggle-preview =
    .label =
        { $type ->
            [open] Dölj
            [collapsed] Visa
           *[unknown] Växla
        } förhandsvisning av bilaga
annotation-image-not-available = [Bild saknas]
quicksearch-mode =
    .aria-label = Snabbsökningsläge
quicksearch-input =
    .aria-label = Snabbsökning
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
advanced-search = Avancerad sökning
menuitem-advanced-search =
    .label = { advanced-search }
quicksearch-advanced-search-button =
    .tooltiptext = { advanced-search }
    .aria-label = { advanced-search }
advanced-search-close =
    .tooltiptext = Stäng avancerad sökning
advanced-search-expand =
    .tooltiptext = Fäll ut avancerad sökning
advanced-search-collapse =
    .tooltiptext = Fäll ihop avancerad sökning
item-pane-header-view-as =
    .label = Visa som
item-pane-header-none =
    .label = ingen ikon
item-pane-header-title =
    .label = Titel
item-pane-header-titleCreatorYear =
    .label = Titel, skapare, år
item-pane-header-bibEntry =
    .label = Referenspost
item-pane-header-more-options =
    .label = Fler alternativ
item-pane-message-items-selected =
    { $count ->
        [0] Inga objekt valda
        [one] { $count } objekt valt
       *[other] { $count } objekt valda
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } samling vald
       *[other] { $count } samlingar valda
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } sökning vald
       *[other] { $count } sökningar valda
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } objekt valt
       *[other] { $count } objekt valda
    }
item-pane-message-unselected =
    { $count ->
        [0] Inga objekt i den här vyn
        [one] { $count } objekt i den här vyn
       *[other] { $count } objekt i den här vyn
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] Inga objekt i den här vyn
        [one] { $count } objekt i den här vyn
       *[other] { $count } objekt i den här vyn
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Slå samman en post
           *[other] Slå samman { $count } poster
        }
locate-library-lookup-no-resolver = Du måste välja en uppslagsserver i panelen { $pane } i inställningarna för { -app-name }.
architecture-win32-warning-message = Byt till 64-bitarsversionen av { -app-name } för bästa prestanda. Dina data påverkas inte.
architecture-warning-action = Hämta ner 64-bitars { -app-name }
architecture-x64-on-arm64-message = { -app-name } körs i emulerat läge. En inbyggd version av { -app-name } körs effektivare.
architecture-x64-on-arm64-action = Hämta { -app-name } för ARM64
first-run-guidance-authorMenu = Med { -app-name } kan du även ange redaktörer och översättare. Välj i den här menyn för att ändra en författare till redaktör eller översättare.
first-run-guidance-readAloud = { -app-name } kan nu läsa upp dina dokument med naturligt klingande röster.
advanced-search-remove-btn =
    .tooltiptext = Ta bort villkor
advanced-search-add-btn =
    .tooltiptext = Lägg till villkor
advanced-search-group-btn =
    .tooltiptext = Lägg till villkorsgrupp
advanced-search-remove-group-btn =
    .tooltiptext = Ta bort villkorsgrupp
advanced-search-ungroup-btn =
    .tooltiptext = Dela upp villkorsgrupp
advanced-search-result-level-menu =
    .aria-label = Resultattyp
advanced-search-result-level-prefix-root =
    .value = Hitta
advanced-search-join-prefix-root =
    .value = matchar
advanced-search-result-level-any =
    .label = valfria poster
advanced-search-result-level-item =
    .label = poster på toppnivå
advanced-search-result-level-attachment =
    .label = bifogade filer
advanced-search-result-level-note =
    .label = anteckningar
advanced-search-result-level-annotation =
    .label = annoteringar
advanced-search-binding-menu =
    .aria-label = Matcha mot samma post
advanced-search-binding-separate =
    .label = var för sig
advanced-search-binding-same-attachment =
    .label = i samma bifogade fil
advanced-search-binding-same-note =
    .label = i samma anteckning
advanced-search-binding-same-annotation =
    .label = i samma annotering
advanced-search-of-the-following =
    .value = av följande
advanced-search-binding-hint-attachment =
    .value = De här villkoren kan matcha separata bifogade filer.
advanced-search-binding-hint-note =
    .value = De här villkoren kan matcha separata anteckningar.
advanced-search-binding-hint-annotation =
    .value = De här villkoren kan matcha separata annoteringar.
advanced-search-level-warning-mixed = Alla dessa villkor kan inte matcha samma post, så den här sökningen kommer aldrig att ge några resultat. Försök i stället matcha “{ $matchAny }” eller ställ in resultattypen till “{ $topLevelItems }”.
advanced-search-level-warning-unreachable = Den här sökningen har ett villkor som inte kan tillämpas på den valda resultattypen. Ställ in resultattypen till “{ $topLevelItems }” eller ta bort det inkompatibla villkoret.
advanced-search-group-warning-unreachable =
    Ett villkor här kan inte gälla samma { $entity ->
        [attachment] bifogade fil
        [note] anteckning
       *[annotation] annotering
    }. Matcha dem var för sig eller ta bort det inkompatibla villkoret.
advanced-search-group-warning-mixed = Alla dessa villkor kan inte matcha samma post, så den här gruppen kommer aldrig att matcha. Försök i stället matcha “{ $matchAny }” eller ställ in resultattypen till “{ $topLevelItems }”.
advanced-search-bind-same-attachment =
    .label = Matcha samma bifogade fil
advanced-search-bind-same-note =
    .label = Matcha samma anteckning
advanced-search-bind-same-annotation =
    .label = Matcha samma annotering
advanced-search-conditions-menu =
    .aria-label = Sökvillkor
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Värde
    .label = { $label }
search-operator-isEmpty = är tom
search-operator-isNotEmpty = är inte tom
search-conditions-tooltip-fields = Fält:
search-conditions-collection = Samling
search-conditions-savedSearch = Sparad sökning
search-conditions-itemTypeID = Källtyp
search-query-keyword-creator = by
search-query-keyword-publication = in, publication, journal
search-query-keyword-item-type = type
search-query-keyword-language = lang
search-query-keyword-abstract = abstract
search-query-keyword-fulltext = fulltext, text
search-query-keyword-date = year
search-query-keyword-date-before = before
search-query-keyword-date-after = after, since
search-query-keyword-date-added = added
search-query-keyword-date-modified = modified
search-query-keyword-no-annotations = no annotations
search-query-keyword-has-annotations = has annotations
search-query-keyword-no-notes = no notes
search-query-keyword-has-notes = has notes
search-query-keyword-no-tags = no tags
search-query-keyword-has-tags = has tags
search-query-keyword-no-attachments = no attachments
search-query-keyword-has-attachments = has attachments
search-query-keyword-and = and
search-query-keyword-or = or
search-query-keyword-no = no
search-query-keyword-has = has
search-query-keyword-days = day, days
search-query-keyword-weeks = week, weeks
search-query-keyword-months = month, months
search-query-keyword-years = year, years
search-query-keyword-range = between 2020 and 2025, from 2020 to 2025, 2020 to 2025
search-query-keyword-range-excluded = not between 2020 and 2025
search-conditions-tag = Etikett
search-conditions-numTags = Antal taggar
search-conditions-numNotes = Antal anteckningar
search-conditions-numAttachments = Antal bifogade filer
search-conditions-numAnnotations = Antal annoteringar
search-conditions-note = Anteckning
search-conditions-childNote = Underordnad anteckning
search-conditions-creator = Skapare
search-conditions-thesisType = Uppsatstyp
search-conditions-reportType = Typ av rapport
search-conditions-videoRecordingFormat = Videoformat
search-conditions-audioFileType = Typ av ljudfil
search-conditions-audioRecordingFormat = Ljudformat
search-conditions-letterType = Typ av brev
search-conditions-interviewMedium = Intervjumedium
search-conditions-manuscriptType = Typ av manuskript
search-conditions-presentationType = Typ av presentation
search-conditions-mapType = Typ av karta
search-conditions-artworkMedium = Verkets medium
search-conditions-dateModified = Ändringsdatum
search-conditions-fulltextContent = Bilagans innehåll
search-conditions-programmingLanguage = Programmeringsspråk
search-conditions-fileTypeID = Bifogad filtyp
search-conditions-attachmentStorageType = Lagringstyp för bifogad fil
search-conditions-lastRead = Bifogad fil senast läst
search-conditions-annotationText = Kommentarstext
search-conditions-annotationComment = Kommentar
search-conditions-annotationType = Annoteringstyp
search-conditions-annotationColor = Annoteringsfärg
search-conditions-annotationAuthor = Annoteringsförfattare
search-conditions-anyField = Valfritt fält
search-conditions-titleCreatorYear = Titel, skapare, år
search-conditions-submenu-attachment = Bilaga
search-conditions-submenu-annotation = Kommentar
search-conditions-short-fulltextContent = Innehåll
search-conditions-short-fileTypeID = Filtyp
search-conditions-short-attachmentStorageType = Lagringstyp
search-conditions-short-lastRead = Senast läst
search-conditions-short-annotationText = Text
search-conditions-short-annotationComment = Kommentar
search-conditions-short-annotationType = Typ
search-conditions-short-annotationColor = Färg
search-conditions-short-annotationAuthor = Författare
find-pdf-files-added =
    { $count ->
        [one] { $count } fil har lagts till
       *[other] { $count } filer har lagts till
    }
select-items-window =
    .title = Markera källor
select-items-dialog =
    .buttonlabelaccept = Välj
select-items-convertToStandalone =
    .label = Konvertera till fristående
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Konvertera till fristående bifogad fil
           *[other] Konvertera till fristående bifogade filer
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Konvertera till fristående anteckning
           *[other] Konvertera till fristående anteckningar
        }
file-type-webpage = Webbsida
file-type-image = Bild
file-type-pdf = PDF
file-type-audio = Ljud
file-type-video = Video
file-type-presentation = Presentation
file-type-document = Dokument
file-type-ebook = E-bok
attachment-storage-type-storedFile = Lagrad fil
attachment-storage-type-linkedFile = Länkad fil
attachment-storage-type-webLink = Webblänk
post-upgrade-message = Du har uppgraderats till <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Läs om <a data-l10n-name="new-features-link">nyheterna</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Klistra in och sök
mac-word-plugin-install-message = Zotero behöver åtkomst till Word-data för att installera Word-insticksprogrammet.
mac-word-plugin-install-folder-message = { -app-name } behöver åtkomst till Words startmapp för att installera Word-insticksprogrammet.
mac-word-plugin-install-action-button =
    .label = Installera Word-insticksprogrammet
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Installera insticksprogrammet i Words startmapp
mac-word-plugin-install-folder-dialog-button = Installera
mac-word-plugin-install-wrong-folder-selected = Den föreslagna mappen måste väljas. Försök igen utan att välja en annan mapp.
file-renaming-banner-message = { -app-name } håller nu automatiskt filnamnen för bifogade filer synkroniserade när du ändrar poster.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = { -app-name } Connector måste uppdateras för att fungera med den här versionen av { -app-name }.
userjs-pref-warning = Vissa inställningar för { -app-name } har åsidosatts med en metod som inte stöds. { -app-name } återställer dem och startar om.
migrate-extra-fields-progress-headline = Uppdaterar poster…
migrate-extra-fields-progress-message = Migrerar nya fält från Extra-fältet
fulltext-indexing-progress-title = Indexerar
fulltext-indexing-progress-message = Resultaten från fulltextsökning kan vara ofullständiga tills indexeringen är klar.
long-tag-fixer-window-title =
    .title = Dela upp taggar
long-tag-fixer-button-dont-split =
    .label = Dela inte upp
menu-normalize-attachment-titles =
    .label = Normalisera titlar på bifogade filer…
normalize-attachment-titles-title = Normalisera titlar på bifogade filer
normalize-attachment-titles-text =
    { -app-name } byter automatiskt namn på filer på disken utifrån den överordnade postens metadata, men använder separata, enklare titlar som ”Fulltext-PDF”, ”Förtrycks-PDF” eller ”PDF” för primära bifogade filer. Det håller postlistan renare och undviker dubbel information.
    
    I äldre versioner av { -app-name }, och vid användning av vissa insticksprogram, kunde titlar på bifogade filer ändras i onödan så att de motsvarade filnamnen.
    
    Vill du uppdatera de valda bifogade filerna så att de använder enklare titlar? Endast primära bifogade filer med titlar som motsvarar filnamnet kommer att ändras.
banner-close-button =
    .aria-label = Avfärda avisering
plugins-blocked-plugin =
    .message = Det här insticksprogrammet har inaktiverats av { -app-name }.
data-dir-unsupported-storage = Detta kan inträffa om datakatalogen för { -app-name } finns i en molnlagringsmapp (OneDrive, Dropbox osv.) eller på en nätverksresurs.
data-dir-check-parent-write-access = Make sure you have write access to { $path } and that security software isn’t preventing { -app-name } from writing to the disk.
login-manager-reset = { -app-name } kunde inte läsa dina sparade inloggningsuppgifter och har därför återställt dem. Logga in igen i panelen { preferences-pane-account } i inställningarna för { -app-name }.
login-manager-open-profile-directory = Open Profile Directory
os-keystore-save-failed =
    { PLATFORM() ->
        [macos] { -app-name } kunde inte komma åt nyckelringen i { -os-name } för att spara dina inloggningsuppgifter säkert. Kontrollera att nyckelringen är åtkomlig och försök igen.
        [windows] { -app-name } kunde inte använda autentiseringshanteraren i { -os-name } för att spara dina inloggningsuppgifter säkert. Försök igen eller starta om { -app-name }.
       *[other] { -app-name } kunde inte komma åt din nyckelring i { -os-name } för att spara dina inloggningsuppgifter säkert. Kontrollera att en nyckelringstjänst som GNOME Nyckelring eller KWallet körs och försök igen.
    }
os-keystore-read-failed =
    { PLATFORM() ->
        [macos] { -app-name } kunde inte komma åt nyckelringen i { -os-name } för att läsa dina sparade inloggningsuppgifter. Kontrollera att nyckelringen är åtkomlig och försök igen.
        [windows] { -app-name } kunde inte använda autentiseringshanteraren i { -os-name } för att läsa dina sparade inloggningsuppgifter. Försök igen eller starta om { -app-name }.
       *[other] { -app-name } kunde inte komma åt din nyckelring i { -os-name } för att läsa dina sparade inloggningsuppgifter. Kontrollera att en nyckelringstjänst som GNOME Nyckelring eller KWallet körs och försök igen.
    }
os-keystore-read-unrecoverable =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t read your saved credentials from the { -os-name } Keychain.
        [windows] { -app-name } couldn’t read your saved credentials from { -os-name } Credential Manager.
       *[other] { -app-name } couldn’t read your saved credentials from your { -os-name } keyring.
    } You’ll need to set up syncing again in the { -app-name } settings.
os-keystore-save-unencrypted = { -app-name } kan i stället spara dina inloggningsuppgifter okrypterade. Då kan alla som har åtkomst till profilmappen för { -app-name } läsa dem.
os-keystore-save-unencrypted-button = Spara ändå
os-keystore-migrate-failed =
    { PLATFORM() ->
        [macos] { -app-name } kunde inte komma åt nyckelringen i { -os-name } för att kryptera dina lagrade inloggningsuppgifter. Dina inloggningsuppgifter är fortfarande okrypterade på disken. Kontrollera att nyckelringen är åtkomlig och starta om { -app-name }.
        [windows] { -app-name } kunde inte kryptera dina lagrade inloggningsuppgifter. Dina inloggningsuppgifter är fortfarande okrypterade på disken. Starta om { -app-name } och försök igen.
       *[other] { -app-name } kunde inte komma åt din nyckelring i { -os-name } för att kryptera dina lagrade inloggningsuppgifter. Dina inloggningsuppgifter är fortfarande okrypterade på disken. Kontrollera att en nyckelringstjänst som GNOME Nyckelring eller KWallet körs och starta om { -app-name }.
    }
search-button =
    .label = Sök
save-search-new-button =
    .label = Spara sökning…
save-search-edit-button =
    .label = Spara
save-search-name-title = Spara sökning
save-search-name-message = Ange ett namn för den sparade sökningen:
saved-search-close-confirmation-title = Redigerar sparad sökning
saved-search-close-confirmation-body = Vill du spara ändringarna du gjort i den här sparade sökningen?
item-pane-batch-editing-prompt =
    .aria-label = Massredigering
item-pane-batch-editing-enable =
    .label = Redigera flera poster…
item-pane-batch-editing-multiple-values-placeholder = Flera
item-pane-batch-editing-clear-values = Rensa alla värden
item-pane-batch-editing-header =
    { $count ->
        [one] Redigerar { $count } post
       *[other] Redigerar { $count } poster
    }
item-pane-batch-editing-done =
    .label = { general-done }
undo-action-edit-metadata =
    { $count ->
        [one] Redigera metadata
       *[other] Redigera metadata för { $count } poster
    }
undo-action-edit-field =
    { $count ->
        [one] Redigering av ”{ $field }”
       *[other] Redigering av ”{ $field }” för { $count } poster
    }
undo-action-normalize-attachment-titles = Normalisera titel för bifogad fil
undo-action-trash =
    { $count ->
        [one] Flytta post till papperskorgen
       *[other] Flytta { $count } poster till papperskorgen
    }
undo-action-restore-items =
    { $count ->
        [one] Återställ post
       *[other] Återställ { $count } poster
    }
undo-action-trash-collection =
    { $count ->
        [one] Flytta samling till papperskorgen
       *[other] Flytta { $count } samlingar till papperskorgen
    }
undo-action-trash-search =
    { $count ->
        [one] Flytta sparad sökning till papperskorgen
       *[other] Flytta { $count } sparade sökningar till papperskorgen
    }
undo-action-restore-collection =
    { $count ->
        [one] Återställ samling
       *[other] Återställ { $count } samlingar
    }
undo-action-restore-objects =
    { $count ->
        [one] Återställ objekt
       *[other] Återställ { $count } objekt
    }
undo-action-add-to-collection =
    { $count ->
        [one] Lägg till i samling
       *[other] Lägg till { $count } poster i samling
    }
undo-action-remove-from-collection =
    { $count ->
        [one] Ta bort från samling
       *[other] Ta bort { $count } poster från samling
    }
undo-action-move-to-collection =
    { $count ->
        [one] Flytta till samling
       *[other] Flytta { $count } poster till samling
    }
undo-action-rename-collection = Byt namn på samling
undo-action-move-collection = Flytta samling
undo-action-add-tag =
    { $count ->
        [one] Lägg till tagg
       *[other] Lägg till tagg på { $count } poster
    }
undo-action-change-tag = Ändra tagg
undo-action-split-tag = Dela upp tagg
undo-action-remove-tag =
    { $count ->
        [one] Ta bort tagg
       *[other] Ta bort tagg från { $count } poster
    }
undo-action-remove-tags-from-item =
    { $count ->
        [one] Ta bort tagg
       *[other] Ta bort { $count } taggar
    }
undo-action-remove-all-tags = Ta bort alla taggar
undo-action-edit-note = Redigera anteckning
undo-action-add-creator = Lägg till upphovsperson
undo-action-remove-creator = Ta bort upphovsperson
undo-action-edit-creator = Redigera upphovsperson
undo-action-reorder-creator = Ändra ordning på upphovsperson
undo-action-change-type = Ändra källtyp
undo-action-change-parent-item =
    { $count ->
        [one] Ändra överordnad post
       *[other] Ändra överordnad post för { $count } poster
    }
undo-action-convert-to-standalone =
    { $count ->
        [one] Konvertera till fristående post
       *[other] Konvertera { $count } poster till fristående
    }
undo-action-add-related = Lägg till relaterad post
undo-action-remove-related = Ta bort relaterad post
undo-action-merge-items =
    { $count ->
        [one] Slå samman post
       *[other] Slå samman { $count } poster
    }
menu-edit-undo-action = Ångra { $action }
menu-edit-redo-action = Gör om { $action }
local-api-authorize-title = Auktorisering för lokalt API
local-api-authorize-text = ”{ $appName }”, ett program som körs på din dator, vill ändra ditt bibliotek i { -app-name }.
