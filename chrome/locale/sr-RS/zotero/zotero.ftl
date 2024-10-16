general-key-control = Control
general-key-shift = Shift
general-key-alt = Alt
general-key-option = Option
general-key-command = Command
option-or-alt =
    { PLATFORM() ->
        [macos] { general-key-option }
       *[other] { general-key-alt }
    }
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-print = Штампај
general-remove = Уклони
general-add = Додај
general-remind-me-later = Подсети ме касније
general-dont-ask-again = Не питај ме поново
general-choose-file = Изабери датотеку…
general-open-settings = Отвори подешавања
general-help = Помоћ
general-tag = Ознака
general-done = Готово
general-view-troubleshooting-instructions = Погледај упутства за решавање проблема
citation-style-label = Стил цитата:
language-label = Језик:
menu-file-show-in-finder =
    .label = Прикажи у претрази
menu-file-show-file =
    .label = Прикажи датотеку
menu-file-show-files =
    .label = Прикажи датотеке
menu-print =
    .label = { general-print }
menu-density =
    .label = Густина
add-attachment = Додај прилог
new-note = Нова белешка
menu-add-by-identifier =
    .label = Додај на основу идентификатора…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Додај датотеку…
menu-add-standalone-linked-file-attachment =
    .label = Додај везу до датотеке…
menu-add-child-file-attachment =
    .label = Додај датотеку…
menu-add-child-linked-file-attachment =
    .label = Приложи везу до датотеке…
menu-add-child-linked-url-attachment =
    .label = Приложи везу на вебу…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Нова самостална белешка
menu-new-item-note =
    .label = Белешка о новој ставки
menu-restoreToLibrary =
    .label = Врати у библиотеку
menu-deletePermanently =
    .label = Трајно избриши…
menu-tools-plugins =
    .label = Прикључци
main-window-command =
    .label = { -app-name }
zotero-toolbar-tabs-menu =
    .tooltiptext = Излистај све картице
filter-collections = Филтер збирки
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Претражи картице
zotero-tabs-menu-close-button =
    .title = Затвори картицу
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Преименуј збирку
collections-menu-edit-saved-search =
    .label = Уреди сачувану претрагу
collections-menu-move-collection =
    .label = Move To
collections-menu-copy-collection =
    .label = Copy To
item-creator-moveDown =
    .label = Премести доле
item-creator-moveToTop =
    .label = Премести на врх
item-creator-moveUp =
    .label = Премести горе
item-menu-viewAttachment =
    .label =
        Отвори { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] ПДФ датотеку
                    [epub] ЕПУБ датотеку
                    [snapshot] сличицу
                   *[other] прилог
                }
           *[other]
                { $attachmentType ->
                    [pdf] ПДФ датотеке
                    [epub] ЕПУБ датотеке
                    [snapshot] сличице
                   *[other] прилоге
                }
        } { $openIn ->
            [tab] у новој картици
            [window] у новом прозору
           *[other] { "" }
        }
item-menu-add-file =
    .label = Датотека
item-menu-add-linked-file =
    .label = Повезана датотека
item-menu-add-url =
    .label = Веза на вебу
item-menu-change-parent-item =
    .label = Change Parent Item…
view-online = Погледај на мрежи
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Датотека је преименована у { $filename }
itembox-button-options =
    .tooltiptext = Отвори контекстни мени
itembox-button-merge =
    .aria-label = Изабери верзију поља { $field }
create-parent-intro = Унесите ДОИ, ИСБН, ПМИБ, арХиб ИБ или АДС Бибкод за идентификацију ове датотеке:
reader-use-dark-mode-for-content =
    .label = Тамни режим за садржај
update-updates-found-intro-minor = Доступно је ажурирање за { -app-name }:
update-updates-found-desc = Препоручујемо да примените ово ажурирање што пре.
import-window =
    .title = Увези
import-where-from = Одакле желите да увезете?
import-online-intro-title = Увод
import-source-file =
    .label = Из датотеке (БибТеКс, РИС, Зотеров РДФ…)
import-source-folder =
    .label = Фасцикла са ПДФ или другим датотекама
import-source-online =
    .label = { $targetApp } увоз са мреже
import-options = Опције
import-importing = Увозим…
import-create-collection =
    .label = Постави увезене збирке и ставке у нову збирку
import-recreate-structure =
    .label = Поново направи структуру у виду збирки
import-fileTypes-header = Врсте датотека за увоз:
import-fileTypes-pdf =
    .label = ПДФ-ови
import-fileTypes-other =
    .placeholder = Отвори датотеке на основу шаблона раздвојеног зарезима (нпр. *.jpg,*.png)
import-file-handling = Рад са датотекама
import-file-handling-store =
    .label = Копирај датотеке у { -app-name } фасциклу са складиштем
import-file-handling-link =
    .label = Повежи са датотекама на оригиналној локацији
import-fileHandling-description = Не могу да ускладим повезане датотеке у програму { -app-name }.
import-online-new =
    .label = Преузми само нове ставке; не ажурирај претходно увезене ставке
import-mendeley-username = Корисничко име
import-mendeley-password = Лозинка
general-error = Грешка
file-interface-import-error = Грешка при увозу изабране датотеке. Проверите да ли је датотека исправна и покушајте поново.
file-interface-import-complete = Увоз је завршен
file-interface-items-were-imported =
    { $numItems ->
        [0] Нису увезене ставке
        [one] Ставка је увезена
       *[other] Увезених ставки: { $numItems }
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Ставке нису поново повезане
        [one] Ставка је поново повезана
       *[other] Поново повезаних ставки: { $numRelinked }
    }
import-mendeley-encrypted = Не могу да прочитам изабрану база података из Мендељева, вероватно зато што је шифрована. Погледајте <a data-l10n-name="mendeley-import-kb">Како да увезем библиотеку из Мендељева у Зотеро?</a> за више информација.
file-interface-import-error-translator = Грешка приликом увоза изабране датотеке преко „{ $translator }“. Проверите да ли је датотека исправна и покушајте поново.
import-online-intro = У следећем кораку ћете бити позвани да се пријавите на { $targetAppOnline } и дате дозволе за приступ програму { -app-name }. Ово је нопходно да увезете вашу { $targetApp } библиотеку у { -app-name }.
import-online-intro2 = { -app-name } никада неће видети или чувати вашу { $targetApp } лозинку.
import-online-form-intro = Унесите ваше податке за пријаву на { $targetAppOnline }. Ово је неопходно да увезете вашу { $targetApp } библиотеку у { -app-name }.
import-online-wrong-credentials = Није успела пријава у { $targetApp }. Унесите податке за пријаву и покушајте поново.
import-online-blocked-by-plugin = Увоз не може да се настави ако је прикључак { $plugin } инсталиран. Искључите овај прикључак и покушајте поново.
import-online-relink-only =
    .label = Поново повежи цитате из Мендељејева
import-online-relink-kb = Више података
import-online-connection-error = { -app-name } не може да се повеже на { $targetApp }. Проверите везу са интернетом и покушајте поново.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } белешка
            [few] { $count } белешке
           *[other] { $count } белешки
        }
report-error =
    .label = Грешка у извештају…
rtfScan-wizard =
    .title = РТФ скенер
rtfScan-introPage-description = { -app-name } може аутоматски да извуче и поново форматира цитате и убаци библиографију у РТФ датотеке. Тренутно подржава цитате у варијантама следећих формата:
rtfScan-introPage-description2 = За початак отворите РТФ датотеку и изаберите излазну датотеку:
rtfScan-input-file = Улазна датотека:
rtfScan-output-file = Излазна датотека:
rtfScan-no-file-selected = Није изабрана датотека
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Изаберите улазну датотеку
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Изаберите излазну датотеку
rtfScan-intro-page = Увод
rtfScan-scan-page = Тражим цитате
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page = Верификуј цитиране ставке
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page = Форматирам документ
rtfScan-format-page = Форматирам цитате
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page = РТФ скенирање је завршено
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
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
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
styleEditor-locatorType =
    .aria-label = Locator type
styleEditor-locatorInput = Locator input
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Style editor
styleEditor-preview =
    .aria-label = Preview
integration-prefs-displayAs-label = Прикажи цитате као:
integration-prefs-footnotes =
    .label = Фусноте
integration-prefs-endnotes =
    .label = Ендноте
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
integration-error-unable-to-find-winword = { -app-name } could not find a running Word instance.
publications-intro-page = Моје објаве
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
publications-sharing-page = Изаберите како ћете делити ваш рад са другима
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
publications-license-page = Изаберите Creative Commons лиценцу
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
    .label = Густина
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
            [one] { $count } белешка
            [few] { $count } белешке
           *[other] { $count } белешки
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
attachment-info-title = Наслов
attachment-info-filename = Име датотеке
attachment-info-accessed = Приступљено
attachment-info-pages = Странице
attachment-info-modified = Измењено
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
item-pane-message-objects-unselected =
    { $count ->
        [0] No objects in this view
        [one] { $count } object in this view
       *[other] { $count } objects in this view
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Merge { $count } item
           *[other] Merge { $count } items
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = Switch to 64-bit { -app-name } for the best performance. Your data won’t be affected.
architecture-warning-action = Download 64-bit { -app-name }
architecture-x64-on-arm64-message = { -app-name } is running in emulated mode. A native version of { -app-name } will run more efficiently.
architecture-x64-on-arm64-action = Download { -app-name } for ARM64
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
find-pdf-files-added =
    { $count ->
        [one] { $count } file added
       *[other] { $count } files added
    }
select-items-dialog =
    .buttonlabelaccept = Select
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Convert to Standalone Attachment
           *[other] Convert to Standalone Attachments
        }
file-type-webpage = Webpage
file-type-image = Слика
file-type-pdf = ПДФ
file-type-audio = Звук
file-type-video = Видео
file-type-presentation = Презентација
file-type-document = Документ
file-type-ebook = Е-књига
post-upgrade-message = Learn about the <a data-l10n-name="new-features-link">new features in { -app-name } { $version }</a>
post-upgrade-density = Choose your preferred layout density:
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Paste and Search
mac-word-plugin-install-message = Zotero needs access to Word data to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = Install Word plugin
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
