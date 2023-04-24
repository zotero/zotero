# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Preferencje
menu-application-services =
    .label = Usługi
menu-application-hide-this =
    .label = Ukryj program { -brand-shorter-name }
menu-application-hide-other =
    .label = Ukryj pozostałe
menu-application-show-all =
    .label = Pokaż wszystkie
menu-application-touch-bar =
    .label = Dostosuj pasek Touch Bar…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Zakończ
           *[other] Zakończ
        }
    .accesskey =
        { PLATFORM() ->
            [windows] k
           *[other] k
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Zakończ program { -brand-shorter-name }
menu-about =
    .label = O programie { -brand-shorter-name }
    .accesskey = O

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
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Zamknij kartę
            [one] Zamknij kartę
            [few] Zamknij { $tabCount } karty
           *[many] Zamknij { $tabCount } kart
        }
    .accesskey = k
menu-file-close-window =
    .label = Zamknij okno
    .accesskey = m
menu-file-save-page =
    .label = Zapisz stronę jako…
    .accesskey = p
menu-file-email-link =
    .label = Wyślij odnośnik…
    .accesskey = n
menu-file-share-url =
    .label = Udostępnij
    .accesskey = s
menu-file-print-setup =
    .label = Ustawienia strony…
    .accesskey = U
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
menu-edit-find-in-page =
    .label = Znajdź na stronie…
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
menu-view-customize-toolbar2 =
    .label = Dostosuj pasek narzędzi…
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
menu-view-repair-text-encoding =
    .label = Napraw kodowanie tekstu
    .accesskey = k

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

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Popraw czytelność
    .accesskey = P
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Wygląd oryginalny
    .accesskey = W

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
menu-history-reopen-all-tabs = Przywróć wszystkie karty
menu-history-reopen-all-windows = Przywróć wszystkie okna

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Zakładki
    .accesskey = Z
menu-bookmarks-manage =
    .label = Zarządzaj zakładkami
menu-bookmark-current-tab =
    .label = Dodaj zakładkę do tej karty
menu-bookmark-edit =
    .label = Edytuj tę zakładkę
menu-bookmark-tab =
    .label = Dodaj zakładkę do tej karty…
menu-edit-bookmark =
    .label = Edytuj tę zakładkę…
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
menu-tools-addons-and-themes =
    .label = Dodatki i motywy
    .accesskey = D
menu-tools-fxa-sign-in2 =
    .label = Zaloguj się
    .accesskey = Z
menu-tools-turn-on-sync2 =
    .label = Włącz synchronizację…
    .accesskey = W
menu-tools-sync-now =
    .label = Synchronizuj teraz
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Zaloguj się ponownie w przeglądarce { -brand-product-name }…
    .accesskey = Z
menu-tools-browser-tools =
    .label = Narzędzia przeglądarki
    .accesskey = N
menu-tools-task-manager =
    .label = Menedżer zadań
    .accesskey = M
menu-tools-page-source =
    .label = Źródło strony
    .accesskey = d
menu-tools-page-info =
    .label = Informacje o stronie
    .accesskey = m
menu-settings =
    .label = Ustawienia
    .accesskey =
        { PLATFORM() ->
            [windows] U
           *[other] U
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


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Pomoc
    .accesskey = c
menu-get-help =
    .label = Pomoc
    .accesskey = P
menu-help-more-troubleshooting-info =
    .label = Więcej informacji do rozwiązywania problemów
    .accesskey = n
menu-help-report-site-issue =
    .label = Zgłoś problem ze stroną…
menu-help-share-ideas =
    .label = Podziel się pomysłami i opiniami…
    .accesskey = d
menu-help-enter-troubleshoot-mode2 =
    .label = Tryb rozwiązywania problemów…
    .accesskey = T
menu-help-exit-troubleshoot-mode =
    .label = Wyłącz tryb rozwiązywania problemów
    .accesskey = t
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Zgłoś oszustwo internetowe…
    .accesskey = Z
menu-help-not-deceptive =
    .label = To nie jest oszustwo…
    .accesskey = n
