# Messagerie textuelle — proposition de recette isolée v6

Statut : préparation statique, non autorisée et non exécutée. Aucun cluster ni image v1–v5 ne doit être réutilisé. Cette proposition décrit les assertions et la séquence ; le runner, sa fixture et ses empreintes seront figés et revus avant toute demande d'autorisation d'exécution. Elle ne vaut pas une preuve PostgreSQL.

## Dépendances et isolement

- Cluster PostgreSQL 17 neuf dans un répertoire v6 distinct sous `/srv/dental-lab/.local/`, permissions 0700, socket Unix privé et port distinct de la production/v5, `listen_addresses=''`, HBA local fermé sauf rôle de fixture, aucun TCP ; identité du cluster vérifiée depuis chaque connexion. Pas de reprise des données de production.
- Cgroup Remote inchangé (CPU 50 %, mémoire 1 Gio, 100 tâches) ; appliquer les seuils disque, mémoire et tâches, délais et limites PostgreSQL au moins aussi stricts que la recette v5. Arrêt via pièges EXIT/INT/TERM même sur erreur ; échec si PID, socket ou montage résiduel. Conserver logs, empreintes, services et sockets avant/après sans nettoyage des tentatives historiques.
- Fixture synthétique : appliquer dans l'ordre 0002–0013 (schéma et rôle applicatif) puis 0023. La migration 0023 est testée sur une conversation ancienne avec zéro/un/deux marqueurs : les marqueurs absents valent zéro, le marqueur existant non nul reste identique. Vérifier les reçus réels avant toute proposition d'application ailleurs. Aucun 0022 n'est requis pour la messagerie ; aucune migration de production.

## Assertions PostgreSQL à automatiser dans la fixture v6

1. Deux cliniques, une conversation générale chacune, une commande et une retouche distinctes ; comptes et sessions laboratoire avec droits général seul, commande seule et deux droits. Lecture de la liste, messages, recherche et historique par UUID connu : 403/refus entre cliniques et selon les droits. Après retrait de droit/suspension, une opération déjà concurrente ne doit pas divulguer de contenu.
2. Envoi avec la même clé et même payload deux fois : un message, une séquence, une version et un événement ; clé identique avec payload différent : conflit. Deux envois concurrents et 51+ messages : séquences strictement croissantes, pagination arrière/avant sans trou ni doublon, sous arrivée d'un nouveau message.
3. Deux sessions du même côté marquent des lectures concurrentes à des séquences différentes : curseur monotone et reçu idempotent. Envoi pendant lecture : aucun accusé pour une séquence non incluse. Compteurs uniquement des messages de l'autre côté après le marqueur ; un marqueur manquant est une indisponibilité, jamais une lecture supposée.
4. Deux éditions concurrentes à la même révision, édition contre masquage, édition contre livraison : une seule version gagnante, historique auteur seulement, refus des autres comptes et aucun audit/outbox de succès après rollback injecté. Contrôle des privilèges du rôle applicatif et des références historiques.
5. Livraison ferme seulement la conversation de la commande visée ; retouche et conversation générale restent indépendantes. Envoi/édition interdits pendant fermeture ; correction de livraison autorisée réouvre la conversation sans perdre versions ni lectures antérieures.
6. Recherche, tri, filtres non-lus et pagination de la boîte laboratoire après insertion concurrente ; revalidation de chaque détail et de chaque résultat sous retrait de grant. Le résultat de liste ne confère aucun droit futur.

Comparer les états avant/après des services PostgreSQL de production, Nginx et Dental, PID, sockets et accessibilité. Toute discordance, timeout, assertion manquante ou erreur inattendue arrête la recette ; conserver image et preuves. Aucun lancement avant nouvelle autorisation explicite sur un bundle figé avec SHA-256.

## Réception navigateur à exécuter séparément

- Mobile étroit et desktop : clinique A/B et deux sessions laboratoire ; navigation générale, commande et retouche, filtres et badges. Vérifier qu'une notification lue ou un message reçu hors écran ne marque rien Lu.
- Ouvrir réellement les messages visibles, défiler les pages anciennes ; comparer Envoyé/Lu et non-lus dans les deux sessions. Retirer un droit au laboratoire pendant affichage, attendre la revalidation et vérifier disparition du contenu et de l'historique.
- Couper/rétablir le réseau puis produire 51, 251 et 551 messages entre deux consultations ; l'interface doit indiquer la synchronisation en cours jusqu'à la fin, sans trou, doublon ni faux accusé. Essayer la même clé après une réponse incertaine et vérifier le reçu.
- Éditer et masquer depuis l'auteur, ouvrir plus de 50 versions, tenter depuis l'autre auteur, puis fermer/réouvrir la conversation via la livraison corrigée. Vérifier erreurs et clavier mobile. Aucun de ces parcours navigateur n'est déclaré exécuté.
