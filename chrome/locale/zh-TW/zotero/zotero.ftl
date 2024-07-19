general-print = 列印
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = 移除
general-add = 新增
general-remind-me-later = 稍後提醒我
general-choose-file = 選擇檔案……
general-open-settings = 打開設定
general-help = 說明
general-tag = Tag
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
main-window-command =
    .label = { -app-name }
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
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = 重命名文獻集
collections-menu-edit-saved-search =
    .label = 編輯儲存的搜尋結果
item-creator-moveDown =
    .label = 移至尾端
item-creator-moveToTop =
    .label = 移至頂端
item-creator-moveUp =
    .label = 往上移
item-menu-viewAttachment =
    .label =
        開啟 { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] 快照
                   *[other] 附件
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] 快照
                   *[other] 附件
                }
        } { $openIn ->
            [tab] 到新分頁
            [window] 到新視窗
           *[other] { "" }
        }
item-menu-add-file =
    .label = 檔案
item-menu-add-linked-file =
    .label = 連結的檔案
item-menu-add-url =
    .label = 網頁連結
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
rtfScan-introPage-description = { -app-name } 能自動取出並重新格式化引用文獻，並將參考書目插入 RTF 檔中。若要開始，請於下方選擇RTF檔。
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
rtfScan-intro-page =
    .label = 說明
rtfScan-scan-page =
    .label = 掃描參考文獻
rtfScan-scanPage-description = { -app-name } 在掃描文件中的引用文獻。請耐心等候。
rtfScan-citations-page =
    .label = 查證引用的項目
rtfScan-citations-page-description = 請參閱下列辨識出的引用文獻來確定 { -app-name } 正確的選出了相關的項目。在進到下一步前所有無對應或是不明的引用文獻都須被解決。
rtfScan-style-page =
    .label = 文件格式化
rtfScan-format-page =
    .label = 格式化引用文獻
rtfScan-format-page-description = { -app-name } 正在處理及格式化你的 RTF 檔。請耐心等待。
rtfScan-complete-page =
    .label = RTF 掃描完畢
rtfScan-complete-page-description = 文件已掃描及處理完畢。請確認其格式正確。
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = 執行 JavaScript
runJS-editor-label = 程式碼：
runJS-run = 執行
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] 回傳值：
       *[other] 結果：
    }
runJS-run-async = 作為非同步函數執行
bibliography-window =
    .title = { -app-name } - 建立引用/參考文獻表
bibliography-style-label = 引用文獻樣式:
bibliography-locale-label = 語言：
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
integration-docPrefs-window =
    .title = { -app-name } - 文件偏好設定
integration-addEditCitation-window =
    .title = { -app-name } - 新增/編輯引用文獻
integration-editBibliography-window =
    .title = { -app-name } - 編輯參考文獻表
integration-quickFormatDialog-window =
    .title = { -app-name } - 快速格式化引用文獻
integration-prefs-displayAs-label = 將引用文獻顯示為:
integration-prefs-footnotes =
    .label = 頁末註
integration-prefs-endnotes =
    .label = 文末註
integration-prefs-bookmarks =
    .label = 引用文獻儲存為書籤
integration-prefs-bookmarks-description = 在 Word 及 LibreOffice中書籤皆可相互分享，但也可能因為修改意外而產生錯誤；而且啟用此項時，引用文獻無法插入於頁末註或文末註中。
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] 必須將該文件儲存為 .doc 或 .docx 格式。
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = 自動更新引用文獻
    .tooltip = 等待更新的引用文獻會突顯於文件中
integration-prefs-automaticCitationUpdates-description = 於大型文件中，停用更新可加快引用文獻的插入。點擊重新整理可手動更新引用文獻。
integration-prefs-automaticJournalAbbeviations =
    .label = 使用 MEDLINE 期刊簡寫
integration-prefs-automaticJournalAbbeviations-description = 「期刊簡寫」欄會被忽略。
integration-prefs-exportDocument =
    .label = 切換至另一文件編輯器……
publications-intro-page =
    .label = 我的著作
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
publications-sharing-page =
    .label = 選擇您分享著作的方式
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
publications-license-page =
    .label = 選擇創用CC授權協議
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
restart-in-troubleshooting-mode-menuitem =
    .label = 以除錯模式重新啟動……
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = 以除錯模式重新啟動
restart-in-troubleshooting-mode-dialog-description = { -app-name } 將重新啟動並停用所有附加元件。啟用除錯模式時，某些功能可能無法正確運作。
menu-ui-density =
    .label = 密度
menu-ui-density-comfortable =
    .label = 舒適
menu-ui-density-compact =
    .label = 緊緻
pane-info = 資訊
pane-abstract = 摘要
pane-attachments = 附件
pane-notes = 筆記
pane-libraries-collections = 文獻庫及文獻集
pane-tags = 標籤
pane-related = 相關
pane-attachment-info = 附件資訊
pane-attachment-preview = 預覽
pane-attachment-annotations = 標註
pane-header-attachment-associated =
    .label = 重新命名相關的檔案
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
new-collection-dialog =
    .title = 新增文獻集
    .buttonlabelaccept = 建立文獻集
new-collection-name = 名稱：
new-collection-create-in = 建立到：
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
attachment-preview-placeholder = 沒有可預覽的附件
toggle-preview =
    .label =
        { $type ->
            [open] 隱藏
            [collapsed] 顯示
           *[unknown] 切換
        }附件預覽
quickformat-general-instructions =
    使用左/右方向鍵切換此引用文獻的項目。{ $dialogMenu ->
        [active] 按 Shift+Tab 聚焦到對話框選單。
       *[other] { "" }
    } 按 { return-or-enter } 儲存對此引用文獻的編輯。按 Esc 鍵放棄更改並關閉對話框。
quickformat-aria-bubble = 該項目已飽含在引用文獻中。按空白鍵自定義項目。 { quickformat-general-instructions }
quickformat-aria-input = 輸入以搜尋需要引用的項目。按 T​​ab 切換到搜尋結果。  { quickformat-general-instructions }
quickformat-aria-item = 按 { return-or-enter } 將此項目新增到引用文獻中。按 T​​ab 回到搜尋欄位。
quickformat-accept =
    .tooltiptext = 儲存對此引用文獻的編輯
quickformat-locator-type =
    .aria-label = 定位符類別
quickformat-locator-value = 定位符
quickformat-citation-options =
    .tooltiptext = 顯示引用文獻選項
insert-note-aria-input = 輸入以搜尋筆記。按 T​​ab 切換到結果清單。按 Esc 鍵關閉對話框。
insert-note-aria-item = 按 { return-or-enter } 選擇此筆記。按 T​​ab 會到搜尋欄位。按 Esc 鍵關閉對話框。
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
item-pane-duplicates-merge-items =
    .label =
        { $count ->
           *[other] 合併 { $count } 個項目
        }
locate-library-lookup-no-resolver = 您必須從 { -app-name } 偏好設定的 { $pane } 窗格中選擇一個解析器。
architecture-win32-warning-message = { -app-name } 目前在64位元版本的Windows上以32位元模式執行。 { -app-name } 在64位元模式下執行效率更高。
architecture-warning-action = 下載64位元版本的 { -app-name }
first-run-guidance-quickFormat =
    輸入標題、作者和/或年份來搜尋參考文獻。
    
    選擇項目後，可以點擊氣泡或利用鍵盤按下 ↓/空白建，顯示頁碼、前綴和後綴等引用文獻選項。
    
    您也可以直接新增頁碼，於搜尋詞語中包含頁碼，或在氣泡後輸入頁碼並按下 { return-or-enter } 鍵即可。
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
