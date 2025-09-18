general-sentence-separator = 
general-key-control = Ctrl
general-key-shift = Maj
general-key-alt = Alt
general-key-option = Option
general-key-command = Commande
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
general-print = Imprimer
general-remove = Supprimer
general-add = Ajouter
general-remind-me-later = Me le rappeler plus tard
general-dont-ask-again = Ne plus demander
general-choose-file = Sélectionnez un fichier…
general-open-settings = Ouvrir les paramètres
general-settings = Paramètres...
general-help = ?
general-tag = Marqueur
general-done = Terminé
general-view-troubleshooting-instructions = Afficher les instructions de dépannage
general-go-back = Revenir en arrière
general-accept = Accepter
general-cancel = Annuler
general-show-in-library = Montrer dans la bibliothèque
general-restartApp = Redémarrer { -app-name }
general-restartInTroubleshootingMode = Redémarrer en mode dépannage
general-save = Enregistrer
general-clear = Effacer
general-update = Mettre à jour
general-back = Page précédente
general-edit = Modifier
general-cut = Couper
general-copy = Copier
general-paste = Coller
general-find = Rechercher
general-delete = Supprimer
general-insert = Insérer
general-and = et
general-et-al = et al.
general-previous = Précédent
general-next = Suivant
general-learn-more = En savoir plus
general-warning = Avertissement
general-type-to-continue = Tapez “{ $text }” pour continuer.
general-red = Rouge
general-orange = Orange
general-yellow = Jaune
general-green = Vert
general-teal = Bleu sarcelle
general-blue = Bleu
general-purple = Violet
general-magenta = Magenta
general-violet = Violet
general-maroon = Bordeaux
general-gray = Gris
general-black = Noir
citation-style-label = Style de citation :
language-label = Langue :
menu-custom-group-submenu =
    .label = Plus d'options...
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
    .label = Ajouter un fichier...
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
menu-view-columns-move-left =
    .label = Déplacer la colonne à gauche
menu-view-columns-move-right =
    .label = Déplacer la colonne à droite
menu-show-tabs-menu =
    .label = Afficher le menu des onglets
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Copier l'annotation
            [many] Copier { $count } annotations
           *[other] Copier { $count } annotations
        }
main-window-command =
    .label = Bibliothèque
main-window-key =
    .key = L
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
zotero-toolbar-tabs-scroll-forwards =
    .title = Faire défiler en avant
zotero-toolbar-tabs-scroll-backwards =
    .title = Faire défiler en arrière
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Renommer la collection
collections-menu-edit-saved-search =
    .label = Modifier la recherche enregistrée
collections-menu-move-collection =
    .label = Déplacer vers
collections-menu-copy-collection =
    .label = Copier vers
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
item-menu-change-parent-item =
    .label = Changer de document parent…
item-menu-relate-items =
    .label = Associer les documents
view-online = Afficher en ligne
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Fichier renommé en { $filename }
itembox-button-options =
    .tooltiptext = Ouvrir le menu contextuel
itembox-button-merge =
    .aria-label = Sélectionner une version du champ { $field }
create-parent-intro = Entrer un DOI, ISBN, PMID, arXiv ID ou bibcode ADS pour identifier ce fichier :
reader-use-dark-mode-for-content =
    .label = Utiliser le mode sombre pour le contenu
update-updates-found-intro-minor = Une mise-à-jour pour { -app-name } est disponible :
update-updates-found-desc = Il est recommandé d'appliquer cette mise à jour dès que possible.
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
import-online-blocked-by-plugin = L'importation ne peut pas aboutir avec l'extension { $plugin } installée. Veuillez désactiver cette extension et réessayer.
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
rtfScan-introPage-description = { -app-name } peut automatiquement extraire et remettre en forme les citations et insérer une bibliographie dans les fichiers RTF. L'application prend actuellement en charge des variations selon les formats suivants :
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
rtfScan-intro-page = Introduction
rtfScan-scan-page = Recherche de citations
rtfScan-scanPage-description = { -app-name } analyse votre document à la recherche de citations. Veuillez patienter.
rtfScan-citations-page = Vérification des documents cités
rtfScan-citations-page-description = Veuillez vérifier la liste des citations reconnues pour vous assurer que { -app-name } a correctement sélectionné les documents correspondants. Toutes les citations non reconnues ou ambiguës doivent être résolues avant de continuer.
rtfScan-style-page = Mise en forme du document
rtfScan-format-page = Mise en forme des citations
rtfScan-format-page-description = { -app-name } traite et met en forme votre fichier RTF. Veuillez patienter.
rtfScan-complete-page = Analyse du RTF terminé
rtfScan-complete-page-description = Votre document a désormais été analysé et traité. Veuillez vous assurer qu'il a été mis en forme correctement.
rtfScan-action-find-match =
    .title = Sélectionner un document correspondant
rtfScan-action-accept-match =
    .title = Accepter cette correspondance
runJS-title = Exécution JavaScript
runJS-editor-label = Code :
runJS-run = Exécuter
runJS-help = { general-help }
runJS-completed = réussi
runJS-result =
    { $type ->
        [async] Valeur de retour :
       *[other] Résultat :
    }
runJS-run-async = Exécuter en tant que fonction async
bibliography-window =
    .title = { -app-name } - Créer une citation/bibliographie
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
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
styleEditor-locatorType =
    .aria-label = Type de localisateur
styleEditor-locatorInput = Saisie du localisateur
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Éditeur de style
styleEditor-preview =
    .aria-label = Aperçu
publications-intro-page = Mes publications
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
publications-sharing-page = Choisissez comment votre travail peut être partagé
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
publications-license-page = Choisir une licence Creative Commons
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
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Redémarrer en mode dépannage…
    .accesskey = i
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } va redémarrer avec toutes les extensions désactivées. Quelques fonctionnalités pourraient ne pas répondre correctement tant que le mode dépannage est activé.
menu-ui-density =
    .label = Densité
menu-ui-density-comfortable =
    .label = Confortable
menu-ui-density-compact =
    .label = Compact
pane-item-details = Détails du document
pane-info = Info
pane-abstract = Résumé
pane-attachments = Fichiers joints
pane-notes = Notes
pane-libraries-collections = Bibliothèques et collections
pane-tags = Marqueurs
pane-related = Connexe
pane-attachment-info = Info de la pièce jointe
pane-attachment-preview = Aperçu
pane-attachment-annotations = Annotations
pane-header-attachment-associated =
    .label = Renommer le fichier associé
item-details-pane =
    .aria-label = { pane-item-details }
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
section-attachments-move-to-trash-message = Voulez-vous vraiment mettre “{ $title }” à la corbeille ?
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
sidenav-main-btn-grouping =
    .aria-label = { pane-item-details }
sidenav-reorder-up =
    .label = Déplacer la section vers le haut
sidenav-reorder-down =
    .label = Déplacer la section vers le bas
sidenav-reorder-reset =
    .label = Réinitialiser l'ordre des sections
toggle-item-pane =
    .tooltiptext = Masquer/afficher le panneau des documents
toggle-context-pane =
    .tooltiptext = Masquer/afficher le panneau de contexte
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
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Nouvelle collection…
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Nouvelle collection
    .buttonlabelaccept = Créer une collection
new-collection-name = Nom :
new-collection-create-in = Créer dans :
show-publications-menuitem =
    .label = Afficher Mes publications
attachment-info-title = Titre
attachment-info-filename = Nom du fichier
attachment-info-accessed = Date de consultation
attachment-info-pages = Pages
attachment-info-modified = Modifié le
attachment-info-index = Indexé
attachment-info-convert-note =
    .label =
        Convertir en { $type ->
            [standalone] note indépendante
            [child] note fille
           *[unknown] nouvelle note
        }
    .tooltiptext = L'ajout de notes à une pièce jointe n'est plus pris en charge, mais vous pouvez modifier cette note en la convertissant en une note séparée.
attachment-preview-placeholder = Aucune pièce jointe à prévisualiser
attachment-rename-from-parent =
    .tooltiptext = Renommer le fichier pour correspondre au document parent
file-renaming-auto-rename-prompt-title = Paramètres de renommage modifiés
file-renaming-auto-rename-prompt-body = Souhaitez-vous renommer les fichiers existants dans votre bibliothèque pour qu'ils correspondent aux nouveaux paramètres?
file-renaming-auto-rename-prompt-yes = Aperçu des changements...
file-renaming-auto-rename-prompt-no = Garder les noms de fichiers existants
rename-files-preview =
    .buttonlabelaccept = Renommer les fichiers
rename-files-preview-loading = Chargement...
rename-files-preview-intro = { -app-name } va renommer les fichiers suivants dans votre bibliothèque pour qu'ils correspondent à leur document parent :
rename-files-preview-renaming = Renommage...
rename-files-preview-no-files = Tous les noms de fichiers correspondent déjà à leur document parent. Pas de modification requise.
toggle-preview =
    .label =
        { $type ->
            [open] Masquer
            [collapsed] Afficher
           *[unknown] Masquer/afficher
        } l'aperçu de la pièce jointe
annotation-image-not-available = [Image non disponible]
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
        [0] Aucun document sélectionné
        [one] { $count }  document sélectionné
       *[other] { $count }  documents sélectionnés
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
        [0] Aucun document dans cette vue
        [one] { $count } document dans cette vue
       *[other] { $count } documents dans cette vue
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] Aucun objet dans cette vue
        [one] { $count } objet dans cette vue
       *[other] { $count } objets dans cette vue
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Fusionner { $count } document
            [many] Fusionner { $count } documents
           *[other] Fusionner { $count } documents
        }
locate-library-lookup-no-resolver = Vous devez choisir un résolveur dans le panneau { $pane } des préférences { -app-name }
architecture-win32-warning-message = Passez à { -app-name } 64-bit pour de meilleures performances. Vos données ne seront pas affectées.
architecture-warning-action = Télécharger { -app-name } version 64-bit
architecture-x64-on-arm64-message = Vous utilisez { -app-name } en mode émulation. Une version native de { -app-name } s'exécutera plus efficacement.
architecture-x64-on-arm64-action = Télécharger { -app-name } pour ARM64
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
find-pdf-files-added =
    { $count ->
        [one] { $count } fichier ajouté
        [many] { $count } fichiers ajoutés
       *[other] { $count } fichiers ajoutés
    }
select-items-window =
    .title = Sélectionner les documents
select-items-dialog =
    .buttonlabelaccept = Sélectionner
select-items-convertToStandalone =
    .label = Convertir en document indépendant
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Convertir en pièce jointe indépendante
            [many] Convertir en pièces jointes indépendantes
           *[other] Convertir en pièces jointes indépendantes
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Convertir en note indépendante
            [many] Convertir en notes indépendantes
           *[other] Convertir en notes indépendantes
        }
file-type-webpage = Page web
file-type-image = Image
file-type-pdf = PDF
file-type-audio = Audio
file-type-video = Vidéo
file-type-presentation = Présentation
file-type-document = Document
file-type-ebook = Livre numérique
post-upgrade-message = En savoir plus sur <a data-l10n-name="new-features-link">les nouveautés de { -app-name } { $version }</a>
post-upgrade-density = Choisir une densité de mise en page préférée :
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Coller et rechercher
mac-word-plugin-install-message = Zotero doit avoir accès aux données de Word pour installer l'extension Word.
mac-word-plugin-install-action-button =
    .label = Installer l'extension Word
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
file-renaming-banner-message = { -app-name } synchronise désormais automatiquement les noms des fichiers joints lorsque vous modifiez des documents.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = Le connecteur { -app-name } doit être mis à jour pour fonctionner avec cette version de { -app-name }.
userjs-pref-warning = Certains paramètres de { -app-name } ont été modifiés à l'aide d'une méthode non prise en charge. { -app-name } va les rétablir et redémarrer.
long-tag-fixer-window-title =
    .title = Scinder les marqueurs
long-tag-fixer-button-dont-split =
    .label = Ne pas scinder
