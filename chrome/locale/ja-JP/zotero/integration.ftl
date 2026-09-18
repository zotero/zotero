integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Edit reference
-integration-editBibliography-include-uncited = To include an uncited item in your bibliography, select it from the items list and press { general-add }.
-integration-editBibliography-exclude-cited = You can also exclude a cited item by selecting it from the list of references and pressing { general-remove }.
-integration-editBibliography-edit-reference = To change how a reference is formatted, use the text editor.
integration-editBibliography-wrapper =
    .aria-label = Edit Bibliography dialog
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Citation Dialog
integration-citationDialog-section-open = Open Documents ({ $count })
integration-citationDialog-section-selected = Selected Items ({ $count }/{ $total })
integration-citationDialog-section-selectedAnnotations = Selected Annotations
integration-citationDialog-section-selectedItems = 選択された項目
integration-citationDialog-section-cited =
    { $count ->
        [0] Cited Items
       *[other] Cited Items ({ $count })
    }
integration-citationDialog-details-suffix = Suffix
integration-citationDialog-details-prefix = Prefix
integration-citationDialog-details-suppressAuthor = 著者名を省略
integration-citationDialog-details-locator-info = Tip: You can also type page numbers and other locators directly into the main field. <a data-l10n-name="docs-link">Learn more</a>
integration-citationDialog-details-includeComments = Include Comments
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Citation Settings
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] No selected, open, or cited items match the current search
       *[other] No selected or open items
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] No selected notes match the current search
       *[other] No notes are selected
    }
integration-citationDialog-lib-message-annotations =
    { $search ->
        [true] No items with annotations match the current search
       *[other] No selected or open items with annotations
    }
integration-citationDialog-settings-keepSorted = Keep sources sorted
integration-citationDialog-preview-empty = プレビュー
integration-citationDialog-preview-error = Preview unavailable
integration-citationDialog-btn-displayPreview =
    .title = Display citation preview
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = ライブラリ
integration-citationDialog-mode-list = List
integration-citationDialog-btn-type-citation =
    .title = 引用文献の追加/編集
integration-citationDialog-btn-type-add-note =
    .title = メモを追加
integration-citationDialog-btn-type-annotations =
    .title = Add Annotations
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Use Left/Right-Arrow to navigate the items of this citation. Press Tab to select items to add to this citation.
integration-citationDialog-enter-to-add-item = Press { return-or-enter } to add this item to the citation.
integration-citationDialog-search-for-items = Search for items to add to the citation
integration-citationDialog-aria-bubble =
    .aria-description = This item is included in the citation. Press space bar to customize the item. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Press Tab to select items to add to this citation. Press Escape to discard the changes and close the dialog.
integration-citationDialog-just-added-input-placeholder = Type “10-15” to cite pages, or search for items
integration-citationDialog-just-added-input-citation =
    .placeholder = { $placeholder }
    .title = { $title }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Search for a note to insert into the document
integration-citationDialog-single-input-annotations =
    .placeholder = Search for annotations to insert into the document
integration-citationDialog-aria-item-list =
    .aria-description = Use Up/Down Arrow to change item selection. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Use Right/Left Arrow to change item selection. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Collections.
    .aria-description = Select a collection and press Tab to navigate its items.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = This item has been added to the citation. Press { return-or-enter } to add it again or { delete-or-backspace } to remove it.
integration-citationDialog-add-all = Add all
integration-citationDialog-collapse-section =
    .title = Collapse section
integration-citationDialog-bubble-empty = (no title)
integration-citationDialog-add-to-citation = Add to Citation
integration-citationDialog-annotations-filter =
    .placeholder = Filter annotations
integration-citationDialog-annotations-empty = Select an item, attachment, or annotation to view annotation details
integration-prefs-displayAs-label = 引用文献の出力形式 :
integration-prefs-footnotes =
    .label = 脚注
integration-prefs-endnotes =
    .label = 文末注
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = ブックマークは Word と LibreOffice の間で共有できますが、意図せずに変更された場合にエラーが発生する場合があり、また脚注に挿入することが出来ません。
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
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
integration-error-unable-to-find-winword = { -app-name } could not find a running Word instance.
integration-warning-citation-changes-will-be-lost = You have made changes to a citation that will be lost if you continue.
integration-warning-bibliography-changes-will-be-lost = You have made changes to the bibliography that will be lost if you continue.
integration-warning-documentPreferences-changes-will-be-lost = You have made changes to the document preferences that will be lost if you continue.
integration-warning-discard-changes = Discard Changes
integration-warning-command-is-running = A word processor integration command is already running.
first-run-guidance-citationDialog =
    Click the bubble or use the ← and ↓ keys to view the citation details and customize options such as page number, prefix, and suffix.
    
    You can also add a page number or other locator by including it with your search terms (e.g., “history { $locator }”) or by typing it after the bubble and pressing { return-or-enter }.
