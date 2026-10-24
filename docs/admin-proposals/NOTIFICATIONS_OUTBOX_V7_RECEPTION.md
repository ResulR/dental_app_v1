# Notifications et intentions e-mail — recette PostgreSQL v7 proposée

**Préparation statique seulement. PostgreSQL v7 n'a pas été démarré.** Bundle distinct de v1–v6 : `tests/postgres/notifications-v7-fixture.sql`, `notifications-v7.mjs`, `run-notifications-v7.sh`, `notifications-v7.sha256`. Le manifeste comprend 241 chemins et a pour SHA-256 `f4fd469b19925467dcbf3e9887b37a45129324f967619481515659f314269744`. Une modification de fichier couvert exige une nouvelle empreinte et une nouvelle revue, jamais une correction pendant l'exécution.

La fixture reprend le schéma synthétique 0002–0013 et le backfill 0023 de v6 sous un **nouveau chemin**. Elle n'applique rien en production et ne démontre pas que le lanceur administratif accepte 0022/0023. Les comptes, conversations et commandes sont fictifs. Le testeur vérifie les véritables repositories compilés sous `dental_lab_app` avec transactions PostgreSQL. Le bundle v6 figé reste inchangé.

## Contrôles annoncés, non exécutés

- 51 messages cliniques synthétiques produisent 51 avis individuels pour le propriétaire : pages 50+1 par curseur, compteur, unicité des identifiants, lecture idempotente, indépendance du compteur administrateur, refus d'un autre compte et absence d'avancement du marqueur de lecture de conversation.
- Une soumission de message maintient le verrou des grants pendant qu'une révocation attend ; ses trois avis sont créés transactionnellement, puis la consultation suivante retire les avis devenus inaccessibles au compte révoqué. Ceci exerce création/révocation ordonnée sous verrou ; des courses sous d'autres ordres d'ordonnancement restent à éprouver.
- Deux préparations concurrentes de la même intention clinique et laboratoire : une insertion puis un rejeu sans doublon, sous le verrou du dispatch et la contrainte unique. Rollback volontaire après append clinique, absence de delivery persistante et reprise sur le même événement. Événement dépassé par une nouvelle révision : aucune nouvelle intention ; clinique suspendue : aucun nouveau destinataire clinique.
- Les six catégories labo ne deviennent pas des catégories supplémentaires : `clinic_registered` conserve son adaptateur existant ; les cinq événements de commande exigent une action émise par le compte clinique lié, puis utilisent propriétaire et administrateurs **explicitement configurés**, actifs, non verrouillés et dotés des grants de lecture détaillée/logistique. Une proposition émise par le laboratoire avec le même type d'événement ne crée aucune intention laboratoire. Après révocation du grant, un nouvel événement ne crée que l'intention propriétaire. Le test ne délivre aucun e-mail.
- Les intentions stockent identifiants d'événement et compte, canal et finalité. Aucun corps de message, patient, adresse, pièce jointe ni secret. Notification personnelle, accusé de lecture de conversation, état de la commande et intention e-mail restent séparés.

## Isolation et arrêt

Le runner exige hôte `vps-28bf7789`, UID 1002, cgroup Remote inchangé (CPU 50 %, RAM 1 Gio, 100 tâches), marge de 24 tâches et 448 Mio non-cache, 1 Gio libre, Git propre, PostgreSQL de production accessible et répertoire `.local/notifications-v7` absent. Il vérifie les 241 empreintes avant création ; cluster PostgreSQL 17 neuf, socket Unix privée 0700, port 55437, aucun TCP, HBA de rejet et mapping peer local. Les commandes initdb/fixture/test ont des délais de 90 s, démarrage 40 s, arrêt rapide 30 s ; Node 192 Mio et buffers PostgreSQL 32 Mio. EXIT/INT/TERM arrêtent le cluster et comparent états/PID des services, accessibilité de production et sockets avant/après. Les preuves, journaux et l'image restent en place ; aucun nettoyage ni redémarrage automatique.

## Limites et réception

La syntaxe du runner et du testeur, les empreintes et les assertions peuvent être relues sans privilège. Une validation **réelle** de concurrence, ordre des verrous, requêtes SQL, privilèges, performance sous limite 90 s, rollback, réception navigateur et sécurité d'un futur fournisseur exige une recette autorisée séparément. Les doubles unitaires ne prouvent aucun de ces points. Le runner conserve `attempt` et ne crée `ok` que si le testeur et l'arrêt/comparaison réussissent. Un échec impose diagnostic sur les preuves en place et une nouvelle proposition ; ne jamais relancer le même bundle.

Avant autorisation, vérifier en lecture seule :

```bash
cd /srv/dental-lab
git status --short --branch
sha256sum tests/postgres/notifications-v7.sha256
sha256sum -c tests/postgres/notifications-v7.sha256
bash -n tests/postgres/run-notifications-v7.sh
node --check tests/postgres/notifications-v7.mjs
test ! -e .local/notifications-v7
```

**Commande envisagée uniquement après autorisation explicite séparée et nouveau préflight des services/ressources :**

```bash
cd /srv/dental-lab
DENTAL_NOTIFICATIONS_V7_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-notifications-v7.sh
```

Résultats attendus : `real-postgres-notification-outbox-v7-passed` dans `result.json` et `V7_SQL_OK_STOPPED` dans `ok`, plus absence de socket/processus et services identiques. Ne pas déduire une réussite d'un résultat Node sans la preuve d'arrêt. Le fichier `test-error.log` et les instantanés avant/après sont conservés dans `.local/notifications-v7`.
