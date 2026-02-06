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
    .aria-label = Edit reference
-integration-editBibliography-include-uncited = To include an uncited item in your bibliography, select it from the items list and press { general-add }.
-integration-editBibliography-exclude-cited = You can also exclude a cited item by selecting it from the list of references and pressing { general-remove }.
-integration-editBibliography-edit-reference = To change how a reference is formatted, use the text editor.
integration-editBibliography-wrapper =
    .aria-label = Диалог редактирования библиографии
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Диалог цитирования
integration-citationDialog-section-open = Открыть документы ({ $count })
integration-citationDialog-section-selected = Выбрано ({ $count }/{ $total }) записей
integration-citationDialog-section-cited =
    { $count ->
        [0] записей процитированно
       *[other] ({ $count })
    }
integration-citationDialog-details-suffix = Суффикс
integration-citationDialog-details-prefix = Префикс
integration-citationDialog-details-suppressAuthor = Не выводить автора
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Настройки цитирования
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] No selected, open, or cited items match the current search
       *[other] No selected or open items
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] No selected notes match the current search
       *[other] No notes are selected
    }
integration-citationDialog-settings-keepSorted = Keep sources sorted
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = Библиотека
integration-citationDialog-mode-list = Список
integration-citationDialog-btn-type-citation =
    .title = Добавить/редактировать цитирование
integration-citationDialog-btn-type-add-note =
    .title = Добавить заметку
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Use Left/Right-Arrow to navigate the items of this citation. Press Tab to select items to add to this citation.
integration-citationDialog-enter-to-add-item = Press { return-or-enter } to add this item to the citation.
integration-citationDialog-search-for-items = Search for items to add to the citation
integration-citationDialog-aria-bubble =
    .aria-description = This item is included in the citation. Press space bar to customize the item. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Нажмите Tab для выбора записей, которые будут добавлены к цитированию. Нажмите Escape, чтобы отменить изменения и закрыть диалог.
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Найти заметку для вставки в документ
integration-citationDialog-aria-item-list =
    .aria-description = Используйте клавиши стрелок вверх/вниз для изменения выбора записей. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Используйте клавиши стрелок вправо/влево для изменения выбора записей. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Collections.
    .aria-description = Выберите коллекцию и нажмите Tab для навигации по её записям.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = This item has been added to the citation. Press { return-or-enter } to add it again or { delete-or-backspace } to remove it.
integration-citationDialog-add-all = Добавить все
integration-citationDialog-collapse-section =
    .title = Collapse section
integration-citationDialog-bubble-empty = (no title)
integration-citationDialog-add-to-citation = Add to Citation
integration-prefs-displayAs-label = Отобразить цитаты как:
integration-prefs-footnotes =
    .label = Сноски
integration-prefs-endnotes =
    .label = Концевые сноски
integration-prefs-bookmarks =
    .label = Хранить цитирования как закладки
integration-prefs-bookmarks-description = Механизм закладок будет работать и в Word, и в LibreOffice, но может вызывать внезапные ошибки, также он не позволяет использовать ссылки в сносках.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Документ должен быть сохранён как .doc или .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Автоматически обновлять ссылки и библиографии
    .tooltip = Ссылки, ожидающие обновления, будут выделены в документе
integration-prefs-automaticCitationUpdates-description = Отключение обновления библиографии может ускорить вставку цитирования в большие документы. Нажимайте «Обновить», чтобы обновить цитирование вручную.
integration-prefs-automaticJournalAbbeviations =
    .label = Использовать сокращённые названия журналов MEDLINE
integration-prefs-automaticJournalAbbeviations-description = Поле «Сокращ. журнала» будет проигнорировано.
integration-prefs-exportDocument =
    .label = Переключиться на другой текстовый редактор…
integration-error-unable-to-find-winword = { -app-name } не может обнаружить запущенный процесс Word.
integration-warning-citation-changes-will-be-lost = Вы внесли изменения в цитирование, которые будут потеряны, если вы продолжите.
integration-warning-bibliography-changes-will-be-lost = Вы внесли изменения в библиографию, которые будут потеряны, если вы продолжите.
integration-warning-documentPreferences-changes-will-be-lost = Вы внесли изменения в настройки документа, которые будут потеряны, если вы продолжите.
integration-warning-discard-changes = Отменить изменения
integration-warning-command-is-running = A word processor integration command is already running.
first-run-guidance-citationDialog =
    Введите название, автора и/или год для поиска референса.
    
    Чтобы выбрать запись, нажмите на неё или выберите с помощью клавиатуры и нажмите ↓/Space, чтобы показать опции цитирования, такие как номер страницы, префикс и суффикс.
    
    Также, вы можете добавить номер страницы или другой локатор, включив его в ваш поисковый запрос (напр., “история { $locator }”) или введя его после выбора записи, нажав { return-or-enter }.
