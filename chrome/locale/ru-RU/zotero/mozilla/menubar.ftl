# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Файл
    .accesskey = Ф
menu-file-new-tab =
    .label = Новая вкладка
    .accesskey = о
menu-file-new-container-tab =
    .label = Новая вкладка в контейнере
    .accesskey = а
menu-file-new-window =
    .label = Новое окно
    .accesskey = Н
menu-file-new-private-window =
    .label = Новое приватное окно
    .accesskey = е
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Открыть адрес…
menu-file-open-file =
    .label = Открыть файл…
    .accesskey = к
menu-file-close =
    .label = Закрыть
    .accesskey = З
menu-file-close-window =
    .label = Закрыть окно
    .accesskey = а
menu-file-save-page =
    .label = Сохранить как…
    .accesskey = х
menu-file-email-link =
    .label = Отправить ссылку по почте…
    .accesskey = п
menu-file-print-setup =
    .label = Параметры страницы…
    .accesskey = м
menu-file-print-preview =
    .label = Предварительный просмотр
    .accesskey = д
menu-file-print =
    .label = Печать…
    .accesskey = ч
menu-file-import-from-another-browser =
    .label = Импорт из другого браузера…
    .accesskey = з
menu-file-go-offline =
    .label = Работать автономно
    .accesskey = б

## Edit Menu

menu-edit =
    .label = Правка
    .accesskey = П
menu-edit-find-on =
    .label = Найти на этой странице…
    .accesskey = Н
menu-edit-find-again =
    .label = Найти ещё раз
    .accesskey = й
menu-edit-bidi-switch-text-direction =
    .label = Переключить направление текста на странице
    .accesskey = т

## View Menu

menu-view =
    .label = Вид
    .accesskey = В
menu-view-toolbars-menu =
    .label = Панели инструментов
    .accesskey = П
menu-view-customize-toolbar =
    .label = Персонализация…
    .accesskey = о
menu-view-sidebar =
    .label = Боковая панель
    .accesskey = Б
menu-view-bookmarks =
    .label = Закладки
menu-view-history-button =
    .label = Журнал
menu-view-synced-tabs-sidebar =
    .label = Облачные вкладки
menu-view-full-zoom =
    .label = Масштаб
    .accesskey = ш
menu-view-full-zoom-enlarge =
    .label = Увеличить
    .accesskey = в
menu-view-full-zoom-reduce =
    .label = Уменьшить
    .accesskey = м
menu-view-full-zoom-actual-size =
    .label = Исходный размер
    .accesskey = х
menu-view-full-zoom-toggle =
    .label = Только текст
    .accesskey = т
menu-view-page-style-menu =
    .label = Стиль страницы
    .accesskey = и
menu-view-page-style-no-style =
    .label = Без стиля
    .accesskey = е
menu-view-page-basic-style =
    .label = Основной стиль страницы
    .accesskey = О
menu-view-charset =
    .label = Кодировка текста
    .accesskey = о

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Перейти в полноэкранный режим
    .accesskey = о
menu-view-exit-full-screen =
    .label = Выйти из полноэкранного режима
    .accesskey = о
menu-view-full-screen =
    .label = Полный экран
    .accesskey = э

##

menu-view-show-all-tabs =
    .label = Показать все вкладки
    .accesskey = в
menu-view-bidi-switch-page-direction =
    .label = Переключить направление текста на странице
    .accesskey = н

## History Menu

menu-history =
    .label = Журнал
    .accesskey = Ж
menu-history-show-all-history =
    .label = Показать весь журнал
menu-history-clear-recent-history =
    .label = Удалить недавнюю историю…
menu-history-synced-tabs =
    .label = Облачные вкладки
menu-history-restore-last-session =
    .label = Восстановить предыдущую сессию
menu-history-hidden-tabs =
    .label = Скрытые вкладки
menu-history-undo-menu =
    .label = Недавно закрытые вкладки
menu-history-undo-window-menu =
    .label = Недавно закрытые окна

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Закладки
    .accesskey = З
menu-bookmarks-show-all =
    .label = Показать все закладки
menu-bookmark-this-page =
    .label = Добавить страницу
menu-bookmark-edit =
    .label = Редактировать эту закладку
menu-bookmarks-all-tabs =
    .label = Добавить все вкладки…
menu-bookmarks-toolbar =
    .label = Панель закладок
menu-bookmarks-other =
    .label = Другие закладки
menu-bookmarks-mobile =
    .label = Мобильные закладки

## Tools Menu

menu-tools =
    .label = Инструменты
    .accesskey = И
menu-tools-downloads =
    .label = Загрузки
    .accesskey = З
menu-tools-addons =
    .label = Дополнения
    .accesskey = Д
menu-tools-fxa-sign-in =
    .label = Войти в { -brand-product-name }…
    .accesskey = й
menu-tools-turn-on-sync =
    .label = Включить { -sync-brand-short-name(case: "accusative") }…
    .accesskey = ю
menu-tools-sync-now =
    .label = Синхронизировать
    .accesskey = х
menu-tools-fxa-re-auth =
    .label = Переприсоединиться к { -brand-product-name }…
    .accesskey = п
menu-tools-web-developer =
    .label = Веб-разработка
    .accesskey = б
menu-tools-page-source =
    .label = Исходный код страницы
    .accesskey = х
menu-tools-page-info =
    .label = Информация о странице
    .accesskey = ф
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
    .label = Отладчик макета
    .accesskey = л

## Window Menu

menu-window-menu =
    .label = Окно
menu-window-bring-all-to-front =
    .label = Все окна — на передний план

## Help Menu

menu-help =
    .label = Справка
    .accesskey = С
menu-help-product =
    .label = Справка { -brand-shorter-name }
    .accesskey = к
menu-help-show-tour =
    .label = Знакомство с { -brand-shorter-name }
    .accesskey = м
menu-help-import-from-another-browser =
    .label = Импорт из другого браузера…
    .accesskey = п
menu-help-keyboard-shortcuts =
    .label = Сочетания клавиш
    .accesskey = ч
menu-help-troubleshooting-info =
    .label = Информация для решения проблем
    .accesskey = а
menu-help-feedback-page =
    .label = Отправить отзыв…
    .accesskey = т
menu-help-safe-mode-without-addons =
    .label = Перезапустить без дополнений…
    .accesskey = е
menu-help-safe-mode-with-addons =
    .label = Перезапустить с дополнениями
    .accesskey = е
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Сообщить о поддельном сайте…
    .accesskey = о
menu-help-not-deceptive =
    .label = Это не поддельный сайт…
    .accesskey = е
