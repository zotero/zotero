reader-annotations = Anotacións
reader-show-annotations = Amosar anotacións
reader-search-annotations = Buscar anotacións
reader-search-outline = Search Outline
reader-no-annotations = Crear unha anotación para vela na barra lateral
reader-no-extracted-text = Sen texto extraído
reader-add-comment = Engadir comentario
reader-annotation-comment = Annotation comment
reader-annotation-text = Annotation text
reader-manage-tags = Manage tags for this annotation
reader-open-menu = Open annotation menu
reader-thumbnails = Thumbnails
reader-tag-selector-message = Filter annotations by this tag
reader-add-tags = Engadir etiquetas...
reader-highlight-text = Resaltar texto
reader-underline-text = Subliñar Texto
reader-add-note = Engadir nota
reader-add-text = Engadir Texto
reader-select-area = Seleccionar área
reader-highlight-annotation = Highlight annotation
reader-underline-annotation = Underline annotation
reader-note-annotation = Note Annotation
reader-text-annotation = Text Annotation
reader-image-annotation = Image Annotation
reader-ink-annotation = Ink Annotation
reader-search-result-index = Search result
reader-search-result-total = Total search results
reader-draw = Debuxar
reader-eraser = Eraser
reader-pick-color = Escoller unha cor
reader-add-to-note = Engadir nota
reader-zoom-in = Ampliar
reader-zoom-out = Alonxar
reader-zoom-reset = Restablecer ampliación
reader-zoom-auto = Axuste automático
reader-zoom-page-width = Ampliar ao ancho de páxina
reader-zoom-page-height = Ampliar a ancho de páxina
reader-split-vertically = Partir en vertical
reader-split-horizontally = Partir en horizontal
reader-next-page = Páxina seguinte
reader-previous-page = Páxina anterior
reader-page = Páxina
reader-location = Ubicación
reader-read-only = Só lectura
reader-prompt-transfer-from-pdf-title = Importar anotacións
reader-prompt-transfer-from-pdf-text = Annotations stored in the PDF file will be moved to { $target }.
reader-prompt-password-protected = Esta operación non está aceptada para os ficheiros PDF protexidos con contrasinal.
reader-prompt-delete-pages-title = Eliminar páxinas
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
reader-rotate-left = Rotar á esquerda
reader-rotate-right = Rotar á dereita
reader-edit-page-number = Editar número de páxina
reader-edit-annotation-text = Editar Texto de Anotación
reader-copy-image = Copiar imaxe
reader-save-image-as = Gardar imaxe como...
reader-page-number-popup-header = Cambiar o número de páxina por:
reader-this-annotation = Esta anotación
reader-selected-annotations = Anotacións seleccionadas
reader-this-page = Esta páxina
reader-this-page-and-later-pages = Esta páxina e as seguintes
reader-all-pages = Todas as páxinas
reader-auto-detect = Detección automática
reader-enter-password = Introduce o contrasinal para abrir este arquivo PDF
reader-include-annotations = Incluír anotacións
reader-preparing-document-for-printing = Preparando o documento para imprimir...
reader-phrase-not-found = Frase non atopada
reader-find = Procurar
reader-close = Pechar
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
reader-size = Tamaño
reader-merge = Merge
reader-copy-link = Copiar ligazón
reader-theme-original = Original
reader-theme-snow = Snow
reader-theme-sepia = Sepia
reader-theme-dark = Escuro
reader-theme-black = Negro
reader-add-theme = Add Theme
reader-theme-invert-images = Invert Images
reader-scroll-mode = Scrolling
reader-spread-mode = Spreads
reader-flow-mode = Page Layout
reader-columns = Columns
reader-split-view = Split View
reader-themes = Themes
reader-vertical = Vertical
reader-horizontal = Horizontal
reader-wrapped = Wrapped
reader-none = Ningún
reader-odd = Odd
reader-even = Even
reader-paginated = Paxinado
reader-scrolled = Desprazado
reader-single = Single
reader-double = Double
reader-theme-name = Theme Name:
reader-background = Background:
reader-foreground = Foreground:
reader-reading-mode = Reading Mode
reader-reading-mode-not-supported = Reading Mode is not supported in this document.
reader-clear-selection = Limpar a selección
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
    .title = Procurar
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
