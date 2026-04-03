preferences-window =
    .title = { -app-name } 设置
preferences-appearance-title = 外观和语言
preferences-auto-recognize-files =
    .label = 自动检索 PDF 和电子书的元数据
preferences-file-renaming-title = 文件重命名
preferences-file-renaming-intro = { -app-name } 可以根据上级条目的元数据（如标题、作者等）自动重命名文件，并在你进行更改时保持文件名同步。下载的文件始终会根据父项进行初始命名。
preferences-file-renaming-configure-button =
    .label = 配置文件重命名…
preferences-attachment-titles-title = 附件标题
preferences-attachment-titles-intro = 附件标题<label data-l10n-name="wiki-link">与文件名不同</label>。为了支持某些工作流，{ -app-name }  可以在条目列表中显示文件名而不是附件标题。
preferences-attachment-titles-show-filenames =
    .label = 在条目列表中显示附件文件名
preferences-reader-title = 阅读器
preferences-reader-open-epubs-using = EPUB 打开方式：
preferences-reader-open-snapshots-using = 网页快照打开方式：
preferences-reader-open-in-new-window =
    .label = 在新窗口而不是标签页中打开文件
preferences-reader-auto-disable-tool =
    .label = 每次使用后关闭注释、文本和图像注释工具
preferences-reader-ebook-font = 电子书字体：
preferences-reader-ebook-hyphenate =
    .label = 启用自动连字
preferences-note-title = 笔记
preferences-note-open-in-new-window =
    .label = 在新窗口而不是标签页中打开笔记
preferences-color-scheme = 配色方案：
preferences-color-scheme-auto =
    .label = 自动
preferences-color-scheme-light =
    .label = 浅色
preferences-color-scheme-dark =
    .label = 深色
preferences-item-pane-header = 条目窗格题头：
preferences-item-pane-header-style = 顶部参考文献样式：
preferences-item-pane-header-locale = 题头语言：
preferences-item-pane-header-missing-style = 缺少样式：<{ $shortName }>
preferences-locate-library-lookup-intro = 文库检索可以使用图书馆的 OpenURL 解析器在线查找资源。
preferences-locate-resolver = 解析器:
preferences-locate-base-url = 基准网址：
preferences-quickCopy-minus =
    .aria-label = { general-remove }
    .label = { $label }
preferences-quickCopy-plus =
    .aria-label = { general-add }
    .label = { $label }
preferences-styleManager-intro = { -app-name } 可以生成 10,000 多种引用样式的引注和参考书目。在此处添加样式以便在 { -app-name } 中选择样式时使用。
preferences-styleManager-get-additional-styles =
    .label = 获取更多样式…
preferences-styleManager-restore-default =
    .label = 恢复默认样式…
preferences-styleManager-add-from-file =
    .tooltiptext = 从文件添加一个样式
    .label = 从文件添加…
preferences-styleManager-remove = 按 { delete-or-backspace } 删除此样式。
preferences-citation-dialog = 引用对话框
preferences-citation-dialog-mode = 引注对话框模式：
preferences-citation-dialog-mode-last-used =
    .label = 上次使用
preferences-citation-dialog-mode-list =
    .label = 列表模式
preferences-citation-dialog-mode-library =
    .label = 文库模式
preferences-advanced-enable-local-api =
    .label = 允许此计算机上的其他应用程序与 { -app-name } 通讯
preferences-advanced-local-api-available = 可用于 <code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = { -app-name } HTTP 服务器已禁用。
preferences-advanced-server-enable-and-restart =
    .label = 启用并重启
preferences-advanced-language-and-region-title = 语言和区域
preferences-advanced-enable-bidi-ui =
    .label = 启用双向文本编辑工具
preferences-advanced-reset-data-dir =
    .label = 恢复到默认位置...
preferences-advanced-custom-data-dir =
    .label = 使用自定义位置
preferences-advanced-default-data-dir =
    .value = (默认： { $directory })
    .aria-label = 默认位置
-preferences-sync-data-syncing = 数据同步
preferences-sync-data-syncing-groupbox =
    .aria-label = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-heading = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-description = 登录你的 { -app-name } 账户以跨设备同步你的数据、与他人协作等。
preferences-account-log-out =
    .label = 退出登录…
preferences-sync-reset-restore-to-server-body = { -app-name } 将用此计算机中的数据替换 { $domain } 中 “{ $libraryName }” 中的数据。
preferences-sync-reset-restore-to-server-deleted-items-text =
    在线文库中 { $remoteItemsDeletedCount } 个 { $remoteItemsDeletedCount ->
        [one] 条目
       *[other] 条目
    } 将被永久删除。
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] 本地文库和在线文库将被清空。
        [one] 本地文库和在线文库中的1个条目将被保留。
       *[other] 本地文库和在线文库中的{ $localItemsCount } 个条目将被保留。
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
       *[other] 删除 { $remoteItemsDeletedCount } 个条目
    }
preferences-sync-reset-restore-to-server-confirmation-text = 删除在线文献库
preferences-sync-reset-restore-to-server-yes = 替换在线图书馆中的数据
preferences-account-log-in =
    .label = 登录
preferences-account-waiting-for-login =
    .value = 等待登录…
preferences-account-cancel-button =
    .label = { general-cancel }
preferences-account-logged-out-status =
    .value = （已退出登录）
preferences-account-email-label =
    .value = 邮箱：
preferences-account-switch-accounts =
    .label = 切换账户…
preferences-account-switch-text = 切换到其他账户将删除此计算机中所有的 { -app-name } 数据。在继续之前，请确保您想要保留的所有数据和文件都已与 “{ $username }” 账户同步，或者您已经备份 { -app-name } 数据目录。
preferences-account-switch-confirmation-text = 删除本地数据
preferences-account-switch-accept = 删除数据并重新启动
