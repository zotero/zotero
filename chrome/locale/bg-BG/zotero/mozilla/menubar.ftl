# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


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
menu-file-close =
    .label = Затваряне
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
menu-file-print-setup =
    .label = Настройки на отпечатване…
    .accesskey = Н
menu-file-print-preview =
    .label = Преглед преди отпечатване
    .accesskey = р
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
menu-edit-find-on =
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
menu-view-customize-toolbar =
    .label = Персонализиране…
    .accesskey = П
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
menu-view-charset =
    .label = Кодиране на текста
    .accesskey = К

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
menu-bookmarks-show-all =
    .label = Показване на всички отметки
menu-bookmark-this-page =
    .label = Отмятане на страницата
menu-bookmark-edit =
    .label = Промяна на отметка
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
menu-tools-addons =
    .label = Добавки
    .accesskey = Д
menu-tools-fxa-sign-in =
    .label = Вписване в { -brand-product-name }…
    .accesskey = с
menu-tools-turn-on-sync =
    .label = Включване на { -sync-brand-short-name }…
    .accesskey = л
menu-tools-sync-now =
    .label = Синхронизиране
    .accesskey = С
menu-tools-fxa-re-auth =
    .label = Повторно свързване с { -brand-product-name }…
    .accesskey = с
menu-tools-web-developer =
    .label = Разработчик
    .accesskey = т
menu-tools-page-source =
    .label = Изходен код на страницата
    .accesskey = к
menu-tools-page-info =
    .label = Информация за страницата
    .accesskey = И
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Настройки
           *[other] Настройки
        }
    .accesskey =
        { PLATFORM() ->
            [windows] Н
           *[other] Н
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

menu-help =
    .label = Помощ
    .accesskey = П
menu-help-product =
    .label = Помощ за { -brand-shorter-name }
    .accesskey = П
menu-help-show-tour =
    .label = Обиколка на { -brand-shorter-name }
    .accesskey = б
menu-help-import-from-another-browser =
    .label = Внасяне от друг мрежов четец…
    .accesskey = В
menu-help-keyboard-shortcuts =
    .label = Клавишни комбинации
    .accesskey = К
menu-help-troubleshooting-info =
    .label = Отстраняване на неизправности
    .accesskey = И
menu-help-feedback-page =
    .label = Обратна връзка…
    .accesskey = в
menu-help-safe-mode-without-addons =
    .label = Рестартиране с изключени добавки…
    .accesskey = д
menu-help-safe-mode-with-addons =
    .label = Рестартиране с включени добавки
    .accesskey = д
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Докладване на измамническа страница…
    .accesskey = з
menu-help-not-deceptive =
    .label = Това не е измамническа страница…
    .accesskey = н
