preferences-window =
    .title = { -app-name }n asetukset
preferences-appearance-title = Ulkoasu ja kieli
preferences-auto-recognize-files =
    .label = Hae metatiedot e-kirjoille ja PDFille automaattisesti
preferences-file-renaming-title = Tiedoston uudelleennimeäminen
preferences-file-renaming-intro = { -app-name } voi uudelleennimetä tiedostot automaattisesti päänimikkeen mukaan (otsikko, tekijä jne.) ja pitää tiedostot synkronoituna vaikka teet muutoksia. Ladatut tiedostot nimetään aina aluksi päänimikkeen mukaan.
preferences-file-renaming-configure-button =
    .label = Configure File Renaming…
preferences-attachment-titles-title = Liitteiden otsikot
preferences-attachment-titles-intro = Liitteiden otsikot ovat <label data-l10n-name="wiki-link">erilaisia kuin tiedostonimet </label>. Jotta tietynlaiset työnkulut ovat mahdollisia, { -app-name } voi näyttää tiedostonimet liitteiden otsikoiden sijaan.
preferences-attachment-titles-show-filenames =
    .label = Näytä liitteiden tiedostonimet nimikeluettelossa
preferences-reader-title = Lukija
preferences-reader-open-epubs-using = Avaa EPUB-tiedostot ohjelmalla
preferences-reader-open-snapshots-using = Avaa tilannekuvat ohjelmalla
preferences-reader-open-in-new-window =
    .label = Avaa tiedostot uusissa ikkunoissa välilehtien sijaan
preferences-reader-auto-disable-tool =
    .label = Kytke muistilappu-, teksti-, ja kuvahuomautustyökalut pois päältä joka käyttökerran jälkeen
preferences-reader-ebook-font = E-kirjan fontti:
preferences-reader-ebook-hyphenate =
    .label = Käytä automaattista tavutusta
preferences-note-title = Muistiinpanot
preferences-note-open-in-new-window =
    .label = Avaa muistiinpanot uusissa ikkunoissa välilehtien sijaan
preferences-color-scheme = Väriteema:
preferences-color-scheme-auto =
    .label = Automaattinen
preferences-color-scheme-light =
    .label = Vaalea
preferences-color-scheme-dark =
    .label = Tumma
preferences-item-pane-header = Nimikeruudun otsikko:
preferences-item-pane-header-style = Otsikon siteeraustyyli:
preferences-item-pane-header-locale = Otsikon kieli:
preferences-item-pane-header-missing-style = Puuttuva tyyli: <{ $shortName }>
preferences-locate-library-lookup-intro = Kirjastohaku voi löytää kohteen verkosta käyttämällä OpenURL-hakutyökalua.
preferences-locate-resolver = Palvelin:
preferences-locate-base-url = Perus-URL:
preferences-quickCopy-minus =
    .aria-label = { general-remove }
    .label = { $label }
preferences-quickCopy-plus =
    .aria-label = { general-add }
    .label = { $label }
preferences-styleManager-intro = { -app-name } voi luoda viitteitä ja lähdeluetteloita yli 10 000 viittaustyylillä. Lisää tyylit tänne niin ne ovat käytettävissä { -app-name }n tyylivalikoimassa.
preferences-styleManager-get-additional-styles =
    .label = Hae uusia tyylejä…
preferences-styleManager-restore-default =
    .label = Palauta oletustyylit…
preferences-styleManager-add-from-file =
    .tooltiptext = Lisää tyyli tiedostosta
    .label = Lisää tiedostosta…
preferences-styleManager-remove = Poista tyyli painamalla { delete-or-backspace }.
preferences-citation-dialog = Viittausikkuna
preferences-citation-dialog-mode = Viittausikkunan tyyppi:
preferences-citation-dialog-mode-last-used =
    .label = Viimeksi käytetty
preferences-citation-dialog-mode-list =
    .label = Listatila
preferences-citation-dialog-mode-library =
    .label = Kirjastotila
preferences-advanced-enable-local-api =
    .label = Salli muiden tämän koneen ohjelmien viestiä { -app-name }n kanssa
preferences-advanced-local-api-available = Saatavilla osoitteessa <code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = Sovelluksen { -app-name } HTTP-palvelin ei ole käytössä.
preferences-advanced-server-enable-and-restart =
    .label = Kytke päälle ja käynnistä uudelleen
preferences-advanced-language-and-region-title = Kieli ja alue
preferences-advanced-enable-bidi-ui =
    .label = Käytä kaksisuuntaisen tekstin editointiohjelmia
preferences-advanced-reset-data-dir =
    .label = Palauta vakiosijaintiin…
preferences-advanced-custom-data-dir =
    .label = Käytä omaa sijaintia…
preferences-advanced-default-data-dir =
    .value = (Oletus: { $directory })
    .aria-label = Oletussijainti
-preferences-sync-data-syncing = Tietojen synkronointi
preferences-sync-data-syncing-groupbox =
    .aria-label = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-heading = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-description = Log in with your { -app-name } account to sync your data between devices, collaborate with others, and more.
preferences-account-log-out =
    .label = Log Out…
preferences-sync-reset-restore-to-server-body = { -app-name } korvaa “{ $libraryName }”  { $domain }ssa tällä tietokoneella olevilla tiedoilla.
preferences-sync-reset-restore-to-server-deleted-items-text =
    { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] nimike
       *[other] nimikettä
    } poistetaan pysyvästi verkkokirjastosta.
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] Sekä kirjasto tällä tietokoneella että verkkokirjasto tulevat olemaan tyhjiä.
        [one] 1 nimike jää tälle tietokoneelle ja verkkokirjastoon.
       *[other] { $localItemsCount } nimikettä jää tälle tietokoneelle ja verkkokirjastoon.
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
        [one] Poista 1 kohde
       *[other] Poista { $remoteItemsDeletedCount } kohdetta
    }
preferences-sync-reset-restore-to-server-confirmation-text = poista verkkokirjasto
preferences-sync-reset-restore-to-server-yes = Korvaa tiedot verkkokirjastossa
preferences-account-log-in =
    .label = Log In
preferences-account-waiting-for-login =
    .value = Waiting for login…
preferences-account-cancel-button =
    .label = { general-cancel }
preferences-account-logged-out-status =
    .value = (logged out)
preferences-account-email-label =
    .value = Email:
preferences-account-switch-accounts =
    .label = Switch Accounts…
preferences-account-switch-text = Switching to a different account will remove all { -app-name } data on this computer. Before continuing, make sure all data and files you wish to keep have been synced with the “{ $username }” account or you have a backup of your { -app-name } data directory.
preferences-account-switch-confirmation-text = remove local data
preferences-account-switch-accept = Remove Data and Restart
