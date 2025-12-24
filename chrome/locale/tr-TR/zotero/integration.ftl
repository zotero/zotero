integration-docPrefs-window =
    .title = { -app-name } - Belge Tercihleri
integration-addEditCitation-window =
    .title = { -app-name } - Alıntı Ekle/Düzenle
integration-editBibliography-window =
    .title = { -app-name } - Kaynakça Düzenle
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Kaynağı düzenle
-integration-editBibliography-include-uncited = Alıntılanmamış bir eseri kaynakçanıza dahil etmek için bu eseri eserler listesinden seçiniz ve { general-add } üzerine basınız.
-integration-editBibliography-exclude-cited = Alıntılanmış bir eseri kaynakçanızdan çıkarmak için bu eseri kaynaklar listesinden seçiniz ve { general-remove } üzerine basınız.
-integration-editBibliography-edit-reference = Bir kaynağın biçimleniş şeklini değiştirmek için metin düzenleyiciyi kulanınız.
integration-editBibliography-wrapper =
    .aria-label = Kaynakça Düzenleme iletişim kutusu
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Alıntı İletişim Kutusu
integration-citationDialog-section-open = Open Documents ({ $count })
integration-citationDialog-section-selected = Selected Items ({ $count }/{ $total })
integration-citationDialog-section-cited =
    { $count ->
        [0] Cited Items
       *[other] Cited Items ({ $count })
    }
integration-citationDialog-details-suffix = Suffix
integration-citationDialog-details-prefix = Prefix
integration-citationDialog-details-suppressAuthor = Yazar Adını Sakla
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Citation Settings
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] No selected, open, or cited items match the current search
       *[other] No selected or open items
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] No selected notes match the current search
       *[other] No notes are selected
    }
integration-citationDialog-settings-keepSorted = Keep sources sorted
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = Kitaplık
integration-citationDialog-mode-list = List
integration-citationDialog-btn-type-citation =
    .title = Alıntı Ekle/Düzenle
integration-citationDialog-btn-type-add-note =
    .title = Not Ekle
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Use Left/Right-Arrow to navigate the items of this citation. Press Tab to select items to add to this citation.
integration-citationDialog-enter-to-add-item = Press { return-or-enter } to add this item to the citation.
integration-citationDialog-search-for-items = Search for items to add to the citation
integration-citationDialog-aria-bubble =
    .aria-description = This item is included in the citation. Press space bar to customize the item. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Press Tab to select items to add to this citation. Press Escape to discard the changes and close the dialog.
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Search for a note to insert into the document
integration-citationDialog-aria-item-list =
    .aria-description = Use Up/Down Arrow to change item selection. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Use Right/Left Arrow to change item selection. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Collections.
    .aria-description = Select a collection and press Tab to navigate its items.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = This item has been added to the citation. Press { return-or-enter } to add it again or { delete-or-backspace } to remove it.
integration-citationDialog-add-all = Add all
integration-citationDialog-collapse-section =
    .title = Bölümü daralt
integration-citationDialog-bubble-empty = (no title)
integration-citationDialog-add-to-citation = Add to Citation
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
integration-warning-citation-changes-will-be-lost = You have made changes to a citation that will be lost if you continue.
integration-warning-bibliography-changes-will-be-lost = You have made changes to the bibliography that will be lost if you continue.
integration-warning-documentPreferences-changes-will-be-lost = You have made changes to the document preferences that will be lost if you continue.
integration-warning-discard-changes = Discard Changes
integration-warning-command-is-running = A word processor integration command is already running.
