reader-annotations = Annotations
reader-show-annotations = Afficher les annotations
reader-search-annotations = Chercher dans les annotations
reader-search-outline = Chercher dans la table des matières
reader-no-annotations = Créer une annotation pour la voir dans la barre latérale
reader-no-extracted-text = Aucun texte extrait
reader-add-comment = Ajouter un commentaire
reader-annotation-comment = Commentaire d'annotation
reader-annotation-text = Texte d'annotation
reader-manage-tags = Gérer les marqueurs pour cette annotation
reader-open-menu = Ouvrir le menu d'annotation
reader-thumbnails = Vignettes
reader-tag-selector-message = Filtrer les annotations par ce marqueur
reader-add-tags = Ajouter des marqueurs...
reader-highlight-text = Surligner le texte
reader-underline-text = Souligner le texte
reader-add-note = Ajouter une note
reader-add-text = Ajouter du texte
reader-select-area = Sélectionner une zone
reader-highlight-annotation = Surligner l'annotation
reader-underline-annotation = Souligner l'annotation
reader-note-annotation = Annotation de type note
reader-text-annotation = Annotation de type texte
reader-image-annotation = Annotation de type image
reader-ink-annotation = Annotation manuscrite
reader-search-result-index = Résultat de recherche
reader-search-result-total = Tous les résultats de recherche
reader-draw = Dessiner
reader-eraser = Gomme
reader-pick-color = Choisir une couleur
reader-add-to-note = Ajouter à la note
reader-zoom-in = Zoomer
reader-zoom-out = Dézoomer
reader-zoom-reset = Réinitialiser le zoom
reader-zoom-auto = Zoom automatique
reader-zoom-page-width = Pleine largeur
reader-zoom-page-height = Pleine hauteur
reader-split-vertically = Diviser verticalement
reader-split-horizontally = Diviser horizontalement
reader-next-page = Page suivante
reader-previous-page = Page précédente
reader-page = Page
reader-location = Localisation
reader-read-only = Lecture-seule
reader-prompt-transfer-from-pdf-title = Importer les annotations
reader-prompt-transfer-from-pdf-text = Les annotations stockées dans le fichier PDF seront déplacées vers { $target }.
reader-prompt-password-protected = Cette opération n'est pas prise en charge pour les fichiers PDF protégés par un mot de passe.
reader-prompt-delete-pages-title = Supprimer les pages
reader-prompt-delete-pages-text =
    { $count ->
        [one] Voulez-vous vraiment supprimer { $count } page du fichier PDF ?
        [many] Voulez-vous vraiment supprimer { $count } pages du fichier PDF ?
       *[other] Voulez-vous vraiment supprimer { $count } pages du fichier PDF ?
    }
reader-prompt-delete-annotations-title = Supprimer les annotations
reader-prompt-delete-annotations-text =
    { $count ->
        [one] Voulez-vous vraiment supprimer l'annotation sélectionnée ?
        [many] Voulez-vous vraiment supprimer les annotations sélectionnées ?
       *[other] Voulez-vous vraiment supprimer les annotations sélectionnées ?
    }
reader-rotate-left = Rotation antihoraire
reader-rotate-right = Rotation horaire
reader-edit-page-number = Modifier le numéro de page...
reader-edit-annotation-text = Modifier le texte de l'annotation
reader-copy-image = Copier l'image
reader-save-image-as = Enregistrer l'image sous...
reader-page-number-popup-header = Changer le numéro de page en :
reader-this-annotation = Cette annotation
reader-selected-annotations = Les annotations sélectionnées
reader-this-page = Cette page
reader-this-page-and-later-pages = Cette page et les suivantes
reader-all-pages = Toutes les pages
reader-auto-detect = Détection automatique
reader-enter-password = Saisir le mot de passe pour ouvrir ce fichier PDF
reader-include-annotations = Inclure les annotations
reader-preparing-document-for-printing = Préparation du document pour l'impression...
reader-phrase-not-found = Expression non trouvée
reader-find = Rechercher
reader-close = Fermer
reader-show-thumbnails = Afficher les vignettes
reader-show-outline = Afficher la table des matières
reader-find-previous = Trouver l'occurrence précédente de l'expression
reader-find-next = Trouver l'occurrence suivante de l'expression
reader-toggle-sidebar = Afficher/masquer la barre latérale
reader-find-in-document = Rechercher dans le document
reader-toggle-context-pane = Masquer/afficher le panneau de contexte
reader-highlight-all = Tout surligner
reader-match-case = Respecter la casse
reader-whole-words = Mots entiers
reader-appearance = Apparence
reader-epub-appearance-line-height = Hauteur de ligne
reader-epub-appearance-word-spacing = Espacement des mots
reader-epub-appearance-letter-spacing = Espacement des lettres
reader-epub-appearance-page-width = Largeur de page
reader-epub-appearance-use-original-font = Utiliser la police d'origine
reader-epub-appearance-line-height-revert = Utiliser la hauteur de ligne par défaut
reader-epub-appearance-word-spacing-revert = Utiliser l'espacement des mots par défaut
reader-epub-appearance-letter-spacing-revert = Utiliser l'espacement des lettres par défaut
reader-epub-appearance-page-width-revert = Utiliser la largeur de page par défaut
reader-convert-to-highlight = Convertir en surlignement
reader-convert-to-underline = Convertir en soulignement
reader-size = Taille
reader-merge = Fusionner
reader-copy-link = Copier le lien
reader-theme-original = Original
reader-theme-snow = Snow
reader-theme-sepia = Sépia
reader-theme-dark = Sombre
reader-add-theme = Ajouter un thème
reader-scroll-mode = Défilement
reader-spread-mode = Double affichage
reader-flow-mode = Mise en page de la page
reader-columns = Colonnes
reader-split-view = Scinder l'affichage
reader-themes = Thèmes
reader-vertical = Vertical
reader-horizontal = Horizontal
reader-wrapped = Par bloc
reader-none = Aucun
reader-odd = Pair
reader-even = Impair
reader-paginated = Paginé
reader-scrolled = Affiché en défilement
reader-single = Simple
reader-double = Double
reader-theme-name = Nom du thème :
reader-background = Arrière-plan :
reader-foreground = Avant-plan :
reader-focus-mode = Mode sans distraction
reader-clear-selection = Effacer la sélection
reader-move-annotation-start-key =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-alt }
    }
reader-a11y-move-annotation = Utiliser les touches de direction pour déplacer l'annotation.
reader-a11y-edit-text-annotation = Pour déplacer la fin de l'annotation de type texte, maintenir la touche { general-key-shift } enfoncée et utiliser les touches de direction gauche/droite. Pour déplacer le début de l'annotation, maintenir les touches { general-key-shift }-{ reader-move-annotation-start-key } enfoncées et utiliser les touches de direction.
reader-a11y-resize-annotation = Pour redimensionner cette annotation, maintenir la touche { general-key-shift } enfoncée et utiliser les touches de direction.
reader-a11y-annotation-popup-appeared = Utiliser la touche Tab pour naviguer dans le menu contextuel d'annotation.
reader-a11y-annotation-created = { $type } créé(e).
reader-a11y-annotation-selected = { $type } sélectionné(e).
-reader-a11y-textual-annotation-instruction = Pour annoter du texte au clavier, utiliser “{ reader-find-in-document }” pour localiser l'expression, puis appuyer sur { general-key-control }-{ option-or-alt }-{ $number } pour convertir le résultat de recherche en annotation.
-reader-a11y-annotation-instruction = Pour ajouter cette annotation au document, placer le curseur dans le document et appuyer sur { general-key-control }-{ option-or-alt }-{ $number }.
reader-toolbar-highlight =
    .aria-description = { -reader-a11y-textual-annotation-instruction(number: 1) }
    .title = { reader-highlight-text }
reader-toolbar-underline =
    .aria-description = { -reader-a11y-textual-annotation-instruction(number: 2) }
    .title = { reader-underline-text }
reader-toolbar-note =
    .aria-description = { -reader-a11y-annotation-instruction(number: 3) }
    .title = { reader-note-annotation }
reader-toolbar-text =
    .aria-description = { -reader-a11y-annotation-instruction(number: 4) }
    .title = { reader-add-text }
reader-toolbar-area =
    .aria-description = { -reader-a11y-annotation-instruction(number: 5) }
    .title = { reader-select-area }
reader-toolbar-draw =
    .aria-description = Ce type d'annotation ne peut pas être créé au clavier.
    .title = { reader-draw }
reader-find-in-document-input =
    .title = Rechercher
    .placeholder = { reader-find-in-document }
    .aria-description = Pour transformer le résultat de recherche en surlignement, appuyer sur { general-key-control }-{ option-or-alt }-1. Pour transformer le résultat de recherche en soulignement, appuyer sur { general-key-control }-{ option-or-alt }-2.
reader-import-from-epub =
    .label = Importer les annotations du livre numérique…
reader-import-from-epub-prompt-title = Importer les annotations du livre numérique
reader-import-from-epub-prompt-text =
    { -app-name } a trouvé { $count ->
        [one] { $count } annotation de { $tool }
       *[other] { $count } annotations de { $tool }
    }, dernière modification { $lastModifiedRelative }.
    
    Toutes les annotations { -app-name } précédemment importées de ce livre numérique seront mises à jour.
reader-import-from-epub-no-annotations-current-file =
    Ce livre numérique ne semble pas contenir d'annotations importables.
    
    { -app-name } peut importer les annotations de livre numérique créées dans Calibre et KOReader.
reader-import-from-epub-no-annotations-other-file =
    “{ $filename }” ne semble pas contenir d'annotations Calibre ou KOReader.
    
    Si ce livre numérique a été annoté avec KOReader, essayer de sélectionner directement un fichier “metadata.epub.lua”.
reader-import-from-epub-select-other = Sélectionner un autre fichier…
