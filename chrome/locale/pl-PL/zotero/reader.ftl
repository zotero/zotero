reader-annotations = Adnotacje
reader-show-annotations = Pokaż adnotacje
reader-search-annotations = Szukaj adnotacji
reader-search-outline = Szukaj podsumowania
reader-no-annotations = Dodaj adnotację, aby zobaczyć ją w pasku bocznym
reader-no-extracted-text = Brak wydobytego tekstu
reader-add-comment = Dodaj komentarz
reader-annotation-comment = Komentarz do adnotacji
reader-annotation-text = Tekst adnotacji
reader-manage-tags = Zarządzaj etykietami dla tej notatki
reader-open-menu = Otwórz menu notatek
reader-thumbnails = Miniatury
reader-tag-selector-message = Filtruj adnotacje po tej etykiecie
reader-add-tags = Dodaj etykiety...
reader-highlight-text = Podświetl tekst
reader-underline-text = Podkreśl tekst
reader-add-note = Dodaj notatkę
reader-add-text = Dodaj tekst
reader-select-area = Wybierz obszar
reader-highlight-annotation = Podświetl adnotację
reader-underline-annotation = Podkreśl adnotację
reader-note-annotation = Adnotacja notatką
reader-text-annotation = Adnotacja tekstowa
reader-image-annotation = Adnotacja obrazem
reader-ink-annotation = Ink Annotation
reader-search-result-index = Wyniki wyszukiwania
reader-search-result-total = Całkowite wyniki wyszukiwania
reader-draw = Rysuj
reader-eraser = Gumka
reader-pick-color = Wybierz kolor
reader-add-to-note = Dodaj do notatki
reader-zoom-in = Powiększ
reader-zoom-out = Zmniejsz
reader-zoom-reset = Przywróć powiększenie
reader-zoom-auto = Automatycznie zmień rozmiar
reader-zoom-page-width = Powiększ do szerokości strony
reader-zoom-page-height = Powiększ do wysokości strony
reader-split-vertically = Podziel pionowo
reader-split-horizontally = Podziel poziomo
reader-next-page = Następna strona
reader-previous-page = Poprzednia strona
reader-page = Strona
reader-location = Lokalizacja
reader-read-only = Tylko do odczytu
reader-prompt-transfer-from-pdf-title = Importuj adnotacje
reader-prompt-transfer-from-pdf-text = Adnotacje przechowywane w pliku PDF zostaną przeniesione do { $target }.
reader-prompt-password-protected = Ta operacja nie jest obsługiwana dla plików PDF zabezpieczonych hasłem.
reader-prompt-delete-pages-title = Usuń strony
reader-prompt-delete-pages-text =
    { $count ->
        [one] Are you sure you want to delete { $count } page from the PDF file?
       *[other] Are you sure you want to delete { $count } pages from the PDF file?
    }
reader-prompt-delete-annotations-title = Usuń adnotacje
reader-prompt-delete-annotations-text =
    { $count ->
        [one] Are you sure you want to delete the selected annotation?
       *[other] Are you sure you want to delete the selected annotations?
    }
reader-rotate-left = Obróć w lewo
reader-rotate-right = Obróć w prawo
reader-edit-page-number = Edytuj numer strony...
reader-edit-annotation-text = Edytuj tekst adnotacji
reader-copy-image = Skopiuj obraz
reader-save-image-as = Zapisz obraz jako...
reader-page-number-popup-header = Zmień numer strony dla:
reader-this-annotation = Ta adnotacja
reader-selected-annotations = Wybrane adnotacje
reader-this-page = Tej strony
reader-this-page-and-later-pages = Tej strony i następnych
reader-all-pages = Wszystkich stron
reader-auto-detect = Wykryj automatycznie
reader-enter-password = Podaj hasło, aby otworzyć ten plik PDF
reader-include-annotations = Dołącz adnotacje
reader-preparing-document-for-printing = Przygotowywanie dokumentu do wydruku...
reader-phrase-not-found = Nie znaleziono wyrażenia
reader-find = Znajdź
reader-close = Zamknij
reader-show-thumbnails = Pokaż miniatury
reader-show-outline = Pokaż podsumowanie
reader-find-previous = Znajdź poprzednie wystąpienie frazy
reader-find-next = Znajdź następne wystąpienie frazy
reader-toggle-sidebar = Przełącz pasek boczny
reader-find-in-document = Znajdź w dokumencie
reader-toggle-context-pane = Przełącz panel kontekstowy
reader-highlight-all = Podświetl wszystkie
reader-match-case = Wielkość liter ma znaczenie
reader-whole-words = Całe słowa
reader-appearance = Wygląd
reader-epub-appearance-line-height = Wysokość linii
reader-epub-appearance-word-spacing = Odstępy między wyrazami
reader-epub-appearance-letter-spacing = Odstępy między znakami
reader-epub-appearance-page-width = Szerokość strony
reader-epub-appearance-use-original-font = Użyj oryginalnej czcionki
reader-epub-appearance-line-height-revert = Użyj domyślnej wysokości linii
reader-epub-appearance-word-spacing-revert = Użyj domyślnego odstępu między wyrazami
reader-epub-appearance-letter-spacing-revert = Użyj domyślnego odstępu między znakami
reader-epub-appearance-page-width-revert = Użyj domyślnej szerokości strony
reader-convert-to-highlight = Przekształć na podświetlenie
reader-convert-to-underline = Przekształć na podkreślenie
reader-size = Rozmiar
reader-merge = Połącz
reader-copy-link = Kopiuj link
reader-theme-original = Oryginalny
reader-theme-snow = Śnieg
reader-theme-sepia = Sepia
reader-theme-dark = Ciemny
reader-add-theme = Dodaj styl
reader-scroll-mode = Przewijanie
reader-spread-mode = Spreads
reader-flow-mode = Widok stron
reader-columns = Kolumny
reader-split-view = Podziel widok
reader-themes = Style
reader-vertical = Pionowo
reader-horizontal = Poziomo
reader-wrapped = Zawinięty
reader-none = Brak
reader-odd = Nieparzyste
reader-even = Parzyste
reader-paginated = Stronicowany
reader-scrolled = Przewijalny
reader-single = Pojedynczy
reader-double = Podwójny
reader-theme-name = Nazwa stylu:
reader-background = Tło:
reader-foreground = Pierwszy plan:
reader-focus-mode = Focus Mode
reader-clear-selection = Wyczyść zaznaczenie
reader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
reader-a11y-move-annotation = Użyj klawiszy strzałek, aby przenieść adnotację.
reader-a11y-edit-text-annotation = To move the end of the text annotation, hold { general-key-shift } and use the left/right arrow keys. To move the start of the annotation, hold { general-key-shift }-{ reader-move-annotation-start-key } and use the arrow keys.
reader-a11y-resize-annotation = Aby zmienić rozmiar adnotacji, przytrzymaj { general-key-shift } i użyj klawiszy strzałek.
reader-a11y-annotation-popup-appeared = Użyj klawisza tabulacji, aby nawigować po dymkach adnotacji.
reader-a11y-annotation-created = { $type } utworzono.
reader-a11y-annotation-selected = { $type } wybrano.
-reader-a11y-textual-annotation-instruction = To annotate text via the keyboard, first use “{ reader-find-in-document }” to locate the phrase, and then press { general-key-control }-{ option-or-alt }-{ $number } to turn the search result into an annotation.
-reader-a11y-annotation-instruction = Aby dodać tę adnotację do dokumentu, przejdź do dokumentu i wciśnij { general-key-control }-{ option-or-alt }-{ $number }.
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
    .aria-description = Ten rodzaj adnotacji nie może być utworzony za pomocą klawiatury.
    .title = { reader-draw }
reader-find-in-document-input =
    .title = Znajdź
    .placeholder = { reader-find-in-document }
    .aria-description = To turn a search result into a highlight annotation, press { general-key-control }-{ option-or-alt }-1. To turn a search result into an underline annotation, press { general-key-control }-{ option-or-alt }-2.
reader-import-from-epub =
    .label = Importuj adnotacje ebooka...
reader-import-from-epub-prompt-title = Importuj adnotacje ebooka
reader-import-from-epub-prompt-text =
    { -app-name } found { $count ->
        [one] { $count } { $tool } annotation
       *[other] { $count } { $tool } annotations
    }, last edited { $lastModifiedRelative }.
    
    Any { -app-name } annotations that were previously imported from this ebook will be updated.
reader-import-from-epub-no-annotations-current-file =
    Ten ebook nie zawiera żadnych adnotacji możliwych do zaimportowania.
    
    { -app-name } może zaimportować adnotacje ebooka utworzone w Calibre i KOReader.
reader-import-from-epub-no-annotations-other-file =
    “{ $filename }” nie zawiera żadnych adnotacji Calibre lub KOReader .
    
    Jeżeli ten ebook był adnotowany w KOReader, spróbuj bezpośrednio wybrać plik “metadata.epub.lua”.
reader-import-from-epub-select-other = Wybierz inny plik...
