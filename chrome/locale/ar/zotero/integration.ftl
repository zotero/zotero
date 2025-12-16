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
integration-citationDialog = مربع حوار الاقتباس
integration-citationDialog-section-open = فتح المستندات ({ $count })
integration-citationDialog-section-selected = العناصر المحددة ({ $count }/{ $total })
integration-citationDialog-section-cited =
    { $count ->
        [0] Cited Items
       *[other] Cited Items ({ $count })
    }
integration-citationDialog-details-suffix = ملحق
integration-citationDialog-details-prefix = بداية
integration-citationDialog-details-suppressAuthor = حذف المؤلف
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = إعدادات الاقتباس
integration-citationDialog-lib-no-items =
    { $search ->
        [true] No selected, open, or cited items match the current search
       *[other] No selected or open items
    }
integration-citationDialog-settings-keepSorted = الحفاظ على ترتيب المصادر
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
integration-citationDialog-general-instructions = استخدم السهم الأيمن/الأيسر للتنقل بين عناصر هذا الاستشهاد. اضغط على مفتاح Tab لتحديد العناصر المراد إضافتها إلى هذا الاستشهاد.
integration-citationDialog-enter-to-add-item = اضغط على { return-or-enter } لإضافة هذا العنصر إلى الاستشهاد.
integration-citationDialog-search-for-items = البحث عن عناصر لإضافتها إلى الاستشهاد
integration-citationDialog-aria-bubble =
    .aria-description = هذا العنصر مدرج في الاقتباس. اضغط على مفتاح المسافة لتخصيص العنصر. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = اضغط على Tab لتحديد العناصر المراد إضافتها إلى هذا الاستشهاد. اضغط على Escape لإلغاء التغييرات وإغلاق مربع الحوار.
integration-citationDialog-input =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-aria-item-list =
    .aria-description = استخدم السهم لأعلى/لأسفل لتغيير اختيار العنصر. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = استخدم السهم الأيمن/الأيسر لتغيير اختيار العنصر. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = المجموعات.
    .aria-description = حدد مجموعة واضغط على Tab للتنقل بين عناصرها.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = تمت إضافة هذا العنصر إلى الاستشهاد. اضغط على { return-or-enter } لإضافته مرة أخرى أو { delete-or-backspace } لإزالته.
integration-citationDialog-add-all = إضافة الكل
integration-citationDialog-collapse-section =
    .title = طي القسم
integration-citationDialog-bubble-empty = (بدون عنوان)
integration-citationDialog-add-to-citation = أضف إلى الاستشهاد
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
integration-warning-citation-changes-will-be-lost = لقد أجريت تغييرات على الاستشهاد ستفقدها إذا واصلت.
integration-warning-bibliography-changes-will-be-lost = لقد أجريت تغييرات على قائمة المراجع ستفقدها إذا واصلت.
integration-warning-documentPreferences-changes-will-be-lost = لقد أجريت تغييرات على تفضيلات المستند ستفقدها إذا واصلت.
integration-warning-discard-changes = تجاهل التغييرات
integration-warning-command-is-running = يتم الآن تشغيل أمر دمج معالج النصوص.
