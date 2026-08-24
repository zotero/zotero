general-sentence-separator = { "" }
general-key-control = Control
general-key-shift = Shift
general-key-alt = Alt
general-key-option = オプション
general-key-command = コマンド
option-or-alt =
    { PLATFORM() ->
        [macos] { general-key-option }
       *[other] { general-key-alt }
    }
command-or-control =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-control }
    }
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
delete-or-backspace =
    { PLATFORM() ->
        [macos] Delete
       *[other] Backspace
    }
-os-name =
    { PLATFORM() ->
        [macos] macOS
        [windows] Windows
       *[other] Linux
    }
general-print = 印刷
general-remove = 削除
general-add = 追加
general-remind-me-later = 後で通知する
general-dont-ask-again = 今後このメッセージを表示しない
general-choose-file = ファイルを選択...
general-open-settings = 設定を開く
general-settings = 設定…
general-help = ヘルプ
general-tag = タグ
general-got-it = 了解
general-done = 完了
general-view-troubleshooting-instructions = トラブルシューティングを表示
general-go-back = 戻る
general-accept = 承諾
general-cancel = キャンセル
cancel-button =
    .label = { general-cancel }
general-show-in-library = ライブラリに表示
general-restartApp = 再起動 { -app-name }
general-restartInTroubleshootingMode = トラブルシューティングモードで再起動する
general-save = 保存
general-clear = 消去
clear-button =
    .label = { general-clear }
general-update = 更新
general-reset-to-default = デフォルトにリセット
general-back = 戻る
general-edit = 編集
general-cut = 切り取り
general-copy = コピー
general-paste = 貼り付け
general-find = 検索
general-delete = 削除
general-insert = 挿入
general-and = and
general-et-al = et al.
general-previous = 前へ
general-next = 次へ
general-learn-more = 詳細
general-more-information = 詳細情報
general-warning = 警告
general-type-to-continue = 続行するには、 “{ $text }” と入力してください。
general-continue = 続行
general-allow = 許可
general-always-allow = 常に許可
general-deny = 拒否
general-red = 赤
general-orange = 橙
general-yellow = 黄
general-green = 緑
general-teal = ティール
general-blue = 青
general-purple = 紫
general-magenta = マゼンタ
general-violet = バイオレット
general-maroon = マルーン
general-gray = 灰色
general-black = 黒
general-loading = 読み込み中…
db-checking-integrity = データベースの整合性をチェック
db-repairing = データベースの修復中...
citation-style-label = 引用スタイル :
language-label = 言語 :
menu-custom-group-submenu =
    .label = その他...
menu-file-show-in-finder =
    .label = ファインダーで表示
menu-file-show-file =
    .label = ファイルの場所を開く
menu-file-show-files =
    .label = ファイルの場所を開く
menu-print =
    .label = { general-print }
menu-density =
    .label = 項目間の間隔
add-attachment = 添付ファイルの追加
new-note = 新しいメモ
menu-add-by-identifier =
    .label = 識別子によって追加…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = ファイルを追加…
menu-add-standalone-linked-file-attachment =
    .label = ファイルへのリンクを追加…
menu-add-child-file-attachment =
    .label = ファイルを添付…
menu-add-child-linked-file-attachment =
    .label = リンクをファイルに添付...
menu-add-child-linked-url-attachment =
    .label = Web リンクを添付…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = 新しい独立メモの作成
menu-new-item-note =
    .label = 新しい項目のメモ
menu-restoreToLibrary =
    .label = ライブラリへ復元
menu-deletePermanently =
    .label = 完全削除...
menu-tools-plugins =
    .label = プラグイン
menu-view-columns-move-left =
    .label = 列を左に移動
menu-view-columns-move-right =
    .label = 列を右に移動
menu-view-hide-context-annotation-rows =
    .label = 一致しない注釈を隠す
menu-view-note-font-size =
    .label = メモのフォントサイズ
menu-view-note-tab-font-size =
    .label = メモのタブのフォントサイズ
menu-show-tabs-menu =
    .label = タブメニューを表示
menu-edit-copy-annotation =
    .label =
        { $count ->
           *[other] { $count } 個の注釈をコピー
        }
main-window-command =
    .label = ライブラリ
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = すべてのタブを一覧表示
filter-collections = コレクションのフィルタリング
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = タブの検索
zotero-tabs-menu-close-button =
    .title = タブを閉じる
zotero-toolbar-tabs-scroll-forwards =
    .title = 前方にスクロール
zotero-toolbar-tabs-scroll-backwards =
    .title = 後方にスクロール
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
recently-read = 最近読んだ項目
collections-menu-show-recently-read =
    .label = 表示 { recently-read }
item-menu-remove-from-recently-read =
    .label = { recently-read } から削除…
collections-menu-clear-all-last-read =
    .label = 最終閲覧日をすべて消去…
recently-read-clear-all-confirm = このライブラリ内の最終閲覧日はすべて消去されます。
items-section-collections-selected =
    { $count ->
       *[other] { $count } 件のコレクションが選択済み
    }
items-section-searches-selected =
    { $count ->
       *[other] { $count } 件の保存済み検索条件が選択済み
    }
items-section-sources-selected =
    { $count ->
       *[other] { $count } 件のソースが選択済み
    }
items-section-library-collections =
    { $count ->
       *[other] { $library } ({ $count } 件のコレクションが選択済み)
    }
items-section-library-searches =
    { $count ->
       *[other] { $library } ({ $count } 件の保存済み検索条件が選択済み)
    }
items-section-library-sources =
    { $count ->
       *[other] { $library } ({ $count } 件のソースが選択済み)
    }
items-section-library-recently-read = { $library } ({ recently-read })
items-section-library = { $library }
collections-menu-rename =
    .label = 名前の変更
edit-saved-search = 保存済み検索条件の編集
collections-menu-edit-search =
    .label = 検索条件の編集
collections-menu-duplicate-search =
    .label = 重複の検索
collections-menu-move-collection =
    .label = 移動先
collections-menu-copy-collection =
    .label = コピー先
collections-menu-export =
    .label = エクスポート...
collections-menu-generate-report =
    .label = レポートの生成…
collections-menu-create-bibliography =
    .label = 参考文献の作成…
collections-menu-unsubscribe =
    .label = 登録解除…
collections-menu-delete =
    .label =
        { $count ->
           *[other] コレクションを削除…
        }
collections-menu-delete-with-items =
    .label =
        { $count ->
           *[other] コレクションと項目を削除...
        }
collections-menu-delete-search =
    .label =
        { $count ->
           *[other] 検索条件を削除...
        }
collections-delete-title =
    { $count ->
       *[other] コレクションを削除…
    }
collections-delete-message =
    { $count ->
       *[other] { $count } 件のコレクションを削除しますか？
    }
collections-delete-keep-items =
    { $count ->
       *[other] これらのコレクション内の項目は削除されません。
    }
collections-delete-with-items-title =
    { $count ->
       *[other] コレクションと項目を削除
    }
collections-delete-with-items-message =
    { $count ->
       *[other] { $count } 件のコレクションを削除し、その中のすべての項目をごみ箱に移動しますか？
    }
collections-delete-search-title =
    { $count ->
       *[other] 検索条件を削除
    }
collections-delete-search-message =
    { $count ->
       *[other] { $count } 件の検索条件を削除しますか？
    }
item-creator-moveDown =
    .label = 下へ移動
item-creator-moveToTop =
    .label = 一番上へ移動
item-creator-moveUp =
    .label = 上へ移動
item-menu-viewAttachment =
    .label =
        開く { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                   *[other] 添付ファイル
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                   *[other] 添付ファイル
                }
        } { $openIn ->
            [tab] 新しいタブ
            [window] 新しいウィンドウ
           *[other] { "" }
        }
item-menu-add-file =
    .label = ファイル
item-menu-add-linked-file =
    .label = リンクされたファイル
item-menu-add-url =
    .label = ウェブリンク
item-menu-change-parent-item =
    .label = 親項目の変更…
item-menu-relate-items =
    .label = 関連項目
view-online = オンラインで表示
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = ファイル名が変更されました { $filename }
itembox-button-options =
    .tooltiptext = コンテキストメニューを開く
itembox-button-merge =
    .aria-label = { $field } フィールドのバージョンを選択
create-parent-intro = このファイルを識別するには、DOI、ISBN、PMID、arXiv ID、または ADS Bibcode を入力してください :
reader-use-dark-mode-for-content =
    .label = コンテンツにダークモードを使用する
update-updates-found-intro-minor = { -app-name } の更新が利用可能です :
update-updates-found-desc = この更新をできるだけ早く適用することをお勧めします。
import-window =
    .title = インポート
import-where-from = どこからインポートしますか？
import-online-intro-title = 案内
import-source-file =
    .label = 単一ファイル (BibTeX, RIS, Zotero RDF, など.)
import-source-folder =
    .label = PDF やその他のファイルのフォルダー
import-source-online =
    .label = { $targetApp } オンラインインポート
import-options = オプション
import-importing = インポート中...
import-create-collection =
    .label = インポートしたコレクションと項目を新しいコレクションに配置
import-recreate-structure =
    .label = フォルダー構造をコレクションとして再作成する
import-fileTypes-header = インポートするファイルの種類 :
import-fileTypes-pdf =
    .label = PDF
import-fileTypes-other =
    .placeholder = パターン別のその他のファイル、カンマ区切り (例 ：*.jpg、*.png)
import-file-handling = ファイル処理
import-file-handling-store =
    .label = ファイルを { -app-name } ストレージフォルダーにコピー
import-file-handling-link =
    .label = 元の場所にあるファイルへのリンク
import-fileHandling-description = リンクファイルを { -app-name } で同期することはできません。
import-online-new =
    .label = 新しい項目のみをダウンロードします。以前にインポートした項目は更新しません。
import-mendeley-username = ユーザー名
import-mendeley-password = パスワード
general-error = エラー
file-interface-import-error = 選択されたファイルのインポート中にエラーが発生しました。ファイルの有効性を確認して、もう一度試してください。
file-interface-import-complete = インポート完了
file-interface-items-were-imported =
    { $numItems ->
        [0] 項目はインポートされませんでした
        [one] 1 個の項目がインポートされました
       *[other] { $numItems } 個の項目がインポートされました
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] 再リンクされた項目はありません
        [one] 1 個の項目が再リンクされました
       *[other] { $numRelinked } 個の項目が再リンクされました
    }
import-mendeley-encrypted = 選択した Mendeleyデータベースは暗号化されているため、読み込めません。 詳しくは <a data-l10n-name="mendeley-import-kb">Mendeley ライブラリを Zotero にインポートするにはどうすればよいですか？</a> をご覧ください。
file-interface-import-error-translator = “{ $translator }” で選択したファイルのインポート中にエラーが発生しました。ファイルが有効であることを確認して、もう一度試してください。
import-online-intro = 次のステップでは、 { $targetAppOnline } にログインし、 { -app-name } にアクセスを許可するよう求められます。これは、 { $targetApp } ライブラリを { -app-name } にインポートするために必要です。
import-online-intro2 = { -app-name } は { $targetApp } のパスワードを表示したり保存したりすることはありません。
import-online-form-intro = { $targetAppOnline } にログインするには、認証情報を入力してください。これは、 { $targetApp } ライブラリを { -app-name } にインポートするために必要です。
import-online-wrong-credentials = { $targetApp } へのログインに失敗しました。資格情報を再入力して、もう一度試してください。
import-online-blocked-by-plugin = { $plugin } がインストールされているため、インポートを続行できません。このプラグインを無効にして、もう一度試してください。
import-online-relink-only =
    .label = Mendeley Desktop の引用文献を再リンク
import-online-relink-kb = { general-more-information }
import-online-connection-error = { -app-name } は { $targetApp } に接続できませんでした。インターネット接続を確認して、もう一度試してください。
tab-title-multiple-collections = 複数
items-table-cell-notes =
    .aria-label =
        { $count ->
           *[other] { $count } 件のメモ
        }
items-column-added-by = 追加者
items-column-modified-by = 更新者
items-column-last-read = 最終閲覧日
report-error =
    .label = エラーを報告...
rtfScan-wizard =
    .title = RTF スキャン
rtfScan-introPage-description = { -app-name } は、引用文献を自動的に抽出整形し、RTF ファイルに参考文献を挿入できます。現在、以下の形式の引用文献をサポートしています :
rtfScan-introPage-description2 = まず最初に、RTF 入力元ファイルと出力先ファイルを下記から選んでください :
rtfScan-input-file = 入力ファイル :
rtfScan-output-file = 出力ファイル :
rtfScan-no-file-selected = ファイルが選択されていません
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = 入力ファイルの選択
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = 出力ファイルの選択
rtfScan-intro-page = 案内
rtfScan-scan-page = 引用文献をスキャンしています
rtfScan-scanPage-description = { -app-name } がドキュメントの引用文献をスキャンしています。お待ちください。
rtfScan-citations-page = 引用された項目を検証する
rtfScan-citations-page-description = 以下の認識された引用リストを確認し、{ -app-name } が対応する項目を正しく選択していることを確認してください。マッピングされていない引用や曖昧な引用がある場合は、次のステップに進む前に解決してください。
rtfScan-style-page = 文書の書式設定
rtfScan-format-page = 引用文献の書式設定
rtfScan-format-page-description = { -app-name } が RTF ファイルを処理およびフォーマットしています。お待ちください。
rtfScan-complete-page = RTF スキャンが完了しました
rtfScan-complete-page-description = あなたの文書はスキャンされ処理が完了しました。正しく整形されていることを確認してください。
rtfScan-action-find-match =
    .title = 一致する項目を選択
rtfScan-action-accept-match =
    .title = この一致を受け入れる
runJS-title = JavaScript の実行
runJS-editor-label = コード :
runJS-run = 実行
runJS-help = { general-help }
runJS-completed = 正常に完了しました
runJS-result =
    { $type ->
        [async] 戻り値 :
       *[other] 結果 :
    }
runJS-run-async = 非同期関数として実行
bibliography-window =
    .title = { -app-name } - 引用/参考文献の作成
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = 引用文献の表示形式 :
bibliography-advancedOptions-label = 高度なオプション
bibliography-outputMode-label = 出力モード :
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] 引用文献
            [note] メモ
           *[other] 引用文献
        }
bibliography-outputMode-bibliography =
    .label = 参考文献
bibliography-outputMethod-label = 出力方法 :
bibliography-outputMethod-saveAsRTF =
    .label = RTF として保存
bibliography-outputMethod-saveAsHTML =
    .label = HTML として保存
bibliography-outputMethod-copyToClipboard =
    .label = クリップボードにコピー
bibliography-outputMethod-print =
    .label = 印刷
bibliography-manageStyles-label = スタイルの管理...
styleEditor-locatorType =
    .aria-label = 参照位置の種類
styleEditor-locatorInput = 参照位置の入力
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = スタイルエディタ
styleEditor-preview =
    .aria-label = プレビュー
stylePreview-generating = Generating previews…
publications-intro-page = 私の出版物
publications-intro = 「私の出版物」に追加した項目は、zotero.org のプロフィールページに表示されます。添付ファイルを含めることを選択した場合、それらは指定したライセンスの下で公開されます。あなた自身が作成した著作物のみを加えてください。また、配布を希望し、かつ配布する権利を持つファイルのみを含めてください。
publications-include-checkbox-files =
    .label = ファイルを含める
publications-include-checkbox-notes =
    .label = メモを含める
publications-include-adjust-at-any-time = 「私の出版物」コレクションから、いつでも表示するものを調整できます。
publications-intro-authorship =
    .label = 私がこの作品を作りました。
publications-intro-authorship-files =
    .label = 私がこの著作を作成し、これに含まれるファイルを配布する権利を有します。
publications-sharing-page = あなたの著作物を共有する方法を選択してください
publications-sharing-keep-rights-field =
    .label = 既存の権利フィールドを維持する
publications-sharing-keep-rights-field-where-available =
    .label = 可能なときは既存の権利フィールドを維持する
publications-sharing-text = 著作物のすべての権利を留保することも、クリエイティブ・コモンズ・ライセンスの下でライセンスすることも、パブリック ドメインに捧げることも可能です。いずれの場合も、あなたの著作物は zotero.org を通じて公開されます。
publications-sharing-prompt = あなたの著作物を他の人と共有できるようにしますか？
publications-sharing-reserved =
    .label = いいえ、私の著作物は zotero.org でのみ公開してください
publications-sharing-cc =
    .label = はい、クリエイティブ・コモンズ・ライセンスの下で共有します
publications-sharing-cc0 =
    .label = はい、私の著作物をパブリックドメインにします
publications-license-page = クリエイティブ・コモンズ・ライセンスを選択する
publications-choose-license-text = クリエイティブ・コモンズ・ライセンスは、適切なクレジット表示とライセンスへのリンクを提供し、変更が加えられたかどうかを示す限り、他の人があなたの著作物をコピーして再配布することを許可するものです。以下に追加条件を指定することができます。
publications-choose-license-adaptations-prompt = あなたの著作物の翻案が共有されることを許可しますか？
publications-choose-license-yes =
    .label = はい
    .accesskey = Y
publications-choose-license-no =
    .label = いいえ
    .accesskey = N
publications-choose-license-sharealike =
    .label = はい、他の人が同じように共有している限り
    .accesskey = S
publications-choose-license-commercial-prompt = あなたの著作物の商用利用を許可しますか？
publications-buttons-add-to-my-publications =
    .label = 「私の出版物」へ追加
publications-buttons-next-sharing =
    .label = 次へ : 共有
publications-buttons-next-choose-license =
    .label = ライセンスの選択
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Attribution 4.0 International License
licenses-cc-by-nd = Creative Commons Attribution-NoDerivatives 4.0 International License
licenses-cc-by-sa = Creative Commons Attribution-ShareAlike 4.0 International License
licenses-cc-by-nc = Creative Commons Attribution-NonCommercial 4.0 International License
licenses-cc-by-nc-nd = Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License
licenses-cc-by-nc-sa = Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License
licenses-cc-more-info = CCライセンスを適用する前に、クリエイティブ・コモンズの <a data-l10n-name="license-considerations">ライセンサーへの考慮事項</a> を必ずお読みください。適用したライセンスは、後から別の条件を選択したり、作品の公開を中止したりした場合でも、取り消すことはできませんのでご注意ください。
licenses-cc0-more-info = 作品に CC0 を適用する前に、クリエイティブ・コモンズの <a data-l10n-name="license-considerations">CC0 FAQ</a> を必ずお読みください。作品をパブリックドメインに寄贈した場合、後から別の条件を選択したり、作品の公開を中止したりした場合でも、元に戻すことはできませんのでご注意ください。
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = トラブルシューティングモードで再起動…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } はすべてのプラグインを無効にした状態で再起動します。トラブルシューティングモードが有効になっている間は、一部の機能が正しく動作しない場合があります。
menu-ui-density =
    .label = 項目間の間隔
menu-ui-density-comfortable =
    .label = 標準
menu-ui-density-compact =
    .label = コンパクト
pane-item-details = 項目の詳細
pane-info = 情報
pane-abstract = 抄録
pane-attachments = 添付ファイル
pane-notes = メモ
pane-note-info = メモの情報
pane-libraries-collections = ライブラリとコレクション
pane-tags = タグ
pane-related = 関連項目
pane-attachment-info = 添付ファイル情報
pane-attachment-preview = プレビュー
pane-attachment-annotations = 注釈
pane-header-attachment-associated =
    .label = 関連ファイル名の変更
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
           *[other] { $count } 個の添付ファイル
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
           *[other] { $count } 個の注釈
        }
section-attachments-move-to-trash-message = “{ $title }” をごみ箱に移動しますか？
section-notes =
    .label =
        { $count ->
           *[other] { $count } 件のメモ
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
           *[other] { $count } 個のタグ
        }
section-related =
    .label = { $count } 個の関連文献
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = セクションを展開
    .label = { $section } セクションを展開
section-button-collapse =
    .dynamic-tooltiptext = セクションを折りたたむ
    .label = { $section } セクションを折りたたむ
annotations-count =
    { $count ->
       *[other] { $count } 個の注釈
    }
section-button-annotations =
    .title = { annotations-count }
    .aria-label = { annotations-count }
attachment-preview =
    .aria-label = { pane-attachment-preview }
sidenav-info =
    .tooltiptext = { pane-info }
sidenav-abstract =
    .tooltiptext = { pane-abstract }
sidenav-attachments =
    .tooltiptext = { pane-attachments }
sidenav-notes =
    .tooltiptext = { pane-notes }
sidenav-note-info =
    .tooltiptext = { pane-note-info }
sidenav-attachment-info =
    .tooltiptext = { pane-attachment-info }
sidenav-attachment-preview =
    .tooltiptext = { pane-attachment-preview }
sidenav-attachment-annotations =
    .tooltiptext = { pane-attachment-annotations }
sidenav-libraries-collections =
    .tooltiptext = { pane-libraries-collections }
sidenav-tags =
    .tooltiptext = { pane-tags }
sidenav-related =
    .tooltiptext = { pane-related }
sidenav-main-btn-grouping =
    .aria-label = { pane-item-details }
sidenav-reorder-up =
    .label = セクションを上に移動
sidenav-reorder-down =
    .label = セクションを下に移動
sidenav-reorder-reset =
    .label = セクションの順序をリセット
toggle-item-pane =
    .tooltiptext = 項目パネルの切り替え
toggle-context-pane =
    .tooltiptext = コンテキストパネルの切り替え
pin-section =
    .label = セクションをピン留め
unpin-section =
    .label = セクションのピン留め解除
collapse-other-sections =
    .label = 他のセクションを折りたたむ
expand-all-sections =
    .label = すべてのセクションを展開
abstract-field =
    .placeholder = 抄録の追加…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = タグをフィルタリング
context-notes-search =
    .placeholder = メモの検索
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = 新規コレクション...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = 新規コレクション
    .buttonlabelaccept = コレクションの作成
new-collection-name = 名前 :
new-collection-create-in = 作成場所 :
show-publications-menuitem =
    .label = 私の出版物を表示
attachment-info-title = タイトル
attachment-info-filename = ファイル名
attachment-info-accessed = アクセス日時
attachment-info-pages = ページ
attachment-info-modified = 更新日時
attachment-info-index = 索引済の項目
attachment-info-convert-note =
    .label =
        メモに変換 : { $type ->
            [standalone] 独立
            [child] 項目
           *[unknown] 新規
        }
    .tooltiptext = 添付ファイルへのメモの追加はサポートされなくなりましたが、このメモを別のメモに移行することで編集できます。
section-note-info =
    .label = { pane-note-info }
note-info-title = タイトル
note-info-parent-item = 親項目
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] なし
    }
    .title =
        { $hasParentItem ->
            [true] ライブラリ内の親項目を表示
           *[false] ライブラリ内のメモ項目を表示
        }
note-info-date-created = 作成日時
note-info-date-modified = 更新日時
note-info-size = サイズ
note-info-word-count = 単語数
note-info-character-count = 文字数
item-title-empty-note = 無題のメモ
attachment-preview-placeholder = プレビューに添付ファイルはありません
attachment-rename-from-parent =
    .tooltiptext = 親項目と一致するようにファイル名を変更
account-log-in = ログイン
account-not-logged-in-text = Zotero アカウントにログインしてデータを同期する。
account-error-login-session-expired = ログインセッションの有効期限が切れました。もう一度試してください。
toggle-preview =
    .label =
        { $type ->
            [open] 隠す
            [collapsed] 表示
           *[unknown] 切り替え
        } 添付ファイルのプレビュー
annotation-image-not-available = [画像はありません]
quicksearch-mode =
    .aria-label = クイック検索モード
quicksearch-input =
    .aria-label = クイック検索
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
advanced-search = 高度な検索
menuitem-advanced-search =
    .label = { advanced-search }
quicksearch-advanced-search-button =
    .tooltiptext = { advanced-search }
    .aria-label = { advanced-search }
advanced-search-close =
    .tooltiptext = 高度な検索を閉じる
advanced-search-expand =
    .tooltiptext = 高度な検索を展開
advanced-search-collapse =
    .tooltiptext = 高度な検索を折りたたむ
item-pane-header-view-as =
    .label = 表示方法
item-pane-header-none =
    .label = なし
item-pane-header-title =
    .label = タイトル
item-pane-header-titleCreatorYear =
    .label = タイトル、著者、年
item-pane-header-bibEntry =
    .label = 参考文献エントリ
item-pane-header-more-options =
    .label = その他
item-pane-message-items-selected =
    { $count ->
        [0] 選択された項目はありません
        [one] { $count } 個の項目が選択済み
       *[other] { $count } 個の項目が選択済み
    }
item-pane-message-collections-selected =
    { $count ->
       *[other] { $count }  個のコレクションが選択済み
    }
item-pane-message-searches-selected =
    { $count ->
       *[other] { $count } 個の検索条件が選択されました
    }
item-pane-message-objects-selected =
    { $count ->
       *[other] { $count } 個のオブジェクトが選択されました
    }
item-pane-message-unselected =
    { $count ->
        [0] 表示する項目はありません
        [one] { $count } 個の項目があります
       *[other] { $count } 個の項目があります
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] オブジェクトはありません
        [one] { $count } 個のオブジェクトがあります
       *[other] { $count } 個のオブジェクトがあります
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
           *[other] { $count } 個の項目を結合
        }
locate-library-lookup-no-resolver = { -app-name } 設定の { $pane } パネルからリゾルバを選択する必要があります。
architecture-win32-warning-message = 最高のパフォーマンスを得るには、64ビット版の { -app-name } に切り替えてください。データに影響はありません。
architecture-warning-action = 64ビット版をダウンロード { -app-name }
architecture-x64-on-arm64-message = { -app-name } はエミュレートモードで実行されています。{ -app-name } のネイティブバージョンの方が効率的に動作します。
architecture-x64-on-arm64-action = { -app-name } ARM64用をダウンロード
first-run-guidance-authorMenu = { -app-name } では編集者と翻訳者も指定できます。このメニューから選択することで、著者を編集者または翻訳者にすることができます。
first-run-guidance-readAloud = { -app-name } は、自然な音声でドキュメントを読み上げることができるようになりました。
advanced-search-remove-btn =
    .tooltiptext = 条件を削除
advanced-search-add-btn =
    .tooltiptext = 条件を追加
advanced-search-group-btn =
    .tooltiptext = 条件グループを追加
advanced-search-remove-group-btn =
    .tooltiptext = グループを削除
advanced-search-ungroup-btn =
    .tooltiptext = 条件のグループを解除
advanced-search-result-level-menu =
    .aria-label = 結果の種類
advanced-search-result-level-prefix-root =
    .value = 検索
advanced-search-join-prefix-root =
    .value = 一致条件
advanced-search-result-level-any =
    .label = すべての項目
advanced-search-result-level-item =
    .label = トップレベルの項目
advanced-search-result-level-attachment =
    .label = 添付ファイル
advanced-search-result-level-note =
    .label = メモ
advanced-search-result-level-annotation =
    .label = 注釈
advanced-search-binding-menu =
    .aria-label = 同じ項目に対して照合
advanced-search-binding-separate =
    .label = 個別に
advanced-search-binding-same-attachment =
    .label = 同じ添付ファイル内
advanced-search-binding-same-note =
    .label = 同じメモ内
advanced-search-binding-same-annotation =
    .label = 同じ注釈内
advanced-search-of-the-following =
    .value = 以下の条件
advanced-search-binding-hint-attachment =
    .value = これらの条件は別々の添付ファイルに一致する可能性があります。
advanced-search-binding-hint-note =
    .value = これらの条件は別々のメモに一致する可能性があります。
advanced-search-binding-hint-annotation =
    .value = これらの条件は別々の注釈に一致する可能性があります。
advanced-search-level-warning-mixed = これらの条件がすべて同じ項目に一致することはないため、この検索では結果が返されません。条件の「{ $matchAny }」に一致するようにするか、結果の種類を「{ $topLevelItems }」に設定してみてください。
advanced-search-level-warning-unreachable = この検索には、選択された結果タイプに適用できない条件が含まれています。結果の種類を「{ $topLevelItems }」に設定するか、互換性のない条件を削除してください。
advanced-search-group-warning-unreachable =
    この条件は、同じ { $entity ->
        [attachment] 添付ファイル
        [note] メモ
       *[annotation] 注釈
    } 内に存在することはできません。これらの条件を個別に一致させるか、互換性のない条件を削除してください。
advanced-search-group-warning-mixed = これらの条件がすべて同じ項目に一致することはないため、このグループは決して一致しません。条件の「{ $matchAny }」に一致するようにするか、結果の種類を「{ $topLevelItems }」に設定してみてください。
advanced-search-bind-same-attachment =
    .label = 同じ添付ファイルに一致
advanced-search-bind-same-note =
    .label = 同じメモに一致
advanced-search-bind-same-annotation =
    .label = 同じ注釈に一致
advanced-search-conditions-menu =
    .aria-label = 検索条件
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = 演算子
    .label = { $label }
advanced-search-condition-input =
    .aria-label = 値
    .label = { $label }
search-operator-isEmpty = 空
search-operator-isNotEmpty = 空でない
search-conditions-tooltip-fields = フィールド :
search-conditions-collection = コレクション
search-conditions-savedSearch = 保存済み検索条件
search-conditions-itemTypeID = 項目の種類
search-conditions-tag = タグ
search-conditions-numTags = # タグ数
search-conditions-numNotes = # メモ数
search-conditions-numAttachments = # 添付ファイル数
search-conditions-numAnnotations = # 注釈数
search-conditions-note = メモ
search-conditions-childNote = 子メモ
search-conditions-creator = 著者
search-conditions-thesisType = 学位論文の種類
search-conditions-reportType = レポートの種類
search-conditions-videoRecordingFormat = ビデオフォーマット
search-conditions-audioFileType = 音声ファイル形式
search-conditions-audioRecordingFormat = 音声記録形式
search-conditions-letterType = 手紙の種類
search-conditions-interviewMedium = インタビューの記録方法
search-conditions-manuscriptType = 原稿の種類
search-conditions-presentationType = プレゼンテーションの種類
search-conditions-mapType = 地図の種類
search-conditions-artworkMedium = 芸術品の素材・技法
search-conditions-dateModified = 変更日
search-conditions-fulltextContent = 添付ファイルの内容
search-conditions-programmingLanguage = プログラミング言語
search-conditions-fileTypeID = 添付ファイルの種類
search-conditions-attachmentStorageType = 添付ファイルの保存タイプ
search-conditions-lastRead = 添付ファイルの最終閲覧日
search-conditions-annotationText = 注釈の文字
search-conditions-annotationComment = 注釈のコメント
search-conditions-annotationType = 注釈タイプ
search-conditions-annotationColor = 注釈の色
search-conditions-annotationAuthor = 注釈の著者
search-conditions-anyField = 任意のフィールド
search-conditions-titleCreatorYear = タイトル、著者、年
search-conditions-submenu-attachment = 添付ファイル
search-conditions-submenu-annotation = 注釈
search-conditions-short-fulltextContent = 内容
search-conditions-short-fileTypeID = ファイルの種類
search-conditions-short-attachmentStorageType = 保存タイプ
search-conditions-short-lastRead = 最終閲覧日
search-conditions-short-annotationText = 文字
search-conditions-short-annotationComment = コメント
search-conditions-short-annotationType = 種類
search-conditions-short-annotationColor = 色
search-conditions-short-annotationAuthor = 著者
find-pdf-files-added =
    { $count ->
       *[other] { $count } 個のファイルを追加しました
    }
select-items-window =
    .title = 項目を選択
select-items-dialog =
    .buttonlabelaccept = 選択
select-items-convertToStandalone =
    .label = スタンドアロンに変換
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
           *[other] スタンドアロン添付ファイルに変換
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
           *[other] スタンドアロンメモに変換
        }
file-type-webpage = ウェブページ
file-type-image = 画像
file-type-pdf = PDF
file-type-audio = オーディオ
file-type-video = ビデオ
file-type-presentation = プレゼンテーション
file-type-document = 文書
file-type-ebook = 電子書籍
attachment-storage-type-storedFile = 保存ファイル
attachment-storage-type-linkedFile = リンクされたファイル
attachment-storage-type-webLink = ウェブリンク
post-upgrade-message = <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>にアップグレードされました！ <a data-l10n-name="new-features-link">新機能</a>について詳しくはこちら。
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = 貼り付けと検索
mac-word-plugin-install-message = Zotero が Word プラグインをインストールするには、Word データへのアクセスが必要です。
mac-word-plugin-install-folder-message = { -app-name } が Word プラグインをインストールするには、Word のスタートアップフォルダーへのアクセスが必要です。
mac-word-plugin-install-action-button =
    .label = Word プラグインをインストール
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Word のスタートアップフォルダーにプラグインをインストール
mac-word-plugin-install-folder-dialog-button = インストール
mac-word-plugin-install-wrong-folder-selected = 提案されたフォルダーを選択する必要があります。別のフォルダーを選択せずに、もう一度試してください。
file-renaming-banner-message = { -app-name }は、項目に変更を加えると、添付ファイル名を自動的に同期するようになりました。
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = このバージョンの { -app-name } で動作させるには、{ -app-name } コネクタを更新する必要があります。
userjs-pref-warning = 一部の { -app-name } 設定がサポートされていない方法で上書きされました。{ -app-name } はそれらを元に戻して再起動します。
migrate-extra-fields-progress-headline = 項目を更新中…
migrate-extra-fields-progress-message = 追加フィールドから新しいフィールドを移行中
fulltext-indexing-progress-title = 索引の作成中
fulltext-indexing-progress-message = 索引の作成が完了するまで、全文検索結果は不完全な場合があります。
long-tag-fixer-window-title =
    .title = タグを分割
long-tag-fixer-button-dont-split =
    .label = 分割しない
menu-normalize-attachment-titles =
    .label = 添付ファイルタイトルを標準化…
normalize-attachment-titles-title = 添付ファイルタイトルの標準化
normalize-attachment-titles-text =
    { -app-name } は、親項目のメタデータを使用してディスク上のファイル名を自動的に変更しますが、項目リストをすっきりと保ち、情報の重複を避けるために、主要な添付ファイルには「全文PDF」、「プレプリントPDF」、または「PDF」などの個別でよりシンプルなタイトルを使用します。
    
    以前のバージョンの { -app-name } や特定のプラグインを使用している場合、添付ファイルのタイトルが不必要にファイル名と一致するように変更される可能性がありました。
    
    選択した添付ファイルのタイトルをよりシンプルなものに更新しますか？ファイル名と一致するタイトルの主要な添付ファイルのみが変更されます。
banner-close-button =
    .aria-label = 通知を閉じる
plugins-blocked-plugin =
    .message = このプラグインは { -app-name } によって無効化されました。
data-dir-unsupported-storage = これは、{ -app-name } データディレクトリがクラウドストレージフォルダー (OneDrive、Dropboxなど) またはネットワーク共有上にある場合に発生する可能性があります。
login-manager-reset = { -app-name } は保存されたログイン情報を読み取れなかったため、リセットされました。{ -app-name } 設定の { preferences-pane-account } ペインで再度ログインしてください。
os-keystore-save-failed =
    { PLATFORM() ->
        [macos] { -app-name } は認証情報を安全に保存するために { -os-name } キーチェーンにアクセスできませんでした。キーチェーンにアクセスできることを確認して、もう一度試してください。
        [windows] { -app-name } は認証情報を安全に保存できませんでした。もう一度試すか、{ -app-name } を再起動してください。
       *[other] { -app-name } は認証情報を安全に保存するために { -os-name } キーリングにアクセスできませんでした。キーリングサービスが実行されていることを確認して、もう一度試してください。
    }
os-keystore-migrate-failed =
    { PLATFORM() ->
        [macos] { -app-name } は保存された認証情報を暗号化するために { -os-name } キーチェーンにアクセスできませんでした。認証情報はディスク上に暗号化されずに保存されたままです。キーチェーンにアクセスできることを確認して、{ -app-name } を再起動してください。
        [windows] { -app-name } は保存された認証情報を暗号化できませんでした。認証情報はディスク上に暗号化されずに保存されたままです。{ -app-name } を再起動して、もう一度試してください。
       *[other] { -app-name } は保存された認証情報を暗号化するために { -os-name } キーリングにアクセスできませんでした。認証情報はディスク上に暗号化されずに保存されたままです。キーリングサービスが実行されていることを確認して、{ -app-name } を再起動してください。
    }
search-button =
    .label = 検索実行
save-search-new-button =
    .label = 検索条件を保存…
save-search-edit-button =
    .label = 保存
save-search-name-title = 検索条件を保存
save-search-name-message = 保存する検索条件の名前を入力してください :
saved-search-close-confirmation-title = 保存済み検索条件の編集
saved-search-close-confirmation-body = この保存済み検索条件に加えた変更を保存しますか？
item-pane-batch-editing-prompt =
    .aria-label = バッチ編集
item-pane-batch-editing-enable =
    .label = 複数項目の編集…
item-pane-batch-editing-multiple-values-placeholder = 複数
item-pane-batch-editing-clear-values = すべての値を消去
item-pane-batch-editing-header =
    { $count ->
       *[other] { $count } 個の項目を編集中
    }
item-pane-batch-editing-done =
    .label = { general-done }
undo-action-edit-metadata =
    { $count ->
       *[other] { $count } 個の項目のメタデータを編集
    }
undo-action-edit-field =
    { $count ->
       *[other] { $count } 個の項目の “{ $field }” を編集
    }
undo-action-normalize-attachment-titles = 添付ファイルタイトルを標準化
undo-action-trash =
    { $count ->
       *[other] { $count } 個の項目をゴミ箱へ移動
    }
undo-action-restore-items =
    { $count ->
       *[other] { $count } 個の項目を復元
    }
undo-action-trash-collection =
    { $count ->
       *[other] { $count } 個のコレクションをゴミ箱へ移動
    }
undo-action-trash-search =
    { $count ->
       *[other] { $count } 個の保存済み検索条件をゴミ箱へ移動
    }
undo-action-restore-collection =
    { $count ->
       *[other] { $count } 個のコレクションを復元
    }
undo-action-restore-objects =
    { $count ->
       *[other] { $count } 個のオブジェクトを復元
    }
undo-action-add-to-collection =
    { $count ->
       *[other] { $count } I個の項目をコレクションに追加
    }
undo-action-remove-from-collection =
    { $count ->
       *[other] { $count } 個の項目をコレクションから削除
    }
undo-action-move-to-collection =
    { $count ->
       *[other] { $count } 個の項目をコレクションへ移動
    }
undo-action-rename-collection = コレクション名を変更
undo-action-move-collection = コレクションを移動
undo-action-add-tag =
    { $count ->
       *[other] { $count } 個の項目にタグを追加
    }
undo-action-change-tag = タグを変更
undo-action-split-tag = タグを分割
undo-action-remove-tag =
    { $count ->
       *[other] { $count } 個の項目からタグを削除
    }
undo-action-remove-tags-from-item =
    { $count ->
       *[other] { $count } 個のタグを削除
    }
undo-action-remove-all-tags = すべてのタグを削除
undo-action-edit-note = メモを編集
undo-action-add-creator = 作成者を追加
undo-action-remove-creator = 作成者を削除
undo-action-edit-creator = 作成者を編集
undo-action-reorder-creator = 作成者の順序を変更
undo-action-change-type = 項目の種類を変更
undo-action-change-parent-item =
    { $count ->
       *[other] { $count } 個の項目の親を変更
    }
undo-action-convert-to-standalone =
    { $count ->
       *[other] { $count } 個の項目をスタンドアロンに変換
    }
undo-action-add-related = 関連項目を追加
undo-action-remove-related = 関連項目を削除
undo-action-merge-items =
    { $count ->
       *[other] { $count } 個の項目を統合
    }
menu-edit-undo-action = { $action } を元に戻す
menu-edit-redo-action = { $action } をやり直す
local-api-authorize-title = ローカル API の承認
local-api-authorize-text = お使いのコンピュータで実行中のアプリケーション “{ $appName }” が、{ -app-name } ライブラリを変更しようとしています。
