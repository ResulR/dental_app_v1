# Messagerie textuelle — validations à recevoir séparément

Le code des conversations générales reste derrière un drapeau fermé. Cette note n'autorise ni migration ni lancement PostgreSQL. La migration proposée 0023 initialise uniquement les deux marqueurs manquants à zéro ; elle ne reconstitue aucune lecture historique. Son application et son reçu doivent être décidés séparément, après comparaison des migrations déjà reçues.

## PostgreSQL 17 isolé, nouvelle autorisation nécessaire

- Contrôler sur un cluster isolé neuf la migration 0023 après les migrations réellement requises : conversation ancienne avec messages, zéro/un/deux marqueurs, marqueur non nul préexistant ; vérifier que seuls les absents sont ajoutés à zéro et que l'existant est inchangé. Échec/rollback sans état partiel.
- Deux sessions du même côté marquent des séquences différentes en concurrence ; le curseur ne recule jamais. Un envoi concurrent et une lecture ne créent ni faux accusé ni conflit de verrou non résolu. Tester révocation de permission et suspension pendant l'opération.
- Tester 0, 1, 50, 51 et plus de 250 messages ; pagination arrière et avant sans trou/doublon après reconnexion et envois concurrents. Compter seulement les messages de l'autre côté après le curseur ; deux cliniques ne partagent jamais contenu, compteurs ou reçu.
- Vérifier les privilèges du rôle applicatif, l'immutabilité des versions et la transaction complète des messages. Conserver les journaux et preuves, comparer services/processus/sockets avant-après, arrêter le cluster isolé. Aucune recette v5 rejouée.

## Navigateur à recevoir

- Deux sessions clinique/laboratoire et deux sessions laboratoire : ouvrir une conversation dans un onglet visible, faire défiler les messages réellement visibles, contrôler Envoyé/Lu partagé et non-lus ; ne pas marquer un message hors écran, un onglet masqué ou une page avec un trou non chargé.
- Débrancher/rebrancher le réseau et suspendre/reprendre l'onglet ; plus de 50 messages manqués doivent être rattrapés dans l'ordre, sans doublons. Vérifier délai de rafraîchissement, erreurs puis récupération et absence de faux succès après réponse incertaine.
- Mobile et desktop : long message, pagination, chargement, clavier, lecture d'écran et état de reconnexion. Vérifier le cas sans IntersectionObserver : aucun accusé automatique non vérifiable.

## Conversation de commande et retouche

- Avec deux cliniques et un membre du laboratoire muni seulement de `messaging.general.read`, puis de `messaging.order.read`, vérifier la recherche par identifiant de commande, les refus croisés et la lecture via la liste et la fiche. Une retouche doit utiliser sa propre conversation, jamais celle de sa source.
- Envois concurrents et répétition de clé : une séquence unique, un seul reçu, aucun doublon. Refuser les fichiers et le corps absent, puis vérifier la fermeture à la livraison et le refus d'un nouvel envoi ; après correction de livraison autorisée, confirmer la réouverture sans mélanger le contenu.
- Deux sessions sur chaque côté : accusés collectifs, changement de permissions/suspension, pagination et rattrapage après 51+ messages ; comparer l'état des conversations et marqueurs sous PostgreSQL réel. Vérifier le comportement de l'interface en mobile et desktop.
- La route et l'interface de commande ont un drapeau distinct, fermé par défaut et dépendant du drapeau général côté API. Vérifier les deux configurations avant toute activation.

Ces scénarios ne sont pas encore exécutés. L'édition et le masquage textuels sont intégrés côté code mais leurs recettes PostgreSQL et navigateur, ainsi que les fichiers, restent à recevoir avant clôture du chapitre 13.

## Édition et masquage (13.6)

- Sur conversations générale, commande et retouche, ouvrir deux sessions d'un même auteur puis tenter deux éditions à la même révision : une seule version supplémentaire et un seul événement/audit doivent être persistés. Refaire avec édition contre masquage et livraison concurrente : fermeture interdit toute mutation, sans version orpheline.
- Vérifier qu'un autre compte du même côté, un laboratoire sans droit de réponse et une clinique étrangère ne peuvent ni modifier ni lire l'historique d'auteur, y compris par UUID connu. La lecture de conversation ordinaire doit afficher uniquement la version courante ou « Mesazh i fshehur ».
- Comparer les versions, la version courante, la révision, les événements et l'audit après refus, rollback injecté et réponse réseau incertaine. Le contenu des anciennes versions ne doit pas figurer dans l'audit/outbox.
- Tester plus de 50 versions avec pagination, accès mobile/desktop, confirmation de masquage, erreur/reconnexion et rafraîchissement entre sessions. Aucun fichier ni message déjà clos ne peut être édité par ces routes textuelles.

Ces vérifications PostgreSQL réelles et navigateur ne sont pas exécutées ; la présence des tests unitaires avec doubles ne les remplace pas.

## Boîte de réception laboratoire (13.8)

- PostgreSQL réel : créer conversations générales et liées à deux cliniques, dont une retouche, avec marqueurs présents puis absents ; comparer le filtre non-lus, recherche clinique/numéro, tri et pagination sous arrivée concurrente de messages. Aucun marqueur manquant ne doit être interprété comme une lecture.
- Retirer successivement les droits de lecture générale puis commande, renouveler les sessions, interroger la liste et les détails par identifiant connu : aucune conversation interdite ni contenu conservé à l'écran après refus. Vérifier la clinique sans accès à la boîte laboratoire.
- Navigateur mobile/desktop : filtres, pagination, ouverture/retour, état hors connexion, reprise multi-session et visibilité des badges après lecture effective. Les scénarios ne sont pas exécutés et ne valent pas réception de 13.8.
