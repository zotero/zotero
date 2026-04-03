preferences-window =
    .title = { -app-name } Paramètres
preferences-appearance-title = Apparence et langue
preferences-auto-recognize-files =
    .label = Récupérer automatiquement des métadonnées pour les PDFs et les livres numériques
preferences-file-renaming-title = Renommage des fichiers
preferences-file-renaming-intro = { -app-name } peut renommer automatiquement les fichiers à partir des informations de leur document parent (titre, auteur, etc.) et synchroniser les noms de fichiers à mesure que vous apportez des modifications. Initialement, les fichiers téléchargés sont toujours nommés en fonction de leur document parent.
preferences-file-renaming-configure-button =
    .label = Configurer le renommage des fichiers...
preferences-attachment-titles-title = Titres de pièces jointes
preferences-attachment-titles-intro = Les titres de pièces jointes <label data-l10n-name="wiki-link">sont différents des noms de fichiers</label>. Pour prendre en charge certains flux de travail, { -app-name } peut afficher les noms de fichiers au lieu des titres de pièces jointes dans la liste des documents.
preferences-attachment-titles-show-filenames =
    .label = Afficher les noms de fichiers des pièces jointes dans la liste des documents
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
preferences-note-title = Notes
preferences-note-open-in-new-window =
    .label = Ouvrir les notes dans de nouvelles fenêtres plutôt que dans des onglets
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
-preferences-sync-data-syncing = Synchronisation des données
preferences-sync-data-syncing-groupbox =
    .aria-label = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-heading = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-description = Connectez-vous avec votre compte { -app-name } pour synchroniser vos données entre vos appareils, collaborer avec d'autres personnes, et bien plus encore.
preferences-account-log-out =
    .label = Se déconnecter...
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
preferences-account-log-in =
    .label = Se connecter
preferences-account-waiting-for-login =
    .value = En attente de connexion…
preferences-account-cancel-button =
    .label = { general-cancel }
preferences-account-logged-out-status =
    .value = (déconnecté)
preferences-account-email-label =
    .value = Courriel :
preferences-account-switch-accounts =
    .label = Changer de compte...
preferences-account-switch-text = Le passage à un autre compte entraînera la suppression de toutes les données de { -app-name } sur cet ordinateur. Avant de continuer, assurez-vous que toutes les données et tous les fichiers que vous souhaitez conserver ont été synchronisés avec le compte "{ $username }" ou que vous disposez d'une sauvegarde du répertoire de données de { -app-name }.
preferences-account-switch-confirmation-text = supprimer les données locales
preferences-account-switch-accept = Supprimer les données et redémarrer
