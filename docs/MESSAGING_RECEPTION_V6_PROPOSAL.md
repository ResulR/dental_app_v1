# Messagerie textuelle — bundle PostgreSQL v6 (préparé, non exécuté)

**Aucune autorisation d'exécution n'est implicite.** Les fichiers du bundle sont `tests/postgres/messaging-v6-fixture.sql`, `messaging-v6.mjs`, `run-messaging-v6.sh` et `messaging-v6.sha256`. Le manifeste fige également `package-lock.json`, les migrations 0002–0013 et 0023 et les 222 modules JS compilés API/contrats. Aucun artefact v1–v5 n'est modifié ou réutilisé.

## Isolation et arrêt

Le runner exige l'hôte `vps-28bf7789`, UID 1002, le cgroup exact Remote (CPU 50 %, mémoire 1 Gio, 100 tâches), au moins 24 tâches et 448 Mio de mémoire non-cache libres, 1 Gio sur le disque, Git propre et un répertoire `.local/messaging-v6` inexistant. Un jeton explicite distinct est nécessaire. Cluster PostgreSQL 17 neuf à cet emplacement (0700), port 55436 sur **socket Unix privé seulement**, `listen_addresses=''`, HBA rejetant tout sauf le pair local `dental-ai` mappé vers le rôle synthétique `postgres`. Les connexions du test vérifient base, répertoire, port et version. Aucun disque loop ni montage n'est demandé.

Les étapes `initdb`, création de base, fixture et Node ont des timeouts de 90/30/90/90 s ; démarrage 40 s, arrêt rapide 30 s. Configuration mémoire PostgreSQL 32 Mio de buffers, 2 Mio work_mem, 10 connexions ; Node 192 Mio. Le piège EXIT/INT/TERM arrête le seul cluster v6, vérifie son arrêt et l'absence du socket, puis compare PID/états des unités, accessibilité du PostgreSQL de production et sockets Unix. Toute différence ou assertion manquante refuse `ok` ; tentative, journaux, image, instantanés et empreintes restent sur place. Aucune relance ni nettoyage automatique.

## Schéma et cas réellement codés dans le testeur

La fixture applique 0002–0013 puis crée deux cliniques, deux conversations générales, commandes des deux cliniques, source livrée et retouche active liée. Elle crée un message historique avec marqueur clinique à 1 et marqueur laboratoire absent ; elle applique **ensuite** 0023. Les 12 marqueurs attendus sont contrôlés, les absents restent à 0 et le marqueur existant reste à 1. Les comptes et sessions sont synthétiques, avec administrateur général seul et administrateur général+commande.

Le testeur utilise les véritables repositories compilés et des transactions SQL sous `SET LOCAL ROLE dental_lab_app` :
- portée clinique et permission distincte général/commande/retouche ; URL connue d'une autre clinique refusée ; rôle général seul exclu des commandes ; suspension clinique et révocation d'un grant, y compris attente effective d'un verrou PostgreSQL pendant une lecture ;
- deux soumissions concurrentes avec une même clé/payload : une création, un replay ; payload différent : conflit ; rollback forcé après insertion d'événement sans message persistant ;
- 59 messages dans la conversation générale, pages arrière et avant sans trou ni doublon, curseur `after_seq` pour rattrapage de sessions ; recherche et filtre de la boîte laboratoire ;
- lectures concurrentes de deux sessions cliniques, borne du marqueur, monotonie et retry idempotent ; non-lus provenant de l'autre côté ; édition contre masquage sous même révision, historique interdit à l'autre auteur ;
- conversation d'une source livrée initialement close ; retouche fermée puis rouverte *dans la fixture* sans affecter la conversation générale ; refus d'envoi et d'édition pendant la fermeture ; rôle applicatif privé de suppression de message et d'altération de l'audit.

**Contrôle de migration distinct :** le contrôle global `check:migrations` a échoué avant toute instance PostgreSQL : la politique figée `dental-lab-migrate.py` rejette `DO`, `BEGIN` et `SET` présents dans `0022_delivery_batch_receipts.sql`, puis `DO NOTHING` dans `0023_conversation_read_markers_backfill.sql`. Les migrations 0002–0013 seules satisfont ce validateur. Ce constat préexistant n'est pas masqué, et ni la migration 0022 ni la 0023 ni le lanceur historique ne sont réécrits ici. La fixture v6 teste `0023` **uniquement dans un cluster jetable distinct**, selon le précédent v5 ; elle ne démontre pas que le chemin administrateur approuverait une migration en production. Une revue séparée des reçus et du mécanisme de migration est indispensable avant toute proposition de production. L'échec du contrôle global ne vaut pas réussite statique globale.

**Limites de couverture :** les changements `closed_at` de la retouche sont une simulation SQL, non une réception du parcours métier de livraison. La boîte laboratoire a peu de conversations : sa pagination au-delà de 50 n'est pas exercée. Le rattrapage SQL après une coupure est testé par curseurs, pas par navigateur, WebSocket ni véritable perte réseau. L'édition contre livraison, le compteur sous insertion concurrente et les rappels e-mail ne sont pas couverts par ce bundle. Le testeur n'a pas été exécuté : toutes les assertions PostgreSQL restent **à confirmer**. Un échec exige un diagnostic et une nouvelle autorisation sur un nouveau bundle ; ne pas modifier celui-ci après réception.

## Vérification préalable et autorisation séparée

Depuis `/srv/dental-lab`, en lecture seule, vérifier `git status --short --branch`, `sha256sum tests/postgres/messaging-v6.sha256`, puis `sha256sum -c tests/postgres/messaging-v6.sha256` (239 entrées), `bash -n tests/postgres/run-messaging-v6.sh`, `node --check tests/postgres/messaging-v6.mjs`. Vérifier les ressources et services ainsi que l'absence de `.local/messaging-v6`. Le manifeste doit correspondre à l'empreinte annoncée dans le rapport de préparation ; en cas de divergence, **STOP avant toute création**.

La commande envisagée **uniquement après autorisation explicite séparée** et revue de ces sorties est :

```bash
cd /srv/dental-lab
DENTAL_MESSAGING_V6_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-messaging-v6.sh
```

Après une éventuelle exécution autorisée, consulter `.local/messaging-v6/result.json`, `fixture.log`, `test-error.log`, `stop.log`, `status-after-stop.log`, `services-before/after`, `production-before/after`, `sockets-before/after`, `sha256-check.log` et `ok`. Exiger le résultat `real-postgres-messaging-v6-passed` **et** `V6_SQL_OK_STOPPED` ; ne pas confondre un résultat Node positif avec l'arrêt/isolation validés.

## Réception navigateur à organiser séparément

Mobile étroit et desktop : deux cliniques et deux sessions laboratoire ; ouvrir réellement les conversations générale, commande et retouche, vérifier non-lus et Envoyé/Lu seulement après consultation visible ; écrire, éditer, masquer et afficher historique. Retirer un droit ou suspendre une clinique pendant un écran ouvert : masquer le contenu ancien et refuser toute requête suivante. Livrer/corriger la livraison selon le workflow réel, puis contrôler clôture/réouverture sans mélanger la retouche. Perdre/rétablir la connexion, accumuler 51, 251 puis 551 messages ; suivre le badge de synchronisation et vérifier les séquences et compteurs sans faux succès. Tester la pagination laboratoire avec plus de 50 conversations et les curseurs sous nouvelle arrivée, les réponses incertaines et la reprise idempotente. Aucun de ces tests navigateur n'a été exécuté.

Notifications internes (réception navigateur séparée, mobile et desktop) : ouvrir avec deux cliniques et deux sessions du propriétaire ; provoquer une inscription, une commande, un renvoi de correction, une demande de modification, une demande d'annulation et une retouche sur données de recette seulement ; vérifier ordre, compteur, lecture répétée sans décrément double, rafraîchissement croisé, navigation vers le détail ou la demande et refus après révocation de session/propriétaire. Changer de clinique et tenter un identifiant d'avis connu : aucun contenu ou compteur étranger. Simuler une réponse incertaine puis relire le reçu, sans création de second avis. La demande initiale de correction vers la clinique et les messages ne sont pas encore couverts par les producteurs internes. Aucun test navigateur de notifications n'a été exécuté.
