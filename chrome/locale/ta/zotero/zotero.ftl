general-print = அச்சிடுக
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = அகற்று
general-add = கூட்டு
general-remind-me-later = பின்னர் நினைவூட்டு
general-choose-file = கோப்பை தேர்ந்தெடு…
general-open-settings = Open Settings
general-help = உதவி
general-tag = Tag
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = கோப்பைக் காட்டு
menu-file-show-files =
    .label = Show Files
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = இணைப்பை சேர்
new-note = புதிய குறிப்பு
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
    .label = கோப்பில் இணைப்பை இணைக்கவும்…
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = புதிய முழுமையான குறிப்பு
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = நூலகத்திற்கு மீட்டமைக்கவும்
menu-deletePermanently =
    .label = நிரந்தரமாக நீக்கு…
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
    .label = Edit Saved Search
item-creator-moveDown =
    .label = கீழே இறங்கு
item-creator-moveToTop =
    .label = மேலே செல்
item-creator-moveUp =
    .label = மேலே நகர்த்து
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
    .label = கோப்பு
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Web Link
view-online = நிகழ்நிலையில் காண்க
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
    .title = இறக்குமதி
import-where-from = நீங்கள் எங்கிருந்து இறக்குமதி செய்ய விரும்புகிறீர்கள்?
import-online-intro-title = அறிமுகம்
import-source-file =
    .label = ஒரு கோப்பு (பிப்டெக்ச், ரிச், சோட்டெரோ ஆர்டிஃப், முதலியன)
import-source-folder =
    .label = எஆவகள் அல்லது பிற கோப்புகளின் கோப்புறை
import-source-online =
    .label = { $targetApp } online import
import-options = விருப்பங்கள்
import-importing = இறக்குமதி…
import-create-collection =
    .label = இறக்குமதி செய்யப்பட்ட சேகரிப்புகள் மற்றும் பொருட்களை புதிய சேகரிப்பில் வைக்கவும்
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = கோப்பு கையாளுதல்
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Link to files in original location
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = புதிய உருப்படிகளை மட்டுமே பதிவிறக்கவும்; முன்னர் இறக்குமதி செய்யப்பட்ட பொருட்களை புதுப்பிக்க வேண்டாம்
import-mendeley-username = பயனர்பெயர்
import-mendeley-password = கடவுச்சொல்
general-error = பிழை
file-interface-import-error = தேர்ந்தெடுக்கப்பட்ட கோப்பை இறக்குமதி செய்ய முயற்சிக்கும்போது பிழை ஏற்பட்டது. கோப்பு செல்லுபடியாகும் என்பதை உறுதிப்படுத்தவும் மீண்டும் முயற்சிக்கவும்.
file-interface-import-complete = இறக்குமதி முழுமையானது
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
import-online-relink-kb = மேலும் செய்தி
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = பிழையைப் புகாரளி…
rtfScan-wizard =
    .title = உஉவ வருடல்
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = தொடங்க, ஒரு உஉவ உள்ளீட்டு கோப்பு மற்றும் கீழே உள்ள வெளியீட்டு கோப்பைத் தேர்ந்தெடுக்கவும்:
rtfScan-input-file = உள்ளீட்டு கோப்பு
rtfScan-output-file = வெளியீட்டு கோப்பு
rtfScan-no-file-selected = எந்த கோப்பும் தேர்வு செய்ய படவில்லை
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = அறிமுகம்
rtfScan-scan-page =
    .label = மேற்கோள்களுக்கு வருடல்
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = மேற்கோள் காட்டப்பட்ட உருப்படிகளை சரிபார்க்கவும்
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = ஆவண வடிவமைப்பு
rtfScan-format-page =
    .label = மேற்கோள்களை வடிவமைத்தல்
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = உஉவ வருடல் முடிந்தது
rtfScan-complete-page-description = உங்கள் ஆவணம் இப்போது வருடல் செய்யப்பட்டு செயலாக்கப்பட்டுள்ளது. அது சரியாக வடிவமைக்கப்பட்டுள்ளதா என்பதை உறுதிப்படுத்தவும்.
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
bibliography-style-label = மேற்கோள் நடை:
bibliography-locale-label = மொழி:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = மேம்பட்ட விருப்பங்கள்
bibliography-outputMode-label = வெளியீட்டு முறை:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = நூலியல்
bibliography-outputMethod-label = வெளியீட்டு முறை:
bibliography-outputMethod-saveAsRTF =
    .label = உஉவ ஆக சேமி
bibliography-outputMethod-saveAsHTML =
    .label = உஉகுமொ ஆக சேமி
bibliography-outputMethod-copyToClipboard =
    .label = இடைநிலைப் பலகைக்கு நகலெடு
bibliography-outputMethod-print =
    .label = அச்சிடுக
bibliography-manageStyles-label = பாணிகளை நிர்வகி…
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = மேற்கோள்களைக் காண்பி:
integration-prefs-footnotes =
    .label = அடிக்குறிப்புகள்
integration-prefs-endnotes =
    .label = இறுதி குறிப்புகள்
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = புத்தக்குறிகள் சொலுக்கும் விடுதலைஅலுவலகத்திற்கும் இடையில் பகிரப்படலாம், ஆனால் தற்செயலாக மாற்றியமைக்கப்பட்டால் பிழைகளை ஏற்படுத்தக்கூடும், மேலும் அடிக்குறிப்புகளில் செருக முடியாது.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = மேற்கோள்களைத் தானாகப் புதுப்பி
    .tooltip = நிலுவையில் உள்ள புதுப்பிப்புகளுடன் மேற்கோள்கள் ஆவணத்தில் முன்னிலைப்படுத்தப்படும்
integration-prefs-automaticCitationUpdates-description = புதுப்பிப்புகளை முடக்குவது பெரிய ஆவணங்களில் மேற்கோள் செருகலை விரைவுபடுத்தும். மேற்கோள்களை கைமுறையாகப் புதுப்பிக்கப் புதுப்பியை சொடுக்கு.
integration-prefs-automaticJournalAbbeviations =
    .label = மெட்லைன் நாளிதழ் சுருக்கங்களைப் பயன்படுத்துங்கள்
integration-prefs-automaticJournalAbbeviations-description = “சர்னல் ஏபிபிஆர்” புலம் புறக்கணிக்கப்படும்.
integration-prefs-exportDocument =
    .label = வேறு சொல் செயலிக்கு மாறவும்…
publications-intro-page =
    .label = எனது வெளியீடுகள்
publications-intro = எனது வெளியீடுகளில் நீங்கள் சேர்க்கும் உருப்படிகள் உங்கள் சுயவிவரப் பக்கத்தில் சோட்டெரோ.நிறுவ இல் காண்பிக்கப்படும். இணைக்கப்பட்ட கோப்புகளைச் சேர்க்க நீங்கள் தேர்வுசெய்தால், அவை நீங்கள் குறிப்பிடும் உரிமத்தின் கீழ் பொதுவில் கிடைக்கும். நீங்களே உருவாக்கிய வேலையை மட்டுமே சேர்க்கவும், அவற்றை விநியோகிப்பதற்கான உரிமைகள் இருந்தால் மட்டுமே கோப்புகளைச் சேர்க்கவும், அவ்வாறு செய்ய விரும்பினால்.
publications-include-checkbox-files =
    .label = கோப்புகளைச் சேர்க்கவும்
publications-include-checkbox-notes =
    .label = குறிப்புகளைச் சேர்க்கவும்
publications-include-adjust-at-any-time = எனது வெளியீடுகள் சேகரிப்பிலிருந்து எந்த நேரத்திலும் என்ன காட்ட வேண்டும் என்பதை நீங்கள் சரிசெய்யலாம்.
publications-intro-authorship =
    .label = நான் இந்த வேலையை உருவாக்கினேன்.
publications-intro-authorship-files =
    .label = நான் இந்த வேலையை உருவாக்கினேன், சேர்க்கப்பட்ட கோப்புகளைப் பகிர்ந்தளிப்பதற்கான உரிமைகள் உள்ளன.
publications-sharing-page =
    .label = உங்கள் பணி எவ்வாறு பகிரப்படலாம் என்பதைத் தேர்வுசெய்க
publications-sharing-keep-rights-field =
    .label = இருக்கும் உரிமைகள் துறையை வைத்திருங்கள்
publications-sharing-keep-rights-field-where-available =
    .label = இருக்கும் இடங்களில் இருக்கும் உரிமைகள் புலத்தை வைத்திருங்கள்
publications-sharing-text = உங்கள் பணிக்கான அனைத்து உரிமைகளையும் நீங்கள் முன்பதிவு செய்யலாம், படைப்பாற்றல் பொது உரிமத்தின் கீழ் உரிமம் வழங்கலாம் அல்லது பொது களத்தில் அர்ப்பணிக்கலாம். எல்லா சந்தர்ப்பங்களிலும், சோட்டெரோ.நிறுவ வழியாக பணிகள் பகிரங்கமாகக் கிடைக்கும்.
publications-sharing-prompt = உங்கள் வேலையை மற்றவர்களால் பகிர அனுமதிக்க விரும்புகிறீர்களா?
publications-sharing-reserved =
    .label = இல்லை, சோட்டெரோ.நிறுவ இல் எனது படைப்புகளை மட்டும் வெளியிடுங்கள்
publications-sharing-cc =
    .label = ஆம், படைப்பாற்றல் பொது உரிமத்தின் கீழ்
publications-sharing-cc0 =
    .label = ஆம், எனது வேலையை பொது களத்தில் வைக்கவும்
publications-license-page =
    .label = ஒரு படைப்பாற்றல் பொது உரிமம் தேர்ந்தேடு
publications-choose-license-text = ஒரு படைப்பாற்றல் பொது உரிமம் மற்றவர்கள் உங்கள் வேலையை பொருத்தமான கடன் வழங்கும் வரை, உரிமத்திற்கான இணைப்பை வழங்கவும், மாற்றங்கள் செய்யப்பட்டுள்ளதா என்பதைக் குறிக்கவும் உங்கள் வேலையை நகலெடுத்து மறுபகிர்வு செய்ய அனுமதிக்கிறது. கூடுதல் நிபந்தனைகளை கீழே குறிப்பிடலாம்.
publications-choose-license-adaptations-prompt = உங்கள் வேலையின் தழுவல்களை பகிர அனுமதிக்கவா?
publications-choose-license-yes =
    .label = ஆம்
    .accesskey = Y
publications-choose-license-no =
    .label = இல்லை
    .accesskey = N
publications-choose-license-sharealike =
    .label = ஆம், மற்றவர்கள் ஒரே மாதிரியாக பகிர்ந்து கொள்ளும் வரை
    .accesskey = இ
publications-choose-license-commercial-prompt = உங்கள் வேலையின் வணிக பயன்பாடுகளை அனுமதிக்கவா?
publications-buttons-add-to-my-publications =
    .label = எனது வெளியீடுகளில் சேர்
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = உரிமத்தைத் தேர்வுசெய்க
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = படைப்பாற்றல் பொதுவானவை பண்புக்கூறு 4.0 பன்னாட்டு உரிமம்
licenses-cc-by-nd = படைப்பாற்றல் பொதுவானவை பண்புக்கூறு-வழிப்பொருட்கள்இல்லாத 4.0 பன்னாட்டு உரிமம்
licenses-cc-by-sa = படைப்பாற்றல் பொதுவானவை பண்புக்கூறு-பகிர்ஒரேமாதிரி 4.0 பன்னாட்டு உரிமம்
licenses-cc-by-nc = படைப்பாற்றல் பொதுவானவை பண்புக்கூறு-வணிகமல்லாத 4.0 பன்னாட்டு உரிமம்
licenses-cc-by-nc-nd = படைப்பாற்றல் பொதுவானவை பண்புக்கூறு-வணிகமல்லாத-வழிப்பொருட்கள்இல்லாத 4.0 பன்னாட்டு உரிமம்
licenses-cc-by-nc-sa = படைப்பாற்றல் பொதுவானவை பண்புக்கூறு-வணிகமல்லாத-பகிர்ஒரேமாதிரி 4.0 பன்னாட்டு உரிமம்
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = ஏ
restart-in-troubleshooting-mode-dialog-title = Restart in Troubleshooting Mode
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Density
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-info = தகவல்
pane-abstract = சுருக்கம்
pane-attachments = இணைப்புகள்
pane-notes = குறிப்புகள்
pane-libraries-collections = Libraries and Collections
pane-tags = குறிச்சொற்கள்
pane-related = தொடர்புடைய
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = சிறுகுறிப்புகள்
pane-header-attachment-associated =
    .label = தொடர்புடைய கோப்பை மறுபெயரிடு
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
    .title = புதிய தொகுப்பு
    .buttonlabelaccept = Create Collection
new-collection-name = பெயர்:
new-collection-create-in = Create in:
attachment-info-filename = கோப்புப்பெயர்
attachment-info-accessed = அணுகப்பட்டது
attachment-info-pages = பக்கங்கள்
attachment-info-modified = மாற்றப்பட்டது
attachment-info-index = குறியிடப்பட்ட
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
    .aria-label = விரைவு தேடல்
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = எதுவுமில்லை
item-pane-header-title =
    .label = தலைப்பு
item-pane-header-titleCreatorYear =
    .label = தலைப்பு, உருவாக்கியவர், ஆண்டு
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
