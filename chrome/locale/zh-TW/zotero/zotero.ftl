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
    .label = 外掛
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
    .label = 編輯存留搜尋
item-creator-moveDown =
    .label = 往下移
item-creator-moveToTop =
    .label = 移至頂端
item-creator-moveUp =
    .label = 往上移
item-menu-viewAttachment =
    .label =
        打開 { $numAttachments ->
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
itembox-button-options =
    .tooltiptext = 打開上下文選單
itembox-button-merge =
    .aria-label = 選擇 { $field } 欄位的版本
create-parent-intro = 輸入一個 DOI, ISBN, PMID, arXiv ID, 或 ADS Bibcode 來識別這個檔案：
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
    .placeholder = 依式樣的其他檔案，以逗號分隔（例如，*.jpg,*.png）
import-file-handling = 檔案處理中
import-file-handling-store =
    .label = 將檔案複製到 { -app-name } 儲存資料夾
import-file-handling-link =
    .label = 在初始位置連結檔案
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
        [0] 没有导入任何条目
        [one] 已导入 1 个条目
       *[other] 已导入 { $numItems } 个条目
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] 没有重新链接任何条目
        [one] 已重新链接 1 个条目
       *[other] 已重新链接 { $numRelinked } 个条目
    }
import-mendeley-encrypted = 无法读取所选的 Mendeley 数据库，可能是因为它已加密。请参阅<a data-l10n-name="mendeley-import-kb">如何将 Mendeley 库导入 Zotero？</a>了解更多信息。
file-interface-import-error-translator = 使用“{ $translator }”导入所选文件时发生错误。请确保该文件有效，然后重试。
import-online-intro = 在下一步中，您需要登录 { $targetAppOnline } 并授予 { -app-name } 访问权限。这是将您的 { $targetApp } 库导入到 { -app-name } 所必需的。
import-online-intro2 = { -app-name } 永远不会知道或存储您的 { $targetApp } 密码。
import-online-form-intro = 请输入您登录 { $targetAppOnline } 的凭据。这是将您的 { $targetApp } 库导入到 { -app-name } 所必需的。
import-online-wrong-credentials = 登录 { $targetApp } 失败。请重新输入凭据并重试。
import-online-blocked-by-plugin = 安装了 { $plugin } 后导入无法继续。请禁用此插件并重试。
import-online-relink-only =
    .label = 重新連結Mendeley桌面應用程式引文
import-online-relink-kb = 更多資訊
import-online-connection-error = { -app-name } 无法连接到 { $targetApp }。请检查您的网络连接并重试。
items-table-cell-notes =
    .aria-label =
        { $count ->
           *[other] { $count } 個筆記
        }
report-error =
    .label = 回報錯誤…
rtfScan-wizard =
    .title = RTF 掃描
rtfScan-introPage-description = { -app-name } 可以自动提取和重新格式化引注，并将参考文献表插入 RTF 文件中。首先，请选择下面的 RTF 文件。
rtfScan-introPage-description2 = 要開始的話，在下方選一個 RTF 輸入檔及一個輸出檔：
rtfScan-input-file = 輸入檔案
rtfScan-output-file = 輸出檔案
rtfScan-no-file-selected = 未選擇任何檔案
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = 选择输入文件
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = 选择输出文件
rtfScan-intro-page =
    .label = 說明
rtfScan-scan-page =
    .label = 掃描引用文獻
rtfScan-scanPage-description = { -app-name } 正在扫描您的文档以查找引文。请耐心等待。
rtfScan-citations-page =
    .label = 查證引用的項目
rtfScan-citations-page-description = 请核查下面的已识别引文列表，以确保 { -app-name } 正确选择了相应的条目。在继续下一步之前，必须解决任何未映射或不明确的引用。
rtfScan-style-page =
    .label = 文件格式化
rtfScan-format-page =
    .label = 格式化引用文獻
rtfScan-format-page-description = { -app-name } 正在處理及格式化你的 RTF 檔。請耐心等待。
rtfScan-complete-page =
    .label = RTF 掃描完畢
rtfScan-complete-page-description = 文件已掃描及處理完畢。請確認其格式正確。
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
    .title = { -app-name } - 创建引注/参考文献表
bibliography-style-label = 引用文獻樣式:
bibliography-locale-label = 語言：
bibliography-displayAs-label = 引注显示为:
bibliography-advancedOptions-label = 進階選項
bibliography-outputMode-label = 輸出模式:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = 参考文献表
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
    .title = { -app-name } - 文档首选项
integration-addEditCitation-window =
    .title = { -app-name } - 添加/编辑引注
integration-editBibliography-window =
    .title = { -app-name } - 编辑参考文献表
integration-quickFormatDialog-window =
    .title = { -app-name } - 快速格式化引注
integration-prefs-displayAs-label = 引注显示为:
integration-prefs-footnotes =
    .label = 頁末註
integration-prefs-endnotes =
    .label = 文末註
integration-prefs-bookmarks =
    .label = 引注存储为书签
integration-prefs-bookmarks-description = 在 Word 及 LibreOffice中書籤皆可相互分享，但也可能因為修改意外而產生錯誤；而且啟用此項時，引用文獻無法插入於頁末註或文末註中。
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] 必须将该文档保存为 .doc 或 .docx 格式。
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
    .accesskey = 无
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
licenses-cc-more-info = 在将您的作品以知识共享协议许可之前，请确保您已阅读 <a data-l10n-name="license-considerations">许可方注意事项</a>。请注意，即使您后来选择不同的条款或停止发布作品，您所申请的许可也无法撤销。
licenses-cc0-more-info = 在将 CC0 应用于您的作品之前，请确保您已阅读知识共享 <a data-l10n-name="license-considerations">CC0 常见问题解答</a>。请注意，将您的作品奉献给公共领域是不可逆转的，即使您后来选择不同的条款或停止发布该作品。
restart-in-troubleshooting-mode-menuitem =
    .label = 以故障排除模式重启...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = 以故障排除模式重启
restart-in-troubleshooting-mode-dialog-description =  { -app-name } 将重新启动并禁用所有插件。启用故障排除模式时，某些功能可能无法正常工作。
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
    .tooltiptext = 展开此区域
section-button-collapse =
    .tooltiptext = 折叠此区域
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
    .label = 固定此区域
unpin-section =
    .label = 取消固定此区域
collapse-other-sections =
    .label = 折叠其他栏
expand-all-sections =
    .label = 展开所有栏
abstract-field =
    .placeholder = 添加摘要...
tagselector-search =
    .placeholder = 筛选标签
context-notes-search =
    .placeholder = 搜索笔记
new-collection-dialog =
    .title = 新增文獻集
    .buttonlabelaccept = 创建分类
new-collection-name = 名稱：
new-collection-create-in = 创建到：
attachment-info-filename = 檔名
attachment-info-accessed = 取用
attachment-info-pages = 頁
attachment-info-modified = 修改日期
attachment-info-index = 索引
attachment-info-convert-note =
    .label =
        迁移到{ $type ->
            [standalone] 独立
            [child] 条目
           *[unknow] 新
        }笔记
    .tooltiptext = 已不再支持向附件添加注释，但您可以将其迁移到单独的注释后编辑此注释。
attachment-preview-placeholder = 无可预览的附件
toggle-preview =
    .label =
        { $type ->
            [open] 隐藏
            [collapsed] 显示
           *[unknown] 切换
        }附件预览
quickformat-general-instructions =
    使用左/右箭头浏览此引注的条目。{ $dialogMenu ->
        [active] 按 Shift-Tab 聚焦到对话框菜单。
       *[other] { "" }
    } 按 { return-or-enter } 保存对此引注的编辑。按 Esc 键放弃更改并关闭对话框。
quickformat-aria-bubble = 该条目已包含在引注中。按空格键自定义条目。 { quickformat-general-instructions }
quickformat-aria-input = 键入以搜索需要引用的条目。按 T​​ab 转到搜索结果。  { quickformat-general-instructions }
quickformat-aria-item = 按 { return-or-enter } 将此条目添加到引注中。按 T​​ab 返回搜索字段。
quickformat-accept =
    .tooltiptext = 保存对此引注的编辑
quickformat-locator-type =
    .aria-label = 定位符类别
quickformat-locator-value = 定位符
quickformat-citation-options =
    .tooltiptext = 显示引注选项
insert-note-aria-input = 键入以搜索笔记。按 T​​ab 转到结果列表。按 Esc 键关闭对话框。
insert-note-aria-item = 按 { return-or-enter } 选择此笔记。按 T​​ab 返回搜索字段。按 Esc 键关闭对话框。
quicksearch-mode =
    .aria-label = 快速搜索模式
quicksearch-input =
    .aria-label = 快速搜尋
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = 显示为
item-pane-header-none =
    .label = 無
item-pane-header-title =
    .label = 標題
item-pane-header-titleCreatorYear =
    .label = 標題，作者，年
item-pane-header-bibEntry =
    .label = 参考文献表条目
item-pane-header-more-options =
    .label = 更多选项
item-pane-message-items-selected =
    { $count ->
       *[other] 已选择 { $count } 个条目
    }
item-pane-message-collections-selected =
    { $count ->
       *[other] 已选择 { $count } 个分类
    }
item-pane-message-searches-selected =
    { $count ->
       *[other] 已选择 { $count } 个搜索结果
    }
item-pane-message-objects-selected =
    { $count ->
       *[other] 已选择 { $count } 个对象
    }
locate-library-lookup-no-resolver = 您必须从 { -app-name } 设置的 { $pane } 窗格中选择解析器。
architecture-win32-warning-message = { -app-name } 目前在 64 位版本的 Windows 上以 32 位模式运行。 { -app-name } 在 64 位模式下运行效率更高。
architecture-warning-action = 下载 64 位版本的 { -app-name }
first-run-guidance-quickFormat =
    输入标题、作者和/或年份来搜索参考文献。
    
    选择条目后，可以单击气泡或使用键盘按下 ↓/空格键，显示页码、前缀和后缀等引注选项。
    
    您也可以直接添加页码，方法是在搜索词中包含页码，或在气泡后输入页码并按下 { return-or-enter } 键。
first-run-guidance-authorMenu = { -app-name } 也允许您指定“编辑”和“译者”。您可以从此菜单中选择，将“作者”更改为“编辑”或“译者”。
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = 搜索条件
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = 操作符
    .label = { $label }
advanced-search-condition-input =
    .aria-label = 值
    .label = { $label }
