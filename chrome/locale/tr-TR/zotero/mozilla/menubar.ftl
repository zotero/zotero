# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Dosya
    .accesskey = D
menu-file-new-tab =
    .label = Yeni sekme
    .accesskey = s
menu-file-new-container-tab =
    .label = Yeni kapsayıcı sekme
    .accesskey = k
menu-file-new-window =
    .label = Yeni pencere
    .accesskey = Y
menu-file-new-private-window =
    .label = Yeni gizli pencere
    .accesskey = n
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Konumu aç…
menu-file-open-file =
    .label = Dosya aç…
    .accesskey = a
menu-file-close =
    .label = Kapat
    .accesskey = K
menu-file-close-window =
    .label = Pencereyi kapat
    .accesskey = P
menu-file-save-page =
    .label = Sayfayı farklı kaydet…
    .accesskey = f
menu-file-email-link =
    .label = Bağlantıyı e-postayla gönder…
    .accesskey = e
menu-file-print-setup =
    .label = Sayfa düzeni…
    .accesskey = ü
menu-file-print-preview =
    .label = Yazdırma ön izleme
    .accesskey = ö
menu-file-print =
    .label = Yazdır…
    .accesskey = z
menu-file-import-from-another-browser =
    .label = Başka bir tarayıcıdan içe aktar…
    .accesskey = B
menu-file-go-offline =
    .label = Çevrimdışı çalış
    .accesskey = d

## Edit Menu

menu-edit =
    .label = Düzen
    .accesskey = z
menu-edit-find-on =
    .label = Bu sayfada bul…
    .accesskey = s
menu-edit-find-again =
    .label = Sonrakini bul
    .accesskey = a
menu-edit-bidi-switch-text-direction =
    .label = Metnin yönünü değiştir
    .accesskey = M

## View Menu

menu-view =
    .label = Görünüm
    .accesskey = m
menu-view-toolbars-menu =
    .label = Araç çubukları
    .accesskey = A
menu-view-customize-toolbar =
    .label = Özelleştir…
    .accesskey = Ö
menu-view-sidebar =
    .label = Kenar çubuğu
    .accesskey = K
menu-view-bookmarks =
    .label = Yer imleri
menu-view-history-button =
    .label = Geçmiş
menu-view-synced-tabs-sidebar =
    .label = Eşitlenmiş sekmeler
menu-view-full-zoom =
    .label = Yakınlaştırma
    .accesskey = Y
menu-view-full-zoom-enlarge =
    .label = Yaklaştır
    .accesskey = Y
menu-view-full-zoom-reduce =
    .label = Uzaklaştır
    .accesskey = U
menu-view-full-zoom-actual-size =
    .label = Gerçek boyut
    .accesskey = G
menu-view-full-zoom-toggle =
    .label = Sadece metni yakınlaştır
    .accesskey = m
menu-view-page-style-menu =
    .label = Sayfa stili
    .accesskey = S
menu-view-page-style-no-style =
    .label = Stil yok
    .accesskey = S
menu-view-page-basic-style =
    .label = Temel sayfa stili
    .accesskey = T
menu-view-charset =
    .label = Metin kodlaması
    .accesskey = k

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Tam ekrana geç
    .accesskey = T
menu-view-exit-full-screen =
    .label = Tam ekrandan çık
    .accesskey = T
menu-view-full-screen =
    .label = Tam ekran
    .accesskey = T

##

menu-view-show-all-tabs =
    .label = Tüm sekmeleri göster
    .accesskey = s
menu-view-bidi-switch-page-direction =
    .label = Sayfanın yönünü değiştir
    .accesskey = d

## History Menu

menu-history =
    .label = Geçmiş
    .accesskey = G
menu-history-show-all-history =
    .label = Tüm geçmişi göster
menu-history-clear-recent-history =
    .label = Yakın geçmişi temizle…
menu-history-synced-tabs =
    .label = Eşitlenmiş sekmeler
menu-history-restore-last-session =
    .label = Önceki oturumu geri yükle
menu-history-hidden-tabs =
    .label = Gizli sekmeler
menu-history-undo-menu =
    .label = Son kapatılan sekmeler
menu-history-undo-window-menu =
    .label = Son kapatılan pencereler

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Yer imleri
    .accesskey = Y
menu-bookmarks-show-all =
    .label = Tüm yer imlerini göster
menu-bookmark-this-page =
    .label = Bu sayfayı yer imlerine ekle
menu-bookmark-edit =
    .label = Bu yer imini düzenle
menu-bookmarks-all-tabs =
    .label = Tüm sekmeleri yer imlerine ekle…
menu-bookmarks-toolbar =
    .label = Yer imleri araç çubuğu
menu-bookmarks-other =
    .label = Diğer yer imleri
menu-bookmarks-mobile =
    .label = Mobil yer imleri

## Tools Menu

menu-tools =
    .label = Araçlar
    .accesskey = A
menu-tools-downloads =
    .label = İndirilenler
    .accesskey = d
menu-tools-addons =
    .label = Eklentiler
    .accesskey = E
menu-tools-fxa-sign-in =
    .label = { -brand-product-name }’a giriş yap…
    .accesskey = g
menu-tools-turn-on-sync =
    .label = { -sync-brand-short-name }’i etkinleştir…
    .accesskey = n
menu-tools-sync-now =
    .label = Şimdi eşitle
    .accesskey = m
menu-tools-fxa-re-auth =
    .label = { -brand-product-name }’a yeniden bağlan…
    .accesskey = b
menu-tools-web-developer =
    .label = Web geliştirici
    .accesskey = W
menu-tools-page-source =
    .label = Sayfa kaynağı
    .accesskey = a
menu-tools-page-info =
    .label = Sayfa bilgileri
    .accesskey = b
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Seçenekler
           *[other] Tercihler
        }
    .accesskey =
        { PLATFORM() ->
            [windows] S
           *[other] T
        }
menu-tools-layout-debugger =
    .label = Düzen hata ayıklayıcısı
    .accesskey = D

## Window Menu

menu-window-menu =
    .label = Pencere
menu-window-bring-all-to-front =
    .label = Hepsini ön plana getir

## Help Menu

menu-help =
    .label = Yardım
    .accesskey = Y
menu-help-product =
    .label = { -brand-shorter-name } yardımı
    .accesskey = m
menu-help-show-tour =
    .label = { -brand-shorter-name } turu
    .accesskey = u
menu-help-import-from-another-browser =
    .label = Başka bir tarayıcıdan içe aktar…
    .accesskey = B
menu-help-keyboard-shortcuts =
    .label = Klavye kısayolları
    .accesskey = K
menu-help-troubleshooting-info =
    .label = Sorun giderme bilgileri
    .accesskey = b
menu-help-feedback-page =
    .label = Geri bildirim gönder…
    .accesskey = G
menu-help-safe-mode-without-addons =
    .label = Eklentileri devre dışı bırakıp başlat…
    .accesskey = E
menu-help-safe-mode-with-addons =
    .label = Eklentileri etkinleştirip yeniden başlat
    .accesskey = E
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Aldatıcı siteyi ihbar et…
    .accesskey = A
menu-help-not-deceptive =
    .label = Bu site aldatıcı değil…
    .accesskey = d
