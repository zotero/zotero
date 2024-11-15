pdfReader-underlineText = Metnin Altını Çiz
pdfReader-highlightText = Metni Vurgula
pdfReader-addText = Metin Ekle
pdfReader-selectArea = Alanı Seç
pdfReader-draw = Çiz
pdfReader-highlightAnnotation = Vurgulanmış ek açıklama
pdfReader-underlineAnnotation = Altı çizgili ek açıklama
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
-pdfReader-a11yTextualAnnotationInstruction = Klavye kullanarak metne açıklamalar ekleyebilmek için önce “{ pdfReader-find-in-document }” tuşunu kullanarak istediğiniz ifadeyi bulun ve { general-key-control }-{ option-or-alt }-{ $number } tuşlarına basarak arama sonucunu bir ek açıklamaya çevirin.
-pdfReader-a11yAnnotationInstruction = Bu ek açıklamayı belgeye eklemek için belgeyi odaklayın ve { general-key-control }-{ option-or-alt }-{ $number } tuşlarına basın.
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
    .aria-description = Bu ek açıklama türü klavye kullanılarak yaratılamaz.
    .title = { pdfReader-draw }
pdfReader-findInDocumentInput =
    .title = Bul
    .placeholder = { pdfReader-find-in-document }
    .aria-description = Arama sonucunu bir vurgulanmış ek açıklamaya çevirmek için { general-key-control }-{ option-or-alt }-1 tuşlarına basınız. Arama sonucunu bir altı çizgili ek açıklamaya çevirmek için { general-key-control }-{ option-or-alt }-2 tuşlarına basınız.
pdfReader-import-from-epub =
    .label = Import Ebook Annotations…
pdfReader-import-from-epub-prompt-title = Import Ebook Annotations
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
pdfReader-import-from-epub-select-other = Select Other File…
