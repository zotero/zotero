# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = التفضيلات
menu-application-services =
    .label = الخدمات
menu-application-hide-this =
    .label = أخفِ { -brand-shorter-name }
menu-application-hide-other =
    .label = أخفِ الآخرين
menu-application-show-all =
    .label = أظهر الكل
menu-application-touch-bar =
    .label = خصّص شريط اللمس…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] اخرج
           *[other] أغلق
        }
    .accesskey =
        { PLATFORM() ->
            [windows] خ
           *[other] غ
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = أغلق { -brand-shorter-name }
menu-about =
    .label = عن { -brand-shorter-name }
    .accesskey = ع

## File Menu

menu-file =
    .label = ملف
    .accesskey = م
menu-file-new-tab =
    .label = لسان جديد
    .accesskey = ل
menu-file-new-container-tab =
    .label = لسان حاوٍ جديد
    .accesskey = ح
menu-file-new-window =
    .label = نافذة جديدة
    .accesskey = ج
menu-file-new-private-window =
    .label = نافذة خاصة جديدة
    .accesskey = ن
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = افتح مكانًا…
menu-file-open-file =
    .label = افتح ملفًا…
    .accesskey = ف
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] أغلِق اللسان
            [zero] أغلِق اللسان
            [one] أغلِق اللسان
            [two] أغلِق اللسانين
            [few] أغلِق { $tabCount } ألسنة
            [many] أغلِق { $tabCount } لسانًا
           *[other] أغلِق { $tabCount } لسان
        }
    .accesskey = غ
menu-file-close-window =
    .label = أغلق النافذة
    .accesskey = ن
menu-file-save-page =
    .label = احفظ الصفحة باسم…
    .accesskey = س
menu-file-email-link =
    .label = أرسل الرابط بالبريد…
    .accesskey = س
menu-file-share-url =
    .label = شارِك
    .accesskey = ش
menu-file-print-setup =
    .label = إعداد الصفحة…
    .accesskey = ع
menu-file-print =
    .label = اطبع…
    .accesskey = ط
menu-file-import-from-another-browser =
    .label = استورد من متصفح آخر…
    .accesskey = س
menu-file-go-offline =
    .label = اعمل دون اتصال
    .accesskey = ع

## Edit Menu

menu-edit =
    .label = حرّر
    .accesskey = ح
menu-edit-find-in-page =
    .label = ابحث في الصفحة…
    .accesskey = ح
menu-edit-find-again =
    .label = ابحث مجددًا
    .accesskey = ب
menu-edit-bidi-switch-text-direction =
    .label = اعكس اتجاه النص
    .accesskey = ن

## View Menu

menu-view =
    .label = عرض
    .accesskey = ع
menu-view-toolbars-menu =
    .label = أشرطة الأدوات
    .accesskey = ش
menu-view-customize-toolbar2 =
    .label = خصّص شريط الأدوات…
    .accesskey = خ
menu-view-sidebar =
    .label = الشريط الجانبي
    .accesskey = ط
menu-view-bookmarks =
    .label = العلامات
menu-view-history-button =
    .label = التأريخ
menu-view-synced-tabs-sidebar =
    .label = الألسنة المُزامنة
menu-view-full-zoom =
    .label = قرّب
    .accesskey = ر
menu-view-full-zoom-enlarge =
    .label = قرّب
    .accesskey = ق
menu-view-full-zoom-reduce =
    .label = بعّد
    .accesskey = ب
menu-view-full-zoom-actual-size =
    .label = المقاس الفعلي
    .accesskey = ق
menu-view-full-zoom-toggle =
    .label = قرّب النص فقط
    .accesskey = ن
menu-view-page-style-menu =
    .label = طراز الصفحة
    .accesskey = ط
menu-view-page-style-no-style =
    .label = بلا طراز
    .accesskey = ل
menu-view-page-basic-style =
    .label = طراز صفحة بسيط
    .accesskey = ص
menu-view-repair-text-encoding =
    .label = أصلِح ترميز النص
    .accesskey = ت

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = تحول إلى ملء الشاشة
    .accesskey = ش
menu-view-exit-full-screen =
    .label = غادر ملء الشاشة
    .accesskey = ش
menu-view-full-screen =
    .label = ملء الشاشة
    .accesskey = ش

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = ادخل منظور القارئ
    .accesskey = ظ
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = أغلق منظور القارئ
    .accesskey = غ

##

menu-view-show-all-tabs =
    .label = أظهِر كل الألسنة
    .accesskey = ك
menu-view-bidi-switch-page-direction =
    .label = اعكس اتجاه الصفحة
    .accesskey = ك

## History Menu

menu-history =
    .label = التأريخ
    .accesskey = ت
menu-history-show-all-history =
    .label = أظهر كل التأريخ
menu-history-clear-recent-history =
    .label = امسح التأريخ الحالي…
menu-history-synced-tabs =
    .label = الألسنة المُزامنة
menu-history-restore-last-session =
    .label = استعد الجلسة السابقة
menu-history-hidden-tabs =
    .label = الألسنة المخفية
menu-history-undo-menu =
    .label = الألسنة المُغلقة مؤخرًا
menu-history-undo-window-menu =
    .label = النوافذ المغلقة مؤخرًا
menu-history-reopen-all-tabs = أعِد فتح كل الألسنة
menu-history-reopen-all-windows = أعِد فتح كل النوافذ

## Bookmarks Menu

menu-bookmarks-menu =
    .label = علامات
    .accesskey = ع
menu-bookmarks-manage =
    .label = أدِر العلامات
menu-bookmark-current-tab =
    .label = علّم اللسان الحالي
menu-bookmark-edit =
    .label = حرّر هذه العلامة
menu-bookmarks-all-tabs =
    .label = علّم كل الألسنة…
menu-bookmarks-toolbar =
    .label = شريط العلامات
menu-bookmarks-other =
    .label = العلامات الأخرى
menu-bookmarks-mobile =
    .label = علامات المحمول

## Tools Menu

menu-tools =
    .label = أدوات
    .accesskey = د
menu-tools-downloads =
    .label = التنزيلات
    .accesskey = ز
menu-tools-addons-and-themes =
    .label = الإضافات والسمات
    .accesskey = ض
menu-tools-fxa-sign-in2 =
    .label = لِج
    .accesskey = ل
menu-tools-turn-on-sync2 =
    .label = فعّل المزامنة…
    .accesskey = ن
menu-tools-sync-now =
    .label = زامِن الآن
    .accesskey = ز
menu-tools-fxa-re-auth =
    .label = أعِد الاتصال بِ‍ { -brand-product-name }…
    .accesskey = ع
menu-tools-browser-tools =
    .label = أدوات المتصفّح
    .accesskey = ص
menu-tools-task-manager =
    .label = مدير المهام
    .accesskey = م
menu-tools-page-source =
    .label = مصدر الصفحة
    .accesskey = ح
menu-tools-page-info =
    .label = معلومات الصفحة
    .accesskey = م
menu-settings =
    .label = الإعدادات
    .accesskey =
        { PLATFORM() ->
            [windows] ع
           *[other] ع
        }
menu-tools-layout-debugger =
    .label = منقح تخطيط الصفحة
    .accesskey = م

## Window Menu

menu-window-menu =
    .label = نافذة
menu-window-bring-all-to-front =
    .label = اجلب الكل للمقدمة

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = مساعدة
    .accesskey = س
menu-get-help =
    .label = احصل على مُساعدة
    .accesskey = ح
menu-help-more-troubleshooting-info =
    .label = معلومات أكثر عن مواجهة الأعطال
    .accesskey = ط
menu-help-report-site-issue =
    .label = أبلغ عن مشكلة بالموقع…
menu-help-enter-troubleshoot-mode2 =
    .label = وضع مواجهة الأعطال
    .accesskey = ه
menu-help-exit-troubleshoot-mode =
    .label = عطّل وضع مواجهة الأعطال
    .accesskey = ط
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = أبلغ عن موقع مخادع…
    .accesskey = ع
menu-help-not-deceptive =
    .label = هذا ليس موقعًا مخادعًا…
    .accesskey = خ
