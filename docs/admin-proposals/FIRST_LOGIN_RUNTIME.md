# Runtime de première connexion — préparation contrôlée

NON appliqué. Après recette PostgreSQL isolée, migrations/ACL reçues, bootstrap approuvé et probe rollback. Code backend/frontend du bundle auth89e53eed conservé ; aucun worker email n'est installé. La première connexion HTTPS peut être reçue séparément, mais une mise en production pleinement conforme exige aussi livraison/réception des alertes critiques (R10).

## Paramètres à approuver avant exécution

Créer sousroot `/var/lib/dental-lab-owner-bootstrap-v1/admin/runtime.json`, mode600, contenant exactement ces14clés, toutes valeurs chaînes :

- NODE_ENV = production, DENTAL_LAB_AUTH_ENABLED = true.
- PGDATABASE = dental_lab, PGHOST = /var/run/postgresql, PGPORT = 5432, PGUSER = dental-lab-runtime.
- DENTAL_LAB_PORT : port loopback libre, explicitement attribué au laboratoire.
- DENTAL_LAB_ORIGIN : origine HTTPS canonique du domaine réellement contrôlé, aucun slash final.
- DENTAL_LAB_SESSION_LIFETIME_MS et DENTAL_LAB_SESSION_ABSOLUTE_MS : durées approuvées, 1000ms à30jours, durée ≤borne.
- DENTAL_LAB_LOGIN_WINDOW_MS :1000ms à24h ; DENTAL_LAB_LOGIN_ACCOUNT_ATTEMPTS et DENTAL_LAB_LOGIN_NETWORK_ATTEMPTS :1à1000000 ; DENTAL_LAB_LOGIN_MAX_KEYS :2à100000.

Aucune valeur de production n'est inventée. Choisir les seuils réseau en tenant compte de trust proxy=false : derrière le reverse proxy local, les utilisateurs partagent la clé réseau loopback. Les headers X-Forwarded-For fournis par un client ne sont pas crus. Ne pas changer silencieusement la politique après première utilisation : le digest du limiteur refuse un changement non reçu.

Validation par les MÊMES fonctions que le runtime ; toute clé supplémentaire (notamment secret/PGPASSWORD), valeur shell, mauvais peer/origine/durée est refusée. Génération en fichier nouveau, sans écrasement :

```bash
set -euo pipefail
test "$(id -u)" = 0
umask 077
set -o noclobber
/usr/sbin/runuser -u dental-lab-runtime -- /usr/bin/env -i PATH=/usr/bin:/bin UV_THREADPOOL_SIZE=1 \
 /usr/bin/node --v8-pool-size=1 --max-old-space-size=192 \
 /var/lib/dental-lab-owner-bootstrap-v1/release/scripts/auth-config-review.mjs \
 < /var/lib/dental-lab-owner-bootstrap-v1/admin/runtime.json \
 > /var/lib/dental-lab-owner-bootstrap-v1/admin/runtime.env
/usr/bin/chmod 400 /var/lib/dental-lab-owner-bootstrap-v1/admin/runtime.env
/usr/bin/sha256sum /var/lib/dental-lab-owner-bootstrap-v1/admin/runtime.env
```

Conserver cette empreinte dans le dossier privé d'approbation. Si validation échoue, le fichier de sortie peut être vide : inspecter et remplacer seulement après constat explicite, pas relancer aveuglément noclobber.

## Lancement de réception limité à15minutes

Proposition à approuver spécifiquement (nouvelle unité transitoire dédiée, jamais un redémarrage global). Vérifier identité runtime/chemins/port libre/absence d'autre instance et opérations.pending, limites de ressources et dossier reçus. Ce lancement sert la recette, pas une installation persistante19.4.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/bin/systemd-run --unit=dental-lab-auth-first-login --collect --service-type=exec \
 -p User=dental-lab-runtime -p Group=dental-lab-runtime \
 -p WorkingDirectory=/var/lib/dental-lab-owner-bootstrap-v1/release \
 -p EnvironmentFile=/var/lib/dental-lab-owner-bootstrap-v1/admin/runtime.env \
 -p Environment=UV_THREADPOOL_SIZE=1 \
 -p NoNewPrivileges=yes -p PrivateTmp=yes -p PrivateDevices=yes \
 -p ProtectSystem=strict -p ProtectHome=yes -p RestrictAddressFamilies="AF_UNIX AF_INET" \
 -p TasksMax=16 -p MemoryMax=384M -p CPUQuota=50% -p RuntimeMaxSec=900 -p UMask=0077 \
 /usr/bin/node --v8-pool-size=1 --max-old-space-size=192 \
 /var/lib/dental-lab-owner-bootstrap-v1/release/apps/api/dist/index.js
/usr/bin/systemctl status dental-lab-auth-first-login --no-pager
```

Le runtime échoue avant écoute si identité/ACL/schéma/config invalides ; ne pas élargir ses droits pour éviter ce contrôle. Arrêt si nécessaire : `systemctl stop dental-lab-auth-first-login` seulement. Interruption de console : inspecter cette unité avant tout nouveau lancement.

## Routage HTTPS à recevoir avec19.5

Le domaine, certificat/clé existants autorisés et emplacement du vhost ne sont pas connus. Ce sont des données administrateur indispensables, pas des valeurs à deviner. Préparer/revoir le vhost dédié avec ces invariants avant toute installation/recharge autorisée :

- Certificat valide pour l'origine approuvée, TLS, redirection HTTP vers cette origine ; aucun `curl -k`.
- Fichiers publics : `/var/lib/dental-lab-owner-bootstrap-v1/release/apps/web/dist` uniquement, jamais la racine du bundle/admin/node_modules.
- `/api/` transmis sans réécriture à `http://127.0.0.1:PORT_APPROUVE`, Host canonique et Origin conservé ; cache API désactivé, aucune journalisation de body/Authorization/Cookie/Set-Cookie.
- SPA fallback vers index.html pour les routes UI, aucun fallback HTML sur /api ; serviceworker n'enregistre pas de réponse API.
- Valider le candidat et l'absence de collision avant approbation de son installation/recharge ; aucune modification d'un vhost voisin ni d'une unité existante pour cette recette.

Le dossier ne prétend donc pas fournir une commande TLS exécutable sans ces données. Dès attribution du domaine/port/certificat, la configuration exacte du vhost peut être finalisée et revue dans le même lot administrateur.

## Réception et état final

Suivre AUTH_HTTPS_RECIPE.md : vrai login privé, cookie __Host sécurisé, restauration, deux sessions, rotation, logout ciblé/global, refus origine invalide, limiteur et absence de secret dans traces. Vérifier SESSION_ISSUED et security_alert corrélés, notification/livraison pending atomiques, absence d'alerte sur renouvellement ou login refusé. Ne pas annoncer email envoyé.

Prérequis logiciels de création du premier compte et du parcours login/session : implémentés, contrôlés hors ligne. Nous pouvons passer à la validation réelle groupée, en commençant par l'instance isolée et les migrations. Validation réelle ≠ production déclarée conforme : SQL/concurrence/HTTPS restent non exécutés ; valeurs système/TLS à confirmer ; worker email critique reste à développer après choix fournisseur.
