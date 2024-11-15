pdfReader-underlineText = Text unterstreichen
pdfReader-highlightText = Text hervorheben
pdfReader-addText = Text hinzufügen
pdfReader-selectArea = Bereich auswählen
pdfReader-draw = Zeichnen
pdfReader-highlightAnnotation = Markierungsanmerkung
pdfReader-underlineAnnotation = Unterstreichungsanmerkung
pdfReader-noteAnnotation = Notizanmerkung
pdfReader-textAnnotation = Textanmerkung
pdfReader-imageAnnotation = Bildanmerkung
pdfReader-find-in-document = Im Dokument finden
pdfReader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
pdfReader-a11yMoveAnnotation = Pfeiltasten verwenden, um die Anmerkung zu verschieben.
pdfReader-a11yEditTextAnnotation = Um das Ende der Anmerkung zu verschieben, { general-key-shift } und die Links-/Rechts-Pfeiltasten verwenden. Um den Anfang der Anmerkung zu verschieben, { general-key-shift }-{ pdfReader-move-annotation-start-key } und die Pfeiltasten verwenden..
pdfReader-a11yResizeAnnotation = Um die Größe der Anmerkung zu ändern { general-key-shift } gedrückt halten und die Pfeiltasten verwenden.
pdfReader-a11yAnnotationPopupAppeared = Tab verwenden, um das Anmerkungs-Popup zu navigieren.
pdfReader-a11yAnnotationCreated = { $type } erstellt.
pdfReader-a11yAnnotationSelected = { $type } ausgewählt.
-pdfReader-a11yTextualAnnotationInstruction = Um Text mit der Tastatur hervorzuheben nutzen Sie “{ pdfReader-find-in-document }” um den Ausdruck zu finden und drücken Sie { general-key-control }-{ option-or-alt }-{ $number } um das Suchergebnis in eine Hervorhebung umzuwandeln.
-pdfReader-a11yAnnotationInstruction = To add this annotation into the document, focus the document and press { general-key-control }-{ option-or-alt }-{ $number }.
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
    .aria-description = Diese Anmerkungsart kann nicht mit der Tastatur erstellt werden.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = Suchen
    .placeholder = { pdfReader-find-in-document }
    .aria-description = To turn a search result into a highlight annotation, press { general-key-control }-{ option-or-alt }-1. To turn a search result into an underline annotation, press { general-key-control }-{ option-or-alt }-2.
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
