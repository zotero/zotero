integration-docPrefs-window =
    .title = { -app-name } - 文档首选项
integration-addEditCitation-window =
    .title = { -app-name } - 添加/编辑引注
integration-editBibliography-window =
    .title = { -app-name } - 编辑参考文献表
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = 编辑参考文献表
-integration-editBibliography-include-uncited = 要在你的参考书目中包括未引用的项目，请在项目列表中选择它，然后按 { general-add }。
-integration-editBibliography-exclude-cited = 您也可以通过从参考文献列表中选择并按下 { general-remove } 来排除已引用的项目。
-integration-editBibliography-edit-reference = 要更改参考文献的格式，请使用文本编辑器。
integration-editBibliography-wrapper =
    .aria-label = 编辑参考文献对话框
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = 引注对话框
integration-citationDialog-section-open = 已打开的文档 ({ $count })
integration-citationDialog-section-selected = 已选中 ({ $count }/{ $total }) 条目
integration-citationDialog-section-cited =
    { $count ->
        [0] 已引用条目
       *[other] 已引用条目 ({ $count })
    }
integration-citationDialog-details-suffix = 后缀
integration-citationDialog-details-prefix = 前缀
integration-citationDialog-details-suppressAuthor = 省略作者
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = 引用设置
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] 没有选中、打开或引用的条目与当前搜索匹配
       *[other] 没有选中或打开的条目
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] 无匹配的笔记
       *[other] 未选中笔记
    }
integration-citationDialog-settings-keepSorted = 保持文献自动排序
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = 文献库
integration-citationDialog-mode-list = List
integration-citationDialog-btn-type-citation =
    .title = 添加/编辑引注
integration-citationDialog-btn-type-add-note =
    .title = 添加笔记
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = 使用向左/向右箭头导航此引注的条目。按Tab键选择要添加到引注中的条目。
integration-citationDialog-enter-to-add-item = 按 { return-or-enter } 将此条目添加到引注中。
integration-citationDialog-search-for-items = 搜索要添加到引注中的条目
integration-citationDialog-aria-bubble =
    .aria-description = 该条目已包含在引注中。按空格键自定义条目。{ integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = 按Tab键选择要添加到此引注中的条目。按Esc键放弃修改并关闭对话框。
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = 搜索要添加到文档中的笔记
integration-citationDialog-aria-item-list =
    .aria-description = 使用向上/向下箭头修改条目选择。 { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = 使用向左/向右箭头修改条目选择。 { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = 分类。
    .aria-description = 选择一个分类并按Tab键浏览其中的条目。
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = 此条目已添加到引注中。按 { return-or-enter } 重新添加，或按 { delete-or-backspace } 删除。
integration-citationDialog-add-all = 添加所有
integration-citationDialog-collapse-section =
    .title = 折叠此栏
integration-citationDialog-bubble-empty = （无标题）
integration-citationDialog-add-to-citation = 添加到引文
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
    .label = 改用其他的文档编辑软件…
integration-error-unable-to-find-winword = { -app-name } 没有找到运行中的 Word 程序。
integration-warning-citation-changes-will-be-lost = 您已修改引注，继续将丢失这些修改。
integration-warning-bibliography-changes-will-be-lost = 您已修改参考文献表，继续将丢失这些修改。
integration-warning-documentPreferences-changes-will-be-lost = 您已修改文档首选项，继续将丢失这些修改。
integration-warning-discard-changes = 放弃修改
integration-warning-command-is-running = 文字处理器集成命令已在运行。
