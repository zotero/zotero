# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-services =
    .label = សេវាកម្ម
menu-application-hide-this =
    .label = លាក់ { -brand-shorter-name }
menu-application-hide-other =
    .label = លាក់​ផ្សេងទៀត
menu-application-show-all =
    .label = បង្ហាញ​ទាំងអស់

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] ចេញ
           *[other] ចេញ
        }
    .accesskey =
        { PLATFORM() ->
            [windows] x
           *[other] Q
        }

# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = បិទ { -brand-shorter-name }

menu-about =
    .label = អំពី { -brand-shorter-name }
    .accesskey = A

## File Menu

menu-file =
    .label = ឯកសារ
    .accesskey = F
menu-file-new-tab =
    .label = ផ្ទាំង​ថ្មី
    .accesskey = T
menu-file-new-container-tab =
    .label = ផ្ទាំង​ឧបករណ៍​ផ្ទុក​ថ្មី
    .accesskey = B
menu-file-new-window =
    .label = បង្អួច​​​ថ្មី
    .accesskey = N
menu-file-new-private-window =
    .label = បង្អួច​ឯកជន​ថ្មី
    .accesskey = W
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = បើក​ទីតាំង…
menu-file-open-file =
    .label = បើក​ឯកសារ…
    .accesskey = O
menu-file-close-window =
    .label = បិទបង្អួច
    .accesskey = d
menu-file-save-page =
    .label = រក្សា​ទុក​ទំព័រជា...
    .accesskey = A
menu-file-email-link =
    .label = តំណ​អ៊ីមែល…
    .accesskey = E
menu-file-print-setup =
    .label = ការ​រៀបចំ​ទំព័រ…
    .accesskey = u
menu-file-print =
    .label = បោះពុម្ព…
    .accesskey = P
menu-file-go-offline =
    .label = ធ្វើ​ការដោយ​គ្មាន​អ៊ីនធឺណិត
    .accesskey = k

## Edit Menu

menu-edit =
    .label = កែសម្រួល
    .accesskey = E
menu-edit-find-again =
    .label = រក​ម្ដងទៀត
    .accesskey = g
menu-edit-bidi-switch-text-direction =
    .label = ប្ដូរ​​ទិស​អត្ថបទ
    .accesskey = w

## View Menu

menu-view =
    .label = មើល
    .accesskey = V
menu-view-toolbars-menu =
    .label = របារ​ឧបករណ៍
    .accesskey = T
menu-view-sidebar =
    .label = របារ​ចំហៀង
    .accesskey = e
menu-view-bookmarks =
    .label = ចំណាំ
menu-view-history-button =
    .label = ប្រវត្តិ
menu-view-synced-tabs-sidebar =
    .label = ផ្ទាំង​ដែល​បាន​ធ្វើ​សមកាលកម្ម
menu-view-full-zoom =
    .label = ពង្រីក
    .accesskey = Z
menu-view-full-zoom-enlarge =
    .label = ​ពង្រីក
    .accesskey = I
menu-view-full-zoom-reduce =
    .label = ​បង្រួម
    .accesskey = O
menu-view-full-zoom-toggle =
    .label = ពង្រីក​តែអត្ថបទ​ប៉ុណ្ណោះ
    .accesskey = T
menu-view-page-style-menu =
    .label = រចនាប័ទ្ម​ទំព័រ
    .accesskey = y
menu-view-page-style-no-style =
    .label = គ្មាន​រចនាប័ទ្ម
    .accesskey = n
menu-view-page-basic-style =
    .label = រចនាប័ទ្ម​ទំព័រ​មូលដ្ឋាន
    .accesskey = b

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = ចូល​អេក្រង់​ពេញ
    .accesskey = F
menu-view-exit-full-screen =
    .label = បិទ​អេក្រង់​ពេញ
    .accesskey = F
menu-view-full-screen =
    .label = អេក្រង់​ពេញ
    .accesskey = F

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = ចូល​របៀប​អ្នក​អាន
    .accesskey = អ
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = បិទ​ទិដ្ឋភាព​អ្នក​អាន​
    .accesskey = អ

##

menu-view-show-all-tabs =
    .label = បង្ហាញ​ផ្ទាំង​ទាំងអស់
    .accesskey = A
menu-view-bidi-switch-page-direction =
    .label = ប្ដូរទិស​ទំព័រ
    .accesskey = D

## History Menu

menu-history =
    .label = ប្រវត្តិ
    .accesskey = s
menu-history-show-all-history =
    .label = បង្ហាញ​ប្រវត្តិ​ទាំងអស់
menu-history-clear-recent-history =
    .label = សម្អាត​ប្រវត្តិ​ថ្មីៗ…
menu-history-synced-tabs =
    .label = ផ្ទាំង​ដែល​បាន​ធ្វើ​សមកាលកម្ម
menu-history-restore-last-session =
    .label = ស្ដារ​សម័យ​មុន
menu-history-hidden-tabs =
    .label = ផ្ទាំងដែលលាក់
menu-history-undo-menu =
    .label = ផ្ទាំង​ដែល​បិទ​ថ្មីៗ
menu-history-undo-window-menu =
    .label = បង្អួច​ដែល​បាន​បិទ​ថ្មីៗ

## Bookmarks Menu

menu-bookmarks-menu =
    .label = ចំណាំ
    .accesskey = B
menu-bookmarks-all-tabs =
    .label = ចំណាំ​ផ្ទាំង​ទាំងអស់…
menu-bookmarks-toolbar =
    .label = របារ​ឧបករណ៍​ចំណាំ
menu-bookmarks-other =
    .label = ចំណាំ​ផ្សេង​ៗ​ទៀត
menu-bookmarks-mobile =
    .label = ចំណាំ​ចល័ត

## Tools Menu

menu-tools =
    .label = ឧបករណ៍
    .accesskey = T
menu-tools-downloads =
    .label = ទាញ​យក
    .accesskey = D
menu-tools-sync-now =
    .label = ធ្វើ​សមកាលកម្ម​ឥឡូវ
    .accesskey = S
menu-tools-page-source =
    .label = ប្រភព​ទំព័រ
    .accesskey = o
menu-tools-page-info =
    .label = ព័ត៌មាន​ទំព័រ
    .accesskey = I
menu-tools-layout-debugger =
    .label = កម្មវិធីបំបាត់កំហុសប្លង់
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = បង្អួច
menu-window-bring-all-to-front =
    .label = នាំទៅ​មុខ​ទាំងអស់

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = ជំនួយ
    .accesskey = H
menu-help-report-site-issue =
    .label = រាយការណ៍​បញ្ហា​គេហទំព័រ…
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = រាយការណ៍​អំពី​វេបសាយ​បញ្ឆោត…
    .accesskey = D
menu-help-not-deceptive =
    .label = នេះ​មិនមែន​ជា​វេបសាយ​បញ្ឆោត​ទេ…
    .accesskey = d
