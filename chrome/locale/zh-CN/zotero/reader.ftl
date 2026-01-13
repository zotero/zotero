reader-annotations = 注释
reader-show-annotations = 显示注释
reader-search-annotations = 搜索注释
reader-search-outline = 搜索大纲
reader-no-annotations = 创建注释使其在侧栏可见
reader-no-extracted-text = 无提取的文本
reader-add-comment = 添加评论
reader-annotation-comment = 注释评论
reader-annotation-text = 注释文本
reader-manage-tags = 管理这个注释的标签
reader-open-menu = 打开注释菜单
reader-thumbnails = 缩略图
reader-tag-selector-message = 根据此标签筛选注释
reader-add-tags = 添加标签…
reader-highlight-text = 高亮文本
reader-underline-text = 下划线文本
reader-add-note = 添加笔记
reader-add-text = 新增文字
reader-select-area = 选择区域
reader-highlight-annotation = 高亮注释
reader-underline-annotation = 下划线注释
reader-note-annotation = 笔记注释
reader-text-annotation = 文本注释
reader-image-annotation = 图片注释
reader-ink-annotation = 笔迹注释
reader-search-result-index = 搜索结果
reader-search-result-total = 全部搜索结果
reader-draw = 绘图
reader-eraser = 橡皮擦
reader-pick-color = 选择一种颜色
reader-add-to-note = 添加笔记
reader-zoom-in = 放大
reader-zoom-out = 缩小
reader-zoom-reset = 重置缩放
reader-zoom-auto = 自动调整大小
reader-zoom-page-width = 适应页面宽度
reader-zoom-page-height = 适应页面高度
reader-split-vertically = 竖向拆分
reader-split-horizontally = 横向拆分
reader-next-page = 下一页
reader-previous-page = 上一页
reader-page = 页
reader-location = 定位
reader-read-only = 只读
reader-prompt-transfer-from-pdf-title = 导入注释
reader-prompt-transfer-from-pdf-text = PDF 文件中保存的注释将被移动到 { $target }。
reader-prompt-password-protected = 受到密码保护的 PDF 文件不支持此操作。
reader-prompt-delete-pages-title = 删除页面
reader-prompt-delete-pages-text =
    { $count ->
       *[other] 确定要从 PDF 文件中删除 { $count } 个页面吗？
    }
reader-prompt-delete-annotations-title = 删除注释
reader-prompt-delete-annotations-text =
    { $count ->
       *[other] 确定要删除选中的注释吗？
    }
reader-rotate-left = 逆时针旋转
reader-rotate-right = 顺时针旋转
reader-edit-page-number = 编辑页码…
reader-edit-annotation-text = 编辑注释文本
reader-copy-image = 复制图片
reader-save-image-as = 图片另存为…
reader-page-number-popup-header = 该页及后续页面
reader-this-annotation = 此注释
reader-selected-annotations = 已选注释
reader-this-page = 该页
reader-this-page-and-later-pages = 该页面和之后的页面。
reader-all-pages = 所有页面
reader-auto-detect = 自动检测
reader-enter-password = 输入密码以打开此 PDF 文件
reader-include-annotations = 包括注释
reader-preparing-document-for-printing = 正在准备打印文档…
reader-phrase-not-found = 未找到关键词
reader-find = 查找
reader-close = 关闭
reader-show-thumbnails = 显示缩略图
reader-show-outline = 显示大纲
reader-find-previous = 查找此短语上次出现的地方
reader-find-next = 查找此短语下次出现的地方
reader-toggle-sidebar = 展开/折叠侧边栏
reader-find-in-document = 在文件中查找
reader-toggle-context-pane = 开/合内容窗格
reader-highlight-all = 高亮所有
reader-match-case = 区分大小写
reader-whole-words = 整词
reader-appearance = 外观
reader-epub-appearance-line-height = 行高
reader-epub-appearance-word-spacing = 字间距
reader-epub-appearance-letter-spacing = 字符间距
reader-epub-appearance-page-width = 页宽
reader-epub-appearance-use-original-font = 使用原字体
reader-epub-appearance-line-height-revert = 使用默认行高
reader-epub-appearance-word-spacing-revert = 使用默认字间距
reader-epub-appearance-letter-spacing-revert = 使用默认字符间距
reader-epub-appearance-page-width-revert = 使用默认页宽
reader-convert-to-highlight = 转换为高亮
reader-convert-to-underline = 转换为下划线
reader-size = 大小
reader-merge = 合并
reader-copy-link = 复制链接
reader-theme-original = 原始
reader-theme-snow = 雪色
reader-theme-sepia = 棕褐
reader-theme-dark = 深色
reader-add-theme = 新增主题
reader-scroll-mode = 滚动
reader-spread-mode = 平铺
reader-flow-mode = 页面布局
reader-columns = 列
reader-split-view = 拆分视图
reader-themes = 主题
reader-vertical = 竖向
reader-horizontal = 横向
reader-wrapped = 多页
reader-none = 无
reader-odd = 奇数页起始（无封面）
reader-even = 偶数页起始（有封面）
reader-paginated = 分页
reader-scrolled = 卷轴
reader-single = 单页
reader-double = 双页
reader-theme-name = 主题名称：
reader-background = 背景色
reader-foreground = 前景色：
reader-reading-mode = 阅读模式
reader-reading-mode-not-supported = 此文件不支持阅读模式。
reader-clear-selection = 清除选择
reader-epub-encrypted = This ebook is encrypted and cannot be opened.
reader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
reader-a11y-move-annotation = 使用方向键移动注释
reader-a11y-edit-text-annotation = 按住{ general-key-shift }键并使用向左/向右箭头移动文本注释的结束位置。按住{ general-key-shift }-{ reader-move-annotation-start-key }并使用箭头移动注释的起始位置。
reader-a11y-resize-annotation = 要调整标注的大小，按住 { general-key-shift } 并使用方向键。
reader-a11y-annotation-popup-appeared = 使用 Tab 导航到注释浮窗。
reader-a11y-annotation-created = { $type } 已创建.
reader-a11y-annotation-selected = { $type } 已选择.
-reader-a11y-textual-annotation-instruction = 要通过键盘标注文本，请先使用“{ reader-find-in-document }”找到该短语，然后按{ general-key-control }-{ option-or-alt }-{ $number }将搜索结果转为注释。
-reader-a11y-annotation-instruction = 要将此注释添加到文档中，请聚焦文档并按 { general-key-control }-{ option-or-alt }-{ $number }。
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
    .aria-description = 该注释类型无法通过键盘创建。
    .title = { reader-draw }
reader-find-in-document-input =
    .title = 查找
    .placeholder = { reader-find-in-document }
    .aria-description = 要将搜索结果转换为高亮注释，请按 { general-key-control }-{ option-or-alt }-1。要将搜索结果转换为下划线注释，请按 { general-key-control }-{ option-or-alt }-2。
reader-import-from-epub =
    .label = 导入电子书注释…
reader-import-from-epub-prompt-title = 导入电子书注释
reader-import-from-epub-prompt-text =
    { -app-name } 找到了 { $count ->
        [one] { $count } 个 { $tool } 注释
       *[other] { $count } 个 { $tool } 注释
    }，最后编辑于 { $lastModifiedRelative }。
    
    之前从这本电子书导入的所有 { -app-name } 注释都将被更新。
reader-import-from-epub-no-annotations-current-file =
    此电子书似乎不包含任何可导入的注释。
    
    { -app-name } 可以导入在 Calibre 和 KOReader 中创建的电子书标注。
reader-import-from-epub-no-annotations-other-file =
    "{ $filename }" 似乎不包含任何 Calibre 或 KOReader 的标注。
    
    如果此电子书已使用KOReader进行注释，请尝试直接选择"metadata.epub.lua"文件。
reader-import-from-epub-select-other = 选择其他文件…
reader-selected-pages =
    { $count ->
       *[other] { $count } 页面已选中
    }
reader-page-options = 页面选项
