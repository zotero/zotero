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
    .label = Премести у
collections-menu-copy-collection =
    .label = Копирај у
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
    .label = Промени родитељску ставку…
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
import-mendeley-encrypted = Не могу да прочитам изабрану базу података из Мендељејева, вероватно зато што је шифрована. Погледајте <a data-l10n-name="mendeley-import-kb">Како да увезем библиотеку из Мендељејева у Зотеро?</a> за више информација.
file-interface-import-error-translator = Грешка приликом увоза изабране датотеке преко „{ $translator }“. Проверите да ли је датотека исправна и покушајте поново.
import-online-intro = У следећем кораку ћемо вас позвати да се пријавите на { $targetAppOnline } и дате дозволе за приступ програму { -app-name }. Ово је нопходно да увезете вашу { $targetApp } библиотеку у { -app-name }.
import-online-intro2 = { -app-name } никада неће видети или чувати вашу { $targetApp } лозинку.
import-online-form-intro = Унесите ваше податке за пријаву на { $targetAppOnline }. Ово је неопходно да увезете { $targetApp } библиотеку у { -app-name }.
import-online-wrong-credentials = Није успела пријава на { $targetApp }. Унесите податке за пријаву и покушајте поново.
import-online-blocked-by-plugin = Не можете да наставите увоз док је покренут прикључак { $plugin }. Искључите овај прикључак и покушајте поново.
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
rtfScan-introPage-description = { -app-name } може аутоматски да извуче, поново форматира цитате и убаци библиографију у РТФ датотеке. Тренутно подржава цитате у варијантама следећих формата:
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
rtfScan-scanPage-description = { -app-name } претражује ваш документ у потрази за цитатима. Будите стрпљиви.
rtfScan-citations-page = Верификуј цитиране ставке
rtfScan-citations-page-description = Прегледајте списак препознатих цитата како би проверили да ли је { -app-name } правилно изабрао одговарајуће ставке. Уколико постоје цитати који нису повезани или су чудни, морате их средити пре него што наставите даље.
rtfScan-style-page = Форматирам документ
rtfScan-format-page = Форматирам цитате
rtfScan-format-page-description = { -app-name } обрађује и форматира вашу РТФ датотеку. Будите стрпљиви.
rtfScan-complete-page = РТФ скенирање је завршено
rtfScan-complete-page-description = Ваш документ је скениран и обрађен. Проверите да ли је исправно форматиран.
rtfScan-action-find-match =
    .title = Изабери ставке које се подударају
rtfScan-action-accept-match =
    .title = Прихвати ово подударање
runJS-title = Покрени ЈаваСкрипт
runJS-editor-label = Код:
runJS-run = Покрени
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Враћена вредност:
       *[other] Резултат:
    }
runJS-run-async = Покрени као асинхрону функцију
bibliography-window =
    .title = { -app-name } - прављење цитата/библиографије
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Прикажи цитате као:
bibliography-advancedOptions-label = Напредне опције
bibliography-outputMode-label = Извези као:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Цитате
            [note] Белешке
           *[other] Цитате
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
    .title = { -app-name } - поставке документа
integration-addEditCitation-window =
    .title = { -app-name } - додавање/уређивање цитата
integration-editBibliography-window =
    .title = { -app-name } - уређивање библиографије
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Edit reference
-integration-editBibliography-include-uncited = To include an uncited item in your bibliography, select it from the items list and press { general-add }.
-integration-editBibliography-exclude-cited = You can also exclude a cited item by selecting it from the list of references and pressing { general-remove }.
-integration-editBibliography-edit-reference = To change how a reference is formatted, use the text editor.
integration-editBibliography-wrapper =
    .aria-label = Edit Bibliography dialog
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-quickFormatDialog-window =
    .title = { -app-name } - брзо форматирање цитата
styleEditor-locatorType =
    .aria-label = Врста локатора
styleEditor-locatorInput = Унос локатора
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Уређивач стилова
styleEditor-preview =
    .aria-label = Преглед
integration-prefs-displayAs-label = Прикажи цитате као:
integration-prefs-footnotes =
    .label = Фусноте
integration-prefs-endnotes =
    .label = Ендноте
integration-prefs-bookmarks =
    .label = Сачувај цитат у обележиваче
integration-prefs-bookmarks-description = Обележивачи се могу делити између програма Word и LibreOffice, али могу направити проблеме уколико их случајно промените и не могу бити уметнути као фусноте.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Морате да сачувате документ као .doc или .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Аутоматски ажурирај цитате
    .tooltip = Цитати који чекају на ажурирање ће бити истакнути унутар документа
integration-prefs-automaticCitationUpdates-description = Онемогућавањем ажурирања можете убрзати додавање цитата када радите са великим документима. Увек можете кликните на „Освежи“ како би ручно ажурирали цитате.
integration-prefs-automaticJournalAbbeviations =
    .label = Користи скраћенице часописа из Медлајна
integration-prefs-automaticJournalAbbeviations-description = Поље „Скраћеница часописа“ ће бити занемарено.
integration-prefs-exportDocument =
    .label = Пребаците се на други програм за обраду текста…
integration-error-unable-to-find-winword = { -app-name } не може да пронађе покренути Word програм.
publications-intro-page = Моји радови
publications-intro = Ставке које сте додали у Моји радови ће бити приказане на вашој страници у оквиру сајта zotero.org. Уколико желите да додате и прилоге, они ће бити јавно доступни под лиценцом који изаберете. Додајте само радове које сте сами направили и датотеке за које поседујете одговарајуће правне дозволе за дељење.
publications-include-checkbox-files =
    .label = Укључи датотеке
publications-include-checkbox-notes =
    .label = Укључи белешке
publications-include-adjust-at-any-time = Можете подесити шта се овде приказује ако одете у збирку Моји радови.
publications-intro-authorship =
    .label = Ја сам аутор овог рада.
publications-intro-authorship-files =
    .label = Ја сам направио овај рад и имам права да делим прикључене датотеке.
publications-sharing-page = Изаберите како ћете делити ваш рад са другима
publications-sharing-keep-rights-field =
    .label = Задржи поље са ауторским правима
publications-sharing-keep-rights-field-where-available =
    .label = Задржи постојеће поље са ауторским правима, уколико је доступно
publications-sharing-text = Можете задржати сва права над својим радом, поделити га под слободном лиценцом или га поделити преко јавног домена. У свим случајевима ће рад бити јавно доступан на страници zotero.org.
publications-sharing-prompt = Да ли желите да поделите свој рад са осталима?
publications-sharing-reserved =
    .label = Не, само објави моје податке на zotero.org.
publications-sharing-cc =
    .label = Да, под лиценцом Заједничко креативно добро
publications-sharing-cc0 =
    .label = Да, постави мој рад у јавни домен
publications-license-page = Изаберите лиценцу Заједничко креативно добро
publications-choose-license-text = Заједничко креативно добро дозвољава другима да копирају и даље деле ваш рад док год је ваша заслуга јасно истакнута, уз давање везе до лиценце и навођење ако је дошло до неких промена. Додатни услови могу бити постављени овде.
publications-choose-license-adaptations-prompt = Да ли дозвољавате дељење измена вашег рада?
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
    .label = Додај у Моји радови
publications-buttons-next-sharing =
    .label = Следеће: дељење
publications-buttons-next-choose-license =
    .label = Изаберите лиценцу
licenses-cc-0 = CC0 1.0, посвећеност универзалном јавном домену
licenses-cc-by = Заједничко креативно добро, ауторство, 4.0, интернационална лиценца
licenses-cc-by-nd = Заједничко креативно добро, ауторство-без измена, 4.0, интернационална лиценца
licenses-cc-by-sa = Заједничко креативно добро, ауторство-дељење под истим условима, 4.0, интернационална лиценца
licenses-cc-by-nc = Заједничко креативно добро, ауторство-некомерцијално, 4.0, интернационална лиценца
licenses-cc-by-nc-nd = Заједничко креативно добро, ауторство-некомерцијално-без измена, 4.0, интернационална лиценца
licenses-cc-by-nc-sa = Заједничко креативно добро, ауторство-некомерцијално-дељење под истим условима, 4.0, интернационална лиценца
licenses-cc-more-info = Прочитајте Заједничко креативно добро, <a data-l10n-name="license-considerations">Разматрања за издаваоце лиценци</a> пре него што поставите рад под CC лиценцом. Уколико примените ову лиценцу, не можете опозвати, чак ни уколико касније изаберете другачије услове или повучете објављени рад.
licenses-cc0-more-info = Прочитајте Заједничко креативно добро, <a data-l10n-name="license-considerations">CC0 питања и одговори</a> пре него што примените CC0 на ваш рад. Не можете опозвати одлуку да поставите свој рад у на јавни домен, чак ни уколико касније изаберете другачије услове или повучете објављени рад.
restart-in-troubleshooting-mode-menuitem =
    .label = Покрени у режиму за тражење проблема…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Покрени у режиму за тражење проблема
restart-in-troubleshooting-mode-dialog-description = { -app-name } ће се поново покренути са искљученим додацима. Неке могућности можда неће радити како треба док је режим за тражење проблема укључен.
menu-ui-density =
    .label = Густина
menu-ui-density-comfortable =
    .label = Удобно
menu-ui-density-compact =
    .label = Збијено
pane-info = Подаци
pane-abstract = Сажетак
pane-attachments = Прилози
pane-notes = Белешке
pane-libraries-collections = Библиотеке и збирке
pane-tags = Ознаке
pane-related = Сродно
pane-attachment-info = Подаци о прилогу
pane-attachment-preview = Преглед
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
            [one] { $count } прилог
            [few] { $count } прилога
           *[other] { $count } прилога
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } белешка
            [few] { $count } белешке
           *[other] { $count } белешки
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
            [one] { $count } ознака
            [few] { $count } ознаке
           *[other] { $count } ознака
        }
section-related =
    .label = { $count } повезнице
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Прошири одељак
    .label = Прошири одељак { $section }
section-button-collapse =
    .dynamic-tooltiptext = Скупи одељак
    .label = Скупи одељак { $section }
annotations-count =
    { $count ->
        [one] { $count } белешка
        [few] { $count } белешке
       *[other] { $count } белешки
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
    .label = Закачи одељак
unpin-section =
    .label = Откачи одељак
collapse-other-sections =
    .label = Скупи друге одељке
expand-all-sections =
    .label = Прошири све одељке
abstract-field =
    .placeholder = Додај апстракт…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Филтрирај ознаке
context-notes-search =
    .placeholder = Претражи белешке
new-collection-dialog =
    .title = Нова збирка
    .buttonlabelaccept = Направи одељак
new-collection-name = Име:
new-collection-create-in = Направи у:
attachment-info-title = Наслов
attachment-info-filename = Име датотеке
attachment-info-accessed = Приступљено
attachment-info-pages = Странице
attachment-info-modified = Измењено
attachment-info-index = Индексирано
attachment-info-convert-note =
    .label =
        Премести у { $type ->
            [standalone] самосталну белешку
            [child] ставку белешке
           *[unknown] нову белешку
        }
    .tooltiptext = Више није подржано додавање белешки и прилога, али можете изменити ову белешку тако што ћете је преместити у засебну белешку.
attachment-preview-placeholder = Нема прилога за преглед
toggle-preview =
    .label =
        { $type ->
            [open] Сакриј
            [collapsed] Прикажи
           *[unknown] Укључи/искључи
        } преглед прилога
quickformat-general-instructions =
    Користите стрелице за лево/десно да идете кроз ставке овог цитата. { $dialogMenu ->
        [active] Притисните Shift-Tab за фокус на мени прозорчета.
       *[other] { "" }
    } Притисните { return-or-enter } да сачувате измене овог цитата. Притисните Escape да занемарите промене и затворите прозорче.
quickformat-aria-bubble = Ова ставка је укључена у цитирање. Притисните размак да подесите изглед ставке. { quickformat-general-instructions }
quickformat-aria-input = Откуцајте текст да потражите ставку која ће бити укључена у овај цитат. Притисните Tab да идете кроз списак резултата претраге. { quickformat-general-instructions }
quickformat-aria-item = Притисните { return-or-enter } да додате ову ставку у цитат. Притисните Tab да идете назад на поље за претрагу.
quickformat-accept =
    .tooltiptext = Сачувај измене овог цитата
quickformat-locator-type =
    .aria-label = Врста локатора
quickformat-locator-value = Локатор
quickformat-citation-options =
    .tooltiptext = Прикажи опције цитата
insert-note-aria-input = Укуцајте текст за претрагу белешке. Притисните Tab да идете кроз списак резултата. Притисните Escape да затворите овај прозорчић.
insert-note-aria-item = Притисните { return-or-enter } да изаберете ову белешку. Притисните Tab да се вратите назад на поље за претрагу. Притисните Escape да затворите прозорчић.
quicksearch-mode =
    .aria-label = Режим брзе претраге
quicksearch-input =
    .aria-label = Брза претрага
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Прегледај као
item-pane-header-none =
    .label = Ништа
item-pane-header-title =
    .label = Наслов
item-pane-header-titleCreatorYear =
    .label = Наслов, аутор, година
item-pane-header-bibEntry =
    .label = Библиографски унос
item-pane-header-more-options =
    .label = Више опција
item-pane-message-items-selected =
    { $count ->
        [0] Није изабрана ставке
        [one] Изабрана је { $count } ставка
       *[other] Изабрано је { $count } ставки
    }
item-pane-message-collections-selected =
    { $count ->
        [one] Изабрана је { $count } збирка
        [few] Изабране су { $count } збирке
       *[other] Изабрано је { $count } збирки
    }
item-pane-message-searches-selected =
    { $count ->
        [one] Изабрана је { $count } претрага
        [few] Изабране су { $count } претраге
       *[other] Изабрано је { $count } претрага
    }
item-pane-message-objects-selected =
    { $count ->
        [one] Изабран је { $count } објекат
        [few] Изабрана су { $count } објекта
       *[other] Изабрано је { $count } објеката
    }
item-pane-message-unselected =
    { $count ->
        [0] Нема ставки у овом прегледу
        [one] { $count } ставка у овом прегледу
       *[other] { $count } ставки у овом прегледу
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] Нема објеката у овом прегледу
        [one] { $count } објекат у овом прегледу
       *[other] { $count } објеката у овом прегледу
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Споји { $count } ставку
            [few] Споји { $count } ставке
           *[other] Споји { $count } ставки
        }
locate-library-lookup-no-resolver = Морате да изаберете разрешитеља из површи { $pane } у подешавањима програма { -app-name }.
architecture-win32-warning-message = Пребаците се на 64-творо битни { -app-name } за бржи рад програма. Ваши подаци неће бити промењени.
architecture-warning-action = Преузми 64-творо битни { -app-name }
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
select-items-convertToStandalone =
    .label = Convert to Standalone
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Convert to Standalone Attachment
           *[other] Convert to Standalone Attachments
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Convert to Standalone Note
           *[other] Convert to Standalone Notes
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
