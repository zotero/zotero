pdfReader-underlineText = Podkreśl tekst
pdfReader-highlightText = Podświetl tekst
pdfReader-addText = Dodaj tekst
pdfReader-selectArea = Wybierz obszar
pdfReader-draw = Rysuj
pdfReader-highlightAnnotation = Podświetl adnotację
pdfReader-underlineAnnotation = Podkreśl adnotację
pdfReader-noteAnnotation = Adnotacja notatką
pdfReader-textAnnotation = Adnotacja tekstowa
pdfReader-imageAnnotation = Adnotacja obrazem
pdfReader-find-in-document = Znajdź w dokumencie
pdfReader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
pdfReader-a11yMoveAnnotation = Użyj klawiszy strzałek, aby przenieść adnotację.
pdfReader-a11yEditTextAnnotation = To move the end of the text annotation, hold { general-key-shift } and use the left/right arrow keys. To move the start of the annotation, hold { general-key-shift }-{ pdfReader-move-annotation-start-key } and use the arrow keys.
pdfReader-a11yResizeAnnotation = Aby zmienić rozmiar adnotacji, przytrzymaj { general-key-shift } i użyj klawiszy strzałek.
pdfReader-a11yAnnotationPopupAppeared = Użyj klawisza tabulacji, aby nawigować po dymkach adnotacji.
pdfReader-a11yAnnotationCreated = { $type } created.
pdfReader-a11yAnnotationSelected = { $type } selected.
-pdfReader-a11yTextualAnnotationInstruction = Aby tworzyć adnotacje za pomocą klawiatury, najpierw użyj “{ pdfReader-find-in-document }”, aby znaleźć wyrażenie, a następnie wciśnij { general-key-control }-{ option-or-alt }-{ $number } aby zapisać wynik wyszukiwania do adnotacji.
-pdfReader-a11yAnnotationInstruction = To add this annotation into the document, focus the document and press { general-key-control }-{ option-or-alt }-{ $number }.
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
    .aria-description = Ten rodzaj adnotacji nie może być utworzony za pomocą klawiatury.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = Znajdź
    .placeholder = { pdfReader-find-in-document }
    .aria-description = To turn a search result into a highlight annotation, press { general-key-control }-{ option-or-alt }-1. To turn a search result into an underline annotation, press { general-key-control }-{ option-or-alt }-2.
pdfReader-a11yTextualAnnotationInstruction = Aby tworzyć adnotacje za pomocą klawiatury, najpierw użyj “{ pdfReader-find-in-document }”, aby znaleźć wyrażenie, a następnie wciśnij { general-key-control }-{ option-or-alt }-{ $number } aby zapisać wynik wyszukiwania do adnotacji.
pdfReader-a11yAnnotationInstruction = To add this annotation into the document, focus the document and press { general-key-control }-{ option-or-alt }-{ $number }.
