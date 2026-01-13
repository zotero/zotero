reader-annotations = Аннотации
reader-show-annotations = Показать аннотации
reader-search-annotations = Искать аннотации
reader-search-outline = Искать в сети
reader-no-annotations = Создайте аннотацию чтобы увидеть её в боковой панели
reader-no-extracted-text = Нет извлечённого текста
reader-add-comment = Добавить комментарий
reader-annotation-comment = Комментарий к аннотации
reader-annotation-text = Текст аннотации
reader-manage-tags = Управление тегами аннотации
reader-open-menu = Открыть меню аннотации
reader-thumbnails = Thumbnails
reader-tag-selector-message = Filter annotations by this tag
reader-add-tags = Добавить теги…
reader-highlight-text = Цветовыделить текст
reader-underline-text = Подчеркнуть текст
reader-add-note = Добавить заметку
reader-add-text = Добавить текст
reader-select-area = Выбрать область
reader-highlight-annotation = Highlight annotation
reader-underline-annotation = Underline annotation
reader-note-annotation = Note Annotation
reader-text-annotation = Text Annotation
reader-image-annotation = Image Annotation
reader-ink-annotation = Ink Annotation
reader-search-result-index = Search result
reader-search-result-total = Total search results
reader-draw = Рисовать
reader-eraser = Eraser
reader-pick-color = Выбрать цвет
reader-add-to-note = Добавить в заметку
reader-zoom-in = Увеличить
reader-zoom-out = Уменьшить
reader-zoom-reset = Масштаб 100%
reader-zoom-auto = Масштабировать автоматически
reader-zoom-page-width = По ширине страницы
reader-zoom-page-height = По высоте страницы
reader-split-vertically = Разделить вертикально
reader-split-horizontally = Разделить горизонтально
reader-next-page = Следующая страница
reader-previous-page = Предыдущая страница
reader-page = Страница
reader-location = Положение
reader-read-only = Только чтение
reader-prompt-transfer-from-pdf-title = Импорт аннотаций
reader-prompt-transfer-from-pdf-text = Annotations stored in the PDF file will be moved to { $target }.
reader-prompt-password-protected = Операция не поддерживается для файлов PDF, защищённых паролем.
reader-prompt-delete-pages-title = Удалить страницы
reader-prompt-delete-pages-text =
    { $count ->
        [one] Are you sure you want to delete { $count } page from the PDF file?
       *[other] Are you sure you want to delete { $count } pages from the PDF file?
    }
reader-prompt-delete-annotations-title = Delete Annotations
reader-prompt-delete-annotations-text =
    { $count ->
        [one] Are you sure you want to delete the selected annotation?
       *[other] Are you sure you want to delete the selected annotations?
    }
reader-rotate-left = Повернуть влево
reader-rotate-right = Повернуть вправо
reader-edit-page-number = Изменить номер страницы…
reader-edit-annotation-text = Редактировать текст аннотации
reader-copy-image = Скопировать изображение
reader-save-image-as = Сохранить изображение как…
reader-page-number-popup-header = Изменить номер страницы для:
reader-this-annotation = Эта заметка
reader-selected-annotations = Выбранные заметки
reader-this-page = Эта страница
reader-this-page-and-later-pages = Эта и следующие страницы
reader-all-pages = Все страницы
reader-auto-detect = Автоопределение
reader-enter-password = Введите пароль чтобы открыть этот PDF-файл
reader-include-annotations = Включая аннотации
reader-preparing-document-for-printing = Подготовка документа к печати…
reader-phrase-not-found = Фраза не найдена
reader-find = Найти
reader-close = Закрыть
reader-show-thumbnails = Show Thumbnails
reader-show-outline = Show Outline
reader-find-previous = Find the previous occurrence of the phrase
reader-find-next = Find the next occurrence of the phrase
reader-toggle-sidebar = Toggle Sidebar
reader-find-in-document = Find in Document
reader-toggle-context-pane = Toggle Context Pane
reader-highlight-all = Highlight all
reader-match-case = Match case
reader-whole-words = Whole words
reader-appearance = Внешни вид
reader-epub-appearance-line-height = Межстрочный интервал
reader-epub-appearance-word-spacing = Интервалы между словами
reader-epub-appearance-letter-spacing = Межбуквенные интервалы
reader-epub-appearance-page-width = Ширина страницы
reader-epub-appearance-use-original-font = Использовать шрифт оригинала
reader-epub-appearance-line-height-revert = Use default line height
reader-epub-appearance-word-spacing-revert = Use default word spacing
reader-epub-appearance-letter-spacing-revert = Use default letter spacing
reader-epub-appearance-page-width-revert = Use default page width
reader-convert-to-highlight = Convert to Highlight
reader-convert-to-underline = Convert to Underline
reader-size = Размер
reader-merge = Слить
reader-copy-link = Копировать ссылку
reader-theme-original = Оригинал
reader-theme-snow = Снег
reader-theme-sepia = Сепия
reader-theme-dark = Темная
reader-add-theme = Добавить вариант оформления
reader-scroll-mode = Прокрутка
reader-spread-mode = Spreads
reader-flow-mode = Расположение страниц
reader-columns = Колонки
reader-split-view = Колонками
reader-themes = Оформление
reader-vertical = Вертикально
reader-horizontal = Горизонтально
reader-wrapped = Wrapped
reader-none = Нет
reader-odd = Нечетные
reader-even = Четные
reader-paginated = Постранично
reader-scrolled = С прокруткой
reader-single = Single
reader-double = Double
reader-theme-name = Название темы:
reader-background = Фон:
reader-foreground = Foreground:
reader-reading-mode = Режим чтения
reader-reading-mode-not-supported = Reading Mode is not supported in this document.
reader-clear-selection = Отменить выбор
reader-epub-encrypted = This ebook is encrypted and cannot be opened.
reader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
reader-a11y-move-annotation = Use the arrow keys to move the annotation.
reader-a11y-edit-text-annotation = To move the end of the text annotation, hold { general-key-shift } and use the left/right arrow keys. To move the start of the annotation, hold { general-key-shift }-{ reader-move-annotation-start-key } and use the arrow keys.
reader-a11y-resize-annotation = To resize the annotation, hold { general-key-shift } and use the arrow keys.
reader-a11y-annotation-popup-appeared = Use Tab to navigate the annotation popup.
reader-a11y-annotation-created = { $type } created.
reader-a11y-annotation-selected = { $type } selected.
-reader-a11y-textual-annotation-instruction = To annotate text via the keyboard, first use “{ reader-find-in-document }” to locate the phrase, and then press { general-key-control }-{ option-or-alt }-{ $number } to turn the search result into an annotation.
-reader-a11y-annotation-instruction = To add this annotation into the document, focus the document and press { general-key-control }-{ option-or-alt }-{ $number }.
reader-toolbar-highlight =
    .aria-description = { -reader-a11y-textual-annotation-instruction(number: 1) }
    .title = { reader-highlight-text }
reader-toolbar-underline =
    .aria-description = { -reader-a11y-textual-annotation-instruction(number: 2) }
    .title = { reader-underline-text }
reader-toolbar-note =
    .aria-description = { -reader-a11y-annotation-instruction(number: 3) }
    .title = { reader-note-annotation }
reader-toolbar-text =
    .aria-description = { -reader-a11y-annotation-instruction(number: 4) }
    .title = { reader-add-text }
reader-toolbar-area =
    .aria-description = { -reader-a11y-annotation-instruction(number: 5) }
    .title = { reader-select-area }
reader-toolbar-draw =
    .aria-description = This annotation type cannot be created via the keyboard.
    .title = { reader-draw }
reader-find-in-document-input =
    .title = Найти
    .placeholder = { reader-find-in-document }
    .aria-description = To turn a search result into a highlight annotation, press { general-key-control }-{ option-or-alt }-1. To turn a search result into an underline annotation, press { general-key-control }-{ option-or-alt }-2.
reader-import-from-epub =
    .label = Import Ebook Annotations…
reader-import-from-epub-prompt-title = Import Ebook Annotations
reader-import-from-epub-prompt-text =
    { -app-name } found { $count ->
        [one] { $count } { $tool } annotation
       *[other] { $count } { $tool } annotations
    }, last edited { $lastModifiedRelative }.
    
    Any { -app-name } annotations that were previously imported from this ebook will be updated.
reader-import-from-epub-no-annotations-current-file =
    This ebook does not appear to contain any importable annotations.
    
    { -app-name } can import ebook annotations created in Calibre and KOReader.
reader-import-from-epub-no-annotations-other-file =
    “{ $filename }” does not appear to contain any Calibre or KOReader annotations.
    
    If this ebook has been annotated with KOReader, try selecting a “metadata.epub.lua” file directly.
reader-import-from-epub-select-other = Select Other File…
reader-selected-pages =
    { $count ->
        [one] 1 page selected
       *[other] { $count } pages selected
    }
reader-page-options = Page Options
