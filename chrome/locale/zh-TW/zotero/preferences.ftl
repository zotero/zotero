preferences-window =
    .title = { -app-name } 設定
preferences-appearance-title = 外觀和語言
preferences-auto-recognize-files =
    .label = 自動為 PDF 檔與電子書取得屬性資料
preferences-file-renaming-title = 文件重新命名
preferences-file-renaming-intro = { -app-name } can automatically rename files based on the details of the parent item (title, author, etc.) and keep the filenames in sync as you make changes. Downloaded files are always initially named based on the parent item.
preferences-file-renaming-auto-rename-files =
    .label = Automatically rename files
preferences-file-renaming-file-types = 重新命名這些類型的檔案
preferences-file-renaming-file-type-pdf =
    .label = { file-type-pdf }
preferences-file-renaming-file-type-epub =
    .label = { file-type-ebook }
preferences-file-renaming-file-type-image =
    .label = { file-type-image }
preferences-file-renaming-file-type-audio =
    .label = { file-type-audio }
preferences-file-renaming-file-type-video =
    .label = { file-type-video }
preferences-file-renaming-customize-button =
    .label = 自定義檔案名稱格式……
preferences-file-renaming-rename-now =
    .label = Rename Files…
preferences-file-renaming-format-title = 檔案名稱格式
preferences-file-renaming-format-instructions = 您可以自定義檔案名稱模式，{ -app-name } 根據此模式從父項目屬性資料重新命名附件檔案。
preferences-file-renaming-format-instructions-example = 例如，模板中的“{ $example }”將替換為父項目的標題，並在第50個字元處截斷。
preferences-file-renaming-format-instructions-more = 請參閱<label data-l10n-name="file-renaming-format-help-link">文件</label>以獲得更多資訊。
preferences-file-renaming-format-template = 檔案名稱模板：
preferences-file-renaming-format-preview = 預覽:
preferences-attachment-titles-title = Attachment Titles
preferences-attachment-titles-intro = Attachment titles are <label data-l10n-name="wiki-link">different from filenames</label>. To support some workflows, { -app-name } can show filenames instead of attachment titles in the items list.
preferences-attachment-titles-show-filenames =
    .label = Show attachment filenames in the items list
preferences-reader-title = 閱讀器
preferences-reader-open-epubs-using = 開啟 EPUBs 使用
preferences-reader-open-snapshots-using = 開啟網頁快照使用
preferences-reader-open-in-new-window =
    .label = 在新視窗而不是分頁中打開檔案
preferences-reader-auto-disable-tool =
    .label = Turn off note, text, and image annotation tools after each use
preferences-reader-ebook-font = Ebook字體:
preferences-reader-ebook-hyphenate =
    .label = 啟用自動連字
preferences-note-title = 筆記
preferences-note-open-in-new-window =
    .label = Open notes in new windows instead of tabs
preferences-color-scheme = 配色方案:
preferences-color-scheme-auto =
    .label = 自動
preferences-color-scheme-light =
    .label = 亮色
preferences-color-scheme-dark =
    .label = 暗色
preferences-item-pane-header = 項目窗格的標頭:
preferences-item-pane-header-style = 標頭引用文獻樣式:
preferences-item-pane-header-locale = 標頭語言:
preferences-item-pane-header-missing-style = 缺少樣式:<{ $shortName }>
preferences-locate-library-lookup-intro = 文獻庫檢索可以使用您文獻庫的OpenURL解析器來線上尋找資源。
preferences-locate-resolver = 解析器:
preferences-locate-base-url = 基礎網址:
preferences-quickCopy-minus =
    .aria-label = { general-remove }
    .label = { $label }
preferences-quickCopy-plus =
    .aria-label = { general-add }
    .label = { $label }
preferences-styleManager-intro = { -app-name } can generate citations and bibliographies in over 10,000 citation styles. Add styles here to make them available when selecting styles throughout { -app-name }.
preferences-styleManager-get-additional-styles =
    .label = Get Additional Styles…
preferences-styleManager-restore-default =
    .label = Restore Default Styles…
preferences-styleManager-add-from-file =
    .tooltiptext = 從檔案新增一個樣式
    .label = Add from File…
preferences-styleManager-remove = Press { delete-or-backspace } to remove this style.
preferences-citation-dialog = Citation Dialog
preferences-citation-dialog-mode = Citation Dialog Mode:
preferences-citation-dialog-mode-last-used =
    .label = Last Used
preferences-citation-dialog-mode-list =
    .label = List Mode
preferences-citation-dialog-mode-library =
    .label = Library Mode
preferences-advanced-enable-local-api =
    .label = 允許此電腦上的其他應用程式與 { -app-name } 通訊
preferences-advanced-local-api-available = Available at <code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = { -app-name } 的 HTTP 伺服器已停止。
preferences-advanced-server-enable-and-restart =
    .label = 啟用並重新啟動
preferences-advanced-language-and-region-title = 語言與區域
preferences-advanced-enable-bidi-ui =
    .label = 啟用雙向文字編輯應用程式
preferences-advanced-reset-data-dir =
    .label = Revert to Default Location…
preferences-advanced-custom-data-dir =
    .label = 使用自訂位置...
preferences-advanced-default-data-dir =
    .value = （預設： { $directory } ）
    .aria-label = 預設位置
preferences-sync-reset-restore-to-server-body = { -app-name } will replace “{ $libraryName }” on { $domain } with data from this computer.
preferences-sync-reset-restore-to-server-deleted-items-text =
    { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] item
       *[other] items
    } in the online library will be permanently deleted.
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] The library on this computer and the online library will be empty.
        [one] 1 item will remain on this computer and in the online library.
       *[other] { $localItemsCount } items will remain on this computer and in the online library.
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
        [one] Delete 1 item
       *[other] Delete { $remoteItemsDeletedCount } items
    }
preferences-sync-reset-restore-to-server-confirmation-text = delete online library
preferences-sync-reset-restore-to-server-yes = 換掉線上文獻庫中的資料
