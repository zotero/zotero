general-print = 印刷
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = 取り除く
general-add = 追加
general-remind-me-later = 後で通知する
general-choose-file = ファイルを選択...
general-open-settings = 設定を開く
general-help = ヘルプ
general-tag = Tag
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = ファイルを表示する
menu-file-show-files =
    .label = Show Files
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = 添付ファイルを追加する
new-note = 新しいメモ
menu-add-by-identifier =
    .label = Add by Identifier…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Add File…
menu-add-standalone-linked-file-attachment =
    .label = Add Link to File…
menu-add-child-file-attachment =
    .label = Attach File…
menu-add-child-linked-file-attachment =
    .label = リンクをファイルに添付する...
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = 新しく独立メモを作成
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = ライブラリへ復帰させる
menu-deletePermanently =
    .label = 完全に削除する…
menu-tools-plugins =
    .label = Plugins
main-window-command =
    .label = { -app-name }
zotero-toolbar-tabs-menu =
    .tooltiptext = List all tabs
filter-collections = Filter Collections
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Search Tabs
zotero-tabs-menu-close-button =
    .title = Close Tab
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Rename Collection
collections-menu-edit-saved-search =
    .label = 検索式保存を編集する
item-creator-moveDown =
    .label = 下へ移動
item-creator-moveToTop =
    .label = 一番上へ移動
item-creator-moveUp =
    .label = 上へ移動
item-menu-viewAttachment =
    .label =
        Open { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Snapshot
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                   *[other] Attachments
                }
        } { $openIn ->
            [tab] in New Tab
            [window] in New Window
           *[other] { "" }
        }
item-menu-add-file =
    .label = ファイル
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Web Link
view-online = オンラインで閲覧する
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = File renamed to { $filename }
itembox-button-options =
    .tooltiptext = Open context menu
itembox-button-merge =
    .aria-label = Select version of { $field } field
create-parent-intro = Enter a DOI, ISBN, PMID, arXiv ID, or ADS Bibcode to identify this file:
reader-use-dark-mode-for-content =
    .label = Use Dark Mode for Content
update-updates-found-intro-minor = An update for { -app-name } is available:
update-updates-found-desc = It is recommended that you apply this update as soon as possible.
import-window =
    .title = インポート
import-where-from = どこからインポートしますか？
import-online-intro-title = 案内
import-source-file =
    .label = 単一ファイル (BibTeX, RIS, Zotero RDF, など.)
import-source-folder =
    .label = A folder of PDFs or other files
import-source-online =
    .label = { $targetApp } online import
import-options = オプション
import-importing = インポート中...
import-create-collection =
    .label = インポートされたコレクションやアイテムを新しいコレクションに格納する
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = ファイルの取り扱い
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = 原始の所在のファイルをリンクする
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = 新しいアイテムをダウンロードすることだけです；インポートしたアイテムを更新することをしないでください。
import-mendeley-username = ユーザー名
import-mendeley-password = パスワード
general-error = エラー
file-interface-import-error = 選択されたファイルのインポート中にエラーが発生しました。ファイルの有効性を確認して、もう一度試してください。
file-interface-import-complete = インポート完了
file-interface-items-were-imported =
    { $numItems ->
        [0] No items were imported
        [one] One item was imported
       *[other] { $numItems } items were imported
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] No items were relinked
        [one] One item was relinked
       *[other] { $numRelinked } items were relinked
    }
import-mendeley-encrypted = The selected Mendeley database cannot be read, likely because it is encrypted. See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
file-interface-import-error-translator = An error occurred importing the selected file with “{ $translator }”. Please ensure that the file is valid and try again.
import-online-intro = In the next step you will be asked to log in to { $targetAppOnline } and grant { -app-name } access. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-intro2 = { -app-name } will never see or store your { $targetApp } password.
import-online-form-intro = Please enter your credentials to log in to { $targetAppOnline }. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-wrong-credentials = Login to { $targetApp } failed. Please re-enter credentials and try again.
import-online-blocked-by-plugin = The import cannot continue with { $plugin } installed. Please disable this plugin and try again.
import-online-relink-only =
    .label = Mendeley Desktopの出典表記をもう一度リンクする
import-online-relink-kb = さらに詳しく
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = エラーを報告する...
rtfScan-wizard =
    .title = RTF スキャン
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = まず最初に、RTF 入力元ファイルと出力先ファイルを下記から選んでください。
rtfScan-input-file = 入力元ファイル
rtfScan-output-file = 出力先ファイル
rtfScan-no-file-selected = ファイルが選択されていません
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = 案内
rtfScan-scan-page =
    .label = 出典表記をスキャンしています
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = 引用されたアイテムを検証する
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = 文書の書式設定
rtfScan-format-page =
    .label = 出典表記の書式設定
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = RTF スキャンが完了しました
rtfScan-complete-page-description = あなたの文書はスキャンされ処理が完了しました。正しく整形されていることを確認してください。
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Run JavaScript
runJS-editor-label = Code:
runJS-run = Run
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Run as async function
bibliography-window =
    .title = { -app-name } - Create Citation/Bibliography
bibliography-style-label = 引用スタイル:
bibliography-locale-label = 言語:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = 高度なオプション
bibliography-outputMode-label = 出力モード:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = 参考文献目録
bibliography-outputMethod-label = 出力方法:
bibliography-outputMethod-saveAsRTF =
    .label = RTF として保存
bibliography-outputMethod-saveAsHTML =
    .label = HTML として保存
bibliography-outputMethod-copyToClipboard =
    .label = クリップボードにコピー
bibliography-outputMethod-print =
    .label = 印刷
bibliography-manageStyles-label = スタイルを管理する...
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = 出典表記の出力形式:
integration-prefs-footnotes =
    .label = 脚注
integration-prefs-endnotes =
    .label = 文末注
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = ブックマークはWordとLibreOfficeの間で共有できますが、意図せずに変更された場合にエラーを生じる場合があり、また脚注に挿入することが出来ません。
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = 出典表記を自動的に更新する
    .tooltip = 更新待ちの出典表記は書類中でハイライト表示されます。
integration-prefs-automaticCitationUpdates-description = 更新を無効化すれば大きな書類への出典表記の挿入が高速化できます。出典表記を手動で更新するためにはリフレッシュボタンをクリックしてください。
integration-prefs-automaticJournalAbbeviations =
    .label = MEDLINEの略誌名を使用する
integration-prefs-automaticJournalAbbeviations-description = 「雑誌略誌名」のフィールドは無視されます。
integration-prefs-exportDocument =
    .label = 別のワープロソフトに切り替える...
publications-intro-page =
    .label = 私の出版物
publications-intro = 「私の出版物」に追加したアイテムは、zotero.org のプロフィールページに表示されます。添付ファイルを含めることを選択した場合、それらは指定したライセンスの下で公開されます。あなた自身が作成した著作物のみを加えてください。また、配布を希望し、かつ配布する権利を持つファイルのみを含めてください。
publications-include-checkbox-files =
    .label = ファイルを含める
publications-include-checkbox-notes =
    .label = メモを含める
publications-include-adjust-at-any-time = 「私の出版物」コレクションから、いつでも表示するものを調整できます。
publications-intro-authorship =
    .label = 私がこの作品を作りました。
publications-intro-authorship-files =
    .label = 私がこの著作を作成し、これに含まれるファイルを配布する権利を有します。
publications-sharing-page =
    .label = あなたの著作物を共有する方法を選択してください
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
publications-license-page =
    .label = クリエイティブ・コモンズ・ライセンスを選択する
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
    .label = 「私の出版物」に加える
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = ライセンスを選ぶ
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Attribution 4.0 International License
licenses-cc-by-nd = Creative Commons Attribution-NoDerivatives 4.0 International License
licenses-cc-by-sa = Creative Commons Attribution-ShareAlike 4.0 International License
licenses-cc-by-nc = Creative Commons Attribution-NonCommercial 4.0 International License
licenses-cc-by-nc-nd = Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License
licenses-cc-by-nc-sa = Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Restart in Troubleshooting Mode
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Density
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-info = 情報
pane-abstract = 抄録
pane-attachments = 添付ファイル
pane-notes = メモ
pane-libraries-collections = Libraries and Collections
pane-tags = タグ
pane-related = 関連アイテム
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = 注釈
pane-header-attachment-associated =
    .label = 関連ファイル名を変更する
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } Attachment
           *[other] { $count } Attachments
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } Annotation
           *[other] { $count } Annotations
        }
section-notes =
    .label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } Tag
           *[other] { $count } Tags
        }
section-related =
    .label = { $count } Related
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Expand section
    .label = Expand { $section } section
section-button-collapse =
    .dynamic-tooltiptext = Collapse section
    .label = Collapse { $section } section
annotations-count =
    { $count ->
        [one] { $count } Annotation
       *[other] { $count } Annotations
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
pin-section =
    .label = Pin Section
unpin-section =
    .label = Unpin Section
collapse-other-sections =
    .label = Collapse Other Sections
expand-all-sections =
    .label = Expand All Sections
abstract-field =
    .placeholder = Add abstract…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filter Tags
context-notes-search =
    .placeholder = Search Notes
new-collection-dialog =
    .title = 新規コレクション
    .buttonlabelaccept = Create Collection
new-collection-name = 検索式名：
new-collection-create-in = Create in:
attachment-info-filename = ファイル名
attachment-info-accessed = アクセス日時
attachment-info-pages = ページ
attachment-info-modified = 更新日時
attachment-info-index = 索引済のアイテム
attachment-info-convert-note =
    .label =
        Migrate to { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } Note
    .tooltiptext = Adding notes to attachments is no longer supported, but you can edit this note by migrating it to a separate note.
attachment-preview-placeholder = No attachment to preview
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } Attachment Preview
quickformat-general-instructions =
    Use Left/Right Arrow to navigate the items of this citation. { $dialogMenu ->
        [active] Press Shift-Tab to focus the dialog's menu.
       *[other] { "" }
    } Press { return-or-enter } to save edits to this citation. Press Escape to discard the changes and close the dialog.
quickformat-aria-bubble = This item is included in the citation. Press space bar to customize the item. { quickformat-general-instructions }
quickformat-aria-input = Type to search for an item to include in this citation. Press Tab to navigate the list of search results. { quickformat-general-instructions }
quickformat-aria-item = Press { return-or-enter } to add this item to the citation. Press Tab to go back to the search field.
quickformat-accept =
    .tooltiptext = Save edits to this citation
quickformat-locator-type =
    .aria-label = Locator type
quickformat-locator-value = Locator
quickformat-citation-options =
    .tooltiptext = Show citation options
insert-note-aria-input = Type to search for a note. Press Tab to navigate the list of results. Press Escape to close the dialog.
insert-note-aria-item = Press { return-or-enter } to select this note. Press Tab to go back to the search field. Press Escape to close the dialog.
quicksearch-mode =
    .aria-label = Quick Search mode
quicksearch-input =
    .aria-label = 簡易検索
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = なし
item-pane-header-title =
    .label = スタイル名
item-pane-header-titleCreatorYear =
    .label = 題名、編著者名、年
item-pane-header-bibEntry =
    .label = Bibliography Entry
item-pane-header-more-options =
    .label = More Options
item-pane-message-items-selected =
    { $count ->
        [0] No items selected
        [one] { $count } item selected
       *[other] { $count } items selected
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } collection selected
       *[other] { $count } collections selected
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } search selected
       *[other] { $count } searches selected
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } object selected
       *[other] { $count } objects selected
    }
item-pane-message-unselected =
    { $count ->
        [0] No items in this view
        [one] { $count } item in this view
       *[other] { $count } items in this view
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Merge { $count } item
           *[other] Merge { $count } items
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = { -app-name } is running in 32-bit mode on a 64-bit version of Windows. { -app-name } will run more efficiently in 64-bit mode.
architecture-warning-action = Download 64-bit { -app-name }
first-run-guidance-quickFormat =
    Type a title, author, and/or year to search for a reference.
    
    After you’ve made your selection, click the bubble or select it via the keyboard and press ↓/Space to show citation options such as page number, prefix, and suffix.
    
    You can also add a page number directly by including it with your search terms or typing it after the bubble and pressing { return-or-enter }.
first-run-guidance-authorMenu = { -app-name } lets you specify editors and translators too. You can turn an author into an editor or translator by selecting from this menu.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Search condition
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Value
    .label = { $label }
