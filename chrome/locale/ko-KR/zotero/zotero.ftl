general-print = 인쇄
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = 제거
general-add = 추가
general-remind-me-later = 나중에 알림
general-choose-file = 파일 선택...
general-open-settings = Open Settings
general-help = 도움말
general-tag = Tag
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = 파일 보이기
menu-file-show-files =
    .label = Show Files
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = 첨부 추가
new-note = 새 노트
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
    .label = 파일에 링크 첨부...
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = 새로운 독립 노트
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = 라이브러리로 복원
menu-deletePermanently =
    .label = 완전히 삭제...
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
    .label = 저장된 검색 목록 편집
item-creator-moveDown =
    .label = 아래로 이동
item-creator-moveToTop =
    .label = 가장 위로 이동
item-creator-moveUp =
    .label = 위로 이동
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
    .label = 파일
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Web Link
view-online = 온라인으로 보기
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
    .title = 불러오기
import-where-from = 어디서 불러올까요?
import-online-intro-title = 소개
import-source-file =
    .label = 파일 (BiBTeX, RIS, Zotero RDF 등)
import-source-folder =
    .label = PDF 또는 다른 파일이 있는 폴더
import-source-online =
    .label = { $targetApp } online import
import-options = 환경설정
import-importing = 불러오는 중...
import-create-collection =
    .label = 컬렉션 및 항목을 새 컬렉션으로 불러오기
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = 파일 처리 방법
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = 원래 위치의 파일 링크
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = 새 항목만 다운로드; 이전에 가져온 항목을 업데이트하지 않기
import-mendeley-username = 사용자명
import-mendeley-password = 비밀번호
general-error = 오류
file-interface-import-error = 선택한 파일을 불러오는 중에 오류가 발생했습니다. 파일이 유효한지를 확인 후 다시 시도해 주십시오.
file-interface-import-complete = 불러오기 완료
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
import-online-relink-kb = 정보 더 보기
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = 오류 보고...
rtfScan-wizard =
    .title = RTF 스캔
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = 시작하려면, 입력할 RTF 파일과 출력할 RTF 파일을 선택하세요 :
rtfScan-input-file = 입력 파일
rtfScan-output-file = 출력 파일
rtfScan-no-file-selected = 선택된 파일 없음
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = 소개
rtfScan-scan-page =
    .label = 인용 스캔중
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = 인용된 항목 확인
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = 문서 양식
rtfScan-format-page =
    .label = 인용 서식 적용 중
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = RTF 스캔 완료
rtfScan-complete-page-description = 이제 문서가 스캔되어 처리되었습니다. 문서 양식이 올바른지 확인하여 주십시오.
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
bibliography-style-label = 인용 스타일:
bibliography-locale-label = 언어:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = 고급
bibliography-outputMode-label = 출력 방식:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = 참고 문헌 목록
bibliography-outputMethod-label = 출력 방법:
bibliography-outputMethod-saveAsRTF =
    .label = RTF로 저장
bibliography-outputMethod-saveAsHTML =
    .label = HTML로 저장
bibliography-outputMethod-copyToClipboard =
    .label = 클립보드로 복사
bibliography-outputMethod-print =
    .label = 인쇄
bibliography-manageStyles-label = 스타일 관리...
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = 인용 표시:
integration-prefs-footnotes =
    .label = 각주
integration-prefs-endnotes =
    .label = 미주
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = 책갈피가 Word와 LibreOffice 사이에 공유될 수 있습니다, 단 우연히 변경될 때 오류를 일으킬 수 있으며 각주로 넣을 수 없습니다.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = 인용 항목 자동 업데이트
    .tooltip = 업데이트 대기 중인 인용 항목이 문서에서 강조 표시됩니다
integration-prefs-automaticCitationUpdates-description = 큰 문서라면 업데이트를 중지하여 인용 삽입 속도를 높일 수 있습니다. 새로고침을 클릭하여 수동으로 인용 정보를 업데이트하세요.
integration-prefs-automaticJournalAbbeviations =
    .label = MEDLINE 저널 약자 사용
integration-prefs-automaticJournalAbbeviations-description = "저널 약자" 필드가 무시됩니다.
integration-prefs-exportDocument =
    .label = 다른 워드 프로세서로 전환...
publications-intro-page =
    .label = 내 출판물
publications-intro = 내 출판물에 추가한 항목은 zotero.org 사이트에서 당신의 프로필 페이지에 게시됩니다. 첨부 파일을 포함하기로 결정했다면, 첨부 파일이 지정한 라이선스를 따라 공개 게시됩니다. 스스로 만든 저작물만 추가하시고, 공공 배포 권한이 있으며 그렇게 하기를 희망하는 파일만 포함해주세요.
publications-include-checkbox-files =
    .label = 파일 포함
publications-include-checkbox-notes =
    .label = 노트 포함
publications-include-adjust-at-any-time = 내 출판물 컬렉션에 무엇을 보여줄 지 어느 때든 조정하실 수 있습니다.
publications-intro-authorship =
    .label = 내가 이 저작물을 만들었습니다.
publications-intro-authorship-files =
    .label = 내가 이 저작물을 만들었고 포함될 파일을 배포할 권리를 가지고 있습니다.
publications-sharing-page =
    .label = 귀하의 저작물이 어떻게 공유될 수 있는지 선택해주세요
publications-sharing-keep-rights-field =
    .label = 이미 있는 권한 필드 유지
publications-sharing-keep-rights-field-where-available =
    .label = 사용 가능할 경우 이미 있는 권한 필드 유지
publications-sharing-text = 저작물에 대한 모든 권리를 보유하거나, Creative Commons 라이선스를 적용하거나, 퍼블릭 도메인으로 기증할 수 있습니다. 라이선스 선택 여부와 무관하게, 저작물은 zotero.org에서 공공 열람할 수 있게 됩니다.
publications-sharing-prompt = 당신의 저작물을 다른 사람들과 공유할 수 있도록 허락하시겠습니까?
publications-sharing-reserved =
    .label = 아니오, 내 저작물을 zotero.org 사이트에 게시하기만 하겠습니다.
publications-sharing-cc =
    .label = 예, Creative Commons 라이선스를 적용하겠습니다.
publications-sharing-cc0 =
    .label = 예, 그리고 내 저작물을 퍼블릭 도메인으로 두겠습니다.
publications-license-page =
    .label = Creative Commons 라이선스 선택
publications-choose-license-text = Creative Commons 라이선스는 다음 조건에 한하여 다른 사람들이 당신의 저작물을 복제·재배포하는 일을 허락합니다: 저작자 표시, 라이선스 규정 링크 제공, 변경 사항이 있을 경우 명시. 추가 조건을 아래와 같이 지정할 수 있습니다.
publications-choose-license-adaptations-prompt = 저작물을 변경하여 공유할 수 있도록 허락하시겠습니까?
publications-choose-license-yes =
    .label = 예
    .accesskey = Y
publications-choose-license-no =
    .label = 아니오
    .accesskey = N
publications-choose-license-sharealike =
    .label = 예, 단 동일 조건으로 공유하여야 합니다.
    .accesskey = S
publications-choose-license-commercial-prompt = 당신의 저작물에 대한 영리적 목적 사용을 허락하시겠습니까?
publications-buttons-add-to-my-publications =
    .label = 내 출판물에 추가
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = 라이선스 선택
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Attribution 4.0 International License
licenses-cc-by-nd = Creative Commons Attribution-NoDerivatives 4.0 International License
licenses-cc-by-sa = Creative Commons Attribution-ShareAlike 4.0 International License
licenses-cc-by-nc = Creative Commons Attribution-NonCommercial 4.0 International License
licenses-cc-by-nc-nd = Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License
licenses-cc-by-nc-sa = Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Restart in Troubleshooting Mode
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Density
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-info = 정보
pane-abstract = 요약
pane-attachments = 첨부
pane-notes = 노트
pane-libraries-collections = Libraries and Collections
pane-tags = 태그
pane-related = 연관
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = 주석
pane-header-attachment-associated =
    .label = 관련된 파일 이름 변경
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
    .title = 새 컬렉션
    .buttonlabelaccept = Create Collection
new-collection-name = 이름:
new-collection-create-in = Create in:
attachment-info-filename = 파일 이름
attachment-info-accessed = 접근일
attachment-info-pages = 쪽
attachment-info-modified = 변경일
attachment-info-index = 색인
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
    .aria-label = 빠른 검색
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = 없음
item-pane-header-title =
    .label = 제목
item-pane-header-titleCreatorYear =
    .label = 제목, 저자, 연도
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
