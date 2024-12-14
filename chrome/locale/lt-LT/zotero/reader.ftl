pdfReader-underlineText = Pabraukti tekstą
pdfReader-highlightText = Paryškinti tekstą
pdfReader-addText = Pridėti tekstą
pdfReader-selectArea = Pažymėti sritį
pdfReader-draw = Piešti
pdfReader-highlightAnnotation = Paryškinimas
pdfReader-underlineAnnotation = Pabraukimas
pdfReader-noteAnnotation = Pastaba
pdfReader-textAnnotation = Tekstinė anotacija
pdfReader-imageAnnotation = Image Annotation
pdfReader-find-in-document = Paieška dokumente
pdfReader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
pdfReader-a11yMoveAnnotation = Spausdami rodyklių klavišus galite pastumti anotaciją.
pdfReader-a11yEditTextAnnotation = Norėdami pakeisti tekstinės anotacijos plotį pagal dešinįjį kraštą (pabaigą), laikykite { general-key-shift } ir spauskite rodyklių klavišus kairėn arba dešinėn. Norėdami pakeisti tekstinės anotacijos plotį pagal kairįjį kraštą (pradžią), laikykite  { general-key-shift }-{ pdfReader-move-annotation-start-key } ir spauskite rodyklių klavišus.
pdfReader-a11yResizeAnnotation = Norėdami pakeisti tekstinės anotacijos dydį, laikykite { general-key-shift } ir spauskite rodyklių klavišus aukštyn arba žemyn.
pdfReader-a11yAnnotationPopupAppeared = Use Tab to navigate the annotation popup.
pdfReader-a11yAnnotationCreated = { $type } sukurtas.
pdfReader-a11yAnnotationSelected = { $type } pasirinktas.
-pdfReader-a11yTextualAnnotationInstruction = Norėdami sukurti tekstinę anotaciją naudodamiesi klaviatūra, pirmiausia raskite tekstą naudodamiesi „{ pdfReader-find-in-document }“, tuomet spauskite { general-key-control }-{ option-or-alt }-{ $number } pažymėtam tekstui paversti anotacija.
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
    .aria-description = Šio anotacijų tipo negalite sukurti naudodamiesi klaviatūra.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = Ieškoti
    .placeholder = { pdfReader-find-in-document }
    .aria-description = To turn a search result into a highlight annotation, press { general-key-control }-{ option-or-alt }-1. To turn a search result into an underline annotation, press { general-key-control }-{ option-or-alt }-2.
pdfReader-import-from-epub =
    .label = Importuoti el. knygos anotacijas…
pdfReader-import-from-epub-prompt-title = Importuoti el. knygos anotacijas
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
pdfReader-import-from-epub-select-other = Pasirinkti kitą rinkmeną…
