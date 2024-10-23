pdfReader-underlineText = Alleviivaa teksti
pdfReader-highlightText = Korosta teksti
pdfReader-addText = Lisää teksti
pdfReader-selectArea = Valitse alue
pdfReader-draw = Piirrä
pdfReader-highlightAnnotation = Korosta huomautus
pdfReader-underlineAnnotation = Alleviivaa huomautus
pdfReader-noteAnnotation = Muistilappu
pdfReader-textAnnotation = Tekstihuomautus
pdfReader-imageAnnotation = Kuvahuomautus
pdfReader-find-in-document = Etsi asiakirjasta
pdfReader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
pdfReader-a11yMoveAnnotation = Voit siirtää huomautusta käyttämällä nuolinäppäimiä.
pdfReader-a11yEditTextAnnotation = Siirtääksesi tekstihuomautuksen loppua, pidä pohjassa { general-key-shift } ja paina vasenta tai oikeaa nuolinäppäintä. Siirtääksesi huomautuksen alkua, pidä { general-key-shift }-{ pdfReader-move-annotation-start-key } ja paina vasenta tai oikeaa nuolinäppäintä.
pdfReader-a11yResizeAnnotation = Muuttaaksesi huomautuksen kokoa, pidä pohjassa { general-key-shift } ja käytä nuolinäppäimiä.
pdfReader-a11yAnnotationPopupAppeared = Käytä sarkainnäppäintä siirtyäksesi huomautusponnahdusikkunassa.
pdfReader-a11yAnnotationCreated = { $type } luotu.
pdfReader-a11yAnnotationSelected = { $type } valittu.
-pdfReader-a11yTextualAnnotationInstruction = Lisätäksesi huomautuksia näppäimistöltä, käytä ensin “{ pdfReader-find-in-document }” löytääksesi hakusanan tai -lauseen, ja paina sitten { general-key-control }-{ option-or-alt }-{ $number } muuttaaksesi hakutuloksen huomautukseksi.
-pdfReader-a11yAnnotationInstruction = Lisätäksesi tämän huomautuksen asiakirjaan, aktivoi asiakirja ja paina { general-key-control }-{ option-or-alt }-{ $number }.
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
    .aria-description = Tätä huomautustyyppiä ei voi luoda näppäimistöltä.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = Etsi
    .placeholder = { pdfReader-find-in-document }
    .aria-description = Muuttaaksesi hakutuloksen korostushuomautukseksi, paina { general-key-control }-{ option-or-alt }-1. Muuttaaksesi hakutuloksen alleviivaushuomautukseksi, paina { general-key-control }-{ option-or-alt }-2.
