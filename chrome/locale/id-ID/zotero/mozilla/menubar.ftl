# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Pengaturan
menu-application-services =
    .label = Layanan
menu-application-hide-this =
    .label = Sembunyikan { -brand-shorter-name }
menu-application-hide-other =
    .label = Sembunyikan Lainnya
menu-application-show-all =
    .label = Tampilkan Semua
menu-application-touch-bar =
    .label = Ubahsuai Touch Bar…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Keluar
           *[other] Keluar
        }
    .accesskey =
        { PLATFORM() ->
            [windows] K
           *[other] K
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Keluar dari { -brand-shorter-name }
menu-about =
    .label = Tentang { -brand-shorter-name }
    .accesskey = T

## File Menu

menu-file =
    .label = Berkas
    .accesskey = B
menu-file-new-tab =
    .label = Tab Baru
    .accesskey = T
menu-file-new-container-tab =
    .label = Tab Kontainer Baru
    .accesskey = K
menu-file-new-window =
    .label = Jendela Baru
    .accesskey = J
menu-file-new-private-window =
    .label = Jendela Mode Pribadi Baru
    .accesskey = u
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Buka Lokasi…
menu-file-open-file =
    .label = Buka Berkas…
    .accesskey = B
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Tutup Tab
           *[other] Tutup { $tabCount } Tab
        }
    .accesskey = T
menu-file-close-window =
    .label = Tutup Jendela
    .accesskey = d
menu-file-save-page =
    .label = Simpan Laman dengan Nama…
    .accesskey = S
menu-file-email-link =
    .label = Surelkan Tautan…
    .accesskey = K
menu-file-share-url =
    .label = Bagikan
    .accesskey = B
menu-file-print-setup =
    .label = Tata Laman…
    .accesskey = n
menu-file-print =
    .label = Cetak…
    .accesskey = C
menu-file-import-from-another-browser =
    .label = Impor dari Peramban Lain…
    .accesskey = I
menu-file-go-offline =
    .label = Bekerja Luring
    .accesskey = L

## Edit Menu

menu-edit =
    .label = Edit
    .accesskey = E
menu-edit-find-in-page =
    .label = Temukan di Laman…
    .accesskey = T
menu-edit-find-again =
    .label = Cari Lagi
    .accesskey = i
menu-edit-bidi-switch-text-direction =
    .label = Ubah Arah Teks
    .accesskey = T

## View Menu

menu-view =
    .label = Tampilan
    .accesskey = T
menu-view-toolbars-menu =
    .label = Bilah Alat
    .accesskey = t
menu-view-customize-toolbar2 =
    .label = Ubahsuai Bilah Alat…
    .accesskey = U
menu-view-sidebar =
    .label = Bilah Samping
    .accesskey = m
menu-view-bookmarks =
    .label = Markah
menu-view-history-button =
    .label = Riwayat
menu-view-synced-tabs-sidebar =
    .label = Tab yang Disinkronkan
menu-view-full-zoom =
    .label = Perbesaran
    .accesskey = b
menu-view-full-zoom-enlarge =
    .label = Perbesar
    .accesskey = b
menu-view-full-zoom-reduce =
    .label = Perkecil
    .accesskey = k
menu-view-full-zoom-actual-size =
    .label = Ukuran Asli
    .accesskey = A
menu-view-full-zoom-toggle =
    .label = Perbesar Teks Saja
    .accesskey = T
menu-view-page-style-menu =
    .label = Gaya Laman
    .accesskey = G
menu-view-page-style-no-style =
    .label = Tanpa Gaya
    .accesskey = T
menu-view-page-basic-style =
    .label = Gaya Standar Laman
    .accesskey = S
menu-view-repair-text-encoding =
    .label = Memperbaiki Pengodean Teks
    .accesskey = k

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Masuk ke Mode Layar Penuh
    .accesskey = P
menu-view-exit-full-screen =
    .label = Keluar dari Mode Layar Penuh
    .accesskey = K
menu-view-full-screen =
    .label = Layar Penuh
    .accesskey = P

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Masuk ke Tampilan Baca
    .accesskey = B
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Tutup Tampilan Pembaca
    .accesskey = T

##

menu-view-show-all-tabs =
    .label = Tampilkan Semua Tab
    .accesskey = S
menu-view-bidi-switch-page-direction =
    .label = Ubah Arah Laman
    .accesskey = A

## History Menu

menu-history =
    .label = Riwayat
    .accesskey = R
menu-history-show-all-history =
    .label = Tampilkan Semua Riwayat
menu-history-clear-recent-history =
    .label = Bersihkan Riwayat Terakhir
menu-history-synced-tabs =
    .label = Tab yang Disinkronkan
menu-history-restore-last-session =
    .label = Pulihkan Sesi Sebelumnya
menu-history-hidden-tabs =
    .label = Tab Tersembunyi
menu-history-undo-menu =
    .label = Tab yang Baru Saja Ditutup
menu-history-undo-window-menu =
    .label = Jendela yang Baru Saja Ditutup
menu-history-reopen-all-tabs = Buka Ulang Semua Tab
menu-history-reopen-all-windows = Buka Ulang Semua Jendela

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Markah
    .accesskey = M
menu-bookmarks-manage =
    .label = Kelola Markah
menu-bookmark-current-tab =
    .label = Markahi Tab Saat Ini
menu-bookmark-edit =
    .label = Edit Markah Ini
menu-bookmark-tab =
    .label = Markahi Tab Saat Ini…
menu-edit-bookmark =
    .label = Ubah Markah Ini…
menu-bookmarks-all-tabs =
    .label = Markahi Semua Tab…
menu-bookmarks-toolbar =
    .label = Bilah Alat Markah
menu-bookmarks-other =
    .label = Markah Lain
menu-bookmarks-mobile =
    .label = Markah Seluler

## Tools Menu

menu-tools =
    .label = Alat
    .accesskey = A
menu-tools-downloads =
    .label = Unduhan
    .accesskey = U
menu-tools-addons-and-themes =
    .label = Pengaya dan Tema
    .accesskey = P
menu-tools-fxa-sign-in2 =
    .label = Masuk
    .accesskey = M
menu-tools-turn-on-sync2 =
    .label = Aktifkan Sinkronisasi…
    .accesskey = A
menu-tools-sync-now =
    .label = Sinkronkan Sekarang
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Sambungkan ulang ke { -brand-product-name }…
    .accesskey = S
menu-tools-browser-tools =
    .label = Alat Peramban
    .accesskey = A
menu-tools-task-manager =
    .label = Pengelola Tugas
    .accesskey = P
menu-tools-page-source =
    .label = Kode Sumber Laman
    .accesskey = S
menu-tools-page-info =
    .label = Informasi Laman
    .accesskey = I
menu-settings =
    .label = Pengaturan
    .accesskey =
        { PLATFORM() ->
            [windows] P
           *[other] P
        }
menu-tools-layout-debugger =
    .label = Debugger Tata Letak
    .accesskey = D

## Window Menu

menu-window-menu =
    .label = Jendela
menu-window-bring-all-to-front =
    .label = Tampilkan Semua ke Latar Depan

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Bantuan
    .accesskey = n
menu-get-help =
    .label = Dapatkan Bantuan
    .accesskey = B
menu-help-more-troubleshooting-info =
    .label = Informasi Pemecahan Masalah Lebih Lanjut
    .accesskey = I
menu-help-report-site-issue =
    .label = Laporkan Masalah Situs…
menu-help-share-ideas =
    .label = Bagikan Ide dan Umpan Balik
    .accesskey = B
menu-help-enter-troubleshoot-mode2 =
    .label = Mode Pemecahan Masalah…
    .accesskey = P
menu-help-exit-troubleshoot-mode =
    .label = Nonaktifkan Mode Pemecahan Masalah
    .accesskey = N
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Laporkan Situs Tipuan…
    .accesskey = s
menu-help-not-deceptive =
    .label = Ini bukan situs tipuan…
    .accesskey = d
