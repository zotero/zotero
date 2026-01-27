reader-annotations = Oharpenak
reader-show-annotations = Erakutsi oharpenak
reader-search-annotations = Bilatu oharpenak
reader-search-outline = Search Outline
reader-no-annotations = Alboko barran ikusteko oharpena sortu
reader-no-extracted-text = Ez dago erauzitako testurik
reader-add-comment = Iruzkina gehitu
reader-annotation-comment = Oharpenaren iruzkina
reader-annotation-text = Oharpenaren testua
reader-manage-tags = Manage tags for this annotation
reader-open-menu = Open annotation menu
reader-thumbnails = Thumbnails
reader-tag-selector-message = Filter annotations by this tag
reader-add-tags = Etiketak gehitu...
reader-highlight-text = Testua nabarmendu
reader-underline-text = Underline Text
reader-add-note = Oharra gehitu
reader-add-text = Add Text
reader-select-area = Area hautatu
reader-highlight-annotation = Highlight annotation
reader-underline-annotation = Underline annotation
reader-note-annotation = Note Annotation
reader-text-annotation = Text Annotation
reader-image-annotation = Image Annotation
reader-ink-annotation = Ink Annotation
reader-search-result-index = Search result
reader-search-result-total = Total search results
reader-draw = Draw
reader-eraser = Eraser
reader-pick-color = Kolore bat aukeratu
reader-add-to-note = Oharra gehitu
reader-zoom-in = Gerturatu
reader-zoom-out = Urrundu
reader-zoom-reset = Reset Zoom
reader-zoom-auto = Tamaina automatikoki egokitu
reader-zoom-page-width = Orrialdearen zabalerara zoom egin
reader-zoom-page-height = Orrialdearen altuerara zoom egin
reader-split-vertically = Zatitu bertikalean
reader-split-horizontally = Zatitu horizontalean
reader-next-page = Hurrengo orrialdea
reader-previous-page = Aurreko orrialdea
reader-page = Orrialdea
reader-location = Location
reader-read-only = Irakurtzeko soilik
reader-prompt-transfer-from-pdf-title = Oharpenak inportatu
reader-prompt-transfer-from-pdf-text = Annotations stored in the PDF file will be moved to { $target }.
reader-prompt-password-protected = Prozedura ez da onartzen pasahitzez babestutako PDF fitxategietan.
reader-prompt-delete-pages-title = Ezabatu orrialdeak
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
reader-rotate-left = Biratu ezkerretara
reader-rotate-right = Biratu eskubitara
reader-edit-page-number = Orrialde zenbakia editatu...
reader-edit-annotation-text = Edit Annotation Text
reader-copy-image = Kopiatu irudia
reader-save-image-as = Gorde irudia honela...
reader-page-number-popup-header = Honakoagatik aldatu orrialde zenbakia:
reader-this-annotation = Oharpen hau
reader-selected-annotations = Hautatutako oharpenak
reader-this-page = Orrialde hau
reader-this-page-and-later-pages = Orrialde hau eta hurrengoak
reader-all-pages = Orrialde guztiak
reader-auto-detect = Automatikoki detektatu
reader-enter-password = Enter the password to open this PDF file
reader-include-annotations = Include annotations
reader-preparing-document-for-printing = Preparing document for printing…
reader-phrase-not-found = Phrase not found
reader-find = Aurkitu
reader-close = Itxi
reader-show-thumbnails = Show Thumbnails
reader-show-outline = Show Outline
reader-find-previous = Find the previous occurrence of the phrase
reader-find-next = Find the next occurrence of the phrase
reader-toggle-sidebar = Toggle Sidebar
reader-find-in-document = Find in Document
reader-toggle-context-pane = Toggle Context Pane
reader-highlight-all = Highlight all
reader-match-case = Match case
reader-whole-words = Whole words
reader-appearance = Appearance
reader-epub-appearance-line-height = Line height
reader-epub-appearance-word-spacing = Word spacing
reader-epub-appearance-letter-spacing = Letter spacing
reader-epub-appearance-page-width = Page width
reader-epub-appearance-use-original-font = Use original font
reader-epub-appearance-line-height-revert = Use default line height
reader-epub-appearance-word-spacing-revert = Use default word spacing
reader-epub-appearance-letter-spacing-revert = Use default letter spacing
reader-epub-appearance-page-width-revert = Use default page width
reader-convert-to-highlight = Convert to Highlight
reader-convert-to-underline = Convert to Underline
reader-size = Tamaina
reader-merge = Merge
reader-copy-link = Copy Link
reader-theme-original = Original
reader-theme-snow = Snow
reader-theme-sepia = Sepia
reader-theme-dark = Dark
reader-theme-black = Black
reader-add-theme = Add Theme
reader-theme-invert-images = Invert Images
reader-scroll-mode = Scrolling
reader-spread-mode = Spreads
reader-flow-mode = Page Layout
reader-columns = Zutabeak
reader-split-view = Split View
reader-themes = Themes
reader-vertical = Vertical
reader-horizontal = Horizontal
reader-wrapped = Wrapped
reader-none = Kendu
reader-odd = Odd
reader-even = Even
reader-paginated = Paginated
reader-scrolled = Scrolled
reader-single = Single
reader-double = Double
reader-theme-name = Theme Name:
reader-background = Background:
reader-foreground = Foreground:
reader-reading-mode = Reading Mode
reader-reading-mode-not-supported = Reading Mode is not supported in this document.
reader-clear-selection = Hautaketa garbitu
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
reader-a11y-annotation-created = { $type } created.
reader-a11y-annotation-selected = { $type } selected.
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
    .title = Aurkitu
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
reader-page-options = Page Options
