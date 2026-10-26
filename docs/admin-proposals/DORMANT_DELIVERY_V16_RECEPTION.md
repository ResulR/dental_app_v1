# Proposition de réception PostgreSQL v16 — révocations concurrentes

**Non exécutée. Autorisation explicite séparée indispensable.**

Bundle autonome, distinct de v1–v15, basé sur une copie distincte de la fixture synthétique v15.
Manifeste : 248 empreintes SHA-256 ; SHA-256 du manifeste :
`83cba08558fc5d9c20b25f8c21374539bbf511eee72cfc4248786968fd08c9ee`.

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

Le test observe wait_event_type=Lock pour le backend concurrent avant le commit, mais ne lie pas ce verrou au PID de la transaction administrateur. Il ne suffit donc pas à prouver la course précise revendiquée ; v16 est bloquée pour cette réception. Le délai maximal de 2,5 s évite une attente infinie. Aucune assertion v16 n'est encore réceptionnée.

## Isolement et garde-fous

UID 1002 et cgroup `dental-ai-remote.service`, limites CPU 50 %, mémoire
1 Gio et 100 tâches, marges disque/mémoire/tâches, port **55446** sur socket
Unix privée `.local/notifications-v16/socket`, aucun TCP. Cluster et
preuves dans `.local/notifications-v16` ; création interdite si le dossier
existe. Timeouts et arrêt sous trap, comparaisons avant/après des services,
sockets et PostgreSQL de production. Un SIGKILL ou une panne VPS peut exiger
une inspection administrative. Tout échec conserve ses preuves : **ne pas
relancer** la recette.

Préflight **en lecture seule**, à examiner après commit :

```bash
cd /srv/dental-lab
git status --short --branch
sha256sum tests/postgres/notifications-v16.sha256
sha256sum -c tests/postgres/notifications-v16.sha256
bash -n tests/postgres/run-notifications-v16.sh
node --check tests/postgres/notifications-v16.mjs
python3 -m unittest tests/migrations/test_dormant_delivery_v16_static.py
test ! -e .local/notifications-v16
/usr/lib/postgresql/17/bin/pg_isready -h /var/run/postgresql -p 5432
```

Commande **préparée mais non autorisée ni exécutée** :

```bash
cd /srv/dental-lab
DENTAL_NOTIFICATIONS_V16_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-notifications-v16.sh
```

Attendu, **non constaté** : `real-postgres-dormant-delivery-v16-passed`,
`V16_SQL_OK_STOPPED`, captures inchangées, cluster arrêté et socket absente.

Même une réussite v16 ne validerait ni le transport réel ni une révocation
atomique après remise au fournisseur.

V14 est figée et son manifeste diverge du build courant sur un commentaire généré ; ne pas la lancer. V16 vérifie les nouveaux octets sans affaiblir les assertions.

V15 reste figée et bloquée pour son assertion de verrou insuffisante. V16 est proposée uniquement ; aucune assertion PostgreSQL v16 n’est constatée.
