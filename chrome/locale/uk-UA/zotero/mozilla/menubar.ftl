# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Файл
    .accesskey = Ф
menu-file-new-tab =
    .label = Нова вкладка
    .accesskey = л
menu-file-new-container-tab =
    .label = Нова вкладка в контейнері
    .accesskey = н
menu-file-new-window =
    .label = Нове вікно
    .accesskey = в
menu-file-new-private-window =
    .label = Приватне вікно
    .accesskey = т
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Відкрити розташування…
menu-file-open-file =
    .label = Відкрити файл…
    .accesskey = а
menu-file-close =
    .label = Закрити
    .accesskey = к
menu-file-close-window =
    .label = Закрити вікно
    .accesskey = а
menu-file-save-page =
    .label = Зберегти як…
    .accesskey = З
menu-file-email-link =
    .label = Надіслати посилання е-поштою…
    .accesskey = с
menu-file-print-setup =
    .label = Параметри сторінки…
    .accesskey = П
menu-file-print-preview =
    .label = Попередній перегляд
    .accesskey = г
menu-file-print =
    .label = Друкувати…
    .accesskey = к
menu-file-import-from-another-browser =
    .label = Імпорт даних з іншого браузера…
    .accesskey = І
menu-file-go-offline =
    .label = Працювати автономно
    .accesskey = ю

## Edit Menu

menu-edit =
    .label = Редагувати
    .accesskey = Р
menu-edit-find-on =
    .label = Знайти на цій сторінці…
    .accesskey = ц
menu-edit-find-again =
    .label = Знайти знову
    .accesskey = т
menu-edit-bidi-switch-text-direction =
    .label = Перемкнути напрям тексту на сторінці
    .accesskey = к

## View Menu

menu-view =
    .label = Вигляд
    .accesskey = В
menu-view-toolbars-menu =
    .label = Панелі інструментів
    .accesskey = П
menu-view-customize-toolbar =
    .label = Пристосування…
    .accesskey = П
menu-view-sidebar =
    .label = Бічна панель
    .accesskey = ч
menu-view-bookmarks =
    .label = Закладки
menu-view-history-button =
    .label = Історія
menu-view-synced-tabs-sidebar =
    .label = Синхронізовані вкладки
menu-view-full-zoom =
    .label = Масштаб
    .accesskey = ш
menu-view-full-zoom-enlarge =
    .label = Збільшити
    .accesskey = л
menu-view-full-zoom-reduce =
    .label = Зменшити
    .accesskey = н
menu-view-full-zoom-actual-size =
    .label = Дійсний розмір
    .accesskey = й
menu-view-full-zoom-toggle =
    .label = Збільшувати лише текст
    .accesskey = т
menu-view-page-style-menu =
    .label = Стиль сторінки
    .accesskey = С
menu-view-page-style-no-style =
    .label = Без стилю
    .accesskey = Б
menu-view-page-basic-style =
    .label = Основний стиль сторінки
    .accesskey = О
menu-view-charset =
    .label = Кодування символів
    .accesskey = К

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = На весь екран
    .accesskey = е
menu-view-exit-full-screen =
    .label = Вийти з повноекранного режиму
    .accesskey = п
menu-view-full-screen =
    .label = На весь екран
    .accesskey = е

##

menu-view-show-all-tabs =
    .label = Показати всі вкладки
    .accesskey = в
menu-view-bidi-switch-page-direction =
    .label = Перемкнути напрям тексту на сторінці
    .accesskey = м

## History Menu

menu-history =
    .label = Історія
    .accesskey = І
menu-history-show-all-history =
    .label = Показати всю історію
menu-history-clear-recent-history =
    .label = Стерти недавню історію…
menu-history-synced-tabs =
    .label = Синхронізовані вкладки
menu-history-restore-last-session =
    .label = Відновити попередній сеанс
menu-history-hidden-tabs =
    .label = Приховані вкладки
menu-history-undo-menu =
    .label = Недавно закриті вкладки
menu-history-undo-window-menu =
    .label = Недавно закриті вікна

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Закладки
    .accesskey = З
menu-bookmarks-show-all =
    .label = Показати всі закладки
menu-bookmark-this-page =
    .label = Закласти цю сторінку
menu-bookmark-edit =
    .label = Редагувати цю закладку
menu-bookmarks-all-tabs =
    .label = Закласти всі вкладки…
menu-bookmarks-toolbar =
    .label = Панель закладок
menu-bookmarks-other =
    .label = Інші закладки
menu-bookmarks-mobile =
    .label = Мобільні закладки

## Tools Menu

menu-tools =
    .label = Інструменти
    .accesskey = с
menu-tools-downloads =
    .label = Завантаження
    .accesskey = З
menu-tools-addons =
    .label = Додатки
    .accesskey = Д
menu-tools-fxa-sign-in =
    .label = Увійти в { -brand-product-name }…
    .accesskey = в
menu-tools-turn-on-sync =
    .label = Увімкнути { -sync-brand-short-name(case: "acc") }…
    .accesskey = м
menu-tools-sync-now =
    .label = Синхронізувати зараз
    .accesskey = С
menu-tools-fxa-re-auth =
    .label = Повторно під'єднатися до { -brand-product-name }…
    .accesskey = т
menu-tools-web-developer =
    .label = Веб розробка
    .accesskey = В
menu-tools-page-source =
    .label = Програмний код сторінки
    .accesskey = а
menu-tools-page-info =
    .label = Інформація про сторінку
    .accesskey = І
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Налаштування
           *[other] Налаштування
        }
    .accesskey =
        { PLATFORM() ->
            [windows] Н
           *[other] Н
        }
menu-tools-layout-debugger =
    .label = Зневаджувач шаблона
    .accesskey = ш

## Window Menu

menu-window-menu =
    .label = Вікно
menu-window-bring-all-to-front =
    .label = Помістити все на передній план

## Help Menu

menu-help =
    .label = Довідка
    .accesskey = Д
menu-help-product =
    .label = Довідка { -brand-shorter-name }
    .accesskey = Д
menu-help-show-tour =
    .label = Знайомство з { -brand-shorter-name }
    .accesskey = й
menu-help-import-from-another-browser =
    .label = Імпорт даних з іншого браузера…
    .accesskey = м
menu-help-keyboard-shortcuts =
    .label = Комбінації клавіш
    .accesskey = К
menu-help-troubleshooting-info =
    .label = Вирішення проблем
    .accesskey = В
menu-help-feedback-page =
    .label = Надіслати відгук…
    .accesskey = Н
menu-help-safe-mode-without-addons =
    .label = Перезапуск з вимкненими додатками…
    .accesskey = П
menu-help-safe-mode-with-addons =
    .label = Перезапуск з увімкненими додатками
    .accesskey = у
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Повідомити про шахрайський сайт…
    .accesskey = ш
menu-help-not-deceptive =
    .label = Це не шахрайський сайт…
    .accesskey = н
