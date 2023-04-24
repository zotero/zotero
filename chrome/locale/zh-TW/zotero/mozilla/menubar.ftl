# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = 偏好設定
menu-application-services =
    .label = 服務
menu-application-hide-this =
    .label = 隱藏 { -brand-shorter-name }
menu-application-hide-other =
    .label = 隱藏其他視窗
menu-application-show-all =
    .label = 全部顯示
menu-application-touch-bar =
    .label = 自訂觸控列…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] 結束
           *[other] 離開
        }
    .accesskey =
        { PLATFORM() ->
            [windows] x
           *[other] Q
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = 離開 { -brand-shorter-name }
menu-about =
    .label = 關於 { -brand-shorter-name }
    .accesskey = A

## File Menu

menu-file =
    .label = 檔案
    .accesskey = F
menu-file-new-tab =
    .label = 開新分頁
    .accesskey = T
menu-file-new-container-tab =
    .label = 新增容器分頁
    .accesskey = B
menu-file-new-window =
    .label = 開新視窗
    .accesskey = N
menu-file-new-private-window =
    .label = 開新隱私視窗
    .accesskey = W
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = 開啟網址…
menu-file-open-file =
    .label = 開啟檔案…
    .accesskey = O
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] 關閉分頁
           *[other] 關閉 { $tabCount } 個分頁
        }
    .accesskey = C
menu-file-close-window =
    .label = 關閉視窗
    .accesskey = d
menu-file-save-page =
    .label = 另存新檔…
    .accesskey = A
menu-file-email-link =
    .label = 郵寄鏈結…
    .accesskey = E
menu-file-share-url =
    .label = 分享
    .accesskey = h
menu-file-print-setup =
    .label = 頁面設定…
    .accesskey = u
menu-file-print =
    .label = 列印…
    .accesskey = P
menu-file-import-from-another-browser =
    .label = 從另一套瀏覽器匯入…
    .accesskey = I
menu-file-go-offline =
    .label = 離線模式
    .accesskey = k

## Edit Menu

menu-edit =
    .label = 編輯
    .accesskey = E
menu-edit-find-in-page =
    .label = 在頁面中搜尋…
    .accesskey = F
menu-edit-find-again =
    .label = 找下一個
    .accesskey = g
menu-edit-bidi-switch-text-direction =
    .label = 改變文字方向
    .accesskey = w

## View Menu

menu-view =
    .label = 檢視
    .accesskey = V
menu-view-toolbars-menu =
    .label = 工具列
    .accesskey = T
menu-view-customize-toolbar2 =
    .label = 自訂工具列…
    .accesskey = C
menu-view-sidebar =
    .label = 側邊欄
    .accesskey = e
menu-view-bookmarks =
    .label = 書籤
menu-view-history-button =
    .label = 歷史
menu-view-synced-tabs-sidebar =
    .label = 同步的分頁
menu-view-full-zoom =
    .label = 縮放
    .accesskey = Z
menu-view-full-zoom-enlarge =
    .label = 放大
    .accesskey = I
menu-view-full-zoom-reduce =
    .label = 縮小
    .accesskey = o
menu-view-full-zoom-actual-size =
    .label = 實際大小
    .accesskey = A
menu-view-full-zoom-toggle =
    .label = 只縮放文字
    .accesskey = T
menu-view-page-style-menu =
    .label = 頁面樣式
    .accesskey = y
menu-view-page-style-no-style =
    .label = 無樣式
    .accesskey = n
menu-view-page-basic-style =
    .label = 基本頁面樣式
    .accesskey = b
menu-view-repair-text-encoding =
    .label = 修復文字編碼
    .accesskey = c

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = 進入全螢幕模式
    .accesskey = F
menu-view-exit-full-screen =
    .label = 離開全螢幕模式
    .accesskey = F
menu-view-full-screen =
    .label = 全螢幕
    .accesskey = F

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = 進入閱讀模式
    .accesskey = R
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = 關閉閱讀模式
    .accesskey = R

##

menu-view-show-all-tabs =
    .label = 顯示所有分頁
    .accesskey = A
menu-view-bidi-switch-page-direction =
    .label = 切換頁面方向
    .accesskey = D

## History Menu

menu-history =
    .label = 歷史
    .accesskey = s
menu-history-show-all-history =
    .label = 顯示所有瀏覽記錄
menu-history-clear-recent-history =
    .label = 清除最近的歷史記錄…
menu-history-synced-tabs =
    .label = 同步的分頁
menu-history-restore-last-session =
    .label = 回復先前的瀏覽狀態
menu-history-hidden-tabs =
    .label = 隱藏分頁
menu-history-undo-menu =
    .label = 最近關閉的分頁
menu-history-undo-window-menu =
    .label = 最近關閉的視窗
menu-history-reopen-all-tabs = 回復所有分頁
menu-history-reopen-all-windows = 回復所有視窗

## Bookmarks Menu

menu-bookmarks-menu =
    .label = 書籤
    .accesskey = B
menu-bookmarks-manage =
    .label = 管理書籤
menu-bookmark-current-tab =
    .label = 將目前分頁加入書籤
menu-bookmark-edit =
    .label = 編輯此書籤
menu-bookmark-tab =
    .label = 將目前分頁加入書籤…
menu-edit-bookmark =
    .label = 編輯此書籤…
menu-bookmarks-all-tabs =
    .label = 將所有分頁加入書籤…
menu-bookmarks-toolbar =
    .label = 書籤工具列
menu-bookmarks-other =
    .label = 其他書籤
menu-bookmarks-mobile =
    .label = 行動書籤

## Tools Menu

menu-tools =
    .label = 工具
    .accesskey = T
menu-tools-downloads =
    .label = 下載
    .accesskey = D
menu-tools-addons-and-themes =
    .label = 附加元件與佈景主題
    .accesskey = A
menu-tools-fxa-sign-in2 =
    .label = 登入
    .accesskey = g
menu-tools-turn-on-sync2 =
    .label = 開啟同步…
    .accesskey = n
menu-tools-sync-now =
    .label = 立刻同步
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = 重新連線到 { -brand-product-name }…
    .accesskey = R
menu-tools-browser-tools =
    .label = 瀏覽器工具
    .accesskey = B
menu-tools-task-manager =
    .label = 工作管理員
    .accesskey = M
menu-tools-page-source =
    .label = 頁面原始碼
    .accesskey = o
menu-tools-page-info =
    .label = 頁面資訊
    .accesskey = I
menu-settings =
    .label = 設定
    .accesskey =
        { PLATFORM() ->
            [windows] S
           *[other] n
        }
menu-tools-layout-debugger =
    .label = 版面除錯器
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = 視窗
menu-window-bring-all-to-front =
    .label = 將此程式所有視窗移至最前

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = 說明
    .accesskey = H
menu-get-help =
    .label = 取得幫助
    .accesskey = H
menu-help-more-troubleshooting-info =
    .label = 更多疑難排解資訊
    .accesskey = T
menu-help-report-site-issue =
    .label = 回報網站問題…
menu-help-share-ideas =
    .label = 分享想法與意見回饋…
    .accesskey = S
menu-help-enter-troubleshoot-mode2 =
    .label = 疑難排解模式…
    .accesskey = M
menu-help-exit-troubleshoot-mode =
    .label = 關閉疑難排解模式
    .accesskey = M
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = 回報詐騙網站…
    .accesskey = D
menu-help-not-deceptive =
    .label = 這不是詐騙網站…
    .accesskey = d
