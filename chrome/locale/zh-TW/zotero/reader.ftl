reader-annotations = 標註
reader-show-annotations = 顯示標註
reader-search-annotations = 搜尋標註
reader-search-outline = 搜尋概要
reader-no-annotations = 建立標註以在側邊欄中查看
reader-no-extracted-text = 無擷取的文字
reader-add-comment = 新增評論
reader-annotation-comment = 標註評論
reader-annotation-text = 標註文字
reader-manage-tags = 管理這個標註的標籤
reader-open-menu = 開啓標註選單
reader-thumbnails = 縮圖
reader-tag-selector-message = 用這個標籤來篩選標註
reader-add-tags = 新增標籤……
reader-highlight-text = 突顯文字
reader-underline-text = 底線文字
reader-add-note = 新增筆記
reader-add-text = 新增文字
reader-select-area = 選擇區域
reader-highlight-annotation = 凸顯標註
reader-underline-annotation = 底線標註
reader-note-annotation = 筆記標註
reader-text-annotation = 文字標註
reader-image-annotation = 圖片標註
reader-ink-annotation = Ink Annotation
reader-search-result-index = 搜尋結果
reader-search-result-total = 全部搜尋結果
reader-draw = 繪圖
reader-eraser = 橡皮擦
reader-pick-color = 選擇一個顏色
reader-add-to-note = 新增到筆記
reader-zoom-in = 放大
reader-zoom-out = 縮小
reader-zoom-reset = 重設縮放
reader-zoom-auto = 自動調整大小
reader-zoom-page-width = 縮放到頁面寬度
reader-zoom-page-height = 縮放到頁面高度
reader-split-vertically = 垂直分割
reader-split-horizontally = 水平分割
reader-next-page = 下一頁
reader-previous-page = 上一頁
reader-page = 頁
reader-location = 定位
reader-read-only = 唯讀
reader-prompt-transfer-from-pdf-title = 匯入標註
reader-prompt-transfer-from-pdf-text = Annotations stored in the PDF file will be moved to { $target }.
reader-prompt-password-protected = 不支援在加密的 PDF 檔案中進行此動作
reader-prompt-delete-pages-title = 刪除頁面
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
reader-rotate-left = 向左旋轉
reader-rotate-right = 向右旋轉
reader-edit-page-number = 編輯頁碼……
reader-edit-annotation-text = 編輯標註文字
reader-copy-image = 複製圖片
reader-save-image-as = 另存圖片為……
reader-page-number-popup-header = 為其更改頁碼：
reader-this-annotation = 這個標註
reader-selected-annotations = 選定的標註
reader-this-page = 這一頁面
reader-this-page-and-later-pages = 這一頁面和之後的頁面
reader-all-pages = 所有的頁面
reader-auto-detect = 自動檢查
reader-enter-password = 請輸入密碼來開啟這個PDF檔
reader-include-annotations = 包括標註
reader-preparing-document-for-printing = 準備列印文件……
reader-phrase-not-found = 未找到關鍵字
reader-find = 尋找
reader-close = 關閉
reader-show-thumbnails = 顯示縮圖
reader-show-outline = 顯示概要
reader-find-previous = 尋找此詞語上次出現的地方
reader-find-next = 尋找此詞語下次出現的地方
reader-toggle-sidebar = 切換側邊欄
reader-find-in-document = 在文件中尋找
reader-toggle-context-pane = 切換上下文窗格
reader-highlight-all = 突顯全部
reader-match-case = 區分大小寫
reader-whole-words = 完整詞語
reader-appearance = 外觀
reader-epub-appearance-line-height = 行高
reader-epub-appearance-word-spacing = 字間距
reader-epub-appearance-letter-spacing = 字母間距
reader-epub-appearance-page-width = 頁面寬度
reader-epub-appearance-use-original-font = 使用原始字型
reader-epub-appearance-line-height-revert = 使用預設行高
reader-epub-appearance-word-spacing-revert = 使用預設字間距
reader-epub-appearance-letter-spacing-revert = 使用預設字母間距
reader-epub-appearance-page-width-revert = 使用預設頁面寬度
reader-convert-to-highlight = 轉換成標亮
reader-convert-to-underline = 轉換成底線
reader-size = 大小
reader-merge = 合併
reader-copy-link = 複製連結
reader-theme-original = 原文：%S
reader-theme-snow = 冰雪
reader-theme-sepia = 深褐
reader-theme-dark = 暗色
reader-add-theme = 新增主題
reader-scroll-mode = 捲動
reader-spread-mode = 延展
reader-flow-mode = 頁面版面
reader-columns = 直欄
reader-split-view = 分割檢視
reader-themes = 主題
reader-vertical = 垂直
reader-horizontal = 水平
reader-wrapped = 換航
reader-none = 無
reader-odd = Odd
reader-even = Even
reader-paginated = 頁碼標註的
reader-scrolled = 捲動的
reader-single = Single
reader-double = Double
reader-theme-name = Theme Name:
reader-background = Background:
reader-foreground = Foreground:
reader-focus-mode = Focus Mode
reader-clear-selection = 清除所選
reader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
reader-a11y-move-annotation = 使用方向鍵來移動標註。
reader-a11y-edit-text-annotation = To move the end of the text annotation, hold { general-key-shift } and use the left/right arrow keys. To move the start of the annotation, hold { general-key-shift }-{ reader-move-annotation-start-key } and use the arrow keys.
reader-a11y-resize-annotation = To resize the annotation, hold { general-key-shift } and use the arrow keys.
reader-a11y-annotation-popup-appeared = 使用 Tab 鍵瀏覽標註的彈出視窗。
reader-a11y-annotation-created = 已建立 { $type } 。
reader-a11y-annotation-selected = 已選擇 { $type } 。
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
    .title = 尋找
    .placeholder = { reader-find-in-document }
    .aria-description = To turn a search result into a highlight annotation, press { general-key-control }-{ option-or-alt }-1. To turn a search result into an underline annotation, press { general-key-control }-{ option-or-alt }-2.
reader-import-from-epub =
    .label = 匯入 Ebook 標註...
reader-import-from-epub-prompt-title = 匯入 Ebook 標註
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
reader-import-from-epub-select-other = 選擇其他檔案...
reader-selected-pages =
    { $count ->
        [one] 1 page selected
       *[other] { $count } pages selected
    }
reader-page-options = Page Options
