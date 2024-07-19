general-print = Штампај
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Уклони
general-add = Додај
general-remind-me-later = Подсети ме касније
general-choose-file = Изабери датотеку…
general-open-settings = Open Settings
general-help = Помоћ
general-tag = Tag
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = Прикажи датотеку
menu-file-show-files =
    .label = Show Files
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = Додај прилог
new-note = Нова белешка
menu-add-by-identifier =
    .label = Add by Identifier…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Add File…
menu-add-standalone-linked-file-attachment =
    .label = Add Link to File…
menu-add-child-file-attachment =
    .label = Attach File…
menu-add-child-linked-file-attachment =
    .label = Приложи везу до датотеке…
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Нова самостална белешка
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = Врати у библиотеку
menu-deletePermanently =
    .label = Трајно избриши…
menu-tools-plugins =
    .label = Plugins
main-window-command =
    .label = { -app-name }
zotero-toolbar-tabs-menu =
    .tooltiptext = List all tabs
filter-collections = Filter Collections
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Search Tabs
zotero-tabs-menu-close-button =
    .title = Close Tab
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Rename Collection
collections-menu-edit-saved-search =
    .label = Уреди сачувану претрагу
item-creator-moveDown =
    .label = Премести доле
item-creator-moveToTop =
    .label = Премести на врх
item-creator-moveUp =
    .label = Премести горе
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
    .label = Датотека
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Web Link
view-online = Погледај на мрежи
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = File renamed to { $filename }
itembox-button-options =
    .tooltiptext = Open context menu
itembox-button-merge =
    .aria-label = Select version of { $field } field
create-parent-intro = Enter a DOI, ISBN, PMID, arXiv ID, or ADS Bibcode to identify this file:
reader-use-dark-mode-for-content =
    .label = Use Dark Mode for Content
update-updates-found-intro-minor = An update for { -app-name } is available:
update-updates-found-desc = It is recommended that you apply this update as soon as possible.
import-window =
    .title = Увези
import-where-from = Одакле желите да увезете?
import-online-intro-title = Увод
import-source-file =
    .label = Из датотеке (BibTeX, RIS, Зотеров RDF…)
import-source-folder =
    .label = Фасцикла са ПДФ-овима или другим датотекама
import-source-online =
    .label = { $targetApp } online import
import-options = Опције
import-importing = Увозим…
import-create-collection =
    .label = Постави увезене збирке и ставке у нову збирку
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Рад са датотекама
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Link to files in original location
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Преузми само нове ставке; не ажурирај претходно увезене ставке
import-mendeley-username = Корисничко име
import-mendeley-password = Лозинка
general-error = Грешка
file-interface-import-error = Грешка при покушају увеза изабране датотеке. Проверите да ли је датотека исправна и покушајте поново.
file-interface-import-complete = Увоз је завршен
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
import-online-relink-kb = Више података
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Грешка у извештају…
rtfScan-wizard =
    .title = RTF скенер
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = За початак отворите РТФ датотеку и изаберите излазну датотеку:
rtfScan-input-file = Улазна датотека
rtfScan-output-file = Излазна датотека
rtfScan-no-file-selected = Није изабрана датотека
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = Увод
rtfScan-scan-page =
    .label = Тражим цитате
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = Верификуј цитиране ставке
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = Форматирање документа
rtfScan-format-page =
    .label = Форамтирање цитата
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = РТФ скенирање је завршено
rtfScan-complete-page-description = Ваш документ је скениран и обрађен. Проверите да ли је исправно форматиран.
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
bibliography-style-label = Стил цитата:
bibliography-locale-label = Језик:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Напредне опције
bibliography-outputMode-label = Извези као:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Библиографију
bibliography-outputMethod-label = Начин извоза:
bibliography-outputMethod-saveAsRTF =
    .label = Сними као РТФ
bibliography-outputMethod-saveAsHTML =
    .label = Сними као ХТМЛ
bibliography-outputMethod-copyToClipboard =
    .label = Копирај у оставу
bibliography-outputMethod-print =
    .label = Штампај
bibliography-manageStyles-label = Уреди стилове…
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = Прикажи цитате као:
integration-prefs-footnotes =
    .label = Фуснота
integration-prefs-endnotes =
    .label = Енднота
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = Обележивачи се могу делити између програма Word и LibreOffice, али могу направити проблеме уколико их случајно промените и не могу бити уметнути као фусноте.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Аутоматски ажурирај цитате
    .tooltip = Цитати који чекају на ажурирање ће бити истакнути унутар документа
integration-prefs-automaticCitationUpdates-description = Онемогућавање ажурирања може убрзати уметање цитата када радите са великим документима. Увек можете кликните на „Освежи“ како би ручно ажурурати цитате.
integration-prefs-automaticJournalAbbeviations =
    .label = Користи скраћенице часописа из Медлајна
integration-prefs-automaticJournalAbbeviations-description = Поље „Скраћеница часописа“ ће бити занемарено.
integration-prefs-exportDocument =
    .label = Пребаците се на други програм за обраду текста…
publications-intro-page =
    .label = Моје објаве
publications-intro = Ставке које сте додали у Моје објаве ће бити приказане на вашој страници у оквиру сајта zotero.org. Уколико желите да додате и прилоге, они ће бити јавно доступни под лиценцом који изаберете. Додајте само радове које сте сами направили и датотеке за које поседујете одговарајуће правне дозволе за дељење.
publications-include-checkbox-files =
    .label = Укључи датотеке
publications-include-checkbox-notes =
    .label = Укључи белешке
publications-include-adjust-at-any-time = Можете подесити шта се овде приказује ако одете у збирку Моје објаве.
publications-intro-authorship =
    .label = Ја сам аутор овог рада.
publications-intro-authorship-files =
    .label = Ја сам направио овај рад и имам права да делим прикључене датотеке.
publications-sharing-page =
    .label = Изаберите како ћете делити ваш рад са другима
publications-sharing-keep-rights-field =
    .label = Задржи поље са ауторским правима
publications-sharing-keep-rights-field-where-available =
    .label = Задржите постојеће поље са ауторским правима уколико је доступно
publications-sharing-text = Можете задржати сва права над својим радом, поставити слободну лиценцу или доделити јавни домен. У свим случајевима ће рад бити јавно доступан на страници zotero.org.
publications-sharing-prompt = Да ли желите да поделите свој рад са осталима?
publications-sharing-reserved =
    .label = Не, само објави моје податке на zotero.org.
publications-sharing-cc =
    .label = Да, под слободном Creative Commons лиценцом
publications-sharing-cc0 =
    .label = Да, постави мој рад у јавни домен
publications-license-page =
    .label = Изаберите Creative Commons лиценцу
publications-choose-license-text = Creative Commons лиценца дозвољава другима да копирају и даље деле ваш рад док год је ваша заслуга јасно истакнута, уз давање везе до лиценце и навођење ако је дошло до неких промена. Додатни услови могу бити постављени овде.
publications-choose-license-adaptations-prompt = Да ли да дозволим дељење измена вашег рада?
publications-choose-license-yes =
    .label = Да
    .accesskey = Y
publications-choose-license-no =
    .label = Не
    .accesskey = N
publications-choose-license-sharealike =
    .label = Да, док год га и други деле под истим условима
    .accesskey = S
publications-choose-license-commercial-prompt = Да ли дозвољавате употребу вашег рада у комерцијалне сврхе?
publications-buttons-add-to-my-publications =
    .label = Додај у Моје објаве
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Изаберите лиценцу
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Заједничко креативно добро, ауторство, 4.0, интернационална лиценца
licenses-cc-by-nd = Заједничко креативно добро, ауторство-без измена, 4.0, интернационална лиценца
licenses-cc-by-sa = Заједничко креативно добро, ауторство-дељење под истим условима, 4.0, интернационална лиценца
licenses-cc-by-nc = Заједничко креативно добро, ауторство-некомерцијално, 4.0, интернационална лиценца
licenses-cc-by-nc-nd = Заједничко креативно добро, ауторство-некомерцијално-без измена, 4.0, интернационална лиценца
licenses-cc-by-nc-sa = Заједничко креативно добро, ауторство-некомерцијално-дељење под истим условима, 4.0, интернационална лиценца
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Restart in Troubleshooting Mode
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Density
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-info = Инфо
pane-abstract = Сажетак
pane-attachments = Прилози
pane-notes = Белешке
pane-libraries-collections = Libraries and Collections
pane-tags = Ознаке
pane-related = Сродно
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = Напомене
pane-header-attachment-associated =
    .label = Преименујте повезану датотеку
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
    .title = Нова збирка
    .buttonlabelaccept = Create Collection
new-collection-name = Име:
new-collection-create-in = Create in:
attachment-info-filename = име датотеке
attachment-info-accessed = Приступљено
attachment-info-pages = Странице
attachment-info-modified = Датум измене
attachment-info-index = Индексирано
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
    .aria-label = Брза претрага
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = Ништа
item-pane-header-title =
    .label = Наслов
item-pane-header-titleCreatorYear =
    .label = Наслов, аутор, година
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
