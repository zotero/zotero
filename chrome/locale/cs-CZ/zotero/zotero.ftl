general-print = Tisknout
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Odstranit
general-add = Přidat
general-remind-me-later = Připomenout později
general-choose-file = Vybrat soubor...
general-open-settings = Otevřít nastavení
general-help = Pomoc
general-tag = Tag
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
main-window-command =
    .label = { -app-name }
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
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Přejmenovat kolekci
collections-menu-edit-saved-search =
    .label = Editovat Uložené hledání
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
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
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
view-online = Zobrazit online
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = File renamed to { $filename }
itembox-button-options =
    .tooltiptext = Otevřít kontextovou nabídku
itembox-button-merge =
    .aria-label = Zvolte verzi pole { $field }
create-parent-intro = Enter a DOI, ISBN, PMID, arXiv ID, or ADS Bibcode to identify this file:
reader-use-dark-mode-for-content =
    .label = Use Dark Mode for Content
update-updates-found-intro-minor = An update for { -app-name } is available:
update-updates-found-desc = It is recommended that you apply this update as soon as possible.
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
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Zpracování souborů
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Propojit se soubory v původním umístění
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Stáhnout pouze nové položky; neaktulizovat dříve importované položky
import-mendeley-username = Uživatelské jméno
import-mendeley-password = Heslo
general-error = Chyba
file-interface-import-error = Při importu vybraného souboru došlo k chybě. Přesvědčte se, prosím, že je soubor v pořádku, a zkuste import znovu.
file-interface-import-complete = Import dokončen
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
    .label = Relink Mendeley Desktop citations
import-online-relink-kb = Více informací
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Zpráva o chybě...
rtfScan-wizard =
    .title = Prohledávání  RTF
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = Začnete vybráním RTF vstupního souboru a výstupního souboru níže:
rtfScan-input-file = Vstupní soubor
rtfScan-output-file = Výstupní soubor
rtfScan-no-file-selected = Nebyl vybrán žádný soubor
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = Představení
rtfScan-scan-page =
    .label = Vyhledávají se citace
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = Ověřit citované položky
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = Formátování dokumentu
rtfScan-format-page =
    .label = Formátování citací
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = Prohledávání RTF ukončeno
rtfScan-complete-page-description = Váš dokument byl prohledán a zpracován. Prosím, ujistěte se, že je korektně naformátován.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Run JavaScript
runJS-editor-label = Code:
runJS-run = Run
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Run as async function
bibliography-window =
    .title = { -app-name } - Create Citation/Bibliography
bibliography-style-label = Citační styl:
bibliography-locale-label = Jazyk:
bibliography-displayAs-label = Display citations as:
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
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = Zobrazit citaci jako:
integration-prefs-footnotes =
    .label = Poznámky pod čarou
integration-prefs-endnotes =
    .label = Koncové poznámky
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = Záložky mohou být sdíleny mezi Wordem a LibreOffice, mohou však vést ke vzniku chyby při náhodné úpravě a nemohou být vloženy do poznámek pod čarou.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Automaticky aktualizovat citace
    .tooltip = Citace s nevyřešenými změnami budou v dokumentu zvýrazněny
integration-prefs-automaticCitationUpdates-description = Vypnutí automatických aktualizací může urychlit vkládání citací v rozsáhlejších dokumentech. Pro manuální aktualizaci citací klikněte na tlačítko Obnovit.
integration-prefs-automaticJournalAbbeviations =
    .label = Použít zkrácené názvy časopisů MEDLINE
integration-prefs-automaticJournalAbbeviations-description = Pole "Zkrácený název časopisu" bude ignorováno
integration-prefs-exportDocument =
    .label = Přepnout do jiného textového editoru...
publications-intro-page =
    .label = Mé publikace
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
publications-sharing-page =
    .label = Vyberte, jak má být vaše práce sdílena
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
publications-license-page =
    .label = Vyberte licenci Creative Commons
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
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Vyberte licenci
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Uveďte původ 4.0 Mezinárodní License.
licenses-cc-by-nd = Creative Commons Uveďte původ-Nezpracovávejte 4.0 Mezinárodní License
licenses-cc-by-sa = Creative Commons Uveďte původ-Zachovejte licenci 4.0 Mezinárodní License
licenses-cc-by-nc = Creative Commons Uveďte původ-Neužívejte komerčně 4.0 Mezinárodní License
licenses-cc-by-nc-nd = Creative Commons Uveďte původ-Neužívejte komerčně-Nezpracovávejte 4.0 Mezinárodní License
licenses-cc-by-nc-sa = Creative Commons Uveďte původ-Neužívejte dílo komerčně-Zachovejte licenci 4.0 Mezinárodní License
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Restart in Troubleshooting Mode
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Hustota
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-info = Informace
pane-abstract = Abstrakt
pane-attachments = Přílohy
pane-notes = Poznámky
pane-libraries-collections = Libraries and Collections
pane-tags = Štítky
pane-related = Související
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = Anotace
pane-header-attachment-associated =
    .label = Přejmenovat asociovaný soubor
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } Attachment
           *[other] { $count } Attachments
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } Annotation
           *[other] { $count } Annotations
        }
section-notes =
    .label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } Tag
           *[other] { $count } Tags
        }
section-related =
    .label = { $count } Related
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
        [one] { $count } Annotation
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
    .placeholder = Add abstract…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filter Tags
context-notes-search =
    .placeholder = Search Notes
new-collection-dialog =
    .title = Nová kolekce
    .buttonlabelaccept = Create Collection
new-collection-name = Jméno:
new-collection-create-in = Create in:
attachment-info-filename = Název souboru
attachment-info-accessed = Přistoupeno
attachment-info-pages = Stránky
attachment-info-modified = Upraveno
attachment-info-index = Indexováno
attachment-info-convert-note =
    .label =
        Migrate to { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } Note
    .tooltiptext = Adding notes to attachments is no longer supported, but you can edit this note by migrating it to a separate note.
attachment-preview-placeholder = No attachment to preview
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } Attachment Preview
quickformat-general-instructions =
    Use Left/Right Arrow to navigate the items of this citation. { $dialogMenu ->
        [active] Press Shift-Tab to focus the dialog's menu.
       *[other] { "" }
    } Press { return-or-enter } to save edits to this citation. Press Escape to discard the changes and close the dialog.
quickformat-aria-bubble = This item is included in the citation. Press space bar to customize the item. { quickformat-general-instructions }
quickformat-aria-input = Type to search for an item to include in this citation. Press Tab to navigate the list of search results. { quickformat-general-instructions }
quickformat-aria-item = Press { return-or-enter } to add this item to the citation. Press Tab to go back to the search field.
quickformat-accept =
    .tooltiptext = Save edits to this citation
quickformat-locator-type =
    .aria-label = Locator type
quickformat-locator-value = Locator
quickformat-citation-options =
    .tooltiptext = Show citation options
insert-note-aria-input = Type to search for a note. Press Tab to navigate the list of results. Press Escape to close the dialog.
insert-note-aria-item = Press { return-or-enter } to select this note. Press Tab to go back to the search field. Press Escape to close the dialog.
quicksearch-mode =
    .aria-label = Quick Search mode
quicksearch-input =
    .aria-label = Rychlé hledání
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = Žádná
item-pane-header-title =
    .label = Název
item-pane-header-titleCreatorYear =
    .label = Název, Tvůrce, Rok
item-pane-header-bibEntry =
    .label = Bibliography Entry
item-pane-header-more-options =
    .label = More Options
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
architecture-win32-warning-message = { -app-name } is running in 32-bit mode on a 64-bit version of Windows. { -app-name } will run more efficiently in 64-bit mode.
architecture-warning-action = Download 64-bit { -app-name }
first-run-guidance-quickFormat =
    Type a title, author, and/or year to search for a reference.
    
    After you’ve made your selection, click the bubble or select it via the keyboard and press ↓/Space to show citation options such as page number, prefix, and suffix.
    
    You can also add a page number directly by including it with your search terms or typing it after the bubble and pressing { return-or-enter }.
first-run-guidance-authorMenu = { -app-name } lets you specify editors and translators too. You can turn an author into an editor or translator by selecting from this menu.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Search condition
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Value
    .label = { $label }
