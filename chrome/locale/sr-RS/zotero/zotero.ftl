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
general-print = Штампај
general-remove = Уклони
general-add = Додај
general-remind-me-later = Подсети ме касније
general-dont-ask-again = Не питај ме поново
general-choose-file = Изабери датотеку…
general-open-settings = Отвори подешавања
general-settings = Podešavanja…
general-help = Помоћ
general-tag = Ознака
general-got-it = Razumem
general-done = Готово
general-view-troubleshooting-instructions = Погледај упутства за решавање проблема
general-go-back = Idi nazad
general-accept = Prihvati
general-cancel = Откажи
cancel-button =
    .label = { general-cancel }
general-show-in-library = Прикажи у библиотеци
general-restartApp = Ponovo pokreni { -app-name }
general-restartInTroubleshootingMode = Покрени у режиму за тражење проблема
general-save = Сачувај
general-clear = Очисти
clear-button =
    .label = { general-clear }
general-update = Ажурирање
general-reset-to-default = Vrati na podrazumevano
general-back = Назад
general-edit = Уређивање
general-cut = Исеци
general-copy = Копирај
general-paste = Убаци
general-find = Нађи
general-delete = Обриши
general-insert = Уметни
general-and = и
general-et-al = и сар.
general-previous = Претходно
general-next = Следеће
general-learn-more = Сазнајте више
general-more-information = Више података
general-warning = Упозорење
general-type-to-continue = Ukucajte „{ $text }” da biste nastavili.
general-continue = Настави
general-allow = Dozvoli
general-always-allow = Uvek dozvoli
general-deny = Odbij
general-red = Црвено
general-orange = Наранџасто
general-yellow = Жуто
general-green = Зелено
general-teal = Светло плаво
general-blue = Плаво
general-purple = Пурпурно
general-magenta = Магентно
general-violet = Љубичасто
general-maroon = Смеђе
general-gray = Сиво
general-black = Црно
general-loading = Учитавам…
db-checking-integrity = Provera integriteta baze podataka…
db-repairing = Popravka baze podataka…
citation-style-label = Стил цитата:
language-label = Језик:
menu-custom-group-submenu =
    .label = Više opcija…
menu-file-show-in-finder =
    .label = Прикажи у претрази
menu-file-show-file =
    .label = Прикажи датотеку
menu-file-show-files =
    .label = Прикажи датотеке
menu-print =
    .label = { general-print }
menu-density =
    .label = Густина
add-attachment = Додај прилог
new-note = Нова белешка
menu-add-by-identifier =
    .label = Додај на основу идентификатора…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Додај датотеку…
menu-add-standalone-linked-file-attachment =
    .label = Додај везу до датотеке…
menu-add-child-file-attachment =
    .label = Додај датотеку…
menu-add-child-linked-file-attachment =
    .label = Приложи везу до датотеке…
menu-add-child-linked-url-attachment =
    .label = Приложи везу на вебу…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Нова самостална белешка
menu-new-item-note =
    .label = Белешка о новој ставки
menu-restoreToLibrary =
    .label = Врати у библиотеку
menu-deletePermanently =
    .label = Трајно избриши…
menu-tools-plugins =
    .label = Прикључци
menu-view-columns-move-left =
    .label = Pomeri kolonu levo
menu-view-columns-move-right =
    .label = Pomeri kolonu desno
menu-view-hide-context-annotation-rows =
    .label = Sakrij napomene koje ne odgovaraju filteru
menu-view-note-font-size =
    .label = Величина фонта за белешке
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
    .label = Библиотека
main-window-key =
    .key = L
zotero-toolbar-tabs-menu =
    .tooltiptext = Излистај све картице
filter-collections = Филтер збирки
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Претражи картице
zotero-tabs-menu-close-button =
    .title = Затвори картицу
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
        [one] Изабрана је { $count } збирка
        [few] Изабране су { $count } збирке
       *[other] Изабрано је { $count } збирки
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
edit-saved-search = Уреди сачувану претрагу
collections-menu-edit-search =
    .label = Uredi pretragu
collections-menu-duplicate-search =
    .label = Napravi duplikat pretrage
collections-menu-move-collection =
    .label = Премести у
collections-menu-copy-collection =
    .label = Копирај у
collections-menu-export =
    .label = Извоз…
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
    .label = Премести доле
item-creator-moveToTop =
    .label = Премести на врх
item-creator-moveUp =
    .label = Премести горе
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
    .label = Датотека
item-menu-add-linked-file =
    .label = Повезана датотека
item-menu-add-url =
    .label = Веза на вебу
item-menu-change-parent-item =
    .label = Промени родитељску ставку…
item-menu-relate-items =
    .label = Poveži stavke
view-online = Погледај на мрежи
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Датотека је преименована у { $filename }
file-access-error-fs-corrupted = { -os-name } reported that the file or disk is corrupted. Run a disk check on the drive containing the file.
itembox-button-options =
    .tooltiptext = Отвори контекстни мени
itembox-button-merge =
    .aria-label = Изабери верзију поља { $field }
create-parent-intro = Унесите ДОИ, ИСБН, ПМИБ, арХиб ИБ или АДС Бибкод за идентификацију ове датотеке:
reader-use-dark-mode-for-content =
    .label = Тамни режим за садржај
update-updates-found-intro-minor = Доступно је ажурирање за { -app-name }:
update-updates-found-desc = Препоручујемо да примените ово ажурирање што пре.
import-window =
    .title = Увези
import-where-from = Одакле желите да увезете?
import-online-intro-title = Увод
import-source-file =
    .label = Из датотеке (БибТеКс, РИС, Зотеров РДФ…)
import-source-folder =
    .label = Фасцикла са ПДФ или другим датотекама
import-source-online =
    .label = { $targetApp } увоз са мреже
import-options = Опције
import-importing = Увозим…
import-create-collection =
    .label = Постави увезене збирке и ставке у нову збирку
import-recreate-structure =
    .label = Поново направи структуру у виду збирки
import-fileTypes-header = Врсте датотека за увоз:
import-fileTypes-pdf =
    .label = ПДФ-ови
import-fileTypes-other =
    .placeholder = Отвори датотеке на основу шаблона раздвојеног зарезима (нпр. *.jpg,*.png)
import-file-handling = Рад са датотекама
import-file-handling-store =
    .label = Копирај датотеке у { -app-name } фасциклу са складиштем
import-file-handling-link =
    .label = Повежи са датотекама на оригиналној локацији
import-fileHandling-description = Не могу да ускладим повезане датотеке у програму { -app-name }.
import-online-new =
    .label = Преузми само нове ставке; не ажурирај претходно увезене ставке
import-mendeley-username = Корисничко име
import-mendeley-password = Лозинка
general-error = Грешка
file-interface-import-error = Грешка при увозу изабране датотеке. Проверите да ли је датотека исправна и покушајте поново.
file-interface-import-complete = Увоз је завршен
file-interface-items-were-imported =
    { $numItems ->
        [0] Нису увезене ставке
        [one] Ставка је увезена
       *[other] Увезених ставки: { $numItems }
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Ставке нису поново повезане
        [one] Ставка је поново повезана
       *[other] Поново повезаних ставки: { $numRelinked }
    }
import-mendeley-cannot-decrypt = The selected Mendeley database could not be decrypted. This can happen if the database file has been renamed. See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
import-mendeley-unsupported = The selected file does not appear to be a Mendeley database. See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
import-mendeley-db-in-use = The selected Mendeley database is in use. Please quit Mendeley Desktop and try again.
file-interface-import-error-translator = Грешка приликом увоза изабране датотеке преко „{ $translator }“. Проверите да ли је датотека исправна и покушајте поново.
import-online-intro = У следећем кораку ћемо вас позвати да се пријавите на { $targetAppOnline } и дате дозволе за приступ програму { -app-name }. Ово је нопходно да увезете вашу { $targetApp } библиотеку у { -app-name }.
import-online-intro2 = { -app-name } никада неће видети или чувати вашу { $targetApp } лозинку.
import-online-form-intro = Унесите ваше податке за пријаву на { $targetAppOnline }. Ово је неопходно да увезете { $targetApp } библиотеку у { -app-name }.
import-online-wrong-credentials = Није успела пријава на { $targetApp }. Унесите податке за пријаву и покушајте поново.
import-online-blocked-by-plugin = Не можете да наставите увоз док је покренут прикључак { $plugin }. Искључите овај прикључак и покушајте поново.
import-online-relink-only =
    .label = Поново повежи цитате из Мендељејева
import-online-relink-kb = { general-more-information }
import-online-connection-error = { -app-name } не може да се повеже на { $targetApp }. Проверите везу са интернетом и покушајте поново.
tab-title-multiple-collections = Više
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } белешка
            [few] { $count } белешке
           *[other] { $count } белешки
        }
items-column-added-by = Dodao/la
items-column-modified-by = Izmenio/la
items-column-last-read = Poslednji put čitano
report-error =
    .label = Грешка у извештају…
rtfScan-wizard =
    .title = РТФ скенер
rtfScan-introPage-description = { -app-name } може аутоматски да извуче, поново форматира цитате и убаци библиографију у РТФ датотеке. Тренутно подржава цитате у варијантама следећих формата:
rtfScan-introPage-description2 = За початак отворите РТФ датотеку и изаберите излазну датотеку:
rtfScan-input-file = Улазна датотека:
rtfScan-output-file = Излазна датотека:
rtfScan-no-file-selected = Није изабрана датотека
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Изаберите улазну датотеку
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Изаберите излазну датотеку
rtfScan-intro-page = Увод
rtfScan-scan-page = Тражим цитате
rtfScan-scanPage-description = { -app-name } претражује ваш документ у потрази за цитатима. Будите стрпљиви.
rtfScan-citations-page = Верификуј цитиране ставке
rtfScan-citations-page-description = Прегледајте списак препознатих цитата како би проверили да ли је { -app-name } правилно изабрао одговарајуће ставке. Уколико постоје цитати који нису повезани или су чудни, морате их средити пре него што наставите даље.
rtfScan-style-page = Форматирам документ
rtfScan-format-page = Форматирам цитате
rtfScan-format-page-description = { -app-name } обрађује и форматира вашу РТФ датотеку. Будите стрпљиви.
rtfScan-complete-page = РТФ скенирање је завршено
rtfScan-complete-page-description = Ваш документ је скениран и обрађен. Проверите да ли је исправно форматиран.
rtfScan-action-find-match =
    .title = Изабери ставке које се подударају
rtfScan-action-accept-match =
    .title = Прихвати ово подударање
runJS-title = Покрени ЈаваСкрипт
runJS-editor-label = Код:
runJS-run = Покрени
runJS-help = { general-help }
runJS-completed = uspešno završeno
runJS-result =
    { $type ->
        [async] Враћена вредност:
       *[other] Резултат:
    }
runJS-run-async = Покрени као асинхрону функцију
bibliography-window =
    .title = { -app-name } - прављење цитата/библиографије
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Прикажи цитате као:
bibliography-advancedOptions-label = Напредне опције
bibliography-outputMode-label = Извези као:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Цитате
            [note] Белешке
           *[other] Цитате
        }
bibliography-outputMode-bibliography =
    .label = Библиографију
bibliography-outputMethod-label = Начин извоза:
bibliography-outputMethod-saveAsRTF =
    .label = Сними као РТФ
bibliography-outputMethod-saveAsHTML =
    .label = Сними као ХТМЛ
bibliography-outputMethod-copyToClipboard =
    .label = Копирај у оставу
bibliography-outputMethod-print =
    .label = Штампај
bibliography-manageStyles-label = Уреди стилове…
styleEditor-locatorType =
    .aria-label = Врста локатора
styleEditor-locatorInput = Унос локатора
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Уређивач стилова
styleEditor-preview =
    .aria-label = Преглед
stylePreview-generating = Generisanje pregleda…
publications-intro-page = Моји радови
publications-intro = Ставке које сте додали у Моји радови ће бити приказане на вашој страници у оквиру сајта zotero.org. Уколико желите да додате и прилоге, они ће бити јавно доступни под лиценцом који изаберете. Додајте само радове које сте сами направили и датотеке за које поседујете одговарајуће правне дозволе за дељење.
publications-include-checkbox-files =
    .label = Укључи датотеке
publications-include-checkbox-notes =
    .label = Укључи белешке
publications-include-adjust-at-any-time = Можете подесити шта се овде приказује ако одете у збирку Моји радови.
publications-intro-authorship =
    .label = Ја сам аутор овог рада.
publications-intro-authorship-files =
    .label = Ја сам направио овај рад и имам права да делим прикључене датотеке.
publications-sharing-page = Изаберите како ћете делити ваш рад са другима
publications-sharing-keep-rights-field =
    .label = Задржи поље са ауторским правима
publications-sharing-keep-rights-field-where-available =
    .label = Задржи постојеће поље са ауторским правима, уколико је доступно
publications-sharing-text = Можете задржати сва права над својим радом, поделити га под слободном лиценцом или га поделити преко јавног домена. У свим случајевима ће рад бити јавно доступан на страници zotero.org.
publications-sharing-prompt = Да ли желите да поделите свој рад са осталима?
publications-sharing-reserved =
    .label = Не, само објави моје податке на zotero.org.
publications-sharing-cc =
    .label = Да, под лиценцом Заједничко креативно добро
publications-sharing-cc0 =
    .label = Да, постави мој рад у јавни домен
publications-license-page = Изаберите лиценцу Заједничко креативно добро
publications-choose-license-text = Заједничко креативно добро дозвољава другима да копирају и даље деле ваш рад док год је ваша заслуга јасно истакнута, уз давање везе до лиценце и навођење ако је дошло до неких промена. Додатни услови могу бити постављени овде.
publications-choose-license-adaptations-prompt = Да ли дозвољавате дељење измена вашег рада?
publications-choose-license-yes =
    .label = Да
    .accesskey = Y
publications-choose-license-no =
    .label = Не
    .accesskey = N
publications-choose-license-sharealike =
    .label = Да, док год га и други деле под истим условима
    .accesskey = S
publications-choose-license-commercial-prompt = Да ли дозвољавате употребу вашег рада у комерцијалне сврхе?
publications-buttons-add-to-my-publications =
    .label = Додај у Моји радови
publications-buttons-next-sharing =
    .label = Следеће: дељење
publications-buttons-next-choose-license =
    .label = Изаберите лиценцу
licenses-cc-0 = CC0 1.0, посвећеност универзалном јавном домену
licenses-cc-by = Заједничко креативно добро, ауторство, 4.0, интернационална лиценца
licenses-cc-by-nd = Заједничко креативно добро, ауторство-без измена, 4.0, интернационална лиценца
licenses-cc-by-sa = Заједничко креативно добро, ауторство-дељење под истим условима, 4.0, интернационална лиценца
licenses-cc-by-nc = Заједничко креативно добро, ауторство-некомерцијално, 4.0, интернационална лиценца
licenses-cc-by-nc-nd = Заједничко креативно добро, ауторство-некомерцијално-без измена, 4.0, интернационална лиценца
licenses-cc-by-nc-sa = Заједничко креативно добро, ауторство-некомерцијално-дељење под истим условима, 4.0, интернационална лиценца
licenses-cc-more-info = Прочитајте Заједничко креативно добро, <a data-l10n-name="license-considerations">Разматрања за издаваоце лиценци</a> пре него што поставите рад под CC лиценцом. Уколико примените ову лиценцу, не можете опозвати, чак ни уколико касније изаберете другачије услове или повучете објављени рад.
licenses-cc0-more-info = Прочитајте Заједничко креативно добро, <a data-l10n-name="license-considerations">CC0 питања и одговори</a> пре него што примените CC0 на ваш рад. Не можете опозвати одлуку да поставите свој рад у на јавни домен, чак ни уколико касније изаберете другачије услове или повучете објављени рад.
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Покрени у режиму за тражење проблема…
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } ће се поново покренути са искљученим додацима. Неке могућности можда неће радити како треба док је режим за тражење проблема укључен.
menu-ui-density =
    .label = Густина
menu-ui-density-comfortable =
    .label = Удобно
menu-ui-density-compact =
    .label = Збијено
pane-item-details = Detalji stavke
pane-info = Подаци
pane-abstract = Сажетак
pane-attachments = Прилози
pane-notes = Белешке
pane-note-info = Informacije o belešci
pane-libraries-collections = Библиотеке и збирке
pane-tags = Ознаке
pane-related = Сродно
pane-attachment-info = Подаци о прилогу
pane-attachment-preview = Преглед
pane-attachment-annotations = Напомене
pane-header-attachment-associated =
    .label = Преименујте повезану датотеку
item-details-pane =
    .aria-label = { pane-item-details }
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } прилог
            [few] { $count } прилога
           *[other] { $count } прилога
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } белешка
            [few] { $count } белешке
           *[other] { $count } белешки
        }
section-attachments-move-to-trash-message = Da li ste sigurni da želite da premestite „{ $title }” u smeće?
section-notes =
    .label =
        { $count ->
            [one] { $count } белешка
            [few] { $count } белешке
           *[other] { $count } белешки
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } ознака
            [few] { $count } ознаке
           *[other] { $count } ознака
        }
section-related =
    .label = { $count } повезнице
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Прошири одељак
    .label = Прошири одељак { $section }
section-button-collapse =
    .dynamic-tooltiptext = Скупи одељак
    .label = Скупи одељак { $section }
annotations-count =
    { $count ->
        [one] { $count } белешка
        [few] { $count } белешке
       *[other] { $count } белешки
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
    .tooltiptext = Приказ контекстне површи
pin-section =
    .label = Закачи одељак
unpin-section =
    .label = Откачи одељак
collapse-other-sections =
    .label = Скупи друге одељке
expand-all-sections =
    .label = Прошири све одељке
abstract-field =
    .placeholder = Додај апстракт…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Филтрирај ознаке
context-notes-search =
    .placeholder = Претражи белешке
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Нова збирка…
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Нова збирка
    .buttonlabelaccept = Направи одељак
new-collection-name = Име:
new-collection-create-in = Направи у:
show-publications-menuitem =
    .label = Prikaži Moje publikacije
attachment-info-title = Наслов
attachment-info-filename = Име датотеке
attachment-info-accessed = Приступљено
attachment-info-pages = Странице
attachment-info-modified = Измењено
attachment-info-index = Индексирано
attachment-info-convert-note =
    .label =
        Премести у { $type ->
            [standalone] самосталну белешку
            [child] ставку белешке
           *[unknown] нову белешку
        }
    .tooltiptext = Више није подржано додавање белешки и прилога, али можете изменити ову белешку тако што ћете је преместити у засебну белешку.
section-note-info =
    .label = { pane-note-info }
note-info-title = Наслов
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
note-info-date-modified = Измењено
note-info-size = Величина
note-info-word-count = Broj reči
note-info-character-count = Broj znakova
item-title-empty-note = Безимена белешка
attachment-preview-placeholder = Нема прилога за преглед
attachment-rename-from-parent =
    .tooltiptext = Preimenuj datoteku da se podudara sa nadređenom stavkom
account-log-in = Prijavi se
account-not-logged-in-text = Prijavite se na svoj Zotero nalog da biste sinhronizovali podatke.
account-error-login-session-expired = Vaša sesija za prijavu je istekla. Pokušajte ponovo.
toggle-preview =
    .label =
        { $type ->
            [open] Сакриј
            [collapsed] Прикажи
           *[unknown] Укључи/искључи
        } преглед прилога
annotation-image-not-available = [Slika nije dostupna]
quicksearch-mode =
    .aria-label = Режим брзе претраге
quicksearch-input =
    .aria-label = Брза претрага
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
advanced-search = Напредна претрага
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
    .label = Прегледај као
item-pane-header-none =
    .label = Ништа
item-pane-header-title =
    .label = Наслов
item-pane-header-titleCreatorYear =
    .label = Наслов, аутор, година
item-pane-header-bibEntry =
    .label = Библиографски унос
item-pane-header-more-options =
    .label = Више опција
item-pane-message-items-selected =
    { $count ->
        [0] Није изабрана ставке
        [one] Изабрана је { $count } ставка
       *[other] Изабрано је { $count } ставки
    }
item-pane-message-collections-selected =
    { $count ->
        [one] Изабрана је { $count } збирка
        [few] Изабране су { $count } збирке
       *[other] Изабрано је { $count } збирки
    }
item-pane-message-searches-selected =
    { $count ->
        [one] Изабрана је { $count } претрага
        [few] Изабране су { $count } претраге
       *[other] Изабрано је { $count } претрага
    }
item-pane-message-objects-selected =
    { $count ->
        [one] Изабран је { $count } објекат
        [few] Изабрана су { $count } објекта
       *[other] Изабрано је { $count } објеката
    }
item-pane-message-unselected =
    { $count ->
        [0] Нема ставки у овом прегледу
        [one] { $count } ставка у овом прегледу
       *[other] { $count } ставке у овом прегледу
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] Нема објеката у овом прегледу
        [one] { $count } објекат у овом прегледу
       *[other] { $count } објекта у овом прегледу
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Споји { $count } ставку
            [few] Споји { $count } ставке
           *[other] Споји { $count } ставки
        }
locate-library-lookup-no-resolver = Морате да изаберете разрешитеља из површи { $pane } у подешавањима програма { -app-name }.
architecture-win32-warning-message = Пребаците се на 64-творо битни { -app-name } за бржи рад програма. Ваши подаци неће бити промењени.
architecture-warning-action = Преузми 64-творо битни { -app-name }
architecture-x64-on-arm64-message = { -app-name } је покренут у кроз емулацију. Доступна верзија програма { -app-name } за ваш процесор је много ефикаснија.
architecture-x64-on-arm64-action = Преузми { -app-name } за АРМ64
first-run-guidance-authorMenu = { -app-name } вам дозвољава да унесете уредника и преводиоца. Можете да поставите аутора за уредника или преводиоца из овог менија.
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
    .value = Нађи
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
    .label = напомене
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
    .aria-label = Услов за претрагу
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Операција
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Вредност
    .label = { $label }
search-operator-isEmpty = je prazno
search-operator-isNotEmpty = nije prazno
search-conditions-tooltip-fields = Поља:
search-conditions-collection = Колекција
search-conditions-savedSearch = Сачувана претрага
search-conditions-itemTypeID = Врста ставке
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
search-conditions-tag = Ознака
search-conditions-numTags = Broj oznaka
search-conditions-numNotes = Broj beleški
search-conditions-numAttachments = Broj priloga
search-conditions-numAnnotations = Broj napomena
search-conditions-note = Белешка
search-conditions-childNote = Подбелешка
search-conditions-creator = Аутор
search-conditions-thesisType = Врста тезе
search-conditions-reportType = Врста извештаја
search-conditions-videoRecordingFormat = Формат за снимање видеа
search-conditions-audioFileType = Врста звучне датотеке
search-conditions-audioRecordingFormat = Формат за снимање звука
search-conditions-letterType = Врста писма
search-conditions-interviewMedium = Медијум разговора
search-conditions-manuscriptType = Врста рукописа
search-conditions-presentationType = Врста презентације
search-conditions-mapType = Врста мапе
search-conditions-artworkMedium = Медијум уметничког дела
search-conditions-dateModified = Датум промене
search-conditions-fulltextContent = Садржај прилога
search-conditions-programmingLanguage = Програмски језик
search-conditions-fileTypeID = Врста приложене датотеке
search-conditions-attachmentStorageType = Vrsta skladištenja priloga
search-conditions-lastRead = Prilog poslednji put pročitan
search-conditions-annotationText = Текст напомене
search-conditions-annotationComment = Коментар напомене
search-conditions-annotationType = Vrsta napomene
search-conditions-annotationColor = Boja napomene
search-conditions-annotationAuthor = Autor napomene
search-conditions-anyField = Сва поља
search-conditions-titleCreatorYear = Наслов, аутор, година
search-conditions-submenu-attachment = Прилог
search-conditions-submenu-annotation = Напомена
search-conditions-short-fulltextContent = Sadržaj
search-conditions-short-fileTypeID = Врста датотеке
search-conditions-short-attachmentStorageType = Tip skladištenja
search-conditions-short-lastRead = Poslednji put čitano
search-conditions-short-annotationText = Tekst
search-conditions-short-annotationComment = Komentar
search-conditions-short-annotationType = Врста
search-conditions-short-annotationColor = Boja
search-conditions-short-annotationAuthor = Аутор
find-pdf-files-added =
    { $count ->
        [one] { $count } поље је додато
        [few] { $count } поља су додата
       *[other] { $count } поља је додато
    }
select-items-window =
    .title = Изабери ставке
select-items-dialog =
    .buttonlabelaccept = Изабери
select-items-convertToStandalone =
    .label = Pretvori u samostalnu stavku
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Претвори у самосталне прилоге
            [few] Претвори у самосталне прилоге
           *[other] Претвори у самостални прилог
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Pretvori u samostalnu belešku
            [few] Pretvori u samostalne beleške
           *[other] Pretvori u samostalne beleške
        }
file-type-webpage = Веб страница
file-type-image = Слика
file-type-pdf = ПДФ
file-type-audio = Звук
file-type-video = Видео
file-type-presentation = Презентација
file-type-document = Документ
file-type-ebook = Е-књига
attachment-storage-type-storedFile = Sačuvana datoteka
attachment-storage-type-linkedFile = Повезана датотека
attachment-storage-type-webLink = Веза на вебу
post-upgrade-message = Nadograđeni ste na <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Saznajte <a data-l10n-name="new-features-link">šta je novo</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Убаци и претражи
mac-word-plugin-install-message = Зотеро треба да приступи подацима програма Word како би инсталирао прикључак за Word.
mac-word-plugin-install-folder-message = { -app-name } zahteva pristup Word-ovoj fascikli za pokretanje kako bi instalirao Word dodatak.
mac-word-plugin-install-action-button =
    .label = Инсталирај Word прикључак
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Instaliraj dodatak u Wordovu početnu fasciklu
mac-word-plugin-install-folder-dialog-button = Инсталирај
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
    .label = Претрага
save-search-new-button =
    .label = Sačuvaj pretragu…
save-search-edit-button =
    .label = Сачувај
save-search-name-title = Сачувај претрагу
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
undo-action-rename-collection = Преименуј збирку
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
undo-action-edit-note = Уреди белешку
undo-action-add-creator = Dodaj autora
undo-action-remove-creator = Ukloni autora
undo-action-edit-creator = Uredi autora
undo-action-reorder-creator = Promeni redosled autora
undo-action-change-type = Промени врсту ставке
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
