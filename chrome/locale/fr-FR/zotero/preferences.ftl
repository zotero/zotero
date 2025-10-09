preferences-window =
    .title = { -app-name } Paramètres
preferences-appearance-title = Apparence et langue
preferences-auto-recognize-files =
    .label = Récupérer automatiquement des métadonnées pour les PDFs et les livres numériques
preferences-file-renaming-title = Renommage des fichiers
preferences-file-renaming-intro = { -app-name } peut renommer automatiquement les fichiers à partir des informations de leur document parent (titre, auteur, etc.) et synchroniser les noms de fichiers à mesure que vous apportez des modifications. Initialement, les fichiers téléchargés sont toujours nommés en fonction de leur document parent.
preferences-file-renaming-auto-rename-files =
    .label = Renommer les fichiers automatiquement
preferences-file-renaming-file-types = Renommer les fichiers de ces types :
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
    .label = Personnaliser le format du nom de fichier...
preferences-file-renaming-rename-now =
    .label = Renommer les fichiers...
preferences-file-renaming-format-title = Format du nom de fichier
preferences-file-renaming-format-instructions = Vous pouvez personnaliser le modèle de nom de fichier utilisé par { -app-name } pour renommer les pièces jointes à partir des métadonnées parentes.
preferences-file-renaming-format-instructions-example = Par exemple, “{ $example }” sera remplacé dans ce modèle par le titre du document parent, tronqué à 50 caractères.
preferences-file-renaming-format-instructions-more = Consulter la <label data-l10n-name="file-renaming-format-help-link">documentation</label> pour plus d'information.
preferences-file-renaming-format-template = Modèle de nom de fichier :
preferences-file-renaming-format-preview = Aperçu :
preferences-reader-title = Lecteur
preferences-reader-open-epubs-using = Ouvrir les EPUBs avec
preferences-reader-open-snapshots-using = Ouvrir les captures avec
preferences-reader-open-in-new-window =
    .label = Ouvrir les fichiers dans une nouvelle fenêtre au lieu d'un onglet
preferences-reader-auto-disable-tool =
    .label = Désactiver les outils d'annotation de note, de texte et d'image après chaque utilisation
preferences-reader-ebook-font = Police de caractère des livres numériques :
preferences-reader-ebook-hyphenate =
    .label = Activer la césure automatique
preferences-color-scheme = Schéma de couleurs :
preferences-color-scheme-auto =
    .label = Automatique
preferences-color-scheme-light =
    .label = Lumineux
preferences-color-scheme-dark =
    .label = Sombre
preferences-item-pane-header = En-tête du panneau de document :
preferences-item-pane-header-style = Style de citation de l'en-tête :
preferences-item-pane-header-locale = Langue de l'en-tête :
preferences-item-pane-header-missing-style = Style manquant : <{ $shortName }>
preferences-locate-library-lookup-intro = La recherche dans la bibliothèque peut trouver une ressource en ligne avec le résolveur OpenURL de votre bibliothèque.
preferences-locate-resolver = Résolveur de liens :
preferences-locate-base-url = URL de base :
preferences-quickCopy-minus =
    .aria-label = { general-remove }
    .label = { $label }
preferences-quickCopy-plus =
    .aria-label = { general-add }
    .label = { $label }
preferences-styleManager-intro = { -app-name } peut générer des citations et des bibliographies dans plus de 10'000 styles de citation. Ajouter ici les styles afin qu'ils soient disponibles pour la sélection de styles dans { -app-name }.
preferences-styleManager-get-additional-styles =
    .label = Obtenir d'autres styles…
preferences-styleManager-restore-default =
    .label = Rétablir les styles par défaut...
preferences-styleManager-add-from-file =
    .tooltiptext = Ajouter un style à partir d'un fichier
    .label = Ajouter à partir d'un fichier
preferences-styleManager-remove = Appuyer sur { delete-or-backspace } pour supprimer ce style.
preferences-citation-dialog = Fenêtre de citation
preferences-citation-dialog-mode = Mode de la fenêtre de citation :
preferences-citation-dialog-mode-last-used =
    .label = La dernière utilisée
preferences-citation-dialog-mode-list =
    .label = Mode liste
preferences-citation-dialog-mode-library =
    .label = Mode bibliothèque
preferences-advanced-enable-local-api =
    .label = Autoriser d'autres applications sur cet ordinateur à communiquer avec { -app-name }
preferences-advanced-local-api-available = Disponible à l'adresse <code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = Le serveur HTTP { -app-name } est désactivé.
preferences-advanced-server-enable-and-restart =
    .label = Activer et redémarrer
preferences-advanced-language-and-region-title = Langue et zone géographique
preferences-advanced-enable-bidi-ui =
    .label = Activer les utilitaires d'édition de texte bidirectionnel
preferences-advanced-reset-data-dir =
    .label = Revenir à l'emplacement par défaut...
preferences-advanced-custom-data-dir =
    .label = Utiliser un emplacement personnalisé…
preferences-advanced-default-data-dir =
    .value = (Par défaut : { $directory })
    .aria-label = Emplacement par défaut
preferences-sync-reset-restore-to-server-body = { -app-name } remplacera “{ $libraryName }” sur { $domain } par les données de cet ordinateur.
preferences-sync-reset-restore-to-server-deleted-items-text =
    { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] document
       *[other] documents
    } dans la bibliothèque en ligne seront définitivement supprimés.
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] La bibliothèque sur cet ordinateur et la bibliothèque en ligne seront vides.
        [one] 1 document restera sur cet ordinateur et dans la bibliothèque en ligne.
       *[other] { $localItemsCount } documents resteront sur cet ordinateur et dans la bibliothèque en ligne.
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
        [one] Supprimer 1 document
        [many] Supprimer { $remoteItemsDeletedCount } documents
       *[other] Supprimer { $remoteItemsDeletedCount } documents
    }
preferences-sync-reset-restore-to-server-confirmation-text = Supprimer la bibliothèque en ligne
preferences-sync-reset-restore-to-server-yes = Remplacer les données dans la bibliothèque en ligne
