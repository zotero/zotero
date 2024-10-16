pdfReader-underlineText = Metnin Altını Çiz
pdfReader-highlightText = Metni Vurgula
pdfReader-addText = Metin Ekle
pdfReader-selectArea = Alanı Seç
pdfReader-draw = Çiz
pdfReader-highlightAnnotation = Ek açıklamayı vurgula
pdfReader-underlineAnnotation = Ek açıklamanın altını çiz
pdfReader-noteAnnotation = Not Ek Açıklaması
pdfReader-textAnnotation = Metin Ek Açıklaması
pdfReader-imageAnnotation = Resim Ek Açıklaması
pdfReader-find-in-document = Belgede Bul
pdfReader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
pdfReader-a11yMoveAnnotation = Ok tuşlarını kullanarak ek açıklamayı taşıyın
pdfReader-a11yEditTextAnnotation = Ek açıklamanın sonunu taşımak için { general-key-shift } tuşuna basarken sağ ve sol ok tuşlarını kullanınız. Ek açıklamanın başını taşımak için { general-key-shift }-{ pdfReader-move-annotation-start-key } tuşuna basarken ok tuşlarını kullanınız.
pdfReader-a11yResizeAnnotation = Ek açıklamayı yeniden boyutlandırmak için { general-key-shift } tuşuna basarken ok tuşlarını kullanınız.
pdfReader-a11yAnnotationPopupAppeared = Tab tuşunu kullarak ek açıklama açılır penceresini geziniz.
pdfReader-a11yAnnotationCreated = { $type } oluşturuldu.
pdfReader-a11yAnnotationSelected = { $type } seçildi.
pdfReader-a11yTextualAnnotationInstruction = To annotate text via the keyboard, first use “{ pdfReader-find-in-document }” to locate the phrase, and then press { general-key-control }-{ option-or-alt }-{ $number } to turn the search result into an annotation.
pdfReader-a11yAnnotationInstruction = To add this annotation into the document, focus the document and press { general-key-control }-{ option-or-alt }-{ $number }.
pdfReader-toolbar-draw =
    .aria-description = This annotation type cannot be created via the keyboard.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = Bul
    .placeholder = { pdfReader-find-in-document }
    .aria-description = To turn a search result into a highlight annotation, press { general-key-control }-{ option-or-alt }-1. To turn a search result into an underline annotation, press { general-key-control }-{ option-or-alt }-2.
