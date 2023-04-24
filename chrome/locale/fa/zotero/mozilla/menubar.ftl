# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = ترجیحات
menu-application-services =
    .label = خدمات
menu-application-hide-this =
    .label = پنهان کردن { -brand-shorter-name }
menu-application-hide-other =
    .label = دیگر برنامه‌ها را مخفی کن
menu-application-show-all =
    .label = نشان دادن همه
menu-application-touch-bar =
    .label = سفارشی‌سازی نوار لمسی…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] خروج
           *[other] ترک
        }
    .accesskey =
        { PLATFORM() ->
            [windows] خ
           *[other] ت
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = ترک { -brand-shorter-name }
menu-about =
    .label = دربارهٔ { -brand-shorter-name }
    .accesskey = د

## File Menu

menu-file =
    .label = پرونده‌
    .accesskey = پ
menu-file-new-tab =
    .label = زبانه جدید
    .accesskey = ز
menu-file-new-container-tab =
    .label = زبانه حامل جدید
    .accesskey = ز
menu-file-new-window =
    .label = پنجره جدید‌
    .accesskey = ج
menu-file-new-private-window =
    .label = پنجره ناشناس جدید
    .accesskey = پ
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = بازکردن مکان…
menu-file-open-file =
    .label = بازکردن پرونده…
    .accesskey = ب
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] بستن زبانه
           *[other] بستن { $tabCount } زبانه
        }
    .accesskey = ب
menu-file-close-window =
    .label = بستن پنجره
    .accesskey = پ
menu-file-save-page =
    .label = ذخیرهٔ صفحه به عنوان…
    .accesskey = ع
menu-file-email-link =
    .label = ایمیل کردن پیوند...
    .accesskey = ا
menu-file-share-url =
    .label = اشتراک‌گذاری
    .accesskey = ا
menu-file-print-setup =
    .label = تنظیم صفحه…
    .accesskey = ت
menu-file-print =
    .label = چاپ...
    .accesskey = چ
menu-file-import-from-another-browser =
    .label = وارد کردن از مرورگری دیگر
    .accesskey = و
menu-file-go-offline =
    .label = آفلاین کار کن
    .accesskey = ک

## Edit Menu

menu-edit =
    .label = ویرایش
    .accesskey = و
menu-edit-find-in-page =
    .label = پیدا کردن در صفحه…
    .accesskey = F
menu-edit-find-again =
    .label = پیدا کردن مجدد
    .accesskey = ج
menu-edit-bidi-switch-text-direction =
    .label = تعویض جهت متن
    .accesskey = ض

## View Menu

menu-view =
    .label = نما
    .accesskey = ن
menu-view-toolbars-menu =
    .label = نوار ابزار
    .accesskey = ن
menu-view-customize-toolbar2 =
    .label = سفارشی‌سازی نوار ابزار…
    .accesskey = C
menu-view-sidebar =
    .label = نوار کناری
    .accesskey = ک
menu-view-bookmarks =
    .label = نشانک‌ها
menu-view-history-button =
    .label = تاریخچه
menu-view-synced-tabs-sidebar =
    .label = زبانه‌های همگام شده
menu-view-full-zoom =
    .label = زوم
    .accesskey = ز
menu-view-full-zoom-enlarge =
    .label = بزرگ‌نمایی
    .accesskey = ب
menu-view-full-zoom-reduce =
    .label = کوچک‌نمایی
    .accesskey = ک
menu-view-full-zoom-actual-size =
    .label = اندازه واقعی‌
    .accesskey = ا
menu-view-full-zoom-toggle =
    .label = بزرگ‌نمایی متن
    .accesskey = ب
menu-view-page-style-menu =
    .label = سبک صفحه
    .accesskey = ک
menu-view-page-style-no-style =
    .label = بدون سبک
    .accesskey = ب
menu-view-page-basic-style =
    .label = سبک ابتدایی صفحه
    .accesskey = ب
menu-view-repair-text-encoding =
    .label = تعمیر رمزگذاری متن
    .accesskey = ت

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = ورود به تمام‌صفحه
    .accesskey = ت
menu-view-exit-full-screen =
    .label = خروج از حالت تمام‌صفحه
    .accesskey = ت
menu-view-full-screen =
    .label = تمام‌صفحه
    .accesskey = ت

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = ورود به نمای‌ مطالعه
    .accesskey = R
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = بستن نمای مطالعه
    .accesskey = R

##

menu-view-show-all-tabs =
    .label = نمایش همه زبانه‌ها
    .accesskey = ه
menu-view-bidi-switch-page-direction =
    .label = تعویض جهت صفحه
    .accesskey = ع

## History Menu

menu-history =
    .label = تاریخچه
    .accesskey = ت
menu-history-show-all-history =
    .label = نمایش تمام تاریخچه
menu-history-clear-recent-history =
    .label = پاک کردن تاریخچه صفحه‌های اخیراً بازدید شده…
menu-history-synced-tabs =
    .label = زبانه‌های همگام‌سازی شده
menu-history-restore-last-session =
    .label = بازیابی نشست قبلی
menu-history-hidden-tabs =
    .label = زبانه‌های مخفی
menu-history-undo-menu =
    .label = زبانه‌های تازه بسته شده
menu-history-undo-window-menu =
    .label = پنجره‌های تازه بسته شده
menu-history-reopen-all-tabs = بازآوری همهٔ زبانه‌ها
menu-history-reopen-all-windows = بازآوری همهٔ پنجره‌ها

## Bookmarks Menu

menu-bookmarks-menu =
    .label = نشانک‌ها
    .accesskey = ن
menu-bookmarks-manage =
    .label = مدیریت نشانک‌ها
menu-bookmark-current-tab =
    .label = نشانک‌گذاری زبانهٔ فعلی
menu-bookmark-edit =
    .label = ویرایش این نشانک
menu-bookmark-tab =
    .label = نشانک‌گذاری زبانهٔ کنونی…
menu-edit-bookmark =
    .label = ویرایش این نشانک…
menu-bookmarks-all-tabs =
    .label = نشانک‌گذاری تمامی زبانه‌ها…
menu-bookmarks-toolbar =
    .label = نوار ابزار نشانک‌ها
menu-bookmarks-other =
    .label = نشانک‌‌های دیگر
menu-bookmarks-mobile =
    .label = نشانک‌های همراه

## Tools Menu

menu-tools =
    .label = ابزارها
    .accesskey = ا
menu-tools-downloads =
    .label = بارگیری‌ها
    .accesskey = ب
menu-tools-addons-and-themes =
    .label = افزونه‌ها و تم‌ها
    .accesskey = ا
menu-tools-fxa-sign-in2 =
    .label = وارد شدن
    .accesskey = g
menu-tools-turn-on-sync2 =
    .label = روشن کردن همگام‌سازی…
    .accesskey = ر
menu-tools-sync-now =
    .label = انجام هم‌گام‌سازی
    .accesskey = ه
menu-tools-fxa-re-auth =
    .label = اتصال مجدد به { -brand-product-name }…
    .accesskey = R
menu-tools-browser-tools =
    .label = ابزارهای مرورگر
    .accesskey = ب
menu-tools-task-manager =
    .label = مدیر وظایف
    .accesskey = م
menu-tools-page-source =
    .label = متن صفحه
    .accesskey = م
menu-tools-page-info =
    .label = اطلاعات صفحه
    .accesskey = ا
menu-settings =
    .label = تنظیمات
    .accesskey =
        { PLATFORM() ->
            [windows] s
           *[other] n
        }
menu-tools-layout-debugger =
    .label = اشکال‌زدای چیدمان
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = پنجره
menu-window-bring-all-to-front =
    .label = آوردن همه به جلو

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = راهنما
    .accesskey = H
menu-get-help =
    .label = دریافت کمک
    .accesskey = H
menu-help-more-troubleshooting-info =
    .label = اطلاعات بیشتر
    .accesskey = ب
menu-help-report-site-issue =
    .label = مشکل سایت را گزارش کنید…
menu-help-share-ideas =
    .label = همرسانی ایده‌ها و بازخوردها…
    .accesskey = س
menu-help-enter-troubleshoot-mode2 =
    .label = حالت عیب‌یابی…
    .accesskey = ح
menu-help-exit-troubleshoot-mode =
    .label = خاموش کردن حالت عیب‌یابی
    .accesskey = M
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = گزارشِ سایت گمراه‌کننده…
    .accesskey = گ
menu-help-not-deceptive =
    .label = این یک سایت گمراه‌کننده نیست…
    .accesskey = d
