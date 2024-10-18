pdfReader-underlineText = Sottolinea il testo
pdfReader-highlightText = Evidenzia il testo
pdfReader-addText = Aggiungi testo
pdfReader-selectArea = Seleziona area
pdfReader-draw = Disegna
pdfReader-highlightAnnotation = Annotazione: evidenziatura
pdfReader-underlineAnnotation = Annotazione: sottolineatura
pdfReader-noteAnnotation = Annotazione: commento
pdfReader-textAnnotation = Annotazione: testo
pdfReader-imageAnnotation = Annotazione: immagine
pdfReader-find-in-document = Trova nel documento
pdfReader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
pdfReader-a11yMoveAnnotation = Usa le frecce per spostare l'annotazione
pdfReader-a11yEditTextAnnotation = Per modificare la fine dell'annotazione, premi { general-key-shift } e usa le frecce di destra o sinistra. Per modificare l'inizio dell'annotazione, premi { general-key-shift }-{ pdfReader-move-annotation-start-key } e usa le frecce.
pdfReader-a11yResizeAnnotation = Per ridimensionare l'annotazione, premi { general-key-shift } e usa le frecce.
pdfReader-a11yAnnotationPopupAppeared = Usa il tasto Tab per navigare nel popup dell'annotazione
pdfReader-a11yAnnotationCreated = Creata { $type }.
pdfReader-a11yAnnotationSelected = Selezionata { $type }.
-pdfReader-a11yTextualAnnotationInstruction = Per annotare il testo da tastiera, prima usa la funzione “{ pdfReader-find-in-document }” per individuare la frase, quindi premi { general-key-control }-{ option-or-alt }-{ $number } per convertire il risultato della ricerca in un'annotazione.
-pdfReader-a11yAnnotationInstruction = Per aggiungere questa annotazione al documento, selezionare il documento e premere { general-key-control }-{ option-or-alt }-{ $number }.
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
    .aria-description = Questo tipo di annotazione non può essere creato da tastiera.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = Trova
    .placeholder = { pdfReader-find-in-document }
    .aria-description = Per convertire il risultato di una ricerca in evidenziatura, premi { general-key-control }-{ option-or-alt }-1. Per convertire il risultato in sottolineatura, premi { general-key-control }-{ option-or-alt }-2.
pdfReader-a11yTextualAnnotationInstruction = Per annotare il testo da tastiera, prima usa la funzione “{ pdfReader-find-in-document }” per individuare la frase, quindi premi { general-key-control }-{ option-or-alt }-{ $number } per convertire il risultato della ricerca in un'annotazione.
pdfReader-a11yAnnotationInstruction = Per aggiungere questa annotazione al documento, selezionare il documento e premere { general-key-control }-{ option-or-alt }-{ $number }.
