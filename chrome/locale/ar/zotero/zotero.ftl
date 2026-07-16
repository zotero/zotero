general-sentence-separator = { " " }
general-key-control = Control
general-key-shift = Shift
general-key-alt = Alt
general-key-option = Option
general-key-command = Command
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
general-print = طباعة
general-remove = إزالة
general-add = اضافة
general-remind-me-later = التذكير لاحقاً
general-dont-ask-again = لا تسأل مرة أخرى
general-choose-file = اختر الملف...
general-open-settings = فتح الإعدادات
general-settings = الإعدادات...
general-help = مساعدة
general-tag = وسم
general-got-it = Got It
general-done = تم
general-view-troubleshooting-instructions = عرض تعليمات استكشاف الأخطاء وإصلاحها
general-go-back = ارجع
general-accept = قبول
general-cancel = إلغاء
cancel-button =
    .label = { general-cancel }
general-show-in-library = عرض في المكتبة
general-restartApp = إعادة تشغيل { -app-name }
general-restartInTroubleshootingMode = إعادة التشغيل في وضع استكشاف الأخطاء وإصلاحها
general-save = حفظ
general-clear = تفريغ
clear-button =
    .label = { general-clear }
general-update = تحديث
general-back = ارجع
general-edit = تحرير
general-cut = قص
general-copy = نسخ
general-paste = لصق
general-find = اعثر
general-delete = مسح
general-insert = إدراج
general-and = و
general-et-al = إلخ.
general-previous = السابق
general-next = التالي
general-learn-more = تعرف على المزيد
general-more-information = المزيد من المعلومات
general-warning = تحذير
general-type-to-continue = اكتب ”{ $text }“ للمتابعة.
general-continue = استمر
general-red = أحمر
general-orange = برتقالي
general-yellow = أصفر
general-green = أخضر
general-teal = أزرق مخضر
general-blue = أزرق
general-purple = البنفسجي
general-magenta = أرجواني
general-violet = بنفسجي
general-maroon = كستنائي
general-gray = رمادي
general-black = أسود
general-loading = التحميل
db-checking-integrity = Checking database integrity…
db-repairing = Repairing database…
citation-style-label = نمط الاستشهاد:
language-label = اللغة
menu-custom-group-submenu =
    .label = المزيد من الخيارات...
menu-file-show-in-finder =
    .label = العرض في المجلد
menu-file-show-file =
    .label = عرض الملف
menu-file-show-files =
    .label = عرض المُجلّدات
menu-print =
    .label = { general-print }
menu-density =
    .label = الكثافة
add-attachment = اضافة مرفق
new-note = ملاحظة جديدة
menu-add-by-identifier =
    .label = إضافة بواسطة معرف...
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = إضافة ملف
menu-add-standalone-linked-file-attachment =
    .label = إضافة ارتباط لملف...
menu-add-child-file-attachment =
    .label = إرفاق ملف...
menu-add-child-linked-file-attachment =
    .label = إرفاق ارتباط لملف...
menu-add-child-linked-url-attachment =
    .label = إرفاق رابط ويب...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = ملاحظة جديدة مستقلة بذاتها
menu-new-item-note =
    .label = ملاحظة جديدة
menu-restoreToLibrary =
    .label = استعادة المكتبة
menu-deletePermanently =
    .label = حذف نهائي...
menu-tools-plugins =
    .label = الإضافات
menu-view-columns-move-left =
    .label = نقل العمود لليسار
menu-view-columns-move-right =
    .label = نقل العمود لليمين
menu-view-hide-context-annotation-rows =
    .label = Hide Non-Matching Annotations
menu-view-note-font-size =
    .label = حجم خط الملاحظات
menu-view-note-tab-font-size =
    .label = حجم خط علامة التبويب
menu-show-tabs-menu =
    .label = عرض قائمة علامات التبويب
menu-edit-copy-annotation =
    .label =
        { $count ->
            [zero] نسخ { $count } تعليق توضيحي
            [one] نسخ { $count } تعليق توضيحي
            [two] نسخ { $count } تعليقات توضيحية
            [few] نسخ { $count } تعليقات توضيحية
            [many] نسخ { $count } تعليقات توضيحية
           *[other] نسخ { $count } تعليقات توضيحية
        }
main-window-command =
    .label = مكتبة
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = سرد جميع علامات التبويب
filter-collections = تصفية العناصر
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = بحث في علامات التبويب
zotero-tabs-menu-close-button =
    .title = إغلاق علامة التبويب
zotero-toolbar-tabs-scroll-forwards =
    .title = التمرير للأمام
zotero-toolbar-tabs-scroll-backwards =
    .title = التمرير للخلف
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
recently-read = Recently Read
collections-menu-show-recently-read =
    .label = Show { recently-read }
item-menu-remove-from-recently-read =
    .label = Remove from { recently-read }…
items-section-collections-selected =
    { $count ->
        [zero] { $count } مجموعة مختارة
        [one] { $count } مجموعة مختارة
        [two] { $count } مجموعتان مختارتان
        [few] { $count } مجموعات مختارة
        [many] { $count } مجموعات مختارة
       *[other] { $count } مجموعات مختارة
    }
items-section-searches-selected =
    { $count ->
        [one] { $count } saved search selected
       *[other] { $count } saved searches selected
    }
items-section-sources-selected =
    { $count ->
        [one] { $count } source selected
       *[other] { $count } sources selected
    }
items-section-library-collections =
    { $count ->
        [one] { $library } ({ $count } collection selected)
       *[other] { $library } ({ $count } collections selected)
    }
items-section-library-searches =
    { $count ->
        [one] { $library } ({ $count } saved search selected)
       *[other] { $library } ({ $count } saved searches selected)
    }
items-section-library-sources =
    { $count ->
        [one] { $library } ({ $count } source selected)
       *[other] { $library } ({ $count } sources selected)
    }
items-section-library-recently-read = { $library } ({ recently-read })
items-section-library = { $library }
collections-menu-rename =
    .label = Rename
edit-saved-search = تحرير البحث المخزن
collections-menu-edit-search =
    .label = Edit Search
collections-menu-duplicate-search =
    .label = Duplicate Search
collections-menu-move-collection =
    .label = الانتقال إلى
collections-menu-copy-collection =
    .label = النسخ إلى
collections-menu-export =
    .label = تصدير...
collections-menu-generate-report =
    .label = Generate Report…
collections-menu-create-bibliography =
    .label = Create Bibliography…
collections-menu-unsubscribe =
    .label = Unsubscribe…
collections-menu-delete =
    .label =
        { $count ->
            [one] Delete Collection…
           *[other] Delete Collections…
        }
collections-menu-delete-with-items =
    .label =
        { $count ->
            [one] Delete Collection and Items…
           *[other] Delete Collections and Items…
        }
collections-menu-delete-search =
    .label =
        { $count ->
            [one] Delete Search…
           *[other] Delete Searches…
        }
collections-delete-title =
    { $count ->
        [one] Delete Collection
       *[other] Delete Collections
    }
collections-delete-message =
    { $count ->
        [one] Are you sure you want to delete this collection?
       *[other] Are you sure you want to delete { $count } collections?
    }
collections-delete-keep-items =
    { $count ->
        [one] Items within this collection will not be deleted.
       *[other] Items within these collections will not be deleted.
    }
collections-delete-with-items-title =
    { $count ->
        [one] Delete Collection and Items
       *[other] Delete Collections and Items
    }
collections-delete-with-items-message =
    { $count ->
        [one] Are you sure you want to delete this collection and move all items within it to the Trash?
       *[other] Are you sure you want to delete { $count } collections and move all items within them to the Trash?
    }
collections-delete-search-title =
    { $count ->
        [one] Delete Search
       *[other] Delete Searches
    }
collections-delete-search-message =
    { $count ->
        [one] Are you sure you want to delete this search?
       *[other] Are you sure you want to delete { $count } searches?
    }
item-creator-moveDown =
    .label = تحريك لأسفل
item-creator-moveToTop =
    .label = تحريك لأعلى
item-creator-moveUp =
    .label = تحريك لأعلى
item-menu-viewAttachment =
    .label =
        فتح { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Snapshot
                    [note] Note
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                    [note] Notes
                   *[other] Attachments
                }
        } { $openIn ->
            [tab] in New Tab
            [window] in New Window
           *[other] { "" }
        }
item-menu-add-file =
    .label = ملف
item-menu-add-linked-file =
    .label = ملف مرتبط
item-menu-add-url =
    .label = رابط الويب
item-menu-change-parent-item =
    .label = تغيير العنصر الأصلي...
item-menu-relate-items =
    .label = ربط العناصر
view-online = العرض على الانترنت
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = تمت إعادة تسمية الملف إلى { $filename }
itembox-button-options =
    .tooltiptext = فتح قائمة السياق
itembox-button-merge =
    .aria-label = حدد إصدار حقل { $field }
create-parent-intro = أدخل رقم DOI أو ISBN أو PMID أو معرف arXiv أو ADS Bibcode لتحديد هذا الملف:
reader-use-dark-mode-for-content =
    .label = استخدام الوضع المظلم للمحتوى
update-updates-found-intro-minor = يتوفر تحديث لـ { -app-name }:
update-updates-found-desc = يوصى بتطبيق هذا التحديث في أقرب وقت ممكن.
import-window =
    .title = استيراد
import-where-from = من أين تريد الاستيراد؟
import-online-intro-title = المقدمة
import-source-file =
    .label = ملف (BibTeX, RIS, Zotero RDF, etc.)
import-source-folder =
    .label = مجلد من ملفات ال PDFs أو ملفات أخرى
import-source-online =
    .label = الاستيراد عبر الإنترنت ل { $targetApp }
import-options = خيارات
import-importing = استيراد...
import-create-collection =
    .label = ضع المجموعات المستوردة والمواد في مجموعة جديدة
import-recreate-structure =
    .label = إعادة إنشاء بنية المجلد كمجموعات
import-fileTypes-header = أنواع الملفات المراد استيرادها:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = ملفات أخرى حسب النمط، مفصولة بفاصلة (على سبيل المثال، *.jpg,*.png)
import-file-handling = معاملة الملف
import-file-handling-store =
    .label = انسخ الملفات إلى مجلد تخزين { -app-name }
import-file-handling-link =
    .label = الارتباط بالملفات في الموقع الأصلي
import-fileHandling-description = لا يمكن مزامنة الملفات المرتبطة بواسطة  { -app-name }.
import-online-new =
    .label = تحميل العناصر الجديدة فقط؛ لا تقم بتحديث العناصر التي تم استيرادها مسبقاً
import-mendeley-username = اسم المستخدم
import-mendeley-password = كلمة المرور
general-error = خطأ
file-interface-import-error = حدث خطأ اثناء محاولة استيراد العنصر الذي اخترته. برجاء التأكد من صحة الملف ثم حاول مرة أخرى.
file-interface-import-complete = اكتمل الاستيراد
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
import-mendeley-encrypted = لا يمكن قراءة قاعدة بيانات مندلي المحددة، على الأرجح لأنها مشفرة. للمزيد من المعلومات راجع <a data-l10n-name="mendeley-import-kb">كيف يمكنني استيراد مكتبة مندلي إلى زوتيرو؟</a>
file-interface-import-error-translator = حدث خطأ في استيراد الملف المحدد بـ “{ $translator }”. يرجى التأكد من صلاحية الملف والمحاولة مرة أخرى.
import-online-intro = في الخطوة التالية، سيُطلب منك تسجيل الدخول إلى { $targetAppOnline } ومنح { -app-name } حق الوصول. هذا ضروري لاستيراد مكتبة { $targetApp } الخاصة بك إلى { -app-name }.
import-online-intro2 = { -app-name }  لن يرى أو يخزن كلمة مرور { $targetApp } أبدًا.
import-online-form-intro = الرجاء إدخال بيانات الاعتماد الخاصة بك لتسجيل الدخول إلى { $targetAppOnline }. هذا ضروري لاستيراد مكتبة { $targetApp } الخاصة بك إلى { -app-name }.
import-online-wrong-credentials = لقد فشل تسجيل الدخول إلى { $targetApp }. يرجى إعادة إدخال بيانات الاعتماد والمحاولة مرة أخرى.
import-online-blocked-by-plugin = لا يمكن متابعة الاستيراد مع تثبيت { $plugin }. يرجى تعطيل هذه الإضافة والمحاولة مرة أخرى.
import-online-relink-only =
    .label = إعادة ربط استشهادات مندلي المكتبية
import-online-relink-kb = { general-more-information }
import-online-connection-error = تعذر على { -app-name } الاتصال ب { $targetApp }. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.
tab-title-multiple-collections = Multiple
items-table-cell-notes =
    .aria-label =
        { $count ->
            [zero] { $count } ملاحظات
            [one] { $count } ملاحظات
            [two] { $count } ملاحظات
            [few] { $count } ملاحظات
            [many] { $count } ملاحظات
           *[other] { $count } ملاحظات
        }
items-column-added-by = Added By
items-column-modified-by = Modified By
items-column-last-read = Last Read
report-error =
    .label = الإبلاغ عن خطأ...
rtfScan-wizard =
    .title = فحص ملف RTF
rtfScan-introPage-description = { -app-name } يمكنه استخراج الاقتباسات وإعادة تنسيقها تلقائيًا وإدراج مراجع في ملفات RTF. يدعم حاليًا الاستشهادات بصيغ مختلفة من التنسيقات التالية:
rtfScan-introPage-description2 = للبدء في العملية، قم بتحديد ملف مدخلات و ملف مخرجات RTF:
rtfScan-input-file = ملف المدخلات:
rtfScan-output-file = ملف المخرجات:
rtfScan-no-file-selected = لم يتم تحديد ملف
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = اختر ملف المدخلات
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = اختر ملف المخرجات
rtfScan-intro-page = المقدمة
rtfScan-scan-page = جاري البحث عن الاستشهادات المرجعية
rtfScan-scanPage-description = { -app-name } يقوم بفحص المستند الخاص بك بحثاً عن الاستشهادات. يرجى التحلي بالصبر.
rtfScan-citations-page = تأكد من صياغة استشهادات العناصر
rtfScan-citations-page-description = يُرجى مراجعة قائمة الاستشهادات المعترف بها أدناه للتأكد من أن { -app-name } قد حدد العناصر المقابلة بشكل صحيح. يجب حل أي استشهادات غير محددة أو غامضة قبل الانتقال إلى الخطوة التالية.
rtfScan-style-page = تنسيق المستند
rtfScan-format-page = صياغة الاستشهادات
rtfScan-format-page-description = { -app-name } يقوم بمعالجة وتنسيق ملف RTF الخاص بك. يرجى التحلي بالصبر.
rtfScan-complete-page = تمت عملية فحص ملف RTF
rtfScan-complete-page-description = تم فحص ومعالجة المستند. برجاء التأكد من انه تم تنسيق الصياغات بشكل صحيح .
rtfScan-action-find-match =
    .title = اختر العنصر المطابق
rtfScan-action-accept-match =
    .title = اقبل هذا التطابق
runJS-title = تشغيل جافا سكريبت
runJS-editor-label = الرمز:
runJS-run = تشغيل
runJS-help = { general-help }
runJS-completed = تم بنجاح
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = التشغيل كوظيفة متزامنة
bibliography-window =
    .title = { -app-name } - إنشاء استشهاد / مراجع
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = عرض الاستشهادات على أنها:
bibliography-advancedOptions-label = خيارات متقدمة
bibliography-outputMode-label = وضع المخرجات:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = قائمة المراجع
bibliography-outputMethod-label = طريقة الاخراج:
bibliography-outputMethod-saveAsRTF =
    .label = حفظ كملف  RTF
bibliography-outputMethod-saveAsHTML =
    .label = حفظ كملف  HTML
bibliography-outputMethod-copyToClipboard =
    .label = انسخ إلى الحافظة
bibliography-outputMethod-print =
    .label = طباعة
bibliography-manageStyles-label = أدر الأنماط...
styleEditor-locatorType =
    .aria-label = نوع محدد الموقع
styleEditor-locatorInput = مدخلات محدد الموقع
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = محرر الأسلوب
styleEditor-preview =
    .aria-label = معاينة
publications-intro-page = منشوراتي
publications-intro = سيتم عرض العناصر التي تضيفها إلى منشوراتي على صفحة ملفك الشخصي على zotero.org. إذا اخترت تضمين الملفات المرفقة، سيتم إتاحتها للجمهور تحت الرخصة التي تحددها. أضف الأعمال التي ألفتها فقط، و لا تضمن الملفات إلا إن كان لديك الحق في توزيعها وترغب في القيام بذلك.
publications-include-checkbox-files =
    .label = تضمين الملفات
publications-include-checkbox-notes =
    .label = تضمين الملاحظات
publications-include-adjust-at-any-time = يمكنك ضبط ما الذي ترغب بعرضه في أي وقت من خلال مجموعة عناصر منشوراتي.
publications-intro-authorship =
    .label = أنا من أنشأ هذا العمل.
publications-intro-authorship-files =
    .label = لقد أنشأت هذا العمل ولدي حقوق توزيع الملفات المضمنة فيه.
publications-sharing-page = اختر الطريقة التي يمكن بها مشاركة عملك
publications-sharing-keep-rights-field =
    .label = الاحتفاظ بحقل الحقوق الحالي
publications-sharing-keep-rights-field-where-available =
    .label = الاحتفاظ بحقل الحقوق الحالي حيثما كان متاحاً
publications-sharing-text = يمكنك حفظ جميع الحقوق لعملك، أو ترخيصها تحت رخصة المشاع الإبداعي، أو هبتها كملكية عامة. في جميع الحالات، سيتاح مؤلفك للجمهور عبر zotero.org.
publications-sharing-prompt = هل ترغب في السماح للآخرين بمشاركة مؤلفك ؟
publications-sharing-reserved =
    .label = لا ، انشر عملي علي zotero.org فقط
publications-sharing-cc =
    .label = نعم ، برخصة المشاع الإبداعي
publications-sharing-cc0 =
    .label = نعم ، و ضع مؤلفي كملكية عامة
publications-license-page = اختر رخصة المشاع الإبداعي
publications-choose-license-text = يسمح ترخيص المشاع الإبداعي للآخرين بنسخ وأعاده توزيع مؤلفك طالما انهم ينسبون العمل حسب الأصول ، ويوفرون رابطا للترخيص ، ويشيرون إلى التغييرات. ويمكن تحديد شروط اضافيه أدناه.
publications-choose-license-adaptations-prompt = السماح بمشاركه التعديلات على مؤلفك ؟
publications-choose-license-yes =
    .label = نعم
    .accesskey = Y
publications-choose-license-no =
    .label = لا
    .accesskey = N
publications-choose-license-sharealike =
    .label = نعم ، طالما ان الآخرين يشاركون بنفس الرخصة
    .accesskey = S
publications-choose-license-commercial-prompt = السماح بالاستخدامات التجارية لعملك ؟
publications-buttons-add-to-my-publications =
    .label = أضف إلى منشوراتي
publications-buttons-next-sharing =
    .label = التالي: المشاركة
publications-buttons-next-choose-license =
    .label = اختر رخصة
licenses-cc-0 = CC0 1.0 إهداء المجال العام العالمي
licenses-cc-by = رخصة المشاع الإبداعي نَسب المُصنَّف 4.0 دولي
licenses-cc-by-nd = رخصة المشاع الإبداعي نَسب المُصنَّف - بدون مشتقات 4.0 رخصة دولية
licenses-cc-by-sa = رخصة المشاع الإبداعي نَسب المُصنَّف - بالمثل 4.0 رخصة دولية
licenses-cc-by-nc = رخصة المشاع الإبداعي نَسب المُصنَّف - غير تجاري 4.0 رخصة دولية
licenses-cc-by-nc-nd = رخصة المشاع الإبداعي نَسب المُصنَّف - غير تجاري - غير مشتقات 4.0 رخصة دولية
licenses-cc-by-nc-sa = رخصة المشاع الإبداعي نَسب المُصنَّف - غير تجاري - بالمثل 4.0 رخصة دولية
licenses-cc-more-info = تأكد من أنك قد قرأت <a data-l10n-name="license-considerations">اعتبارات مرخِّصي</a> المشاع الإبداعي قبل وضع عملك تحت رخصة المشاع الإبداعي. لاحظ أن الرخصة التي تطبقها لا يمكن إلغاؤها، حتى لو اخترت لاحقًا شروطًا مختلفة أو توقفت عن نشر العمل.
licenses-cc0-more-info = تأكد من أنك قرأت <a data-l10n-name="license-considerations">الأسئلة الشائعة الخاصة بالمشاع الإبداعي CC0</a> قبل تطبيق CC0 على عملك. يُرجى ملاحظة أن إهداء عملك إلى المجال العام لا رجعة فيه، حتى لو اخترت لاحقًا شروطًا مختلفة أو توقفت عن نشر العمل.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = إعادة التشغيل في وضع استكشاف الأخطاء وإصلاحها...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = سيتم إعادة تشغيل { -app-name } مع تعطيل جميع المكونات الإضافية. قد لا تعمل بعض الميزات بشكل صحيح أثناء تمكين وضع استكشاف الأخطاء وإصلاحها.
menu-ui-density =
    .label = الكثافة
menu-ui-density-comfortable =
    .label = مريحة
menu-ui-density-compact =
    .label = مدمجة
pane-item-details = تفاصيل العنصر
pane-info = معلومات
pane-abstract = المستخلص
pane-attachments = مرفقات
pane-notes = ملاحظات
pane-note-info = تفاصيل الملاحظة
pane-libraries-collections = المكتبات والمجموعات
pane-tags = أوسمة
pane-related = عناصر ذات صلة
pane-attachment-info = معلومات المرفقات
pane-attachment-preview = معاينة
pane-attachment-annotations = الشروح
pane-header-attachment-associated =
    .label = إعادة تسمية الملف المرتبط
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [zero] { $count } مرفق
            [one] { $count } مرفق
            [two] { $count } مرفقان
            [few] { $count } مرفقات
            [many] { $count } مرفقات
           *[other] { $count } مرفقات
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [zero] { $count } تعليق توضيحي
            [one] { $count } تعليق توضيحي
            [two] { $count } تعليق توضيحي
            [few] { $count } تعليق توضيحي
            [many] { $count } تعليق توضيحي
           *[other] { $count } تعليق توضيحي
        }
section-attachments-move-to-trash-message = هل تريد حقا نقل ”{ $title }“ إلى سلة المهملات؟
section-notes =
    .label =
        { $count ->
            [zero] { $count } ملاحظات
            [one] { $count } ملاحظات
            [two] { $count } ملاحظات
            [few] { $count } ملاحظات
            [many] { $count } ملاحظات
           *[other] { $count } ملاحظات
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [zero] { $count } علامة
            [one] { $count } علامة
            [two] { $count } علامتان
            [few] { $count } علامات
            [many] { $count } علامات
           *[other] { $count } علامات
        }
section-related =
    .label = { $count } ذات الصلة
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = توسيع القسم
    .label = توسيع قسم { $section }
section-button-collapse =
    .dynamic-tooltiptext = طي القسم
    .label = طي قسم { $section }
annotations-count =
    { $count ->
        [zero] { $count } تعليق توضيحي
        [one] { $count } تعليق توضيحي
        [two] { $count } تعليق توضيحي
        [few] { $count } تعليق توضيحي
        [many] { $count } تعليق توضيحي
       *[other] { $count } تعليق توضيحي
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
    .label = نقل القسم لأعلى
sidenav-reorder-down =
    .label = نقل القسم لأسفل
sidenav-reorder-reset =
    .label = إعادة ترتيب الأقسام
toggle-item-pane =
    .tooltiptext = تحويل لوحة العناصر
toggle-context-pane =
    .tooltiptext = تبديل جزء السياق
pin-section =
    .label = تثبيت القسم
unpin-section =
    .label = إلغاء تثبيت القسم
collapse-other-sections =
    .label = طي الأقسام الأخرى
expand-all-sections =
    .label = توسيع جميع الأقسام
abstract-field =
    .placeholder = إضافة ملخص...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = علامات التصنيف
context-notes-search =
    .placeholder = بحث الملاحظات
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = مجموعة عناصر جديدة...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = مجموعة عناصر جديدة
    .buttonlabelaccept = إنشاء المجموعة
new-collection-name = الاسم
new-collection-create-in = أنشئ في:
show-publications-menuitem =
    .label = عرض منشوراتي
attachment-info-title = العنوان
attachment-info-filename = اسم الملف
attachment-info-accessed = تاريخ الدخول
attachment-info-pages = صفحات
attachment-info-modified = تاريخ التعديل
attachment-info-index = مكشف
attachment-info-convert-note =
    .label =
        الترحيل إلى { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } ملاحظة
    .tooltiptext = لم تعد إضافة الملاحظات إلى المرفقات مدعومة، ولكن يمكنك تحرير هذه الملاحظة بترحيلها إلى ملاحظة منفصلة.
section-note-info =
    .label = { pane-note-info }
note-info-title = العنوان
note-info-parent-item = العنصر الأصلي
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] None
    }
    .title =
        { $hasParentItem ->
            [true] View parent item in library
           *[false] View note item in library
        }
note-info-date-created = تم إنشاؤه
note-info-date-modified = تاريخ التعديل
note-info-size = حجم
note-info-word-count = عدد الكلمات
note-info-character-count = عدد الأحرف
item-title-empty-note = ملاحظة بدون عنوان
attachment-preview-placeholder = لا يوجد مرفق للمعاينة
attachment-rename-from-parent =
    .tooltiptext = إعادة تسمية الملف ليتطابق مع العنصر الأصلي
account-log-in = Log In
account-not-logged-in-text = Log in to your Zotero account to sync your data.
account-error-login-session-expired = Your login session has expired. Please try again.
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } معاينة المرفقات
annotation-image-not-available = [Image not available]
quicksearch-mode =
    .aria-label = وضع البحث السريع
quicksearch-input =
    .aria-label = البحث السريع
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
advanced-search = البحث المتقدم
menuitem-advanced-search =
    .label = { advanced-search }
quicksearch-advanced-search-button =
    .tooltiptext = { advanced-search }
    .aria-label = { advanced-search }
advanced-search-close =
    .tooltiptext = Close Advanced Search
advanced-search-expand =
    .tooltiptext = Expand Advanced Search
advanced-search-collapse =
    .tooltiptext = Collapse Advanced Search
item-pane-header-view-as =
    .label = عرض كـ
item-pane-header-none =
    .label = بدون أيقونة
item-pane-header-title =
    .label = العنوان
item-pane-header-titleCreatorYear =
    .label = العنوان، المؤلف، السنة
item-pane-header-bibEntry =
    .label = مدخل المراجع
item-pane-header-more-options =
    .label = المزيد من الخيارات
item-pane-message-items-selected =
    { $count ->
        [0] No items selected
        [one] { $count } item selected
       *[other] { $count } items selected
    }
item-pane-message-collections-selected =
    { $count ->
        [zero] { $count } مجموعة مختارة
        [one] { $count } مجموعة مختارة
        [two] { $count } مجموعتان مختارتان
        [few] { $count } مجموعات مختارة
        [many] { $count } مجموعات مختارة
       *[other] { $count } مجموعات مختارة
    }
item-pane-message-searches-selected =
    { $count ->
        [zero] { $count } عملية بحث محددة
        [one] { $count } عملية بحث محددة
        [two] { $count } عمليتا بحث محددة
        [few] { $count } عمليات بحث محددة
        [many] { $count } عمليات بحث محددة
       *[other] { $count }  عمليات بحث محددة
    }
item-pane-message-objects-selected =
    { $count ->
        [zero] { $count } عنصر مختار
        [one] { $count } عنصر مختار
        [two] { $count } عنصران مختارة
        [few] { $count } عناصر مختارة
        [many] { $count } عناصر مختارة
       *[other] { $count } عناصر مختارة
    }
item-pane-message-unselected =
    { $count ->
        [0] No items in this view
        [one] { $count } item in this view
       *[other] { $count } items in this view
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] No objects in this view
        [one] { $count } object in this view
       *[other] { $count } objects in this view
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [zero] دمج { $count } عنصر
            [one] دمج عنصر واحد { $count }
            [two] دمج عنصرين { $count }
            [few] دمج { $count } عناصر
            [many] دمج { $count } عناصر
           *[other] دمج { $count } عناصر
        }
locate-library-lookup-no-resolver = يجب عليك اختيار محلل من جزء { $pane } من إعدادات { -app-name }.
architecture-win32-warning-message = قم بالتبديل إلى { -app-name } 64 بت للحصول على أفضل أداء. لن تتأثر بياناتك.
architecture-warning-action = قم بتنزيل { -app-name } 64-بت
architecture-x64-on-arm64-message = يعمل { -app-name } في الوضع المحاكي. سيعمل الإصدار الأصلي من { -app-name } بكفاءة أكبر.
architecture-x64-on-arm64-action = قم بتنزيل  { -app-name } ل ARM64
first-run-guidance-authorMenu = { -app-name } يتيح لك تحديد المحررين والمترجمين أيضًا. يمكنك تحويل المؤلف إلى محرر أو مترجم عن طريق التحديد من هذه القائمة.
first-run-guidance-readAloud = { -app-name } can now read your documents to you using natural-sounding voices.
advanced-search-remove-btn =
    .tooltiptext = Remove Condition
advanced-search-add-btn =
    .tooltiptext = Add Condition
advanced-search-group-btn =
    .tooltiptext = Add Condition Group
advanced-search-remove-group-btn =
    .tooltiptext = Remove Group
advanced-search-ungroup-btn =
    .tooltiptext = Ungroup Conditions
advanced-search-result-level-menu =
    .aria-label = Result type
advanced-search-result-level-prefix-root =
    .value = اعثر
advanced-search-join-prefix-root =
    .value = matching
advanced-search-result-level-any =
    .label = any items
advanced-search-result-level-item =
    .label = top-level items
advanced-search-result-level-attachment =
    .label = attachments
advanced-search-result-level-note =
    .label = notes
advanced-search-result-level-annotation =
    .label = تعليقات توضيحية
advanced-search-binding-menu =
    .aria-label = Match against the same item
advanced-search-binding-separate =
    .label = separately
advanced-search-binding-same-attachment =
    .label = in the same attachment
advanced-search-binding-same-note =
    .label = in the same note
advanced-search-binding-same-annotation =
    .label = in the same annotation
advanced-search-of-the-following =
    .value = of the following
advanced-search-binding-hint-attachment =
    .value = These conditions can match separate attachments.
advanced-search-binding-hint-note =
    .value = These conditions can match separate notes.
advanced-search-binding-hint-annotation =
    .value = These conditions can match separate annotations.
advanced-search-level-warning-mixed = These conditions cannot all match the same item, so this search will never return results. Try matching “{ $matchAny }” of them, or set the result type to “{ $topLevelItems }”.
advanced-search-level-warning-unreachable = This search has a condition that cannot apply to the chosen result type. Set the result type to “{ $topLevelItems }” or remove the incompatible condition.
advanced-search-group-warning-unreachable =
    A condition here cannot be in the same { $entity ->
        [attachment] attachment
        [note] note
       *[annotation] annotation
    }. Match these separately or remove the incompatible condition.
advanced-search-group-warning-mixed = These conditions cannot all match the same item, so this group will never match. Try matching “{ $matchAny }” of them, or set the result type to “{ $topLevelItems }”.
advanced-search-bind-same-attachment =
    .label = Match the same attachment
advanced-search-bind-same-note =
    .label = Match the same note
advanced-search-bind-same-annotation =
    .label = Match the same annotation
advanced-search-conditions-menu =
    .aria-label = شرط البحث
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = المشغل
    .label = { $label }
advanced-search-condition-input =
    .aria-label = القيمة
    .label = { $label }
search-operator-isEmpty = is empty
search-operator-isNotEmpty = is not empty
search-conditions-tooltip-fields = الحقول:
search-conditions-collection = مجموعة العناصر
search-conditions-savedSearch = بحث مخزن
search-conditions-itemTypeID = نوع العنصر
search-conditions-tag = وسم
search-conditions-numTags = # of Tags
search-conditions-numNotes = # of Notes
search-conditions-numAttachments = # of Attachments
search-conditions-numAnnotations = # of Annotations
search-conditions-note = ملاحظة
search-conditions-childNote = ملحوظة فرعية
search-conditions-creator = المؤلف
search-conditions-thesisType = نوع الأطروحة
search-conditions-reportType = نوع التقرير
search-conditions-videoRecordingFormat = صيغة التسجيل المرئي
search-conditions-audioFileType = نوع ملف الصوت
search-conditions-audioRecordingFormat = صيغة التسجيل الصوتي
search-conditions-letterType = نوع الخطاب
search-conditions-interviewMedium = وسيط المقابلة
search-conditions-manuscriptType = نوع المخطوطة
search-conditions-presentationType = نوع العرض التقديمي
search-conditions-mapType = نوع الخريطة
search-conditions-artworkMedium = وسيط العمل الفني
search-conditions-dateModified = تاريخ التعديل
search-conditions-fulltextContent = محتويات المرفق
search-conditions-programmingLanguage = لغة البرمجة
search-conditions-fileTypeID = نوع الملف المرفق
search-conditions-attachmentStorageType = Attachment Storage Type
search-conditions-lastRead = Attachment Last Read
search-conditions-annotationText = نص التعليق
search-conditions-annotationComment = تعليق توضيحي
search-conditions-annotationType = Annotation Type
search-conditions-annotationColor = Annotation Color
search-conditions-annotationAuthor = Annotation Author
search-conditions-anyField = أي حقل
search-conditions-titleCreatorYear = العنوان، المؤلف، السنة
search-conditions-submenu-attachment = مُرفق
search-conditions-submenu-annotation = التعليق التوضيحي
search-conditions-short-fulltextContent = Content
search-conditions-short-fileTypeID = نوع الملف الصوتي
search-conditions-short-attachmentStorageType = Storage Type
search-conditions-short-lastRead = Last Read
search-conditions-short-annotationText = Text
search-conditions-short-annotationComment = Comment
search-conditions-short-annotationType = النوع
search-conditions-short-annotationColor = Color
search-conditions-short-annotationAuthor = المؤلف
find-pdf-files-added =
    { $count ->
        [zero] { $count } ملف مضاف
        [one] { $count } ملف مضاف
        [two] { $count } ملفان مضافان
        [few] { $count } ملفات مضافة
        [many] { $count } ملفات مضافة
       *[other] { $count } ملفات مضافة
    }
select-items-window =
    .title = تحديد العناصر
select-items-dialog =
    .buttonlabelaccept = اختر
select-items-convertToStandalone =
    .label = التحويل إلى مستقل بذاته
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [zero] التحويل إلى مرفق مستقل
            [one] التحويل إلى مرفق مستقل
            [two] التحويل إلى مرفقان مستقلان
            [few] التحويل إلى مرفقات مستقلة
            [many] التحويل إلى مرفقات مستقلة
           *[other] التحويل إلى مرفقات مستقلة
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [zero] التحويل إلى ملاحظات مستقلة بذاتها
            [one] التحويل إلى ملاحظات مستقلة بذاتها
            [two] التحويل إلى ملاحظات مستقلة بذاتها
            [few] التحويل إلى ملاحظات مستقلة بذاتها
            [many] التحويل إلى ملاحظات مستقلة بذاتها
           *[other] التحويل إلى ملاحظات مستقلة بذاتها
        }
file-type-webpage = صفحة الويب
file-type-image = صورة
file-type-pdf = PDF
file-type-audio = صوت
file-type-video = فيديو
file-type-presentation = عرض تقديمي
file-type-document = مستند
file-type-ebook = الكتاب الإلكتروني
attachment-storage-type-storedFile = Stored File
attachment-storage-type-linkedFile = Linked File
attachment-storage-type-webLink = Web Link
post-upgrade-message = لقد تمت ترقيتك إلى <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! تعرف على <a data-l10n-name="new-features-link">ما الجديد</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = لصق وبحث
mac-word-plugin-install-message = يحتاج زوتيرو إلى الوصول إلى بيانات وورد لتثبيت إضافة وورد.
mac-word-plugin-install-folder-message = { -app-name } needs access to Word’s startup folder to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = تثبيت مكون وورد إضافي
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Install the plugin in the Word startup folder
mac-word-plugin-install-folder-dialog-button = تنصيب
mac-word-plugin-install-wrong-folder-selected = The suggested folder must be selected. Please try again without choosing a different folder.
file-renaming-banner-message = { -app-name } يقوم الآن تلقائيًا بمزامنة أسماء ملفات المرفقات عند إجراء تغييرات على العناصر.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = يجب تحديث موصل { -app-name } لكي يعمل مع هذا الإصدار من { -app-name }.
userjs-pref-warning = تم تجاوز بعض إعدادات { -app-name } باستخدام طريقة غير مدعومة. سيقوم { -app-name } بإعادتها وإعادة التشغيل.
migrate-extra-fields-progress-message = Migrating new fields from Extra field
search-normalization-progress-message = Indexing items for search
long-tag-fixer-window-title =
    .title = علامات التقسيم
long-tag-fixer-button-dont-split =
    .label = لا تقسم
menu-normalize-attachment-titles =
    .label = توحيد عناوين المرفقات...
normalize-attachment-titles-title = توحيد عناوين المرفقات
normalize-attachment-titles-text =
    يقوم { -app-name } تلقائيًا بإعادة تسمية الملفات الموجودة على القرص باستخدام بيانات تعريف العنصر الأصلي، ولكنه يستخدم عناوين منفصلة وأبسط مثل ”Full Text PDF” أو ”Preprint PDF” أو ”PDF” للمرفقات الأساسية للحفاظ على قائمة العناصر أكثر نظافة وتجنب تكرار المعلومات.
    
    في الإصدارات القديمة من { -app-name }، وكذلك عند استخدام بعض المكونات الإضافية، يمكن تغيير عناوين المرفقات دون داعٍ لتتطابق مع أسماء الملفات.
    
    هل ترغب في تحديث المرفقات المحددة لاستخدام عناوين أبسط؟ سيتم تغيير المرفقات الأساسية التي تتطابق عناوينها مع اسم الملف فقط.
banner-close-button =
    .aria-label = Dismiss notification
plugins-blocked-plugin =
    .message = This plugin has been disabled by { -app-name }.
data-dir-unsupported-storage = This can happen if the { -app-name } data directory is in a cloud storage folder (OneDrive, Dropbox, etc.) or on a network share.
login-manager-reset = { -app-name } was unable to read your saved login information, so it has been reset. Please log in again in the { preferences-pane-account } pane of the { -app-name } settings.
os-keystore-save-failed =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t access the { -os-name } Keychain to securely save your credentials. Make sure your Keychain is accessible and try again.
        [windows] { -app-name } couldn’t securely save your credentials. Try again or restart { -app-name }.
       *[other] { -app-name } couldn’t access your { -os-name } keyring to securely save your credentials. Make sure a keyring service is running and try again.
    }
os-keystore-migrate-failed =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t access the { -os-name } Keychain to encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Make sure your Keychain is accessible and restart { -app-name }.
        [windows] { -app-name } couldn’t encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Restart { -app-name } and try again.
       *[other] { -app-name } couldn’t access your { -os-name } keyring to encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Make sure a keyring service is running and restart { -app-name }.
    }
search-button =
    .label = بحث
save-search-new-button =
    .label = Save Search…
save-search-edit-button =
    .label = حفظ
save-search-name-title = حفظ البحث
save-search-name-message = Enter a name for the saved search:
saved-search-close-confirmation-title = Editing Saved Search
saved-search-close-confirmation-body = Do you want to save changes you made to this saved search?
item-pane-batch-editing-prompt =
    .aria-label = Batch editing
item-pane-batch-editing-enable =
    .label = Edit Multiple Items…
item-pane-batch-editing-multiple-values-placeholder = Multiple
item-pane-batch-editing-clear-values = Clear all values
item-pane-batch-editing-header =
    { $count ->
        [one] Editing { $count } item
       *[other] Editing { $count } items
    }
item-pane-batch-editing-done =
    .label = { general-done }
undo-action-edit-metadata =
    { $count ->
        [one] Edit Metadata
       *[other] Edit Metadata for { $count } Items
    }
undo-action-edit-field =
    { $count ->
        [one] Edit of “{ $field }”
       *[other] Edit of “{ $field }” for { $count } Items
    }
undo-action-normalize-attachment-titles = Normalize Attachment Title
undo-action-trash =
    { $count ->
        [one] Trash Item
       *[other] Trash { $count } Items
    }
undo-action-restore-items =
    { $count ->
        [one] Restore Item
       *[other] Restore { $count } Items
    }
undo-action-trash-collection =
    { $count ->
        [one] Trash Collection
       *[other] Trash { $count } Collections
    }
undo-action-trash-search =
    { $count ->
        [one] Trash Saved Search
       *[other] Trash { $count } Saved Searches
    }
undo-action-restore-collection =
    { $count ->
        [one] Restore Collection
       *[other] Restore { $count } Collections
    }
undo-action-restore-objects =
    { $count ->
        [one] Restore Object
       *[other] Restore { $count } Objects
    }
undo-action-add-to-collection =
    { $count ->
        [one] Add to Collection
       *[other] Add { $count } Items to Collection
    }
undo-action-remove-from-collection =
    { $count ->
        [one] Remove from Collection
       *[other] Remove { $count } Items from Collection
    }
undo-action-move-to-collection =
    { $count ->
        [one] Move to Collection
       *[other] Move { $count } Items to Collection
    }
undo-action-rename-collection = إعادة تسمية المجموعة
undo-action-move-collection = Move Collection
undo-action-add-tag =
    { $count ->
        [one] Add Tag
       *[other] Add Tag to { $count } Items
    }
undo-action-change-tag = Change Tag
undo-action-split-tag = Split Tag
undo-action-remove-tag =
    { $count ->
        [one] Remove Tag
       *[other] Remove Tag from { $count } Items
    }
undo-action-remove-tags-from-item =
    { $count ->
        [one] Remove Tag
       *[other] Remove { $count } Tags
    }
undo-action-remove-all-tags = Remove All Tags
undo-action-edit-note = تحرير ملاحظة
undo-action-add-creator = Add Creator
undo-action-remove-creator = Remove Creator
undo-action-edit-creator = Edit Creator
undo-action-reorder-creator = Reorder Creator
undo-action-change-type = تغيير نوع العنصر
undo-action-change-parent-item =
    { $count ->
        [one] Change Parent Item
       *[other] Change Parent for { $count } Items
    }
undo-action-convert-to-standalone =
    { $count ->
        [one] Convert to Standalone
       *[other] Convert { $count } Items to Standalone
    }
undo-action-add-related = Add Related
undo-action-remove-related = Remove Related
undo-action-merge-items =
    { $count ->
        [one] Merge Item
       *[other] Merge { $count } Items
    }
menu-edit-undo-action = Undo { $action }
menu-edit-redo-action = Redo { $action }
