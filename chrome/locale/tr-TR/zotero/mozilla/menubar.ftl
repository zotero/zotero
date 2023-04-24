# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Tercihler
menu-application-services =
    .label = Servisler
menu-application-hide-this =
    .label = { -brand-shorter-name } uygulamasını gizle
menu-application-hide-other =
    .label = Diğerlerini gizle
menu-application-show-all =
    .label = Tümünü göster
menu-application-touch-bar =
    .label = Touch Bar’ı özelleştir…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Çık
           *[other] Çık
        }
    .accesskey =
        { PLATFORM() ->
            [windows] k
           *[other] k
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = { -brand-shorter-name } uygulamasından çık
menu-about =
    .label = { -brand-shorter-name } hakkında
    .accesskey = h

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
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Sekmeyi kapat
            [one] { $tabCount } sekmeyi kapat
           *[other] { $tabCount } sekmeyi kapat
        }
    .accesskey = e
menu-file-close-window =
    .label = Pencereyi kapat
    .accesskey = P
menu-file-save-page =
    .label = Sayfayı farklı kaydet…
    .accesskey = f
menu-file-email-link =
    .label = Bağlantıyı e-postayla gönder…
    .accesskey = e
menu-file-share-url =
    .label = Paylaş
    .accesskey = a
menu-file-print-setup =
    .label = Sayfa düzeni…
    .accesskey = ü
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
menu-edit-find-in-page =
    .label = Sayfada bul…
    .accesskey = b
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
menu-view-customize-toolbar2 =
    .label = Araç çubuğunu özelleştir…
    .accesskey = z
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
menu-view-repair-text-encoding =
    .label = Metin kodlamasını onar
    .accesskey = M

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

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Okuyucu Görünümü'ne geç
    .accesskey = O
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Okuyucu Görünümü'nü kapat
    .accesskey = O

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
menu-history-reopen-all-tabs = Tüm sekmeleri yeniden aç
menu-history-reopen-all-windows = Tüm pencereleri yeniden aç

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Yer imleri
    .accesskey = Y
menu-bookmarks-manage =
    .label = Yer imlerini yönet
menu-bookmark-current-tab =
    .label = Bu sekmeyi yer imlerine ekle
menu-bookmark-edit =
    .label = Bu yer imini düzenle
menu-bookmark-tab =
    .label = Bu sekmeyi yer imlerine ekle…
menu-edit-bookmark =
    .label = Bu yer imini düzenle…
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
menu-tools-addons-and-themes =
    .label = Eklentiler ve temalar
    .accesskey = a
menu-tools-fxa-sign-in2 =
    .label = Giriş yap
    .accesskey = G
menu-tools-turn-on-sync2 =
    .label = Eşitlemeyi başlat…
    .accesskey = E
menu-tools-sync-now =
    .label = Şimdi eşitle
    .accesskey = m
menu-tools-fxa-re-auth =
    .label = { -brand-product-name }’a yeniden bağlan…
    .accesskey = b
menu-tools-browser-tools =
    .label = Tarayıcı araçları
    .accesskey = T
menu-tools-task-manager =
    .label = Görev yöneticisi
    .accesskey = G
menu-tools-page-source =
    .label = Sayfa kaynağı
    .accesskey = a
menu-tools-page-info =
    .label = Sayfa bilgileri
    .accesskey = b
menu-settings =
    .label = Ayarlar
    .accesskey =
        { PLATFORM() ->
            [windows] A
           *[other] r
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


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Yardım
    .accesskey = r
menu-get-help =
    .label = Yardım al
    .accesskey = Y
menu-help-more-troubleshooting-info =
    .label = Sorun giderme bilgileri
    .accesskey = S
menu-help-report-site-issue =
    .label = Siteyle ilgili sorun bildir…
menu-help-share-ideas =
    .label = Fikir ve görüş paylaş…
    .accesskey = F
menu-help-enter-troubleshoot-mode2 =
    .label = Sorun giderme modu…
    .accesskey = o
menu-help-exit-troubleshoot-mode =
    .label = Sorun giderme modunu kapat
    .accesskey = m
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Aldatıcı siteyi ihbar et…
    .accesskey = A
menu-help-not-deceptive =
    .label = Bu site aldatıcı değil…
    .accesskey = d
