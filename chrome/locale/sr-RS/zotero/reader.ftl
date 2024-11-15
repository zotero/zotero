pdfReader-underlineText = Подвуци текст
pdfReader-highlightText = Истакни текст
pdfReader-addText = Додај текст
pdfReader-selectArea = Изабери подручје
pdfReader-draw = Нацртај
pdfReader-highlightAnnotation = Истакнута забелешка
pdfReader-underlineAnnotation = Подвучена забелешка
pdfReader-noteAnnotation = Забелешка са коментаром
pdfReader-textAnnotation = Текстуална забелешка
pdfReader-imageAnnotation = Забелешка са сликом
pdfReader-find-in-document = Пронађи у документу
pdfReader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
pdfReader-a11yMoveAnnotation = Користите стрелице тастатуре да се крећете кроз забелешке.
pdfReader-a11yEditTextAnnotation = Да одете на крај текстуалне забелешке, држите { general-key-shift } и користите стрелице лево и десно. Да одете на почетак забелешке, држите { general-key-shift }-{ pdfReader-move-annotation-start-key } и користите стрелице.
pdfReader-a11yResizeAnnotation = Да промените величину забелешке, држите { general-key-shift } и користите стрелице.
pdfReader-a11yAnnotationPopupAppeared = Користите Tab да се крећете кроз искачуће забелешке.
pdfReader-a11yAnnotationCreated = { $type } је направљена.
pdfReader-a11yAnnotationSelected = { $type } је изабрана.
-pdfReader-a11yTextualAnnotationInstruction = Да направите забелешку преко тастатуре, најпре покрените „{ pdfReader-find-in-document }“ да нађете фразу коју желите, а затим притисните { general-key-control }-{ option-or-alt }-{ $number } да претворите резултат претраге у забелешку.
-pdfReader-a11yAnnotationInstruction = Да додате ову забелешку у документ, отворите документ и притисните { general-key-control }-{ option-or-alt }-{ $number }.
pdfReader-toolbar-highlight =
    .aria-description = { -pdfReader-a11yTextualAnnotationInstruction(number: 1) }
    .title = { pdfReader-highlightText }
pdfReader-toolbar-underline =
    .aria-description = { -pdfReader-a11yTextualAnnotationInstruction(number: 2) }
    .title = { pdfReader-underlineText }
pdfReader-toolbar-note =
    .aria-description = { -pdfReader-a11yAnnotationInstruction(number: 3) }
    .title = { pdfReader-noteAnnotation }
pdfReader-toolbar-text =
    .aria-description = { -pdfReader-a11yAnnotationInstruction(number: 4) }
    .title = { pdfReader-addText }
pdfReader-toolbar-area =
    .aria-description = { -pdfReader-a11yAnnotationInstruction(number: 5) }
    .title = { pdfReader-selectArea }
pdfReader-toolbar-draw =
    .aria-description = Не можете да направите ову врсту забелешке преко тастатуре.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = Нађи
    .placeholder = { pdfReader-find-in-document }
    .aria-description = Да претворите резултат претраге у истакнуту забелешку, притисните { general-key-control }-{ option-or-alt }-1. Да претворите резултат претраге у подвучену забелешку, притисните { general-key-control }-{ option-or-alt }-2.
pdfReader-import-from-epub =
    .label = Import Ebook Annotations…
pdfReader-import-from-epub-prompt-title = Import Ebook Annotations
pdfReader-import-from-epub-prompt-text =
    { -app-name } found { $count ->
        [1] { $count } { $tool } annotation
       *[other] { $count } { $tool } annotations
    }, last edited { $lastModifiedRelative }.
    
    Any { -app-name } annotations that were previously imported from this ebook will be updated.
pdfReader-import-from-epub-no-annotations-current-file =
    This ebook does not appear to contain any importable annotations.
    
    { -app-name } can import ebook annotations created in Calibre and KOReader.
pdfReader-import-from-epub-no-annotations-other-file =
    “{ $filename }” does not appear to contain any Calibre or KOReader annotations.
    
    If this ebook has been annotated with KOReader, try selecting a “metadata.epub.lua” file directly.
pdfReader-import-from-epub-select-other = Select Other File…
