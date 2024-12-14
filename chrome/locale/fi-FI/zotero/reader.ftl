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
pdfReader-import-from-epub =
    .label = Tuo e-kirjan huomautukset...
pdfReader-import-from-epub-prompt-title = Tuo e-kirjan huomautukset
pdfReader-import-from-epub-prompt-text =
    { -app-name } löysi { $count ->
        [1] { $count } { $tool } huomautuksen
       *[other] { $count } { $tool } huomautusta
    }, muokattu viimeksi { $lastModifiedRelative }.
    
    Kaikki { -app-name }-huomautukset jotka on tuotu aiemmin tästä e-kirjasta päivitetään.
pdfReader-import-from-epub-no-annotations-current-file =
    Tämä e-kirja ei vaikuta sisältävän tuotavia huomautuksia.
    
    { -app-name } voi tuoda e-kirjan huomautukset jotka on luotu  Calibrella tai KOReaderilla.
pdfReader-import-from-epub-no-annotations-other-file =
    “{ $filename }” ei vaikuta sisältävän Calibrella tai KOReaderilla luotuja huomautuksia.
    
    Jos tämän e-kirjan huomautukset on tehty KOReaderilla, koita valita “metadata.epub.lua”-tiedosto suoraan.
pdfReader-import-from-epub-select-other = Valitse toinen tiedosto…
