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
general-print = הדפסה
general-remove = הסרה
general-add = הוספה
general-remind-me-later = להזכיר לי אחר כך
general-dont-ask-again = לא לשאול שוב
general-choose-file = בחירת קובץ…
general-open-settings = פתיחת הגדרות
general-settings = Settings…
general-help = עזרה
general-tag = תגית
general-got-it = Got It
general-done = בוצע
general-view-troubleshooting-instructions = הצגת הנחיות טיפול בתקלות
general-go-back = חזרה
general-accept = Accept
general-cancel = ביטול
cancel-button =
    .label = { general-cancel }
general-show-in-library = הצגה בספרייה
general-restartApp = Restart { -app-name }
general-restartInTroubleshootingMode = Restart in Troubleshooting Mode
general-save = שמירה
general-clear = פינוי
clear-button =
    .label = { general-clear }
general-update = עדכון
general-back = אחורה
general-edit = עריכה
general-cut = גזירה
general-copy = העתקה
general-paste = הדבקה
general-find = איתור
general-delete = מחיקה
general-insert = הוספה
general-and = וגם
general-et-al = ועוד
general-previous = הקודם
general-next = הבא
general-learn-more = מידע נוסף
general-more-information = פרטים נוספים
general-warning = אזהרה
general-type-to-continue = Type “{ $text }” to continue.
general-continue = להמשיך
general-red = אדום
general-orange = כתום
general-yellow = צהוב
general-green = ירוק
general-teal = Teal
general-blue = כחול
general-purple = סגול
general-magenta = Magenta
general-violet = סגול
general-maroon = ערמון
general-gray = אפור
general-black = שחור
general-loading = בטעינה…
db-checking-integrity = Checking database integrity…
db-repairing = Repairing database…
citation-style-label = סגנון ציטוט:
language-label = שפה:
menu-custom-group-submenu =
    .label = More Options…
menu-file-show-in-finder =
    .label = הצגה ב־Finder
menu-file-show-file =
    .label = הצגת קובץ
menu-file-show-files =
    .label = הצגת קבצים
menu-print =
    .label = { general-print }
menu-density =
    .label = צפיפות
add-attachment = צירוף קובץ
new-note = הערה חדשה
menu-add-by-identifier =
    .label = הוספה לפי מזהה…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = הוספת קובץ…
menu-add-standalone-linked-file-attachment =
    .label = הוספת קישור לקובץ…
menu-add-child-file-attachment =
    .label = צירוף קובץ…
menu-add-child-linked-file-attachment =
    .label = צירוף קישור לקובץ…
menu-add-child-linked-url-attachment =
    .label = צירוף קישור לאתר…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = הערה עצמאית חדשה
menu-new-item-note =
    .label = פתקית פריט חדש
menu-restoreToLibrary =
    .label = שחזור לספרייה
menu-deletePermanently =
    .label = מחיקה לצמיתות…
menu-tools-plugins =
    .label = תוספים
menu-view-columns-move-left =
    .label = העברת עמודה שמאלה
menu-view-columns-move-right =
    .label = העברת עמודה ימינה
menu-view-hide-context-annotation-rows =
    .label = Hide Non-Matching Annotations
menu-view-note-font-size =
    .label = גודל גופן הערה
menu-view-note-tab-font-size =
    .label = Note Tab Font Size
menu-show-tabs-menu =
    .label = Show Tabs Menu
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Copy Annotation
           *[other] Copy { $count } Annotations
        }
main-window-command =
    .label = ספרייה
main-window-key =
    .key = נ
zotero-toolbar-tabs-menu =
    .tooltiptext = הצגת כל הלשוניות
filter-collections = סינון אוספים
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = חיפוש בלשוניות
zotero-tabs-menu-close-button =
    .title = סגירת לשונית
zotero-toolbar-tabs-scroll-forwards =
    .title = Scroll forwards
zotero-toolbar-tabs-scroll-backwards =
    .title = Scroll backwards
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
recently-read = Recently Read
collections-menu-show-recently-read =
    .label = Show { recently-read }
item-menu-remove-from-recently-read =
    .label = Remove from { recently-read }…
items-section-collections-selected =
    { $count ->
        [one] { $count } collection selected
       *[other] { $count } collections selected
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
edit-saved-search = ערוך חיפושים שמורים
collections-menu-edit-search =
    .label = Edit Search
collections-menu-duplicate-search =
    .label = Duplicate Search
collections-menu-move-collection =
    .label = העברה אל
collections-menu-copy-collection =
    .label = העתקה אל
collections-menu-export =
    .label = ייצוא…
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
    .label = הורדה באחד
item-creator-moveToTop =
    .label = העברה לראש
item-creator-moveUp =
    .label = העלאה באחד
item-menu-viewAttachment =
    .label =
        Open { $numAttachments ->
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
    .label = קובץ
item-menu-add-linked-file =
    .label = קובץ מקושר
item-menu-add-url =
    .label = קישור לאתר
item-menu-change-parent-item =
    .label = החלפת פריט הורה…
item-menu-relate-items =
    .label = Relate Items
view-online = הצגה באתר
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = שם הקובץ השתנה ל־{ $filename }
itembox-button-options =
    .tooltiptext = פתיחת תפריט הקשר
itembox-button-merge =
    .aria-label = בחירת גרסה של השדה { $field }
create-parent-intro = Enter a DOI, ISBN, PMID, arXiv ID, or ADS Bibcode to identify this file:
reader-use-dark-mode-for-content =
    .label = להשתמש במצב כהה לתוכן
update-updates-found-intro-minor = יש עדכון של { -app-name }:
update-updates-found-desc = מומלץ להחיל את העדכון הזה במהירות האפשרית.
import-window =
    .title = ייבוא
import-where-from = מאיפה לייבא?
import-online-intro-title = היכרות
import-source-file =
    .label = קובץ (BibTeX,‏ RIS,‏ Zotero RDF וכו׳)
import-source-folder =
    .label = תיקיית PDFים וקבצים אחרים
import-source-online =
    .label = ייבוא מקוון מתוך { $targetApp }
import-options = אפשרויות
import-importing = מתבצע ייבוא…
import-create-collection =
    .label = העברת האוספים והפריטים המיובאים לאוסף חדש
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = סוגי קבצים לייבוא:
import-fileTypes-pdf =
    .label = PDFים
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = טיפול בקבצים
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = קישור לקבצים במיקום המקורי
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = הורדת פריטים חדשים בלבד, לא לעדכן את הפריטים שיובאו קודם לכן
import-mendeley-username = שם משתמש
import-mendeley-password = סיסמה
general-error = שגיאה
file-interface-import-error = An error occurred while trying to import the selected file. Please ensure that the file is valid and try again.
file-interface-import-complete = הייבוא הושלם
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
    .label = Relink Mendeley Desktop citations
import-online-relink-kb = { general-more-information }
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
tab-title-multiple-collections = Multiple
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
items-column-added-by = Added By
items-column-modified-by = Modified By
items-column-last-read = Last Read
report-error =
    .label = דיווח על שגיאה…
rtfScan-wizard =
    .title = סריקת RTF
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. It currently supports citations in variations of the following formats:
rtfScan-introPage-description2 = כדי להתחיל, יש לבחור קובץ קלט RTF וקובץ פלט להלן:
rtfScan-input-file = קובץ קלט:
rtfScan-output-file = קובץ פלט:
rtfScan-no-file-selected = לא נבחר קובץ
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = בחירת קובץ קלט
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = בחירת קובץ פלט
rtfScan-intro-page = היכרות
rtfScan-scan-page = סורק אחר ציטוטים
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page = אימות פריטים מצוטטים
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page = עיצוב מסמך
rtfScan-format-page = עיצוב ציטוטים
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page = סקירת ה־RTF הושלמה
rtfScan-complete-page-description = המסמך שלך נסרק ועבר עיבוד כעת. נא לוודא שהוא מעוצב כראוי.
rtfScan-action-find-match =
    .title = בחירת פריט תואם
rtfScan-action-accept-match =
    .title = אישור ההתאמה הזאת
runJS-title = הרצת JavaScript
runJS-editor-label = קוד:
runJS-run = הרצה
runJS-help = { general-help }
runJS-completed = completed successfully
runJS-result =
    { $type ->
        [async] ערך שהוחזר:
       *[other] תוצאה:
    }
runJS-run-async = הרצה כפונקציה אסינכרונית
bibliography-window =
    .title = { -app-name } - Create Citation/Bibliography
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = הצגת ציטוטים בתור:
bibliography-advancedOptions-label = אפשרויות מתקדמות
bibliography-outputMode-label = שיטת פלט:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = ביבליוגרפיה
bibliography-outputMethod-label = שיטת פלט:
bibliography-outputMethod-saveAsRTF =
    .label = שמירה כ־RTF
bibliography-outputMethod-saveAsHTML =
    .label = שמירה כ־HTML
bibliography-outputMethod-copyToClipboard =
    .label = העתקה ללוח הגזירים
bibliography-outputMethod-print =
    .label = הדפסה
bibliography-manageStyles-label = ניהול סגנונות…
styleEditor-locatorType =
    .aria-label = Locator type
styleEditor-locatorInput = Locator input
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Style editor
styleEditor-preview =
    .aria-label = Preview
publications-intro-page = הפרסומים שלי
publications-intro = פריטים שנוספים ל„פרסומים שלי” יופיעו בעמוד הפרופיל שלך ב־zotero.org. אם בחרת לצרף קבצים הם ייחשפו לקהל הרחב בכפוף לרישיון שציינת. יש להוסיף אך ורק יצירה מקורית שלך ולצרף אך ורק קבצים שיש לך זכויות להפיץ ושיש לך רצון בכך.
publications-include-checkbox-files =
    .label = צירוף קבצים
publications-include-checkbox-notes =
    .label = צירוף הערות
publications-include-adjust-at-any-time = אפשר לכוון מה להציג בכל עת מהאוסף „הפרסומים שלי”.
publications-intro-authorship =
    .label = זאת יצירה מקורית שלי.
publications-intro-authorship-files =
    .label = זאת יצירה מקורית שלי ויש את הזכויות להפיץ את הקבצים שנכללו.
publications-sharing-page = נא לבחור כיצד יש לשתף את היצירה שלך
publications-sharing-keep-rights-field =
    .label = Keep the existing Rights field
publications-sharing-keep-rights-field-where-available =
    .label = Keep the existing Rights field where available
publications-sharing-text = מותר לך לשמור לעצמך את כל הזכויות על יצירתך, להגיש את היצירה בכפוף לרישון Creative Commons או להעניק אותה לנחלת הכלל. בכל המקרים, היצירה תהיה זמינה לקהל הרחב דרך zotero.org.
publications-sharing-prompt = לאפשר לשתף את היצירה שלך עם אחרים?
publications-sharing-reserved =
    .label = לא, רק לפרסם את היצירה שלי דרך zotero.org
publications-sharing-cc =
    .label = כן, תחת רישיון Creative Commons
publications-sharing-cc0 =
    .label = כן, ולהפיץ את היצירה שלי לנחלת הכלל
publications-license-page = נא לבחור רישיון Creative Commons
publications-choose-license-text = רישיון Creative Commons מאפשר לאחרים להעתיק ולהפיץ מחדש את היצירה שלך כל עוד מצורפת אליה הוקרה ליוצרים, קישור לרישיון ולציין שבוצעו בה שינויים. אפשר לציין תנאים נוספים להלן.
publications-choose-license-adaptations-prompt = לאפשר הפצה של גירסאות ערוכות של היצירה שלך?
publications-choose-license-yes =
    .label = כן
    .accesskey = Y
publications-choose-license-no =
    .label = לא
    .accesskey = N
publications-choose-license-sharealike =
    .label = כן, כל עוד תנאי השיתוף זהים
    .accesskey = ש
publications-choose-license-commercial-prompt = לאפשר שימוש מסחרי ביצירה שלך?
publications-buttons-add-to-my-publications =
    .label = הוספה לפרסומים שלי
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = בחירת רישיון
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Attribution 4.0 International License
licenses-cc-by-nd = Creative Commons Attribution-NoDerivatives 4.0 International License
licenses-cc-by-sa = Creative Commons Attribution-ShareAlike 4.0 International License
licenses-cc-by-nc = Creative Commons Attribution-NonCommercial 4.0 International License
licenses-cc-by-nc-nd = Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License
licenses-cc-by-nc-sa = Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = ק
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = צפיפות
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-item-details = Item Details
pane-info = מידע
pane-abstract = תקציר
pane-attachments = צרופות
pane-notes = הערות
pane-note-info = Note Info
pane-libraries-collections = Libraries and Collections
pane-tags = תגיות
pane-related = קשור
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = הסברים
pane-header-attachment-associated =
    .label = שינוי שם לקובץ משויך
item-details-pane =
    .aria-label = { pane-item-details }
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
section-attachments-move-to-trash-message = Are you sure you want to move “{ $title }” to the trash?
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
    .label = Move Section Up
sidenav-reorder-down =
    .label = Move Section Down
sidenav-reorder-reset =
    .label = Reset Section Order
toggle-item-pane =
    .tooltiptext = Toggle Item Pane
toggle-context-pane =
    .tooltiptext = Toggle Context Pane
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
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = אוסף חדש…
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = אוסף חדש
    .buttonlabelaccept = Create Collection
new-collection-name = שם:
new-collection-create-in = Create in:
show-publications-menuitem =
    .label = Show My Publications
attachment-info-title = כותרת
attachment-info-filename = שם קובץ
attachment-info-accessed = מועד גישה
attachment-info-pages = עמודים
attachment-info-modified = שונה
attachment-info-index = נוסף למפתח
attachment-info-convert-note =
    .label =
        Migrate to { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } Note
    .tooltiptext = Adding notes to attachments is no longer supported, but you can edit this note by migrating it to a separate note.
section-note-info =
    .label = { pane-note-info }
note-info-title = כותרת
note-info-parent-item = Parent Item
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
note-info-date-created = Created
note-info-date-modified = שונה
note-info-size = גודל
note-info-word-count = Word Count
note-info-character-count = Character Count
item-title-empty-note = הערה בלי כותרת
attachment-preview-placeholder = No attachment to preview
attachment-rename-from-parent =
    .tooltiptext = Rename File to Match Parent Item
account-log-in = Log In
account-not-logged-in-text = Log in to your Zotero account to sync your data.
account-error-login-session-expired = Your login session has expired. Please try again.
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } Attachment Preview
annotation-image-not-available = [Image not available]
quicksearch-mode =
    .aria-label = Quick Search mode
quicksearch-input =
    .aria-label = חיפוש מהיר
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
advanced-search = חיפוש מתקדם
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
    .label = View As
item-pane-header-none =
    .label = None
item-pane-header-title =
    .label = כותרת
item-pane-header-titleCreatorYear =
    .label = כותרת, יוצר/ת, שנה
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
item-pane-message-objects-unselected =
    { $count ->
        [0] No objects in this view
        [one] { $count } object in this view
       *[other] { $count } objects in this view
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Merge { $count } item
           *[other] Merge { $count } items
        }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = Switch to 64-bit { -app-name } for the best performance. Your data won’t be affected.
architecture-warning-action = Download 64-bit { -app-name }
architecture-x64-on-arm64-message = { -app-name } is running in emulated mode. A native version of { -app-name } will run more efficiently.
architecture-x64-on-arm64-action = Download { -app-name } for ARM64
first-run-guidance-authorMenu = { -app-name } lets you specify editors and translators too. You can turn an author into an editor or translator by selecting from this menu.
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
    .value = איתור
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
    .label = הסברים
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
    .aria-label = Search condition
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Value
    .label = { $label }
search-operator-isEmpty = is empty
search-operator-isNotEmpty = is not empty
search-conditions-tooltip-fields = שדות
search-conditions-collection = אוסף
search-conditions-savedSearch = חיפוש שמור
search-conditions-itemTypeID = סוג פריט
search-conditions-tag = תגית
search-conditions-numTags = # of Tags
search-conditions-numNotes = # of Notes
search-conditions-numAttachments = # of Attachments
search-conditions-numAnnotations = # of Annotations
search-conditions-note = הערה
search-conditions-childNote = הערת צאצא
search-conditions-creator = יוצר
search-conditions-thesisType = סוג תזה
search-conditions-reportType = סוג דוח
search-conditions-videoRecordingFormat = תצורת הקלטת וידאו
search-conditions-audioFileType = סוג קובץ שמע
search-conditions-audioRecordingFormat = תצורת הקלטת שמע
search-conditions-letterType = סוג מכתב
search-conditions-interviewMedium = אמצעי ריאיונות
search-conditions-manuscriptType = סוג כתב יד
search-conditions-presentationType = סוג מצגת
search-conditions-mapType = סוג מפה
search-conditions-artworkMedium = אמצעי אומנותי
search-conditions-dateModified = תאריך שינוי
search-conditions-fulltextContent = תוכן מצורף
search-conditions-programmingLanguage = שפת תכנות
search-conditions-fileTypeID = סוג קובץ מצורף
search-conditions-attachmentStorageType = Attachment Storage Type
search-conditions-lastRead = Attachment Last Read
search-conditions-annotationText = טקסט הסבר
search-conditions-annotationComment = הערת הסבר
search-conditions-annotationType = Annotation Type
search-conditions-annotationColor = Annotation Color
search-conditions-annotationAuthor = Annotation Author
search-conditions-anyField = Any Field
search-conditions-titleCreatorYear = כותרת, יוצר/ת, שנה
search-conditions-submenu-attachment = קובץ מצורף
search-conditions-submenu-annotation = הסבר
search-conditions-short-fulltextContent = Content
search-conditions-short-fileTypeID = סוג קובץ
search-conditions-short-attachmentStorageType = Storage Type
search-conditions-short-lastRead = Last Read
search-conditions-short-annotationText = Text
search-conditions-short-annotationComment = Comment
search-conditions-short-annotationType = סוג
search-conditions-short-annotationColor = Color
search-conditions-short-annotationAuthor = מחבר
find-pdf-files-added =
    { $count ->
        [one] { $count } file added
       *[other] { $count } files added
    }
select-items-window =
    .title = בחירת פריטים
select-items-dialog =
    .buttonlabelaccept = Select
select-items-convertToStandalone =
    .label = Convert to Standalone
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Convert to Standalone Attachment
           *[other] Convert to Standalone Attachments
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Convert to Standalone Note
           *[other] Convert to Standalone Notes
        }
file-type-webpage = Webpage
file-type-image = תמונה
file-type-pdf = PDF
file-type-audio = שמע
file-type-video = וידאו
file-type-presentation = מצגת
file-type-document = מסמך
file-type-ebook = Ebook
attachment-storage-type-storedFile = Stored File
attachment-storage-type-linkedFile = Linked File
attachment-storage-type-webLink = Web Link
post-upgrade-message = You’ve been upgraded to <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Learn about <a data-l10n-name="new-features-link">what’s new</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Paste and Search
mac-word-plugin-install-message = Zotero needs access to Word data to install the Word plugin.
mac-word-plugin-install-folder-message = { -app-name } needs access to Word’s startup folder to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = Install Word plugin
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Install the plugin in the Word startup folder
mac-word-plugin-install-folder-dialog-button = התקנה
mac-word-plugin-install-wrong-folder-selected = The suggested folder must be selected. Please try again without choosing a different folder.
file-renaming-banner-message = { -app-name } now automatically keeps attachment filenames in sync as you make changes to items.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = The { -app-name } Connector must be updated to work with this version of { -app-name }.
userjs-pref-warning = Some { -app-name } settings have been overridden using an unsupported method. { -app-name } will revert them and restart.
migrate-extra-fields-progress-message = Migrating new fields from Extra field
search-normalization-progress-message = Indexing items for search
long-tag-fixer-window-title =
    .title = Split Tags
long-tag-fixer-button-dont-split =
    .label = Don’t Split
menu-normalize-attachment-titles =
    .label = Normalize Attachment Titles…
normalize-attachment-titles-title = Normalize Attachment Titles
normalize-attachment-titles-text =
    { -app-name } automatically renames files on disk using parent item metadata, but it uses separate, simpler titles such as “Full Text PDF”, “Preprint PDF”, or “PDF” for primary attachments to keep the items list cleaner and avoid duplicating information.
    
    In older versions of { -app-name }, as well as when using certain plugins, attachment titles could be changed unnecessarily to match the filenames.
    
    Would you like to update the selected attachments to use simpler titles? Only primary attachments with titles that match the filename will be changed.
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
    .label = חיפוש
save-search-new-button =
    .label = Save Search…
save-search-edit-button =
    .label = שמירה
save-search-name-title = שמירת החיפוש
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
undo-action-rename-collection = שינוי שם אוסף
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
undo-action-edit-note = ערוך הערה
undo-action-add-creator = Add Creator
undo-action-remove-creator = Remove Creator
undo-action-edit-creator = Edit Creator
undo-action-reorder-creator = Reorder Creator
undo-action-change-type = החלפת סוג פריט
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
