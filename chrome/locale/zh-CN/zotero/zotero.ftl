general-print = 打印
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = 移除
general-add = 添加
general-remind-me-later = 稍后提醒我
general-choose-file = 选择文件…
general-open-settings = 打开设置
general-help = 帮助
general-tag = Tag
menu-file-show-in-finder =
    .label = 在访达中显示
menu-file-show-file =
    .label = 打开文件目录
menu-file-show-files =
    .label = 显示文件
menu-print =
    .label = { general-print }
menu-density =
    .label = 密度
add-attachment = 添加附件
new-note = 新建笔记
menu-add-by-identifier =
    .label = 根据标识符新增...
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = 添加文件...
menu-add-standalone-linked-file-attachment =
    .label = 添加文件链接...
menu-add-child-file-attachment =
    .label = 附加文件...
menu-add-child-linked-file-attachment =
    .label = 附加文件链接…
menu-add-child-linked-url-attachment =
    .label = 附加网页链接...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = 新建独立笔记
menu-new-item-note =
    .label = 新建条目笔记
menu-restoreToLibrary =
    .label = 还原到文库中
menu-deletePermanently =
    .label = 永久删除…
menu-tools-plugins =
    .label = 插件
main-window-command =
    .label = { -app-name }
zotero-toolbar-tabs-menu =
    .tooltiptext = 列出所有标签页
filter-collections = 筛选分类
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = 搜索标签页
zotero-tabs-menu-close-button =
    .title = 关闭标签页
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = 重命名分类
collections-menu-edit-saved-search =
    .label = 编辑可存搜索
item-creator-moveDown =
    .label = 下移
item-creator-moveToTop =
    .label = 移动到顶端
item-creator-moveUp =
    .label = 上移
item-menu-viewAttachment =
    .label =
        打开 { $numAttachments ->
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
            [tab] 到新标签页
            [window] 到新窗口
           *[other] { "" }
        }
item-menu-add-file =
    .label = 文件
item-menu-add-linked-file =
    .label = 链接的文件
item-menu-add-url =
    .label = 网页链接
view-online = 在线查看
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = File renamed to { $filename }
itembox-button-options =
    .tooltiptext = 打开上下文菜单
itembox-button-merge =
    .aria-label = 选择 { $field } 字段的版本
create-parent-intro = 输入一个 DOI, ISBN, PMID, arXiv ID, 或 ADS Bibcode 來识别这个文件：
reader-use-dark-mode-for-content =
    .label = 使用深色模式显示文档内容
update-updates-found-intro-minor = { -app-name } 有可用更新：
update-updates-found-desc = 建议尽快更新。
import-window =
    .title = 导入
import-where-from = 您想从哪里导入？
import-online-intro-title = 介绍
import-source-file =
    .label = 文件（BibTeX，RIS，Zotero RDF等）
import-source-folder =
    .label = 一个存放PDF等文件的文件夹
import-source-online =
    .label = { $targetApp } 在线导入
import-options = 选项
import-importing = 导入…
import-create-collection =
    .label = 将导入的分类和条目放入新分类
import-recreate-structure =
    .label = 将文件夹结构重建为分类
import-fileTypes-header = 要导入的文件类型：
import-fileTypes-pdf =
    .label = PDF
import-fileTypes-other =
    .placeholder = 其他文件模式，以逗号分隔（例如，*.jpg,*.png）
import-file-handling = 处理文件
import-file-handling-store =
    .label = 将文件复制到 { -app-name } 存储文件夹
import-file-handling-link =
    .label = 在初始位置链接到文件
import-fileHandling-description = { -app-name } 无法同步链接的文件。
import-online-new =
    .label = 仅下载新条目，不更新之前已导入的条目
import-mendeley-username = 用户名
import-mendeley-password = 密码
general-error = 错误
file-interface-import-error = 试图导入所选文件时发生错误。请确保此文件有效，然后再试一次。
file-interface-import-complete = 导入完成
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
    .label = 重新链接 Mendeley 桌面程序参考文献
import-online-relink-kb = 更多信息
import-online-connection-error = { -app-name } 无法连接到 { $targetApp }。请检查您的网络连接并重试。
items-table-cell-notes =
    .aria-label =
        { $count ->
           *[other] { $count } 个笔记
        }
report-error =
    .label = 报告软件缺陷…
rtfScan-wizard =
    .title = RTF 扫描
rtfScan-introPage-description = { -app-name } 可以自动提取和重新格式化引注，并将参考文献表插入 RTF 文件中。首先，请选择下面的 RTF 文件。
rtfScan-introPage-description2 = 如要开始，请选择 RTF 输入文件和输出文件：
rtfScan-input-file = 输入文件
rtfScan-output-file = 输出文件
rtfScan-no-file-selected = 未选定文件
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = 选择输入文件
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = 选择输出文件
rtfScan-intro-page =
    .label = 介绍
rtfScan-scan-page =
    .label = 扫描引注
rtfScan-scanPage-description = { -app-name } 正在扫描您的文档以查找引文。请耐心等待。
rtfScan-citations-page =
    .label = 校验已引用的条目
rtfScan-citations-page-description = 请核查下面的已识别引文列表，以确保 { -app-name } 正确选择了相应的条目。在继续下一步之前，必须解决任何未映射或不明确的引用。
rtfScan-style-page =
    .label = 文档格式化中
rtfScan-format-page =
    .label = 正在格式化引注
rtfScan-format-page-description = { -app-name } 正在处理及格式化你的 RTF 文件。请耐心等待。
rtfScan-complete-page =
    .label = RTF 扫描完成
rtfScan-complete-page-description = 文档处理完成, 请确保格式正确.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = 执行 JavaScript
runJS-editor-label = 代码：
runJS-run = 执行
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] 返回值：
       *[other] 结果：
    }
runJS-run-async = 作为异步函数执行
bibliography-window =
    .title = { -app-name } - 创建引注/参考文献表
bibliography-style-label = 参考文献样式:
bibliography-locale-label = 语言：
bibliography-displayAs-label = 引注显示为:
bibliography-advancedOptions-label = 高级选项
bibliography-outputMode-label = 输出模式:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] 引注
            [note] 笔记
           *[other] 引注
        }
bibliography-outputMode-bibliography =
    .label = 参考文献表
bibliography-outputMethod-label = 输出方法:
bibliography-outputMethod-saveAsRTF =
    .label = 另存为 RTF
bibliography-outputMethod-saveAsHTML =
    .label = 另存为 HTML
bibliography-outputMethod-copyToClipboard =
    .label = 复制到剪切板
bibliography-outputMethod-print =
    .label = 打印
bibliography-manageStyles-label = 管理样式…
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
    .label = 脚注
integration-prefs-endnotes =
    .label = 尾注
integration-prefs-bookmarks =
    .label = 引注存储为书签
integration-prefs-bookmarks-description = 书签可以在 Word 与 LibreOffice 之间共享，但如果不小心被修改，可能会导致错误，并且不能插入脚注。
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] 必须将该文档保存为 .doc 或 .docx 格式。
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = 自动更新引注
    .tooltip = 有待更新的引注将在文档中突出显示
integration-prefs-automaticCitationUpdates-description = 禁用更新可以加速大文档中的引注的插入。单击刷新手动更新引注。
integration-prefs-automaticJournalAbbeviations =
    .label = 使用 MEDLINE 期刊缩写
integration-prefs-automaticJournalAbbeviations-description = “期刊缩写”字段将被忽略。
integration-prefs-exportDocument =
    .label = 切换到另外一个文稿处理器…
publications-intro-page =
    .label = 我的出版物
publications-intro = 你添加到我的出版物的条目将在 zotero.org 上你的个人主页上显示。如果你选择加入附件，这些文件将在你指定的许可下向公众开放下载。请仅添加你自己创建的论文，并仅上传你有权并愿意分享的文件。
publications-include-checkbox-files =
    .label = 包括文件
publications-include-checkbox-notes =
    .label = 包括笔记
publications-include-adjust-at-any-time = 您随时可以在“我的出版物”中调整要显示什么。
publications-intro-authorship =
    .label = 是我创作的作品。
publications-intro-authorship-files =
    .label = 我是作品的作者，并且我有权向大众分发内含的文件。
publications-sharing-page =
    .label = 选择你分享论文的方式
publications-sharing-keep-rights-field =
    .label = 保留现有的版权字段
publications-sharing-keep-rights-field-where-available =
    .label = 如果可能，保留现有的版权字段
publications-sharing-text = 您可以保留您作品的所有权利，可以在知识共享许可下获得许可，也可以将其专用于公共领域。在所有情况下，这些作品都可以通过zotero.org公开获得。
publications-sharing-prompt = 您想允许他人共享您的作品吗？
publications-sharing-reserved =
    .label = 不，仅在zotero.org上发布我的作品
publications-sharing-cc =
    .label = 是的，使用“知识共享”许可协议
publications-sharing-cc0 =
    .label = 是的，将我的工作放在公共领域
publications-license-page =
    .label = 选择一个知识共享许可
publications-choose-license-text = 创用CC许可允许其他人复制并重新分发您的作品，只要他们提供适当的信誉，提供许可的链接并指出是否进行了更改。可以在下面指定其他条件。
publications-choose-license-adaptations-prompt = 是否允许分享您的作品的修改版？
publications-choose-license-yes =
    .label = 是
    .accesskey = Y
publications-choose-license-no =
    .label = 否
    .accesskey = 无
publications-choose-license-sharealike =
    .label = 是的，如果其他人也分享同样的
    .accesskey = S
publications-choose-license-commercial-prompt = 允许你的工作的商业使用吗？
publications-buttons-add-to-my-publications =
    .label = 添加到我的出版物
publications-buttons-next-sharing =
    .label = 下一步：分享
publications-buttons-next-choose-license =
    .label = 选择许可协议
licenses-cc-0 = CC0 1.0 通用公共领域贡献
licenses-cc-by = 知识共享署名 4.0 国际许可协议
licenses-cc-by-nd = 知识共享署名-禁止演绎 4.0 国际许可协议
licenses-cc-by-sa = 知识共享署名-相同方式共享 4.0 国际许可协议
licenses-cc-by-nc = 知识共享署名-非商业性使用 4.0 国际许可协议
licenses-cc-by-nc-nd = 知识共享署名-非商业性使用-禁止演绎 4.0 国际许可协议
licenses-cc-by-nc-sa = 知识共享署名-非商业性使用-相同方式共享 4.0 国际许可协议
licenses-cc-more-info = 在将您的作品以知识共享协议许可之前，请确保您已阅读 <a data-l10n-name="license-considerations">许可方注意事项</a>。请注意，即使您后来选择不同的条款或停止发布作品，您申应用的许可也无法撤销。
licenses-cc0-more-info = 在将 CC0 应用于您的作品之前，请确保您已阅读知识共享 <a data-l10n-name="license-considerations">CC0 常见问题解答</a>。请注意，将您的作品奉献给公共领域是不可逆转的，即使您后来选择不同的条款或停止发布该作品。
restart-in-troubleshooting-mode-menuitem =
    .label = 以故障排除模式重启...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = 以故障排除模式重启
restart-in-troubleshooting-mode-dialog-description = { -app-name } 将重新启动并禁用所有插件。启用故障排除模式时，某些功能可能无法正常工作。
menu-ui-density =
    .label = 密度
menu-ui-density-comfortable =
    .label = 舒适
menu-ui-density-compact =
    .label = 紧凑
pane-info = 信息
pane-abstract = 摘要
pane-attachments = 附件
pane-notes = 笔记
pane-libraries-collections = 文库和分类
pane-tags = 标签
pane-related = 相关
pane-attachment-info = 附件信息
pane-attachment-preview = 预览
pane-attachment-annotations = 注释
pane-header-attachment-associated =
    .label = 重命名相关文件
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
           *[other] { $count } 个附件
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
           *[other] { $count } 个注释
        }
section-notes =
    .label =
        { $count ->
           *[other] { $count } 个笔记
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
           *[other] { $count } 个标签
        }
section-related =
    .label = { $count } 个相关
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = 展开此栏
    .label = 展开 { $section } 栏
section-button-collapse =
    .dynamic-tooltiptext = 折叠此栏
    .label = 折叠 { $section } 栏
annotations-count =
    { $count ->
       *[other] { $count } 个注释
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
    .label = 固定此栏
unpin-section =
    .label = 取消固定此栏
collapse-other-sections =
    .label = 折叠其他栏
expand-all-sections =
    .label = 展开所有栏
abstract-field =
    .placeholder = 添加摘要...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = 筛选标签
context-notes-search =
    .placeholder = 搜索笔记
new-collection-dialog =
    .title = 新建分类
    .buttonlabelaccept = 创建分类
new-collection-name = 名称:
new-collection-create-in = 创建到：
attachment-info-filename = 文件名
attachment-info-accessed = 访问时间
attachment-info-pages = 页
attachment-info-modified = 修改日期
attachment-info-index = 已索引
attachment-info-convert-note =
    .label =
        迁移到{ $type ->
            [standalone] 独立
            [child] 条目
           *[unknow] 新
        }笔记
    .tooltiptext = 已不再支持向附件添加笔记，但您可以将其迁移到单独的笔记后进行编辑。
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
    .aria-label = 快速搜索
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = 显示为
item-pane-header-none =
    .label = 无
item-pane-header-title =
    .label = 标题
item-pane-header-titleCreatorYear =
    .label = 标题、创建者、年份
item-pane-header-bibEntry =
    .label = 参考文献表条目
item-pane-header-more-options =
    .label = 更多选项
item-pane-message-items-selected =
    { $count ->
        [0] No items selected
        [one] { $count } item selected
       *[other] { $count } items selected
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
item-pane-message-unselected =
    { $count ->
        [0] No items in this view
        [one] { $count } item in this view
       *[other] { $count } items in this view
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Merge { $count } item
           *[other] Merge { $count } items
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
