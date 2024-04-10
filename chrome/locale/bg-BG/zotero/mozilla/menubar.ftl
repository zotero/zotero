# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Настройки
menu-application-services =
    .label = Услуги
menu-application-hide-this =
    .label = Скриване на { -brand-shorter-name }
menu-application-hide-other =
    .label = Скриване на другите
menu-application-show-all =
    .label = Показване на всички
menu-application-touch-bar =
    .label = Настройки на лентата за докосване…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Изход
           *[other] Изход
        }
    .accesskey =
        { PLATFORM() ->
            [windows] х
           *[other] х
        }

# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Изход от { -brand-shorter-name }

menu-about =
    .label = Относно { -brand-shorter-name }
    .accesskey = О

## File Menu

menu-file =
    .label = Файл
    .accesskey = Ф
menu-file-new-tab =
    .label = Нов раздел
    .accesskey = д
menu-file-new-container-tab =
    .label = Нов изолиран раздел
    .accesskey = и
menu-file-new-window =
    .label = Нов прозорец
    .accesskey = п
menu-file-new-private-window =
    .label = Поверителен прозорец
    .accesskey = в
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Отваряне на адрес…
menu-file-open-file =
    .label = Отваряне…
    .accesskey = о
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [one] Затваряне на раздела
           *[other] Затваряне на { $tabCount } раздела
        }
    .accesskey = З
menu-file-close-window =
    .label = Затваряне на прозореца
    .accesskey = п
menu-file-save-page =
    .label = Запазване като…
    .accesskey = З
menu-file-email-link =
    .label = Препратка по имейл…
    .accesskey = е
menu-file-share-url =
    .label = Споделяне
    .accesskey = С
menu-file-print-setup =
    .label = Настройки на отпечатване…
    .accesskey = Н
menu-file-print =
    .label = Отпечатване…
    .accesskey = п
menu-file-import-from-another-browser =
    .label = Внасяне от друг мрежов четец…
    .accesskey = ч
menu-file-go-offline =
    .label = Работа извън мрежата
    .accesskey = Р

## Edit Menu

menu-edit =
    .label = Редактиране
    .accesskey = Р
menu-edit-find-in-page =
    .label = Търсене в страницата…
    .accesskey = Т
menu-edit-find-again =
    .label = Търсене отново
    .accesskey = о
menu-edit-bidi-switch-text-direction =
    .label = Превключване посоката на текста
    .accesskey = р

## View Menu

menu-view =
    .label = Изглед
    .accesskey = И
menu-view-toolbars-menu =
    .label = Ленти с инструменти
    .accesskey = и
menu-view-customize-toolbar2 =
    .label = Приспособяване на лентата…
    .accesskey = л
menu-view-sidebar =
    .label = Странична лента
    .accesskey = С
menu-view-bookmarks =
    .label = Отметки
menu-view-history-button =
    .label = История
menu-view-synced-tabs-sidebar =
    .label = Синхронизирани раздели
menu-view-full-zoom =
    .label = Мащабиране
    .accesskey = М
menu-view-full-zoom-enlarge =
    .label = Увеличаване
    .accesskey = У
menu-view-full-zoom-reduce =
    .label = Намаляване
    .accesskey = м
menu-view-full-zoom-actual-size =
    .label = Действителен размер
    .accesskey = Д
menu-view-full-zoom-toggle =
    .label = Само на текста
    .accesskey = т
menu-view-page-style-menu =
    .label = Оформление на страницата
    .accesskey = ф
menu-view-page-style-no-style =
    .label = Без
    .accesskey = Б
menu-view-page-basic-style =
    .label = Основен стил
    .accesskey = О
menu-view-repair-text-encoding =
    .label = Поправка на кодировката
    .accesskey = к

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Влизане в режим на цял екран
    .accesskey = ц
menu-view-exit-full-screen =
    .label = Излизане от цял екран
    .accesskey = ц
menu-view-full-screen =
    .label = Цял екран
    .accesskey = Ц

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Отваря изгледа за четене
    .accesskey = О
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Затваря изгледа за четене
    .accesskey = З

##

menu-view-show-all-tabs =
    .label = Показване на всички раздели
    .accesskey = д
menu-view-bidi-switch-page-direction =
    .label = Превключване посоката на страницата
    .accesskey = П

## History Menu

menu-history =
    .label = История
    .accesskey = с
menu-history-show-all-history =
    .label = Цялата история
menu-history-clear-recent-history =
    .label = Изчистване на скорошна история…
menu-history-synced-tabs =
    .label = Синхронизирани раздели
menu-history-restore-last-session =
    .label = Възстановяване на предишна сесия
menu-history-hidden-tabs =
    .label = Скрити раздели
menu-history-undo-menu =
    .label = Последно затворени раздели
menu-history-undo-window-menu =
    .label = Последно затворени прозорци

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Отметки
    .accesskey = О
menu-bookmarks-manage =
    .label = Управление на отметки
menu-bookmark-tab =
    .label = Отмятане на текущия раздел…
menu-edit-bookmark =
    .label = Промяна на отметка…
menu-bookmarks-all-tabs =
    .label = Отмятане на всички раздели…
menu-bookmarks-toolbar =
    .label = Лента с отметки
menu-bookmarks-other =
    .label = Други отметки
menu-bookmarks-mobile =
    .label = Мобилни отметки

## Tools Menu

menu-tools =
    .label = Инструменти
    .accesskey = н
menu-tools-downloads =
    .label = Изтегляния
    .accesskey = т
menu-tools-addons-and-themes =
    .label = Добавки и теми
    .accesskey = Д
menu-tools-fxa-sign-in2 =
    .label = Вписване
    .accesskey = В
menu-tools-turn-on-sync2 =
    .label = Включване на Sync…
    .accesskey = н
menu-tools-sync-now =
    .label = Синхронизиране
    .accesskey = С
menu-tools-fxa-re-auth =
    .label = Повторно свързване с { -brand-product-name }…
    .accesskey = с
menu-tools-browser-tools =
    .label = Инструменти за четеца
    .accesskey = И
menu-tools-task-manager =
    .label = Диспечер на задачи
    .accesskey = Д
menu-tools-page-source =
    .label = Изходен код на страницата
    .accesskey = к
menu-tools-page-info =
    .label = Информация за страницата
    .accesskey = И
menu-settings =
    .label = Настройки
    .accesskey =
        { PLATFORM() ->
            [windows] н
           *[other] н
        }
menu-tools-layout-debugger =
    .label = Отстраняване на грешки в оформлението
    .accesskey = о

## Window Menu

menu-window-menu =
    .label = Прозорец
menu-window-bring-all-to-front =
    .label = Извеждане всичко на преден план

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Помощ
    .accesskey = П
menu-get-help =
    .label = Получете помощ
    .accesskey = П
menu-help-more-troubleshooting-info =
    .label = Повече информация за отстраняване на неизправности
    .accesskey = т
menu-help-report-site-issue =
    .label = Докладване на проблем със страницата…
menu-help-share-ideas =
    .label = Споделяне на идеи и обратна връзка…
    .accesskey = С
menu-help-enter-troubleshoot-mode2 =
    .label = Режим за отстраняване на неизправности…
    .accesskey = м
menu-help-exit-troubleshoot-mode =
    .label = Изкл. режим за отстраняване на неизправности
    .accesskey = м
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Докладване на измамническа страница…
    .accesskey = з
menu-help-not-deceptive =
    .label = Това не е измамническа страница…
    .accesskey = н
