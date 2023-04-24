# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = Préférences
menu-application-services =
    .label = Services
menu-application-hide-this =
    .label = Masquer { -brand-shorter-name }
menu-application-hide-other =
    .label = Masquer les autres
menu-application-show-all =
    .label = Tout afficher
menu-application-touch-bar =
    .label = Personnaliser la Touch Bar…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] Quitter
           *[other] Quitter
        }
    .accesskey =
        { PLATFORM() ->
            [windows] Q
           *[other] Q
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = Quitter { -brand-shorter-name }
menu-about =
    .label = À propos de { -brand-shorter-name }
    .accesskey = p

## File Menu

menu-file =
    .label = Fichier
    .accesskey = F
menu-file-new-tab =
    .label = Nouvel onglet
    .accesskey = T
menu-file-new-container-tab =
    .label = Nouvel onglet conteneur
    .accesskey = c
menu-file-new-window =
    .label = Nouvelle fenêtre
    .accesskey = u
menu-file-new-private-window =
    .label = Nouvelle fenêtre privée
    .accesskey = N
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = Ouvrir l’emplacement…
menu-file-open-file =
    .label = Ouvrir un fichier…
    .accesskey = O
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] Fermer l’onglet
           *[other] Fermer { $tabCount } onglets
        }
    .accesskey = F
menu-file-close-window =
    .label = Fermer la fenêtre
    .accesskey = r
menu-file-save-page =
    .label = Enregistrer sous…
    .accesskey = E
menu-file-email-link =
    .label = Envoyer par e-mail un lien vers la page…
    .accesskey = m
menu-file-share-url =
    .label = Partager
    .accesskey = P
menu-file-print-setup =
    .label = Mise en page…
    .accesskey = M
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
menu-edit-find-in-page =
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
menu-view-customize-toolbar2 =
    .label = Personnaliser la barre d’outils…
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
menu-view-repair-text-encoding =
    .label = Réparer l’encodage du texte
    .accesskey = c

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

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = Passer en mode lecture
    .accesskey = r
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = Quitter le mode lecture
    .accesskey = r

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
menu-history-reopen-all-tabs = Rouvrir tous les onglets
menu-history-reopen-all-windows = Rouvrir toutes les fenêtres

## Bookmarks Menu

menu-bookmarks-menu =
    .label = Marque-pages
    .accesskey = M
menu-bookmarks-manage =
    .label = Organiser les marque-pages
menu-bookmark-current-tab =
    .label = Marquer l’onglet courant
menu-bookmark-edit =
    .label = Modifier ce marque-page
menu-bookmark-tab =
    .label = Marquer l’onglet courant…
menu-edit-bookmark =
    .label = Modifier ce marque-page…
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
menu-tools-addons-and-themes =
    .label = Extensions et thèmes
    .accesskey = x
menu-tools-fxa-sign-in2 =
    .label = Connexion
    .accesskey = C
menu-tools-turn-on-sync2 =
    .label = Activer la synchronisation…
    .accesskey = n
menu-tools-sync-now =
    .label = Synchroniser maintenant
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = Se reconnecter à { -brand-product-name }…
    .accesskey = r
menu-tools-browser-tools =
    .label = Outils du navigateur
    .accesskey = n
menu-tools-task-manager =
    .label = Gestionnaire de tâches
    .accesskey = t
menu-tools-page-source =
    .label = Code source de la page
    .accesskey = C
menu-tools-page-info =
    .label = Informations sur la page
    .accesskey = I
menu-settings =
    .label = Paramètres
    .accesskey =
        { PLATFORM() ->
            [windows] a
           *[other] a
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


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = Aide
    .accesskey = e
menu-get-help =
    .label = Obtenir de l’aide
    .accesskey = O
menu-help-more-troubleshooting-info =
    .label = Plus d’informations de dépannage
    .accesskey = t
menu-help-report-site-issue =
    .label = Signaler un problème sur ce site…
menu-help-share-ideas =
    .label = Partager des idées et des commentaires…
    .accesskey = P
menu-help-enter-troubleshoot-mode2 =
    .label = Mode de dépannage…
    .accesskey = M
menu-help-exit-troubleshoot-mode =
    .label = Désactiver le mode de dépannage
    .accesskey = m
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = Signaler un site trompeur…
    .accesskey = t
menu-help-not-deceptive =
    .label = Ce site n’est pas trompeur…
    .accesskey = C
