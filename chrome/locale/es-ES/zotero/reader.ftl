pdfReader-underlineText = Texto subrayado
pdfReader-highlightText = Resaltar texto
pdfReader-addText = Añadir texto
pdfReader-selectArea = Seleccionar área
pdfReader-draw = Dibujar
pdfReader-highlightAnnotation = Resaltar anotación
pdfReader-underlineAnnotation = Subrayar anotación
pdfReader-noteAnnotation = Anotación de nota
pdfReader-textAnnotation = Anotación de texto
pdfReader-imageAnnotation = Anotación de imágenes
pdfReader-find-in-document = Buscar en el documento
pdfReader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
pdfReader-a11yMoveAnnotation = Use las teclas de flecha para mover la anotación.
pdfReader-a11yEditTextAnnotation = Para mover el final de la anotación de texto, mantenga pulsada { general-key-shift } y use las teclas de flecha izquierda/derecha. Para mover el inicio de la anotación, mantenga pulsado { general-key-shift }-{ pdfReader-move-annotation-start-key } y use las teclas de flecha.
pdfReader-a11yResizeAnnotation = Para cambiar el tamaño de la anotación, mantenga pulsado  { general-key-shift } y use las teclas de flecha.
pdfReader-a11yAnnotationPopupAppeared = Use el tabulador para navegar por la ventana emergente de anotaciones.
pdfReader-a11yAnnotationCreated = { $type } creado.
pdfReader-a11yAnnotationSelected = { $type } seleccionado.
-pdfReader-a11yTextualAnnotationInstruction = Para anotar texto mediante el teclado, use primero “{ pdfReader-find-in-document }” para localizar la frase y, a continuación, pulse { general-key-control }-{ option-or-alt }-{ $number } para convertir el resultado de la búsqueda en una anotación.
-pdfReader-a11yAnnotationInstruction = Para añadir esta anotación al documento, sitúese en el documento y pulse { general-key-control }-{ option-or-alt }-{ $number }.
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
    .aria-description = Este tipo de anotación no puede crearse mediante el teclado.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = Buscar
    .placeholder = { pdfReader-find-in-document }
    .aria-description = Para convertir un resultado de búsqueda en una anotación resaltada, pulse  { general-key-control }-{ option-or-alt }-1. Para convertir un resultado de búsqueda en una anotación subrayada, pulse { general-key-control }-{ option-or-alt }-2.
pdfReader-a11yTextualAnnotationInstruction = Para anotar texto mediante el teclado, use primero “{ pdfReader-find-in-document }” para localizar la frase y, a continuación, pulse { general-key-control }-{ option-or-alt }-{ $number } para convertir el resultado de la búsqueda en una anotación.
pdfReader-a11yAnnotationInstruction = Para añadir esta anotación al documento, sitúese en el documento y pulse { general-key-control }-{ option-or-alt }-{ $number }.
