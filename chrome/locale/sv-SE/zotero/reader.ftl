reader-annotations = Anteckningar
reader-show-annotations = Visa anteckningar
reader-search-annotations = Sök anteckningar
reader-search-outline = Search Outline
reader-no-annotations = Skapa en anteckning för att se den i sidofältet
reader-no-extracted-text = No extracted text
reader-add-comment = Lägg till kommentar
reader-annotation-comment = Annotation comment
reader-annotation-text = Annotation text
reader-manage-tags = Manage tags for this annotation
reader-open-menu = Open annotation menu
reader-thumbnails = Miniatyrbilder
reader-tag-selector-message = Filter annotations by this tag
reader-add-tags = Lägg till etiketter
reader-highlight-text = Färgöverstryk text
reader-underline-text = Understryck text
reader-add-note = Lägg till anteckning
reader-add-text = Lägg till text
reader-select-area = Välj yta
reader-highlight-annotation = Highlight annotation
reader-underline-annotation = Underline annotation
reader-note-annotation = Note Annotation
reader-text-annotation = Text Annotation
reader-image-annotation = Image Annotation
reader-ink-annotation = Ink Annotation
reader-search-result-index = Sökresultat
reader-search-result-total = Totalt antal sökresultat
reader-draw = Rita
reader-eraser = Eraser
reader-pick-color = Välj en färg
reader-add-to-note = Lägg till i anteckning
reader-zoom-in = Zooma in
reader-zoom-out = Zooma ut
reader-zoom-reset = Återställ zoom
reader-zoom-auto = Anpassa storlek automatiskt
reader-zoom-page-width = Anpassa till sidbredd
reader-zoom-page-height = Zooma till sidhöjd
reader-split-vertically = Dela vertikalt
reader-split-horizontally = Dela horisontellt
reader-next-page = Nästa sida
reader-previous-page = Föregående sida
reader-page = Sida
reader-location = Plats
reader-read-only = Skrivskyddad
reader-prompt-transfer-from-pdf-title = Import Annotations
reader-prompt-transfer-from-pdf-text = Annotations stored in the PDF file will be moved to { $target }.
reader-prompt-password-protected = The operation is not supported for password-protected PDF files.
reader-prompt-delete-pages-title = Ta bort sidor
reader-prompt-delete-pages-text =
    { $count ->
        [one] Are you sure you want to delete { $count } page from the PDF file?
       *[other] Are you sure you want to delete { $count } pages from the PDF file?
    }
reader-prompt-delete-annotations-title = Delete Annotations
reader-prompt-delete-annotations-text =
    { $count ->
        [one] Are you sure you want to delete the selected annotation?
       *[other] Are you sure you want to delete the selected annotations?
    }
reader-rotate-left = Rotera åt vänster
reader-rotate-right = Rotera åt höger
reader-edit-page-number = Redigera sidnummer...
reader-edit-annotation-text = Edit Annotation Text
reader-copy-image = Kopiera bild
reader-save-image-as = Spara bild som...
reader-page-number-popup-header = Change page number for:
reader-this-annotation = This annotation
reader-selected-annotations = Selected annotations
reader-this-page = Denna sida
reader-this-page-and-later-pages = Denna sida och senare sidor
reader-all-pages = Alla sidor
reader-auto-detect = Auto-Detect
reader-enter-password = Enter the password to open this PDF file
reader-include-annotations = Include annotations
reader-preparing-document-for-printing = Preparing document for printing…
reader-phrase-not-found = Frasen hittades inte
reader-find = Hitta
reader-close = Stäng
reader-show-thumbnails = Visa miniatyrbilder
reader-show-outline = Show Outline
reader-find-previous = Find the previous occurrence of the phrase
reader-find-next = Find the next occurrence of the phrase
reader-toggle-sidebar = Växla sidofält
reader-find-in-document = Sök i dokument
reader-toggle-context-pane = Toggle Context Pane
reader-highlight-all = Highlight all
reader-match-case = Matcha skiftläge
reader-whole-words = Hela ord
reader-appearance = Utseende
reader-epub-appearance-line-height = Radhöjd
reader-epub-appearance-word-spacing = Word spacing
reader-epub-appearance-letter-spacing = Letter spacing
reader-epub-appearance-page-width = Sidbredd
reader-epub-appearance-use-original-font = Use original font
reader-epub-appearance-line-height-revert = Use default line height
reader-epub-appearance-word-spacing-revert = Use default word spacing
reader-epub-appearance-letter-spacing-revert = Use default letter spacing
reader-epub-appearance-page-width-revert = Use default page width
reader-convert-to-highlight = Convert to Highlight
reader-convert-to-underline = Konvertera till understruken
reader-size = Storlek
reader-merge = Slå samman
reader-copy-link = Kopiera länk
reader-theme-original = Original
reader-theme-snow = Snö
reader-theme-sepia = Sepia
reader-theme-dark = Mörkt
reader-theme-black = Svart
reader-add-theme = Lägg till tema
reader-theme-invert-images = Invert Images
reader-scroll-mode = Rullning
reader-spread-mode = Spreads
reader-flow-mode = Sidlayout
reader-columns = Kolumner
reader-split-view = Delad vy
reader-themes = Teman
reader-vertical = Vertikal
reader-horizontal = Horisontell
reader-wrapped = Wrapped
reader-none = ingen ikon
reader-odd = Udda
reader-even = Jämn
reader-paginated = Paginated
reader-scrolled = Scrolled
reader-single = Enkel
reader-double = Dubbel
reader-theme-name = Theme Name:
reader-background = Bakgrund:
reader-foreground = Förgrund:
reader-reading-mode = Läsningsläge
reader-reading-mode-not-supported = Läsningsläget stöds inte i detta dokument.
reader-clear-selection = Töm markering
reader-epub-encrypted = This ebook is encrypted and cannot be opened.
reader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
reader-a11y-move-annotation = Use the arrow keys to move the annotation.
reader-a11y-edit-text-annotation = To move the end of the text annotation, hold { general-key-shift } and use the left/right arrow keys. To move the start of the annotation, hold { general-key-shift }-{ reader-move-annotation-start-key } and use the arrow keys.
reader-a11y-resize-annotation = To resize the annotation, hold { general-key-shift } and use the arrow keys.
reader-a11y-annotation-popup-appeared = Use Tab to navigate the annotation popup.
reader-a11y-annotation-created = { $type } skapades.
reader-a11y-annotation-selected = { $type } valdes.
-reader-a11y-textual-annotation-instruction = To annotate text via the keyboard, first use “{ reader-find-in-document }” to locate the phrase, and then press { general-key-control }-{ option-or-alt }-{ $number } to turn the search result into an annotation.
-reader-a11y-annotation-instruction = To add this annotation into the document, focus the document and press { general-key-control }-{ option-or-alt }-{ $number }.
reader-toolbar-highlight =
    .aria-description = { -reader-a11y-textual-annotation-instruction(number: 1) }
    .title = { reader-highlight-text }
reader-toolbar-underline =
    .aria-description = { -reader-a11y-textual-annotation-instruction(number: 2) }
    .title = { reader-underline-text }
reader-toolbar-note =
    .aria-description = { -reader-a11y-annotation-instruction(number: 3) }
    .title = { reader-note-annotation }
reader-toolbar-text =
    .aria-description = { -reader-a11y-annotation-instruction(number: 4) }
    .title = { reader-add-text }
reader-toolbar-area =
    .aria-description = { -reader-a11y-annotation-instruction(number: 5) }
    .title = { reader-select-area }
reader-toolbar-draw =
    .aria-description = This annotation type cannot be created via the keyboard.
    .title = { reader-draw }
reader-find-in-document-input =
    .title = Hitta
    .placeholder = { reader-find-in-document }
    .aria-description = To turn a search result into a highlight annotation, press { general-key-control }-{ option-or-alt }-1. To turn a search result into an underline annotation, press { general-key-control }-{ option-or-alt }-2.
reader-import-from-epub =
    .label = Import Ebook Annotations…
reader-import-from-epub-prompt-title = Import Ebook Annotations
reader-import-from-epub-prompt-text =
    { -app-name } found { $count ->
        [one] { $count } { $tool } annotation
       *[other] { $count } { $tool } annotations
    }, last edited { $lastModifiedRelative }.
    
    Any { -app-name } annotations that were previously imported from this ebook will be updated.
reader-import-from-epub-no-annotations-current-file =
    This ebook does not appear to contain any importable annotations.
    
    { -app-name } can import ebook annotations created in Calibre and KOReader.
reader-import-from-epub-no-annotations-other-file =
    “{ $filename }” does not appear to contain any Calibre or KOReader annotations.
    
    If this ebook has been annotated with KOReader, try selecting a “metadata.epub.lua” file directly.
reader-import-from-epub-select-other = Select Other File…
reader-selected-pages =
    { $count ->
        [one] 1 page selected
       *[other] { $count } pages selected
    }
reader-page-options = Sidkonfiguration
