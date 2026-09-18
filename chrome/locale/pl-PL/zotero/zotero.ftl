general-sentence-separator = { " " }
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
-os-name =
    { PLATFORM() ->
        [macos] macOS
        [windows] Windows
       *[other] Linux
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
general-got-it = Rozumiem
general-done = Zrobione
general-view-troubleshooting-instructions = Pokaż instrukcje dla rozwiązywania problemów
general-go-back = Wróć
general-accept = Akceptuj
general-cancel = Anuluj
cancel-button =
    .label = { general-cancel }
general-show-in-library = Pokaż w Bibliotece
general-restartApp = Uruchom ponownie { -app-name }
general-restartInTroubleshootingMode = Uruchom ponownie w trybie rozwiązywania problemów
general-save = Zapisz
general-clear = Wyczyść
clear-button =
    .label = { general-clear }
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
general-more-information = Więcej informacji
general-warning = Ostrzeżenie
general-type-to-continue = Wpisz “{ $text }”, aby kontynuować.
general-continue = Dalej
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
general-loading = Wczytywanie...
db-checking-integrity = Checking database integrity…
db-repairing = Repairing database…
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
menu-view-hide-context-annotation-rows =
    .label = Ukryj niepasujące adnotacje
menu-view-note-font-size =
    .label = Rozmiar czcionki notatek
menu-view-note-tab-font-size =
    .label = Rozmiar czcionki zakładki notatek
menu-show-tabs-menu =
    .label = Pokaż menu zakładek
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Kopiuj { $count } adnotację
            [few] Kopiuj { $count } adnotacje
            [many] Kopiuj { $count } adnotacji
           *[other] Kopiuj { $count } adnotacji
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
    .title = Przewiń do przodu
zotero-toolbar-tabs-scroll-backwards =
    .title = Przewiń wstecz
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
recently-read = Ostatnio czytane
collections-menu-show-recently-read =
    .label = Pokaż { recently-read }
item-menu-remove-from-recently-read =
    .label = Usuń z { recently-read }…
items-section-collections-selected =
    { $count ->
        [one] { $count } wybrana kolekcja
        [few] { $count } wybrane kolekcje
        [many] { $count } wybranych kolekcji
       *[other] { $count } wybranych kolekcji
    }
items-section-searches-selected =
    { $count ->
        [one] { $count } saved search selected
       *[other] { $count } saved searches selected
    }
items-section-sources-selected =
    { $count ->
        [one] { $count } source selected
       *[other] { $count } sources selected
    }
items-section-library-collections =
    { $count ->
        [one] { $library } ({ $count } collection selected)
       *[other] { $library } ({ $count } collections selected)
    }
items-section-library-searches =
    { $count ->
        [one] { $library } ({ $count } saved search selected)
       *[other] { $library } ({ $count } saved searches selected)
    }
items-section-library-sources =
    { $count ->
        [one] { $library } ({ $count } source selected)
       *[other] { $library } ({ $count } sources selected)
    }
items-section-library-recently-read = { $library } ({ recently-read })
items-section-library = { $library }
collections-menu-rename =
    .label = Zmień nazwę
edit-saved-search = Edytuj wynik wyszukiwania
collections-menu-edit-search =
    .label = Edytuj wyszukiwanie
collections-menu-duplicate-search =
    .label = Duplikuj wyszukiwanie
collections-menu-move-collection =
    .label = Przenieś do
collections-menu-copy-collection =
    .label = Skopiuj do
collections-menu-export =
    .label = Eksportuj...
collections-menu-generate-report =
    .label = Generuj raport...
collections-menu-create-bibliography =
    .label = Stwórz bibliografię...
collections-menu-unsubscribe =
    .label = Unsubscribe…
collections-menu-delete =
    .label =
        { $count ->
            [one] Delete Collection…
           *[other] Delete Collections…
        }
collections-menu-delete-with-items =
    .label =
        { $count ->
            [one] Delete Collection and Items…
           *[other] Delete Collections and Items…
        }
collections-menu-delete-search =
    .label =
        { $count ->
            [one] Delete Search…
           *[other] Delete Searches…
        }
collections-delete-title =
    { $count ->
        [one] Delete Collection
       *[other] Delete Collections
    }
collections-delete-message =
    { $count ->
        [one] Are you sure you want to delete this collection?
       *[other] Are you sure you want to delete { $count } collections?
    }
collections-delete-keep-items =
    { $count ->
        [one] Items within this collection will not be deleted.
       *[other] Items within these collections will not be deleted.
    }
collections-delete-with-items-title =
    { $count ->
        [one] Delete Collection and Items
       *[other] Delete Collections and Items
    }
collections-delete-with-items-message =
    { $count ->
        [one] Are you sure you want to delete this collection and move all items within it to the Trash?
       *[other] Are you sure you want to delete { $count } collections and move all items within them to the Trash?
    }
collections-delete-search-title =
    { $count ->
        [one] Delete Search
       *[other] Delete Searches
    }
collections-delete-search-message =
    { $count ->
        [one] Are you sure you want to delete this search?
       *[other] Are you sure you want to delete { $count } searches?
    }
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
                    [note] Note
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                    [note] Notes
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
import-online-intro = W następnym kroku zostaniesz poproszony(a), aby zalogować się do { $targetAppOnline } i udzielić dostępu { -app-name }. Jest to niezbędne, aby zaimportować twoją bibliotekę { $targetApp } do { -app-name }.
import-online-intro2 = { -app-name } nigdy nie zobaczy ani nie zapisze twojego { $targetApp } hasła.
import-online-form-intro = Proszę, wprowadź twoje dane dostępowe, aby zalogować się do { $targetAppOnline }. Jest to niezbędne, aby zaimportować twoją bibliotekę { $targetApp } do { -app-name }.
import-online-wrong-credentials = Logowanie do { $targetApp } nie powiodło się. Proszę, wprowadź dane logowania ponownie i spróbuj jeszcze raz.
import-online-blocked-by-plugin = Importowanie nie może być kontynuowane z zainstalowaną wtyczką { $plugin }. Proszę, wyłącz tę wtyczkę i spróbuj ponownie.
import-online-relink-only =
    .label = Zlinkuj ponownie cytowania Mendeley Desktop
import-online-relink-kb = { general-more-information }
import-online-connection-error = { -app-name } nie może się połączyć z  { $targetApp }. Proszę, sprawdź swoje połączenie internetowe i spróbuj ponownie.
tab-title-multiple-collections = Multiple
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } notatka
            [few] { $count } notatki
            [many] { $count } notatek
           *[other] { $count } notatek
        }
items-column-added-by = Dodany przez
items-column-modified-by = Zmodyfikowany przez
items-column-last-read = Ostatnio czytany
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
rtfScan-citations-page-description = Proszę, przejrzyj listę poniższych rozpoznanych cytowań, aby upewnić się, że { -app-name } wybrał poprawnie odpowiednie elementy. Przed przejściem do następnego kroku należy rozwiązać wszelkie niezmapowane lub niejednoznaczne cytowania.
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
runJS-completed = zakończono pomyślnie
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
pane-note-info = Informacja o notatce
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
            [one] { $count } załącznik
            [few] { $count } załączniki
            [many] { $count } załączników
           *[other] { $count } załączników
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } adnotacja
            [few] { $count } adnotacje
            [many] { $count } adnotacji
           *[other] { $count } adnotacji
        }
section-attachments-move-to-trash-message = Czy na pewno przenieść “{ $title }” do kosza?
section-notes =
    .label =
        { $count ->
            [one] { $count } notatka
            [few] { $count } notatki
            [many] { $count } notatek
           *[other] { $count } notatek
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } Etykieta
            [few] { $count } Etykiety
            [many] { $count } Etykiet
           *[other] { $count } Etykiet
        }
section-related =
    .label = { $count } powiązanych
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
        [one] { $count } adnotacja
        [few] { $count } adnotacje
        [many] { $count } adnotacji
       *[other] { $count } adnotacji
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
sidenav-note-info =
    .tooltiptext = { pane-note-info }
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
    .tooltiptext = Przełącz panel elementów
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
section-note-info =
    .label = { pane-note-info }
note-info-title = Tytuł
note-info-parent-item = Element nadrzędny
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] None
    }
    .title =
        { $hasParentItem ->
            [true] View parent item in library
           *[false] View note item in library
        }
note-info-date-created = Utworzony
note-info-date-modified = Zmodyfikowany
note-info-size = Rozmiar
note-info-word-count = Liczba słów
note-info-character-count = Liczba znaków
item-title-empty-note = Notatka bez tytułu
attachment-preview-placeholder = Brak załącznika do pokazania w podglądzie
attachment-rename-from-parent =
    .tooltiptext = Zmień nazwę pliku tak, aby odpowiadał elementowi nadrzędnemu
account-log-in = Zaloguj się
account-not-logged-in-text = Zaloguj się do swojego konta Zotero, aby zsynchronizować swoje dane.
account-error-login-session-expired = Twoja sesja logowania wygasła. Proszę spróbuj ponownie.
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
advanced-search = Wyszukiwanie zaawansowane
menuitem-advanced-search =
    .label = { advanced-search }
quicksearch-advanced-search-button =
    .tooltiptext = { advanced-search }
    .aria-label = { advanced-search }
advanced-search-close =
    .tooltiptext = Zamknij zaawansowane wyszukiwanie
advanced-search-expand =
    .tooltiptext = Expand Advanced Search
advanced-search-collapse =
    .tooltiptext = Collapse Advanced Search
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
        [one] { $count } wybrana kolekcja
        [few] { $count } wybrane kolekcje
        [many] { $count } wybranych kolekcji
       *[other] { $count } wybranych kolekcji
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } wybrane wyszukiwanie
        [few] { $count } wybrane wyszukiwania
        [many] { $count } wybranych wyszukiwań
       *[other] { $count } wybranych wyszukiwań
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } wybrany obiekt
        [few] { $count } wybrane obiekty
        [many] { $count } wybranych obiektów
       *[other] { $count } wybranych obiektów
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
            [one] Złącz { $count } element
            [few] Złącz { $count } elementy
            [many] Złącz { $count } elementów
           *[other] Złącz { $count } elementów
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = Dla lepszej wydajności zmień { -app-name } na wersję 64-bitową. Twoje dane nie będą naruszone.
architecture-warning-action = Pobierz wersję 64-bitową { -app-name }
architecture-x64-on-arm64-message = { -app-name } jest uruchomiony w trybie emulacji. Wersja natywna { -app-name } będzie działać bardziej wydajnie.
architecture-x64-on-arm64-action = Pobierz { -app-name } dla ARM64
first-run-guidance-authorMenu = { -app-name } pozwala ci także podać edytorów i tłumaczy. Możesz zmienić autora na edytora lub tłumacza, wybierając z tego menu.
first-run-guidance-readAloud = { -app-name } can now read your documents to you using natural-sounding voices.
advanced-search-remove-btn =
    .tooltiptext = Usuń warunek
advanced-search-add-btn =
    .tooltiptext = Dodaj warunek
advanced-search-group-btn =
    .tooltiptext = Dodaj grupę warunków
advanced-search-remove-group-btn =
    .tooltiptext = Usuń grupę
advanced-search-ungroup-btn =
    .tooltiptext = Ungroup Conditions
advanced-search-result-level-menu =
    .aria-label = Typ wyniku
advanced-search-result-level-prefix-root =
    .value = Znajdź
advanced-search-join-prefix-root =
    .value = matching
advanced-search-result-level-any =
    .label = any items
advanced-search-result-level-item =
    .label = top-level items
advanced-search-result-level-attachment =
    .label = attachments
advanced-search-result-level-note =
    .label = notes
advanced-search-result-level-annotation =
    .label = adnotacje
advanced-search-binding-menu =
    .aria-label = Match against the same item
advanced-search-binding-separate =
    .label = separately
advanced-search-binding-same-attachment =
    .label = in the same attachment
advanced-search-binding-same-note =
    .label = in the same note
advanced-search-binding-same-annotation =
    .label = in the same annotation
advanced-search-of-the-following =
    .value = of the following
advanced-search-binding-hint-attachment =
    .value = These conditions can match separate attachments.
advanced-search-binding-hint-note =
    .value = These conditions can match separate notes.
advanced-search-binding-hint-annotation =
    .value = These conditions can match separate annotations.
advanced-search-level-warning-mixed = These conditions cannot all match the same item, so this search will never return results. Try matching “{ $matchAny }” of them, or set the result type to “{ $topLevelItems }”.
advanced-search-level-warning-unreachable = This search has a condition that cannot apply to the chosen result type. Set the result type to “{ $topLevelItems }” or remove the incompatible condition.
advanced-search-group-warning-unreachable =
    A condition here cannot be in the same { $entity ->
        [attachment] attachment
        [note] note
       *[annotation] annotation
    }. Match these separately or remove the incompatible condition.
advanced-search-group-warning-mixed = These conditions cannot all match the same item, so this group will never match. Try matching “{ $matchAny }” of them, or set the result type to “{ $topLevelItems }”.
advanced-search-bind-same-attachment =
    .label = Match the same attachment
advanced-search-bind-same-note =
    .label = Match the same note
advanced-search-bind-same-annotation =
    .label = Match the same annotation
advanced-search-conditions-menu =
    .aria-label = Wyszukiwanie warunkowe
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Wartość
    .label = { $label }
search-operator-isEmpty = is empty
search-operator-isNotEmpty = is not empty
search-conditions-tooltip-fields = Pola:
search-conditions-collection = Kolekcja
search-conditions-savedSearch = Zapisane wyszukiwanie
search-conditions-itemTypeID = Typ elementu
search-conditions-tag = Etykieta
search-conditions-numTags = # of Tags
search-conditions-numNotes = # of Notes
search-conditions-numAttachments = # of Attachments
search-conditions-numAnnotations = # of Annotations
search-conditions-note = Notatka
search-conditions-childNote = Notatka podrzędna
search-conditions-creator = Twórca
search-conditions-thesisType = Typ pracy dyplomowej
search-conditions-reportType = Typ raportu
search-conditions-videoRecordingFormat = Format nagrania wideo
search-conditions-audioFileType = Typ pliku audio
search-conditions-audioRecordingFormat = Format nagrania audio
search-conditions-letterType = Typ listu
search-conditions-interviewMedium = Nośnik wywiadu
search-conditions-manuscriptType = Typ rękopisu
search-conditions-presentationType = Typ prezentacji
search-conditions-mapType = Typ mapy
search-conditions-artworkMedium = Technika wykonania
search-conditions-dateModified = Data modyfikacji
search-conditions-fulltextContent = Zawartość załącznika
search-conditions-programmingLanguage = Język programowania
search-conditions-fileTypeID = Typ pliku załącznika
search-conditions-attachmentStorageType = Attachment Storage Type
search-conditions-lastRead = Ostatnio czytany załącznik
search-conditions-annotationText = Tekst adnotacji
search-conditions-annotationComment = Komentarz adnotacji
search-conditions-annotationType = Typ adnotacji
search-conditions-annotationColor = Kolor adnotacji
search-conditions-annotationAuthor = Autor adnotacji
search-conditions-anyField = Dowolne pole
search-conditions-titleCreatorYear = Tytuł, Twórca, Rok
search-conditions-submenu-attachment = Załącznik
search-conditions-submenu-annotation = Adnotacja
search-conditions-short-fulltextContent = Zawartość
search-conditions-short-fileTypeID = Typ pliku
search-conditions-short-attachmentStorageType = Storage Type
search-conditions-short-lastRead = Ostatnio czytany
search-conditions-short-annotationText = Tekst
search-conditions-short-annotationComment = Komentarz
search-conditions-short-annotationType = Typ
search-conditions-short-annotationColor = Kolor
search-conditions-short-annotationAuthor = Autor
find-pdf-files-added =
    { $count ->
        [one] { $count } plik dodany
        [few] { $count } pliki dodane
        [many] { $count } plików dodanych
       *[other] { $count } plików dodanych
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
            [one] Przekształć na samodzielny załącznik
            [few] Przekształć na samodzielne załączniki
            [many] Przekształć na samodzielne załączniki
           *[other] Przekształć na samodzielne załączniki
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Przekształć na samodzielną notatkę
            [few] Przekształć na samodzielne notatki
            [many] Przekształć na samodzielne notatki
           *[other] Przekształć na samodzielne notatki
        }
file-type-webpage = Strona internetowa
file-type-image = Obraz
file-type-pdf = PDF
file-type-audio = Dźwięk
file-type-video = Wideo
file-type-presentation = Prezentacja
file-type-document = Dokument
file-type-ebook = Ebook
attachment-storage-type-storedFile = Stored File
attachment-storage-type-linkedFile = Linked File
attachment-storage-type-webLink = Web Link
post-upgrade-message = <span data-l10n-name="post-upgrade-appver">{ -app-name } został zaktualizowany do wersji { $version }</span>! Dowiedz się <a data-l10n-name="new-features-link">co nowego?</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Wklej i wyszukaj
mac-word-plugin-install-message = Do instalacji wtyczki Word wymagany jest dostęp Zotero do danych Word.
mac-word-plugin-install-folder-message = { -app-name } needs access to Word’s startup folder to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = Zainstaluj wtyczkę Word
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Install the plugin in the Word startup folder
mac-word-plugin-install-folder-dialog-button = Zainstaluj
mac-word-plugin-install-wrong-folder-selected = The suggested folder must be selected. Please try again without choosing a different folder.
file-renaming-banner-message = { -app-name } teraz automatycznie synchronizuje nazwy plików załączników podczas dokonywania zmian w elementach.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = Łącznik { -app-name } musi zostać zaktualizowany, aby działać z tą wersją { -app-name }.
userjs-pref-warning = Some { -app-name } settings have been overridden using an unsupported method. { -app-name } will revert them and restart.
migrate-extra-fields-progress-message = Migracja nowych pól z pola Dodatkowe
search-normalization-progress-message = Indexing items for search
long-tag-fixer-window-title =
    .title = Podziel znaczniki
long-tag-fixer-button-dont-split =
    .label = Nie dziel
menu-normalize-attachment-titles =
    .label = Normalizuj nazwy załączników...
normalize-attachment-titles-title = Normalizuj nazwy załączników
normalize-attachment-titles-text = { -app-name } automatycznie zmienia nazwy plików na dysku z użyciem metadanych elementu nadrzędnego, ale używa osobnych, prostszych nazw jak “Full Text PDF”, “Preprint PDF”, or “PDF” dla głównych załączników, aby utrzymać bardziej klarowną listę elementów i zapobiec duplikowaniu informacji.W starszych wersjach { -app-name }, podobnie jak używając różnych wtyczek, nazwy plików załączników mogą być niepotrzebnie zmieniane, aby odpowiadały nazwom plików.Czy chcesz zaktualizować wybrane załączniki, aby użyć ich prostszych nazw? Zostaną zmienione tylko główne załączniki z nazwami, które odpowiadają nazwie pliku.
banner-close-button =
    .aria-label = Odrzuć powiadomienie
plugins-blocked-plugin =
    .message = Ta wtyczka została wyłączona przez { -app-name }.
data-dir-unsupported-storage = This can happen if the { -app-name } data directory is in a cloud storage folder (OneDrive, Dropbox, etc.) or on a network share.
login-manager-reset = { -app-name } was unable to read your saved login information, so it has been reset. Please log in again in the { preferences-pane-account } pane of the { -app-name } settings.
os-keystore-save-failed =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t access the { -os-name } Keychain to securely save your credentials. Make sure your Keychain is accessible and try again.
        [windows] { -app-name } couldn’t securely save your credentials. Try again or restart { -app-name }.
       *[other] { -app-name } couldn’t access your { -os-name } keyring to securely save your credentials. Make sure a keyring service is running and try again.
    }
os-keystore-migrate-failed =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t access the { -os-name } Keychain to encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Make sure your Keychain is accessible and restart { -app-name }.
        [windows] { -app-name } couldn’t encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Restart { -app-name } and try again.
       *[other] { -app-name } couldn’t access your { -os-name } keyring to encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Make sure a keyring service is running and restart { -app-name }.
    }
search-button =
    .label = Wyszukiwanie
save-search-new-button =
    .label = Save Search…
save-search-edit-button =
    .label = Zapisz
save-search-name-title = Zapisz wyszukiwanie
save-search-name-message = Enter a name for the saved search:
saved-search-close-confirmation-title = Editing Saved Search
saved-search-close-confirmation-body = Do you want to save changes you made to this saved search?
item-pane-batch-editing-prompt =
    .aria-label = Edycja wsadowa
item-pane-batch-editing-enable =
    .label = Edytuj wiele elementów...
item-pane-batch-editing-multiple-values-placeholder = Multiple
item-pane-batch-editing-clear-values = Clear all values
item-pane-batch-editing-header =
    { $count ->
        [one] Editing { $count } item
       *[other] Editing { $count } items
    }
item-pane-batch-editing-done =
    .label = { general-done }
undo-action-edit-metadata =
    { $count ->
        [one] Edit Metadata
       *[other] Edit Metadata for { $count } Items
    }
undo-action-edit-field =
    { $count ->
        [one] Edit of “{ $field }”
       *[other] Edit of “{ $field }” for { $count } Items
    }
undo-action-normalize-attachment-titles = Normalize Attachment Title
undo-action-trash =
    { $count ->
        [one] Trash Item
       *[other] Trash { $count } Items
    }
undo-action-restore-items =
    { $count ->
        [one] Restore Item
       *[other] Restore { $count } Items
    }
undo-action-trash-collection =
    { $count ->
        [one] Trash Collection
       *[other] Trash { $count } Collections
    }
undo-action-trash-search =
    { $count ->
        [one] Trash Saved Search
       *[other] Trash { $count } Saved Searches
    }
undo-action-restore-collection =
    { $count ->
        [one] Restore Collection
       *[other] Restore { $count } Collections
    }
undo-action-restore-objects =
    { $count ->
        [one] Restore Object
       *[other] Restore { $count } Objects
    }
undo-action-add-to-collection =
    { $count ->
        [one] Add to Collection
       *[other] Add { $count } Items to Collection
    }
undo-action-remove-from-collection =
    { $count ->
        [one] Remove from Collection
       *[other] Remove { $count } Items from Collection
    }
undo-action-move-to-collection =
    { $count ->
        [one] Move to Collection
       *[other] Move { $count } Items to Collection
    }
undo-action-rename-collection = Zmień nazwę kolekcji
undo-action-move-collection = Przenieś kolekcję
undo-action-add-tag =
    { $count ->
        [one] Add Tag
       *[other] Add Tag to { $count } Items
    }
undo-action-change-tag = Zmień etykietę
undo-action-split-tag = Podziel etykietę
undo-action-remove-tag =
    { $count ->
        [one] Remove Tag
       *[other] Remove Tag from { $count } Items
    }
undo-action-remove-tags-from-item =
    { $count ->
        [one] Remove Tag
       *[other] Remove { $count } Tags
    }
undo-action-remove-all-tags = Usuń wszystkie etykiety
undo-action-edit-note = Edytowanie notatki
undo-action-add-creator = Dodaj twórcę
undo-action-remove-creator = Usuń twórcę
undo-action-edit-creator = Edytuj twórcę
undo-action-reorder-creator = Reorder Creator
undo-action-change-type = Zmień typ elementu
undo-action-change-parent-item =
    { $count ->
        [one] Change Parent Item
       *[other] Change Parent for { $count } Items
    }
undo-action-convert-to-standalone =
    { $count ->
        [one] Convert to Standalone
       *[other] Convert { $count } Items to Standalone
    }
undo-action-add-related = Dodaj powiązane
undo-action-remove-related = Usuń powiązane
undo-action-merge-items =
    { $count ->
        [one] Merge Item
       *[other] Merge { $count } Items
    }
menu-edit-undo-action = Undo { $action }
menu-edit-redo-action = Redo { $action }
