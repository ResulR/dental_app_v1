# Livraison synthétique dormante — recette PostgreSQL v13 proposée

**Non exécutée. Autorisation explicite séparée indispensable.** Bundle distinct
de v1–v12 et des preuves existantes. V12 demeure un succès de 107 assertions
sur notifications et intentions ; il ne reçoit pas la réservation et les
tentatives du code actuel.

Manifeste : 248 empreintes SHA-256 ; SHA-256 du manifeste : `41ad166bb384ca2dc5ca783d9349f193437f6ca2ef56fb01ec09c82d567b8a5b`.

Fixture v13 synthétique issue d'une copie indépendante de v12, avec garde
stricte de cluster vide, chemin et port. Scénarios JavaScript proposés :
trois refus de privilèges, réservation et `SKIP LOCKED` avec deux connexions,
révocation de configuration admin, prévol des droits, backoff après erreur temporaire, seconde tentative
acceptée, bail expiré ambigu non renvoyé, révision obsolète, suspension du
compte et résultat ambigu du fournisseur fictif. Aucune adresse n'est transmise
au fournisseur fictif. Les contrôles statiques, le manifeste et la syntaxe ne
valident pas encore le résultat PostgreSQL de ces scénarios.

Le runner conserve les limites existantes : cgroup UID 1002, CPU 50 %, mémoire
1 Gio, 100 tâches, marge mémoire et disque, socket privée en `.local` au port
55443, aucun TCP ; timeouts 90 s pour initialisation, fixture et assertions,
arrêt fast sous trap et comparaison des services, PostgreSQL de production et
sockets. SIGKILL ou panne VPS nécessitent un contrôle administratif indépendant.
Tout échec conserve le dossier de preuve ; il ne doit pas être relancé.

Préflight en lecture seule, **à examiner après le commit et avant autorisation** :

```bash
cd /srv/dental-lab
git status --short --branch
sha256sum tests/postgres/notifications-v13.sha256
sha256sum -c tests/postgres/notifications-v13.sha256
bash -n tests/postgres/run-notifications-v13.sh
node --check tests/postgres/notifications-v13.mjs
python3 -m unittest tests/migrations/test_dormant_delivery_v13_static.py
test ! -e .local/notifications-v13
/usr/lib/postgresql/17/bin/pg_isready -h /var/run/postgresql -p 5432
```

**Commande envisagée, non autorisée ici :**

```bash
cd /srv/dental-lab
DENTAL_NOTIFICATIONS_V13_APPROVED=private-unix-socket-one-shot bash tests/postgres/run-notifications-v13.sh
```

Attendu mais non constaté : `real-postgres-dormant-delivery-v13-passed`,
`V13_SQL_OK_STOPPED`, absence de serveur/socket v13, services et captures
inchangés. Le dossier de preuve attendu est `.local/notifications-v13`.
Une réussite de v13 ne validerait ni les parcours navigateur, ni la course
postérieure au prévol face à un fournisseur externe, ni la livraison
exactement une fois, ni l'envoi réel.
