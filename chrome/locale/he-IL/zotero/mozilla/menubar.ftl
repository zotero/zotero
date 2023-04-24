# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = העדפות
menu-application-services =
    .label = שירותים
menu-application-hide-this =
    .label = הסתרת { -brand-shorter-name }
menu-application-hide-other =
    .label = הסתרת אחרים
menu-application-show-all =
    .label = הצגת הכל
menu-application-touch-bar =
    .label = התאמה אישית של סרגל המגע…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] יציאה
           *[other] יציאה
        }
    .accesskey =
        { PLATFORM() ->
            [windows] צ
           *[other] צ
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = יציאה מ־{ -brand-shorter-name }
menu-about =
    .label = על אודות { -brand-shorter-name }
    .accesskey = א

## File Menu

menu-file =
    .label = קובץ
    .accesskey = ק
menu-file-new-tab =
    .label = לשונית חדשה
    .accesskey = ש
menu-file-new-container-tab =
    .label = מגירת לשוניות חדשה
    .accesskey = ג
menu-file-new-window =
    .label = חלון חדש
    .accesskey = ח
menu-file-new-private-window =
    .label = חלון פרטי חדש
    .accesskey = פ
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = פתיחת מיקום
menu-file-open-file =
    .label = פתיחת קובץ…
    .accesskey = ק
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] סגירת לשונית
           *[other] סגירת { $tabCount } לשוניות
        }
    .accesskey = ס
menu-file-close-window =
    .label = סגירת חלון
    .accesskey = ס
menu-file-save-page =
    .label = שמירת דף בשם…
    .accesskey = ר
menu-file-email-link =
    .label = שליחת קישור בדוא״ל…
    .accesskey = ד
menu-file-share-url =
    .label = שיתוף
    .accesskey = ש
menu-file-print-setup =
    .label = הגדרת עמוד…
    .accesskey = ה
menu-file-print =
    .label = הדפסה…
    .accesskey = ד
menu-file-import-from-another-browser =
    .label = ייבוא מדפדפן אחר…
    .accesskey = י
menu-file-go-offline =
    .label = עבודה לא־מקוונת
    .accesskey = ל

## Edit Menu

menu-edit =
    .label = עריכה
    .accesskey = ע
menu-edit-find-in-page =
    .label = חיפוש בדף…
    .accesskey = ח
menu-edit-find-again =
    .label = מצא שוב
    .accesskey = ש
menu-edit-bidi-switch-text-direction =
    .label = הפוך כיוון כתיבה
    .accesskey = כ

## View Menu

menu-view =
    .label = תצוגה
    .accesskey = ת
menu-view-toolbars-menu =
    .label = סרגלי כלים
    .accesskey = ם
menu-view-customize-toolbar2 =
    .label = התאמה אישית של סרגל הכלים…
    .accesskey = ה
menu-view-sidebar =
    .label = סרגל צד
    .accesskey = ג
menu-view-bookmarks =
    .label = סימניות
menu-view-history-button =
    .label = היסטוריה
menu-view-synced-tabs-sidebar =
    .label = לשוניות מסונכרנות
menu-view-full-zoom =
    .label = מרחק מתצוגה
    .accesskey = ת
menu-view-full-zoom-enlarge =
    .label = התקרבות
    .accesskey = ק
menu-view-full-zoom-reduce =
    .label = התרחקות
    .accesskey = ר
menu-view-full-zoom-actual-size =
    .label = גודל אמיתי
    .accesskey = ג
menu-view-full-zoom-toggle =
    .label = שינוי גודל טקסט בלבד
    .accesskey = ט
menu-view-page-style-menu =
    .label = סגנון דף
    .accesskey = נ
menu-view-page-style-no-style =
    .label = ללא סגנון
    .accesskey = ל
menu-view-page-basic-style =
    .label = סגנון דף בסיסי
    .accesskey = ס
menu-view-repair-text-encoding =
    .label = תיקון קידוד טקסט
    .accesskey = ק

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = כניסה למסך מלא
    .accesskey = מ
menu-view-exit-full-screen =
    .label = יציאה ממסך מלא
    .accesskey = י
menu-view-full-screen =
    .label = מסך מלא
    .accesskey = ס

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = כניסה לתצוגת קריאה
    .accesskey = ק
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = סגירת תצוגת הקריאה
    .accesskey = ק

##

menu-view-show-all-tabs =
    .label = הצגת כל הלשוניות
    .accesskey = כ
menu-view-bidi-switch-page-direction =
    .label = הפיכת כיוון דף
    .accesskey = פ

## History Menu

menu-history =
    .label = היסטוריה
    .accesskey = ה
menu-history-show-all-history =
    .label = הצגת כל ההיסטוריה
menu-history-clear-recent-history =
    .label = ניקוי היסטוריה אחרונה…
menu-history-synced-tabs =
    .label = לשוניות מסונכרנות
menu-history-restore-last-session =
    .label = שחזור הפעלה קודמת
menu-history-hidden-tabs =
    .label = לשוניות מוסתרות
menu-history-undo-menu =
    .label = לשוניות שנסגרו לאחרונה
menu-history-undo-window-menu =
    .label = חלונות שנסגרו לאחרונה
menu-history-reopen-all-tabs = פתיחת כל הלשוניות מחדש
menu-history-reopen-all-windows = פתיחת כל החלונות מחדש

## Bookmarks Menu

menu-bookmarks-menu =
    .label = סימניות
    .accesskey = ס
menu-bookmarks-manage =
    .label = ניהול סימניות
menu-bookmark-current-tab =
    .label = יצירת סימנייה ללשונית הנוכחית
menu-bookmark-edit =
    .label = עריכת סימנייה זו
menu-bookmark-tab =
    .label = יצירת סימנייה ללשונית הנוכחית…
menu-edit-bookmark =
    .label = עריכת סימנייה זו…
menu-bookmarks-all-tabs =
    .label = יצירת סימנייה לכל הלשוניות…
menu-bookmarks-toolbar =
    .label = סרגל כלים סימניות
menu-bookmarks-other =
    .label = סימניות אחרות
menu-bookmarks-mobile =
    .label = סימניות מהנייד

## Tools Menu

menu-tools =
    .label = כלים
    .accesskey = כ
menu-tools-downloads =
    .label = הורדות
    .accesskey = ד
menu-tools-addons-and-themes =
    .label = תוספות וערכות נושא
    .accesskey = ת
menu-tools-fxa-sign-in2 =
    .label = כניסה
    .accesskey = כ
menu-tools-turn-on-sync2 =
    .label = הפעלת סנכרון
    .accesskey = ס
menu-tools-sync-now =
    .label = סנכרון כעת
    .accesskey = ס
menu-tools-fxa-re-auth =
    .label = התחברות מחדש ל־{ -brand-product-name }…
    .accesskey = ת
menu-tools-browser-tools =
    .label = כלי דפדפן
    .accesskey = כ
menu-tools-task-manager =
    .label = מנהל משימות
    .accesskey = מ
menu-tools-page-source =
    .label = מקור הדף
    .accesskey = ר
menu-tools-page-info =
    .label = מידע על הדף
    .accesskey = מ
menu-settings =
    .label = הגדרות
    .accesskey =
        { PLATFORM() ->
            [windows] ג
           *[other] ג
        }
menu-tools-layout-debugger =
    .label = ניפוי שגיאות פריסה
    .accesskey = פ

## Window Menu

menu-window-menu =
    .label = חלון
menu-window-bring-all-to-front =
    .label = הבא הכול לקדמה

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = עזרה
    .accesskey = ז
menu-get-help =
    .label = קבלת עזרה
    .accesskey = ע
menu-help-more-troubleshooting-info =
    .label = מידע נוסף לפתרון בעיות
    .accesskey = מ
menu-help-report-site-issue =
    .label = דיווח על בעיה באתר…
menu-help-share-ideas =
    .label = שיתוף רעיונות ומשוב…
    .accesskey = ש
menu-help-enter-troubleshoot-mode2 =
    .label = מצב לפתרון בעיות…
    .accesskey = פ
menu-help-exit-troubleshoot-mode =
    .label = כיבוי מצב לפתרון בעיות
    .accesskey = פ
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = דיווח על אתר מטעה…
    .accesskey = ד
menu-help-not-deceptive =
    .label = אתר זה אינו אתר מטעה…
    .accesskey = א
