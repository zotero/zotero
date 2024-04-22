# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-services =
    .label = சேவைகள்
menu-application-hide-this =
    .label = { -brand-shorter-name } மறை
menu-application-hide-other =
    .label = மற்றவற்றை மறை
menu-application-show-all =
    .label = அனைத்தையும் காட்டு

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] வெளியேறு
           *[other] வெளியேறு
        }
    .accesskey =
        { PLATFORM() ->
            [windows] x
           *[other] Q
        }

# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = { -brand-shorter-name } விட்டு வெளியேறு

menu-about =
    .label = { -brand-shorter-name } பற்றி
    .accesskey = A

## File Menu

menu-file =
    .label = கோப்பு
    .accesskey = F
menu-file-new-tab =
    .label = புதிய கீற்று
    .accesskey = T
menu-file-new-container-tab =
    .label = புதிய கொள்கலன் கீற்று
    .accesskey = b
menu-file-new-window =
    .label = புதிய சாளரம்
    .accesskey = N
menu-file-new-private-window =
    .label = புதிய கமுக்க சாளரம்
    .accesskey = W
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = இடத்தைத் திற…
menu-file-open-file =
    .label = கோப்பினைத் திற
    .accesskey = O
menu-file-close-window =
    .label = சாளரத்தை மூடுக
    .accesskey = d
menu-file-save-page =
    .label = இவ்வாறு சேமி…
    .accesskey = A
menu-file-email-link =
    .label = மின்னஞ்சல் இணைப்பு ...
    .accesskey = ம
menu-file-print-setup =
    .label = பக்க அமைவு…
    .accesskey = u
menu-file-print =
    .label = அச்சிடு…
    .accesskey = P
menu-file-go-offline =
    .label = முடக்க நிலை
    .accesskey = k

## Edit Menu

menu-edit =
    .label = தொகு
    .accesskey = E
menu-edit-find-again =
    .label = மீண்டும் தேடு
    .accesskey = g
menu-edit-bidi-switch-text-direction =
    .label = உரைத் திசையை மாற்று
    .accesskey = w

## View Menu

menu-view =
    .label = பார்வை
    .accesskey = V
menu-view-toolbars-menu =
    .label = கருவிப்பட்டைகள்
    .accesskey = T
menu-view-sidebar =
    .label = பக்கப்பட்டை
    .accesskey = e
menu-view-bookmarks =
    .label = புத்தகக்குறிகள்
menu-view-history-button =
    .label = வரலாறு
menu-view-synced-tabs-sidebar =
    .label = ஒத்திசைத்த கீற்றுகள்
menu-view-full-zoom =
    .label = பெரியதாக்கு
    .accesskey = ப
menu-view-full-zoom-enlarge =
    .label = பெரிதாக்கு
    .accesskey = I
menu-view-full-zoom-reduce =
    .label = சிறிதாக்கு
    .accesskey = ச
menu-view-full-zoom-toggle =
    .label = உரையை மட்டும் அளவிடு
    .accesskey = உ
menu-view-page-style-menu =
    .label = பக்கப் பாணி
    .accesskey = y
menu-view-page-style-no-style =
    .label = பாணி இல்லை
    .accesskey = N
menu-view-page-basic-style =
    .label = அடிப்படை பக்கப் பாணி
    .accesskey = B

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = முழுத்திரைக்குச் செல்
    .accesskey = F
menu-view-exit-full-screen =
    .label = முழுத்திரையிலிருந்து வெளியேறு
    .accesskey = F
menu-view-full-screen =
    .label = முழுத்திரை
    .accesskey = F

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = வாசிக்கும் முறைக்கு மாறவும்
    .accesskey = R
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = வாசிப்பு தோற்றத்தை மூடு
    .accesskey = R

##

menu-view-show-all-tabs =
    .label = அனைத்து கீற்றுகளையும் காட்டு
    .accesskey = A
menu-view-bidi-switch-page-direction =
    .label = பக்கத் திசையை மாற்று
    .accesskey = D

## History Menu

menu-history =
    .label = வரலாறு
    .accesskey = s
menu-history-show-all-history =
    .label = அனைத்தையும் காண்பி
menu-history-clear-recent-history =
    .label = வரலாற்றைத் துடை...
menu-history-synced-tabs =
    .label = ஒத்திசைத்த கீற்றுகள்
menu-history-restore-last-session =
    .label = முந்தைய அமர்வுக்கு மீட்டமை
menu-history-hidden-tabs =
    .label = மறைக்கப்பட்ட கீற்றுகள்
menu-history-undo-menu =
    .label = சமீபத்தில் மூடப்பட்ட கீற்றுகள்
menu-history-undo-window-menu =
    .label = சமீபத்தில் மூடப்பட்ட சாளரங்கள்

## Bookmarks Menu

menu-bookmarks-menu =
    .label = புத்தகக்குறிகள்
    .accesskey = B
menu-bookmarks-all-tabs =
    .label = கீற்றுகளை புத்தகக்குறியிடு…
menu-bookmarks-toolbar =
    .label = புத்தகக்குறி கருவிப்பட்டை
menu-bookmarks-other =
    .label = இதர புத்தகக்குறிகள்
menu-bookmarks-mobile =
    .label = கைபேசி புத்தகக்குறிகள்

## Tools Menu

menu-tools =
    .label = கருவிகள்
    .accesskey = T
menu-tools-downloads =
    .label = பதிவிறக்கங்கள்
    .accesskey = D
menu-tools-sync-now =
    .label = இப்போது ஒத்திசை
    .accesskey = S
menu-tools-page-source =
    .label = பக்க மூலம்
    .accesskey = o
menu-tools-page-info =
    .label = பக்க தகவல்
    .accesskey = I
menu-tools-layout-debugger =
    .label = வடிவமைப்பு வழுநீக்கி
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = சாளரம்
menu-window-bring-all-to-front =
    .label = அனைத்தையும் முன்னால் கொண்டுவா

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = உதவி
    .accesskey = H
menu-help-report-site-issue =
    .label = தள சிக்கலை தெரிவி…
# Label of the Help menu item. Either this or
# safeb.palm.notdeceptive.label from
# phishing-afterload-warning-message.dtd is shown.
menu-help-report-deceptive-site =
    .label = ஏமாற்று தளத்தைப் புகார் செய்…
    .accesskey = d
menu-help-not-deceptive =
    .label = இது ஓர் ஏமாற்று தளம் அல்ல
    .accesskey = d
