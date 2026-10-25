# Proposition de réception PostgreSQL v14 — révocations concurrentes

**Non exécutée. Autorisation explicite séparée indispensable.**

Bundle autonome, distinct de v1–v13, basé sur la fixture synthétique v13.
Manifeste : 248 empreintes SHA-256 ; SHA-256 du manifeste :
`84fc841e96917f54f47f7c4d7458fe468c38ca8e6e1f011915865ebfa048bcdf`.

## Portée proposée

- Rejouer les scénarios synthétiques de v13 dans un **nouveau** cluster privé.
- Vérifier réellement `authorize` après `preflight` quand une révocation
  de configuration, de grant, de clinique ou de révision a été validée.
- Vérifier le refus d'un bail expiré, puis la récupération ambiguë sans renvoi.
- Vérifier l'attente d'un verrou de compte suspendu en transaction concurrente,
  puis le refus après commit.
- Montrer explicitement la limite : une suppression de configuration encore
  non commitée peut être invisible ; un second contrôle après commit refuse.
- Vérifier sur PostgreSQL que la révocation entre le prévol et la validation
  finale empêche effectivement tout appel au fournisseur fictif.
- Conserver le fournisseur exclusivement fictif, sans adresse ni contenu.

Le test d'attente de verrou utilise un délai synthétique de 50 ms, à confirmer
sur PostgreSQL réel. Aucune assertion v14 n'est encore réceptionnée.

## Isolement et garde-fous

UID 1002 et cgroup `dental-ai-remote.service`, limites CPU 50 %, mémoire
1 Gio et 100 tâches, marges disque/mémoire/tâches, port **55444** sur socket
Unix privée `.local/notifications-v14/socket`, aucun TCP. Cluster et
preuves dans `.local/notifications-v14` ; création interdite si le dossier
existe. Timeouts et arrêt sous trap, comparaisons avant/après des services,
sockets et PostgreSQL de production. Un SIGKILL ou une panne VPS peut exiger
une inspection administrative. Tout échec conserve ses preuves : **ne pas
relancer** la recette.

Préflight **en lecture seule**, à examiner après commit :

```bash
cd /srv/dental-lab
git status --short --branch
sha256sum tests/postgres/notifications-v14.sha256
sha256sum -c tests/postgres/notifications-v14.sha256
bash -n tests/postgres/run-notifications-v14.sh
node --check tests/postgres/notifications-v14.mjs
python3 -m unittest tests/migrations/test_dormant_delivery_v14_static.py
test ! -e .local/notifications-v14
/usr/lib/postgresql/17/bin/pg_isready -h /var/run/postgresql -p 5432
```

Commande **préparée mais non autorisée ni exécutée** :

```bash
cd /srv/dental-lab
DENTAL_NOTIFICATIONS_V14_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-notifications-v14.sh
```

Attendu, **non constaté** : `real-postgres-dormant-delivery-v14-passed`,
`V14_SQL_OK_STOPPED`, captures inchangées, cluster arrêté et socket absente.

Même une réussite v14 ne validerait ni le transport réel ni une révocation
atomique après remise au fournisseur.
