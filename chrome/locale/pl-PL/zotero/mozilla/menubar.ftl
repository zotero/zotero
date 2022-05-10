# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Plik
    .accesskey = P
menu-file-new-tab =
    .label = Nowa karta
    .accesskey = t
menu-file-new-container-tab =
    .label = Nowa karta z kontekstem
    .accesskey = k
menu-file-new-window =
    .label = Nowe okno
    .accesskey = N
menu-file-new-private-window =
    .label = Nowe okno prywatne
    .accesskey = p
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Otwórz adres…
menu-file-open-file =
    .label = Otwórz plik…
    .accesskey = o
menu-file-close =
    .label = Zamknij
    .accesskey = Z
menu-file-close-window =
    .label = Zamknij okno
    .accesskey = m
menu-file-save-page =
    .label = Zapisz stronę jako…
    .accesskey = p
menu-file-email-link =
    .label = Wyślij odnośnik…
    .accesskey = n
menu-file-print-setup =
    .label = Ustawienia strony…
    .accesskey = U
menu-file-print-preview =
    .label = Podgląd wydruku
    .accesskey = g
menu-file-print =
    .label = Drukuj…
    .accesskey = D
menu-file-import-from-another-browser =
    .label = Importuj z innej przeglądarki…
    .accesskey = I
menu-file-go-offline =
    .label = Pracuj w trybie offline
    .accesskey = c

## Edit Menu

menu-edit =
    .label = Edycja
    .accesskey = E
menu-edit-find-on =
    .label = Znajdź na tej stronie…
    .accesskey = Z
menu-edit-find-again =
    .label = Znajdź następne
    .accesskey = n
menu-edit-bidi-switch-text-direction =
    .label = Przełącz kierunek tekstu
    .accesskey = t

## View Menu

menu-view =
    .label = Widok
    .accesskey = W
menu-view-toolbars-menu =
    .label = Paski narzędzi
    .accesskey = P
menu-view-customize-toolbar =
    .label = Dostosuj…
    .accesskey = t
menu-view-sidebar =
    .label = Panel boczny
    .accesskey = b
menu-view-bookmarks =
    .label = Zakładki
menu-view-history-button =
    .label = Historia
menu-view-synced-tabs-sidebar =
    .label = Karty z innych urządzeń
menu-view-full-zoom =
    .label = Powiększenie
    .accesskey = w
menu-view-full-zoom-enlarge =
    .label = Powiększ
    .accesskey = w
menu-view-full-zoom-reduce =
    .label = Pomniejsz
    .accesskey = m
menu-view-full-zoom-actual-size =
    .label = Rozmiar oryginalny
    .accesskey = R
menu-view-full-zoom-toggle =
    .label = Powiększaj tylko tekst
    .accesskey = k
menu-view-page-style-menu =
    .label = Styl strony
    .accesskey = S
menu-view-page-style-no-style =
    .label = Ignoruj style
    .accesskey = n
menu-view-page-basic-style =
    .label = Styl podstawowy
    .accesskey = S
menu-view-charset =
    .label = Kodowanie tekstu
    .accesskey = K

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Tryb pełnoekranowy
    .accesskey = T
menu-view-exit-full-screen =
    .label = Opuść tryb pełnoekranowy
    .accesskey = O
menu-view-full-screen =
    .label = Tryb pełnoekranowy
    .accesskey = T

##

menu-view-show-all-tabs =
    .label = Wyświetl wszystkie karty
    .accesskey = W
menu-view-bidi-switch-page-direction =
    .label = Przełącz kierunek strony
    .accesskey = s

## History Menu

menu-history =
    .label = Historia
    .accesskey = h
menu-history-show-all-history =
    .label = Wyświetl całą historię
menu-history-clear-recent-history =
    .label = Wyczyść historię przeglądania…
menu-history-synced-tabs =
    .label = Karty z innych urządzeń
menu-history-restore-last-session =
    .label = Przywróć poprzednią sesję
menu-history-hidden-tabs =
    .label = Ukryte karty
menu-history-undo-menu =
    .label = Ostatnio zamknięte karty
menu-history-undo-window-menu =
    .label = Ostatnio zamknięte okna

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Zakładki
    .accesskey = Z
menu-bookmarks-show-all =
    .label = Wyświetl wszystkie zakładki
menu-bookmark-this-page =
    .label = Dodaj zakładkę
menu-bookmark-edit =
    .label = Edytuj zakładkę
menu-bookmarks-all-tabs =
    .label = Dodaj zakładki do wszystkich kart…
menu-bookmarks-toolbar =
    .label = Pasek zakładek
menu-bookmarks-other =
    .label = Pozostałe zakładki
menu-bookmarks-mobile =
    .label = Zakładki z telefonu

## Tools Menu

menu-tools =
    .label = Narzędzia
    .accesskey = N
menu-tools-downloads =
    .label = Pobieranie plików
    .accesskey = P
menu-tools-addons =
    .label = Dodatki
    .accesskey = D
menu-tools-fxa-sign-in =
    .label = Zaloguj się w przeglądarce { -brand-product-name }…
    .accesskey = Z
menu-tools-turn-on-sync =
    .label = Włącz { -sync-brand-short-name(case: "acc", capitalization: "lower") }…
    .accesskey = W
menu-tools-sync-now =
    .label = Synchronizuj teraz
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Zaloguj się ponownie w przeglądarce { -brand-product-name }…
    .accesskey = Z
menu-tools-web-developer =
    .label = Dla twórców witryn
    .accesskey = W
menu-tools-page-source =
    .label = Źródło strony
    .accesskey = d
menu-tools-page-info =
    .label = Informacje o stronie
    .accesskey = m
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Opcje
           *[other] Preferencje
        }
    .accesskey =
        { PLATFORM() ->
            [windows] O
           *[other] r
        }
menu-tools-layout-debugger =
    .label = Debuger układu
    .accesskey = r

## Window Menu

menu-window-menu =
    .label = Okno
menu-window-bring-all-to-front =
    .label = Pokaż wszystko na wierzchu

## Help Menu

menu-help =
    .label = Pomoc
    .accesskey = c
menu-help-product =
    .label = Pomoc programu { -brand-shorter-name }
    .accesskey = P
menu-help-show-tour =
    .label = Przewodnik po programie { -brand-shorter-name }
    .accesskey = r
menu-help-import-from-another-browser =
    .label = Importuj z innej przeglądarki…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Skróty klawiaturowe
    .accesskey = S
menu-help-troubleshooting-info =
    .label = Informacje dla pomocy technicznej
    .accesskey = n
menu-help-feedback-page =
    .label = Prześlij swoją opinię…
    .accesskey = e
menu-help-safe-mode-without-addons =
    .label = Uruchom ponownie z wyłączonymi dodatkami…
    .accesskey = U
menu-help-safe-mode-with-addons =
    .label = Uruchom ponownie z włączonymi dodatkami
    .accesskey = U
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Zgłoś oszustwo internetowe…
    .accesskey = Z
menu-help-not-deceptive =
    .label = To nie jest oszustwo…
    .accesskey = n
