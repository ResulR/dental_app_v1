# Recette PostgreSQL sur VPS partagé — proposition v1, NON exécutée

Date : 13/10/2026. Base auditée : commit 164ab82910a927b8c2f2d4fa82bbdd51b4309484.
Objet limité : prouver l'atomicité/rollback/concurrence du premier propriétaire sur un cluster synthétique.
Aucun premier compte réel, migration de production, modification du PostgreSQL existant ou déploiement autorisé par ce document.

## Décision proposée et limites

Recommandation : essayer d'abord une **enveloppe isolée sans PostgreSQL**, puis autoriser séparément les tests si ses preuves sont conformes.
Le même VPS paraît suffisamment dimensionné. L'isolation effective n'est PAS encore démontrée : elle exige la phase A administrateur.
Si une protection manque ou si une limite ne peut être vérifiée, STOP et recette dans une VM Linux sur l'ordinateur de l'opérateur.
Ne pas supprimer de garde, désactiver un confinement, réutiliser postgres Linux ou élargir dental-ai pour faire réussir le test.

La clause « pas le VPS partagé » et le contrôle hostname de FIRST_OWNER_BOOTSTRAP_ADMIN.md restent valables pour sa procédure originale.
L'alternative ci-dessous est une exception proposée, à approuver explicitement, pas une suppression de la garde.
Le harness, la fixture et le bundle v1 restent inchangés. Les chemins internes attendus sont reproduits dans une racine isolée.

| Option | Sécurité et limites | Reproductibilité / coût |
| --- | --- | --- |
| Enveloppe systemd sur VPS | Compte distinct, filesystem privé, réseau privé, socket privé, cgroups et disque plafonnés. Noyau et matériel partagés : risque résiduel de contention, aucune garantie « zéro impact ». | PG17.11, Node22.22.2 et bundle existants ; aucun achat. Deux approbations avec arrêt entre phases. |
| VM Linux locale | Sépare le noyau et les ressources de production ; option la plus indépendante. Ressources/OS de l'ordinateur encore inconnus. | Installer PG17 et Node22.22.2 dans la VM, transférer les mêmes octets/SHA, appliquer la procédure originale hors VPS. Pas besoin d'un second VPS. |
| Simple deuxième base dans le cluster existant | Partage superutilisateur, rôles et configuration de production. | Rejetée pour cette recette. |
| initdb sous dental-ai ou postgres Linux de production | Pas d'enveloppe indépendante démontrée ; identité ou cgroup partagés. | Rejetée. Aucun démarrage manuel sur l'hôte. |

## Audit réellement réalisé

- Remote sous dental-ai UID1002 ; dépôt propre et main distant=164ab82 ; aucun test/build actif.
- 4 CPU ; RAM totale7757Mio, disponible5723Mio ; swap0 ; disque53Gio disponibles ; load1min0.06 à l'observation.
- systemd257.13, cgroupv2 ; binaires PG17 et Node22.22.2 disponibles. Outils mount, mkfs.ext4, useradd et systemd-analyze présents.
- PostgreSQL17-main actif, port5432 IPv4/IPv6 loopback ; cluster /var/lib/postgresql/17/main.
- Nginx, PM2, dental-site et autres services présents : aucun modifié ni contenu applicatif lu.
- Service Remote : NoNewPrivileges=yes, ProtectSystem=strict, PrivateTmp=yes, CPU50%, RAM1Gio,100tâches. memory.current~765Mio inclut le cache, ce n'est pas une mesure du seul working set.
- SQL READ ONLY sur dental_lab sous dental-ai : version170011, ni superuser ni CREATEDB ni CREATEROLE.
- HBA global et paramètres privilégiés non lus : contrôles réservés à l'administrateur, aucun élargissement demandé.
- ss a averti que NETLINK était interdit dans Remote ; inventaire TCP partiel obtenu. Cela ne remplace pas les contrôles de l'opérateur.
- Compte dental-pg-test absent. Aucun cluster test ni unité de recette créé.
- Boucles de montage/namespaces/cgroups réels : encore NON testés. Présence des outils et validation syntaxique ne prouvent pas leur fonctionnement.

## Enveloppe proposée

- Nouveau compte Linux dental-pg-test sans login, sans home, sans groupe supplémentaire ; aucun rôle SQL de production.
- Image ext4 préallouée **512Mio**, privée root600 sous /var/lib/dental-lab-pg-recipe (root700). Tous les fichiers PG, WAL et preuves tiennent dans cette image.
- RootImage et bibliothèques/binaires système montés en lecture seule ; ni /srv, ni home, ni données/configuration/socket PostgreSQL de l'hôte exposés.
- PrivateNetwork + AF_UNIX uniquement ; pas de TCP, pas d'accès réseau sortant. Socket uniquement dans le cluster test, permissions700, port logique55432.
- Identité SQL postgres du NOUVEAU cluster liée par peer-map uniquement à dental-pg-test. La carte est écrite dans l'image, jamais dans le HBA de production.
- Mémoire768Mio, swap0, CPU50% d'un CPU,48tâches, durée5min, /tmp32Mio, core dump interdit.
- IOWeight10 est une priorité relative, pas un plafond absolu d'I/O. Le volume maximal d'écritures est borné par l'image ; surveiller les voisins et arrêter si dégradation.
- Unité temporaire /run/systemd/system uniquement, aucun enable, aucune modification d'un service existant. Un seul mode actif à la fois.
- Pas de nouvelle archive métier : 1646 fichiers v1 vérifiés. Les scripts d'enveloppe sont des propositions administrateur séparées.
- Durabilité PG conservée : fsync/synchronous_commit/full_page_writes actifs. Pas de « test rapide » avec durabilité désactivée.

## Empreintes à approuver

| Fichier | SHA-256 |
| --- | --- |
| owner-bootstrap-review-v1.tar.gz | 961ac181518d132a6d25c43c4a7d989d31024bcf58606834c31205a8912a8a00 |
| isolated-pg-recipe-runner.sh | 6d606f27d206632d4b762c9c149677c199e1c8c8ef4519ddf24786a149521aca |
| dental-pg-recipe@.service | da57a8036f0b340dc1a332fa3e189e1a7ee174da2e25f8e62926e388e7693f60 |
| prepare-isolated-pg-envelope.py | ec6a8a337b6b19c11198318912c67fdf9f803af22bdbfb06f90b83c507c4cd2b |

Toute modification change l'approbation correspondante. Garder le dossier root privé et les résultats hors Git.

## Phase A — approbation de l'enveloppe et de ses seuls tests d'isolation

Autorisation requise : création du compte dédié, image de512Mio/montage loop temporaire, unité temporaire et exécution du mode isolation.
**Ni initdb ni PostgreSQL ni SQL de recette ne sont exécutés dans cette phase.**

Exécuter depuis une console administrateur privée, pas depuis Remote dental-ai.
Préconditions : fenêtre calme, aucun autre chantier/admin en cours, sauvegardes récentes vérifiées, au moins2Gio de RAM disponible et2Gio de disque libre, load1min<2.
Ces seuils sont des critères conservateurs proposés, pas une capacité garantie sous charge future.

### A1. Copie figée et contrôles avant changement

Si un chemin existe déjà : STOP, inspecter l'interruption précédente, ne pas écraser.

```bash
set -euo pipefail
test "$(id -u)" = 0
test "$(hostname)" = vps-28bf7789
umask 077
test ! -e /root/dental-pg-recipe-review
test ! -e /var/lib/dental-lab-pg-recipe
test ! -e /run/systemd/system/dental-pg-recipe@.service
! getent passwd dental-pg-test
install -d -m 700 /root/dental-pg-recipe-review
cd /root/dental-pg-recipe-review
for name in prepare-isolated-pg-envelope.py isolated-pg-recipe-runner.sh dental-pg-recipe@.service; do
 runuser -u dental-ai -- cat "/srv/dental-lab/docs/admin-proposals/$name" > "$name"
done
runuser -u dental-ai -- cat /srv/dental-lab/.local/owner-bootstrap-review-v1.tar.gz > owner-bootstrap-review-v1.tar.gz
sha256sum -c <<'SHA'
ec6a8a337b6b19c11198318912c67fdf9f803af22bdbfb06f90b83c507c4cd2b  prepare-isolated-pg-envelope.py
6d606f27d206632d4b762c9c149677c199e1c8c8ef4519ddf24786a149521aca  isolated-pg-recipe-runner.sh
da57a8036f0b340dc1a332fa3e189e1a7ee174da2e25f8e62926e388e7693f60  dental-pg-recipe@.service
961ac181518d132a6d25c43c4a7d989d31024bcf58606834c31205a8912a8a00  owner-bootstrap-review-v1.tar.gz
SHA
free -m
df -h /var/lib
uptime
systemctl list-units --type=service --state=running --no-pager > services-before.txt
systemctl show postgresql@17-main nginx pm2-debian dental-site dental-ai-remote \
 -p Id -p ActiveState -p MainPID -p ExecMainStartTimestampMonotonic > state-before.txt
find /etc/postgresql/17/main -type f -exec sha256sum {} + | sort > pg-config-before.sha256
runuser -u postgres -- /usr/lib/postgresql/17/bin/pg_isready -h /var/run/postgresql -p 5432
systemd-analyze verify ./dental-pg-recipe@.service
```

Comparer les fichiers figés à la revue approuvée, pas seulement à un manifeste auto-fourni.
Le script de préparation refuse utilisateur existant, chemins existants, versions divergentes ou ressources insuffisantes.
Un échec après une création laisse les fichiers en place : diagnostic avant tout rejeu.

### A2. Préparation puis preuve d'isolation

```bash
DENTAL_PG_RECIPE_ENVELOPE_APPROVED=v1 \
 /usr/bin/python3 -I /root/dental-pg-recipe-review/prepare-isolated-pg-envelope.py
install -o root -g root -m 644 /var/lib/dental-lab-pg-recipe/dental-pg-recipe@.service \
 /run/systemd/system/dental-pg-recipe@.service
systemctl daemon-reload
systemctl start dental-pg-recipe@isolation.service
```

Contrôler la fin, sans relancer start :
```bash
systemctl show dental-pg-recipe@isolation.service -p ActiveState -p SubState -p Result -p ExecMainStatus
journalctl -u dental-pg-recipe@isolation.service --no-pager -n 40
```

Attendre au plus5minutes en surveillant. Attendu : inactive/dead, Result=success, ExecMainStatus=0, JSON isolation-passed.
Le script vérifie UID/GID, absence de capacités, NoNewPrivs/seccomp, namespaces différents, refus des sockets IP, absence des chemins et socket de production, plafonds cgroup et taille filesystem, lecture seule du code/configuration.
En cas de refus (y compris manque de support noyau), ne pas assouplir l'unité : analyser ou basculer en local.
Pas de preuve d'absence absolue de vulnérabilité noyau ; seule l'isolation opérationnelle configurée est testée.

## Phase B — deuxième approbation, recette réelle dans l'image uniquement

N'autoriser qu'après revue de A et comparaison des services/configs de production.
Autorisation distincte : initdb, schéma/roles synthétiques dans le nouveau cluster, commits de fixtures et tests de panne/concurrence.
Ne couvre ni migrations de dental_lab de production ni vrai propriétaire.

Aucun mode ne doit être actif ; refuser toute trace test.pending ou pgdata.
Monter uniquement l'image attendue, créer le marqueur root, puis démonter avant tout start :

```bash
set -euo pipefail
test "$(id -u)" = 0
test "$(systemctl show dental-pg-recipe@isolation.service -p ActiveState --value)" = inactive
test "$(systemctl show dental-pg-recipe@test.service -p ActiveState --value)" = inactive
mount -o loop,nodev,nosuid /var/lib/dental-lab-pg-recipe/sandbox.raw /var/lib/dental-lab-pg-recipe/mount
python3 -I - <<'PY'
import json,os
from pathlib import Path
r=Path('/var/lib/dental-lab-pg-recipe/mount')
p=r/'var/lib/dental-lab-bootstrap-reception'
assert json.loads((p/'isolation.json').read_text())['result']=='isolation-passed'
assert not (p/'test.pending').exists() and not (p/'pgdata').exists()
with (r/'etc/reception-test-approved').open('x') as f:
 f.write('approved-test-v1\n'); f.flush(); os.fsync(f.fileno())
(r/'etc/reception-test-approved').chmod(0o444)
PY
umount /var/lib/dental-lab-pg-recipe/mount
systemctl start dental-pg-recipe@test.service
```

Le mode test recontrôle intégralement l'isolation et crée test.pending avant initdb. Le marqueur n'est jamais effacé automatiquement.
Attendu : mêmes critères de fin service + JSON owner_bootstrap_postgres/result=passed.
Consulter result.json/fixture.log/stop.log en montant l'image **en lecture seule après arrêt confirmé**.
Le succès du JSON seul ne suffit pas si l'arrêt du cluster ou l'unité a échoué.

Couvre : six défauts injectés, rollback après écritures, FK différée, perte de connexion avant commit, deux vrais writers avec attente de verrou observée, un seul commit relu par une nouvelle connexion, refus d'une nouvelle tentative.
Ne couvre pas : crash machine/fsync sous panne matérielle, perte d'accusé après commit, sessions HTTP sur vraie base, bootstrap root interactif complet, HTTPS ou livraison email.
Ces réceptions restent distinctes. Aucun résultat réel de ce harness n'est revendiqué à ce stade.

## Surveillance, arrêts et absence d'interférence

Deuxième console opérateur : surveiller MemAvailable, load, services et latence métier connue avant/après.
Arrêter immédiatement la SEULE unité de test si RAM disponible<1Gio, load1min>3 de façon persistante, voisin dégradé, erreur/OOM/limite5min, résultat incertain, chemin/socket inattendu, ou nouveau processus non identifié.
Ne jamais relancer automatiquement, changer les quotas en cours, arrêter PostgreSQL17-main ou supprimer pending.

```bash
systemctl stop dental-pg-recipe@test.service
# Si seule la phase A tourne :
# systemctl stop dental-pg-recipe@isolation.service
```

Après chaque phase, depuis le dossier privé de revue :
```bash
systemctl show postgresql@17-main nginx pm2-debian dental-site dental-ai-remote \
 -p Id -p ActiveState -p MainPID -p ExecMainStartTimestampMonotonic > state-after.txt
diff -u state-before.txt state-after.txt
sha256sum -c pg-config-before.sha256
runuser -u postgres -- /usr/lib/postgresql/17/bin/pg_isready -h /var/run/postgresql -p 5432
ss -lnt
pgrep -u dental-pg-test
```

Dernier pgrep attendu exit1 (aucun processus). Toute divergence inattendue doit être expliquée avant réception.
Le contrôle PID/config/readiness montre absence de redémarrage/configuration modifiée ; il ne démontre pas à lui seul absence de latence.
L'absence de bind des sockets/data/homes et l'identité Linux séparée protègent contre accès aux voisins ; ne pas scanner leurs bases pour « vérifier ».

## Nettoyage contrôlé

Après arrêt confirmé des DEUX modes et absence de processus, conserver l'image et les preuves en cas d'échec.
Ne pas utiliser rm -rf automatique. Archiver les sorties agrégées, unités, scripts, SHA et résultat hors Git avant suppression autorisée.
Un checkpoint supplémentaire après redémarrage PG du cluster test serait une recette nouvelle, non prévue par ce dossier.

Désinstallation de l'unité temporaire (approbation incluse dans le nettoyage) :
```bash
set -euo pipefail
test "$(id -u)" = 0
! systemctl is-active --quiet dental-pg-recipe@isolation.service
! systemctl is-active --quiet dental-pg-recipe@test.service
! pgrep -u dental-pg-test
test "$(stat -c %U /run/systemd/system/dental-pg-recipe@.service)" = root
rm -- /run/systemd/system/dental-pg-recipe@.service
systemctl daemon-reload
```

Pour retirer l'image : confirmer aucun montage via findmnt et aucun loop via losetup -j sur CE chemin.
Si un montage de diagnostic subsiste, démonter uniquement /var/lib/dental-lab-pg-recipe/mount après vérification de sa source.
Ne pas détacher tous les loop, ne pas userdel tant qu'un processus subsiste.
Après accord explicite de suppression des fixtures, depuis console root :

```bash
set -euo pipefail
test "$(id -u)" = 0
! pgrep -u dental-pg-test
test -z "$(findmnt -rn -M /var/lib/dental-lab-pg-recipe/mount)"
test -z "$(losetup -j /var/lib/dental-lab-pg-recipe/sandbox.raw)"
test "$(stat -c %U /var/lib/dental-lab-pg-recipe/sandbox.raw)" = root
test "$(stat -c %s /var/lib/dental-lab-pg-recipe/sandbox.raw)" = 536870912
rm -- /var/lib/dental-lab-pg-recipe/sandbox.raw
rmdir /var/lib/dental-lab-pg-recipe/mount
userdel dental-pg-test
# Les petits fichiers identity.json/unité et le dossier /root de preuves restent conservés.
```

Aucun nettoyage ne touche /var/lib/postgresql, /etc/postgresql, /srv/dental-lab, les comptes métier ou les reçus de migration.

## Vérifications de préparation / reprise

Réalisées : audit en lecture seule, syntaxe bash et Python (sans exécuter les blocs privilégiés), validation systemd257 de l'unité, empreintes.
À réaliser après accord : enveloppe, preuve d'isolation, recette SQL, comparaisons hôte et nettoyage.
Application production et réception connexion : inchangées, encore différées.
Prochaine action : obtenir uniquement l'accord Phase A. Ne pas passer à B sans ses preuves et accord distinct.

Sources : man systemd.exec/systemd.resource-control installés version257 ; documentation PG17 sur connexions et cartes peer :
https://www.postgresql.org/docs/17/runtime-config-connection.html
https://www.postgresql.org/docs/17/auth-username-maps.html
https://manpages.debian.org/trixie/systemd/systemd.exec.5.en.html
