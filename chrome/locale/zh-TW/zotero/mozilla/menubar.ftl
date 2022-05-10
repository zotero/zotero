# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


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
    .label = 新增隱私視窗
    .accesskey = W
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = 開啟網址…
menu-file-open-file =
    .label = 開啟檔案…
    .accesskey = O
menu-file-close =
    .label = 關閉
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
menu-file-print-setup =
    .label = 頁面設定…
    .accesskey = u
menu-file-print-preview =
    .label = 預覽列印
    .accesskey = v
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
menu-edit-find-on =
    .label = 尋找文字…
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
menu-view-customize-toolbar =
    .label = 自訂…
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
menu-view-charset =
    .label = 文字編碼
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

## Bookmarks Menu

menu-bookmarks-menu =
    .label = 書籤
    .accesskey = B
menu-bookmarks-show-all =
    .label = 顯示所有書籤
menu-bookmark-this-page =
    .label = 將本頁加入書籤
menu-bookmark-edit =
    .label = 編輯此書籤
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
menu-tools-addons =
    .label = 附加元件
    .accesskey = A
menu-tools-fxa-sign-in =
    .label = 登入 { -brand-product-name }…
    .accesskey = g
menu-tools-turn-on-sync =
    .label = 開啟 { -sync-brand-short-name }…
    .accesskey = n
menu-tools-sync-now =
    .label = 立刻同步
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = 重新連線到 { -brand-product-name }…
    .accesskey = R
menu-tools-web-developer =
    .label = 網頁開發者
    .accesskey = W
menu-tools-page-source =
    .label = 頁面原始碼
    .accesskey = o
menu-tools-page-info =
    .label = 頁面資訊
    .accesskey = I
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] 選項
           *[other] 偏好設定
        }
    .accesskey =
        { PLATFORM() ->
            [windows] O
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

menu-help =
    .label = 說明
    .accesskey = H
menu-help-product =
    .label = { -brand-shorter-name } 說明
    .accesskey = H
menu-help-show-tour =
    .label = { -brand-shorter-name } 導覽
    .accesskey = o
menu-help-import-from-another-browser =
    .label = 從另一套瀏覽器匯入…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = 快速鍵
    .accesskey = K
menu-help-troubleshooting-info =
    .label = 疑難排解資訊
    .accesskey = T
menu-help-feedback-page =
    .label = 送出意見回饋…
    .accesskey = S
menu-help-safe-mode-without-addons =
    .label = 重新啟動但停用附加元件…
    .accesskey = R
menu-help-safe-mode-with-addons =
    .label = 重新啟動並啟用附加元件
    .accesskey = R
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = 回報詐騙網站…
    .accesskey = D
menu-help-not-deceptive =
    .label = 這不是詐騙網站…
    .accesskey = d
