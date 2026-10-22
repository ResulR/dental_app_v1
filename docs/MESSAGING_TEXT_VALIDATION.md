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

Ces scénarios ne sont pas encore exécutés. Les conversations par commande/retouche, leur fermeture et les éditions/masquages requièrent leurs propres scénarios additionnels avant réception du chapitre 13.
