general-sentence-separator = { " " }
general-key-control = Ctrl
general-key-shift = Shift
general-key-alt = Alt
general-key-option = Možnost
general-key-command = Příkaz
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
general-print = Tisknout
general-remove = Odstranit
general-add = Přidat
general-remind-me-later = Připomenout později
general-dont-ask-again = Znovu se již neptat
general-choose-file = Vybrat soubor...
general-open-settings = Otevřít nastavení
general-settings = Settings…
general-help = Pomoc
general-tag = Štítek
general-done = Hotovo
general-view-troubleshooting-instructions = Zobrazit pokyny k řešení problémů
general-go-back = Vrátit zpět
general-accept = Accept
general-cancel = Zrušit
general-show-in-library = Ukázat v knihovně
general-restartApp = Restart { -app-name }
general-restartInTroubleshootingMode = Restartovat v režimu řešení problémů
general-save = Uložit
general-clear = Vyčistit
general-update = Aktualizovat
general-back = Zpátky
general-edit = Upravit
general-cut = Vyjmout
general-copy = Kopírovat
general-paste = Vložit
general-find = Najít
general-delete = Smazat
general-insert = Vložit
general-and = a
general-et-al = et al.
general-previous = Předchozí
general-next = Následující
general-learn-more = Zjistit více
general-warning = Varování
general-type-to-continue = Type “{ $text }” to continue.
general-continue = Pokračovat
general-red = Červená
general-orange = Oranžová
general-yellow = Žlutá
general-green = Zelená
general-teal = Petrolejová
general-blue = Modrá
general-purple = Fialová
general-magenta = Magenta
general-violet = Fialová
general-maroon = Kaštanová
general-gray = Šedá
general-black = Černá
citation-style-label = Citační styl:
language-label = Jazyk:
menu-custom-group-submenu =
    .label = More Options…
menu-file-show-in-finder =
    .label = Zobrazit v hledači
menu-file-show-file =
    .label = Zobrazit soubor
menu-file-show-files =
    .label = Zobrazit soubory
menu-print =
    .label = { general-print }
menu-density =
    .label = Hustota
add-attachment = Přidat přílohu
new-note = Nová poznámka
menu-add-by-identifier =
    .label = Přidat podle identifikátoru
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Přidat soubor...
menu-add-standalone-linked-file-attachment =
    .label = Přidat odkaz na soubor...
menu-add-child-file-attachment =
    .label = Připojit soubor...
menu-add-child-linked-file-attachment =
    .label = Přiložit odkaz na soubor...
menu-add-child-linked-url-attachment =
    .label = Připojit webový odkaz...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nová samostatná poznámka
menu-new-item-note =
    .label = Přidat poznámku k položce
menu-restoreToLibrary =
    .label = Obnovit do knihovny
menu-deletePermanently =
    .label = Definitivně smazat...
menu-tools-plugins =
    .label = Rozšíření
menu-view-columns-move-left =
    .label = Přesunout sloupce vlevo
menu-view-columns-move-right =
    .label = Přesunout sloupce vpravo
menu-view-note-font-size =
    .label = Velikost písma poznámek
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
    .label = Knihovna
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = Seznam všech záložek
filter-collections = Filtrovat kolekce
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Hledat v záložkách
zotero-tabs-menu-close-button =
    .title = Zavřít záložku
zotero-toolbar-tabs-scroll-forwards =
    .title = Scroll forwards
zotero-toolbar-tabs-scroll-backwards =
    .title = Scroll backwards
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Přejmenovat kolekci
collections-menu-edit-saved-search =
    .label = Editovat Uložené hledání
collections-menu-move-collection =
    .label = Přesunout do
collections-menu-copy-collection =
    .label = Kopírovat do
item-creator-moveDown =
    .label = Posunout dolů
item-creator-moveToTop =
    .label = Přesunout nahoru
item-creator-moveUp =
    .label = Posunout nahoru
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
    .label = Soubor
item-menu-add-linked-file =
    .label = Připojený soubot
item-menu-add-url =
    .label = Webový odkaz
item-menu-change-parent-item =
    .label = Změnit nadřazenou položku...
item-menu-relate-items =
    .label = Relate Items
view-online = Zobrazit online
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Soubor přejmenován na { $filename }
itembox-button-options =
    .tooltiptext = Otevřít kontextovou nabídku
itembox-button-merge =
    .aria-label = Zvolte verzi pole { $field }
create-parent-intro = Pro identifikaci tohoto souboru zadejte DOI, ISBN, PMID, arXiv ID nebo ADS Bibcode:
reader-use-dark-mode-for-content =
    .label = Použít tmavý vzhled pro obsah
update-updates-found-intro-minor = Je k dispozici aktualizace { -app-name }:
update-updates-found-desc = Doporučujeme použít tuto aktualizaci co nejdříve.
import-window =
    .title = Importovat
import-where-from = Odkud chcete importovat?
import-online-intro-title = Představení
import-source-file =
    .label = Soubor (BibTeX, RIS, Zotero RDF, atd.)
import-source-folder =
    .label = Složka PDF či jiných souborů
import-source-online =
    .label = { $targetApp } online import
import-options = Možnosti
import-importing = Importuje...
import-create-collection =
    .label = Umístit importované kolekce a položky do nové kolekce
import-recreate-structure =
    .label = Znovu vytvořit strukturu složek jako kolekce
import-fileTypes-header = Typy souborů k importu:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Ostatní soubory podle vzoru, oddělené čárkou (např. *.jpg, *.png)
import-file-handling = Zpracování souborů
import-file-handling-store =
    .label = Kopírovat soubory do složky úložiště { -app-name }
import-file-handling-link =
    .label = Propojit se soubory v původním umístění
import-fileHandling-description = Propojené soubory nelze synchronizovat pomocí { -app-name }.
import-online-new =
    .label = Stáhnout pouze nové položky; neaktulizovat dříve importované položky
import-mendeley-username = Uživatelské jméno
import-mendeley-password = Heslo
general-error = Chyba
file-interface-import-error = Při importu vybraného souboru došlo k chybě. Přesvědčte se, prosím, že je soubor v pořádku, a zkuste import znovu.
file-interface-import-complete = Import dokončen
file-interface-items-were-imported =
    { $numItems ->
        [0] Žádná položka nebyla importovaná
        [one] Jedna položka byla importovaná
       *[other] { $numItems } položek bylo importováno
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Žádné položky nebyly znovu propojeny
        [one] Jedna položka byla znovu propojena
       *[other] { $numRelinked } položky byly znovu propojeny
    }
import-mendeley-encrypted = Vybranou databázi Mendeley nelze přečíst, pravděpodobně proto, že je zašifrovaná. Viz <a data-l10n-name="mendeley-import-kb">Jak naimportuji knihovnu Mendeley do Zotero?</a> pro další informace.
file-interface-import-error-translator = Při importu vybraného souboru pomocí “{ $translator }” došlo k chybě. Přesvědčte se, prosím, že je soubor v pořádku, a zkuste import znovu.
import-online-intro = V dalším kroku budete vyzváni, abyste se přihlásili do { $targetAppOnline } a povolili { -app-name } přístup. Je to nutné pro import vaší knihovny  { $targetApp } do { -app-name }.
import-online-intro2 = { -app-name } nikdy neuvidí ani neuloží vaše heslo pro { $targetApp }.
import-online-form-intro = Zadejte prosím své přihlašovací údaje a přihlaste se k { $targetAppOnline }. Je to nutné pro import vaší knihovny  { $targetApp } do  { -app-name }.
import-online-wrong-credentials = Přihlášení do { $targetApp } se nezdařilo. Zadejte prosím znovu přihlašovací údaje a zkuste to znovu.
import-online-blocked-by-plugin = Import nemůže pokračovat, pokud je nainstalován { $plugin }. Vypněte prosím tento doplněk a zkuste to znovu.
import-online-relink-only =
    .label = Znovu propojit citace Mendeley Desktop
import-online-relink-kb = Více informací
import-online-connection-error = { -app-name } se nepodařilo připojit k { $targetApp }. Zkontrolujte prosím své internetové připojení a zkuste to znovu.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } poznámka
            [few] { $count } poznámky
            [many] { $count } poznámek
           *[other] { $count } poznámek
        }
report-error =
    .label = Zpráva o chybě...
rtfScan-wizard =
    .title = Prohledávání  RTF
rtfScan-introPage-description = { -app-name } dokáže automaticky extrahovat a přeformátovat citace a vložit bibliografii do souborů RTF. V současné době podporuje citace ve variantách následujících formátů:
rtfScan-introPage-description2 = Začnete vybráním RTF vstupního souboru a výstupního souboru níže:
rtfScan-input-file = Vstupní soubor:
rtfScan-output-file = Výstupní soubor:
rtfScan-no-file-selected = Nebyl vybrán žádný soubor
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Vybrat vstupní soubor
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Vybrat výstupní soubor
rtfScan-intro-page = Představení
rtfScan-scan-page = Vyhledávají se citace
rtfScan-scanPage-description = { -app-name } hledá citace v dokumentu. Buďte prosím trpěliví.
rtfScan-citations-page = Ověřit citované položky
rtfScan-citations-page-description = Projděte si prosím níže uvedený seznam rozpoznaných citací, abyste se ujistili, že { -app-name } správně vybral odpovídající položky. Případné nezmapované nebo nejednoznačné citace je třeba před přechodem k dalšímu kroku vyřešit.
rtfScan-style-page = Formátování dokumentu
rtfScan-format-page = Formátování citací
rtfScan-format-page-description = { -app-name } zpracovává a formátuje váš soubor RTF. Buďte prosím trpěliví.
rtfScan-complete-page = Prohledávání RTF ukončeno
rtfScan-complete-page-description = Váš dokument byl prohledán a zpracován. Prosím, ujistěte se, že je korektně naformátován.
rtfScan-action-find-match =
    .title = Vyberte odpovídající položku
rtfScan-action-accept-match =
    .title = Přijmout tuto shodu
runJS-title = Spustit JavaScript
runJS-editor-label = Kód:
runJS-run = Spustit
runJS-help = { general-help }
runJS-completed = completed successfully
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Spustit jako asynchronní funkci
bibliography-window =
    .title = { -app-name } - Vytvořit citaci/bibliografii
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Zobrazit citace jako:
bibliography-advancedOptions-label = Pokročilé možnosti
bibliography-outputMode-label = Výstupní režim:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliografie
bibliography-outputMethod-label = Výstupní metoda:
bibliography-outputMethod-saveAsRTF =
    .label = Uložit jako RTF
bibliography-outputMethod-saveAsHTML =
    .label = Uložit jako HTML
bibliography-outputMethod-copyToClipboard =
    .label = Kopírovat do schránky
bibliography-outputMethod-print =
    .label = Tisknout
bibliography-manageStyles-label = Správa stylů...
styleEditor-locatorType =
    .aria-label = Typ lokátoru
styleEditor-locatorInput = Vstup lokátoru
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Editor stylů
styleEditor-preview =
    .aria-label = Náhled
publications-intro-page = Mé publikace
publications-intro = Položky přidané do Mých publikací budou zobrazeny na stránce vašeho profilu na zotero.org. Pokud zvolíte, že chcete zahrnout připojené soubory, budou tyto soubory veřejně dostupné pod licencí, kterou určíte. Přidávejte pouze díla, která jste sami vytvořili a zahrňte pouze ty připojené soubory, které chcete šířit a máte k tomu oprávnění.
publications-include-checkbox-files =
    .label = Zahrnout soubory
publications-include-checkbox-notes =
    .label = Zahrnout poznámky
publications-include-adjust-at-any-time = Můžete upřesnit, co se bude zobrazovat z kolekce Mé publikace.
publications-intro-authorship =
    .label = Vytvořil jsem tuto práci.
publications-intro-authorship-files =
    .label = Vytvořil jsem tuto práci a mám právo na distribuci připojených souborů.
publications-sharing-page = Vyberte, jak má být vaše práce sdílena
publications-sharing-keep-rights-field =
    .label = Zachovat stávající pole Práva
publications-sharing-keep-rights-field-where-available =
    .label = Zachovat stávající pole Práva pokud je k dispozici
publications-sharing-text = Můžete si vyhradit všechna práva ke svému dílu, licencovat jej pod licencí Creative Commons nebo je věnovat veřejné doméně. Ve všech případech bude dílo veřejně k dispozici prostřednictvím zotero.org
publications-sharing-prompt = Umožníte sdílení vaší práce jinými?
publications-sharing-reserved =
    .label = Ne, publikovat jen na zotero.org
publications-sharing-cc =
    .label = Ano, pod licencí Creative Commons
publications-sharing-cc0 =
    .label = Ano, a umísti mé práce do veřejného prostoru
publications-license-page = Vyberte licenci Creative Commons
publications-choose-license-text = Licence Creative Commons umožňuje ostatním kopírovat a šířit vaše dílo za předpokladu, že sdělí odpovídající údaje o původu díla, poskytnou odkaz na licenci a uvedou, zda byly provedeny nějaké změny. Další podmínky mohou být upřesněny  níže.
publications-choose-license-adaptations-prompt = Povolit úpravy a sdílení vašeho díla?
publications-choose-license-yes =
    .label = Ano
    .accesskey = Y
publications-choose-license-no =
    .label = Ne
    .accesskey = N
publications-choose-license-sharealike =
    .label = Ano, pokud jej ostatní budou sdílet pod srovnatelnou licencí
    .accesskey = S
publications-choose-license-commercial-prompt = Povolit komerční použití vaší práce?
publications-buttons-add-to-my-publications =
    .label = Přidat do Mých publikací
publications-buttons-next-sharing =
    .label = Další: Sdílení
publications-buttons-next-choose-license =
    .label = Vyberte licenci
licenses-cc-0 = CC0 1.0 Volné dílo. Nejširší možné užití díla i bez uvedení autorství
licenses-cc-by = Creative Commons Uveďte původ 4.0 Mezinárodní License.
licenses-cc-by-nd = Creative Commons Uveďte původ-Nezpracovávejte 4.0 Mezinárodní License
licenses-cc-by-sa = Creative Commons Uveďte původ-Zachovejte licenci 4.0 Mezinárodní License
licenses-cc-by-nc = Creative Commons Uveďte původ-Neužívejte komerčně 4.0 Mezinárodní License
licenses-cc-by-nc-nd = Creative Commons Uveďte původ-Neužívejte komerčně-Nezpracovávejte 4.0 Mezinárodní License
licenses-cc-by-nc-sa = Creative Commons Uveďte původ-Neužívejte dílo komerčně-Zachovejte licenci 4.0 Mezinárodní License
licenses-cc-more-info = Ujistěte se, že jste si přečetli nápovědu Creative Commons <a data-l10n-name="license-considerations"> pro poskytovatele licencí </a> před zveřejněním vaší práce pod licencí CC. Berte v potaz, že licenci nelze odvolat, i když později změníte podmínky nebo zakážete zveřejnění díla.
licenses-cc0-more-info = Ujistěte se, že jste si přečetli  <a data-l10n-name="license-considerations"> časté dotazy týkající se Creative Commons</a>, před zveřejněním vašeho díla s licencí CC0. Uvědomte si, že věnování vašeho díla do veřejného vlastnictví je nevratné, a to i v případě, že později zvolíte jiné podmínky nebo dílo přestanete publikovat.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Restartovat v režimu řešení problémů...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } restartuje se s vypnutými zásuvnými moduly. Některé funkce nemusí fungovat správně, pokud je povolen režim řešení problémů.
menu-ui-density =
    .label = Hustota
menu-ui-density-comfortable =
    .label = Komfortní
menu-ui-density-compact =
    .label = Kompaktní
pane-item-details = Podrobnosti položky
pane-info = Informace
pane-abstract = Abstrakt
pane-attachments = Přílohy
pane-notes = Poznámky
pane-note-info = Note Info
pane-libraries-collections = Knihovny a kolekce
pane-tags = Štítky
pane-related = Související
pane-attachment-info = Informace o příloze
pane-attachment-preview = Náhled
pane-attachment-annotations = Anotace
pane-header-attachment-associated =
    .label = Přejmenovat asociovaný soubor
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } příloha
            [few] { $count } přílohy
            [many] { $count } příloh
           *[other] { $count } příloh
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } anotace
            [few] { $count } anotace
            [many] { $count } anotací
           *[other] { $count } anotace
        }
section-attachments-move-to-trash-message = Are you sure you want to move “{ $title }” to the trash?
section-notes =
    .label =
        { $count ->
            [one] { $count } poznámka
            [few] { $count } poznámky
            [many] { $count } poznámek
           *[other] { $count } poznámek
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } štítek
            [few] { $count } štítky
            [many] { $count } štítků
           *[other] { $count } štítků
        }
section-related =
    .label = { $count } související
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Rozbalit sekci
    .label = Rozbalit { $section } sekci
section-button-collapse =
    .dynamic-tooltiptext = Sbalit sekci
    .label = Sbalit  { $section } sekci
annotations-count =
    { $count ->
        [one] { $count } anotace
        [few] { $count } anotace
        [many] { $count } anotací
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
    .tooltiptext = Přepnout kontextový panel
pin-section =
    .label = Přišpendlit sekci
unpin-section =
    .label = Zrušit přišpendlení sekce
collapse-other-sections =
    .label = Sbalit ostatní sekce
expand-all-sections =
    .label = Rozbalit všechny sekce
abstract-field =
    .placeholder = Přidat abstrakt...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtrovat štítky
context-notes-search =
    .placeholder = Vyhledávat v poznámkách
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Nová kolekce...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Nová kolekce
    .buttonlabelaccept = Vytvořit kolekci
new-collection-name = Jméno:
new-collection-create-in = Vytvořit v:
show-publications-menuitem =
    .label = Show My Publications
attachment-info-title = Název
attachment-info-filename = Název souboru
attachment-info-accessed = Přistoupeno
attachment-info-pages = Stránky
attachment-info-modified = Upraveno
attachment-info-index = Indexováno
attachment-info-convert-note =
    .label =
        Změnit na { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } poznámku
    .tooltiptext = Přidávání poznámek k přílohám již není podporováno, ale tuto poznámku můžete upravit tak, že ji přenesete do samostatné poznámky.
section-note-info =
    .label = { pane-note-info }
note-info-title = Název
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
note-info-date-modified = Upraveno
note-info-size = Velikost
note-info-word-count = Word Count
note-info-character-count = Character Count
item-title-empty-note = Nepojmenovaná poznámka
attachment-preview-placeholder = Žádná příloha k náhledu
attachment-rename-from-parent =
    .tooltiptext = Rename File to Match Parent Item
file-renaming-auto-rename-prompt-title = Renaming Settings Changed
file-renaming-auto-rename-prompt-body = Would you like to rename existing files in your library to match the new settings?
file-renaming-auto-rename-prompt-yes = Preview Changes…
file-renaming-auto-rename-prompt-no = Keep Existing Filenames
rename-files-preview =
    .buttonlabelaccept = Rename Files
rename-files-preview-loading = Nahrává se...
rename-files-preview-intro = { -app-name } will rename the following files in your library to match their parent items:
rename-files-preview-renaming = Renaming…
rename-files-preview-no-files = All filenames already match parent items. No changes are required.
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } Attachment Preview
annotation-image-not-available = [Image not available]
quicksearch-mode =
    .aria-label = Režim rychlého vyhledávání
quicksearch-input =
    .aria-label = Rychlé hledání
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Zobrazit jako
item-pane-header-none =
    .label = Žádná
item-pane-header-title =
    .label = Název
item-pane-header-titleCreatorYear =
    .label = Název, Tvůrce, Rok
item-pane-header-bibEntry =
    .label = Položka bibliografie
item-pane-header-more-options =
    .label = Další možnosti
item-pane-message-items-selected =
    { $count ->
        [0] Žádné vybrané položky
        [one] { $count } vybraná položka
       *[other] { $count } vybraných položek
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } kolekce vybrána
        [few] { $count } kolekce vybrány
        [many] { $count } kolekce vybrány
       *[other] { $count } kolekce vybrány
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } hledání vybráno
        [few] { $count } hledání vybrány
        [many] { $count } hledání vybráno
       *[other] { $count } hledání vybráno
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } objektů vybráno
        [few] { $count } objekty vybrány
        [many] { $count } objektů vybráno
       *[other] { $count } objektů vybráno
    }
item-pane-message-unselected =
    { $count ->
        [0] V tomto zobrazení nejsou žádné položky
        [one] { $count } položka v tomto zobrazení
       *[other] { $count } položek v tomto zobrazení
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] V tomto zobrazení nejsou žádné objekty
        [one] { $count } objekt v tomto zobrazení
       *[other] { $count } objektů v tomto zobrazení
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Sloučit { $count } položku
            [few] Sloučit { $count } položky
            [many] Sloučit { $count } položek
           *[other] Sloučit { $count } položky
        }
locate-library-lookup-no-resolver = Musíte si vybrat resolver z { $pane } panelu nastavení { -app-name }.
architecture-win32-warning-message = Pro dosažení nejlepšího výkonu přepněte na 64bitové { -app-name }. Vaše data nebudou ovlivněna.
architecture-warning-action = Stáhnout 64bitové { -app-name }
architecture-x64-on-arm64-message = { -app-name } běží v emulovaném režimu. Nativní verze { -app-name } poběží efektivněji.
architecture-x64-on-arm64-action = Stáhnout { -app-name } pro ARM64
first-run-guidance-authorMenu = { -app-name } umožňuje zadat také editory a překladatele. Výběrem z této nabídky můžete z autora udělat editora nebo překladatele.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Vyhledávací podmínka
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operátor
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Hodnota
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] { $count } soubor přidán
        [few] { $count } soubory přidány
        [many] { $count } souborů přidáno
       *[other] { $count } souborů přidáno
    }
select-items-window =
    .title = Označit položky
select-items-dialog =
    .buttonlabelaccept = Vybrat
select-items-convertToStandalone =
    .label = Převést na samostatnou
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Převést na samostatnou přílohu
            [few] Převést na samostatné přílohy
            [many] Převést na samostatné přílohy
           *[other] Převést na samostatné přílohy
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Převést na samostatnou poznámku
            [few] Převést na samostatné poznámky
            [many] Převést na samostatné poznámky
           *[other] Převést na samostatné poznámky
        }
file-type-webpage = Webová stránka
file-type-image = Obrázek
file-type-pdf = PDF
file-type-audio = Audio
file-type-video = Video
file-type-presentation = Prezentace
file-type-document = Dokument
file-type-ebook = E-kniha
post-upgrade-message = You’ve been upgraded to <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Learn about <a data-l10n-name="new-features-link">what’s new</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Vložit a vyhledat
mac-word-plugin-install-message = K instalaci doplňku pro Word potřebuje Zotero přístup k datům Wordu.
mac-word-plugin-install-action-button =
    .label = Instalovat doplněk pro Word
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
