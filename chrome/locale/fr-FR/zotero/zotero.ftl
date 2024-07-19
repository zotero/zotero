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
general-open-settings = Ouvrir les paramètres
general-help = ?
general-tag = Tag
menu-file-show-in-finder =
    .label = Afficher dans le gestionnaire de fichiers
menu-file-show-file =
    .label = Localiser le fichier
menu-file-show-files =
    .label = Localiser les fichiers
menu-print =
    .label = { general-print }
menu-density =
    .label = Densité
add-attachment = Ajouter une pièce jointe
new-note = Nouvelle note
menu-add-by-identifier =
    .label = Ajouter par un identifiant…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Ajouter un fichier…
menu-add-standalone-linked-file-attachment =
    .label = Ajouter un lien vers un fichier…
menu-add-child-file-attachment =
    .label = Joindre un fichier…
menu-add-child-linked-file-attachment =
    .label = Joindre un lien vers un fichier…
menu-add-child-linked-url-attachment =
    .label = Ajouter un lien Web…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nouvelle note indépendante
menu-new-item-note =
    .label = Nouvelle note de document
menu-restoreToLibrary =
    .label = Restaurer vers la bibliothèque
menu-deletePermanently =
    .label = Supprimer définitivement…
menu-tools-plugins =
    .label = Extensions
main-window-command =
    .label = { -app-name }
zotero-toolbar-tabs-menu =
    .tooltiptext = Lister tous les onglets
filter-collections = Filtrer les collections
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Rechercher dans les onglets
zotero-tabs-menu-close-button =
    .title = Fermer l'onglet
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Renommer la collection
collections-menu-edit-saved-search =
    .label = Modifier la recherche enregistrée
item-creator-moveDown =
    .label = Descendre
item-creator-moveToTop =
    .label = Déplacer au début
item-creator-moveUp =
    .label = Remonter
item-menu-viewAttachment =
    .label =
        Ouvrir { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] capture
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] captures
                   *[other] Attachments
                }
        } { $openIn ->
            [tab] dans un nouvel onglet
            [window] dans une nouvelle fenêtre
           *[other] { "" }
        }
item-menu-add-file =
    .label = Fichier
item-menu-add-linked-file =
    .label = Fichier lié
item-menu-add-url =
    .label = Lien Web
view-online = Afficher en ligne
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = File renamed to { $filename }
itembox-button-options =
    .tooltiptext = Ouvrir le menu contextuel
itembox-button-merge =
    .aria-label = Sélectionner une version du champ { $field }
create-parent-intro = Entrer un DOI, ISBN, PMID, arXiv ID ou bibcode ADS pour identifier ce fichier:
reader-use-dark-mode-for-content =
    .label = Utiliser le mode sombre pour le contenu
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
    .label = Importer de { $targetApp } en ligne
import-options = Options
import-importing = Importation…
import-create-collection =
    .label = Placer les collections et les documents importés dans une nouvelle collection
import-recreate-structure =
    .label = Reproduire l'organisation des dossiers sous forme de collections
import-fileTypes-header = Types de fichiers à importer
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Autre fichiers sur modèle, séparés par des virgules (par ex. *.jpg, *.png)
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
        [0] Aucun document n'a été importé
        [one] Un document importé
       *[other] { $numItems } documents importés
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Aucun lien n'a été rétabli
        [one] Un lien rétabli
       *[other] { $numRelinked } liens rétablis
    }
import-mendeley-encrypted = La base de données Mendeley sélectionnée n'est pas lisible, peut-être parce qu'elle est chiffrée. Voir <a data-l10n-name="mendeley-import-kb">Comment importer une bibliothèque Mendeley dans Zotero ?</a> pour plus d'informations.
file-interface-import-error-translator = Une erreur s'est produite pendant l'importation du fichier sélectionné par  “{ $translator }”. Assurez-vous que le fichier est valide et réessayez.
import-online-intro = A l'étape suivante, il vous sera demandé de vous connecter à { $targetAppOnline } et d'y donner accès à { -app-name }. Cette autorisation est nécessaire pour importer votre bibliothèque { $targetApp } dans { -app-name }.
import-online-intro2 = { -app-name } ne verra ni n'enregistrera jamais votre mot de passe { $targetApp }.
import-online-form-intro = Veuillez entrer vos informations de connexion à { $targetAppOnline }. Cette autorisation est nécessaire pour importer votre bibliothèque { $targetApp } dans { -app-name }.
import-online-wrong-credentials = Connexion à { $targetApp } refusée. Veuillez vérifier vos informations de connexion et réessayer.
import-online-blocked-by-plugin = L'importation ne peut pas aboutir avec { $plugin } installé. Veuillez désactiver cette extension et réessayer.
import-online-relink-only =
    .label = Lier à nouveau les citations de Mendeley Desktop
import-online-relink-kb = Plus d'informations
import-online-connection-error = { -app-name } n'a pas pu se connecter à { $targetApp }. Veuillez vérifier votre connexion Internet et réessayer.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } note
            [many] { $count } notes
           *[other] { $count } notes
        }
report-error =
    .label = Signaler l'erreur…
rtfScan-wizard =
    .title = Analyse d'un fichier RTF
rtfScan-introPage-description = { -app-name } peut automatiquement extraire et remettre en forme les citations et insérer une bibliographie dans les fichiers RTF. Pour démarrer, choisissez un fichier RTF ci-dessous.
rtfScan-introPage-description2 = Pour démarrer, sélectionnez un fichier RTF en lecture et un fichier de sortie ci-dessous :
rtfScan-input-file = Fichier en lecture
rtfScan-output-file = Fichier de sortie
rtfScan-no-file-selected = Aucun fichier sélectionné
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Choisir un fichier en lecture
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Choisir un fichier de sortie
rtfScan-intro-page =
    .label = Introduction
rtfScan-scan-page =
    .label = Recherche de citations
rtfScan-scanPage-description = { -app-name } analyse votre document à la recherche de citations. Veuillez patienter.
rtfScan-citations-page =
    .label = Vérification des documents cités
rtfScan-citations-page-description = Veuillez vérifier la liste des citations reconnues pour vous assurer que { -app-name } a correctement sélectionné les documents correspondants. Toutes les citations non reconnues ou ambiguës doivent être résolues avant de continuer.
rtfScan-style-page =
    .label = Mise en forme du document
rtfScan-format-page =
    .label = Mise en forme des citations
rtfScan-format-page-description = { -app-name } traite et met en forme votre fichier RTF. Veuillez patienter.
rtfScan-complete-page =
    .label = Analyse du RTF terminé
rtfScan-complete-page-description = Votre document a désormais été analysé et traité. Veuillez vous assurer qu'il a été mis en forme correctement.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Exécution JavaScript
runJS-editor-label = Code :
runJS-run = Exécuter
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Valeur de retour :
       *[other] Résultat :
    }
runJS-run-async = Exécuter en tant que fonction async
bibliography-window =
    .title = { -app-name } - Créer une citation/bibliographie
bibliography-style-label = Style de citation :
bibliography-locale-label = Langue :
bibliography-displayAs-label = Afficher les citations en tant que :
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
    .title = { -app-name } - Préférences du document
integration-addEditCitation-window =
    .title = { -app-name } - Ajouter/Modifier la citation
integration-editBibliography-window =
    .title = { -app-name } - Modifier la bibliographie
integration-quickFormatDialog-window =
    .title = { -app-name } - Mise en forme rapide des citations
integration-prefs-displayAs-label = Afficher les citations en tant que :
integration-prefs-footnotes =
    .label = notes de bas de page
integration-prefs-endnotes =
    .label = notes de fin
integration-prefs-bookmarks =
    .label = Enregistrer les citations en tant que signets
integration-prefs-bookmarks-description = Les signets (ou repères de texte) peuvent être partagés entre Word et LibreOffice, mais ils engendrent parfois des erreurs s'ils sont modifiés accidentellement et ne peuvent pas être insérés en notes de bas de page.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] Le document doit être enregistré au format .doc ou .docx.
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
publications-intro = Les documents que vous ajoutez dans Mes publications seront publiés dans votre profil sur zotero.org. Si vous choisissez d'inclure des fichiers attachés, ces derniers seront rendus publics sous la licence que vous spécifiez. N'ajoutez que des travaux que vous avez créés vous-mêmes et n'ajoutez des fichiers que si vous avez le droit de les distribuer publiquement et seulement si vous le souhaitez.
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
    .label = Suivant : partager
publications-buttons-next-choose-license =
    .label = Choisir une licence
licenses-cc-0 = Versement au domaine public en vertu de CC0 1.0 Universel.
licenses-cc-by = Licence Creative Commons Attribution 4.0 International
licenses-cc-by-nd = Licence Creative Commons Attribution - Pas de modification 4.0 International
licenses-cc-by-sa = Licence Creative Commons Attribution - Partage dans les mêmes conditions 4.0 International
licenses-cc-by-nc = Licence Creative Commons Attribution - Pas d’utilisation commerciale 4.0 International
licenses-cc-by-nc-nd = Licence Creative Commons Attribution - Pas d’utilisation commerciale - Pas de modification 4.0 International
licenses-cc-by-nc-sa = Licence Creative Commons Attribution - Pas d’utilisation commerciale - Partage dans les mêmes conditions 4.0 International
licenses-cc-more-info = Assurez-vous d'avoir lu les <a data-l10n-name="license-considerations">Avertissements à l’attention des donneurs de licence</a> de Creative Commons avant de placer votre œuvre sous une licence CC. Notez que la licence que vous appliquez ne peut être révoquée, même si vous choisissez ultérieurement des conditions différentes ou si vous cessez de publier l'œuvre.
licenses-cc0-more-info = Assurez-vous d'avoir lu la <a data-l10n-name="license-considerations">FAQ CC0</a> de Creative Commons avant de placer votre travail sous la licence CC0. Veuillez noter que placer votre travail dans le domaine public est irréversible, même si vous choisissez plus tard des conditions différentes ou si vous cessez la publication de ce travail.
restart-in-troubleshooting-mode-menuitem =
    .label = Redémarrer en mode dépannage…
    .accesskey = i
restart-in-troubleshooting-mode-dialog-title = Redémarrer en mode dépannage
restart-in-troubleshooting-mode-dialog-description = { -app-name } va redémarrer avec toutes les extensions désactivées. Quelques fonctionnalités pourraient ne pas répondre correctement tant que le mode dépannage est activé.
menu-ui-density =
    .label = Densité
menu-ui-density-comfortable =
    .label = Confortable
menu-ui-density-compact =
    .label = Compact
pane-info = Info
pane-abstract = Résumé
pane-attachments = Fichiers joints
pane-notes = Défilement vertical
pane-libraries-collections = Bibliothèques et collections
pane-tags = Marqueurs
pane-related = Connexe
pane-attachment-info = Info de la pièce jointe
pane-attachment-preview = Aperçu
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
            [one] { $count } pièce jointe
            [many] { $count } pièces jointes
           *[other] { $count } pièces jointes
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } annotation
            [many] { $count } annotations
           *[other] { $count } annotations
        }
section-notes =
    .label =
        { $count ->
            [one] { $count } note
            [many] { $count } notes
           *[other] { $count } notes
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } marqueur
            [many] { $count } marqueurs
           *[other] { $count } marqueurs
        }
section-related =
    .label = { $count } connexes
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Développer la section
    .label = Développer la section { $section }
section-button-collapse =
    .dynamic-tooltiptext = Réduire la section
    .label = Réduire la section { $section }
annotations-count =
    { $count ->
        [one] { $count } annotation
        [many] { $count } annotations
       *[other] { $count } annotations
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
    .label = Épingler la section
unpin-section =
    .label = Désépingler la section
collapse-other-sections =
    .label = Réduire toutes les sections
expand-all-sections =
    .label = Développer toutes les sections
abstract-field =
    .placeholder = Ajouter un résumé…
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtrer les marqueurs
context-notes-search =
    .placeholder = Rechercher dans les notes
new-collection-dialog =
    .title = Nouvelle collection
    .buttonlabelaccept = Créer une collection
new-collection-name = Nom :
new-collection-create-in = Créer dans :
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
    .tooltiptext = L'ajout de notes à une pièce jointe n'est plus pris en charge, mais vous pouvez modifier cette note en la convertissant en une note séparée.
attachment-preview-placeholder = Aucune pièce jointe à prévisualiser
toggle-preview =
    .label =
        { $type ->
            [open] Masquer
            [collapsed] Afficher
           *[unknown] Basculer
        } Attachment Preview
quickformat-general-instructions =
    Utilisez les touches de direction gauche et droite pour naviguer entre les documents de cette citation. { $dialogMenu ->
        [active] Appuyez sur Maj-Tab pour placer le curseur dans le menu de la fenêtre.
       *[other] { "" }
    } Appuyez sur { return-or-enter } pour enregistrer les modifications de cette citation. Appuyez sur Échap pour annuler les modifications et fermer la fenêtre.
quickformat-aria-bubble = Ce document est inclus dans la citation. Appuyez sur la barre d'espace pour personnaliser ce document. { quickformat-general-instructions }
quickformat-aria-input = Commencez la saisie pour rechercher un document à ajouter dans cette citation. Appuyez sur "Tabulation" pour naviguer dans la liste des résultats de recherche. { quickformat-general-instructions }
quickformat-aria-item = Appuyez sur { return-or-enter } pour ajouter ce document à la citation. Appuyez sur Tab pour revenir au champ de recherche.
quickformat-accept =
    .tooltiptext = Enregistrer les modifications de cette citation
quickformat-locator-type =
    .aria-label = Type de localisateur
quickformat-locator-value = Localisateur
quickformat-citation-options =
    .tooltiptext = Afficher les options de citation
insert-note-aria-input = Commencez la saisie pour chercher une note. Appuyez sur Tab pour naviguer dans la liste des résultats de recherche. Appuyez sur Échap pour fermer la boîte de dialogue.
insert-note-aria-item = Appuyez sur { return-or-enter } pour sélectionner cette note. Appuyez sur Tab pour revenir au champ de recherche. Appuyez sur Échap pour fermer cette fenêtre.
quicksearch-mode =
    .aria-label = Mode de recherche rapide
quicksearch-input =
    .aria-label = Recherche rapide
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Voir en tant que
item-pane-header-none =
    .label = Aucune
item-pane-header-title =
    .label = Titre
item-pane-header-titleCreatorYear =
    .label = Titre, Créateur, Année
item-pane-header-bibEntry =
    .label = Entrée de bibliographie
item-pane-header-more-options =
    .label = Plus d'options
item-pane-message-items-selected =
    { $count ->
        [0] No items selected
        [one] { $count } item selected
       *[other] { $count } items selected
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } collection sélectionnée
        [many] { $count } collections sélectionnées
       *[other] { $count } collections sélectionnées
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } recherche sélectionnée
        [many] { $count } recherches sélectionnées
       *[other] { $count } recherches sélectionnées
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } objet sélectionné
        [many] { $count } objets sélectionnés
       *[other] { $count } objets sélectionnés
    }
item-pane-message-unselected =
    { $count ->
        [0] No items in this view
        [one] { $count } item in this view
       *[other] { $count } items in this view
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Merge { $count } item
           *[other] Merge { $count } items
        }
locate-library-lookup-no-resolver = Vous devez choisir un résolveur dans le panneau { $pane } des préférences { -app-name }
architecture-win32-warning-message = Vous utilisez { -app-name } en mode 32-bit sur une version 64-bit de Windows. { -app-name } s'exécutera plus efficacement en mode 64-bit.
architecture-warning-action = Télécharger { -app-name } version 64-bit
first-run-guidance-quickFormat =
    Saisissez un titre, un auteur et/ou une année pour rechercher une référence.
    
    Après l'avoir sélectionnée, cliquez sur la bulle ou appuyez sur ↓/Espace pour afficher les options de citation telles que les numéros des pages, le préfixe et le suffixe.
    
    Vous pouvez aussi ajouter les numéros des pages directement en les incluant dans vos termes de recherche ou en les saisissant après la bulle et en appuyant sur { return-or-enter }.
first-run-guidance-authorMenu = { -app-name } vous permet aussi d'indiquer des éditeurs et des traducteurs. Vous pouvez changer un auteur en éditeur ou en traducteur par une sélection dans ce menu.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Condition de recherche
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Opérateur
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Valeur
    .label = { $label }
