integration-docPrefs-window =
    .title = { -app-name } - تفضيلات المستند
integration-addEditCitation-window =
    .title = { -app-name } - إضافة/تحرير الاستشهاد
integration-editBibliography-window =
    .title = { -app-name } - تحرير المراجع
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = تحرير المرجع
-integration-editBibliography-include-uncited = لتضمين عنصر غير مستشهد به في المراجع، حدده من قائمة العناصر واضغط على { general-add }.
-integration-editBibliography-exclude-cited = يمكنك أيضًا استبعاد عنصر تم الاستشهاد به عن طريق تحديده من قائمة المراجع والضغط على { general-remove }.
-integration-editBibliography-edit-reference = لتغيير كيفية تنسيق المرجع، استخدم محرر النصوص.
integration-editBibliography-wrapper =
    .aria-label = تحرير مربع حوار المراجع
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
integration-citationDialog-details-suppressAuthor = حذف المؤلف
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Citation Settings
integration-citationDialog-lib-no-items =
    { $search ->
        [true] No selected, open, or cited items match the current search
       *[other] No selected or open items
    }
integration-citationDialog-settings-keepSorted = Keep sources sorted
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-btn-mode =
    .title =
        { $mode ->
            [library] Switch to List Mode
            [list] Switch to Library Mode
           *[other] Switch Mode
        }
    .aria-label =
        { $mode ->
            [library] The dialog is in Library mode. Click to switch to List Mode.
            [list] The dialog is in List mode. Click to switch to Library Mode.
           *[other] Switch Mode
        }
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Use Left/Right-Arrow to navigate the items of this citation. Press Tab to select items to add to this citation.
integration-citationDialog-enter-to-add-item = Press { return-or-enter } to add this item to the citation.
integration-citationDialog-search-for-items = Search for items to add to the citation
integration-citationDialog-aria-bubble =
    .aria-description = This item is included in the citation. Press space bar to customize the item. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Press Tab to select items to add to this citation. Press Escape to discard the changes and close the dialog.
integration-citationDialog-input =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
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
    .title = طي القسم
integration-citationDialog-bubble-empty = (no title)
integration-citationDialog-add-to-citation = Add to Citation
integration-prefs-displayAs-label = عرض الاستشهادات المرجعية كـ:
integration-prefs-footnotes =
    .label = حواشي سفلية
integration-prefs-endnotes =
    .label = تعليقات ختامية
integration-prefs-bookmarks =
    .label = تخزين الاستشهاد كإشارات مرجعية
integration-prefs-bookmarks-description = يمكن مشاركة الإشارات المرجعية بين ورد و ليبرأوفيس، ولكن قد تسبب أخطاء إذا تم تعديلها بالخطأ ولا يمكن إدراجها في الحواشي السفلية.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = حدث الاستشهادات آلياً
    .tooltip = سيتم تمييز الاستشهادات ذات التحديثات المعلقة في المستند
integration-prefs-automaticCitationUpdates-description = يمكن أن يؤدي تعطيل التحديثات إلى تسريع إدراج الاستشهادات في المستندات الكبيرة. انقر على تحديث لتحديث الاستشهادات يدويًا.
integration-prefs-automaticJournalAbbeviations =
    .label = استخدام اختصارات دورية ميدلين
integration-prefs-automaticJournalAbbeviations-description = سيتم تجاهل حقل "اختصار المجلة".
integration-prefs-exportDocument =
    .label = التبديل إلى معالج نصوص آخر ...
integration-error-unable-to-find-winword = تعذر على { -app-name } العثور على نسخة وورد قيد التشغيل.
integration-warning-citation-changes-will-be-lost = You have made changes to a citation that will be lost if you continue.
integration-warning-bibliography-changes-will-be-lost = You have made changes to the bibliography that will be lost if you continue.
integration-warning-documentPreferences-changes-will-be-lost = You have made changes to the document preferences that will be lost if you continue.
integration-warning-discard-changes = Discard Changes
integration-warning-command-is-running = A word processor integration command is already running.
