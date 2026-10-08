preferences-window =
    .title = Inställningar för { -app-name }
preferences-appearance-title = Utseende och språk
preferences-auto-recognize-files =
    .label = Hämta automatiskt metadata för PDF:er och e-böcker
preferences-file-renaming-title = Byt namn på filer
preferences-file-renaming-intro = { -app-name } kan automatiskt byta namn på filer utifrån den överordnade postens uppgifter (titel, författare osv.) och hålla filnamnen synkroniserade när du gör ändringar. Hämtade filer namnges alltid först utifrån den överordnade posten.
preferences-file-renaming-configure-button =
    .label = Konfigurera filnamnsändring…
preferences-attachment-titles-title = Titlar på bifogade filer
preferences-attachment-titles-intro = Titlar på bifogade filer <label data-l10n-name="wiki-link">skiljer sig från filnamn</label>. För att stödja vissa arbetsflöden kan { -app-name } visa filnamn i stället för titlar på bifogade filer i postlistan.
preferences-attachment-titles-show-filenames =
    .label = Visa filnamn för bifogade filer i postlistan
preferences-reader-title = Läsare
preferences-reader-open-epubs-using = Öppna EPUB-filer med
preferences-reader-open-snapshots-using = Öppna ögonblicksbilder med
preferences-reader-open-in-new-window =
    .label = Öppna filer i nya fönster i stället för flikar
preferences-reader-auto-disable-tool =
    .label = Stäng av verktygen för anteckningar, textannoteringar och bildannoteringar efter varje användning
preferences-reader-ebook-font = E-bokstypsnitt:
preferences-reader-ebook-hyphenate =
    .label = Aktivera automatisk avstavning
preferences-read-aloud-title = Läs upp
preferences-read-aloud-highlight-granularity = Markera aktuell
preferences-read-aloud-highlight-granularity-paragraph =
    .label = stycke
preferences-read-aloud-highlight-granularity-sentence =
    .label = mening
preferences-read-aloud-highlight-granularity-word =
    .label = ord
preferences-note-title = Anteckningar
preferences-note-open-in-new-window =
    .label = Öppna anteckningar i nya fönster i stället för flikar
preferences-color-scheme = Färgtema:
preferences-color-scheme-auto =
    .label = Automatisk
preferences-color-scheme-light =
    .label = Ljust
preferences-color-scheme-dark =
    .label = Mörkt
preferences-item-pane-header = Postpanelsrubrik:
preferences-item-pane-header-style = Citeringsstil för rubrik:
preferences-item-pane-header-locale = Rubrikspråk:
preferences-item-pane-header-missing-style = Saknad stil: <{ $shortName }>
preferences-locate-library-lookup-intro = Biblioteksuppslag kan hitta en resurs på nätet med hjälp av bibliotekets OpenURL-uppslagsserver.
preferences-locate-resolver = Länkserver:
preferences-locate-base-url = Bas-URL:
preferences-quickCopy-minus =
    .aria-label = { general-remove }
    .label = { $label }
preferences-quickCopy-plus =
    .aria-label = { general-add }
    .label = { $label }
preferences-styleManager-intro = { -app-name } kan skapa citeringar och referenslistor i fler än 10 000 citeringsstilar. Lägg till stilar här för att göra dem tillgängliga när du väljer stil i { -app-name }.
preferences-styleManager-get-additional-styles =
    .label = Hämta fler stilar…
preferences-styleManager-restore-default =
    .label = Återställ standardstilar…
preferences-styleManager-add-from-file =
    .tooltiptext = Lägg till en stil från en fil
    .label = Lägg till från fil...
preferences-styleManager-remove = Tryck på { delete-or-backspace } för att ta bort den här stilen.
preferences-citation-dialog = Citeringsdialogruta
preferences-citation-dialog-mode = Läge för citeringsdialogruta:
preferences-citation-dialog-mode-last-used =
    .label = Senast använd
preferences-citation-dialog-mode-list =
    .label = Listläge
preferences-citation-dialog-mode-library =
    .label = Biblioteksläge
preferences-advanced-enable-local-api =
    .label = Tillåt andra program på den här datorn att kommunicera med { -app-name }
preferences-advanced-local-api-available = Tillgänglig på <code data-l10n-name="url">{ $url }</span>
preferences-advanced-local-api-clear-authorizations =
    .label = Rensa skrivbehörigheter
preferences-advanced-server-disabled = HTTP-servern för { -app-name } är inaktiverad.
preferences-advanced-server-enable-and-restart =
    .label = Aktivera och starta om
preferences-advanced-language-and-region-title = Språk och region
preferences-advanced-enable-bidi-ui =
    .label = Aktivera hjälpmedel för dubbelriktad textredigering
preferences-advanced-data-dir =
    .value = Datakatalog:
preferences-advanced-reset-data-dir =
    .label = Återgå till standardplats…
preferences-advanced-custom-data-dir =
    .label = Använd anpassad plats…
preferences-advanced-default-data-dir =
    .value = (Standard: { $directory })
    .aria-label = Standardplats
preferences-pane-account = Konto
-preferences-sync-data-syncing = Datasynkronisering
preferences-sync-data-syncing-groupbox =
    .aria-label = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-heading = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-description = Logga in med ditt { -app-name }-konto för att synkronisera data mellan enheter, samarbeta med andra med mera.
preferences-sync-settings-heading = Synkronisera
preferences-sync-settings-intro = { -app-name } kan synkronisera biblioteksdata och filer mellan enheter. <label data-l10n-name="sync-link">Läs mer</label>
preferences-sync-reset-heading = Återställ synkronisering
preferences-sync-fileSyncing-groups =
    .label = Synkronisera bifogade filer i gruppbibliotek med { -app-name } Storage
preferences-sync-fileSyncing-tos = Genom att använda { -app-name } Storage godkänner du dess <label data-l10n-name="terms-link">villkor</label>.
preferences-account-log-out =
    .label = Logga ut…
preferences-sync-reset-restore-to-server-body = { -app-name } ersätter ”{ $libraryName }” på { $domain } med data från den här datorn.
preferences-sync-reset-restore-to-server-deleted-items-text =
    { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] objekt
       *[other] objekt
    } i onlinebiblioteket tas bort permanent.
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] Biblioteket på den här datorn och onlinebiblioteket blir tomma.
        [one] 1 objekt blir kvar på den här datorn och i onlinebiblioteket.
       *[other] { $localItemsCount } objekt blir kvar på den här datorn och i onlinebiblioteket.
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
        [one] Ta bort 1 objekt
       *[other] Ta bort { $remoteItemsDeletedCount } objekt
    }
preferences-sync-reset-restore-to-server-confirmation-text = ta bort onlinebiblioteket
preferences-sync-reset-restore-to-server-yes = Ersätt data i onlinebibliotek
preferences-account-log-in =
    .label = Logga in
preferences-account-waiting-for-login =
    .value = Väntar på inloggning…
preferences-account-cancel-button =
    .label = { general-cancel }
preferences-account-logged-out-status =
    .value = (utloggad)
preferences-account-email-label =
    .value = E-post:
preferences-account-switch-accounts =
    .label = Byt konto…
preferences-account-switch-text = Ett kontobyte tar bort alla { -app-name }-data från den här datorn. Kontrollera innan du fortsätter att data och filer du vill behålla har synkroniserats med kontot ”{ $username }”, eller att du har en säkerhetskopia av { -app-name }-datakatalogen.
preferences-account-switch-confirmation-text = ta bort lokala data
preferences-account-switch-accept = Ta bort data och starta om
fulltext-index-status-indexing = Indexerar { $indexed } av { $total }…
fulltext-index-status-complete = Sökindexet är uppdaterat
fulltext-stats-attachments-indexed = Indexerade bilagor:
fulltext-stats-partially-indexed = Delvis indexerade:
fulltext-stats-not-available = Fulltextinnehåll eller fil saknas:
fulltext-stats-notes-indexed = Indexerade anteckningar:
