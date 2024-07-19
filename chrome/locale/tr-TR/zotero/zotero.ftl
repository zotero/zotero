general-print = Yazdır
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Kaldır
general-add = Ekle
general-remind-me-later = Daha Sonra Hatırlat
general-choose-file = Dosya Seçiniz...
general-open-settings = Ayarları Aç
general-help = Yardım
general-tag = Tag
menu-file-show-in-finder =
    .label = Finder'da Göster
menu-file-show-file =
    .label = Dosyayı Göster
menu-file-show-files =
    .label = Dosyaları Göster
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = Ek Ekle
new-note = Yeni Not
menu-add-by-identifier =
    .label = Add by Identifier…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Dosya Ekle...
menu-add-standalone-linked-file-attachment =
    .label = Dosyaya Bağlantı Ekle...
menu-add-child-file-attachment =
    .label = Dosyaya Ekle...
menu-add-child-linked-file-attachment =
    .label = Dosyaya Bağlantı Ekle...
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Yeni Bağımsız Not
menu-new-item-note =
    .label = Yeni Eser Notu
menu-restoreToLibrary =
    .label = Kitaplığa geri yükle
menu-deletePermanently =
    .label = Kalıcı Olarak Sil...
menu-tools-plugins =
    .label = Eklentiler
main-window-command =
    .label = { -app-name }
zotero-toolbar-tabs-menu =
    .tooltiptext = Tüm sekmeleri listele
filter-collections = Filter Collections
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Sekmelerde Ara
zotero-tabs-menu-close-button =
    .title = Sekmeyi Kapat
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Dermeyi Yeniden Adlandır
collections-menu-edit-saved-search =
    .label = Kaydedilen Aramayı Düzenle
item-creator-moveDown =
    .label = Bir Aşağı İn
item-creator-moveToTop =
    .label = En Üste Taşı
item-creator-moveUp =
    .label = Bir Yukarı Çık
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
    .label = Dosya
item-menu-add-linked-file =
    .label = Bağlantılı Dosya
item-menu-add-url =
    .label = Web Link
view-online = Çevrimiçi Göster
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
update-updates-found-desc = Bu güncellemeyi mümkün olan en kısa sürede uygulamanız önerilir.
import-window =
    .title = İçeri Aktar
import-where-from = Nereden içeri aktarmak istiyorsunuz?
import-online-intro-title = Giriş
import-source-file =
    .label = Bir dosya (BibTeX, RIS, Zotero RDF, vb.)
import-source-folder =
    .label = PDF'lerin veya diğer dosyaların bulunduğu bir klasör
import-source-online =
    .label = { $targetApp } online import
import-options = Seçenekler
import-importing = İçeri aktarılıyor...
import-create-collection =
    .label = İçeri aktarılmış dermeler ve eserleri yeni bir dermeye yerleştir
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDF'ler
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Dosyaların İdare Edilmesi
import-file-handling-store =
    .label = Copy files to the { -app-name } storage folder
import-file-handling-link =
    .label = Dosyalara orijinal konumlarında bağlantı kur
import-fileHandling-description = Linked files cannot be synced by { -app-name }.
import-online-new =
    .label = Yalnızca yeni eserleri indir; daha önce içeri aktarılmış olan eserleri güncelleme
import-mendeley-username = Kullanıcı adı
import-mendeley-password = Şifre
general-error = Hata
file-interface-import-error = Seçilen dosyayı içeri aktarırken bir hata oluştu. Lütfen dosyanın doğruluğunu kontrol ediniz ve tekrar deneyiniz.
file-interface-import-complete = İçeri Aktarma Tamamlandı
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
    .label = Mendeley Desktop alıntılarını yeniden bağlantıla
import-online-relink-kb = Daha Fazla Bilgi
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Hatayı Bildir...
rtfScan-wizard =
    .title = RTF Tarama
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = Başlamak için, aşağıdan bir RTF girdi dosyası ve bir çıktı dosyası seçiniz:
rtfScan-input-file = Girdi Dosyası
rtfScan-output-file = Çıktı Dosyası
rtfScan-no-file-selected = Dosya seçilmedi
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = Giriş
rtfScan-scan-page =
    .label = Alıntılar için Tarama
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = Alıntıların Onaylanması
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = Belge Biçimlendirme
rtfScan-format-page =
    .label = Alıntı Biçimlendirme
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = RTF Taraması Tamamlandı
rtfScan-complete-page-description = Belgenizin taranması ve işlenmesi tamamlandı. Lütfen biçimlendirmesinin doğruluğunu kontrol ediniz.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Run JavaScript
runJS-editor-label = Code:
runJS-run = Çalıştır
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Run as async function
bibliography-window =
    .title = { -app-name } - Create Citation/Bibliography
bibliography-style-label = Alıntı Stili:
bibliography-locale-label = Dil:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Gelişmiş Seçenekler
bibliography-outputMode-label = Çıktı Biçimi
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliography
bibliography-outputMethod-label = Çıktı Metodu:
bibliography-outputMethod-saveAsRTF =
    .label = RTF Olarak Kaydet
bibliography-outputMethod-saveAsHTML =
    .label = HTML olarak Kaydet
bibliography-outputMethod-copyToClipboard =
    .label = Panoya Kopyala
bibliography-outputMethod-print =
    .label = Yazdır
bibliography-manageStyles-label = Stilleri Yönet...
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = Alıntıları Göster:
integration-prefs-footnotes =
    .label = Dipnot
integration-prefs-endnotes =
    .label = Son notlar
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = Yer imleri Word ve LibreOffice arasında paylaşılabilirler, ama yanlışlıkla değiştirilirlerse hatalara neden olabilirler ve dipnotlara konulamazlar.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Alıntıları otomatik olarak güncelle
    .tooltip = Bekleyen güncellemeleri olan alıntılar belgede vurgulanacaktırlar.
integration-prefs-automaticCitationUpdates-description = Güncellemeleri devre dışı bırakmak, büyük belgelerde alıntı koymayı hızlandırabilir. Alıntıları güncellemek için Yenile'ye tıklayınız.
integration-prefs-automaticJournalAbbeviations =
    .label = MEDLINE dergi kısaltmalarını kullan
integration-prefs-automaticJournalAbbeviations-description = “Dergi Kısaltması” alanı yok sayılacaktır.
integration-prefs-exportDocument =
    .label = Başka Bir Sözcük İşlemcisine Geç...
publications-intro-page =
    .label = Yayınlarım
publications-intro = Yayınlarım'a eklediğiniz eserler zotero.org adresindeki profil sayfanızda gösterilecektir. Eklenti dosyalarını dahil etmeyi seçerseniz, bu dosyalar belirttiğiniz lisans uyarınca halka açık şekilde paylaşılacaktır. Sadece kendi ürettiğiniz eserleri ekleyiniz ve sadece dağıtım hakkına sahip olduğunuz ve paylaşmak istediğiniz dosyaları dahil ediniz.
publications-include-checkbox-files =
    .label = Dosyaları dahil et
publications-include-checkbox-notes =
    .label = Notları dahil et
publications-include-adjust-at-any-time = Nelerin gösterileceğini, Yayınlarım dermesinden herhangi bir zaman ayarlayabilirsiniz.
publications-intro-authorship =
    .label = Bu eseri ben yarattım.
publications-intro-authorship-files =
    .label = Bu eseri ben yarattım ve dahil edilmiş dosyaları dağıtma hakkına sahibim.
publications-sharing-page =
    .label = Kendi eserlerinizin nasıl paylaşılacağını seçiniz
publications-sharing-keep-rights-field =
    .label = Telif alanını aynen tut
publications-sharing-keep-rights-field-where-available =
    .label = Eğer Telif alanı varsa, bu alanı aynen tut
publications-sharing-text = Kendi eserlerinizin tüm haklarını saklı tutabilir, Creative Commons altında lisanslayabilir ya da kamu alanına açıkça sunabilirsiniz. Her durumda eser zotero.org aracılığıyla halka açık olacaktır.
publications-sharing-prompt = Eserinizin başkaları tarafından paylaşılabilmesine izin veriyor musunuz?
publications-sharing-reserved =
    .label = Hayır, eserimi sadece zotero.org adresinde yayınla
publications-sharing-cc =
    .label = Evet, Creative Commons ile lisansla
publications-sharing-cc0 =
    .label = Evet, eserimi kamu alanına serbestçe koy
publications-license-page =
    .label = Bir Creative Commons lisansı seç
publications-choose-license-text = Bir Creative Commons lisansı, eğer size uygun bir atıfta bulunuluyor, lisansa bir bağlantı veriliyor ve yapılmış herhangi bir değişiklik belirtiliyorsa, başkalarına eserinizi kopyalama ve yeniden dağıtmasına izni vermektedir.
publications-choose-license-adaptations-prompt = Eserinizin uyarlamalarının paylaşılmasına izin veriyor musunuz?
publications-choose-license-yes =
    .label = Evet
    .accesskey = Y
publications-choose-license-no =
    .label = Hayır
    .accesskey = N
publications-choose-license-sharealike =
    .label = Evet, başkaları da aynı şekilde paylaşacaksa
    .accesskey = S
publications-choose-license-commercial-prompt = Eserinizin ticari kullanımına izin veriyor musunuz?
publications-buttons-add-to-my-publications =
    .label = Yayınlarım'a Ekle
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Bir Telif Hakkı Lisansı Seç
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Creative Commons Alıntı 4.0 Uluslararası Lisansı
licenses-cc-by-nd = Creative Commons Alıntı-Türetilemez 4.0 Uluslararası Lisansı
licenses-cc-by-sa = Creative Commons Alıntı-LisansDevam 4.0 Uluslararası Lisansı
licenses-cc-by-nc = Creative Commons Alıntı-Gayriticari 4.0 Uluslararası Lisansı
licenses-cc-by-nc-nd = Creative Commons Alıntı-Gayriticari-Türetilemez eserler 4.0 Uluslararası Lisansı
licenses-cc-by-nc-sa = Creative Commons Alıntı-Gayriticari-LisansDevam 4.0 Uluslararası Lisansı
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
pane-info = Bilgi
pane-abstract = Özet
pane-attachments = Ekler
pane-notes = Notlar
pane-libraries-collections = Libraries and Collections
pane-tags = Etiketler
pane-related = İlişkili
pane-attachment-info = Attachment Info
pane-attachment-preview = Önizleme
pane-attachment-annotations = Ek Açıklamalar
pane-header-attachment-associated =
    .label = İlişkilendirilen dosyayı yeniden adlandır
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
    .dynamic-tooltiptext = Bölümü genişlet
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
    .label = Tüm Bölümleri Genişlet
abstract-field =
    .placeholder = Özet ekle...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filter Tags
context-notes-search =
    .placeholder = Notları Ara
new-collection-dialog =
    .title = Yeni Derme
    .buttonlabelaccept = Derme Oluştur
new-collection-name = Ad:
new-collection-create-in = Create in:
attachment-info-filename = Dosya adı
attachment-info-accessed = Erişildi
attachment-info-pages = Sayfalar
attachment-info-modified = Değiştirme
attachment-info-index = İndekslendi
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
    .aria-label = Hızlı Arama modu
quicksearch-input =
    .aria-label = Çabuk Arama
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = Hiçbiri
item-pane-header-title =
    .label = Başlık
item-pane-header-titleCreatorYear =
    .label = Başlık, Yaratan, Yıl
item-pane-header-bibEntry =
    .label = Sözlük Girdisi
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
    .aria-label = Değer
    .label = { $label }
