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
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-print = Yazdır
general-remove = Kaldır
general-add = Ekle
general-remind-me-later = Daha Sonra Hatırlat
general-dont-ask-again = Bir Daha Sorma
general-choose-file = Dosya Seçiniz...
general-open-settings = Ayarları Aç
general-help = Yardım
general-tag = Etiket
general-done = Tamam
general-view-troubleshooting-instructions = Sorun Giderme Talimatlarını Göster
citation-style-label = Alıntı Stili:
language-label = Dil:
menu-file-show-in-finder =
    .label = Finder'da Göster
menu-file-show-file =
    .label = Dosyayı Göster
menu-file-show-files =
    .label = Dosyaları Göster
menu-print =
    .label = { general-print }
menu-density =
    .label = Yoğunluk
add-attachment = Ek Ekle
new-note = Yeni Not
menu-add-by-identifier =
    .label = Tanımlayıcı Kullanarak Ekle
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Dosya Ekle...
menu-add-standalone-linked-file-attachment =
    .label = Dosyaya Bağlantı Ekle...
menu-add-child-file-attachment =
    .label = Dosyayı Ekle...
menu-add-child-linked-file-attachment =
    .label = Dosyaya Bağlantı Ekle...
menu-add-child-linked-url-attachment =
    .label = Web Bağlantısı Ekle...
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
filter-collections = Dermeleri Filtrele
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
collections-menu-move-collection =
    .label = Taşı
collections-menu-copy-collection =
    .label = Kopyala
item-creator-moveDown =
    .label = Bir Aşağı Taşı
item-creator-moveToTop =
    .label = En Üste Taşı
item-creator-moveUp =
    .label = Bir Yukarı Taşı
item-menu-viewAttachment =
    .label =
        { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF'i
                    [epub] EPUB'ı
                    [snapshot] Anlık Görüntüyü
                   *[other] Eki
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDF'i
                    [epub] EPUB'ı
                    [snapshot] Anlık Görüntüyü
                   *[other] Eki
                }
        } { $openIn ->
            [tab] Yeni Sekmede
            [window] Yeni Pencerede
           *[other] { "" }
        } Aç
item-menu-add-file =
    .label = Dosya
item-menu-add-linked-file =
    .label = Bağlantılı Dosya
item-menu-add-url =
    .label = Web bağlantısı
item-menu-change-parent-item =
    .label = Ana Eseri Değiştir...
view-online = Çevrimiçi Göster
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Dosyanın adı buna değiştirildi: { $filename }
itembox-button-options =
    .tooltiptext = Bağlam menüsünü aç
itembox-button-merge =
    .aria-label = { $field } alanının versiyonunu seçiniz
create-parent-intro = Bir DOI, ISBN, PMID, arXiv ID ya da ADS Bibcode değeri girerek bu dosyayı tanımlayınız:
reader-use-dark-mode-for-content =
    .label = İçerik için Karanlık Modu Kullanın
update-updates-found-intro-minor = { -app-name } için bir güncelleme var:
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
    .label = { $targetApp } uygulamasından çevrimiçi içe aktarma
import-options = Seçenekler
import-importing = İçeri aktarılıyor...
import-create-collection =
    .label = İçeri aktarılmış dermeler ve eserleri yeni bir dermeye yerleştir
import-recreate-structure =
    .label = Klasör yapısını dermeler olarak yeniden yarat
import-fileTypes-header = İçeri Aktarılacak Dosya Türleri:
import-fileTypes-pdf =
    .label = PDF'ler
import-fileTypes-other =
    .placeholder = Şablona göre diğer dosyalar, virgülle ayrılmış (örn. *.jpg,*.png)
import-file-handling = Dosyaların İdare Edilmesi
import-file-handling-store =
    .label = Dosyaları { -app-name } depolama klasörüne kopyala
import-file-handling-link =
    .label = Dosyalara orijinal konumlarında bağlantı kur
import-fileHandling-description = { -app-name } bağlantılı dosyaları eşitleyemez.
import-online-new =
    .label = Yalnızca yeni eserleri indir; daha önce içeri aktarılmış olan eserleri güncelleme
import-mendeley-username = Kullanıcı adı
import-mendeley-password = Şifre
general-error = Hata
file-interface-import-error = Seçilen dosyayı içeri aktarırken bir hata oluştu. Lütfen dosyanın doğruluğunu kontrol ediniz ve tekrar deneyiniz.
file-interface-import-complete = İçeri Aktarma Tamamlandı
file-interface-items-were-imported =
    { $numItems ->
        [0] Hiçbir eser içeri aktarılmadı
        [one] Bir eser içeri aktarıldı
       *[other] { $numItems } eser içeri aktarıldı
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Hiçbir eser yeniden bağlantılanmadı
        [one] Bir eser yeniden bağlantılandı
       *[other] { $numRelinked } eser yeniden bağlantılandı
    }
import-mendeley-encrypted = Seçili Mendeley veri tabanı okunamıyor. Bunun olası nedeni veri tabanının şifrelenmiş olmasıdır. Daha çok bilgi için buraya bakınız: <a data-l10n-name="mendeley-import-kb">Bir Mendeley kitaplığını nasıl içeri aktarırım?</a>
file-interface-import-error-translator = Seçilmiş dosyayı “{ $translator }” ile içeri aktarırken bir hata oluştu. Lütfen dosyanın geçerliliğini kontrol ediniz ve tekrar deneyiniz.
import-online-intro = Gelecek aşamada, { $targetAppOnline } uygulamasına giriş yapmanız ve { -app-name } uygulamasına erişim vermeniz istenecek. Bu, { $targetApp } kitaplığınızı { -app-name } içine aktarabilmek için gereklidir.
import-online-intro2 = { -app-name } hiçbir zaman { $targetApp } şifrenizi görmeyecek ve kaydetmeyecektir.
import-online-form-intro = Lütfen { $targetAppOnline } uygulaması için giriş bilgilerinizi giriniz. Bu, { $targetApp } kitaplığınızı { -app-name } içine aktarmak için gereklidir.
import-online-wrong-credentials = { $targetApp } için oturum açılamadı. Lütfen giriş bilgilerini tekrar girin ve yeniden deneyin.
import-online-blocked-by-plugin = { $plugin } kuruluyken içeri aktarma işlemi sürdürülemez. Lütfen bu eklentiyi devre dışı bırakın ve yeniden deneyin.
import-online-relink-only =
    .label = Mendeley Desktop alıntılarını yeniden bağlantıla
import-online-relink-kb = Daha Fazla Bilgi
import-online-connection-error = { -app-name }, { $targetApp } uygulamasına bağlanamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Not
           *[other] { $count } Not
        }
report-error =
    .label = Hatayı Bildir...
rtfScan-wizard =
    .title = RTF Tarama
rtfScan-introPage-description = { -app-name } alıntıları otomatik olarak ayıklayıp düzenleyebilir ve RTF dosyalarının içine kaynakça olarak koyabilir. Şu an aşağıdaki biçimlendirme şekillerinde yaratılmış alıntıları desteklemektedir:
rtfScan-introPage-description2 = Başlamak için, aşağıdan bir RTF girdi dosyası ve bir çıktı dosyası seçiniz:
rtfScan-input-file = Okunan Dosya:
rtfScan-output-file = Çıkan Dosya:
rtfScan-no-file-selected = Dosya seçilmedi
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Okunan Dosyayı Seç
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Çıkacak Dosyayı Seç
rtfScan-intro-page = Giriş
rtfScan-scan-page = Alıntılar için Tarama
rtfScan-scanPage-description = { -app-name }, belgenizi alıntı bulmak için tarıyor. Lütfen bekleyiniz.
rtfScan-citations-page = Alıntıların Onaylanması
rtfScan-citations-page-description = Lütfen aşağıdaki listede tanınan alıntıları { -app-name } uygulamasının doğru eserlerle eşlendirdiğinden emin olunuz. Bir sonraki adıma geçmeden önce eşlenmemiş veya belirsiz alıntılar çözümlenmelidir.
rtfScan-style-page = Belge Biçimlendirme
rtfScan-format-page = Alıntı Biçimlendirme
rtfScan-format-page-description = { -app-name }, RTF dosyanızı işliyor ve biçimlendiriyor. Lütfen bekleyiniz.
rtfScan-complete-page = RTF Taraması Tamamlandı
rtfScan-complete-page-description = Belgenizin taranması ve işlenmesi tamamlandı. Lütfen biçimlendirmesinin doğruluğunu kontrol ediniz.
rtfScan-action-find-match =
    .title = Eşleşen eseri seçin
rtfScan-action-accept-match =
    .title = Bu eşleşmeyi kabul et
runJS-title = JavaScript Çalıştır
runJS-editor-label = Kod:
runJS-run = Çalıştır
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Dönüş değeri:
       *[other] Sonuç:
    }
runJS-run-async = Asenkron fonksiyon olarak çalıştır
bibliography-window =
    .title = { -app-name } - Alıntı/Kaynakça Yarat
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Alıntıları böyle göster:
bibliography-advancedOptions-label = Gelişmiş Seçenekler
bibliography-outputMode-label = Çıktı Biçimi
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Alıntılar
            [note] Notlar
           *[other] Alıntılar
        }
bibliography-outputMode-bibliography =
    .label = Kaynakça
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
    .title = { -app-name } - Belge Tercihleri
integration-addEditCitation-window =
    .title = { -app-name } - Alıntı Ekle/Düzenle
integration-editBibliography-window =
    .title = { -app-name } - Kaynakça Düzenle
integration-quickFormatDialog-window =
    .title = { -app-name } - Alıntıyı Çabuk Biçimle
styleEditor-locatorType =
    .aria-label = Yer bulucu türü
styleEditor-locatorInput = Yer bulucu girdisi
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Stil Editörü
styleEditor-preview =
    .aria-label = Önizleme
integration-prefs-displayAs-label = Alıntıları Böyle Göster:
integration-prefs-footnotes =
    .label = Dipnot
integration-prefs-endnotes =
    .label = Sonnot
integration-prefs-bookmarks =
    .label = Alıntıyı yer imleri/işaretleri olarak depola
integration-prefs-bookmarks-description = Yer imleri Word ve LibreOffice arasında paylaşılabilirler, ama yanlışlıkla değiştirilirlerse hatalara neden olabilirler ve dipnotlara konulamazlar.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Belge .doc ya da .docx olarak kaydedilmelidir.
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
integration-error-unable-to-find-winword = { -app-name } şu an çalışan bir Word bulamadı.
publications-intro-page = Yayınlarım
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
publications-sharing-page = Kendi eserlerinizin nasıl paylaşılacağını seçiniz
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
publications-license-page = Bir Creative Commons lisansı seç
publications-choose-license-text = Bir Creative Commons lisansı, eğer size uygun bir atıfta bulunuluyor, lisansa bir bağlantı veriliyor ve yapılmış herhangi bir değişiklik belirtiliyorsa, başkalarına eserinizi kopyalama ve yeniden dağıtmasına izni vermektedir.
publications-choose-license-adaptations-prompt = Eserinizin uyarlamalarının paylaşılmasına izin veriyor musunuz?
publications-choose-license-yes =
    .label = Evet
    .accesskey = E
publications-choose-license-no =
    .label = Hayır
    .accesskey = H
publications-choose-license-sharealike =
    .label = Evet, başkaları da aynı şekilde paylaşacaksa
    .accesskey = S
publications-choose-license-commercial-prompt = Eserinizin ticari kullanımına izin veriyor musunuz?
publications-buttons-add-to-my-publications =
    .label = Yayınlarım'a Ekle
publications-buttons-next-sharing =
    .label = Sonraki: Paylaşım
publications-buttons-next-choose-license =
    .label = Bir Telif Hakkı Lisansı Seç
licenses-cc-0 = CC0 1.0 Universal Public Domain Adanması
licenses-cc-by = Creative Commons Alıntı 4.0 Uluslararası Lisansı
licenses-cc-by-nd = Creative Commons Alıntı-Türetilemez 4.0 Uluslararası Lisansı
licenses-cc-by-sa = Creative Commons Alıntı-LisansDevam 4.0 Uluslararası Lisansı
licenses-cc-by-nc = Creative Commons Alıntı-Gayriticari 4.0 Uluslararası Lisansı
licenses-cc-by-nc-nd = Creative Commons Alıntı-Gayriticari-Türetilemez eserler 4.0 Uluslararası Lisansı
licenses-cc-by-nc-sa = Creative Commons Alıntı-Gayriticari-LisansDevam 4.0 Uluslararası Lisansı
licenses-cc-more-info = Çalışmanızı CC lisansı altına almadan önce, Creative Commons <a data-l10n-name="license-considerations">Lisansı Verenleri İçin Dikkat Edilecek Hususlar'ı</a> okuduğunuzdan emin olun. Başvurduğunuz lisansın, daha sonra başka şartlar seçseniz veya eserin yayımını durdursanız bile, iptal edilemeyeceğini unutmayın.
licenses-cc0-more-info = Çalışmanıza CC0 lisansını uygulamadan önce, Creative Commons <a data-l10n-name="license-considerations">CC0 SSS</a> belgesini okuduğunuzdan emin olun. Çalışmanızı kamuya açık alana adamanın, daha sonra başka şartlar seçseniz veya çalışmayı yayınlamayı bıraksanız bile, geri döndürülemez olduğunu lütfen unutmayın.
restart-in-troubleshooting-mode-menuitem =
    .label = Sorun Giderme Modunda Yeniden Başlat...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Sorun Giderme Modunda Yeniden Başlat
restart-in-troubleshooting-mode-dialog-description = { -app-name }, tüm eklentileri devre dışı bırakarak yeniden başlayacak. Sorun Giderme Modu etkinken bazı özellikler düzgün çalışmayabilir.
menu-ui-density =
    .label = Yoğunluk
menu-ui-density-comfortable =
    .label = Rahat
menu-ui-density-compact =
    .label = Sıkıştır
pane-info = Bilgi
pane-abstract = Özet
pane-attachments = Ekler
pane-notes = Notlar
pane-libraries-collections = Kitaplıklar ve Dermeler
pane-tags = Etiketler
pane-related = İlişkili
pane-attachment-info = Ek Bilgileri
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
            [one] { $count } Ek
           *[other] { $count } Ek
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } Ek Açıklama
           *[other] { $count } Ek Açıklama
        }
section-notes =
    .label =
        { $count ->
            [one] { $count } Not
           *[other] { $count } Not
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } Etiket
           *[other] { $count } Etiket
        }
section-related =
    .label = { $count } İlişkili
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Bölümü genişlet
    .label = { $section } bölümünü genişlet
section-button-collapse =
    .dynamic-tooltiptext = Bölümü daralt
    .label = { $section } bölümünü daralt
annotations-count =
    { $count ->
        [one] { $count } Ek Açıklama
       *[other] { $count } Ek Açıklama
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
    .label = Bölümü Sabitle
unpin-section =
    .label = Bölüm Sabitlemesini Kaldır
collapse-other-sections =
    .label = Diğer Bölümleri Daralt
expand-all-sections =
    .label = Tüm Bölümleri Genişlet
abstract-field =
    .placeholder = Özet ekle...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Etiketleri Filtrele
context-notes-search =
    .placeholder = Notları Ara
new-collection-dialog =
    .title = Yeni Derme
    .buttonlabelaccept = Derme Oluştur
new-collection-name = Ad:
new-collection-create-in = Bunun içinde yarat:
attachment-info-title = Başlık
attachment-info-filename = Dosya adı
attachment-info-accessed = Erişildi
attachment-info-pages = Sayfalar
attachment-info-modified = Değiştirme
attachment-info-index = İndekslendi
attachment-info-convert-note =
    .label =
        { $type ->
            [standalone] Bağımsız Nota
            [child] Eser Notuna
           *[unknown] Yeni Nota
        } Taşı
    .tooltiptext = Eklere not eklemek artık desteklenmemektedir. Fakat bu notu ayrı bir nota taşıyarak düzenleyebilirsiniz.
attachment-preview-placeholder = Önizleyecek bir ek yok
toggle-preview =
    .label =
        Ek Önizlemesini { $type ->
            [open] Sakla
            [collapsed] Göster
           *[unknown] Sakla/Göster
        }
quickformat-general-instructions =
    Bu alıntının eserleri arasında gezinmek için Sol/Sağ Oklarını kullanın. { $dialogMenu ->
        [active] İletişim kutusunun menüsüne odaklanmak için Shift-Tab tuşlarına basın.
       *[other] { "" }
    } { return-or-enter } tuşuna basarak bu alıntının düzenlemelerini kaydedin. Escape tuşuna basarak yaptığınız değişiklikleri çöpe atın ve iletişim kutusunu kapatın.
quickformat-aria-bubble = Bu eser alıntıya dahil edildi. Space tuşuna basarak bu eseri özelleştirebilirsiniz. { quickformat-general-instructions }
quickformat-aria-input = Bu alıntıya dahil edilecek bir eseri aramak için yazın. Arama sonuçları listesinde gezinmek için Tab tuşuna basın. { quickformat-general-instructions }
quickformat-aria-item = Bu eseri alıntıya eklemek için { return-or-enter } tuşuna basın. Arama alanına geri dönmek için Tab tuşuna basın.
quickformat-accept =
    .tooltiptext = Bu alıntıya yapılan düzenlemeleri kaydet
quickformat-locator-type =
    .aria-label = Yer bulucu türü
quickformat-locator-value = Yer bulucu
quickformat-citation-options =
    .tooltiptext = Alıntı seçeneklerini göster
insert-note-aria-input = Bir notu aramak için yazın. Sonuç listesinde gezinmek için Tab tuşuna basın. İletişim kutusunu kapatmak için Escape tuşuna basın.
insert-note-aria-item = Bu notu seçmek için { return-or-enter } tuşuna basın. Arama alanına geri dönmek için Tab tuşuna basın. İletişim kutusunu kapatmak için Escape tuşuna basın.
quicksearch-mode =
    .aria-label = Hızlı Arama modu
quicksearch-input =
    .aria-label = Çabuk Arama
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Bu şekilde görüntüle:
item-pane-header-none =
    .label = Hiçbiri
item-pane-header-title =
    .label = Başlık
item-pane-header-titleCreatorYear =
    .label = Başlık, Yaratan, Yıl
item-pane-header-bibEntry =
    .label = Kaynakça Girdisi
item-pane-header-more-options =
    .label = Diğer Seçenekler
item-pane-message-items-selected =
    { $count ->
        [0] Hiçbir eser seçilmedi
        [one] { $count } eser seçildi
       *[other] { $count } eser seçildi
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } derme seçildi
       *[other] { $count } derme seçildi
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } arama seçildi
       *[other] { $count } arama seçildi
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } şey seçildi
       *[other] { $count } şey seçildi
    }
item-pane-message-unselected =
    { $count ->
        [0] Bu görüntüde hiçbir eser yok
        [one] Bu görüntüde { $count } eser var
       *[other] Bu görüntüde { $count } eser var
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] Bu görüntüde hiçbir şey yok
        [one] Bu görüntüde { $count } şey var
       *[other] Bu görüntüde { $count } şey var
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] { $count } eseri birleştir
           *[other] { $count } eseri birleştir
        }
locate-library-lookup-no-resolver = { -app-name } ayarlarının { $pane } bölmesinden bir çözümleyicisi seçmelisiniz.
architecture-win32-warning-message = En iyi performans için 64-bit { -app-name } uygulamasına geçin. Verileriniz etkilenmeyecektir.
architecture-warning-action = 64-bit { -app-name } uygulamasını indir
architecture-x64-on-arm64-message = { -app-name } uygulaması emüle edilmiş modda çalışıyor. { -app-name } uygulamasının yerli bir versiyonu daha verimli çalışacaktır.
architecture-x64-on-arm64-action = ARM64 için yapılmış { -app-name } uygulamasını indir
first-run-guidance-quickFormat =
    Bir referans aramak için bir başlık, yazar ve/veya yıl yazın.
    
    Seçiminizi yaptıktan sonra, baloncuğu tıklayın veya klavyeden baloncuğu seçin ve sayfa numarası, önek ve sonek gibi alıntı seçeneklerini göstermek için ↓/Space tuşuna basın.
    
    Ayrıca, bir sayfa numarası doğrudan eklemek için sayfa numarasını arama terimlerinize ekleyebilirsiniz veya baloncuğun ardından sayfa numarasını yazıp { return-or-enter } tuşuna basabilirsiniz.
first-run-guidance-authorMenu = { -app-name }, editörleri ve çevirmenleri belirtmenize de olanak tanır. Bir yazarı, editöre veya çevirmene dönüştürmeyi bu menüden seçebilirsiniz.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Arama koşulu
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = İşleç
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Değer
    .label = { $label }
find-pdf-files-added =
    { $count ->
        [one] { $count } dosya eklendi
       *[other] { $count } dosya eklendi
    }
select-items-dialog =
    .buttonlabelaccept = Seç
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Bağımsız Eke Dönüştür
           *[other] Bağımsız Eklere Dönüştür
        }
file-type-webpage = Web sayfası
file-type-image = Resim
file-type-pdf = PDF
file-type-audio = Ses
file-type-video = Video
file-type-presentation = Sunum
file-type-document = Doküman
file-type-ebook = E-kitap
post-upgrade-message = <a data-l10n-name="new-features-link">{ -app-name } { $version } sürümündeki yeni özellikleri</a>öğrenin
post-upgrade-density = Tercih ettiğiniz düzen yoğunluğunu seçin:
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Yapıştır ve Ara
mac-word-plugin-install-message = Word eklentisini kurmak için, Zotero'nun Word verilerine erişmesi gerekiyor.
mac-word-plugin-install-action-button =
    .label = Word Eklentisini Kur
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
