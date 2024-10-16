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
pdfReader-a11yAnnotationPopupAppeared = Use Tab to navigate the annotation popup.
pdfReader-a11yAnnotationCreated = { $type } created.
pdfReader-a11yAnnotationSelected = { $type } selected.
pdfReader-a11yTextualAnnotationInstruction = To annotate text via the keyboard, first use “{ pdfReader-find-in-document }” to locate the phrase, and then press { general-key-control }-{ option-or-alt }-{ $number } to turn the search result into an annotation.
pdfReader-a11yAnnotationInstruction = To add this annotation into the document, focus the document and press { general-key-control }-{ option-or-alt }-{ $number }.
pdfReader-toolbar-draw =
    .aria-description = This annotation type cannot be created via the keyboard.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = 查找
    .placeholder = { pdfReader-find-in-document }
    .aria-description = To turn a search result into a highlight annotation, press { general-key-control }-{ option-or-alt }-1. To turn a search result into an underline annotation, press { general-key-control }-{ option-or-alt }-2.
