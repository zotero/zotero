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
integration-citationDialog-section-cited =
    { $count ->
        [0] Cited Items
       *[other] Cited Items ({ $count })
    }
integration-citationDialog-details-suffix = Suffix
integration-citationDialog-details-prefix = Prefix
integration-citationDialog-details-suppressAuthor = 著者名を省略
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
integration-citationDialog-settings-keepSorted = Keep sources sorted
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = ライブラリ
integration-citationDialog-mode-list = List
integration-citationDialog-btn-type-citation =
    .title = 出典表記を追加・編集
integration-citationDialog-btn-type-add-note =
    .title = メモを追加
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
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Search for a note to insert into the document
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
integration-error-unable-to-find-winword = { -app-name } could not find a running Word instance.
integration-warning-citation-changes-will-be-lost = You have made changes to a citation that will be lost if you continue.
integration-warning-bibliography-changes-will-be-lost = You have made changes to the bibliography that will be lost if you continue.
integration-warning-documentPreferences-changes-will-be-lost = You have made changes to the document preferences that will be lost if you continue.
integration-warning-discard-changes = Discard Changes
integration-warning-command-is-running = A word processor integration command is already running.
