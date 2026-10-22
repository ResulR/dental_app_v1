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

Ces scénarios ne sont pas encore exécutés. Édition/masquage, fichiers, navigation navigateur et recette PostgreSQL complète restent à recevoir avant clôture du chapitre 13.
