integration-docPrefs-window =
    .title = { -app-name } - Настройки документа
integration-addEditCitation-window =
    .title = { -app-name } - Добавить/редактировать цитирование
integration-editBibliography-window =
    .title = { -app-name } - Редактировать библиографию
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Изменить отсылку
-integration-editBibliography-include-uncited = Чтобы включить нецитируемый элемент в свою библиографию, выберите его из списка элементов и нажмите { general-add }.
-integration-editBibliography-exclude-cited = Вы можете исключить цитируемый элемент, выбрав его из списка литературы и нажав { general-remove }.
-integration-editBibliography-edit-reference = Чтобы изменить формат отсылки, используйте текстовый редактор.
integration-editBibliography-wrapper =
    .aria-label = Диалог Редактирования Библиографии
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Диалог цитирования
integration-citationDialog-section-open = Открыть документы ({ $count })
integration-citationDialog-section-selected = Выбрано ({ $count }/{ $total }) записей
integration-citationDialog-section-selectedAnnotations = Выбранные аннотации
integration-citationDialog-section-selectedItems = Выбрать записи
integration-citationDialog-section-cited =
    { $count ->
        [0] записей процитированно
       *[other] ({ $count })
    }
integration-citationDialog-details-suffix = Суффикс
integration-citationDialog-details-prefix = Префикс
integration-citationDialog-details-suppressAuthor = Не выводить автора
integration-citationDialog-details-locator-info = Tip: You can also type page numbers and other locators directly into the main field. <a data-l10n-name="docs-link">Learn more</a>
integration-citationDialog-details-includeComments = Добавить комментарии
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Настройки цитирования
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] Ни один выбранный, открытый или цитируемый элемент не соответствует текущему поиску.
       *[other] Нет выбранных или открытых элементов
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] Ни одна выбранная заметка не соответствует текущему поиску.
       *[other] Заметки не выбраны
    }
integration-citationDialog-lib-message-annotations =
    { $search ->
       *[true] Нет элементов с аннотациями, которые совпадают с текущим поиском
    }
integration-citationDialog-settings-keepSorted = Удерживать источники отсортированными
integration-citationDialog-preview-empty = Предпросмотр
integration-citationDialog-preview-error = Preview unavailable
integration-citationDialog-btn-displayPreview =
    .title = Display citation preview
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = Библиотека
integration-citationDialog-mode-list = Список
integration-citationDialog-btn-type-citation =
    .title = Добавить/редактировать цитирование
integration-citationDialog-btn-type-add-note =
    .title = Добавить заметку
integration-citationDialog-btn-type-annotations =
    .title = Добавить аннотации
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Используйте стрелки влево/вправо для навигации по пунктам этой цитаты. Нажмите Tab, чтобы выбрать элементы для добавления к этой цитате.
integration-citationDialog-enter-to-add-item = Нажмите { return-or-enter }, чтобы добавить этот элемент в цитату.
integration-citationDialog-search-for-items = Найти элементы, которые можно добавить в цитату
integration-citationDialog-aria-bubble =
    .aria-description = Этот элемент включён в цитату. Нажмите Пробел, чтобы настроить элемент. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Нажмите Tab для выбора записей, которые будут добавлены к цитированию. Нажмите Escape, чтобы отменить изменения и закрыть диалог.
integration-citationDialog-just-added-input-placeholder = Type “10-15” to cite pages, or search for items
integration-citationDialog-just-added-input-citation =
    .placeholder = { $placeholder }
    .title = { $title }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Найти заметку для вставки в документ
integration-citationDialog-single-input-annotations =
    .placeholder = Искать аннотации для вставки в документ
integration-citationDialog-aria-item-list =
    .aria-description = Используйте клавиши стрелок вверх/вниз для изменения выбора записей. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Используйте клавиши стрелок вправо/влево для изменения выбора записей. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Коллекции.
    .aria-description = Выберите коллекцию и нажмите Tab для навигации по её записям.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = Этот элемент был добавлен в цитату. Нажмите { return-or-enter }, чтобы добавить его снова, или { delete-or-backspace }, чтобы удалить его.
integration-citationDialog-add-all = Добавить все
integration-citationDialog-collapse-section =
    .title = Свернуть секцию
integration-citationDialog-bubble-empty = (нет названия)
integration-citationDialog-add-to-citation = Добавить в Цитату
integration-citationDialog-annotations-filter =
    .placeholder = Фильтровать аннотации
integration-citationDialog-annotations-empty = Выберите запись, вложение или аннотацию, чтобы просмотреть детали аннотации
integration-prefs-displayAs-label = Отобразить Цитаты как:
integration-prefs-footnotes =
    .label = Сноски
integration-prefs-endnotes =
    .label = Концевые сноски
integration-prefs-bookmarks =
    .label = Хранить Цитаты как закладки
integration-prefs-bookmarks-description = Закладки могут использоваться совместно Word и LibreOffice, но при случайном изменении могут вызвать ошибки и не могут быть вставлены в концевые сноски.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Документ должен быть сохранён как .doc или .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Авто-обновлять Цитаты
    .tooltip = Цитаты, ожидающие обновления, будут выделены в документе
integration-prefs-automaticCitationUpdates-description = Отключите обновление библиографии, это ускорит вставку цитат в большие документы. Нажимайте «Обновить», чтобы обновить цитаты вручную.
integration-prefs-automaticJournalAbbeviations =
    .label = Исп-ть MEDLINE аббревиатуры
integration-prefs-automaticJournalAbbeviations-description = Поле «Сокращ. журнала» будет проигнорировано.
integration-prefs-exportDocument =
    .label = Переключиться на другой Текстовый Процессор…
integration-error-unable-to-find-winword = { -app-name } не может обнаружить запущенный процесс Word.
integration-warning-citation-changes-will-be-lost = Вы внесли изменения в цитату, которые будут потеряны, если вы продолжите.
integration-warning-bibliography-changes-will-be-lost = Вы внесли изменения в библиографию, которые будут потеряны, если вы продолжите.
integration-warning-documentPreferences-changes-will-be-lost = Вы внесли изменения в настройки документа, которые будут потеряны, если вы продолжите.
integration-warning-discard-changes = Отменить изменения
integration-warning-command-is-running = Команда интеграции Текстового Процессора уже запущена.
first-run-guidance-citationDialog =
    Click the bubble or use the ← and ↓ keys to view the citation details and customize options such as page number, prefix, and suffix.
    
    You can also add a page number or other locator by including it with your search terms (e.g., “history { $locator }”) or by typing it after the bubble and pressing { return-or-enter }.
