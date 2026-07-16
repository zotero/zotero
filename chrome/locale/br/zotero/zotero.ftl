general-sentence-separator = { " " }
general-key-control = Kontrol
general-key-shift = Pennlizh.
general-key-alt = Alt
general-key-option = Dibarzhioù
general-key-command = Urzhiad
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
-os-name =
    { PLATFORM() ->
        [macos] macOS
        [windows] Windows
       *[other] Linux
    }
general-print = Moullañ
general-remove = Dilemel
general-add = Ouzhpennañ
general-remind-me-later = Degas da soñj diwezhatoc'h
general-dont-ask-again = Na c'houlenn ken
general-choose-file = Diuzañ ur restr...
general-open-settings = Digeriñ an arventennoù
general-settings = Arventennoù...
general-help = Sikour
general-tag = Baliz
general-got-it = Deuet eo ganin
general-done = Graet
general-view-troubleshooting-instructions = Diskouez titouroù distankañ
general-go-back = Distreiñ
general-accept = Asantiñ
general-cancel = Nullañ
cancel-button =
    .label = { general-cancel }
general-show-in-library = Diskouez el levraoueg:
general-restartApp = Adloc'hañ { -app-name }
general-restartInTroubleshootingMode = Adloc'hañ er mod diveugiñ
general-save = Enrollañ
general-clear = Diverkañ
clear-button =
    .label = { general-clear }
general-update = Hizivaat
general-back = Distreiñ
general-edit = Aozañ
general-cut = Troc'hañ
general-copy = Eilañ
general-paste = Pegañ
general-find = Kavout
general-delete = Dilemel
general-insert = Enlakaat
general-and = ha/hag
general-et-al = hag all hag all
general-previous = Kent
general-next = Da-heul
general-learn-more = Gouzout hiroc'h
general-more-information = Muioc'h a ditouroù
general-warning = Kemenn-diwall
general-type-to-continue = Skrivit “{ $text }” da genderc'hel ganti.
general-continue = Kenderc'hel
general-red = Ruz
general-orange = Orañjez
general-yellow = Melen
general-green = Gwer
general-teal = Kragell
general-blue = Glas
general-purple = Mouk
general-magenta = Majanta
general-violet = Limestra
general-maroon = Gell
general-gray = Gris
general-black = Du
general-loading = O kargañ...
db-checking-integrity = Checking database integrity…
db-repairing = Repairing database…
citation-style-label = Doare arroudenn:
language-label = Yezh:
menu-custom-group-submenu =
    .label = Muioc'h a arventennoù...
menu-file-show-in-finder =
    .label = Diskouez e Finder
menu-file-show-file =
    .label = Diskouez ar restr
menu-file-show-files =
    .label = Diskouez ar restroù
menu-print =
    .label = { general-print }
menu-density =
    .label = Stankded
add-attachment = Ouzhpennañ ur pezh-stag
new-note = Notenn nevez
menu-add-by-identifier =
    .label = Ouzhpennañ dre anaouader...
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Ouzhpennañ ur restr...
menu-add-standalone-linked-file-attachment =
    .label = Ouzhpennañ ul liamm davet ur restr...
menu-add-child-file-attachment =
    .label = Stagañ ur restr...
menu-add-child-linked-file-attachment =
    .label = Stagañ ul liamm d'ar restr...
menu-add-child-linked-url-attachment =
    .label = Stagañ ul liamm Web...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Notenn dizalc'h nevez
menu-new-item-note =
    .label = Notenn elfenn nevez
menu-restoreToLibrary =
    .label = Adsevel d'al levraoueg
menu-deletePermanently =
    .label = Dilemel da virviken...
menu-tools-plugins =
    .label = Astennoù
menu-view-columns-move-left =
    .label = Dilec'hiañ ar bann a-gleiz
menu-view-columns-move-right =
    .label = Dilec'hiañ ar bann a-zehoù
menu-view-hide-context-annotation-rows =
    .label = Kuzhat an ennotadurioù na glotont ket
menu-view-note-font-size =
    .label = Notenn ment skritur
menu-view-note-tab-font-size =
    .label = Ment an arouezioù en ivinelloù notennoù
menu-show-tabs-menu =
    .label = Diskouez lañser an ivinelloù
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Eilañ { $count } ennotadur
            [two] Eilañ { $count } ennotadur
            [few] Eilañ { $count } ennotadur
            [many] Eilañ { $count } a ennotadurioù
           *[other] Eilañ { $count } a ennotadurioù
        }
main-window-command =
    .label = Levraoueg
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = Listennañ an holl ivinelloù
filter-collections = Silañ an dastumadegoù
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Klask en ivinelloù
zotero-tabs-menu-close-button =
    .title = Serriñ an ivinell
zotero-toolbar-tabs-scroll-forwards =
    .title = Dibunañ war-raok
zotero-toolbar-tabs-scroll-backwards =
    .title = Dibunañ war-gil
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
recently-read = Lennet nevez zo
collections-menu-show-recently-read =
    .label = Diskouez { recently-read }
item-menu-remove-from-recently-read =
    .label = Dilemel diwar { recently-read }…
items-section-collections-selected =
    { $count ->
        [one] { $count } dastumadeg diuzet
        [two] { $count } dastumadeg diuzet
        [few] { $count } a zastumadegoù diuzet
        [many] { $count } a zastumadegoù diuzet
       *[other] { $count } a zastumadegoù diuzet
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
edit-saved-search = Aozañ ar c'hlask enrollet
collections-menu-edit-search =
    .label = Edit Search
collections-menu-duplicate-search =
    .label = Duplicate Search
collections-menu-move-collection =
    .label = Fiñval war-zu
collections-menu-copy-collection =
    .label = Eilañ e
collections-menu-export =
    .label = Ezporzhiañ...
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
    .label = War-draoñ
item-creator-moveToTop =
    .label = Fiñval d'al laez
item-creator-moveUp =
    .label = War-grec'h
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
    .label = Restr
item-menu-add-linked-file =
    .label = Restr liammet
item-menu-add-url =
    .label = Liamm Web
item-menu-change-parent-item =
    .label = Cheñch ar restr gar...
item-menu-relate-items =
    .label = Elfennoù liammet
view-online = Diskouez enlinenn
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Restr adanvet e { $filename }
itembox-button-options =
    .tooltiptext = Digeriñ al lañser kendestenn
itembox-button-merge =
    .aria-label = Diuzañ ur stumm eus ar vaezienn { $field }
create-parent-intro = Skrivit un DOI, ISBN, PMID, arXiv ID, pe ADS Bibcode evit anaout ar restr-mañ:
reader-use-dark-mode-for-content =
    .label = Ober gant ar stumm teñval evit an endalc'had
update-updates-found-intro-minor = Un hizivadur eus { -app-name } a zo hegerz:
update-updates-found-desc = Aliet eo aplikañ an hizivadur-mañ kerkent ha m'eo posupl.
import-window =
    .title = Emporzhiañ
import-where-from = Deus pelec'h ho peus c'hoant emporzhiañ?
import-online-intro-title = Digoradur
import-source-file =
    .label = Ur restr (BibTeX, RIS, Zotero RDF, hag all hag all...)
import-source-folder =
    .label = Un doser gant PDFoù pe restroù all
import-source-online =
    .label = Emporzhiañ enlinenn { $targetApp }
import-options = Dibarzhioù
import-importing = Oc'h emporzhiañ...
import-create-collection =
    .label = Plasit an dastumadegoù hag an teuliadoù emporzhiet e-barzh un dastumadeg nevez
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = Doareoù restroù da emporzhiañ
import-fileTypes-pdf =
    .label = PDFoù
import-fileTypes-other =
    .placeholder = Restroù all war ar patrom, dispartiet gant skejoù (da sk: *.jpg, *.png)
import-file-handling = Meradur ar restroù
import-file-handling-store =
    .label = Eilañ ar restroù e kavlec'h enderc'hel { -app-name }
import-file-handling-link =
    .label = Liammañ d'ar restroù el lec'hiadur orin
import-fileHandling-description = Ar restroù liammet n'hallont ket bezañ sinkronelaet gant { -app-name }.
import-online-new =
    .label = Pellgargañ an elfennoù nevez hepken; na hizivaat an elfennoù emporzhiet kent
import-mendeley-username = Anv-implijer
import-mendeley-password = Ger-tremen
general-error = Fazi
file-interface-import-error = Ur fazi a zo c'hoarvezet en ur glask emporzhiañ ar restr ziuzet. Klaskit gwelet hag-eñ eo ur restr talvoudus ha klaskit en-dro, mar plij.
file-interface-import-complete = Emporzhiañ echuet
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
    .label = Adliammañ arroudennoù Mendeley Desktop
import-online-relink-kb = { general-more-information }
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
tab-title-multiple-collections = Multiple
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } notenn
            [two] { $count } notenn
            [few] { $count } notenn
            [many] { $count } a notennoù
           *[other] { $count } a notennoù
        }
items-column-added-by = Ouzhpennet gant
items-column-modified-by = Kemmet gant
items-column-last-read = Lennet da ziwezhañ
report-error =
    .label = Danevell fazi...
rtfScan-wizard =
    .title = Skan RTF
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. It currently supports citations in variations of the following formats:
rtfScan-introPage-description2 = Evit stagañ ganti, diuzit ur restr RTF enmont hag ur restr ezvont dindan:
rtfScan-input-file = Restr enmont:
rtfScan-output-file = Restr ezvont:
rtfScan-no-file-selected = Restr ebet diuzet
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choaz ur restr enmont
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choaz ur restr ezvont
rtfScan-intro-page = Digoradur
rtfScan-scan-page = Skanañ evit kavout arroudennoù
rtfScan-scanPage-description = { -app-name } zo o skaniñ ho teuliad evit klask arroudennoù. Gortozit mar plij.
rtfScan-citations-page = Gwiriañ an elfennoù arroudennet
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page = Teuliad-aozañ
rtfScan-format-page = Arroudenn-aozañ
rtfScan-format-page-description = { -app-name } a dret hag a bajennaoz ho restr RTF. Gortozit mar plij.
rtfScan-complete-page = Skan RTF klokaet
rtfScan-complete-page-description = Ho teuliad a zo bet skanet ha tretet bremañ. Grit e-seurt da vezañ asur eo bet stummet ez-reizh.
rtfScan-action-find-match =
    .title = Diuzit ur elfenn kenglotus
rtfScan-action-accept-match =
    .title = Degemer an okurañs-mañ
runJS-title = Sekutiñ JavaScript
runJS-editor-label = Kod:
runJS-run = Sevenniñ
runJS-help = { general-help }
runJS-completed = klokaet gant berzh
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Sekutiñ evel ur fonksion async
bibliography-window =
    .title = { -app-name } - Krouiñ un arroudenn/levrlennadur
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Diskouez an arroudennoù evel:
bibliography-advancedOptions-label = Dibarzhioù araokaet
bibliography-outputMode-label = Mod ezvont:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Levrlennadur
bibliography-outputMethod-label = Hentenn ezvont:
bibliography-outputMethod-saveAsRTF =
    .label = Enrollañ dindan ar stumm RTF
bibliography-outputMethod-saveAsHTML =
    .label = Enrollañ dindan ar stumm HTML
bibliography-outputMethod-copyToClipboard =
    .label = Eilañ er golver
bibliography-outputMethod-print =
    .label = Moullañ
bibliography-manageStyles-label = Merañ ar stiloù...
styleEditor-locatorType =
    .aria-label = Doare lec'helaer
styleEditor-locatorInput = Enmont al lec'helaer
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Aozer stil
styleEditor-preview =
    .aria-label = Rakwel
publications-intro-page = Ma Embannadennoù
publications-intro = Elfennoù da ouzhpennañ D'am Embannadennoù hag a vo diskouezet war pajenn ho profil war zotero.org. Ma tibabit enklozañ restroù-stag, lakaet e vint hegerz en un doare foran dindan al lisañs a vo termenet ganeoc'h. Ouzhpennit labourioù a zo bet krouet ganeoc'h hepken, hag enklozit ar restroù ho peus ar gwir rannañ warno hag ho peus c'hoant d'en ober.
publications-include-checkbox-files =
    .label = Enklozañ restroù
publications-include-checkbox-notes =
    .label = Enklozañ notennoù
publications-include-adjust-at-any-time = Gellout a rit keidañ petra diskouez forzh peur diwar Ma dastumadeg Embannadennoù.
publications-intro-authorship =
    .label = Krouet eo bet al labour-se ganin.
publications-intro-authorship-files =
    .label = Krouet eo bet al labour-se ganin hag ar gwir em eus da zasparzhañ ar restroù endalc'het.
publications-sharing-page = Dibabit penaos e rank bezañ rannet ho labour
publications-sharing-keep-rights-field =
    .label = Mirout ar vaezienn Gwirioù a zo anezhi
publications-sharing-keep-rights-field-where-available =
    .label = Mirout ar vaezienn Gwirioù a zo anezhi p'emañ hegerz
publications-sharing-text = Gellout a rit mirout kement gwir d'ho labour, lakaat anezhañ dindan ul lisañs Creative Commons, pe dediet d'an domani foran. E kement degouezh e vo lakaet hegerz en un doare foran dre zotero.org.
publications-sharing-prompt = Ha fellout a rafe deoc'h aotren ar fet ma vefe rannet ho labour gant tud all?
publications-sharing-reserved =
    .label = Ket, embann ma labour war zotero.org hepken
publications-sharing-cc =
    .label = Ya, dindan ul lisañs Creative Commons
publications-sharing-cc0 =
    .label = Ya, ha lakait ma labour en domani foran
publications-license-page = Dibab ul lisañs Creative Commons
publications-choose-license-text = Ul lisañs Creative Commons a ro an aotre da dud all da eilañ ha dasparzhañ ho labour keit ha ma vo roet ganto kreditoù a-zere deoc'h, pourvezet ul liamm davet al lisañs, ha termeniñ m'eo bet degaset cheñchamantoù. Termenoù ouzhpenn a c'hall bezañ termenet dindan.
publications-choose-license-adaptations-prompt = Aotren rannadur azasadurioù ho labour?
publications-choose-license-yes =
    .label = Ya
    .accesskey = Y
publications-choose-license-no =
    .label = Ket
    .accesskey = N
publications-choose-license-sharealike =
    .label = Ya, keit ha ma vez rannet gant ar re all ar memestra
    .accesskey = S
publications-choose-license-commercial-prompt = Aotren implijoù kenwerzhel ho labour?
publications-buttons-add-to-my-publications =
    .label = Ouzhpennañ d'Am Embannadennoù
publications-buttons-next-sharing =
    .label = Da-heul: rannañ
publications-buttons-next-choose-license =
    .label = Dibab ul lisañs
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Lisañs Creative Commons Dereiñ 4.0 Etrebroadel
licenses-cc-by-nd = Lisañs Creative Commons Dereiñ-Stumm-Deveret-Ebet 4.0 Etrebroadel
licenses-cc-by-sa = Lisañs Creative Commons Dereiñ-Rannañ-Evel-M'emañ 4.0 Etrebroadel
licenses-cc-by-nc = Lisañs Creative Commons Dereiñ-Implij-Kenwerzhel-Ebet 4.0 Etrebroadel
licenses-cc-by-nc-nd = Lisañs Creative Commons Dereiñ-Implij-Kenwerzhel Na-StummDeveret-Ebet 4.0 Etrebroadel
licenses-cc-by-nc-sa = Lisañs Creative Commons Dereiñ-Implij-Kenwerzhel-Ebet-Rannañ-Evel-M'emañ 4.0 Etrebroadel
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Adloc'hañ er mod diveugiñ...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Stankded
menu-ui-density-comfortable =
    .label = Klet
menu-ui-density-compact =
    .label = Stank
pane-item-details = Munudoù an elfenn
pane-info = Titou.
pane-abstract = Berradenn
pane-attachments = Pezhioù-stag
pane-notes = Notennoù
pane-note-info = Titouroù an notenn
pane-libraries-collections = Levraouegoù ha dastumadegoù
pane-tags = Balizoù
pane-related = Kevreet
pane-attachment-info = Titouroù ar stagadenn
pane-attachment-preview = Rakwel
pane-attachment-annotations = Ennotadurioù
pane-header-attachment-associated =
    .label = Adenvel ar restr kevelet
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } pezhioù-stag
            [two] { $count } bezh-stag
            [few] { $count } a bezhioù-stag
            [many] { $count } a bezhioù-stag
           *[other] { $count } a bezhioù-stag
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } ennotadur
            [two] { $count } ennotadur
            [few] { $count } ennotadur
            [many] { $count } a ennotadurioù
           *[other] { $count } a ennotadurioù
        }
section-attachments-move-to-trash-message = Ha fellout a ra deoc'h kas “{ $title }” d'ar pod-lastez?
section-notes =
    .label =
        { $count ->
            [one] { $count } notenn
            [two] { $count } notenn
            [few] { $count } notenn
            [many] { $count } a notennoù
           *[other] { $count } a notennoù
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } diketenn
            [two] { $count } diketenn
            [few] { $count } a diketennoù
            [many] { $count } a diketennoù
           *[other] { $count } a diketennoù
        }
section-related =
    .label = { $count } liammet
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Brasaat ar gevrenn
    .label = Brasaat ar gevrenn { $section }
section-button-collapse =
    .dynamic-tooltiptext = Bihanañ ar gevrenn
    .label = Bihanaat ar gevrenn { $section }
annotations-count =
    { $count ->
        [one] { $count } ennotadur
        [two] { $count } ennotadur
        [few] { $count } ennotadur
        [many] { $count } a ennotadurioù
       *[other] { $count } a ennotadurioù
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
    .label = Dilec'hiañ war-grec'h ar gevrenn
sidenav-reorder-down =
    .label = Dilec'hiañ war-draoñ ar gevrenn
sidenav-reorder-reset =
    .label = Adderaouiñ urzh ar c'hevrennoù
toggle-item-pane =
    .tooltiptext = Diskouez/kuzhat panell an elfennoù
toggle-context-pane =
    .tooltiptext = Diskouez/kuzhat ar banell gendestenn
pin-section =
    .label = Spilhennañ ar gevrenn
unpin-section =
    .label = Dispilhennañ ar gevrenn
collapse-other-sections =
    .label = Bihanaat ar c'hevrennoù all
expand-all-sections =
    .label = Brasaat an holl gevrennoù
abstract-field =
    .placeholder = Ozhpennañ un diverradenn...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Silañ an tikedennoù
context-notes-search =
    .placeholder = Klask en notennoù
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Dastumadeg nevez...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Dastumadeg nevez
    .buttonlabelaccept = Krouiñ un dastumadeg
new-collection-name = Anv:
new-collection-create-in = Krouiñ e:
show-publications-menuitem =
    .label = Diskouez ma embannadennoù
attachment-info-title = Titl
attachment-info-filename = Anv ar restr
attachment-info-accessed = Gwelet d'an/ar/al
attachment-info-pages = Pajennoù
attachment-info-modified = Deiziad kemmañ
attachment-info-index = Indekset
attachment-info-convert-note =
    .label =
        Migrate to { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } Note
    .tooltiptext = Adding notes to attachments is no longer supported, but you can edit this note by migrating it to a separate note.
section-note-info =
    .label = { pane-note-info }
note-info-title = Titl
note-info-parent-item = Elfenn gar
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
note-info-date-created = Krouet
note-info-date-modified = Deiziad kemmañ
note-info-size = Ment
note-info-word-count = Niver a c'herioù
note-info-character-count = Niver a arouezioù
item-title-empty-note = Notenn hep-titl
attachment-preview-placeholder = Stagadenn ebet da rakwelet
attachment-rename-from-parent =
    .tooltiptext = Adenvel ar restr evit kenglotañ gant an elfenn gar
account-log-in = Kevreañ
account-not-logged-in-text = Kevreañ ouzh ho kont Zotero evit sinkronelaat ho roadennoù.
account-error-login-session-expired = Ho talc'h zo diamzeriet. Klaskit en-dro, mar plij.
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } Attachment Preview
annotation-image-not-available = [Skeudenn dihegerz]
quicksearch-mode =
    .aria-label = Mod enklask prim
quicksearch-input =
    .aria-label = Enklask prim
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
advanced-search = Enklaskoù araokaet
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
    .label = Gwelet evel
item-pane-header-none =
    .label = Hini ebet
item-pane-header-title =
    .label = Titl
item-pane-header-titleCreatorYear =
    .label = Titl, Krouer, Bloavezh
item-pane-header-bibEntry =
    .label = Enmont levrlennadur
item-pane-header-more-options =
    .label = Muioc'h a zibarzhioù
item-pane-message-items-selected =
    { $count ->
        [0] No items selected
        [one] { $count } item selected
       *[other] { $count } items selected
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } dastumadeg diuzet
        [two] { $count } dastumadeg diuzet
        [few] { $count } a zastumadegoù diuzet
        [many] { $count } a zastumadegoù diuzet
       *[other] { $count } a zastumadegoù diuzet
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } enklask diuzet
        [two] { $count } enklask diuzet
        [few] { $count } a enklaskoù diuzet
        [many] { $count } a enklaskoù diuzet
       *[other] { $count } a enklaskoù diuzet
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } objed diuzet
        [two] { $count } objed diuzet
        [few] { $count } objed diuzet
        [many] { $count } a objedoù diuzet
       *[other] { $count } a objedoù diuzet
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
            [one] Kendeuziñ { $count } elfenn
            [two] Kendeuziñ { $count } elfenn
            [few] Kendeuziñ { $count } elfenn
            [many] Kendeuziñ { $count } a elfennoù
           *[other] Kendeuziñ { $count } a elfennoù
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = Switch to 64-bit { -app-name } for the best performance. Your data won’t be affected.
architecture-warning-action = Pellgargañ stumm 64-bit { -app-name }
architecture-x64-on-arm64-message = { -app-name } is running in emulated mode. A native version of { -app-name } will run more efficiently.
architecture-x64-on-arm64-action = Pellgargañ { -app-name } evit ARM64
first-run-guidance-authorMenu = { -app-name } lets you specify editors and translators too. You can turn an author into an editor or translator by selecting from this menu.
first-run-guidance-readAloud = { -app-name } can now read your documents to you using natural-sounding voices.
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
    .value = Kavout
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
    .label = ennotadurioù
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
    .aria-label = Koñdision an enklask
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operataer
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Talvoudegezh
    .label = { $label }
search-operator-isEmpty = is empty
search-operator-isNotEmpty = is not empty
search-conditions-tooltip-fields = Maeziennoù:
search-conditions-collection = Dastumadeg
search-conditions-savedSearch = Enklask enrollet
search-conditions-itemTypeID = Doare elfenn
search-conditions-tag = Baliz
search-conditions-numTags = # of Tags
search-conditions-numNotes = # of Notes
search-conditions-numAttachments = # of Attachments
search-conditions-numAnnotations = # of Annotations
search-conditions-note = Notenn
search-conditions-childNote = Notenn bugel
search-conditions-creator = Krouer
search-conditions-thesisType = Doare tezenn
search-conditions-reportType = Doare danevell
search-conditions-videoRecordingFormat = Stumm enrollañ video
search-conditions-audioFileType = Doare restr aodio
search-conditions-audioRecordingFormat = Stumm enrollañ aodio
search-conditions-letterType = Doare lizher
search-conditions-interviewMedium = Atersadenn etre
search-conditions-manuscriptType = Doare dornskrid
search-conditions-presentationType = Doare kinnigadenn
search-conditions-mapType = Doare kartenn
search-conditions-artworkMedium = Skeudennadur etre
search-conditions-dateModified = Deiziad kemmañ
search-conditions-fulltextContent = Endalc'had ar pezh-stag
search-conditions-programmingLanguage = Langaj programiñ
search-conditions-fileTypeID = Doare restr-stag
search-conditions-attachmentStorageType = Attachment Storage Type
search-conditions-lastRead = Stagadenn ziwezhañ bet lennet
search-conditions-annotationText = Testenn ennotadur
search-conditions-annotationComment = Evezhiadenn an ennotadur
search-conditions-annotationType = Annotation Type
search-conditions-annotationColor = Annotation Color
search-conditions-annotationAuthor = Annotation Author
search-conditions-anyField = Froud ebet
search-conditions-titleCreatorYear = Titl, Krouer, Bloavezh
search-conditions-submenu-attachment = Pezh-stag
search-conditions-submenu-annotation = Ennotadur
search-conditions-short-fulltextContent = Content
search-conditions-short-fileTypeID = Doare restr
search-conditions-short-attachmentStorageType = Storage Type
search-conditions-short-lastRead = Lennet da ziwezhañ
search-conditions-short-annotationText = Text
search-conditions-short-annotationComment = Comment
search-conditions-short-annotationType = Doare
search-conditions-short-annotationColor = Color
search-conditions-short-annotationAuthor = Aozer
find-pdf-files-added =
    { $count ->
        [one] { $count } restr ouzhpennet
        [two] { $count } restr ouzhpennet
        [few] { $count } restr ouzhpennet
        [many] { $count } a restroù ouzhpennet
       *[other] { $count } a restroù ouzhpennet
    }
select-items-window =
    .title = Diuzañ elfennoù
select-items-dialog =
    .buttonlabelaccept = Diuzañ
select-items-convertToStandalone =
    .label = Emdreiñ en un elfenn emren
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Emdreiñ en ur pezh-stag emren
            [two] Emdreiñ e pezhioù-stag emren
            [few] Emdreiñ e pezhioù-stag emren
            [many] Emdreiñ e pezhioù-stag emren
           *[other] Emdreiñ e pezhioù-stag emren
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Emdreiñ en un notenn emren
            [two] Emdreiñ e notennoù emren
            [few] Emdreiñ e notennoù emren
            [many] Emdreiñ e notennoù emren
           *[other] Emdreiñ e notennoù emren
        }
file-type-webpage = Pajenn web
file-type-image = Skeudenn
file-type-pdf = PDF
file-type-audio = Aodio
file-type-video = Video
file-type-presentation = Kinnigadenn
file-type-document = Teuliad
file-type-ebook = Levr elektronek
attachment-storage-type-storedFile = Stored File
attachment-storage-type-linkedFile = Linked File
attachment-storage-type-webLink = Web Link
post-upgrade-message = Bez ho peus hizivaet <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Dizoloit petra zo <a data-l10n-name="new-features-link">nevez</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Pegañ ha klask
mac-word-plugin-install-message = Zotero en deus da haeziñ ouzh ho roadennoù Word evit gellout staliañ an astenn Word.
mac-word-plugin-install-folder-message = { -app-name } needs access to Word’s startup folder to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = Staliañ an astenn Word
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Install the plugin in the Word startup folder
mac-word-plugin-install-folder-dialog-button = Staliañ
mac-word-plugin-install-wrong-folder-selected = The suggested folder must be selected. Please try again without choosing a different folder.
file-renaming-banner-message = { -app-name } now automatically keeps attachment filenames in sync as you make changes to items.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = The { -app-name } Connector must be updated to work with this version of { -app-name }.
userjs-pref-warning = Some { -app-name } settings have been overridden using an unsupported method. { -app-name } will revert them and restart.
migrate-extra-fields-progress-message = Migrating new fields from Extra field
search-normalization-progress-message = Indexing items for search
long-tag-fixer-window-title =
    .title = Rannañ an tikedennoù
long-tag-fixer-button-dont-split =
    .label = Na rannañ
menu-normalize-attachment-titles =
    .label = Normalizañ titloù ar stagadennoù...
normalize-attachment-titles-title = Normalizañ titloù ar stagadennoù
normalize-attachment-titles-text =
    { -app-name } automatically renames files on disk using parent item metadata, but it uses separate, simpler titles such as “Full Text PDF”, “Preprint PDF”, or “PDF” for primary attachments to keep the items list cleaner and avoid duplicating information.
    
    In older versions of { -app-name }, as well as when using certain plugins, attachment titles could be changed unnecessarily to match the filenames.
    
    Would you like to update the selected attachments to use simpler titles? Only primary attachments with titles that match the filename will be changed.
banner-close-button =
    .aria-label = Na ober van eus ar c'hemennoù
plugins-blocked-plugin =
    .message = Lazhet eo bet an astenn-mañ gant { -app-name }.
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
    .label = Klask
save-search-new-button =
    .label = Save Search…
save-search-edit-button =
    .label = Enrollañ
save-search-name-title = Enrollañ an enklask
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
undo-action-rename-collection = Adenvel an dastumadeg
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
undo-action-edit-note = Aozañ an notenn
undo-action-add-creator = Add Creator
undo-action-remove-creator = Remove Creator
undo-action-edit-creator = Edit Creator
undo-action-reorder-creator = Reorder Creator
undo-action-change-type = Cheñch an doare teuliad
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
