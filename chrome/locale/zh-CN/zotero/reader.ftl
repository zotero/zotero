pdfReader-underlineText = 下划线文本
pdfReader-highlightText = 高亮文本
pdfReader-addText = 新增文字
pdfReader-selectArea = 选择区域
pdfReader-draw = 绘图
pdfReader-highlightAnnotation = 高亮注释
pdfReader-underlineAnnotation = 下划线注释
pdfReader-noteAnnotation = 笔记注释
pdfReader-textAnnotation = 文本注释
pdfReader-imageAnnotation = 图片注释
pdfReader-find-in-document = 在文件中查找
pdfReader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
pdfReader-a11yMoveAnnotation = 使用方向键移动注释
pdfReader-a11yEditTextAnnotation = To move the end of the text annotation, hold { general-key-shift } and use the left/right arrow keys. To move the start of the annotation, hold { general-key-shift }-{ pdfReader-move-annotation-start-key } and use the arrow keys.
pdfReader-a11yResizeAnnotation = To resize the annotation, hold { general-key-shift } and use the arrow keys.
pdfReader-a11yAnnotationPopupAppeared = 使用 Tab 导航到注释浮窗。
pdfReader-a11yAnnotationCreated = { $type } 已创建.
pdfReader-a11yAnnotationSelected = { $type } 已选择.
-pdfReader-a11yTextualAnnotationInstruction = 要通过键盘标注文本，请先使用“{ pdfReader-find-in-document }”找到该短语，然后按 { general-key-control }-{ option-or-alt }-{ $number } 将搜索结果转为注释中。
-pdfReader-a11yAnnotationInstruction = 要将此注释添加到文档中，请聚焦文档并按 { general-key-control }-{ option-or-alt }-{ $number }。
pdfReader-toolbar-highlight =
    .aria-description = { -pdfReader-a11yTextualAnnotationInstruction }
    .title = { pdfReader-underlineText }
pdfReader-toolbar-underline =
    .aria-description = { -pdfReader-a11yTextualAnnotationInstruction }
    .title = { pdfReader-highlightText }
pdfReader-toolbar-note =
    .aria-description = { -pdfReader-a11yAnnotationInstruction }
    .title = { pdfReader-noteAnnotation }
pdfReader-toolbar-text =
    .aria-description = { -pdfReader-a11yAnnotationInstruction }
    .title = { pdfReader-addText }
pdfReader-toolbar-area =
    .aria-description = { -pdfReader-a11yAnnotationInstruction }
    .title = { pdfReader-selectArea }
pdfReader-toolbar-draw =
    .aria-description = 该注释类型无法通过键盘创建。
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = 查找
    .placeholder = { pdfReader-find-in-document }
    .aria-description = 要将搜索结果转换为高亮注释，请按 { general-key-control }-{ option-or-alt }-1。要将搜索结果转换为下划线注释，请按 { general-key-control }-{ option-or-alt }-2。
pdfReader-a11yTextualAnnotationInstruction = 要通过键盘标注文本，请先使用“{ pdfReader-find-in-document }”找到该短语，然后按 { general-key-control }-{ option-or-alt }-{ $number } 将搜索结果转为注释中。
pdfReader-a11yAnnotationInstruction = 要将此注释添加到文档中，请聚焦文档并按 { general-key-control }-{ option-or-alt }-{ $number }。
