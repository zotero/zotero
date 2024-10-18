pdfReader-underlineText = Understrek tekst
pdfReader-highlightText = Merk tekst
pdfReader-addText = Legg til tekst
pdfReader-selectArea = Velg område
pdfReader-draw = Tegn
pdfReader-highlightAnnotation = Uthevingskommentar
pdfReader-underlineAnnotation = Understrekingskommentar
pdfReader-noteAnnotation = Notatkommentar
pdfReader-textAnnotation = Tekstkommentar
pdfReader-imageAnnotation = Bildekommentar
pdfReader-find-in-document = Finn i dokument
pdfReader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
pdfReader-a11yMoveAnnotation = Bruk piltastene til å flytte kommentaren.
pdfReader-a11yEditTextAnnotation = For å flytte slutten av tekstkommentaren holder du inne { general-key-shift } og bruker venstre/høyre piltast. Hvis du vil flytte starten av kommentaren, holder du inne { general-key-shift }-{ pdfReader-move-annotation-start-key } og bruker piltastene.
pdfReader-a11yResizeAnnotation = Hvis du vil endre størrelsen på kommentaren, holder du inne { general-key-shift } og bruker piltastene.
pdfReader-a11yAnnotationPopupAppeared = Bruk Tab for å navigere i popup-vinduet for kommentarer.
pdfReader-a11yAnnotationCreated = { $type } opprettet.
pdfReader-a11yAnnotationSelected = { $type } valgt.
-pdfReader-a11yTextualAnnotationInstruction = Hvis du vil kommentere tekst via tastaturet, bruker du først "{ pdfReader-find-in-document }" for å finne frasen, og deretter trykker du { general-key-control }-{ option-or-alt }-{ $number } for å gjøre søkeresultatet om til en kommentar.
-pdfReader-a11yAnnotationInstruction = For å legge til denne kommentaren i dokumentet, fokuserer du på dokumentet og trykker { general-key-control }-{ option-or-alt }-{ $number }.
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
    .aria-description = Denne type kommentar kan ikke opprettes ved hjelp av tastaturet.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = Finn
    .placeholder = { pdfReader-find-in-document }
    .aria-description = Hvis du vil gjøre et søkeresultat om til en uthevingskommentar, trykker du på { general-key-control }-{ option-or-alt }-1. Hvis du vil gjøre et søkeresultat om til en understrekingskommentar, trykker du på { general-key-control }-{ option-or-alt }-2.
pdfReader-a11yTextualAnnotationInstruction = Hvis du vil kommentere tekst via tastaturet, bruker du først "{ pdfReader-find-in-document }" for å finne frasen, og deretter trykker du { general-key-control }-{ option-or-alt }-{ $number } for å gjøre søkeresultatet om til en kommentar.
pdfReader-a11yAnnotationInstruction = For å legge til denne kommentaren i dokumentet, fokuserer du på dokumentet og trykker { general-key-control }-{ option-or-alt }-{ $number }.
