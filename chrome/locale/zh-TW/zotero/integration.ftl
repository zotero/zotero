integration-docPrefs-window =
    .title = { -app-name } - 文件偏好設定
integration-addEditCitation-window =
    .title = { -app-name } - 新增/編輯引用文獻
integration-editBibliography-window =
    .title = { -app-name } - 編輯參考文獻表
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = 編輯參考文獻
-integration-editBibliography-include-uncited = 要將未引用的項目納入您的參考文獻中，請從項目列表中選擇它並按下 { general-add }。
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
integration-citationDialog-details-suppressAuthor = 省略作者
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
integration-citationDialog-mode-library = 文獻庫
integration-citationDialog-mode-list = List
integration-citationDialog-btn-type-citation =
    .title = 新增/編輯引用文獻
integration-citationDialog-btn-type-add-note =
    .title = 新增筆記
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
    .title = 摺疊此章節
integration-citationDialog-bubble-empty = (no title)
integration-citationDialog-add-to-citation = Add to Citation
integration-prefs-displayAs-label = 將引用文獻顯示為:
integration-prefs-footnotes =
    .label = 頁末註
integration-prefs-endnotes =
    .label = 文末註
integration-prefs-bookmarks =
    .label = 引用文獻儲存為書籤
integration-prefs-bookmarks-description = 在 Word 及 LibreOffice中書籤皆可相互分享，但也可能因為修改意外而產生錯誤；而且啟用此項時，引用文獻無法插入於頁末註或文末註中。
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] 必須將該文件儲存為 .doc 或 .docx 格式。
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = 自動更新引用文獻
    .tooltip = 等待更新的引用文獻會突顯於文件中
integration-prefs-automaticCitationUpdates-description = 於大型文件中，停用更新可加快引用文獻的插入。點擊重新整理可手動更新引用文獻。
integration-prefs-automaticJournalAbbeviations =
    .label = 使用 MEDLINE 期刊簡寫
integration-prefs-automaticJournalAbbeviations-description = 「期刊簡寫」欄會被忽略。
integration-prefs-exportDocument =
    .label = 切換至另一文件編輯器……
integration-error-unable-to-find-winword = { -app-name } could not find a running Word instance.
integration-warning-citation-changes-will-be-lost = You have made changes to a citation that will be lost if you continue.
integration-warning-bibliography-changes-will-be-lost = You have made changes to the bibliography that will be lost if you continue.
integration-warning-documentPreferences-changes-will-be-lost = You have made changes to the document preferences that will be lost if you continue.
integration-warning-discard-changes = Discard Changes
integration-warning-command-is-running = A word processor integration command is already running.
first-run-guidance-citationDialog =
    Type a title, author, and/or year to search for a reference.
    
    After you’ve made your selection, click the bubble or select it via the keyboard and press ↓/Space to show citation options such as page number, prefix, and suffix.
    
    You can also add a page number or other locator by including it with your search terms (e.g., “history { $locator }”) or by typing it after the bubble and pressing { return-or-enter }.
