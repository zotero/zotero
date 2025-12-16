reader-annotations = 注釈
reader-show-annotations = 注釈を表示する
reader-search-annotations = 注釈を検索する
reader-search-outline = Search Outline
reader-no-annotations = 注釈はこのサイドバーに表示されます
reader-no-extracted-text = 抽出された文字がありません
reader-add-comment = コメントを追加する
reader-annotation-comment = Annotation comment
reader-annotation-text = Annotation text
reader-manage-tags = Manage tags for this annotation
reader-open-menu = Open annotation menu
reader-thumbnails = Thumbnails
reader-tag-selector-message = Filter annotations by this tag
reader-add-tags = タグを追加する…
reader-highlight-text = テキストを強調表示
reader-underline-text = 下線
reader-add-note = メモを追加
reader-add-text = Add Text
reader-select-area = エリアを選択する
reader-highlight-annotation = Highlight annotation
reader-underline-annotation = Underline annotation
reader-note-annotation = Note Annotation
reader-text-annotation = Text Annotation
reader-image-annotation = Image Annotation
reader-ink-annotation = Ink Annotation
reader-search-result-index = Search result
reader-search-result-total = Total search results
reader-draw = Draw
reader-eraser = Eraser
reader-pick-color = 色を選んでください
reader-add-to-note = メモに追加する
reader-zoom-in = 拡大表示
reader-zoom-out = 縮小表示
reader-zoom-reset = Reset Zoom
reader-zoom-auto = 自動的にサイズ変更
reader-zoom-page-width = ページ幅に合わせる
reader-zoom-page-height = ページの高さに合わせる
reader-split-vertically = 垂直方向に分割する
reader-split-horizontally = 水平方向に分割する
reader-next-page = 次のページ
reader-previous-page = 前のページ
reader-page = ページ
reader-location = Location
reader-read-only = 読みだけように
reader-prompt-transfer-from-pdf-title = 注釈をインポートする
reader-prompt-transfer-from-pdf-text = Annotations stored in the PDF file will be moved to { $target }.
reader-prompt-password-protected = The operation is not supported for password-protected PDF files.
reader-prompt-delete-pages-title = ページを削除する
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
reader-rotate-left = 左に回転する
reader-rotate-right = 右に回転する
reader-edit-page-number = ページの番号を編集する…
reader-edit-annotation-text = Edit Annotation Text
reader-copy-image = 画像をコピーする
reader-save-image-as = ファイル形式を指定して画像を保存する…
reader-page-number-popup-header = ページの番号を変更:
reader-this-annotation = この注釈
reader-selected-annotations = 選択された注釈
reader-this-page = このページ
reader-this-page-and-later-pages = このページとその後のページ
reader-all-pages = すべてのページ
reader-auto-detect = 自動検出
reader-enter-password = Enter the password to open this PDF file
reader-include-annotations = Include annotations
reader-preparing-document-for-printing = Preparing document for printing…
reader-phrase-not-found = Phrase not found
reader-find = 検索
reader-close = 閉じる
reader-show-thumbnails = Show Thumbnails
reader-show-outline = Show Outline
reader-find-previous = Find the previous occurrence of the phrase
reader-find-next = Find the next occurrence of the phrase
reader-toggle-sidebar = サイドバーの表示を切り替える
reader-find-in-document = Find in Document
reader-toggle-context-pane = Toggle Context Pane
reader-highlight-all = Highlight all
reader-match-case = Match case
reader-whole-words = Whole words
reader-appearance = Appearance
reader-epub-appearance-line-height = Line height
reader-epub-appearance-word-spacing = Word spacing
reader-epub-appearance-letter-spacing = Letter spacing
reader-epub-appearance-page-width = Page width
reader-epub-appearance-use-original-font = Use original font
reader-epub-appearance-line-height-revert = Use default line height
reader-epub-appearance-word-spacing-revert = Use default word spacing
reader-epub-appearance-letter-spacing-revert = Use default letter spacing
reader-epub-appearance-page-width-revert = Use default page width
reader-convert-to-highlight = Convert to Highlight
reader-convert-to-underline = Convert to Underline
reader-size = サイズ
reader-merge = Merge
reader-copy-link = Copy Link
reader-theme-original = Original
reader-theme-snow = Snow
reader-theme-sepia = Sepia
reader-theme-dark = Dark
reader-add-theme = Add Theme
reader-scroll-mode = Scrolling
reader-spread-mode = Spreads
reader-flow-mode = Page Layout
reader-columns = コラム
reader-split-view = Split View
reader-themes = Themes
reader-vertical = Vertical
reader-horizontal = Horizontal
reader-wrapped = Wrapped
reader-none = なし
reader-odd = Odd
reader-even = Even
reader-paginated = Paginated
reader-scrolled = Scrolled
reader-single = Single
reader-double = Double
reader-theme-name = Theme Name:
reader-background = Background:
reader-foreground = Foreground:
reader-reading-mode = Reading Mode
reader-reading-mode-not-supported = Reading Mode is not supported in this document.
reader-clear-selection = 選択の解除
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
    .title = 検索
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
