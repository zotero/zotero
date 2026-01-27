general-sentence-separator = { " " }
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
general-print = Распечатать
general-remove = Удалить
general-add = Добавить
general-remind-me-later = Напомнить позже
general-dont-ask-again = Не спрашивать больше
general-choose-file = Выберите файл…
general-open-settings = Открыть настройки
general-settings = Настройки…
general-help = Справка
general-tag = Тег
general-done = Завершено
general-view-troubleshooting-instructions = Показать инструкции по отладке
general-go-back = Вернуться
general-accept = Принять
general-cancel = Отменить
general-show-in-library = Показать в библиотеке
general-restartApp = Перезапустить { -app-name }
general-restartInTroubleshootingMode = Перезапустить в режиме отладки
general-save = Сохранить:
general-clear = Очистить
general-update = Обновить
general-back = Назад
general-edit = Редактировать
general-cut = Вырезать
general-copy = Копировать
general-paste = Вставить
general-find = Найти
general-delete = Удалить
general-insert = Вставить
general-and = и
general-et-al = и др.
general-previous = Предыдущий
general-next = Следующий
general-learn-more = Узнать больше
general-warning = Внимание
general-type-to-continue = Введите “{ $text }”, чтобы продолжить.
general-continue = Продолжить
general-red = Красный
general-orange = Оранжевый
general-yellow = Жёлтый
general-green = Зелёный
general-teal = Бирюзовый
general-blue = Синий
general-purple = Пурпурный
general-magenta = Фуксин
general-violet = Фиолетовый
general-maroon = Темно-бордовый
general-gray = Серый
general-black = Черный
general-loading = Загрузка...
citation-style-label = Стиль цитирования:
language-label = Язык:
menu-custom-group-submenu =
    .label = More Options…
menu-file-show-in-finder =
    .label = Показать в файловом менеджере
menu-file-show-file =
    .label = Показать файл
menu-file-show-files =
    .label = Показать файлы
menu-print =
    .label = { general-print }
menu-density =
    .label = Плотность интерфейса
add-attachment = Добавить вложение
new-note = Новая заметка
menu-add-by-identifier =
    .label = Добавить по идентификатору…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Добавить файл…
menu-add-standalone-linked-file-attachment =
    .label = Добавить ссылку на файл…
menu-add-child-file-attachment =
    .label = Присоединить файл…
menu-add-child-linked-file-attachment =
    .label = Добавить ссылку на файл…
menu-add-child-linked-url-attachment =
    .label = Добавить web-ссылку…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Новая отдельная заметка
menu-new-item-note =
    .label = Новая заметка к записи
menu-restoreToLibrary =
    .label = Восстановить в библиотеке
menu-deletePermanently =
    .label = Удалить навсегда…
menu-tools-plugins =
    .label = Плагины
menu-view-columns-move-left =
    .label = Переместить колонку влево
menu-view-columns-move-right =
    .label = Переместить колонку вправо
menu-view-note-font-size =
    .label = Размер шрифта заметок
menu-view-note-tab-font-size =
    .label = Note Tab Font Size
menu-show-tabs-menu =
    .label = Показать меню вкладок
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Скопировать аннотацию
            [few] Скопировать { $count } аннотации
            [many] Скопировать { $count } аннотаций
           *[other] Скопировать { $count } аннотации
        }
main-window-command =
    .label = Библиотека
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = Список всех вкладок
filter-collections = Фильтровать коллекции
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Найти вкладки
zotero-tabs-menu-close-button =
    .title = Закрыть вкладку
zotero-toolbar-tabs-scroll-forwards =
    .title = Прокрутить вперёд
zotero-toolbar-tabs-scroll-backwards =
    .title = Прокрутить назад
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Переименовать коллекцию
collections-menu-edit-saved-search =
    .label = Редактировать сохраненный поиск
collections-menu-move-collection =
    .label = Переместить в
collections-menu-copy-collection =
    .label = Копировать в
item-creator-moveDown =
    .label = Переместить вниз
item-creator-moveToTop =
    .label = Переместить в начало
item-creator-moveUp =
    .label = Переместить вверх
item-menu-viewAttachment =
    .label =
        Open { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Снапшот
                    [note] Заметка
                   *[other] Вложение
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Снапшоты
                    [note] Заметки
                   *[other] Вложения
                }
        } { $openIn ->
            [tab] в новой вкладке
            [window] в новом окне
           *[other] { "" }
        }
item-menu-add-file =
    .label = Файл
item-menu-add-linked-file =
    .label = Связанные файлы
item-menu-add-url =
    .label = Web-ссылка
item-menu-change-parent-item =
    .label = Изменить родительский элемент…
item-menu-relate-items =
    .label = Relate Items
view-online = Просмотреть онлайн
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Файл переименован в { $filename }
itembox-button-options =
    .tooltiptext = Открыть контекстное меню
itembox-button-merge =
    .aria-label = Выберите версию поля { $field }
create-parent-intro = Введите DOI, ISBN, PMID, arXiv ID, или ADS Bibcode для идентификации этого файла:
reader-use-dark-mode-for-content =
    .label = Использовать темную тему для содержимого
update-updates-found-intro-minor = Обновление для { -app-name } доступно:
update-updates-found-desc = Рекомендуется применение обновления как можно скорее.
import-window =
    .title = Импорт
import-where-from = Откуда вы хотите импортировать?
import-online-intro-title = Введение
import-source-file =
    .label = Файл (BibTeX, RIS, Zotero RDF, etc.)
import-source-folder =
    .label = Каталог файлов PDF и прочих
import-source-online =
    .label = { $targetApp } онлайн импорт
import-options = Настройки
import-importing = Идёт импортирование…
import-create-collection =
    .label = Поместить импортированные коллекции и записи в новую коллекцию
import-recreate-structure =
    .label = Повторить структуру папок как коллекций
import-fileTypes-header = Типы файлов для импорта:
import-fileTypes-pdf =
    .label = PDF-файлы
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Обработка файлов
import-file-handling-store =
    .label = Скопировать файлы в папку { -app-name }
import-file-handling-link =
    .label = Link to files in original location
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Загрузить только новые записи; не обновлять ранее импортированные записи
import-mendeley-username = Имя пользователя
import-mendeley-password = Пароль
general-error = Ошибка
file-interface-import-error = Произошла ошибка во время импортирования выбранного файла. Пожалуйста, убедитесь что файл валиден и попробуйте ещё раз.
file-interface-import-complete = Импорт завершен
file-interface-items-were-imported =
    { $numItems ->
        [0] Файлы не были импортированы
        [one] Импортирован один файл
       *[other] { $numItems } файлов было импортировано
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
    .label = Заменить ссылки на цитирования из Mendeley Desktop
import-online-relink-kb = Дополнительные сведения
import-online-connection-error = { -app-name } не смог подсоединиться к { $targetApp }. Пожалуйста, проверьте своё подключение к интернету и попробуйте снова.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } заметка
            [few] { $count } заметки
            [many] { $count } заметок
           *[other] { $count } заметки
        }
report-error =
    .label = Сообщить об ошибке…
rtfScan-wizard =
    .title = Поиск ссылок в RTF-документе
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. It currently supports citations in variations of the following formats:
rtfScan-introPage-description2 = Чтобы начать, выберите ниже входной файл RTF и выходной файл:
rtfScan-input-file = Входной файл:
rtfScan-output-file = Выходной файл:
rtfScan-no-file-selected = Файл не выбран
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Выберите входной файл
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Выберите выходной файл
rtfScan-intro-page = Введение
rtfScan-scan-page = Сканирование на наличие цитат
rtfScan-scanPage-description = { -app-name } сканирует цитирования в документе. Пожалуйста подождите.
rtfScan-citations-page = Проверить цитированные записи
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page = Форматирование документа
rtfScan-format-page = Форматирование цитат
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page = Сканирование RTF завершено
rtfScan-complete-page-description = Ваш документ был сканирован и обработан. Пожалуйста, проверьте корректность форматирования.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Запустить JavaScript
runJS-editor-label = Code:
runJS-run = Запустить
runJS-help = { general-help }
runJS-completed = завершено успешно
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
bibliography-advancedOptions-label = Расширенные настройки
bibliography-outputMode-label = Режим вывода:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Библиография
bibliography-outputMethod-label = Метод вывода:
bibliography-outputMethod-saveAsRTF =
    .label = Сохранить как RTF
bibliography-outputMethod-saveAsHTML =
    .label = Сохранить как HTML
bibliography-outputMethod-copyToClipboard =
    .label = Скопировать в буфер обмена
bibliography-outputMethod-print =
    .label = Распечатать
bibliography-manageStyles-label = Управление стилями…
styleEditor-locatorType =
    .aria-label = Locator type
styleEditor-locatorInput = Locator input
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Style editor
styleEditor-preview =
    .aria-label = Предпросмотр
publications-intro-page = Мои публикации
publications-intro = Записи, добавленные в раздел «Мои публикации», будут показаны на странице вашего профиля в zotero.org. Если вы присоединили файлы, они также станут доступны публично под указанной вами лицензией. Добавляйте только ваши собственные работы и размещайте только те файлы, для которых у вас есть разрешение на распространение.
publications-include-checkbox-files =
    .label = Включая файлы
publications-include-checkbox-notes =
    .label = Включая заметки
publications-include-adjust-at-any-time = Вы можете настроить отображение в любой момент из коллекции «Мои публикации»
publications-intro-authorship =
    .label = Я автор этой работы.
publications-intro-authorship-files =
    .label = Я автор этой работы и владею правами на распространение вложений.
publications-sharing-page = Выберите, как ваша работа будет распространяться
publications-sharing-keep-rights-field =
    .label = Сохранить существующее поле «Права»
publications-sharing-keep-rights-field-where-available =
    .label = Сохранить существующее поле «Права», если оно доступно.
publications-sharing-text = Вы можете защитить все права на свою работу, лицензировав её по лицензии «Creative Commons» или передать её в общественное достояние. В любом случае, работа будет опубликована на сайте zotero.org.
publications-sharing-prompt = Вы хотите разрешить распространение работы третьими лицами?
publications-sharing-reserved =
    .label = Нет, опубликовать только на zotero.org
publications-sharing-cc =
    .label = Да, под лицензией «Creative Commons»
publications-sharing-cc0 =
    .label = Да, и разрешить свободное обращение
publications-license-page = Выбрать лицензию «Creative Commons»
publications-choose-license-text = Лицензия «Creative Commons» разрешает третьей стороне копирование и распространение производных работ при указании ссылки на первоисточник, ссылки на лицензию и внесённых изменений. Дополнительные условия могут быть указаны ниже.
publications-choose-license-adaptations-prompt = Разрешить распространение производных работ?
publications-choose-license-yes =
    .label = Да
    .accesskey = Y
publications-choose-license-no =
    .label = Нет
    .accesskey = N
publications-choose-license-sharealike =
    .label = Да, если третья сторона не ограничивает распространение
    .accesskey = S
publications-choose-license-commercial-prompt = Разрешить коммерческое использование вашей работы?
publications-buttons-add-to-my-publications =
    .label = Добавить в Мои публикации
publications-buttons-next-sharing =
    .label = Далее: Распространение
publications-buttons-next-choose-license =
    .label = Выбрать лицензию
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = международная лицензия Creative Commons Attribution 4.0
licenses-cc-by-nd = международная лицензия Creative Commons Attribution-NoDerivatives 4.0
licenses-cc-by-sa = международная лицензия Creative Commons Attribution-ShareAlike 4.0
licenses-cc-by-nc = международная лицензия Creative Commons Attribution-NonCommercial 4.0
licenses-cc-by-nc-nd = международная лицензия Creative Commons Attribution-NonCommercial-NoDerivatives 4.0
licenses-cc-by-nc-sa = международная лицензия Creative Commons Attribution-NonCommercial-ShareAlike 4.0
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Перезапустить в режиме отладки…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Плотность интерфейса
menu-ui-density-comfortable =
    .label = Комфортная
menu-ui-density-compact =
    .label = Компактная
pane-item-details = Item Details
pane-info = Информация
pane-abstract = Аннотация
pane-attachments = Вложения
pane-notes = Заметки
pane-note-info = Note Info
pane-libraries-collections = Libraries and Collections
pane-tags = Теги
pane-related = Связанные
pane-attachment-info = Attachment Info
pane-attachment-preview = Предпросмотр
pane-attachment-annotations = Аннотации
pane-header-attachment-associated =
    .label = Переименовать связанный файл
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } вложение
            [few] { $count } вложения
            [many] { $count } вложений
           *[other] { $count } вложения
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } аннотация
            [few] { $count } аннотации
            [many] { $count } аннотаций
           *[other] { $count } аннотации
        }
section-attachments-move-to-trash-message = Вы уверены, что хотите переместить “{ $title }” в корзину?
section-notes =
    .label =
        { $count ->
            [one] { $count } заметка
            [few] { $count } заметки
            [many] { $count } заметок
           *[other] { $count } заметки
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } тег
            [few] { $count } тега
            [many] { $count } тегов
           *[other] { $count } тега
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
        [one] { $count } аннотация
        [few] { $count } аннотации
        [many] { $count } аннотаций
       *[other] { $count } аннотации
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
    .label = Переместить блок вверх
sidenav-reorder-down =
    .label = Переместить блок вниз
sidenav-reorder-reset =
    .label = Сбросить порядок блоков
toggle-item-pane =
    .tooltiptext = Переключить панель элемента
toggle-context-pane =
    .tooltiptext = Переключить контекстную панель
pin-section =
    .label = Закрепить блок
unpin-section =
    .label = Открепить блок
collapse-other-sections =
    .label = Свернуть другие блоки
expand-all-sections =
    .label = Развернуть все блоки
abstract-field =
    .placeholder = Добавить аннотацию…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Фитровать теги
context-notes-search =
    .placeholder = Искать заметки
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Новая коллекция…
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Новая коллекция
    .buttonlabelaccept = Create Collection
new-collection-name = Название:
new-collection-create-in = Создать в:
show-publications-menuitem =
    .label = Показать Мои публикации
attachment-info-title = Название
attachment-info-filename = Имя файла
attachment-info-accessed = Дата доступа
attachment-info-pages = Страницы
attachment-info-modified = Изменено
attachment-info-index = Проиндексировано
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
note-info-title = Название
note-info-parent-item = Родительский элемент
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] None
    }
    .title =
        { $hasParentItem ->
            [true] Показать родительский элемент в библиотеке
           *[false] View note item in library
        }
note-info-date-created = Создана
note-info-date-modified = Изменена
note-info-size = Размер
note-info-word-count = Количество слов
note-info-character-count = Количество символов
item-title-empty-note = Заметка без названия
attachment-preview-placeholder = Нет вложений для предпросмотра
attachment-rename-from-parent =
    .tooltiptext = Переименовать файл в соответствии с родительским элементом
file-renaming-auto-rename-prompt-title = Настройки переимнования изменены
file-renaming-auto-rename-prompt-body = Хотите переименовать существующие файлы в вашей библиотеке в соответствии с новыми настройками?
file-renaming-auto-rename-prompt-yes = Предпросмотр изменений…
file-renaming-auto-rename-prompt-no = Сохранить существующие имена файлов
rename-files-preview =
    .buttonlabelaccept = Переименовать файлы
rename-files-preview-loading = Загрузка...
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
    .aria-label = Режим быстрого поиска
quicksearch-input =
    .aria-label = Быстрый поиск
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Показать как
item-pane-header-none =
    .label = Нет
item-pane-header-title =
    .label = Название
item-pane-header-titleCreatorYear =
    .label = Заглавие, Автор, Год
item-pane-header-bibEntry =
    .label = Библиографическая запись
item-pane-header-more-options =
    .label = Больше опций
item-pane-message-items-selected =
    { $count ->
        [0] Не выбран ни один элемент
        [one] { $count } элемент выбран
       *[other] { $count } элементов выбрано
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } коллекция выбрана
        [few] { $count } коллекции выбрано
        [many] { $count } коллекций выбрано
       *[other] { $count } коллекции выбрано
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } поиск выбран
        [few] { $count } поиска выбрано
        [many] { $count } поисков выбрано
       *[other] { $count } поиска выбрано
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } объект выбран
        [few] { $count } объекта выбрано
        [many] { $count } объектов выбрано
       *[other] { $count } объекта выбрано
    }
item-pane-message-unselected =
    { $count ->
        [0] В этом представлении нет элементов
        [one] { $count } элемент в этом представлении
        [few] { $count } элемента в этом представлении
        [many] { $count } элементов в этом представлении
       *[other] { $count } элемента в этом представлении
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] В этом представлении нет объектов
        [one] { $count } объект в этом представлении
        [few] { $count } объекта в этом представлении
        [many] { $count } объектов в этом представлении
       *[other] { $count } объекта в этом представлении
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Объединить { $count } элемент
            [few] Объединить { $count } элемента
            [many] Объединить { $count } элементов
           *[other] Объединить { $count } элемента
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = Switch to 64-bit { -app-name } for the best performance. Your data won’t be affected.
architecture-warning-action = Download 64-bit { -app-name }
architecture-x64-on-arm64-message = { -app-name } is running in emulated mode. A native version of { -app-name } will run more efficiently.
architecture-x64-on-arm64-action = Download { -app-name } for ARM64
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
        [one] Добавлен { $count } файл
        [few] Добавлено { $count } файла
        [many] Добавлено { $count } файлов
       *[other] Добавлено { $count } файла
    }
select-items-window =
    .title = Выбрать записи
select-items-dialog =
    .buttonlabelaccept = Select
select-items-convertToStandalone =
    .label = Convert to Standalone
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Преобразовать в отдельное вложение
            [few] Преобразовать в отдельные вложения
            [many] Преобразовать в отдельные вложения
           *[other] Преобразовать в отдельные вложения
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Преобразовать в отдельную заметку
            [few] Преобразовать в отдельные заметки
            [many] Преобразовать в отдельные заметки
           *[other] Преобразовать в отдельные заметки
        }
file-type-webpage = Webpage
file-type-image = Изображение
file-type-pdf = PDF
file-type-audio = Аудио
file-type-video = Видео
file-type-presentation = Презентация
file-type-document = Документ
file-type-ebook = Электронная книга
post-upgrade-message = You’ve been upgraded to <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Learn about <a data-l10n-name="new-features-link">what’s new</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Paste and Search
mac-word-plugin-install-message = Zotero необходим доступ к данным Word для установки плагина для Word.
mac-word-plugin-install-action-button =
    .label = Установить плагин для Word
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
file-renaming-banner-message = { -app-name } now automatically keeps attachment filenames in sync as you make changes to items.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = The { -app-name } Connector должен быть обновлён для работы с этой версией { -app-name }.
userjs-pref-warning = Some { -app-name } settings have been overridden using an unsupported method. { -app-name } will revert them and restart.
migrate-extra-fields-progress-message = Migrating new fields from Extra field
long-tag-fixer-window-title =
    .title = Разделить теги
long-tag-fixer-button-dont-split =
    .label = Не разделять
menu-normalize-attachment-titles =
    .label = Нормализовать заголовки вложений…
normalize-attachment-titles-title = Нормализовать заголовки вложений
normalize-attachment-titles-text =
    { -app-name } automatically renames files on disk using parent item metadata, but it uses separate, simpler titles such as “Full Text PDF”, “Preprint PDF”, or “PDF” for primary attachments to keep the items list cleaner and avoid duplicating information.
    
    In older versions of { -app-name }, as well as when using certain plugins, attachment titles could be changed unnecessarily to match the filenames.
    
    Would you like to update the selected attachments to use simpler titles? Only primary attachments with titles that match the filename will be changed.
