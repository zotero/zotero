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
general-print = Štampaj
general-remove = Ukloni
general-add = Dodaj
general-remind-me-later = Podseti me kasnije
general-dont-ask-again = Ne pitaj me ponovo
general-choose-file = Izaberi datoteku…
general-open-settings = Otvori podešavanja
general-settings = Podešavanja…
general-help = Pomoć
general-tag = Oznaka
general-got-it = Razumem
general-done = Gotovo
general-view-troubleshooting-instructions = Pogledaj uputstva za rešavanje problema
general-go-back = Idi nazad
general-accept = Prihvati
general-cancel = Otkaži
cancel-button =
    .label = { general-cancel }
general-show-in-library = Prikaži u biblioteci
general-restartApp = Ponovo pokreni { -app-name }
general-restartInTroubleshootingMode = Pokreni u režimu za traženje problema
general-save = Sačuvaj
general-clear = Očisti
clear-button =
    .label = { general-clear }
general-update = Ažuriranje
general-reset-to-default = Vrati na podrazumevano
general-back = Nazad
general-edit = Uređivanje
general-cut = Iseci
general-copy = Kopiraj
general-paste = Ubaci
general-find = Nađi
general-delete = Obriši
general-insert = Umetni
general-and = i
general-et-al = i sar.
general-previous = Prethodno
general-next = Sledeće
general-learn-more = Saznajte više
general-more-information = Više podataka
general-warning = Upozorenje
general-type-to-continue = Ukucajte „{ $text }” da biste nastavili.
general-continue = Nastavi
general-allow = Dozvoli
general-always-allow = Uvek dozvoli
general-deny = Odbij
general-red = Crveno
general-orange = Narandžasto
general-yellow = Žuto
general-green = Zeleno
general-teal = Svetlo plavo
general-blue = Plavo
general-purple = Purpurno
general-magenta = Magentno
general-violet = Ljubičasto
general-maroon = Smeđe
general-gray = Sivo
general-black = Crno
general-loading = Učitavam…
db-checking-integrity = Provera integriteta baze podataka…
db-repairing = Popravka baze podataka…
citation-style-label = Stil citata:
language-label = Jezik:
menu-custom-group-submenu =
    .label = Više opcija…
menu-file-show-in-finder =
    .label = Prikaži u pretrazi
menu-file-show-file =
    .label = Prikaži datoteku
menu-file-show-files =
    .label = Prikaži datoteke
menu-print =
    .label = { general-print }
menu-density =
    .label = Gustina
add-attachment = Dodaj prilog
new-note = Nova beleška
menu-add-by-identifier =
    .label = Dodaj na osnovu identifikatora…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Dodaj datoteku…
menu-add-standalone-linked-file-attachment =
    .label = Dodaj vezu do datoteke…
menu-add-child-file-attachment =
    .label = Dodaj datoteku…
menu-add-child-linked-file-attachment =
    .label = Priloži vezu do datoteke…
menu-add-child-linked-url-attachment =
    .label = Priloži vezu na vebu…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nova samostalna beleška
menu-new-item-note =
    .label = Beleška o novoj stavki
menu-restoreToLibrary =
    .label = Vrati u biblioteku
menu-deletePermanently =
    .label = Trajno izbriši…
menu-tools-plugins =
    .label = Priključci
menu-view-columns-move-left =
    .label = Pomeri kolonu levo
menu-view-columns-move-right =
    .label = Pomeri kolonu desno
menu-view-hide-context-annotation-rows =
    .label = Sakrij napomene koje ne odgovaraju filteru
menu-view-note-font-size =
    .label = Veličina fonta za beleške
menu-view-note-tab-font-size =
    .label = Veličina fonta kartice beleške
menu-show-tabs-menu =
    .label = Prikaži meni kartica
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Kopiraj napomenu
            [few] Kopiraj { $count } napomene
           *[other] Kopiraj { $count } napomena
        }
main-window-command =
    .label = Biblioteka
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = Izlistaj sve kartice
filter-collections = Filter zbirki
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Pretraži kartice
zotero-tabs-menu-close-button =
    .title = Zatvori karticu
zotero-toolbar-tabs-scroll-forwards =
    .title = Pomeri unapred
zotero-toolbar-tabs-scroll-backwards =
    .title = Pomeri unazad
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
recently-read = Nedavno čitano
collections-menu-show-recently-read =
    .label = Prikaži { recently-read }
item-menu-remove-from-recently-read =
    .label = Ukloni iz { recently-read }…
collections-menu-clear-all-last-read =
    .label = Obriši sve datume poslednjeg čitanja…
recently-read-clear-all-confirm = Svi datumi poslednjeg čitanja u ovoj biblioteci biće obrisani.
items-list-load-error-plugin = Error loading items list. Disabling the “{ $plugin }” plugin and restarting { -app-name } may fix this.
items-section-collections-selected =
    { $count ->
        [one] Izabrana je { $count } zbirka
        [few] Izabrane su { $count } zbirke
       *[other] Izabrano je { $count } zbirki
    }
items-section-searches-selected =
    { $count ->
        [one] Izabrana je { $count } sačuvana pretraga
        [few] Izabrane su { $count } sačuvane pretrage
       *[other] Izabrano je { $count } sačuvanih pretraga
    }
items-section-sources-selected =
    { $count ->
        [one] Izabran je { $count } izvor
        [few] Izabrana su { $count } izvora
       *[other] Izabrano je { $count } izvora
    }
items-section-library-collections =
    { $count ->
        [one] { $library } (izabrana { $count } zbirka)
        [few] { $library } (izabrane { $count } zbirke)
       *[other] { $library } (izabrano { $count } zbirki)
    }
items-section-library-searches =
    { $count ->
        [one] { $library } (izabrana { $count } sačuvana pretraga)
        [few] { $library } (izabrane { $count } sačuvane pretrage)
       *[other] { $library } (izabrano { $count } sačuvanih pretraga)
    }
items-section-library-sources =
    { $count ->
        [one] { $library } (izabran { $count } izvor)
        [few] { $library } (izabrana { $count } izvora)
       *[other] { $library } (izabrano { $count } izvora)
    }
items-section-library-recently-read = { $library } ({ recently-read })
items-section-library = { $library }
collections-menu-rename =
    .label = Preimenuj
edit-saved-search = Uredi sačuvanu pretragu
collections-menu-edit-search =
    .label = Uredi pretragu
collections-menu-duplicate-search =
    .label = Napravi duplikat pretrage
collections-menu-move-collection =
    .label = Premesti u
collections-menu-copy-collection =
    .label = Kopiraj u
collections-menu-export =
    .label = Izvoz…
collections-menu-generate-report =
    .label = Napravi izveštaj…
collections-menu-create-bibliography =
    .label = Napravi bibliografiju…
collections-menu-unsubscribe =
    .label = Otkaži pretplatu…
collections-menu-delete =
    .label =
        { $count ->
            [one] Obriši zbirku…
            [few] Obriši zbirke…
           *[other] Obriši zbirke…
        }
collections-menu-delete-with-items =
    .label =
        { $count ->
            [one] Obriši zbirku i stavke…
            [few] Obriši zbirke i stavke…
           *[other] Obriši zbirke i stavke…
        }
collections-menu-delete-search =
    .label =
        { $count ->
            [one] Obriši pretragu…
            [few] Obriši pretrage…
           *[other] Obriši pretrage…
        }
collections-delete-title =
    { $count ->
        [one] Obriši zbirku
        [few] Obriši zbirke
       *[other] Obriši zbirke
    }
collections-delete-message =
    { $count ->
        [one] Da li ste sigurni da želite da obrišete ovu zbirku?
        [few] Da li ste sigurni da želite da obrišete { $count } zbirke?
       *[other] Da li ste sigurni da želite da obrišete { $count } zbirki?
    }
collections-delete-keep-items =
    { $count ->
        [one] Stavke unutar ove zbirke neće biti obrisane.
        [few] Stavke unutar ovih zbirki neće biti obrisane.
       *[other] Stavke unutar ovih zbirki neće biti obrisane.
    }
collections-delete-with-items-title =
    { $count ->
        [one] Obriši zbirku i stavke
        [few] Obriši zbirke i stavke
       *[other] Obriši zbirke i stavke
    }
collections-delete-with-items-message =
    { $count ->
        [one] Da li ste sigurni da želite da obrišete ovu zbirku i premestite sve stavke unutar nje u Smeće?
        [few] Da li ste sigurni da želite da obrišete { $count } zbirke i premestite sve stavke unutar njih u Smeće?
       *[other] Da li ste sigurni da želite da obrišete { $count } zbirki i premestite sve stavke unutar njih u Smeće?
    }
collections-delete-search-title =
    { $count ->
        [one] Obriši pretragu
        [few] Obriši pretrage
       *[other] Obriši pretrage
    }
collections-delete-search-message =
    { $count ->
        [one] Da li ste sigurni da želite da obrišete ovu pretragu?
        [few] Da li ste sigurni da želite da obrišete { $count } pretrage?
       *[other] Da li ste sigurni da želite da obrišete { $count } pretraga?
    }
item-creator-moveDown =
    .label = Premesti dole
item-creator-moveToTop =
    .label = Premesti na vrh
item-creator-moveUp =
    .label = Premesti gore
item-menu-viewAttachment =
    .label =
        Otvori { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF dokument
                    [epub] EPUB knjigu
                    [snapshot] snimak stranice
                    [note] belešku
                   *[other] prilog
                }
            [few]
                { $attachmentType ->
                    [pdf] PDF dokumente
                    [epub] EPUB knjige
                    [snapshot] snimke stranica
                    [note] beleške
                   *[other] priloge
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDF dokumente
                    [epub] EPUB knjige
                    [snapshot] snimke stranica
                    [note] beleške
                   *[other] priloge
                }
        } { $openIn ->
            [tab] u novoj kartici
            [window] u novom prozoru
           *[other] { "" }
        }
item-menu-add-file =
    .label = Datoteka
item-menu-add-linked-file =
    .label = Povezana datoteka
item-menu-add-url =
    .label = Veza na vebu
item-menu-change-parent-item =
    .label = Promeni roditeljsku stavku…
item-menu-relate-items =
    .label = Poveži stavke
view-online = Pogledaj na mreži
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Datoteka je preimenovana u { $filename }
file-access-error-fs-corrupted = { -os-name } reported that the file or disk is corrupted. Run a disk check on the drive containing the file.
itembox-button-options =
    .tooltiptext = Otvori kontekstni meni
itembox-button-merge =
    .aria-label = Izaberi verziju polja { $field }
create-parent-intro = Unesite DOI, ISBN, PMIB, arHib IB ili ADS Bibkod za identifikaciju ove datoteke:
reader-use-dark-mode-for-content =
    .label = Tamni režim za sadržaj
update-updates-found-intro-minor = Dostupno je ažuriranje za { -app-name }:
update-updates-found-desc = Preporučujemo da primenite ovo ažuriranje što pre.
import-window =
    .title = Uvezi
import-where-from = Odakle želite da uvezete?
import-online-intro-title = Uvod
import-source-file =
    .label = Iz datoteke (BibTeKs, RIS, Zoterov RDF…)
import-source-folder =
    .label = Fascikla sa PDF ili drugim datotekama
import-source-online =
    .label = { $targetApp } uvoz sa mreže
import-options = Opcije
import-importing = Uvozim…
import-create-collection =
    .label = Postavi uvezene zbirke i stavke u novu zbirku
import-recreate-structure =
    .label = Ponovo napravi strukturu u vidu zbirki
import-fileTypes-header = Vrste datoteka za uvoz:
import-fileTypes-pdf =
    .label = PDF-ovi
import-fileTypes-other =
    .placeholder = Otvori datoteke na osnovu šablona razdvojenog zarezima (npr. *.jpg,*.png)
import-file-handling = Rad sa datotekama
import-file-handling-store =
    .label = Kopiraj datoteke u { -app-name } fasciklu sa skladištem
import-file-handling-link =
    .label = Poveži sa datotekama na originalnoj lokaciji
import-fileHandling-description = Ne mogu da uskladim povezane datoteke u programu { -app-name }.
import-online-new =
    .label = Preuzmi samo nove stavke; ne ažuriraj prethodno uvezene stavke
import-mendeley-username = Korisničko ime
import-mendeley-password = Lozinka
general-error = Greška
file-interface-import-error = Greška pri uvozu izabrane datoteke. Proverite da li je datoteka ispravna i pokušajte ponovo.
file-interface-import-complete = Uvoz je završen
file-interface-items-were-imported =
    { $numItems ->
        [0] Nisu uvezene stavke
        [one] Stavka je uvezena
       *[other] Uvezenih stavki: { $numItems }
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Stavke nisu ponovo povezane
        [one] Stavka je ponovo povezana
       *[other] Ponovo povezanih stavki: { $numRelinked }
    }
import-mendeley-cannot-decrypt = The selected Mendeley database could not be decrypted. This can happen if the database file has been renamed. See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
import-mendeley-unsupported = The selected file does not appear to be a Mendeley database. See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
import-mendeley-db-in-use = The selected Mendeley database is in use. Please quit Mendeley Desktop and try again.
file-interface-import-error-translator = Greška prilikom uvoza izabrane datoteke preko „{ $translator }“. Proverite da li je datoteka ispravna i pokušajte ponovo.
import-online-intro = U sledećem koraku ćemo vas pozvati da se prijavite na { $targetAppOnline } i date dozvole za pristup programu { -app-name }. Ovo je nophodno da uvezete vašu { $targetApp } biblioteku u { -app-name }.
import-online-intro2 = { -app-name } nikada neće videti ili čuvati vašu { $targetApp } lozinku.
import-online-form-intro = Unesite vaše podatke za prijavu na { $targetAppOnline }. Ovo je neophodno da uvezete { $targetApp } biblioteku u { -app-name }.
import-online-wrong-credentials = Nije uspela prijava na { $targetApp }. Unesite podatke za prijavu i pokušajte ponovo.
import-online-blocked-by-plugin = Ne možete da nastavite uvoz dok je pokrenut priključak { $plugin }. Isključite ovaj priključak i pokušajte ponovo.
import-online-relink-only =
    .label = Ponovo poveži citate iz Mendeljejeva
import-online-relink-kb = { general-more-information }
import-online-connection-error = { -app-name } ne može da se poveže na { $targetApp }. Proverite vezu sa internetom i pokušajte ponovo.
tab-title-multiple-collections = Više
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } beleška
            [few] { $count } beleške
           *[other] { $count } beleški
        }
items-column-added-by = Dodao/la
items-column-modified-by = Izmenio/la
items-column-last-read = Poslednji put čitano
report-error =
    .label = Greška u izveštaju…
rtfScan-wizard =
    .title = RTF skener
rtfScan-introPage-description = { -app-name } može automatski da izvuče, ponovo formatira citate i ubaci bibliografiju u RTF datoteke. Trenutno podržava citate u varijantama sledećih formata:
rtfScan-introPage-description2 = Za počatak otvorite RTF datoteku i izaberite izlaznu datoteku:
rtfScan-input-file = Ulazna datoteka:
rtfScan-output-file = Izlazna datoteka:
rtfScan-no-file-selected = Nije izabrana datoteka
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Izaberite ulaznu datoteku
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Izaberite izlaznu datoteku
rtfScan-intro-page = Uvod
rtfScan-scan-page = Tražim citate
rtfScan-scanPage-description = { -app-name } pretražuje vaš dokument u potrazi za citatima. Budite strpljivi.
rtfScan-citations-page = Verifikuj citirane stavke
rtfScan-citations-page-description = Pregledajte spisak prepoznatih citata kako bi proverili da li je { -app-name } pravilno izabrao odgovarajuće stavke. Ukoliko postoje citati koji nisu povezani ili su čudni, morate ih srediti pre nego što nastavite dalje.
rtfScan-style-page = Formatiram dokument
rtfScan-format-page = Formatiram citate
rtfScan-format-page-description = { -app-name } obrađuje i formatira vašu RTF datoteku. Budite strpljivi.
rtfScan-complete-page = RTF skeniranje je završeno
rtfScan-complete-page-description = Vaš dokument je skeniran i obrađen. Proverite da li je ispravno formatiran.
rtfScan-action-find-match =
    .title = Izaberi stavke koje se podudaraju
rtfScan-action-accept-match =
    .title = Prihvati ovo podudaranje
runJS-title = Pokreni JavaSkript
runJS-editor-label = Kod:
runJS-run = Pokreni
runJS-help = { general-help }
runJS-completed = uspešno završeno
runJS-result =
    { $type ->
        [async] Vraćena vrednost:
       *[other] Rezultat:
    }
runJS-run-async = Pokreni kao asinhronu funkciju
bibliography-window =
    .title = { -app-name } - pravljenje citata/bibliografije
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Prikaži citate kao:
bibliography-advancedOptions-label = Napredne opcije
bibliography-outputMode-label = Izvezi kao:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citate
            [note] Beleške
           *[other] Citate
        }
bibliography-outputMode-bibliography =
    .label = Bibliografiju
bibliography-outputMethod-label = Način izvoza:
bibliography-outputMethod-saveAsRTF =
    .label = Snimi kao RTF
bibliography-outputMethod-saveAsHTML =
    .label = Snimi kao HTML
bibliography-outputMethod-copyToClipboard =
    .label = Kopiraj u ostavu
bibliography-outputMethod-print =
    .label = Štampaj
bibliography-manageStyles-label = Uredi stilove…
styleEditor-locatorType =
    .aria-label = Vrsta lokatora
styleEditor-locatorInput = Unos lokatora
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Uređivač stilova
styleEditor-preview =
    .aria-label = Pregled
stylePreview-generating = Generisanje pregleda…
publications-intro-page = Moji radovi
publications-intro = Stavke koje ste dodali u Moji radovi će biti prikazane na vašoj stranici u okviru sajta zotero.org. Ukoliko želite da dodate i priloge, oni će biti javno dostupni pod licencom koji izaberete. Dodajte samo radove koje ste sami napravili i datoteke za koje posedujete odgovarajuće pravne dozvole za deljenje.
publications-include-checkbox-files =
    .label = Uključi datoteke
publications-include-checkbox-notes =
    .label = Uključi beleške
publications-include-adjust-at-any-time = Možete podesiti šta se ovde prikazuje ako odete u zbirku Moji radovi.
publications-intro-authorship =
    .label = Ja sam autor ovog rada.
publications-intro-authorship-files =
    .label = Ja sam napravio ovaj rad i imam prava da delim priključene datoteke.
publications-sharing-page = Izaberite kako ćete deliti vaš rad sa drugima
publications-sharing-keep-rights-field =
    .label = Zadrži polje sa autorskim pravima
publications-sharing-keep-rights-field-where-available =
    .label = Zadrži postojeće polje sa autorskim pravima, ukoliko je dostupno
publications-sharing-text = Možete zadržati sva prava nad svojim radom, podeliti ga pod slobodnom licencom ili ga podeliti preko javnog domena. U svim slučajevima će rad biti javno dostupan na stranici zotero.org.
publications-sharing-prompt = Da li želite da podelite svoj rad sa ostalima?
publications-sharing-reserved =
    .label = Ne, samo objavi moje podatke na zotero.org.
publications-sharing-cc =
    .label = Da, pod licencom Zajedničko kreativno dobro
publications-sharing-cc0 =
    .label = Da, postavi moj rad u javni domen
publications-license-page = Izaberite licencu Zajedničko kreativno dobro
publications-choose-license-text = Zajedničko kreativno dobro dozvoljava drugima da kopiraju i dalje dele vaš rad dok god je vaša zasluga jasno istaknuta, uz davanje veze do licence i navođenje ako je došlo do nekih promena. Dodatni uslovi mogu biti postavljeni ovde.
publications-choose-license-adaptations-prompt = Da li dozvoljavate deljenje izmena vašeg rada?
publications-choose-license-yes =
    .label = Da
    .accesskey = Y
publications-choose-license-no =
    .label = Ne
    .accesskey = N
publications-choose-license-sharealike =
    .label = Da, dok god ga i drugi dele pod istim uslovima
    .accesskey = S
publications-choose-license-commercial-prompt = Da li dozvoljavate upotrebu vašeg rada u komercijalne svrhe?
publications-buttons-add-to-my-publications =
    .label = Dodaj u Moji radovi
publications-buttons-next-sharing =
    .label = Sledeće: deljenje
publications-buttons-next-choose-license =
    .label = Izaberite licencu
licenses-cc-0 = CC0 1.0, posvećenost univerzalnom javnom domenu
licenses-cc-by = Zajedničko kreativno dobro, autorstvo, 4.0, internacionalna licenca
licenses-cc-by-nd = Zajedničko kreativno dobro, autorstvo-bez izmena, 4.0, internacionalna licenca
licenses-cc-by-sa = Zajedničko kreativno dobro, autorstvo-deljenje pod istim uslovima, 4.0, internacionalna licenca
licenses-cc-by-nc = Zajedničko kreativno dobro, autorstvo-nekomercijalno, 4.0, internacionalna licenca
licenses-cc-by-nc-nd = Zajedničko kreativno dobro, autorstvo-nekomercijalno-bez izmena, 4.0, internacionalna licenca
licenses-cc-by-nc-sa = Zajedničko kreativno dobro, autorstvo-nekomercijalno-deljenje pod istim uslovima, 4.0, internacionalna licenca
licenses-cc-more-info = Pročitajte Zajedničko kreativno dobro, <a data-l10n-name="license-considerations">Razmatranja za izdavaoce licenci</a> pre nego što postavite rad pod CC licencom. Ukoliko primenite ovu licencu, ne možete opozvati, čak ni ukoliko kasnije izaberete drugačije uslove ili povučete objavljeni rad.
licenses-cc0-more-info = Pročitajte Zajedničko kreativno dobro, <a data-l10n-name="license-considerations">CC0 pitanja i odgovori</a> pre nego što primenite CC0 na vaš rad. Ne možete opozvati odluku da postavite svoj rad u na javni domen, čak ni ukoliko kasnije izaberete drugačije uslove ili povučete objavljeni rad.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Pokreni u režimu za traženje problema…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } će se ponovo pokrenuti sa isključenim dodacima. Neke mogućnosti možda neće raditi kako treba dok je režim za traženje problema uključen.
menu-ui-density =
    .label = Gustina
menu-ui-density-comfortable =
    .label = Udobno
menu-ui-density-compact =
    .label = Zbijeno
pane-item-details = Detalji stavke
pane-info = Podaci
pane-abstract = Sažetak
pane-attachments = Prilozi
pane-notes = Beleške
pane-note-info = Informacije o belešci
pane-libraries-collections = Biblioteke i zbirke
pane-tags = Oznake
pane-related = Srodno
pane-attachment-info = Podaci o prilogu
pane-attachment-preview = Pregled
pane-attachment-annotations = Napomene
pane-header-attachment-associated =
    .label = Preimenujte povezanu datoteku
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } prilog
            [few] { $count } priloga
           *[other] { $count } priloga
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } beleška
            [few] { $count } beleške
           *[other] { $count } beleški
        }
section-attachments-move-to-trash-message = Da li ste sigurni da želite da premestite „{ $title }” u smeće?
section-notes =
    .label =
        { $count ->
            [one] { $count } beleška
            [few] { $count } beleške
           *[other] { $count } beleški
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } oznaka
            [few] { $count } oznake
           *[other] { $count } oznaka
        }
section-related =
    .label = { $count } poveznice
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Proširi odeljak
    .label = Proširi odeljak { $section }
section-button-collapse =
    .dynamic-tooltiptext = Skupi odeljak
    .label = Skupi odeljak { $section }
annotations-count =
    { $count ->
        [one] { $count } beleška
        [few] { $count } beleške
       *[other] { $count } beleški
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
    .label = Pomeri odeljak nagore
sidenav-reorder-down =
    .label = Pomeri odeljak nadole
sidenav-reorder-reset =
    .label = Resetuj redosled odeljaka
toggle-item-pane =
    .tooltiptext = Prikaži/sakrij okno stavke
toggle-context-pane =
    .tooltiptext = Prikaz kontekstne površi
pin-section =
    .label = Zakači odeljak
unpin-section =
    .label = Otkači odeljak
collapse-other-sections =
    .label = Skupi druge odeljke
expand-all-sections =
    .label = Proširi sve odeljke
abstract-field =
    .placeholder = Dodaj apstrakt…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtriraj oznake
context-notes-search =
    .placeholder = Pretraži beleške
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Nova zbirka…
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Nova zbirka
    .buttonlabelaccept = Napravi odeljak
new-collection-name = Ime:
new-collection-create-in = Napravi u:
show-publications-menuitem =
    .label = Prikaži Moje publikacije
attachment-info-title = Naslov
attachment-info-filename = Ime datoteke
attachment-info-accessed = Pristupljeno
attachment-info-pages = Stranice
attachment-info-modified = Izmenjeno
attachment-info-index = Indeksirano
attachment-info-convert-note =
    .label =
        Premesti u { $type ->
            [standalone] samostalnu belešku
            [child] stavku beleške
           *[unknown] novu belešku
        }
    .tooltiptext = Više nije podržano dodavanje beleški i priloga, ali možete izmeniti ovu belešku tako što ćete je premestiti u zasebnu belešku.
section-note-info =
    .label = { pane-note-info }
note-info-title = Naslov
note-info-parent-item = Nadređena stavka
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] Nema
    }
    .title =
        { $hasParentItem ->
            [true] Prikaži nadređenu stavku u biblioteci
           *[false] Prikaži stavku beleške u biblioteci
        }
note-info-date-created = Napravljeno
note-info-date-modified = Izmenjeno
note-info-size = Veličina
note-info-word-count = Broj reči
note-info-character-count = Broj znakova
item-title-empty-note = Bezimena beleška
attachment-preview-placeholder = Nema priloga za pregled
attachment-rename-from-parent =
    .tooltiptext = Preimenuj datoteku da se podudara sa nadređenom stavkom
account-log-in = Prijavi se
account-not-logged-in-text = Prijavite se na svoj Zotero nalog da biste sinhronizovali podatke.
account-error-login-session-expired = Vaša sesija za prijavu je istekla. Pokušajte ponovo.
toggle-preview =
    .label =
        { $type ->
            [open] Sakrij
            [collapsed] Prikaži
           *[unknown] Uključi/isključi
        } pregled priloga
annotation-image-not-available = [Slika nije dostupna]
quicksearch-mode =
    .aria-label = Režim brze pretrage
quicksearch-input =
    .aria-label = Brza pretraga
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
advanced-search = Napredna pretraga
menuitem-advanced-search =
    .label = { advanced-search }
quicksearch-advanced-search-button =
    .tooltiptext = { advanced-search }
    .aria-label = { advanced-search }
advanced-search-close =
    .tooltiptext = Zatvori naprednu pretragu
advanced-search-expand =
    .tooltiptext = Proširi naprednu pretragu
advanced-search-collapse =
    .tooltiptext = Skupi naprednu pretragu
item-pane-header-view-as =
    .label = Pregledaj kao
item-pane-header-none =
    .label = Ništa
item-pane-header-title =
    .label = Naslov
item-pane-header-titleCreatorYear =
    .label = Naslov, autor, godina
item-pane-header-bibEntry =
    .label = Bibliografski unos
item-pane-header-more-options =
    .label = Više opcija
item-pane-message-items-selected =
    { $count ->
        [0] Nije izabrana stavke
        [one] Izabrana je { $count } stavka
       *[other] Izabrano je { $count } stavki
    }
item-pane-message-collections-selected =
    { $count ->
        [one] Izabrana je { $count } zbirka
        [few] Izabrane su { $count } zbirke
       *[other] Izabrano je { $count } zbirki
    }
item-pane-message-searches-selected =
    { $count ->
        [one] Izabrana je { $count } pretraga
        [few] Izabrane su { $count } pretrage
       *[other] Izabrano je { $count } pretraga
    }
item-pane-message-objects-selected =
    { $count ->
        [one] Izabran je { $count } objekat
        [few] Izabrana su { $count } objekta
       *[other] Izabrano je { $count } objekata
    }
item-pane-message-unselected =
    { $count ->
        [0] Nema stavki u ovom pregledu
        [one] { $count } stavka u ovom pregledu
       *[other] { $count } stavke u ovom pregledu
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] Nema objekata u ovom pregledu
        [one] { $count } objekat u ovom pregledu
       *[other] { $count } objekta u ovom pregledu
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Spoji { $count } stavku
            [few] Spoji { $count } stavke
           *[other] Spoji { $count } stavki
        }
locate-library-lookup-no-resolver = Morate da izaberete razrešitelja iz površi { $pane } u podešavanjima programa { -app-name }.
architecture-win32-warning-message = Prebacite se na 64-tvoro bitni { -app-name } za brži rad programa. Vaši podaci neće biti promenjeni.
architecture-warning-action = Preuzmi 64-tvoro bitni { -app-name }
architecture-x64-on-arm64-message = { -app-name } je pokrenut u kroz emulaciju. Dostupna verzija programa { -app-name } za vaš procesor je mnogo efikasnija.
architecture-x64-on-arm64-action = Preuzmi { -app-name } za ARM64
first-run-guidance-authorMenu = { -app-name } vam dozvoljava da unesete urednika i prevodioca. Možete da postavite autora za urednika ili prevodioca iz ovog menija.
first-run-guidance-readAloud = { -app-name } sada može da vam čita vaše dokumente koristeći glasove koji zvuče prirodno.
advanced-search-remove-btn =
    .tooltiptext = Ukloni uslov
advanced-search-add-btn =
    .tooltiptext = Dodaj uslov
advanced-search-group-btn =
    .tooltiptext = Dodaj grupu uslova
advanced-search-remove-group-btn =
    .tooltiptext = Ukloni grupu
advanced-search-ungroup-btn =
    .tooltiptext = Razgrupiši uslove
advanced-search-result-level-menu =
    .aria-label = Tip rezultata
advanced-search-result-level-prefix-root =
    .value = Nađi
advanced-search-join-prefix-root =
    .value = koji se podudaraju
advanced-search-result-level-any =
    .label = bilo koje stavke
advanced-search-result-level-item =
    .label = stavke najvišeg nivoa
advanced-search-result-level-attachment =
    .label = priloge
advanced-search-result-level-note =
    .label = beleške
advanced-search-result-level-annotation =
    .label = napomene
advanced-search-binding-menu =
    .aria-label = Poklapanje sa istom stavkom
advanced-search-binding-separate =
    .label = odvojeno
advanced-search-binding-same-attachment =
    .label = u istom prilogu
advanced-search-binding-same-note =
    .label = u istoj belešci
advanced-search-binding-same-annotation =
    .label = u istoj napomeni
advanced-search-of-the-following =
    .value = od sledećeg
advanced-search-binding-hint-attachment =
    .value = Ovi uslovi se mogu poklapati sa odvojenim prilozima.
advanced-search-binding-hint-note =
    .value = Ovi uslovi se mogu poklapati sa odvojenim beleškama.
advanced-search-binding-hint-annotation =
    .value = Ovi uslovi se mogu poklapati sa odvojenim napomenama.
advanced-search-level-warning-mixed = Ovi uslovi se ne mogu svi poklapati sa istom stavkom, tako da ova pretraga nikada neće vratiti rezultate. Pokušajte da poklopite „{ $matchAny }” od njih, ili postavite tip rezultata na „{ $topLevelItems }”.
advanced-search-level-warning-unreachable = Ova pretraga ima uslov koji se ne može primeniti na izabrani tip rezultata. Postavite tip rezultata na „{ $topLevelItems }” ili uklonite nekompatibilni uslov.
advanced-search-group-warning-unreachable =
    Ovaj uslov ne može da se primeni zajedno sa ostalim uslovima na { $entity ->
        [attachment] prilog
        [note] belešku
       *[annotation] napomenu
    }. Proverite ih odvojeno ili uklonite neodgovarajući uslov.
advanced-search-group-warning-mixed = Ovi uslovi se ne mogu svi poklapati sa istom stavkom, tako da se ova grupa nikada neće poklapati. Pokušajte da poklopite „{ $matchAny }” od njih, ili postavite tip rezultata na „{ $topLevelItems }”.
advanced-search-bind-same-attachment =
    .label = Poklapanje sa istim prilogom
advanced-search-bind-same-note =
    .label = Poklapanje sa istom beleškom
advanced-search-bind-same-annotation =
    .label = Poklapanje sa istom napomenom
advanced-search-conditions-menu =
    .aria-label = Uslov za pretragu
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operacija
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Vrednost
    .label = { $label }
search-operator-isEmpty = je prazno
search-operator-isNotEmpty = nije prazno
search-conditions-tooltip-fields = Polja:
search-conditions-collection = Kolekcija
search-conditions-savedSearch = Sačuvana pretraga
search-conditions-itemTypeID = Vrsta stavke
search-query-keyword-creator = by
search-query-keyword-publication = in, publication, journal
search-query-keyword-item-type = type
search-query-keyword-language = lang
search-query-keyword-abstract = abstract
search-query-keyword-fulltext = fulltext, text
search-query-keyword-date = year
search-query-keyword-date-before = before
search-query-keyword-date-after = after, since
search-query-keyword-date-added = added
search-query-keyword-date-modified = modified
search-query-keyword-no-annotations = no annotations
search-query-keyword-has-annotations = has annotations
search-query-keyword-no-notes = no notes
search-query-keyword-has-notes = has notes
search-query-keyword-no-tags = no tags
search-query-keyword-has-tags = has tags
search-query-keyword-no-attachments = no attachments
search-query-keyword-has-attachments = has attachments
search-query-keyword-and = and
search-query-keyword-or = or
search-query-keyword-no = no
search-query-keyword-has = has
search-query-keyword-days = day, days
search-query-keyword-weeks = week, weeks
search-query-keyword-months = month, months
search-query-keyword-years = year, years
search-query-keyword-range = between 2020 and 2025, from 2020 to 2025, 2020 to 2025
search-query-keyword-range-excluded = not between 2020 and 2025
search-conditions-tag = Oznaka
search-conditions-numTags = Broj oznaka
search-conditions-numNotes = Broj beleški
search-conditions-numAttachments = Broj priloga
search-conditions-numAnnotations = Broj napomena
search-conditions-note = Beleška
search-conditions-childNote = Podbeleška
search-conditions-creator = Autor
search-conditions-thesisType = Vrsta teze
search-conditions-reportType = Vrsta izveštaja
search-conditions-videoRecordingFormat = Format za snimanje videa
search-conditions-audioFileType = Vrsta zvučne datoteke
search-conditions-audioRecordingFormat = Format za snimanje zvuka
search-conditions-letterType = Vrsta pisma
search-conditions-interviewMedium = Medijum razgovora
search-conditions-manuscriptType = Vrsta rukopisa
search-conditions-presentationType = Vrsta prezentacije
search-conditions-mapType = Vrsta mape
search-conditions-artworkMedium = Medijum umetničkog dela
search-conditions-dateModified = Datum promene
search-conditions-fulltextContent = Sadržaj priloga
search-conditions-programmingLanguage = Programski jezik
search-conditions-fileTypeID = Vrsta priložene datoteke
search-conditions-attachmentStorageType = Vrsta skladištenja priloga
search-conditions-lastRead = Prilog poslednji put pročitan
search-conditions-annotationText = Tekst napomene
search-conditions-annotationComment = Komentar napomene
search-conditions-annotationType = Vrsta napomene
search-conditions-annotationColor = Boja napomene
search-conditions-annotationAuthor = Autor napomene
search-conditions-anyField = Sva polja
search-conditions-titleCreatorYear = Naslov, autor, godina
search-conditions-submenu-attachment = Prilog
search-conditions-submenu-annotation = Napomena
search-conditions-short-fulltextContent = Sadržaj
search-conditions-short-fileTypeID = Vrsta datoteke
search-conditions-short-attachmentStorageType = Tip skladištenja
search-conditions-short-lastRead = Poslednji put čitano
search-conditions-short-annotationText = Tekst
search-conditions-short-annotationComment = Komentar
search-conditions-short-annotationType = Vrsta
search-conditions-short-annotationColor = Boja
search-conditions-short-annotationAuthor = Autor
find-pdf-files-added =
    { $count ->
        [one] { $count } polje je dodato
        [few] { $count } polja su dodata
       *[other] { $count } polja je dodato
    }
select-items-window =
    .title = Izaberi stavke
select-items-dialog =
    .buttonlabelaccept = Izaberi
select-items-convertToStandalone =
    .label = Pretvori u samostalnu stavku
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Pretvori u samostalne priloge
            [few] Pretvori u samostalne priloge
           *[other] Pretvori u samostalni prilog
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Pretvori u samostalnu belešku
            [few] Pretvori u samostalne beleške
           *[other] Pretvori u samostalne beleške
        }
file-type-webpage = Veb stranica
file-type-image = Slika
file-type-pdf = PDF
file-type-audio = Zvuk
file-type-video = Video
file-type-presentation = Prezentacija
file-type-document = Dokument
file-type-ebook = E-knjiga
attachment-storage-type-storedFile = Sačuvana datoteka
attachment-storage-type-linkedFile = Povezana datoteka
attachment-storage-type-webLink = Veza na vebu
post-upgrade-message = Nadograđeni ste na <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Saznajte <a data-l10n-name="new-features-link">šta je novo</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Ubaci i pretraži
mac-word-plugin-install-message = Zotero treba da pristupi podacima programa Word kako bi instalirao priključak za Word.
mac-word-plugin-install-folder-message = { -app-name } zahteva pristup Word-ovoj fascikli za pokretanje kako bi instalirao Word dodatak.
mac-word-plugin-install-action-button =
    .label = Instaliraj Word priključak
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Instaliraj dodatak u Wordovu početnu fasciklu
mac-word-plugin-install-folder-dialog-button = Instaliraj
mac-word-plugin-install-wrong-folder-selected = Predložena fascikla mora biti izabrana. Pokušajte ponovo bez biranja druge fascikle.
file-renaming-banner-message = { -app-name } sada automatski održava imena datoteka priloga sinhronizovanim dok menjate stavke.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = { -app-name } Connector mora biti ažuriran da bi radio sa ovom verzijom programa { -app-name }.
userjs-pref-warning = Neka { -app-name } podešavanja su prepisana korišćenjem nepodržanog metoda. { -app-name } će ih vratiti na staro i ponovo se pokrenuti.
migrate-extra-fields-progress-headline = Ažuriranje stavki…
migrate-extra-fields-progress-message = Premeštanje novih polja iz polja „Dodatni podaci”
fulltext-indexing-progress-title = Indeksiranje
fulltext-indexing-progress-message = Rezultati pretrage celog teksta mogu biti nepotpuni dok se indeksiranje ne završi.
long-tag-fixer-window-title =
    .title = Podeli oznake
long-tag-fixer-button-dont-split =
    .label = Ne deli
menu-normalize-attachment-titles =
    .label = Normalizuj naslove priloga…
normalize-attachment-titles-title = Normalizuj naslove priloga
normalize-attachment-titles-text =
    { -app-name } automatski preimenuje datoteke na disku koristeći metapodatke nadređene stavke, ali koristi zasebne, jednostavnije naslove kao što su „Full Text PDF”, „Preprint PDF” ili „PDF” za primarne priloge kako bi lista stavki bila preglednija i kako bi se izbeglo dupliranje informacija.
    
    U starijim verzijama programa { -app-name }, kao i pri korišćenju određenih dodataka, naslovi priloga su mogli biti nepotrebno promenjeni da bi se podudarali sa imenima datoteka.
    
    Da li želite da ažurirate izabrane priloge da koriste jednostavnije naslove? Biće promenjeni samo primarni prilozi sa naslovima koji se podudaraju sa imenom datoteke.
banner-close-button =
    .aria-label = Odbaci obaveštenje
plugins-blocked-plugin =
    .message = Ovaj dodatak je onemogućen od strane programa { -app-name }.
data-dir-unsupported-storage = Ovo se može desiti ako se direktorijum sa podacima programa { -app-name } nalazi u fascikli za skladištenje u oblaku (OneDrive, Dropbox, itd.) ili na mrežnom deljenom disku.
data-dir-check-parent-write-access = Make sure you have write access to { $path } and that security software isn’t preventing { -app-name } from writing to the disk.
login-manager-reset = { -app-name } nije mogao da pročita vaše sačuvane podatke za prijavljivanje, pa su oni resetovani. Molimo vas da se ponovo prijavite u oknu { preferences-pane-account } u podešavanjima programa { -app-name }.
login-manager-open-profile-directory = Open Profile Directory
os-keystore-save-failed =
    { PLATFORM() ->
        [macos] { -app-name } nije mogao da pristupi { -os-name } Keychain-u kako bi bezbedno sačuvao vaše akreditive. Proverite da li je vaš Keychain dostupan i pokušajte ponovo.
        [windows] { -app-name } nije mogao bezbedno da sačuva vaše akreditive. Pokušajte ponovo ili ponovo pokrenite { -app-name }.
       *[other] { -app-name } nije mogao da pristupi vašem { -os-name } keyring-u kako bi bezbedno sačuvao vaše akreditive. Proverite da li je keyring servis pokrenut i pokušajte ponovo.
    }
os-keystore-read-failed =
    { PLATFORM() ->
        [macos] { -app-name } nije mogao da pristupi aplikaciji Keychain na sistemu { -os-name } da bi pročitao sačuvane podatke za prijavu. Proverite da li je Keychain dostupan i pokušajte ponovo.
        [windows] { -app-name } nije mogao da koristi Menadžer akreditiva na sistemu { -os-name } da bi pročitao sačuvane podatke za prijavu. Pokušajte ponovo ili ponovo pokrenite { -app-name }.
       *[other] { -app-name } nije mogao da pristupi skladištu ključeva na sistemu { -os-name } da bi pročitao sačuvane podatke za prijavu. Proverite da li je pokrenuta usluga kao što je GNOME Keyring ili KWallet, pa pokušajte ponovo.
    }
os-keystore-read-unrecoverable =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t read your saved credentials from the { -os-name } Keychain.
        [windows] { -app-name } couldn’t read your saved credentials from { -os-name } Credential Manager.
       *[other] { -app-name } couldn’t read your saved credentials from your { -os-name } keyring.
    } You’ll need to set up syncing again in the { -app-name } settings.
os-keystore-save-unencrypted = { -app-name } može umesto toga da sačuva podatke za prijavu bez šifrovanja. Svako ko ima pristup fascikli profila programa { -app-name } tada bi mogao da ih pročita.
os-keystore-save-unencrypted-button = Ipak sačuvaj
os-keystore-migrate-failed =
    { PLATFORM() ->
        [macos] { -app-name } nije mogao da pristupi { -os-name } Keychain-u kako bi šifrovao vaše sačuvane akreditive. Vaši akreditivi ostaju sačuvani nešifrovani na disku. Proverite da li je vaš Keychain dostupan i ponovo pokrenite { -app-name }.
        [windows] { -app-name } nije mogao da šifruje vaše sačuvane akreditive. Vaši akreditivi ostaju sačuvani nešifrovani na disku. Ponovo pokrenite { -app-name } i pokušajte ponovo.
       *[other] { -app-name } nije mogao da pristupi vašem { -os-name } keyring-u kako bi šifrovao vaše sačuvane akreditive. Vaši akreditivi ostaju sačuvani nešifrovani na disku. Proverite da li je keyring servis pokrenut i ponovo pokrenite { -app-name }.
    }
search-button =
    .label = Pretraga
save-search-new-button =
    .label = Sačuvaj pretragu…
save-search-edit-button =
    .label = Sačuvaj
save-search-name-title = Sačuvaj pretragu
save-search-name-message = Unesite ime za sačuvanu pretragu:
saved-search-close-confirmation-title = Uređivanje sačuvane pretrage
saved-search-close-confirmation-body = Da li želite da sačuvate izmene koje ste napravili u ovoj sačuvanoj pretrazi?
item-pane-batch-editing-prompt =
    .aria-label = Grupno uređivanje
item-pane-batch-editing-enable =
    .label = Uredi više stavki…
item-pane-batch-editing-multiple-values-placeholder = Više
item-pane-batch-editing-clear-values = Obriši sve vrednosti
item-pane-batch-editing-header =
    { $count ->
        [one] Uređivanje { $count } stavke
        [few] Uređivanje { $count } stavke
       *[other] Uređivanje { $count } stavki
    }
item-pane-batch-editing-done =
    .label = { general-done }
undo-action-edit-metadata =
    { $count ->
        [one] Uredi metapodatke
        [few] Uredi metapodatke za { $count } stavke
       *[other] Uredi metapodatke za { $count } stavki
    }
undo-action-edit-field =
    { $count ->
        [one] Uređivanje polja „{ $field }”
        [few] Uređivanje polja „{ $field }” za { $count } stavke
       *[other] Uređivanje polja „{ $field }” za { $count } stavki
    }
undo-action-normalize-attachment-titles = Normalizuj naslov priloga
undo-action-trash =
    { $count ->
        [one] Premesti stavku u smeće
        [few] Premesti { $count } stavke u smeće
       *[other] Premesti { $count } stavki u smeće
    }
undo-action-restore-items =
    { $count ->
        [one] Vrati stavku
        [few] Vrati { $count } stavke
       *[other] Vrati { $count } stavki
    }
undo-action-trash-collection =
    { $count ->
        [one] Premesti zbirku u smeće
        [few] Premesti { $count } zbirke u smeće
       *[other] Premesti { $count } zbirki u smeće
    }
undo-action-trash-search =
    { $count ->
        [one] Premesti sačuvanu pretragu u smeće
        [few] Premesti { $count } sačuvane pretrage u smeće
       *[other] Premesti { $count } sačuvanih pretraga u smeće
    }
undo-action-restore-collection =
    { $count ->
        [one] Vrati zbirku
        [few] Vrati { $count } zbirke
       *[other] Vrati { $count } zbirki
    }
undo-action-restore-objects =
    { $count ->
        [one] Vrati objekat
        [few] Vrati { $count } objekta
       *[other] Vrati { $count } objekata
    }
undo-action-add-to-collection =
    { $count ->
        [one] Dodaj u zbirku
        [few] Dodaj { $count } stavke u zbirku
       *[other] Dodaj { $count } stavki u zbirku
    }
undo-action-remove-from-collection =
    { $count ->
        [one] Ukloni iz zbirke
        [few] Ukloni { $count } stavke iz zbirke
       *[other] Ukloni { $count } stavki iz zbirke
    }
undo-action-move-to-collection =
    { $count ->
        [one] Premesti u zbirku
        [few] Premesti { $count } stavke u zbirku
       *[other] Premesti { $count } stavki u zbirku
    }
undo-action-rename-collection = Preimenuj zbirku
undo-action-move-collection = Premesti zbirku
undo-action-add-tag =
    { $count ->
        [one] Dodaj oznaku
        [few] Dodaj oznaku na { $count } stavke
       *[other] Dodaj oznaku na { $count } stavki
    }
undo-action-change-tag = Promeni oznaku
undo-action-split-tag = Razdvoji oznaku
undo-action-remove-tag =
    { $count ->
        [one] Ukloni oznaku
        [few] Ukloni oznaku sa { $count } stavke
       *[other] Ukloni oznaku sa { $count } stavki
    }
undo-action-remove-tags-from-item =
    { $count ->
        [one] Ukloni oznaku
        [few] Ukloni { $count } oznake
       *[other] Ukloni { $count } oznaka
    }
undo-action-remove-all-tags = Ukloni sve oznake
undo-action-edit-note = Uredi belešku
undo-action-add-creator = Dodaj autora
undo-action-remove-creator = Ukloni autora
undo-action-edit-creator = Uredi autora
undo-action-reorder-creator = Promeni redosled autora
undo-action-change-type = Promeni vrstu stavke
undo-action-change-parent-item =
    { $count ->
        [one] Promeni nadređenu stavku
        [few] Promeni nadređenu stavku za { $count } stavke
       *[other] Promeni nadređenu stavku za { $count } stavki
    }
undo-action-convert-to-standalone =
    { $count ->
        [one] Pretvori u samostalnu stavku
        [few] Pretvori { $count } stavke u samostalne stavke
       *[other] Pretvori { $count } stavki u samostalne stavke
    }
undo-action-add-related = Dodaj srodno
undo-action-remove-related = Ukloni srodno
undo-action-merge-items =
    { $count ->
        [one] Spoji stavku
        [few] Spoji { $count } stavke
       *[other] Spoji { $count } stavki
    }
menu-edit-undo-action = Opozovi { $action }
menu-edit-redo-action = Ponovi { $action }
local-api-authorize-title = Lokalna API autorizacija
local-api-authorize-text = „{ $appName }”, aplikacija koja je pokrenuta na vašem računaru, želi da izmeni vašu { -app-name } biblioteku.
