# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## File Menu

menu-file =
    .label = Fichier
    .accesskey = F
menu-file-new-tab =
    .label = Nouvel onglet
    .accesskey = T
menu-file-new-container-tab =
    .label = Nouvel onglet contextuel
    .accesskey = c
menu-file-new-window =
    .label = Nouvelle fenêtre
    .accesskey = u
menu-file-new-private-window =
    .label = Nouvelle fenêtre de navigation privée
    .accesskey = N
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Ouvrir l’emplacement…
menu-file-open-file =
    .label = Ouvrir un fichier…
    .accesskey = O
menu-file-close =
    .label = Fermer
    .accesskey = F
menu-file-close-window =
    .label = Fermer la fenêtre
    .accesskey = r
menu-file-save-page =
    .label = Enregistrer sous…
    .accesskey = E
menu-file-email-link =
    .label = Envoyer par courriel un lien vers la page…
    .accesskey = c
menu-file-print-setup =
    .label = Mise en page…
    .accesskey = M
menu-file-print-preview =
    .label = Aperçu avant impression
    .accesskey = v
menu-file-print =
    .label = Imprimer…
    .accesskey = p
menu-file-import-from-another-browser =
    .label = Importer depuis un autre navigateur…
    .accesskey = I
menu-file-go-offline =
    .label = Travailler hors connexion
    .accesskey = x

## Edit Menu

menu-edit =
    .label = Édition
    .accesskey = n
menu-edit-find-on =
    .label = Rechercher dans la page…
    .accesskey = h
menu-edit-find-again =
    .label = Rechercher le suivant
    .accesskey = v
menu-edit-bidi-switch-text-direction =
    .label = Changer le sens du texte
    .accesskey = x

## View Menu

menu-view =
    .label = Affichage
    .accesskey = A
menu-view-toolbars-menu =
    .label = Barres d’outils
    .accesskey = T
menu-view-customize-toolbar =
    .label = Personnaliser…
    .accesskey = P
menu-view-sidebar =
    .label = Panneau latéral
    .accesskey = e
menu-view-bookmarks =
    .label = Marque-pages
menu-view-history-button =
    .label = Historique
menu-view-synced-tabs-sidebar =
    .label = Onglets synchronisés
menu-view-full-zoom =
    .label = Zoom
    .accesskey = Z
menu-view-full-zoom-enlarge =
    .label = Zoom avant
    .accesskey = v
menu-view-full-zoom-reduce =
    .label = Zoom arrière
    .accesskey = r
menu-view-full-zoom-actual-size =
    .label = Taille réelle
    .accesskey = T
menu-view-full-zoom-toggle =
    .label = Zoom texte seulement
    .accesskey = x
menu-view-page-style-menu =
    .label = Style de la page
    .accesskey = y
menu-view-page-style-no-style =
    .label = Aucun style
    .accesskey = n
menu-view-page-basic-style =
    .label = Style de base de la page
    .accesskey = b
menu-view-charset =
    .label = Encodage du texte
    .accesskey = E

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = Passer en mode Plein écran
    .accesskey = P
menu-view-exit-full-screen =
    .label = Quitter le mode Plein écran
    .accesskey = P
menu-view-full-screen =
    .label = Plein écran
    .accesskey = P

##

menu-view-show-all-tabs =
    .label = Afficher tous les onglets
    .accesskey = A
menu-view-bidi-switch-page-direction =
    .label = Changer le sens de la page
    .accesskey = g

## History Menu

menu-history =
    .label = Historique
    .accesskey = H
menu-history-show-all-history =
    .label = Afficher l’historique
menu-history-clear-recent-history =
    .label = Supprimer l’historique récent…
menu-history-synced-tabs =
    .label = Onglets synchronisés
menu-history-restore-last-session =
    .label = Restaurer la session précédente
menu-history-hidden-tabs =
    .label = Onglets masqués
menu-history-undo-menu =
    .label = Onglets récemment fermés
menu-history-undo-window-menu =
    .label = Fenêtres récemment fermées

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Marque-pages
    .accesskey = M
menu-bookmarks-show-all =
    .label = Afficher tous les marque-pages
menu-bookmark-this-page =
    .label = Marquer cette page
menu-bookmark-edit =
    .label = Modifier ce marque-page
menu-bookmarks-all-tabs =
    .label = Marquer tous les onglets…
menu-bookmarks-toolbar =
    .label = Barre personnelle
menu-bookmarks-other =
    .label = Autres marque-pages
menu-bookmarks-mobile =
    .label = Marque-pages des appareils mobiles

## Tools Menu

menu-tools =
    .label = Outils
    .accesskey = O
menu-tools-downloads =
    .label = Téléchargements
    .accesskey = T
menu-tools-addons =
    .label = Modules complémentaires
    .accesskey = e
menu-tools-fxa-sign-in =
    .label = Se connecter à { -brand-product-name }…
    .accesskey = e
menu-tools-turn-on-sync =
    .label = Activer { -sync-brand-short-name }…
    .accesskey = n
menu-tools-sync-now =
    .label = Synchroniser maintenant
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Se reconnecter à { -brand-product-name }…
    .accesskey = r
menu-tools-web-developer =
    .label = Développement web
    .accesskey = W
menu-tools-page-source =
    .label = Code source de la page
    .accesskey = C
menu-tools-page-info =
    .label = Informations sur la page
    .accesskey = I
menu-preferences =
    .label =
        { PLATFORM() ->
            [windows] Options
           *[other] Préférences
        }
    .accesskey =
        { PLATFORM() ->
            [windows] O
           *[other] f
        }
menu-tools-layout-debugger =
    .label = Débogueur de mise en page
    .accesskey = m

## Window Menu

menu-window-menu =
    .label = Fenêtre
menu-window-bring-all-to-front =
    .label = Tout amener à l’avant-plan

## Help Menu

menu-help =
    .label = Aide
    .accesskey = e
menu-help-product =
    .label = Aide de { -brand-shorter-name }
    .accesskey = A
menu-help-show-tour =
    .label = Visite guidée de { -brand-shorter-name }
    .accesskey = V
menu-help-import-from-another-browser =
    .label = Importer depuis un autre navigateur…
    .accesskey = I
menu-help-keyboard-shortcuts =
    .label = Raccourcis clavier
    .accesskey = o
menu-help-troubleshooting-info =
    .label = Informations de dépannage
    .accesskey = I
menu-help-feedback-page =
    .label = Donner votre avis…
    .accesskey = D
menu-help-safe-mode-without-addons =
    .label = Redémarrer avec les modules désactivés…
    .accesskey = R
menu-help-safe-mode-with-addons =
    .label = Redémarrer avec les modules activés…
    .accesskey = R
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Signaler un site trompeur…
    .accesskey = t
menu-help-not-deceptive =
    .label = Ce site n’est pas trompeur…
    .accesskey = C
