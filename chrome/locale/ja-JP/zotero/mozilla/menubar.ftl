# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

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
menu-file-close =
    .label = 閉じる
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
menu-file-print-setup =
    .label = ページ設定...
    .accesskey = u
menu-file-print-preview =
    .label = 印刷プレビュー
    .accesskey = v
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
menu-edit-find-on =
    .label = このページを検索...
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
menu-view-customize-toolbar =
    .label = カスタマイズ...
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
menu-view-charset =
    .label = テキストエンコーディング
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

## Bookmarks Menu

menu-bookmarks-menu =
    .label = ブックマーク
    .accesskey = B
menu-bookmarks-show-all =
    .label = すべてのブックマークを表示
menu-bookmark-this-page =
    .label = このページをブックマーク
menu-bookmark-edit =
    .label = このブックマークを編集
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
menu-tools-addons =
    .label = アドオン
    .accesskey = A
menu-tools-fxa-sign-in =
    .label = { -brand-product-name } にログイン...
    .accesskey = g
menu-tools-turn-on-sync =
    .label = { -sync-brand-short-name } をオンにする...
    .accesskey = n
menu-tools-sync-now =
    .label = 今すぐ同期
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = { -brand-product-name } にログイン...
    .accesskey = R
menu-tools-web-developer =
    .label = ウェブ開発
    .accesskey = W
menu-tools-page-source =
    .label = ページのソース
    .accesskey = o
menu-tools-page-info =
    .label = ページの情報
    .accesskey = I
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] オプション
           *[other] 設定
        }
    .accesskey =
        { PLATFORM() ->
            [windows] O
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

menu-help =
    .label = ヘルプ
    .accesskey = H
menu-help-product =
    .label = { -brand-shorter-name } ヘルプ
    .accesskey = H
menu-help-show-tour =
    .label = { -brand-shorter-name } ツアー
    .accesskey = o
menu-help-import-from-another-browser =
    .label = 他のブラウザーからインポート...
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = キーボードショートカット
    .accesskey = K
menu-help-troubleshooting-info =
    .label = トラブルシューティング情報...
    .accesskey = T
menu-help-feedback-page =
    .label = フィードバックを送信...
    .accesskey = S
menu-help-safe-mode-without-addons =
    .label = アドオンを無効にして再起動...
    .accesskey = R
menu-help-safe-mode-with-addons =
    .label = アドオンを有効にして再起動
    .accesskey = R
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = 詐欺サイトを報告...
    .accesskey = D
menu-help-not-deceptive =
    .label = 詐欺サイトの誤報告を指摘...
    .accesskey = d
