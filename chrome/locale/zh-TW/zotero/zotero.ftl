general-sentence-separator = { "" }
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
general-print = 列印
general-remove = 移除
general-add = 新增
general-remind-me-later = 稍後提醒我
general-dont-ask-again = 不要再詢問
general-choose-file = 選擇檔案……
general-open-settings = 打開設定
general-settings = Settings…
general-help = 說明
general-tag = 標籤
general-done = 完成
general-view-troubleshooting-instructions = 查看故障排除說明
general-go-back = 回到上一層
general-accept = Accept
general-cancel = 取消
general-show-in-library = 在文獻庫中顯示
general-restartApp = Restart { -app-name }
general-restartInTroubleshootingMode = 以除錯模式重新啟動
general-save = 儲存
general-clear = 清除
general-update = 更新
general-back = 後退
general-edit = 編輯
general-cut = 剪下
general-copy = 複製
general-paste = 貼上
general-find = 尋找
general-delete = 刪除
general-insert = 插入
general-and = 與
general-et-al = …等
general-previous = 上一步
general-next = 下一步
general-learn-more = 了解更多
general-warning = 警告
general-type-to-continue = Type “{ $text }” to continue.
general-continue = 繼續
general-red = 紅色
general-orange = 橘色
general-yellow = 黃色
general-green = 綠色
general-teal = 鴨綠色
general-blue = 藍色
general-purple = 紫色
general-magenta = 洋紅色
general-violet = 紫羅蘭色
general-maroon = 栗色
general-gray = 灰色
general-black = 黑色
citation-style-label = 引用文獻樣式:
language-label = 語言：
menu-custom-group-submenu =
    .label = More Options…
menu-file-show-in-finder =
    .label = 在搜尋器中顯示
menu-file-show-file =
    .label = 顯示檔案
menu-file-show-files =
    .label = 顯示檔案
menu-print =
    .label = { general-print }
menu-density =
    .label = 密度
add-attachment = 新增附件
new-note = 新增筆記
menu-add-by-identifier =
    .label = 依辨識符號新增……
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = 新增檔案……
menu-add-standalone-linked-file-attachment =
    .label = 新增檔案連結……
menu-add-child-file-attachment =
    .label = 附加檔案……
menu-add-child-linked-file-attachment =
    .label = 附加到檔案的連結……
menu-add-child-linked-url-attachment =
    .label = 附加網頁連結……
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = 新增獨立筆記
menu-new-item-note =
    .label = 新的項目筆記
menu-restoreToLibrary =
    .label = 還原到文獻庫中
menu-deletePermanently =
    .label = 永久刪除……
menu-tools-plugins =
    .label = 附加元件
menu-view-columns-move-left =
    .label = 此欄向左移動
menu-view-columns-move-right =
    .label = 此欄向右移動
menu-view-note-font-size =
    .label = 筆記字型大小
menu-view-note-tab-font-size =
    .label = Note Tab Font Size
menu-show-tabs-menu =
    .label = Show Tabs Menu
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Copy Annotation
           *[other] Copy { $count } Annotations
        }
main-window-command =
    .label = 文獻庫
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = 列出所有分頁
filter-collections = 篩選文獻集
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = 搜尋分頁
zotero-tabs-menu-close-button =
    .title = 關閉分頁
zotero-toolbar-tabs-scroll-forwards =
    .title = Scroll forwards
zotero-toolbar-tabs-scroll-backwards =
    .title = Scroll backwards
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = 重命名文獻集
collections-menu-edit-saved-search =
    .label = 編輯儲存的搜尋結果
collections-menu-move-collection =
    .label = 移動到
collections-menu-copy-collection =
    .label = 複製到
item-creator-moveDown =
    .label = 移至尾端
item-creator-moveToTop =
    .label = 移至頂端
item-creator-moveUp =
    .label = 往上移
item-menu-viewAttachment =
    .label =
        Open { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Snapshot
                    [note] Note
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                    [note] Notes
                   *[other] Attachments
                }
        } { $openIn ->
            [tab] in New Tab
            [window] in New Window
           *[other] { "" }
        }
item-menu-add-file =
    .label = 檔案
item-menu-add-linked-file =
    .label = 連結的檔案
item-menu-add-url =
    .label = 網頁連結
item-menu-change-parent-item =
    .label = 變更上層項目...
item-menu-relate-items =
    .label = Relate Items
view-online = 線上檢視
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = 檔案重命名為 { $filename }
itembox-button-options =
    .tooltiptext = 打開上下文選單
itembox-button-merge =
    .aria-label = 選擇 { $field } 欄位的版本
create-parent-intro = 輸入一個 DOI, ISBN, PMID, arXiv ID, 或 ADS 參照碼 來辨識這個檔案：
reader-use-dark-mode-for-content =
    .label = 內容使用深色模式
update-updates-found-intro-minor = 有一個 { -app-name } 的更新：
update-updates-found-desc = 建議你盡快套用此更新。
import-window =
    .title = 匯入
import-where-from = 想從哪匯入？
import-online-intro-title = 說明
import-source-file =
    .label = 一檔案 (BibTeX, RIS, Zotero RDF, 等)
import-source-folder =
    .label = 一個裝了PDF或是其他檔案的資料夾
import-source-online =
    .label = { $targetApp } 線上匯入
import-options = 選項
import-importing = 匯入中……
import-create-collection =
    .label = 將匯入的文獻集與項目放入新的文獻集
import-recreate-structure =
    .label = 將資料夾結構重新建立為文獻集
import-fileTypes-header = 要匯入的檔案型別：
import-fileTypes-pdf =
    .label = PDF
import-fileTypes-other =
    .placeholder = 依一定模式的其他檔案，以逗號分隔（例如，*.jpg,*.png）
import-file-handling = 檔案處理中
import-file-handling-store =
    .label = 將檔案複製到 { -app-name } 儲存資料夾
import-file-handling-link =
    .label = 在原始位置連結檔案
import-fileHandling-description = 連結的檔案不能被 { -app-name } 所同步。
import-online-new =
    .label = 僅下載新項目；不更新之前匯入的項目
import-mendeley-username = 使用者名稱
import-mendeley-password = 密碼
general-error = 錯誤
file-interface-import-error = 嘗試匯入所選的檔案時發生了錯誤。請確保檔案有效並再試一次。
file-interface-import-complete = 匯入完成
file-interface-items-were-imported =
    { $numItems ->
        [0] 沒有匯入任何項目
        [one] 已匯入1個項目
       *[other] 已匯入 { $numItems } 個項目
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] 沒有重新連結任何項目
        [one] 已重新連結1個項目
       *[other] 已重新連結 { $numRelinked } 個項目
    }
import-mendeley-encrypted = 無法讀取所選的 Mendeley 資料庫，可能是因為它已加密。請參閱<a data-l10n-name="mendeley-import-kb">如何將 Mendeley 文獻庫匯入 Zotero？</a>來了解更多資訊。
file-interface-import-error-translator = 使用“{ $translator }”匯入所選檔案時發生錯誤。請確保該檔案有效，然後重試。
import-online-intro = 在下一步中，您需要登入 { $targetAppOnline } 並授權 { -app-name } 存取。這是匯入您的 { $targetApp } 文獻庫到 { -app-name } 的必要步驟。
import-online-intro2 = { -app-name } 不會觀看或儲存您的 { $targetApp } 密碼。
import-online-form-intro = 請輸入您的驗證資訊來登入 { $targetAppOnline } 。這對匯入您的 { $targetApp } 文獻庫到 { -app-name } 中視必要的。
import-online-wrong-credentials = 登入 { $targetApp } 失敗。請重新輸入驗證資訊，然後再試一次。
import-online-blocked-by-plugin = 在 { $plugin } 裝著的時候無法繼續匯入，請停用這個附加元件，然後再試一次。
import-online-relink-only =
    .label = 重新連結Mendeley桌面應用程式引文
import-online-relink-kb = 更多資訊
import-online-connection-error = { -app-name } 無法連結到 { $targetApp }。請檢查您的網路連線後再試一次。
items-table-cell-notes =
    .aria-label =
        { $count ->
           *[other] { $count } 個筆記
        }
report-error =
    .label = 回報錯誤…
rtfScan-wizard =
    .title = RTF 掃描
rtfScan-introPage-description = { -app-name } 可以自動取出並且重新格式化引用文獻，並將參考書目插入 RTF 檔中。目前支援以下引用格式變體：
rtfScan-introPage-description2 = 要開始的話，在下方選一個 RTF 輸入檔及一個輸出檔：
rtfScan-input-file = 輸入檔案
rtfScan-output-file = 輸出檔案
rtfScan-no-file-selected = 未選擇任何檔案
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = 選擇輸入檔案
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = 選擇輸出檔案
rtfScan-intro-page = 說明
rtfScan-scan-page = 掃描參考文獻
rtfScan-scanPage-description = { -app-name } 在掃描文件中的引用文獻。請耐心等候。
rtfScan-citations-page = 查證引用的項目
rtfScan-citations-page-description = 請參閱下列辨識出的引用文獻來確定 { -app-name } 正確的選出了相關的項目。在進到下一步前所有無對應或是不明的引用文獻都須被解決。
rtfScan-style-page = 文件格式化
rtfScan-format-page = 格式化引用文獻
rtfScan-format-page-description = { -app-name } 正在處理及格式化你的 RTF 檔。請耐心等待。
rtfScan-complete-page = RTF 掃描完畢
rtfScan-complete-page-description = 文件已掃描及處理完畢。請確認其格式正確。
rtfScan-action-find-match =
    .title = 選擇符合的項目
rtfScan-action-accept-match =
    .title = 接受這個匹配
runJS-title = 執行 JavaScript
runJS-editor-label = 程式碼：
runJS-run = 執行
runJS-help = { general-help }
runJS-completed = completed successfully
runJS-result =
    { $type ->
        [async] 回傳值：
       *[other] 結果：
    }
runJS-run-async = 作為非同步函數執行
bibliography-window =
    .title = { -app-name } - 建立引用/參考文獻表
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = 將引用文獻顯示為:
bibliography-advancedOptions-label = 進階選項
bibliography-outputMode-label = 輸出模式:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] 引用文獻
            [note] 筆記
           *[other] 引用文獻
        }
bibliography-outputMode-bibliography =
    .label = 參考文獻表
bibliography-outputMethod-label = 輸出方法:
bibliography-outputMethod-saveAsRTF =
    .label = 存成 RTF 檔
bibliography-outputMethod-saveAsHTML =
    .label = 存成 HTML 檔
bibliography-outputMethod-copyToClipboard =
    .label = 複製到剪貼簿
bibliography-outputMethod-print =
    .label = 列印
bibliography-manageStyles-label = 管理樣式……
styleEditor-locatorType =
    .aria-label = 定位符類別
styleEditor-locatorInput = 定位符輸入
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = 樣式編輯器
styleEditor-preview =
    .aria-label = 預覽
publications-intro-page = 我的著作
publications-intro = 您所新增到我的著作中的項目將在 zotero.org 上您的個人頁面中顯示。如果您選擇包含附件檔案，這些檔案將在您所指定的許可協議下開放存取。請僅新增您自己創作的著作，並僅加入您所擁有著作權且願意分享的檔案。
publications-include-checkbox-files =
    .label = 包含檔案
publications-include-checkbox-notes =
    .label = 包含筆記
publications-include-adjust-at-any-time = 您可以隨時從「我的著作」文獻集中調整所要的顯示。
publications-intro-authorship =
    .label = 我建立此作品。
publications-intro-authorship-files =
    .label = 我建立此作品，並且有權散布其中的檔案。
publications-sharing-page = 選擇您分享著作的方式
publications-sharing-keep-rights-field =
    .label = 保留現存的版權欄位
publications-sharing-keep-rights-field-where-available =
    .label = 可以的話保留現存的版權欄位
publications-sharing-text = 您可以保留您對您作品的所有權利，可以在創用CC授權協議下授權，也可以將其貢獻到公共領域。在所有狀況下，這些著作都可以透過zotero.org公開取得。
publications-sharing-prompt = 您想允許您的著作被分享給他人嗎？
publications-sharing-reserved =
    .label = 不，只在zotero.org公開我的著作
publications-sharing-cc =
    .label = 是的，基於創用CC授權協議
publications-sharing-cc0 =
    .label = 是的，並將我的著作放入公共領域
publications-license-page = 選擇創用CC授權協議
publications-choose-license-text = 創用CC授權協議允許他人複製與散布您的著作，只要他們適當地表明原始貢獻者，在授權協議中提供連結，並且指明是否做過異動。附帶條件可於下方指定。
publications-choose-license-adaptations-prompt = 是否允許分享基於您著作的改編作品呢？
publications-choose-license-yes =
    .label = 要
    .accesskey = Y
publications-choose-license-no =
    .label = 不用
    .accesskey = N
publications-choose-license-sharealike =
    .label = 是的，只要他人以同樣的方式分享
    .accesskey = S
publications-choose-license-commercial-prompt = 允許您的著作被作為商業用途嗎？
publications-buttons-add-to-my-publications =
    .label = 新增到我的著作
publications-buttons-next-sharing =
    .label = 下一步：分享
publications-buttons-next-choose-license =
    .label = 選擇授權方式
licenses-cc-0 = CC0 1.0 一般公有領域貢獻
licenses-cc-by = 創用CC 署名 4.0 國際協議
licenses-cc-by-nd = 創用CC 署名-禁止改作 4.0 國際協議
licenses-cc-by-sa = 創用CC 署名-相同方式分享 4.0 國際協議
licenses-cc-by-nc = 創用CC 署名-非商業性使用 4.0 國際協議
licenses-cc-by-nc-nd = 創用CC 署名-非商業性使用-禁止改作 4.0 國際協議
licenses-cc-by-nc-sa = 創用CC 署名-非商業性使用-相同方式分享 4.0 國際協議
licenses-cc-more-info = 在使用創用CC<a data-l10n-name="license-considerations">許可方注意事項</a>發布作品前，請確保您已閱讀協議。注意，您一旦採用此協議就無法將其撤銷，即便您後來又選擇了其他條款或取消發布此作品。
licenses-cc0-more-info = 在使用創用CC0 <a data-l10n-name="license-considerations">CC0 FAQ</a>發布作品前，請確保您已閱讀協議。注意，您一旦將作品發佈到了公有領域，就無法撤回決定，即便您後來又選擇了其他條款或取消發布此作品。
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = 以除錯模式重新啟動……
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } 將重新啟動並停用所有附加元件。啟用除錯模式時，某些功能可能無法正確運作。
menu-ui-density =
    .label = 密度
menu-ui-density-comfortable =
    .label = 舒適
menu-ui-density-compact =
    .label = 緊緻
pane-item-details = 項目詳情
pane-info = 資訊
pane-abstract = 摘要
pane-attachments = 附件
pane-notes = 筆記
pane-note-info = Note Info
pane-libraries-collections = 文獻庫及文獻集
pane-tags = 標籤
pane-related = 相關
pane-attachment-info = 附件資訊
pane-attachment-preview = 預覽
pane-attachment-annotations = 標註
pane-header-attachment-associated =
    .label = 重新命名相關的檔案
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
           *[other] { $count } 個附件
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
           *[other] { $count } 個標註
        }
section-attachments-move-to-trash-message = Are you sure you want to move “{ $title }” to the trash?
section-notes =
    .label =
        { $count ->
           *[other] { $count } 個筆記
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
           *[other] { $count } 個標籤
        }
section-related =
    .label = { $count } 個相關
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = 展開此章節
    .label = 展開 { $section } 章節
section-button-collapse =
    .dynamic-tooltiptext = 摺疊此章節
    .label = 摺疊 { $section } 章節
annotations-count =
    { $count ->
       *[other] { $count } 個標註
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
    .label = Move Section Up
sidenav-reorder-down =
    .label = Move Section Down
sidenav-reorder-reset =
    .label = Reset Section Order
toggle-item-pane =
    .tooltiptext = Toggle Item Pane
toggle-context-pane =
    .tooltiptext = 切換上下文窗格
pin-section =
    .label = 固定此章節
unpin-section =
    .label = 取消固定此章節
collapse-other-sections =
    .label = 摺疊其他章節
expand-all-sections =
    .label = 展開所有章節
abstract-field =
    .placeholder = 新增摘要……
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = 篩選標籤
context-notes-search =
    .placeholder = 搜尋筆記
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = 新增文獻集……
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = 新增文獻集
    .buttonlabelaccept = 建立文獻集
new-collection-name = 名稱：
new-collection-create-in = 建立到：
show-publications-menuitem =
    .label = Show My Publications
attachment-info-title = 標題
attachment-info-filename = 檔名
attachment-info-accessed = 取用
attachment-info-pages = 頁
attachment-info-modified = 修改日期
attachment-info-index = 已建立索引
attachment-info-convert-note =
    .label =
        遷移到{ $type ->
            [standalone] 獨立
            [child] 項目
           *[unknow] 新
        }筆記
    .tooltiptext = 已不再支援對附件新增筆記，但您可以將其遷移到單獨的筆記後編輯此筆記。
section-note-info =
    .label = { pane-note-info }
note-info-title = 標題
note-info-parent-item = Parent Item
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] None
    }
    .title =
        { $hasParentItem ->
            [true] View parent item in library
           *[false] View note item in library
        }
note-info-date-created = Created
note-info-date-modified = 修改日期
note-info-size = 大小
note-info-word-count = Word Count
note-info-character-count = Character Count
item-title-empty-note = 未命名的筆記
attachment-preview-placeholder = 沒有可預覽的附件
attachment-rename-from-parent =
    .tooltiptext = Rename File to Match Parent Item
file-renaming-auto-rename-prompt-title = Renaming Settings Changed
file-renaming-auto-rename-prompt-body = Would you like to rename existing files in your library to match the new settings?
file-renaming-auto-rename-prompt-yes = Preview Changes…
file-renaming-auto-rename-prompt-no = Keep Existing Filenames
rename-files-preview =
    .buttonlabelaccept = Rename Files
rename-files-preview-loading = 載入中……
rename-files-preview-intro = { -app-name } will rename the following files in your library to match their parent items:
rename-files-preview-renaming = Renaming…
rename-files-preview-no-files = All filenames already match parent items. No changes are required.
toggle-preview =
    .label =
        { $type ->
            [open] 隱藏
            [collapsed] 顯示
           *[unknown] 切換
        }附件預覽
annotation-image-not-available = [Image not available]
quicksearch-mode =
    .aria-label = 快速搜尋模式
quicksearch-input =
    .aria-label = 快速搜尋
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = 顯示為
item-pane-header-none =
    .label = 無
item-pane-header-title =
    .label = 標題
item-pane-header-titleCreatorYear =
    .label = 標題，創作者，年
item-pane-header-bibEntry =
    .label = 參考文獻表條目
item-pane-header-more-options =
    .label = 更多選項
item-pane-message-items-selected =
    { $count ->
        [0] 沒有選擇任何項目
        [one] 已選擇{ $count } 個項目
       *[other] 已選擇{ $count } 個項目
    }
item-pane-message-collections-selected =
    { $count ->
       *[other] 已選擇 { $count } 個文獻集
    }
item-pane-message-searches-selected =
    { $count ->
       *[other] 已選擇 { $count } 個搜尋結果
    }
item-pane-message-objects-selected =
    { $count ->
       *[other] 已選擇 { $count } 個物件
    }
item-pane-message-unselected =
    { $count ->
        [0] 沒有任何項目
        [one] { $count } 個項目
       *[other] { $count } 個項目
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
           *[other] 合併 { $count } 個項目
        }
locate-library-lookup-no-resolver = 您必須從 { -app-name } 偏好設定的 { $pane } 窗格中選擇一個解析器。
architecture-win32-warning-message = Switch to 64-bit { -app-name } for the best performance. Your data won’t be affected.
architecture-warning-action = 下載64位元版本的 { -app-name }
architecture-x64-on-arm64-message = { -app-name } is running in emulated mode. A native version of { -app-name } will run more efficiently.
architecture-x64-on-arm64-action = 下載 ARM 64位元版本的 { -app-name }
first-run-guidance-authorMenu = { -app-name } 也允許您指定編輯與譯者。您可以從此選單中選擇，將作者更改為編輯或譯者。
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = 搜尋條件
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = 操作符
    .label = { $label }
advanced-search-condition-input =
    .aria-label = 值
    .label = { $label }
find-pdf-files-added =
    { $count ->
       *[other] 已新增 { $count } 個檔案
    }
select-items-window =
    .title = 選取項目
select-items-dialog =
    .buttonlabelaccept = 選擇
select-items-convertToStandalone =
    .label = 轉換成獨立
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
           *[other] 轉換成獨立附件
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
           *[other] 轉換成獨立筆記
        }
file-type-webpage = 網頁
file-type-image = 圖片
file-type-pdf = PDF
file-type-audio = 音訊
file-type-video = 視訊
file-type-presentation = 簡報
file-type-document = 文件
file-type-ebook = 電子書
post-upgrade-message = You’ve been upgraded to <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Learn about <a data-l10n-name="new-features-link">what’s new</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = 貼上並搜尋
mac-word-plugin-install-message = Zotero 需要存取 Word 資料來安裝 Word 外掛
mac-word-plugin-install-action-button =
    .label = 安裝 Word 外掛
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
file-renaming-banner-message = { -app-name } now automatically keeps attachment filenames in sync as you make changes to items.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = The { -app-name } Connector must be updated to work with this version of { -app-name }.
userjs-pref-warning = Some { -app-name } settings have been overridden using an unsupported method. { -app-name } will revert them and restart.
long-tag-fixer-window-title =
    .title = Split Tags
long-tag-fixer-button-dont-split =
    .label = Don’t Split
menu-normalize-attachment-titles =
    .label = Normalize Attachment Titles…
normalize-attachment-titles-title = Normalize Attachment Titles
normalize-attachment-titles-text =
    { -app-name } automatically renames files on disk using parent item metadata, but it uses separate, simpler titles such as “Full Text PDF”, “Preprint PDF”, or “PDF” for primary attachments to keep the items list cleaner and avoid duplicating information.
    
    In older versions of { -app-name }, as well as when using certain plugins, attachment titles could be changed unnecessarily to match the filenames.
    
    Would you like to update the selected attachments to use simpler titles? Only primary attachments with titles that match the filename will be changed.
