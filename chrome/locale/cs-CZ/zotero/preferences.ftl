preferences-window =
    .title = { -app-name } Nastavení
preferences-appearance-title = Vzhled a jazyk
preferences-auto-recognize-files =
    .label = Automaticky načíst metadata souborů PDF a elektronických knih
preferences-file-renaming-title = Přejmenování souborů
preferences-file-renaming-intro = { -app-name } can automatically rename files based on the details of the parent item (title, author, etc.) and keep the filenames in sync as you make changes. Downloaded files are always initially named based on the parent item.
preferences-file-renaming-auto-rename-files =
    .label = Automatically rename files
preferences-file-renaming-file-types = Přejmenovat soubory těchto typů:
preferences-file-renaming-file-type-pdf =
    .label = { file-type-pdf }
preferences-file-renaming-file-type-epub =
    .label = { file-type-ebook }
preferences-file-renaming-file-type-image =
    .label = { file-type-image }
preferences-file-renaming-file-type-audio =
    .label = { file-type-audio }
preferences-file-renaming-file-type-video =
    .label = { file-type-video }
preferences-file-renaming-customize-button =
    .label = Přizpůsobit formát názvu souboru...
preferences-file-renaming-rename-now =
    .label = Rename Files…
preferences-file-renaming-format-title = Formát názvu souboru
preferences-file-renaming-format-instructions = Můžete přizpůsobit vzor názvu souboru, který  { -app-name } používá k přejmenování souborů příloh z rodičovských metadat.
preferences-file-renaming-format-instructions-example = Například "{ $example }" v této šabloně bude nahrazen názvem nadřazené položky zkráceným na 50 znaků.
preferences-file-renaming-format-instructions-more = Viz <label data-l10n-name="file-renaming-format-help-link">dokumentace</label> pro více informací.
preferences-file-renaming-format-template = Šablona názvu souboru:
preferences-file-renaming-format-preview = Náhled:
preferences-attachment-titles-title = Attachment Titles
preferences-attachment-titles-intro = Attachment titles are <label data-l10n-name="wiki-link">different from filenames</label>. To support some workflows, { -app-name } can show filenames instead of attachment titles in the items list.
preferences-attachment-titles-show-filenames =
    .label = Show attachment filenames in the items list
preferences-reader-title = Čtečka
preferences-reader-open-epubs-using = Otevřít EPUB soubor pomocí
preferences-reader-open-snapshots-using = Otevřít náhledy pomocí
preferences-reader-open-in-new-window =
    .label = Otevřít soubory v nových oknech místo kartách
preferences-reader-auto-disable-tool =
    .label = Turn off note, text, and image annotation tools after each use
preferences-reader-ebook-font = Písmo Ebooku:
preferences-reader-ebook-hyphenate =
    .label = Povolit automatické dělení slov
preferences-note-title = Poznámky
preferences-note-open-in-new-window =
    .label = Open notes in new windows instead of tabs
preferences-color-scheme = Barevný motiv:
preferences-color-scheme-auto =
    .label = Automatický
preferences-color-scheme-light =
    .label = Světlý
preferences-color-scheme-dark =
    .label = Tmavý
preferences-item-pane-header = Záhlaví panelu položek:
preferences-item-pane-header-style = Styl citování v záhlaví:
preferences-item-pane-header-locale = Jazyk záhlaví:
preferences-item-pane-header-missing-style = Chybějící styl: <{ $shortName }>
preferences-locate-library-lookup-intro = Služba Library Lookup dokáže vyhledat zdroj online pomocí překladače OpenURL vaší knihovny.
preferences-locate-resolver = Resolver:
preferences-locate-base-url = Základní adresa URL:
preferences-quickCopy-minus =
    .aria-label = { general-remove }
    .label = { $label }
preferences-quickCopy-plus =
    .aria-label = { general-add }
    .label = { $label }
preferences-styleManager-intro = { -app-name } can generate citations and bibliographies in over 10,000 citation styles. Add styles here to make them available when selecting styles throughout { -app-name }.
preferences-styleManager-get-additional-styles =
    .label = Get Additional Styles…
preferences-styleManager-restore-default =
    .label = Restore Default Styles…
preferences-styleManager-add-from-file =
    .tooltiptext = Přidat styl ze souboru
    .label = Add from File…
preferences-styleManager-remove = Press { delete-or-backspace } to remove this style.
preferences-citation-dialog = Citation Dialog
preferences-citation-dialog-mode = Citation Dialog Mode:
preferences-citation-dialog-mode-last-used =
    .label = Last Used
preferences-citation-dialog-mode-list =
    .label = List Mode
preferences-citation-dialog-mode-library =
    .label = Library Mode
preferences-advanced-enable-local-api =
    .label = Povolit ostatním aplikacím v tomto počítači komunikovat s { -app-name }
preferences-advanced-local-api-available = Dostupný na adrese<code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = { -app-name } server HTTP je zakázán.
preferences-advanced-server-enable-and-restart =
    .label = Povolit a restartovat
preferences-advanced-language-and-region-title = Jazyk a oblast
preferences-advanced-enable-bidi-ui =
    .label = Povolit  nástroje pro úpravu obousměrného textu
preferences-advanced-reset-data-dir =
    .label = Návrat k výchozímu umístění...
preferences-advanced-custom-data-dir =
    .label = Použít vlastní umístění...
preferences-advanced-default-data-dir =
    .value = (Výchozí: { $directory })
    .aria-label = Výchozí umístění
preferences-sync-reset-restore-to-server-body = { -app-name } will replace “{ $libraryName }” on { $domain } with data from this computer.
preferences-sync-reset-restore-to-server-deleted-items-text =
    { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] item
       *[other] items
    } in the online library will be permanently deleted.
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] The library on this computer and the online library will be empty.
        [one] 1 item will remain on this computer and in the online library.
       *[other] { $localItemsCount } items will remain on this computer and in the online library.
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
        [one] Delete 1 item
       *[other] Delete { $remoteItemsDeletedCount } items
    }
preferences-sync-reset-restore-to-server-confirmation-text = delete online library
preferences-sync-reset-restore-to-server-yes = Nahradit data v online knihovně
