integration-docPrefs-window =
    .title = { -app-name } - Préférences du document
integration-addEditCitation-window =
    .title = { -app-name } - Ajouter/Modifier la citation
integration-editBibliography-window =
    .title = { -app-name } - Modifier la bibliographie
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Modifier la référence
-integration-editBibliography-include-uncited = Pour intégrer dans votre bibliographie un document non cité, sélectionnez-le depuis la liste des documents et cliquez sur { general-add }.
-integration-editBibliography-exclude-cited = Vous pouvez également exclure un document cité en le sélectionnant depuis la liste des documents et en cliquant sur { general-remove }.
-integration-editBibliography-edit-reference = Pour modifier la mise en forme d'une référence, utilisez l'éditeur de texte.
integration-editBibliography-wrapper =
    .aria-label = Fenêtre d'édition de la bibliographie
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Fenêtre de citation
integration-citationDialog-section-open = Documents ouverts : ({ $count })
integration-citationDialog-section-selected = Documents sélectionnés : ({ $count }/{ $total })
integration-citationDialog-section-cited =
    { $count ->
        [0] documents cités
       *[other] documents cités ({ $count })
    }
integration-citationDialog-details-suffix = Suffixe
integration-citationDialog-details-prefix = Préfixe
integration-citationDialog-details-suppressAuthor = Ignorer l'auteur
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Paramètres de citation
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] Aucun document sélectionné, ouvert ou cité ne correspond à la recherche actuelle
       *[other] Aucun document sélectionné ou ouvert
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] Aucune note sélectionnée ne correspond à la recherche actuelle
       *[other] Aucune note n'est sélectionnée
    }
integration-citationDialog-settings-keepSorted = Trier les sources automatiquement
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = Bibliothèque
integration-citationDialog-mode-list = Liste
integration-citationDialog-btn-type-citation =
    .title = Ajouter/Modifier la citation
integration-citationDialog-btn-type-add-note =
    .title = Ajouter une note
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Utiliser les flèches de direction gauche/droite pour parcourir les documents de cette citation. Appuyer sur Tab pour sélectionner les documents à ajouter à cette citation.
integration-citationDialog-enter-to-add-item = Appuyer sur { return-or-enter } pour ajouter ce document à la citation.
integration-citationDialog-search-for-items = Rechercher des documents à ajouter à la citation
integration-citationDialog-aria-bubble =
    .aria-description = Ce document est inclus dans la citation. Appuyer sur la barre d'espace pour personnaliser ce document. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Appuyer sur Tab pour sélectionner les documents à ajouter à cette citation. Appuyer sur Échap pour ignorer les changements et fermer la fenêtre.
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Rechercher une note à insérer dans le document
integration-citationDialog-aria-item-list =
    .aria-description = Utiliser les flèches de direction haut/bas pour modifier la sélection de documents. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Utiliser les flèches de direction gauche/droite pour modifier la sélection de documents. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Collections.
    .aria-description = Sélectionner une collection et appuyer sur Tab pour parcourir ses documents.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = Ce document a été ajouté à la citation. Appuyer sur { return-or-enter } pour l'ajouter à nouveau ou sur { delete-or-backspace } pour le retirer.
integration-citationDialog-add-all = Ajouter tout
integration-citationDialog-collapse-section =
    .title = Réduire la section
integration-citationDialog-bubble-empty = (sans titre)
integration-citationDialog-add-to-citation = Ajouter à la citation
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
integration-error-unable-to-find-winword = { -app-name } n'a pas trouvé d'instance de Word en cours d'exécution.
integration-warning-citation-changes-will-be-lost = Certaines des modifications que vous avez apportées à une citation seront perdues si vous continuez.
integration-warning-bibliography-changes-will-be-lost = Certaines des modifications que vous avez apportées à la bibliographie seront perdues si vous continuez.
integration-warning-documentPreferences-changes-will-be-lost = Certaines des modifications que vous avez apportées aux préférence du document seront perdues si vous continuez.
integration-warning-discard-changes = Ignorer les modifications
integration-warning-command-is-running = Une commande de l'intégration de traitement de texte est déjà en cours d'exécution.
first-run-guidance-citationDialog =
    Type a title, author, and/or year to search for a reference.
    
    After you’ve made your selection, click the bubble or select it via the keyboard and press ↓/Space to show citation options such as page number, prefix, and suffix.
    
    You can also add a page number or other locator by including it with your search terms (e.g., “history { $locator }”) or by typing it after the bubble and pressing { return-or-enter }.
