general-sentence-separator = 
general-key-control = Control
general-key-shift = Shift
general-key-alt = Alt
general-key-option = Option
general-key-command = Command
option-or-alt =
    { PLATFORM() ->
        [macos] { general-key-option }
       *[other] { general-key-alt }
    }
command-or-control =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-control }
    }
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
delete-or-backspace =
    { PLATFORM() ->
        [macos] Delete
       *[other] Backspace
    }
general-print = Drukuj
general-remove = Usuń
general-add = Dodaj
general-remind-me-later = Przypomnij mi później
general-dont-ask-again = Nie pytaj ponownie
general-choose-file = Wybierz plik...
general-open-settings = Otwórz ustawienia
general-settings = Ustawienia...
general-help = Pomoc
general-tag = Etykieta
general-done = Zrobione
general-view-troubleshooting-instructions = Pokaż instrukcje dla rozwiązywania problemów
general-go-back = Wróć
general-accept = Akceptuj
general-cancel = Anuluj
general-show-in-library = Pokaż w Bibliotece
general-restartApp = Uruchom ponownie { -app-name }
general-restartInTroubleshootingMode = Uruchom ponownie w trybie rozwiązywania problemów
general-save = Zapisz
general-clear = Wyczyść
general-update = Zaktualizuj
general-back = Wstecz
general-edit = Edytuj
general-cut = Wytnij
general-copy = Kopiuj
general-paste = Wklej
general-find = Znajdź
general-delete = Usuń
general-insert = Wstaw
general-and = i
general-et-al = et al.
general-previous = Poprzedni
general-next = Następny
general-learn-more = Dowiedz się więcej
general-warning = Ostrzeżenie
general-type-to-continue = Wpisz “{ $text }”, aby kontynuować.
general-red = Czerwony
general-orange = Pomarańczowy
general-yellow = Żółty
general-green = Zielony
general-teal = Zielononiebieski
general-blue = Niebieski
general-purple = Purpurowy
general-magenta = Fuksjowy
general-violet = Fioletowy
general-maroon = Kasztanowy
general-gray = Szary
general-black = Czarny
citation-style-label = Styl cytowania:
language-label = Język:
menu-custom-group-submenu =
    .label = Więcej opcji...
menu-file-show-in-finder =
    .label = Pokaż w wyszukiwaniu
menu-file-show-file =
    .label = Pokaż katalog z plikiem
menu-file-show-files =
    .label = Pokaż pliki
menu-print =
    .label = { general-print }
menu-density =
    .label = Gęstość
add-attachment = Dodaj załącznik
new-note = Nowa notatka
menu-add-by-identifier =
    .label = Dodaj za pomocą identyfikatora...
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Dodaj plik...
menu-add-standalone-linked-file-attachment =
    .label = Dodaj odsyłacz do pliku...
menu-add-child-file-attachment =
    .label = Załącz plik...
menu-add-child-linked-file-attachment =
    .label = Dołącz odnośnik do pliku...
menu-add-child-linked-url-attachment =
    .label = Dodaj link do zasobu...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nowa osobna notatka
menu-new-item-note =
    .label = Nowa notatka do elementu
menu-restoreToLibrary =
    .label = Przywróć do biblioteki
menu-deletePermanently =
    .label = Usuń trwale...
menu-tools-plugins =
    .label = Wtyczki
menu-view-columns-move-left =
    .label = Przesuń kolumnę w lewo
menu-view-columns-move-right =
    .label = Przesuń kolumnę w prawo
menu-show-tabs-menu =
    .label = Show Tabs Menu
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Copy Annotation
           *[other] Copy { $count } Annotations
        }
main-window-command =
    .label = Biblioteka
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = Pokaż wszystkie zakładki
filter-collections = Filtruj kolekcje
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Wyszukaj w zakładkach
zotero-tabs-menu-close-button =
    .title = Zamknij kartę
zotero-toolbar-tabs-scroll-forwards =
    .title = Scroll forwards
zotero-toolbar-tabs-scroll-backwards =
    .title = Scroll backwards
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Zmień nazwę kolekcji
collections-menu-edit-saved-search =
    .label = Edytuj wynik wyszukiwania
collections-menu-move-collection =
    .label = Przenieś do
collections-menu-copy-collection =
    .label = Skopiuj do
item-creator-moveDown =
    .label = Przenieś w dół
item-creator-moveToTop =
    .label = Przenieś na początek
item-creator-moveUp =
    .label = Przenieś do góry
item-menu-viewAttachment =
    .label =
        Open { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Snapshot
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                   *[other] Attachments
                }
        } { $openIn ->
            [tab] in New Tab
            [window] in New Window
           *[other] { "" }
        }
item-menu-add-file =
    .label = Plik
item-menu-add-linked-file =
    .label = Odnośnik do pliku
item-menu-add-url =
    .label = Odnośnik do zasobu internetowego
item-menu-change-parent-item =
    .label = Zmień element nadrzędny...
item-menu-relate-items =
    .label = Powiąż elementy
view-online = Pokaż online
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Zmieniono nazwę pliku na { $filename }
itembox-button-options =
    .tooltiptext = Otwórz menu kontekstowe
itembox-button-merge =
    .aria-label = Wybierz wersję pola { $field }
create-parent-intro = Wprowadź DOI, ISBN, PMID, arXiv lub ADS Bibcode, aby zidentyfikować ten plik:
reader-use-dark-mode-for-content =
    .label = Użyj trybu ciemnego dla zawartości
update-updates-found-intro-minor = Dostępna jest aktualizacja dla { -app-name }:
update-updates-found-desc = Zalecane jest zastosowanie tej aktualizacji tak szybko, jak tylko jest to możliwe.
import-window =
    .title = Importuj
import-where-from = Skąd chcesz zaimportować?
import-online-intro-title = Wstęp
import-source-file =
    .label = Z pliku (BibTeX, RIS, Zotero RDF itp.)
import-source-folder =
    .label = Katalog z plikami PDF i innymi
import-source-online =
    .label = { $targetApp } importowanie online
import-options = Opcje
import-importing = Importowanie...
import-create-collection =
    .label = Umieść zaimportowane kolekcje i elementy w nowej kolekcji
import-recreate-structure =
    .label = Odtwórz strukturę katalogów jako kolekcje
import-fileTypes-header = Typy plików do zaimportowania:
import-fileTypes-pdf =
    .label = PDFy
import-fileTypes-other =
    .placeholder = Inne pliki według wzorca, rozdzielone przecinkami (np. *.jpg,*.png)
import-file-handling = Obsługa plików
import-file-handling-store =
    .label = Kopiuj pliki do katalogu przechowywania { -app-name }
import-file-handling-link =
    .label = Odsyłacz do plików w oryginalnej lokalizacji
import-fileHandling-description = Połączone pliki nie mogą być zsynchronizowane przez { -app-name }.
import-online-new =
    .label = Pobierz tylko nowe elementy; nie aktualizuj poprzednio zaimportowanych elementów
import-mendeley-username = Nazwa użytkownika
import-mendeley-password = Hasło
general-error = Błąd
file-interface-import-error = Podczas próby importowania wybranego pliku wystąpił błąd. Proszę sprawdzić, czy plik jest prawidłowy i spróbować ponownie.
file-interface-import-complete = Importowanie zakończone
file-interface-items-were-imported =
    { $numItems ->
        [0] No items were imported
        [one] One item was imported
       *[other] { $numItems } items were imported
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] No items were relinked
        [one] One item was relinked
       *[other] { $numRelinked } items were relinked
    }
import-mendeley-encrypted = Nie można odczytać wybranej bazy danych Mendeley, ponieważ jest zaszyfrowana. Aby uzyskać więcej informacji, zobacz <a data-l10n-name="mendeley-import-kb">Jak zaimportować bibliotekę Mendeley do Zotero?</a>.
file-interface-import-error-translator = Podczas importowania wybranego pliku z “{ $translator }” pojawił się błąd. Proszę, upewnij się, że ten plik jest poprawny i spróbuj ponownie.
import-online-intro = In the next step you will be asked to log in to { $targetAppOnline } and grant { -app-name } access. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-intro2 = { -app-name } nigdy nie zobaczy ani nie zapisze twojego { $targetApp } hasła.
import-online-form-intro = Proszę, wprowadź twoje dane dostępowe, aby zalogować się do { $targetAppOnline }. Jest to niezbędne, aby zaimportować twoją bibliotekę { $targetApp } do { -app-name }.
import-online-wrong-credentials = Logowanie do { $targetApp } nie powiodło się. Proszę, wprowadź dane logowania ponownie i spróbuj jeszcze raz.
import-online-blocked-by-plugin = Importowanie nie może być kontynuowane z zainstalowaną wtyczką { $plugin }. Proszę, wyłącz tę wtyczkę i spróbuj ponownie.
import-online-relink-only =
    .label = Zlinkuj ponownie cytowania Mendeley Desktop
import-online-relink-kb = Więcej informacji
import-online-connection-error = { -app-name } nie może się połączyć z  { $targetApp }. Proszę, sprawdź swoje połączenie internetowe i spróbuj ponownie.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Zgłoś błąd...
rtfScan-wizard =
    .title = Skanowanie pliku RTF
rtfScan-introPage-description = { -app-name } może automatycznie wydobyć i przeformatować cytowania, a następnie wstawić bibliografię do plików RTF. Aktualnie wspierane są następujące formaty w różnych wersjach:
rtfScan-introPage-description2 = Aby rozpocząć, wybierz poniżej plik wejściowy w formacie RTF oraz plik wyjściowy:
rtfScan-input-file = Plik wejściowy:
rtfScan-output-file = Plik wyjściowy:
rtfScan-no-file-selected = Nie wybrano pliku
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Wybierz plik wejściowy
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Wybierz plik wyjściowy
rtfScan-intro-page = Wstęp
rtfScan-scan-page = Skanowanie cytowań
rtfScan-scanPage-description = { -app-name } skanuje twój dokument w poszukiwaniu cytowań. Prosimy o cierpliwość.
rtfScan-citations-page = Sprawdzenie cytowanych elementów
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page = Formatowanie dokumentu
rtfScan-format-page = Formatowanie cytowań
rtfScan-format-page-description = { -app-name } przetwarza i formatuje twój plik RTF. Proszę czekać.
rtfScan-complete-page = Zakończono skanowanie RTF
rtfScan-complete-page-description = Twój dokument został przeskanowany i przetworzony. Proszę upewnić się, że jest on poprawnie sformatowany.
rtfScan-action-find-match =
    .title = Wybierz pasujący element.
rtfScan-action-accept-match =
    .title = Zaakceptuj ten wybór
runJS-title = Uruchom JavaScript
runJS-editor-label = Kod:
runJS-run = Uruchom
runJS-help = { general-help }
runJS-completed = completed successfully
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Uruchom jako funkcję async
bibliography-window =
    .title = { -app-name } - Utwórz cytowanie/bibliografię
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Wyświetl cytowania jako:
bibliography-advancedOptions-label = Zaawansowane ustawienia
bibliography-outputMode-label = Tryb wyjścia:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliografia
bibliography-outputMethod-label = Metoda wyjścia:
bibliography-outputMethod-saveAsRTF =
    .label = Zapisz jako RTF
bibliography-outputMethod-saveAsHTML =
    .label = Zapisz jako HTML
bibliography-outputMethod-copyToClipboard =
    .label = Kopiuj do schowka
bibliography-outputMethod-print =
    .label = Drukuj
bibliography-manageStyles-label = Zarządzaj stylami...
styleEditor-locatorType =
    .aria-label = Locator type
styleEditor-locatorInput = Locator input
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Edytor stylów
styleEditor-preview =
    .aria-label = Podgląd
publications-intro-page = Moje publikacje
publications-intro = Elementy dodane do Moich Publikacji będą wyświetlone na twojej stronie na zotero.org. Jeśli wybierzesz dołączenie plików, zostaną one upublicznione na określonej przez ciebie licencji. Pamiętaj, by dodać tu tylko te prace, których jesteś autorem oraz tylko te pliki, które masz prawo i chęć udostępnić.
publications-include-checkbox-files =
    .label = Dołącz pliki
publications-include-checkbox-notes =
    .label = Dołącz notatki
publications-include-adjust-at-any-time = Możesz określić co chcesz pokazać z poziomu kolekcji Moje Publikacje.
publications-intro-authorship =
    .label = Jestem autorem tej pracy.
publications-intro-authorship-files =
    .label = Jestem autorem tej pracy i mam prawa autorskie do rozpowszechniania załączonych plików.
publications-sharing-page = Wybierz sposób współdzielenia swojej pracy
publications-sharing-keep-rights-field =
    .label = Zachowaj istniejące pole praw autorskich
publications-sharing-keep-rights-field-where-available =
    .label = Zachowaj istniejące pole praw autorskich, jeśli to możliwe
publications-sharing-text = Możesz zastrzec wszystkie prawa do swojej pracy, udostępnić ją na licencji Creative Commons, albo przekazać do domeny publicznej. W każdym z tych przypadków, praca będzie dostępna publicznie na zotero.org.
publications-sharing-prompt = Czy chcesz zezwolić innym na wykorzystanie twojej pracy?
publications-sharing-reserved =
    .label = Nie, tylko opublikuj moją pracę na zotero.org
publications-sharing-cc =
    .label = Tak, na licencji Creative Commons
publications-sharing-cc0 =
    .label = Tak, i umieść moją pracę w domenie publicznej
publications-license-page = Wybierz licencję Creative Commons
publications-choose-license-text = Licencja Creative Commons pozwala innym na kopiowanie i redystrybucję twojej pracy pod warunkiem, że zamieszczą oni stosowną informację o tobie jako autorze, dodadzą odnośnik do licencji oraz wskażą jakie zmiany zostały dokonane. Dodatkowe warunki możesz określić poniżej.
publications-choose-license-adaptations-prompt = Czy zezwolić na współdzielenie opracowań twojej pracy?
publications-choose-license-yes =
    .label = Tak
    .accesskey = Y
publications-choose-license-no =
    .label = Nie
    .accesskey = N
publications-choose-license-sharealike =
    .label = Tak, pod warunkiem, że zostanie ona udostępniona na tych samych zasadach
    .accesskey = S
publications-choose-license-commercial-prompt = Czy zezwolić na komercyjne użycie twojej pracy?
publications-buttons-add-to-my-publications =
    .label = Dodaj do Moich publikacji
publications-buttons-next-sharing =
    .label = Następne: Współdzielenie
publications-buttons-next-choose-license =
    .label = Wybierz licencję
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Licencja Creative Commons Uznanie Autorstwa 4.0 Międzynarodowe
licenses-cc-by-nd = Licencja Creative Commons Uznanie Autorstwa-Bez utworów zależnych 4.0 Międzynarodowe
licenses-cc-by-sa = Licencja Creative Commons Uznanie Autorstwa-Na tych samych warunkach 4.0 Międzynarodowe
licenses-cc-by-nc = Licencja Creative Commons Uznanie Autorstwa-Użycie niekomercyjne 4.0 Międzynarodowe
licenses-cc-by-nc-nd = Licencja Creative Commons Uznanie Autorstwa-Użycie niekomercyjne-Bez utworów zależnych 4.0 Międzynarodowe
licenses-cc-by-nc-sa = Licencja Creative Commons Uznanie Autorstwa-Użycie niekomercyjne-Na tych samych warunkach 4.0 Międzynarodowe
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Uruchom ponownie w trybie rozwiązywania problemów...
    .accesskey = N
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } uruchomi się ponownie z wyłączonymi wszystkimi wtyczkami. Niektóre funkcje mogą nie działać poprawnie we włączonym Trybie rozwiązywania problemów.
menu-ui-density =
    .label = Gęstość
menu-ui-density-comfortable =
    .label = Komfortowa
menu-ui-density-compact =
    .label = Zwarta
pane-item-details = Szczegóły elementu
pane-info = Informacje
pane-abstract = Krótki opis
pane-attachments = Załączniki
pane-notes = Notatki
pane-libraries-collections = Biblioteki i kolekcje
pane-tags = Etykiety
pane-related = Powiązane
pane-attachment-info = Informacja o załącznikach
pane-attachment-preview = Podgląd
pane-attachment-annotations = Adnotacje
pane-header-attachment-associated =
    .label = Zmień nazwę powiązanego pliku
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } Attachment
           *[other] { $count } Attachments
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } Annotation
           *[other] { $count } Annotations
        }
section-attachments-move-to-trash-message = Czy na pewno przenieść “{ $title }” do kosza?
section-notes =
    .label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } Tag
           *[other] { $count } Tags
        }
section-related =
    .label = { $count } Related
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Rozwiń sekcję
    .label = Rozwiń sekcję { $section }
section-button-collapse =
    .dynamic-tooltiptext = Zwiń sekcję
    .label = Zwiń sekcję { $section }
annotations-count =
    { $count ->
        [one] { $count } Annotation
       *[other] { $count } Annotations
    }
section-button-annotations =
    .title = { annotations-count }
    .aria-label = { annotations-count }
attachment-preview =
    .aria-label = { pane-attachment-preview }
sidenav-info =
    .tooltiptext = { pane-info }
sidenav-abstract =
    .tooltiptext = { pane-abstract }
sidenav-attachments =
    .tooltiptext = { pane-attachments }
sidenav-notes =
    .tooltiptext = { pane-notes }
sidenav-attachment-info =
    .tooltiptext = { pane-attachment-info }
sidenav-attachment-preview =
    .tooltiptext = { pane-attachment-preview }
sidenav-attachment-annotations =
    .tooltiptext = { pane-attachment-annotations }
sidenav-libraries-collections =
    .tooltiptext = { pane-libraries-collections }
sidenav-tags =
    .tooltiptext = { pane-tags }
sidenav-related =
    .tooltiptext = { pane-related }
sidenav-main-btn-grouping =
    .aria-label = { pane-item-details }
sidenav-reorder-up =
    .label = Przenieś sekcję wyżej
sidenav-reorder-down =
    .label = Przenieś sekcję niżej
sidenav-reorder-reset =
    .label = Przywróć kolejność sekcji
toggle-item-pane =
    .tooltiptext = Toggle Item Pane
toggle-context-pane =
    .tooltiptext = Przełącz panel kontekstowy
pin-section =
    .label = Przypnij sekcję
unpin-section =
    .label = Odepnij sekcję
collapse-other-sections =
    .label = Zwiń inne sekcje
expand-all-sections =
    .label = Rozwiń wszystkie sekcje
abstract-field =
    .placeholder = Dodaj streszczenie...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtruj etykiety
context-notes-search =
    .placeholder = Przeszukaj notatki
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Nowa kolekcja...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Nowa kolekcja
    .buttonlabelaccept = Utwórz kolekcję
new-collection-name = Nazwa:
new-collection-create-in = Utwórz w:
show-publications-menuitem =
    .label = Pokaż moje publikacje
attachment-info-title = Tytuł
attachment-info-filename = Nazwa pliku
attachment-info-accessed = Dostęp
attachment-info-pages = Strony
attachment-info-modified = Zmodyfikowany
attachment-info-index = Zindeksowane
attachment-info-convert-note =
    .label =
        Migrate to { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } Note
    .tooltiptext = Dodawanie notatek do załączników nie jest już wspierane, ale możesz edytować tę notatkę, przekształcając ją do osobnej notatki.
attachment-preview-placeholder = Brak załącznika do pokazania w podglądzie
attachment-rename-from-parent =
    .tooltiptext = Zmień nazwę pliku tak, aby odpowiadał elementowi nadrzędnemu
file-renaming-auto-rename-prompt-title = Zmieniono ustawienia nazw plików
file-renaming-auto-rename-prompt-body = Czy chcesz zmienić nazwy istniejących plików w twojej bibliotece, aby zgadzały się z nowymi ustawieniami?
file-renaming-auto-rename-prompt-yes = Podgląd zmian...
file-renaming-auto-rename-prompt-no = Zachowaj istniejące nazwy plików
rename-files-preview =
    .buttonlabelaccept = Zmień nazwy plików
rename-files-preview-loading = Wczytywanie...
rename-files-preview-intro = { -app-name } will rename the following files in your library to match their parent items:
rename-files-preview-renaming = Zmiana nazw...
rename-files-preview-no-files = Wszystkie nazwy plików obecnie odpowiadają elementom nadrzędnym. Nie są wymagane żadne zmiany.
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } Attachment Preview
annotation-image-not-available = [Obrazek niedostępny]
quicksearch-mode =
    .aria-label = Tryb szybkiego wyszukiwania
quicksearch-input =
    .aria-label = Szybkie wyszukiwanie
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Wyświetl jako
item-pane-header-none =
    .label = Brak
item-pane-header-title =
    .label = Tytuł
item-pane-header-titleCreatorYear =
    .label = Tytuł, Twórca, Rok
item-pane-header-bibEntry =
    .label = Wpis bibliograficzny
item-pane-header-more-options =
    .label = Więcej opcji
item-pane-message-items-selected =
    { $count ->
        [0] No items selected
        [one] { $count } item selected
       *[other] { $count } items selected
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } collection selected
       *[other] { $count } collections selected
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } search selected
       *[other] { $count } searches selected
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } object selected
       *[other] { $count } objects selected
    }
item-pane-message-unselected =
    { $count ->
        [0] No items in this view
        [one] { $count } item in this view
       *[other] { $count } items in this view
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] No objects in this view
        [one] { $count } object in this view
       *[other] { $count } objects in this view
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Merge { $count } item
           *[other] Merge { $count } items
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = Dla lepszej wydajności zmień { -app-name } na wersję 64-bitową. Twoje dane nie będą naruszone.
architecture-warning-action = Pobierz wersję 64-bitową { -app-name }
architecture-x64-on-arm64-message = { -app-name } jest uruchomiony w trybie emulacji. Wersja natywna { -app-name } będzie działać bardziej wydajnie.
architecture-x64-on-arm64-action = Pobierz { -app-name } dla ARM64
first-run-guidance-authorMenu = { -app-name } pozwala ci także podać edytorów i tłumaczy. Możesz zmienić autora na edytora lub tłumacza, wybierając z tego menu.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Wyszukiwanie warunkowe
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Wartość
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] { $count } file added
       *[other] { $count } files added
    }
select-items-window =
    .title = Zaznacz elementy
select-items-dialog =
    .buttonlabelaccept = Wybierz
select-items-convertToStandalone =
    .label = Przekształć na osobne elementy
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Convert to Standalone Attachment
           *[other] Convert to Standalone Attachments
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Convert to Standalone Note
           *[other] Convert to Standalone Notes
        }
file-type-webpage = Strona internetowa
file-type-image = Obraz
file-type-pdf = PDF
file-type-audio = Dźwięk
file-type-video = Wideo
file-type-presentation = Prezentacja
file-type-document = Dokument
file-type-ebook = Ebook
post-upgrade-message = Poznaj <a data-l10n-name="new-features-link">nowe funkcje w { -app-name } { $version }</a>
post-upgrade-density = Wybierz swoją preferowaną gęstość widoku:
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Wklej i wyszukaj
mac-word-plugin-install-message = Do instalacji wtyczki Word wymagany jest dostęp Zotero do danych Word.
mac-word-plugin-install-action-button =
    .label = Zainstaluj wtyczkę Word
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
file-renaming-banner-message = { -app-name } now automatically keeps attachment filenames in sync as you make changes to items.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = The { -app-name } Connector must be updated to work with this version of { -app-name }.
userjs-pref-warning = Some { -app-name } settings have been overridden using an unsupported method. { -app-name } will revert them and restart.
long-tag-fixer-window-title =
    .title = Podziel znaczniki
long-tag-fixer-button-dont-split =
    .label = Nie dziel
