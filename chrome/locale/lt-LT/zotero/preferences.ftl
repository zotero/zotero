preferences-window =
    .title = { -app-name } nuostatos
preferences-appearance-title = Išvaizda ir kalba
preferences-auto-recognize-files =
    .label = Automatiškai gauti PDF ir el. knygų metaduomenis
preferences-file-renaming-title = Rinkmenų pervadinimas
preferences-file-renaming-intro = { -app-name } can automatically rename files based on the details of the parent item (title, author, etc.) and keep the filenames in sync as you make changes. Downloaded files are always initially named based on the parent item.
preferences-file-renaming-auto-rename-files =
    .label = Automatically rename files
preferences-file-renaming-file-types = Pervadinti šių tipų rinkmenas:
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
    .label = Savitas rinkmenų vardo formatas...
preferences-file-renaming-rename-now =
    .label = Rename Files…
preferences-file-renaming-format-title = Rinkmenos vardo formatas
preferences-file-renaming-format-instructions = Galite keisti rinkmenos pavadinimo šabloną, kurį naudoja { -app-name } pervadindama priedų rinkmenas pagal tėvinio įrašo meta duomenis.
preferences-file-renaming-format-instructions-example = Pavyzdžiui, „{ $example }“ pagal šį šabloną bus pakeistas į pavadinimu, sutrumpintu iki 50 ženklų.
preferences-file-renaming-format-instructions-more = Išsamiau skaitykite <label data-l10n-name="file-renaming-format-help-link">dokumentacijoje</label>.
preferences-file-renaming-format-template = Rinkmenos vardo šablonas:
preferences-file-renaming-format-preview = Peržiūra:
preferences-attachment-titles-title = Attachment Titles
preferences-attachment-titles-intro = Attachment titles are <label data-l10n-name="wiki-link">different from filenames</label>. To support some workflows, { -app-name } can show filenames instead of attachment titles in the items list.
preferences-attachment-titles-show-filenames =
    .label = Show attachment filenames in the items list
preferences-reader-title = Skaityklė
preferences-reader-open-epubs-using = EPUB atverti su
preferences-reader-open-snapshots-using = Momentines kopijas atverti su
preferences-reader-open-in-new-window =
    .label = Rinkmenas atverti naujuose languose, o ne kortelėse
preferences-reader-auto-disable-tool =
    .label = Turn off note, text, and image annotation tools after each use
preferences-reader-ebook-font = El. knygos šriftas:
preferences-reader-ebook-hyphenate =
    .label = Įgalinti automatinį žodžių kėlimą
preferences-note-title = Pastabos
preferences-note-open-in-new-window =
    .label = Open notes in new windows instead of tabs
preferences-color-scheme = Spalvų derinys:
preferences-color-scheme-auto =
    .label = Automatinis
preferences-color-scheme-light =
    .label = Šviesus
preferences-color-scheme-dark =
    .label = Tamsus
preferences-item-pane-header = Įrašo skydelio antraštė:
preferences-item-pane-header-style = Citavimo stilius antraštei:
preferences-item-pane-header-locale = Antraštės kalba:
preferences-item-pane-header-missing-style = Trūksta stiliaus: <{ $shortName }>
preferences-locate-library-lookup-intro = Paieška bibliotekoje gali padėti rasti nutolusius išteklius per jūsų bibliotekos OpenURL sprendiklį.
preferences-locate-resolver = Sprendiklis:
preferences-locate-base-url = URL pagrindas:
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
    .tooltiptext = Įkelti stilių iš rinkmenos
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
    .label = Leisti kitoms šio kompiuterio programoms sąveikauti su { -app-name }
preferences-advanced-local-api-available = Rasite <code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = { -app-name } HTTP serveris išjungtas.
preferences-advanced-server-enable-and-restart =
    .label = Įgalinti ir paleisti iš naujo
preferences-advanced-language-and-region-title = Kalba ir regonas
preferences-advanced-enable-bidi-ui =
    .label = Įgalinti abikrypčius teksto redagavimo įrankius
preferences-advanced-reset-data-dir =
    .label = Atstatyti numatytąją vietą…
preferences-advanced-custom-data-dir =
    .label = Naudoti savitą vietą...
preferences-advanced-default-data-dir =
    .value = (Numatytoji: { $directory })
    .aria-label = Numatytoji vieta
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
preferences-sync-reset-restore-to-server-yes = Pakeisti duomenis nuotolinėje saugykloje
