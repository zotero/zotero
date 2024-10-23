pdfReader-underlineText = Souligner le texte
pdfReader-highlightText = Surligner le texte
pdfReader-addText = Ajouter du texte
pdfReader-selectArea = Sélectionner une zone
pdfReader-draw = Dessiner
pdfReader-highlightAnnotation = Surligner l'annotation
pdfReader-underlineAnnotation = Souligner l'annotation
pdfReader-noteAnnotation = Annotation de type note
pdfReader-textAnnotation = Annotation de type texte
pdfReader-imageAnnotation = Annotation de type image
pdfReader-find-in-document = Rechercher dans le document
pdfReader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
pdfReader-a11yMoveAnnotation = Utiliser les touches de direction pour déplacer l'annotation.
pdfReader-a11yEditTextAnnotation = Pour déplacer la fin de l'annotation de type texte, tenir le touche { general-key-shift } enfoncée et utiliser les touches de direction gauche/droite. Pour déplacer le début de l'annotation , tenir les touches { general-key-shift }-{ pdfReader-move-annotation-start-key } enfoncées et utiliser les touches de direction.
pdfReader-a11yResizeAnnotation = Pour redimensionner cette annotation, tenir le touche { general-key-shift } enfoncée et utiliser les touches de direction.
pdfReader-a11yAnnotationPopupAppeared = Utiliser la touche Tab pour naviguer dans le menu contextuel d'annotation.
pdfReader-a11yAnnotationCreated = { $type } créé(e).
pdfReader-a11yAnnotationSelected = { $type } sélectionné(e).
-pdfReader-a11yTextualAnnotationInstruction = Pour annoter du texte au clavier, utiliser “{ pdfReader-find-in-document }” pour localiser la phrase, puis appuyer sur { general-key-control }-{ option-or-alt }-{ $number } pour convertir le résultat de recherche en annotation.
-pdfReader-a11yAnnotationInstruction = Pour ajouter cette annotation au document, placer le curseur dans le document et appuyer sur { general-key-control }-{ option-or-alt }-{ $number }.
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
    .aria-description = Ce type d'annotation ne peut pas être créé au clavier.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = Rechercher
    .placeholder = { pdfReader-find-in-document }
    .aria-description = Pour transformer le résultat de recherche en surlignement, appuyer sur { general-key-control }-{ option-or-alt }-1. Pour transformer le résultat de recherche en soulignement, appuyer sur { general-key-control }-{ option-or-alt }-2.
