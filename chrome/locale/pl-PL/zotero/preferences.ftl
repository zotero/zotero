preferences-window =
    .title = Ustawienia { -app-name }
preferences-appearance-title = Wygląd i język
preferences-auto-recognize-files =
    .label = Automatycznie pobieraj metadane dla plików PDF i ebooków
preferences-file-renaming-title = Zmiana nazw plików
preferences-file-renaming-intro = { -app-name } może automatycznie zmienić nazwy plików na podstawie szczegółów elementu nadrzędnego (tytuł, autor, etc.) i utrzymać nazwy plików zsynchronizowane podczas dokonywania przez Ciebie zmian. Pobrane pliki są zawsze początkowo nazywane na podstawie elementu nadrzędnego.
preferences-file-renaming-configure-button =
    .label = Configure File Renaming…
preferences-attachment-titles-title = Nazwy załączników
preferences-attachment-titles-intro = Nazwy załączników są <label data-l10n-name="wiki-link">różne od nazw plików</label>. Aby wspierać różne style pracy, { -app-name } może pokazywać nazwy plików zamiast nazw załączników na liście elementów.
preferences-attachment-titles-show-filenames =
    .label = Pokaż nazwy plików załączników na liście elementów
preferences-reader-title = Czytnik
preferences-reader-open-epubs-using = Otwieraj pliki EPUB za pomocą
preferences-reader-open-snapshots-using = Otwieraj zrzuty ekranu za pomocą
preferences-reader-open-in-new-window =
    .label = Otwieraj pliki w nowych oknach zamiast w kartach
preferences-reader-auto-disable-tool =
    .label = Po każdym użyciu wyłącz narzędzia notatek, adnotacji tekstowych i obrazów.
preferences-reader-ebook-font = Czcionka ebooka:
preferences-reader-ebook-hyphenate =
    .label = Włącz automatyczne dzielenie wyrazów
preferences-note-title = Notatki
preferences-note-open-in-new-window =
    .label = Otwieraj notatki w nowych oknach zamiast na kartach
preferences-color-scheme = Tryb kolorów:
preferences-color-scheme-auto =
    .label = Automatycznie
preferences-color-scheme-light =
    .label = Jasny
preferences-color-scheme-dark =
    .label = Ciemny
preferences-item-pane-header = Nagłówek panelu elementów:
preferences-item-pane-header-style = Styl cytowania nagłówka:
preferences-item-pane-header-locale = Język nagłówka:
preferences-item-pane-header-missing-style = Brakujący styl: <{ $shortName }>
preferences-locate-library-lookup-intro = Funkcja Library Lookup może znaleźć zasób online, korzystając z modułu rozpoznawania adresów OpenURL Twojej biblioteki.
preferences-locate-resolver = Resolwer:
preferences-locate-base-url = Podstawowy URL:
preferences-quickCopy-minus =
    .aria-label = { general-remove }
    .label = { $label }
preferences-quickCopy-plus =
    .aria-label = { general-add }
    .label = { $label }
preferences-styleManager-intro = { -app-name } może tworzyć cytowania i bibliografie w ponad 10.000 różnych stylach cytowań. Tutaj możesz dodać style, aby stały się dostępne w { -app-name }.
preferences-styleManager-get-additional-styles =
    .label = Pobierz dodatkowe style...
preferences-styleManager-restore-default =
    .label = Przywróć style domyślne...
preferences-styleManager-add-from-file =
    .tooltiptext = Dodaj styl z pliku
    .label = Dodaj z pliku...
preferences-styleManager-remove = Wciśnij { delete-or-backspace } aby usunąć ten styl.
preferences-citation-dialog = Okno cytowania
preferences-citation-dialog-mode = Tryb okna cytowania:
preferences-citation-dialog-mode-last-used =
    .label = Ostatnio używany
preferences-citation-dialog-mode-list =
    .label = Tryb listy
preferences-citation-dialog-mode-library =
    .label = Tryb biblioteki
preferences-advanced-enable-local-api =
    .label = Zezwól innym aplikacjom na tym komputerze komunikować się z { -app-name }
preferences-advanced-local-api-available = Dostępny na <code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = Serwer HTTP { -app-name } nie jest włączony.
preferences-advanced-server-enable-and-restart =
    .label = Włącz i uruchom ponownie
preferences-advanced-language-and-region-title = Język i region
preferences-advanced-enable-bidi-ui =
    .label = Włącz narzędzia edytowania tekstu dwukierunkowego
preferences-advanced-reset-data-dir =
    .label = Przywróć do domyślnej lokalizacji...
preferences-advanced-custom-data-dir =
    .label = Użyj własnej lokalizacji...
preferences-advanced-default-data-dir =
    .value = (Domyślny: { $directory })
    .aria-label = Domyślna lokalizacja
-preferences-sync-data-syncing = Synchronizacja danych
preferences-sync-data-syncing-groupbox =
    .aria-label = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-heading = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-description = Log in with your { -app-name } account to sync your data between devices, collaborate with others, and more.
preferences-account-log-out =
    .label = Wyloguj się...
preferences-sync-reset-restore-to-server-body = { -app-name } zastąpi “{ $libraryName }” na { $domain } danymi z tego komputera.
preferences-sync-reset-restore-to-server-deleted-items-text =
    { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] item
       *[other] items
    } in the online library will be permanently deleted.
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] The library on this computer and the online library will be empty.
        [one] 1 item will remain on this computer and in the online library.
       *[other] { $localItemsCount } items will remain on this computer and in the online library.
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
        [one] Usuń { $remoteItemsDeletedCount } element
        [few] Usuń { $remoteItemsDeletedCount } elementy
        [many] Usuń { $remoteItemsDeletedCount } elementów
       *[other] Usuń { $remoteItemsDeletedCount } elementów
    }
preferences-sync-reset-restore-to-server-confirmation-text = usuń bibliotekę online
preferences-sync-reset-restore-to-server-yes = Zamień dane w zdalnej bibliotece
preferences-account-log-in =
    .label = Zaloguj się
preferences-account-waiting-for-login =
    .value = Waiting for login…
preferences-account-cancel-button =
    .label = { general-cancel }
preferences-account-logged-out-status =
    .value = (logged out)
preferences-account-email-label =
    .value = Email:
preferences-account-switch-accounts =
    .label = Switch Accounts…
preferences-account-switch-text = Switching to a different account will remove all { -app-name } data on this computer. Before continuing, make sure all data and files you wish to keep have been synced with the “{ $username }” account or you have a backup of your { -app-name } data directory.
preferences-account-switch-confirmation-text = remove local data
preferences-account-switch-accept = Remove Data and Restart
