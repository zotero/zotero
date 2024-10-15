pdfReader-underlineText = Underline Text
pdfReader-highlightText = Highlight Text
pdfReader-addText = Add Text
pdfReader-selectArea = Select Area
pdfReader-draw = Draw

pdfReader-highlightAnnotation = Highlight annotation
pdfReader-underlineAnnotation = Underline annotation
pdfReader-noteAnnotation = Note Annotation
pdfReader-textAnnotation = Text Annotation
pdfReader-imageAnnotation = Image Annotation

pdfReader-find-in-document = Find in Document

pdfReader-a11yMoveAnnotation = Use the arrow keys to move the annotation.
pdfReader-a11yEditTextAnnotation = To move the end of the text annotation, hold { general-key-shift } and use the left/right arrow keys. To move the start of the annotation, hold { general-key-shift }-{ option-or-alt } and use the arrow keys.
pdfReader-a11yResizeAnnotation = To resize the annotation, hold { general-key-shift } and use the arrow keys.
pdfReader-a11yAnnotationPopupAppeared = Use Tab to navigate the annotation popup.

pdfReader-a11yAnnotationCreated = { $type ->
    [highlight] { pdfReader-highlightAnnotation }
    [underline] { pdfReader-underlineAnnotation }
    [note] { pdfReader-noteAnnotation }
    [text] { pdfReader-textAnnotation }
    [image] { pdfReader-imageAnnotation }
   *[other] Annotation
} created.

pdfReader-a11yAnnotationSelected = { $type ->
    [highlight] { pdfReader-highlightAnnotation } selected. { pdfReader-a11yEditTextAnnotation }
    [underline] { pdfReader-underlineAnnotation } selected. { pdfReader-a11yEditTextAnnotation }
    [note] { pdfReader-noteAnnotation } selected. { pdfReader-a11yMoveAnnotation }
    [text] { pdfReader-textAnnotation } selected. { pdfReader-a11yMoveAnnotation } { pdfReader-a11yResizeAnnotation }
    [image] { pdfReader-imageAnnotation } selected. { pdfReader-a11yMoveAnnotation } { pdfReader-a11yResizeAnnotation }
   *[other] Annotation selected.
} { $popupVisible -> 
    [yes] { pdfReader-a11yAnnotationPopupAppeared }
    *[other] { "" }
}

-pdfReader-a11yTextualAnnotationInstruction = To annotate text via the keyboard, first use “{ pdfReader-find-in-document }” to locate the phrase, and then press { general-key-control }-{ option-or-alt }-{ $number } to turn the search result into an annotation.
-pdfReader-a11yAnnotationInstruction = To add this annotation into the document, focus the document and press { general-key-control }-{ option-or-alt }-{ $number }.

pdfReader-toolbar-highlight =
    .aria-description = { -pdfReader-a11yTextualAnnotationInstruction(number: "1")  }
    .title = { pdfReader-underlineText }
pdfReader-toolbar-underline =
    .aria-description = { -pdfReader-a11yTextualAnnotationInstruction(number: "2")  }
    .title = { pdfReader-highlightText }
pdfReader-toolbar-note =
    .aria-description = { -pdfReader-a11yAnnotationInstruction(number: "3")  }
    .title = { pdfReader-noteAnnotation }
pdfReader-toolbar-text =
    .aria-description = { -pdfReader-a11yAnnotationInstruction(number: "4")  }
    .title = { pdfReader-addText }
pdfReader-toolbar-area =
    .aria-description = { -pdfReader-a11yAnnotationInstruction(number: "5")  }
    .title = { pdfReader-selectArea }
pdfReader-toolbar-draw =
    .aria-description = This annotation type cannot be created via the keyboard.
    .title = { pdfReader-draw }

pdfReader-findInDocumentInput =
    .title = Find
    .placeholder = { pdfReader-find-in-document }
    .aria-description = To turn a search result into a highlight or underline annotation, press { general-key-control }-{ option-or-alt }-1. To turn a search result into an underline annotation, press { general-key-control }-{ option-or-alt }-2.
