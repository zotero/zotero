preferences-window =
    .title = إعدادات { -app-name }
preferences-appearance-title = المظهر واللغة
preferences-auto-recognize-files =
    .label = استرداد البيانات الوصفية لملفات PDF والكتب الإلكترونية تلقائياً
preferences-file-renaming-title = إعادة تسمية الملف
preferences-file-renaming-intro = { -app-name } can automatically rename files based on the details of the parent item (title, author, etc.) and keep the filenames in sync as you make changes. Downloaded files are always initially named based on the parent item.
preferences-file-renaming-auto-rename-files =
    .label = Automatically rename files
preferences-file-renaming-file-types = إعادة تسمية الملفات من هذه الأنواع:
preferences-file-renaming-file-type-pdf =
    .label = { file-type-pdf }
preferences-file-renaming-file-type-epub =
    .label = { file-type-ebook }
preferences-file-renaming-file-type-image =
    .label = { file-type-image }
preferences-file-renaming-file-type-audio =
    .label = { file-type-audio }
preferences-file-renaming-file-type-video =
    .label = { file-type-video }
preferences-file-renaming-customize-button =
    .label = تخصيص صيغة اسم الملف...
preferences-file-renaming-rename-now =
    .label = Rename Files…
preferences-file-renaming-format-title = صيغة اسم الملف
preferences-file-renaming-format-instructions = يمكنك تخصيص نمط اسم الملف الذي يستخدمه { -app-name } لإعادة تسمية الملفات المرفقة من البيانات الوصفية الأصلية.
preferences-file-renaming-format-instructions-example = على سبيل المثال، سيتم استبدال “{ $example }”  في هذا القالب بعنوان العنصر الرئيسي، مقتطعًا من 50 حرفًا.
preferences-file-renaming-format-instructions-more = راجع <label data-l10n-name="file-renaming-format-help-link">الوثائق</label> لمزيد من المعلومات.
preferences-file-renaming-format-template = قالب اسم الملف:
preferences-file-renaming-format-preview = معاينة:
preferences-reader-title = القارئ
preferences-reader-open-epubs-using = فتح ملفات EPUBs باستخدام
preferences-reader-open-snapshots-using = فتح اللقطات باستخدام
preferences-reader-open-in-new-window =
    .label = فتح الملفات في نوافذ جديدة بدلاً من علامات التبويب
preferences-reader-auto-disable-tool =
    .label = Turn off note, text, and image annotation tools after each use
preferences-reader-ebook-font = خط الكتاب الإلكتروني:
preferences-reader-ebook-hyphenate =
    .label = تفعيل الوصل التلقائي
preferences-color-scheme = نظام الألوان:
preferences-color-scheme-auto =
    .label = تلقائي
preferences-color-scheme-light =
    .label = فاتح
preferences-color-scheme-dark =
    .label = مظلم
preferences-item-pane-header = رأس جزء العنصر:
preferences-item-pane-header-style = نمط الاستشهاد في الرأس:
preferences-item-pane-header-locale = لغة الرأس:
preferences-item-pane-header-missing-style = أسلوب مفقود: <{ $shortName }>
preferences-locate-library-lookup-intro = يمكن "للبحث عن المكتبة" العثور على مورد عبر الإنترنت باستخدام محلل OpenURL الخاص بمكتبتك.
preferences-locate-resolver = رابط المقرر:
preferences-locate-base-url = الرابط الأساسي:
preferences-quickCopy-minus =
    .aria-label = { general-remove }
    .label = { $label }
preferences-quickCopy-plus =
    .aria-label = { general-add }
    .label = { $label }
preferences-styleManager-intro = { -app-name } can generate citations and bibliographies in over 10,000 citation styles. Add styles here to make them available when selecting styles throughout { -app-name }.
preferences-styleManager-get-additional-styles =
    .label = Get Additional Styles…
preferences-styleManager-restore-default =
    .label = Restore Default Styles…
preferences-styleManager-add-from-file =
    .tooltiptext = إضافة نمط من ملف
    .label = Add from File…
preferences-styleManager-remove = Press { delete-or-backspace } to remove this style.
preferences-citation-dialog = Citation Dialog
preferences-citation-dialog-mode = Citation Dialog Mode:
preferences-citation-dialog-mode-last-used =
    .label = Last Used
preferences-citation-dialog-mode-list =
    .label = List Mode
preferences-citation-dialog-mode-library =
    .label = Library Mode
preferences-advanced-enable-local-api =
    .label = السماح للتطبيقات الأخرى على هذا الحاسوب بالاتصال ب  { -app-name }
preferences-advanced-local-api-available = متاح على <code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = إن خادم HTTP { -app-name } معطل.
preferences-advanced-server-enable-and-restart =
    .label = تفعيل وإعادة التشغيل
preferences-advanced-language-and-region-title = اللغة والمنطقة
preferences-advanced-enable-bidi-ui =
    .label = تمكين أدوات تحرير النصوص ثنائية الاتجاه
preferences-advanced-reset-data-dir =
    .label = العودة إلى الموقع الافتراضي...
preferences-advanced-custom-data-dir =
    .label = استخدم موقع خاص...
preferences-advanced-default-data-dir =
    .value = (Default: { $directory })
    .aria-label = الموقع الافتراضي
preferences-sync-reset-restore-to-server-body = { -app-name } will replace “{ $libraryName }” on { $domain } with data from this computer.
preferences-sync-reset-restore-to-server-deleted-items-text =
    { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] item
       *[other] items
    } in the online library will be permanently deleted.
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] The library on this computer and the online library will be empty.
        [one] 1 item will remain on this computer and in the online library.
       *[other] { $localItemsCount } items will remain on this computer and in the online library.
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
        [one] Delete 1 item
       *[other] Delete { $remoteItemsDeletedCount } items
    }
preferences-sync-reset-restore-to-server-confirmation-text = delete online library
preferences-sync-reset-restore-to-server-yes = استبدال البيانات في المكتبة الإلكترونية
