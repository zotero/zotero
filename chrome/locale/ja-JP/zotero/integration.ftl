integration-docPrefs-window =
    .title = { -app-name } - 文書の設定
integration-addEditCitation-window =
    .title = { -app-name } - 引用文献の追加/編集
integration-editBibliography-window =
    .title = { -app-name } - 参考文献の編集
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = 参考文献の編集
-integration-editBibliography-include-uncited = 引用されていない項目を参考文献に含めるには、項目リストから選択し、{ general-add } を押します。
-integration-editBibliography-exclude-cited = 引用リストから引用項目を選択し、{ general-remove } を押すことで、引用項目を除外することもできます。
-integration-editBibliography-edit-reference = 参照文献の書式を変更するには、テキストエディタを使用します。
integration-editBibliography-wrapper =
    .aria-label = 参考文献ダイアログの編集
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = 引用ダイアログ
integration-citationDialog-section-open = 開いている文書 ({ $count })
integration-citationDialog-section-selected = 選択済み項目 ({ $count }/{ $total })
integration-citationDialog-section-selectedAnnotations = 選択済み注釈
integration-citationDialog-section-selectedItems = 選択された項目
integration-citationDialog-section-cited =
    { $count ->
        [0] 引用項目
       *[other] 引用項目 ({ $count })
    }
integration-citationDialog-details-suffix = 接尾辞
integration-citationDialog-details-prefix = 接頭辞
integration-citationDialog-details-suppressAuthor = 著者名を省略
integration-citationDialog-details-locator-info = ヒント : メインフィールドにページ番号やその他の参照情報を直接入力することもできます。 <a data-l10n-name="docs-link">詳細情報</a>
integration-citationDialog-details-includeComments = コメントを含める
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = 引用文献の設定
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] 選択済み、開いている、または引用されている項目で現在の検索条件に一致するものはありません
       *[other] 選択または開いている項目はありません
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] 選択されたメモに検索条件に一致するものはありません
       *[other] 選択されているメモがありません
    }
integration-citationDialog-lib-message-annotations =
    { $search ->
        [true] 現在の検索条件に一致する注釈付きの項目はありません
       *[other] 注釈が付いた選択済みまたは開いている項目はありません
    }
integration-citationDialog-settings-keepSorted = 出典の並び順を保持する
integration-citationDialog-preview-error = プレビューは利用できません
integration-citationDialog-btn-displayPreview =
    .title = 引用文献のプレビューを表示
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = ライブラリ
integration-citationDialog-mode-list = 一覧
integration-citationDialog-btn-type-citation =
    .title = 引用文献の追加/編集
integration-citationDialog-btn-type-add-note =
    .title = メモを追加
integration-citationDialog-btn-type-annotations =
    .title = 注釈の追加
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = この引用文献内の項目間を移動するには、左/右矢印キーを使用してください。この引用文献に追加する項目を選択するには、Tabキーを押してください。
integration-citationDialog-enter-to-add-item = この項目を引用文献に追加するには、{ return-or-enter } を押します。
integration-citationDialog-search-for-items = 引用文献に追加する項目の検索
integration-citationDialog-aria-bubble =
    .aria-description = この項目は引用文献に含まれています。項目をカスタマイズするには、スペースバーを押してください { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = この引用文献に追加する項目を選択するには、Tab キーを押してください。変更を破棄してダイアログを閉じるには、Esc キーを押してください。
integration-citationDialog-just-added-input-placeholder = ページを引用するには「10-15」と入力するか、項目を検索してください
integration-citationDialog-just-added-input-citation =
    .placeholder = { $placeholder }
    .title = { $title }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = 文書に挿入するメモの検索
integration-citationDialog-single-input-annotations =
    .placeholder = 文書に挿入する注釈の検索
integration-citationDialog-aria-item-list =
    .aria-description = 上/下矢印を使用して項目の選択を変更します。 { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = 右/左矢印を使用して項目の選択を変更します。 { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = コレクション。
    .aria-description = コレクションを選択し、Tab キーを押してその項目を移動します。
integration-citationDialog-items-table =
    .title = { integration-citationDialog-add-to-citation-tooltip }
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .title = { integration-citationDialog-add-to-citation-tooltip }
    .aria-label = この項目は引用文献に追加されました。再度追加するには{ return-or-enter }キーを、削除するには{ delete-or-backspace }キーを押してください。
integration-citationDialog-add-to-citation-tooltip =
    { $count ->
       *[other] { $count } 項目を引用文献に追加
    }
integration-citationDialog-add-all = すべて追加
integration-citationDialog-collapse-section =
    .title = セクションを折りたたむ
integration-citationDialog-bubble-empty = (タイトルなし)
integration-citationDialog-add-to-citation = 引用文献に追加
integration-citationDialog-annotations-filter =
    .placeholder = 注釈のフィルタリング
integration-citationDialog-annotations-empty = 項目、添付ファイル、または注釈を選択して、注釈の詳細を表示します
integration-prefs-displayAs-label = 引用文献の出力形式 :
integration-prefs-footnotes =
    .label = 脚注
integration-prefs-endnotes =
    .label = 文末注
integration-prefs-bookmarks =
    .label = 引用文献をブックマークとして保存
integration-prefs-bookmarks-description = ブックマークは Word と LibreOffice の間で共有できますが、意図せずに変更された場合にエラーが発生する場合があり、また脚注に挿入することが出来ません。
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] 文書は.docまたは.docx形式で保存する必要があります。
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = 引用文献を自動的に更新
    .tooltip = 更新待ちの引用文献は文書内で強調表示されます。
integration-prefs-automaticCitationUpdates-description = 更新を無効化すれば大きな文書への引用文献の挿入が高速化できます。引用文献を手動で更新するためには更新ボタンをクリックしてください。
integration-prefs-automaticJournalAbbeviations =
    .label = MEDLINEの略誌名を使用する
integration-prefs-automaticJournalAbbeviations-description = 「雑誌略語」のフィールドは無視されます。
integration-prefs-exportDocument =
    .label = 別のワードプロセッサに切り替え...
integration-error-unable-to-find-winword = { -app-name } は実行中の Word インスタンスを見つけることができませんでした。
integration-warning-citation-changes-will-be-lost = 引用文献に変更を加えましたが、続行すると変更内容は失われます。
integration-warning-bibliography-changes-will-be-lost = 参考文献に変更を加えましたが、続行すると変更内容は失われます。
integration-warning-documentPreferences-changes-will-be-lost = 文書の設定に変更を加えましたが、続行すると変更内容は失われます。
integration-warning-discard-changes = 変更を破棄
integration-warning-command-is-running = ワードプロセッサ統合コマンドはすでに実行されています。
first-run-guidance-citationDialog =
    吹き出しをクリックするか、←キーや↓キーを使って引用の詳細を表示し、ページ番号、接頭辞、接尾辞などのオプションをカスタマイズします。
    
    検索語句にページ番号やその他の位置情報を含める (例 :“history { $locator }”)、またはバブルの後にそれを入力して { return-or-enter } キーを押すことで、ページ番号などを追加することもできます。
