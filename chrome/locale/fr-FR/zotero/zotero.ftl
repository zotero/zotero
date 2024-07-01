general-print = Imprimer
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Supprimer
general-add = Ajouter
general-remind-me-later = Me le rappeler plus tard
general-choose-file = Sélectionnez un fichier…
general-open-settings = Open Settings
general-help = ?
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = Localiser le fichier
menu-file-show-files =
    .label = Show Files
menu-print =
    .label = { general-print }
menu-density =
    .label = Density
add-attachment = Ajouter une pièce jointe
new-note = Nouvelle note
menu-add-by-identifier =
    .label = Add by Identifier…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Add File…
menu-add-standalone-linked-file-attachment =
    .label = Add Link to File…
menu-add-child-file-attachment =
    .label = Attach File…
menu-add-child-linked-file-attachment =
    .label = Joindre un lien vers un fichier…
menu-add-child-linked-url-attachment =
    .label = Attach Web Link…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nouvelle note indépendante
menu-new-item-note =
    .label = New Item Note
menu-restoreToLibrary =
    .label = Restaurer vers la bibliothèque
menu-deletePermanently =
    .label = Supprimer définitivement…
menu-tools-plugins =
    .label = Plugins
main-window-command =
    .label = { -app-name }
zotero-toolbar-tabs-menu =
    .tooltiptext = List all tabs
filter-collections = Filter Collections
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Search Tabs
zotero-tabs-menu-close-button =
    .title = Close Tab
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Rename Collection
collections-menu-edit-saved-search =
    .label = Éditer la recherche enregistrée
item-creator-moveDown =
    .label = Descendre
item-creator-moveToTop =
    .label = Move to Top
item-creator-moveUp =
    .label = Remonter
item-menu-viewAttachment =
    .label =
        Open { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Snapshot
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                   *[other] Attachments
                }
        } { $openIn ->
            [tab] in New Tab
            [window] in New Window
           *[other] { "" }
        }
item-menu-add-file =
    .label = Fichier
item-menu-add-linked-file =
    .label = Linked File
item-menu-add-url =
    .label = Web Link
view-online = Afficher en ligne
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
itembox-button-options =
    .tooltiptext = Open context menu
itembox-button-merge =
    .aria-label = Select version of { $field } field
create-parent-intro = Enter a DOI, ISBN, PMID, arXiv ID, or ADS Bibcode to identify this file:
reader-use-dark-mode-for-content =
    .label = Use Dark Mode for Content
update-updates-found-intro-minor = Une mise-à-jour pour { -app-name } est disponible :
update-updates-found-desc = Il est recommandé d'appliquer cette mise-à-jour dès que possible.
import-window =
    .title = Importer
import-where-from = D'où voulez-vous importer ?
import-online-intro-title = Introduction
import-source-file =
    .label = Un fichier (BibTeX, RIS, Zotero RDF, etc.)
import-source-folder =
    .label = Un dossier de PDFs ou d'autres fichiers
import-source-online =
    .label = { $targetApp } online import
import-options = Options
import-importing = Importation…
import-create-collection =
    .label = Placer les collections et les documents importés dans une nouvelle collection
import-recreate-structure =
    .label = Recreate folder structure as collections
import-fileTypes-header = File Types to Import:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Other files by pattern, comma-separated (e.g., *.jpg,*.png)
import-file-handling = Gestion des fichiers
import-file-handling-store =
    .label = Copier les fichiers dans le répertoire de stockage de { -app-name }
import-file-handling-link =
    .label = Lien vers l'emplacement original des fichiers.
import-fileHandling-description = Les fichiers liés ne peuvent pas être synchronisés par { -app-name }.
import-online-new =
    .label = Télécharger uniquement les nouveaux documents ; ne pas mettre à jour les documents importés précédemment
import-mendeley-username = Nom d’utilisateur
import-mendeley-password = Mot de passe
general-error = Erreur
file-interface-import-error = Une erreur s'est produite lors de la tentative d'importation du fichier sélectionné. Veuillez vérifier que le fichier est valide et réessayez.
file-interface-import-complete = Importation terminée
file-interface-items-were-imported =
    { $numItems ->
        [0] No items were imported
        [one] One item was imported
       *[other] { $numItems } items were imported
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] No items were relinked
        [one] One item was relinked
       *[other] { $numRelinked } items were relinked
    }
import-mendeley-encrypted = The selected Mendeley database cannot be read, likely because it is encrypted. See <a data-l10n-name="mendeley-import-kb">How do I import a Mendeley library into Zotero?</a> for more information.
file-interface-import-error-translator = An error occurred importing the selected file with “{ $translator }”. Please ensure that the file is valid and try again.
import-online-intro = In the next step you will be asked to log in to { $targetAppOnline } and grant { -app-name } access. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-intro2 = { -app-name } will never see or store your { $targetApp } password.
import-online-form-intro = Please enter your credentials to log in to { $targetAppOnline }. This is necessary to import your { $targetApp } library into { -app-name }.
import-online-wrong-credentials = Login to { $targetApp } failed. Please re-enter credentials and try again.
import-online-blocked-by-plugin = The import cannot continue with { $plugin } installed. Please disable this plugin and try again.
import-online-relink-only =
    .label = Lier à nouveau les citations de Mendeley Desktop
import-online-relink-kb = Plus d'informations
import-online-connection-error = { -app-name } could not connect to { $targetApp }. Please check your internet connection and try again.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
report-error =
    .label = Signaler l'erreur…
rtfScan-wizard =
    .title = Analyse d'un fichier RTF
rtfScan-introPage-description = { -app-name } can automatically extract and reformat citations and insert a bibliography into RTF files. To get started, choose an RTF file below.
rtfScan-introPage-description2 = Pour démarrer, sélectionnez un fichier RTF en lecture et un fichier de sortie ci-dessous :
rtfScan-input-file = Fichier en lecture
rtfScan-output-file = Fichier de sortie
rtfScan-no-file-selected = Aucun fichier sélectionné
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choose Input File
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choose Output File
rtfScan-intro-page =
    .label = Introduction
rtfScan-scan-page =
    .label = Recherche de citations
rtfScan-scanPage-description = { -app-name } is scanning your document for citations. Please be patient.
rtfScan-citations-page =
    .label = Vérification des documents cités
rtfScan-citations-page-description = Please review the list of recognized citations below to ensure that { -app-name } has selected the corresponding items correctly. Any unmapped or ambiguous citations must be resolved before proceeding to the next step.
rtfScan-style-page =
    .label = Mise en forme du document
rtfScan-format-page =
    .label = Mise en forme des citations
rtfScan-format-page-description = { -app-name } is processing and formatting your RTF file. Please be patient.
rtfScan-complete-page =
    .label = Analyse du RTF terminé
rtfScan-complete-page-description = Votre document a désormais été analysé et traité. Veuillez vous assurer qu'il a été mis en forme correctement.
runJS-title = Run JavaScript
runJS-editor-label = Code:
runJS-run = Run
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Run as async function
bibliography-window =
    .title = { -app-name } - Create Citation/Bibliography
bibliography-style-label = Style de citation :
bibliography-locale-label = Langue :
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Options avancées
bibliography-outputMode-label = Mode de création :
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliographie
bibliography-outputMethod-label = Méthode de création :
bibliography-outputMethod-saveAsRTF =
    .label = Enregistrer au format RTF
bibliography-outputMethod-saveAsHTML =
    .label = Enregistrer au format HTML
bibliography-outputMethod-copyToClipboard =
    .label = Copier dans le presse-papiers
bibliography-outputMethod-print =
    .label = Imprimer
bibliography-manageStyles-label = Gérer les styles…
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = Afficher les citations en tant que :
integration-prefs-footnotes =
    .label = notes de bas de page
integration-prefs-endnotes =
    .label = notes de fin
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = Les signets (ou repères de texte) peuvent être partagés entre Word et LibreOffice, mais ils engendrent parfois des erreurs s'ils sont modifiés accidentellement et ne peuvent pas être insérés en notes de bas de page.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Mettre à jour automatiquement les citations
    .tooltip = Les citations en attente de mise à jour seront surlignées dans le document
integration-prefs-automaticCitationUpdates-description = Désactiver les mises à jour peut accélérer l'insertion de citation dans les documents longs. Cliquez sur Actualiser pour mettre à jour les citations manuellement.
integration-prefs-automaticJournalAbbeviations =
    .label = Utiliser les abréviations MEDLINE des titres de revues
integration-prefs-automaticJournalAbbeviations-description = Le champ Zotero "Abrév. de revue" sera ignoré.
integration-prefs-exportDocument =
    .label = Passer à un autre logiciel de traitement de texte…
publications-intro-page =
    .label = Mes publications
publications-intro = Les documents que vous ajoutez dans Mes publications seront publiés dans votre profil sur zotero.org. Si vous choisissez d'inclure les fichiers attachés, ceux-ci seront rendus publics sous la licence que vous spécifiez. N'ajoutez que des travaux que vous avez créés vous-mêmes et n'incluez que les fichiers attachés que vous osez et voulez distribuer.
publications-include-checkbox-files =
    .label = Inclure les fichiers
publications-include-checkbox-notes =
    .label = Inclure les notes
publications-include-adjust-at-any-time = Vous pouvez en tout temps ajuster ce qui s'affiche dans la collection Mes publications.
publications-intro-authorship =
    .label = Je suis l'auteur de ce travail.
publications-intro-authorship-files =
    .label = Je suis l'auteur de ce travail et j'ai le droit de distribuer les fichiers qui y sont attachés
publications-sharing-page =
    .label = Choisissez comment votre travail peut être partagé
publications-sharing-keep-rights-field =
    .label = Conserver le contenu existant du champ "Autorisations"
publications-sharing-keep-rights-field-where-available =
    .label = Conserver le contenu existant du champ "Autorisations" lorsqu'il est rempli
publications-sharing-text = Vous pouvez vous réserver tous les droits sur votre travail, le publier sous licence Creative Commons, ou le placer dans le domaine public. Dans tous les cas, le travail sera rendu public via zotero.org.
publications-sharing-prompt = Comment votre travail peut-il être partagé par les autres ?
publications-sharing-reserved =
    .label = Non, ne publier mon travail que sur zotero.org
publications-sharing-cc =
    .label = Oui, sous licence Creative Commons
publications-sharing-cc0 =
    .label = Oui, et placer mon travail dans le domaine public
publications-license-page =
    .label = Choisir une licence Creative Commons
publications-choose-license-text = Une licence Creative Commons permet aux autres de copier et redistribuer votre travail pour autant qu'il vous crédite correctement, fournisse le lien de la licence et indique si des modifications ont été apportées. Des conditions supplémentaires peuvent être spécifiées plus bas.
publications-choose-license-adaptations-prompt = Autoriser de modifier et partager votre travail ?
publications-choose-license-yes =
    .label = Oui
    .accesskey = Y
publications-choose-license-no =
    .label = Non
    .accesskey = N
publications-choose-license-sharealike =
    .label = Oui, tant que les autres le partage selon les mêmes conditions
    .accesskey = S
publications-choose-license-commercial-prompt = Autoriser une utilisation commerciale de votre travail ?
publications-buttons-add-to-my-publications =
    .label = Ajouter à Mes publications
publications-buttons-next-sharing =
    .label = Next: Sharing
publications-buttons-next-choose-license =
    .label = Choisir une licence
licenses-cc-0 = CC0 1.0 Universal Public Domain Dedication
licenses-cc-by = Licence Creative Commons Attribution 4.0 International
licenses-cc-by-nd = Licence Creative Commons Attribution - Pas de modification 4.0 International
licenses-cc-by-sa = Licence Creative Commons Attribution - Partage dans les mêmes conditions 4.0 International
licenses-cc-by-nc = Licence Creative Commons Attribution - Pas d’utilisation commerciale 4.0 International
licenses-cc-by-nc-nd = Licence Creative Commons Attribution - Pas d’utilisation commerciale - Pas de modification 4.0 International
licenses-cc-by-nc-sa = Licence Creative Commons Attribution - Pas d’utilisation commerciale - Partage dans les mêmes conditions 4.0 International
licenses-cc-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">Considerations for licensors</a> before placing your work under a CC license. Note that the license you apply cannot be revoked, even if you later choose different terms or cease publishing the work.
licenses-cc0-more-info = Be sure you have read the Creative Commons <a data-l10n-name="license-considerations">CC0 FAQ</a> before applying CC0 to your work. Please note that dedicating your work to the public domain is irreversible, even if you later choose different terms or cease publishing the work.
restart-in-troubleshooting-mode-menuitem =
    .label = Restart in Troubleshooting Mode…
    .accesskey = i
restart-in-troubleshooting-mode-dialog-title = Restart in Troubleshooting Mode
restart-in-troubleshooting-mode-dialog-description = { -app-name } will restart with all plugins disabled. Some features may not function correctly while Troubleshooting Mode is enabled.
menu-ui-density =
    .label = Density
menu-ui-density-comfortable =
    .label = Comfortable
menu-ui-density-compact =
    .label = Compact
pane-info = Info
pane-abstract = Résumé
pane-attachments = Fichiers joints
pane-notes = Défilement vertical
pane-libraries-collections = Libraries and Collections
pane-tags = Marqueurs
pane-related = Connexe
pane-attachment-info = Attachment Info
pane-attachment-preview = Preview
pane-attachment-annotations = Annotations
pane-header-attachment-associated =
    .label = Renommer le fichier associé
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } Attachment
           *[other] { $count } Attachments
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } Annotation
           *[other] { $count } Annotations
        }
section-notes =
    .label =
        { $count ->
            [one] { $count } Note
           *[other] { $count } Notes
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } Tag
           *[other] { $count } Tags
        }
section-related =
    .label = { $count } Related
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .tooltiptext = Expand section
section-button-collapse =
    .tooltiptext = Collapse section
annotations-count =
    { $count ->
        [one] { $count } Annotation
       *[other] { $count } Annotations
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
pin-section =
    .label = Pin Section
unpin-section =
    .label = Unpin Section
collapse-other-sections =
    .label = Collapse Other Sections
expand-all-sections =
    .label = Expand All Sections
abstract-field =
    .placeholder = Add abstract…
tagselector-search =
    .placeholder = Filter Tags
context-notes-search =
    .placeholder = Search Notes
new-collection-dialog =
    .title = Nouvelle collection
    .buttonlabelaccept = Create Collection
new-collection-name = Nom :
new-collection-create-in = Create in:
attachment-info-filename = Nom du fichier
attachment-info-accessed = Date de consultation
attachment-info-pages = Pages
attachment-info-modified = Modifié le
attachment-info-index = Indexé
attachment-info-convert-note =
    .label =
        Migrate to { $type ->
            [standalone] Standalone
            [child] Item
           *[unknown] New
        } Note
    .tooltiptext = Adding notes to attachments is no longer supported, but you can edit this note by migrating it to a separate note.
attachment-preview-placeholder = No attachment to preview
toggle-preview =
    .label =
        { $type ->
            [open] Hide
            [collapsed] Show
           *[unknown] Toggle
        } Attachment Preview
quickformat-general-instructions =
    Use Left/Right Arrow to navigate the items of this citation. { $dialogMenu ->
        [active] Press Shift-Tab to focus the dialog's menu.
       *[other] { "" }
    } Press { return-or-enter } to save edits to this citation. Press Escape to discard the changes and close the dialog.
quickformat-aria-bubble = This item is included in the citation. Press space bar to customize the item. { quickformat-general-instructions }
quickformat-aria-input = Type to search for an item to include in this citation. Press Tab to navigate the list of search results. { quickformat-general-instructions }
quickformat-aria-item = Press { return-or-enter } to add this item to the citation. Press Tab to go back to the search field.
quickformat-accept =
    .tooltiptext = Save edits to this citation
quickformat-locator-type =
    .aria-label = Locator type
quickformat-locator-value = Locator
quickformat-citation-options =
    .tooltiptext = Show citation options
insert-note-aria-input = Type to search for a note. Press Tab to navigate the list of results. Press Escape to close the dialog.
insert-note-aria-item = Press { return-or-enter } to select this note. Press Tab to go back to the search field. Press Escape to close the dialog.
quicksearch-mode =
    .aria-label = Quick Search mode
quicksearch-input =
    .aria-label = Recherche rapide
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = View As
item-pane-header-none =
    .label = Aucune
item-pane-header-title =
    .label = Titre
item-pane-header-titleCreatorYear =
    .label = Titre, Créateur, Année
item-pane-header-bibEntry =
    .label = Bibliography Entry
item-pane-header-more-options =
    .label = More Options
item-pane-message-items-selected =
    { $count ->
        [one] { $count } item selected
       *[other] { $count } items selected
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } collection selected
       *[other] { $count } collections selected
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } search selected
       *[other] { $count } searches selected
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } object selected
       *[other] { $count } objects selected
    }
locate-library-lookup-no-resolver = You must choose a resolver from the { $pane } pane of the { -app-name } settings.
architecture-win32-warning-message = { -app-name } is running in 32-bit mode on a 64-bit version of Windows. { -app-name } will run more efficiently in 64-bit mode.
architecture-warning-action = Download 64-bit { -app-name }
first-run-guidance-quickFormat =
    Type a title, author, and/or year to search for a reference.
    
    After you’ve made your selection, click the bubble or select it via the keyboard and press ↓/Space to show citation options such as page number, prefix, and suffix.
    
    You can also add a page number directly by including it with your search terms or typing it after the bubble and pressing { return-or-enter }.
first-run-guidance-authorMenu = { -app-name } lets you specify editors and translators too. You can turn an author into an editor or translator by selecting from this menu.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Search condition
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operator
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Value
    .label = { $label }
