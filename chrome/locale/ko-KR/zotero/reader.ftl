reader-annotations = 주석
reader-show-annotations = 주석 표시
reader-search-annotations = 주석 검색
reader-search-outline = Search Outline
reader-no-annotations = 주석을 만들면 사이드바에서 볼 수 있습니다
reader-no-extracted-text = 추출된 텍스트가 없습니다
reader-add-comment = 댓글 추가
reader-annotation-comment = Annotation comment
reader-annotation-text = Annotation text
reader-manage-tags = Manage tags for this annotation
reader-open-menu = Open annotation menu
reader-thumbnails = Thumbnails
reader-tag-selector-message = Filter annotations by this tag
reader-add-tags = 태그 추가...
reader-highlight-text = 글자 강조
reader-underline-text = 밑줄 텍스트
reader-add-note = 노트 추가
reader-add-text = 텍스트 추가
reader-select-area = 영역 선택
reader-highlight-annotation = Highlight annotation
reader-underline-annotation = Underline annotation
reader-note-annotation = Note Annotation
reader-text-annotation = Text Annotation
reader-image-annotation = Image Annotation
reader-ink-annotation = Ink Annotation
reader-search-result-index = Search result
reader-search-result-total = Total search results
reader-draw = 그리기
reader-eraser = Eraser
reader-pick-color = 색상 선택
reader-add-to-note = 노트 추가
reader-zoom-in = 확대
reader-zoom-out = 축소
reader-zoom-reset = 확대/축소 초기화
reader-zoom-auto = 크기 자동 조정
reader-zoom-page-width = 페이지 너비에 맞춤
reader-zoom-page-height = 페이지 높이에 맞춤
reader-split-vertically = 수직 분할
reader-split-horizontally = 수평 분할
reader-next-page = 다음 페이지
reader-previous-page = 이전 페이지
reader-page = 페이지
reader-location = 경로
reader-read-only = 읽기 전용
reader-prompt-transfer-from-pdf-title = 주석 가져오기
reader-prompt-transfer-from-pdf-text = Annotations stored in the PDF file will be moved to { $target }.
reader-prompt-password-protected = 비밀번호로 보호된 PDF 파일은 지원하지 않습니다.
reader-prompt-delete-pages-title = 페이지 삭제
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
reader-rotate-left = 왼쪽으로 회전
reader-rotate-right = 오른쪽으로 회전
reader-edit-page-number = 페이지 번호 편집...
reader-edit-annotation-text = 주석 텍스트 편집
reader-copy-image = 이미지 복사
reader-save-image-as = 이미지 저장...
reader-page-number-popup-header = 페이지 번호를 변경할 대상:
reader-this-annotation = 현재 주석
reader-selected-annotations = 선택한 주석
reader-this-page = 이 페이지
reader-this-page-and-later-pages = 이 페이지 및 이후의 페이지
reader-all-pages = 모든 페이지
reader-auto-detect = 자동 감지
reader-enter-password = PDF 파일의 비밀번호를 입력하세요
reader-include-annotations = 주석 포함
reader-preparing-document-for-printing = 문서 인쇄 준비 중...
reader-phrase-not-found = 문구를 찾지 못했습니다
reader-find = 검색
reader-close = 닫기
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
reader-size = 크기
reader-merge = Merge
reader-copy-link = Copy Link
reader-theme-original = Original
reader-theme-snow = Snow
reader-theme-sepia = Sepia
reader-theme-dark = Dark
reader-add-theme = Add Theme
reader-scroll-mode = Scrolling
reader-spread-mode = Spreads
reader-flow-mode = Page Layout
reader-columns = 열
reader-split-view = Split View
reader-themes = Themes
reader-vertical = Vertical
reader-horizontal = Horizontal
reader-wrapped = Wrapped
reader-none = 없음
reader-odd = Odd
reader-even = Even
reader-paginated = 페이지 단위 보기
reader-scrolled = 스크롤해서 보기
reader-single = Single
reader-double = Double
reader-theme-name = Theme Name:
reader-background = Background:
reader-foreground = Foreground:
reader-reading-mode = Reading Mode
reader-reading-mode-not-supported = Reading Mode is not supported in this document.
reader-clear-selection = 선택 해제
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
    .title = 검색
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
