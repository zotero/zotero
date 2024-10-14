pdfReader-a11y-modifier =
    { PLATFORM() ->
        [macos] Option
        *[other] Alt
    }

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

pdfReader-a11yMoveAnnotation = Use arrow keys to move the annotation.
pdfReader-a11yEditTextAnnotation = To move the end of the text annotation, use left and right arrows while holding Shift. To move the start of the annotation, use left and right arrows while holding Shift - { pdfReader-a11y-modifier }.
pdfReader-a11yResizeAnnotation = Use arrow keys while holding Shift to resize the annotation.
pdfReader-a11yAnnotationPopupAppeared = Use tab to navigate annotation details popup.

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

-pdfReader-a11yTextualAnnotationInstruction = To annotate text via keyboard, use 'Find in document' to locate the phrase. Then, to turn search result into an annotation, press Control - { pdfReader-a11y-modifier } - { $number }.
-pdfReader-a11yAnnotationInstruction = To add this annotation into the document, focus the document and press Control - { pdfReader-a11y-modifier } - { $number }.

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
    .aria-description = Keyboard interface for this annotation type is not supported.
    .title = { pdfReader-draw }

pdfReader-findInDocumentInput =
    .title = Find
    .placeholder = Find in Document
    .aria-description = To turn a search result into a highlight annotation, press Control - { pdfReader-a11y-modifier } - 1. To turn a search result into an underline annotation, press Control - { pdfReader-a11y-modifier } - 2.
