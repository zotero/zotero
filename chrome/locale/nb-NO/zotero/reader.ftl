pdfReader-underlineText = Understrek tekst
pdfReader-highlightText = Merk tekst
pdfReader-addText = Legg til tekst
pdfReader-selectArea = Velg område
pdfReader-draw = Tegn
pdfReader-highlightAnnotation = Uthev markering
pdfReader-underlineAnnotation = Understrek markering
pdfReader-noteAnnotation = Notatmarkering
pdfReader-textAnnotation = Tekstmarkering
pdfReader-imageAnnotation = Bildemarkering
pdfReader-find-in-document = Finn i dokument
pdfReader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
pdfReader-a11yMoveAnnotation = Bruk piltastene til å flytte markeringen.
pdfReader-a11yEditTextAnnotation = For å flytte slutten av tekstmarkeringen holder du inne { general-key-shift } og bruker venstre/høyre piltast. Hvis du vil flytte starten av markeringen, holder du inne { general-key-shift }-{ pdfReader-move-annotation-start-key } og bruker piltastene.
pdfReader-a11yResizeAnnotation = Hvis du vil endre størrelsen på markeringen, holder du inne { general-key-shift } og bruker piltastene.
pdfReader-a11yAnnotationPopupAppeared = Bruk Tab for å navigere i popup-vinduet for markeringer.
pdfReader-a11yAnnotationCreated = { $type } opprettet.
pdfReader-a11yAnnotationSelected = { $type } valgt.
pdfReader-a11yTextualAnnotationInstruction = Hvis du vil markere tekst via tastaturet, bruker du først "{ pdfReader-find-in-document }" for å finne frasen, og deretter trykker du { general-key-control }-{ option-or-alt }-{ $number } for å gjøre søkeresultatet om til en markering.
pdfReader-a11yAnnotationInstruction = For å legge til denne markeringen i dokumentet, fokuserer du på dokumentet og trykker { general-key-control }-{ option-or-alt }-{ $number }.
pdfReader-toolbar-draw =
    .aria-description = Denne type markering kan ikke opprettes ved hjelp av tastaturet.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = Finn
    .placeholder = { pdfReader-find-in-document }
    .aria-description = Hvis du vil gjøre et søkeresultat om til en uthevet markering, trykker du på { general-key-control }-{ option-or-alt }-1. Hvis du vil gjøre et søkeresultat om til en understreket markering, trykker du på { general-key-control }-{ option-or-alt }-2.
