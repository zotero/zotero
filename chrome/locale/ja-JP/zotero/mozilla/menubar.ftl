# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = 設定
menu-application-services =
    .label = サービス
menu-application-hide-this =
    .label = { -brand-shorter-name } を隠す
menu-application-hide-other =
    .label = ほかを隠す
menu-application-show-all =
    .label = すべてを表示
menu-application-touch-bar =
    .label = タッチバーをカスタマイズ...

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] 終了
           *[other] 終了
        }
    .accesskey =
        { PLATFORM() ->
            [windows] x
           *[other] Q
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = { -brand-shorter-name } を終了
menu-about =
    .label = { -brand-shorter-name } について
    .accesskey = A

## File Menu

menu-file =
    .label = ファイル
    .accesskey = F
menu-file-new-tab =
    .label = 新しいタブ
    .accesskey = T
menu-file-new-container-tab =
    .label = 新しいコンテナータブ
    .accesskey = B
menu-file-new-window =
    .label = 新しいウィンドウ
    .accesskey = N
menu-file-new-private-window =
    .label = 新しいプライベートウィンドウ
    .accesskey = W
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = URL を開く...
menu-file-open-file =
    .label = ファイルを開く...
    .accesskey = O
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] タブを閉じる
           *[other] { $tabCount } 個のタブを閉じる
        }
    .accesskey = C
menu-file-close-window =
    .label = ウィンドウを閉じる
    .accesskey = d
menu-file-save-page =
    .label = 名前を付けてページを保存...
    .accesskey = A
menu-file-email-link =
    .label = ページの URL をメールで送信...
    .accesskey = E
menu-file-share-url =
    .label = 共有
    .accesskey = h
menu-file-print-setup =
    .label = ページ設定...
    .accesskey = u
menu-file-print =
    .label = 印刷...
    .accesskey = P
menu-file-import-from-another-browser =
    .label = 他のブラウザーからインポート...
    .accesskey = I
menu-file-go-offline =
    .label = オフライン作業
    .accesskey = k

## Edit Menu

menu-edit =
    .label = 編集
    .accesskey = E
menu-edit-find-in-page =
    .label = ページを検索...
    .accesskey = F
menu-edit-find-again =
    .label = 次を検索
    .accesskey = g
menu-edit-bidi-switch-text-direction =
    .label = テキストの記述方向を切り替える
    .accesskey = w

## View Menu

menu-view =
    .label = 表示
    .accesskey = V
menu-view-toolbars-menu =
    .label = ツールバー
    .accesskey = T
menu-view-customize-toolbar2 =
    .label = ツールバーをカスタマイズ...
    .accesskey = C
menu-view-sidebar =
    .label = サイドバー
    .accesskey = e
menu-view-bookmarks =
    .label = ブックマーク
menu-view-history-button =
    .label = 履歴
menu-view-synced-tabs-sidebar =
    .label = 同期タブ
menu-view-full-zoom =
    .label = ズーム
    .accesskey = Z
menu-view-full-zoom-enlarge =
    .label = 拡大
    .accesskey = I
menu-view-full-zoom-reduce =
    .label = 縮小
    .accesskey = O
menu-view-full-zoom-actual-size =
    .label = 等倍
    .accesskey = A
menu-view-full-zoom-toggle =
    .label = 文字サイズのみ変更
    .accesskey = T
menu-view-page-style-menu =
    .label = スタイルシート
    .accesskey = y
menu-view-page-style-no-style =
    .label = スタイルシートを使用しない
    .accesskey = n
menu-view-page-basic-style =
    .label = 標準スタイルシート
    .accesskey = b
menu-view-repair-text-encoding =
    .label = テキストエンコーディングを修復
    .accesskey = c

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = 全画面表示にする
    .accesskey = F
menu-view-exit-full-screen =
    .label = 全画面表示から戻る
    .accesskey = F
menu-view-full-screen =
    .label = 全画面表示
    .accesskey = F

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = リーダービューで開く
    .accesskey = R
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = リーダービューを閉じる
    .accesskey = R

##

menu-view-show-all-tabs =
    .label = すべてのタブを表示
    .accesskey = A
menu-view-bidi-switch-page-direction =
    .label = ページの記述方向を切り替える
    .accesskey = D

## History Menu

menu-history =
    .label = 履歴
    .accesskey = s
menu-history-show-all-history =
    .label = すべての履歴を表示
menu-history-clear-recent-history =
    .label = 最近の履歴を消去
menu-history-synced-tabs =
    .label = 同期タブ
menu-history-restore-last-session =
    .label = 以前のセッションを復元
menu-history-hidden-tabs =
    .label = 隠しタブ
menu-history-undo-menu =
    .label = 最近閉じたタブ
menu-history-undo-window-menu =
    .label = 最近閉じたウィンドウ
menu-history-reopen-all-tabs = タブをすべて開きなおす
menu-history-reopen-all-windows = ウィンドウをすべて開きなおす

## Bookmarks Menu

menu-bookmarks-menu =
    .label = ブックマーク
    .accesskey = B
menu-bookmarks-manage =
    .label = ブックマークを管理
menu-bookmark-current-tab =
    .label = 現在のタブをブックマーク
menu-bookmark-edit =
    .label = このブックマークを編集
menu-bookmark-tab =
    .label = 現在のタブをブックマーク...
menu-edit-bookmark =
    .label = このブックマークを編集...
menu-bookmarks-all-tabs =
    .label = すべてのタブをブックマーク...
menu-bookmarks-toolbar =
    .label = ブックマークツールバー
menu-bookmarks-other =
    .label = 他のブックマーク
menu-bookmarks-mobile =
    .label = モバイルのブックマーク

## Tools Menu

menu-tools =
    .label = ツール
    .accesskey = T
menu-tools-downloads =
    .label = ダウンロード
    .accesskey = D
menu-tools-addons-and-themes =
    .label = アドオンとテーマ
    .accesskey = A
menu-tools-fxa-sign-in2 =
    .label = ログイン
    .accesskey = g
menu-tools-turn-on-sync2 =
    .label = 同期をオンにする...
    .accesskey = n
menu-tools-sync-now =
    .label = 今すぐ同期
    .accesskey = o
menu-tools-fxa-re-auth =
    .label = { -brand-product-name } にログイン...
    .accesskey = R
menu-tools-browser-tools =
    .label = ブラウザーツール
    .accesskey = B
menu-tools-task-manager =
    .label = タスクマネージャー
    .accesskey = M
menu-tools-page-source =
    .label = ページのソース
    .accesskey = o
menu-tools-page-info =
    .label = ページの情報
    .accesskey = I
menu-settings =
    .label = 設定
    .accesskey =
        { PLATFORM() ->
            [windows] S
           *[other] n
        }
menu-tools-layout-debugger =
    .label = レイアウトデバッガー
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = ウィンドウ
menu-window-bring-all-to-front =
    .label = すべてを前面に移動

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = ヘルプ
    .accesskey = H
menu-get-help =
    .label = ヘルプを表示
    .accesskey = H
menu-help-more-troubleshooting-info =
    .label = 他のトラブルシューティング情報
    .accesskey = T
menu-help-report-site-issue =
    .label = サイトの問題を報告...
menu-help-share-ideas =
    .label = 意見とフィードバックを共有...
    .accesskey = S
menu-help-enter-troubleshoot-mode2 =
    .label = トラブルシューティングモード...
    .accesskey = M
menu-help-exit-troubleshoot-mode =
    .label = トラブルシューティングモードをオフにする
    .accesskey = M
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = 詐欺サイトを報告...
    .accesskey = D
menu-help-not-deceptive =
    .label = 詐欺サイトの誤報告を指摘...
    .accesskey = d
