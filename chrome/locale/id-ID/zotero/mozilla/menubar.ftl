# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


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
menu-file-close =
    .label = Tutup
    .accesskey = u
menu-file-close-window =
    .label = Tutup Jendela
    .accesskey = d
menu-file-save-page =
    .label = Simpan Laman dengan Nama…
    .accesskey = S
menu-file-email-link =
    .label = Surelkan Tautan…
    .accesskey = K
menu-file-print-setup =
    .label = Tata Laman…
    .accesskey = n
menu-file-print-preview =
    .label = Pratinjau Cetak
    .accesskey = P
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
menu-edit-find-on =
    .label = Cari di Laman Ini…
    .accesskey = C
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
menu-view-customize-toolbar =
    .label = Ubahsuai…
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
menu-view-charset =
    .label = Pengodean Teks
    .accesskey = o

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

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Markah
    .accesskey = M
menu-bookmarks-show-all =
    .label = Tampilkan Semua Markah…
menu-bookmark-this-page =
    .label = Markahi Laman ini
menu-bookmark-edit =
    .label = Edit Markah Ini
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
menu-tools-addons =
    .label = Pengaya
    .accesskey = P
menu-tools-fxa-sign-in =
    .label = Masuk ke { -brand-product-name }…
    .accesskey = M
menu-tools-turn-on-sync =
    .label = Aktifkan { -sync-brand-short-name }…
    .accesskey = A
menu-tools-sync-now =
    .label = Sinkronkan Sekarang
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Sambungkan ulang ke { -brand-product-name }…
    .accesskey = S
menu-tools-web-developer =
    .label = Pengembang Web
    .accesskey = W
menu-tools-page-source =
    .label = Kode Sumber Laman
    .accesskey = S
menu-tools-page-info =
    .label = Informasi Laman
    .accesskey = I
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Pengaturan…
           *[other] Pengaturan
        }
    .accesskey =
        { PLATFORM() ->
            [windows] g
           *[other] g
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

menu-help =
    .label = Bantuan
    .accesskey = n
menu-help-product =
    .label = Bantuan { -brand-shorter-name }
    .accesskey = B
menu-help-show-tour =
    .label = Tur { -brand-shorter-name }
    .accesskey = u
menu-help-import-from-another-browser =
    .label = Impor dari Peramban Lain…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Pintasan Papan Ketik
    .accesskey = K
menu-help-troubleshooting-info =
    .label = Informasi Pemecahan Masalah…
    .accesskey = M
menu-help-feedback-page =
    .label = Kirim Saran…
    .accesskey = S
menu-help-safe-mode-without-addons =
    .label = Mulai Ulang dengan Pengaya Dinonaktifkan…
    .accesskey = n
menu-help-safe-mode-with-addons =
    .label = Mulai Ulang dengan Pengaya Diaktifkan
    .accesskey = n
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Laporkan Situs Tipuan…
    .accesskey = s
menu-help-not-deceptive =
    .label = Ini bukan situs tipuan…
    .accesskey = d
