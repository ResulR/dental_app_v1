# Chapitre 12 — décision de stockage et recette indépendante (proposition)

État audité le 20/10/2026, Git `6c3445d`. **Aucune commande ci-dessous n'a été exécutée par cette procédure.** Pas d'activation automatique, aucun accès aux données d'autres projets. L'unité `dental-ai-remote.service` exécute `dental-ai`, `ProtectSystem=strict`, `ReadWritePaths=/home/dental-ai /srv/dental-lab`, `MemoryMax=1 Gio`, `CPUQuota=50%`, `TasksMax=100`, `NoNewPrivileges=yes`. `/srv/dental-lab` est en mode 0700 sous dental-ai, sur ext4 `/dev/sda1`, environ 56,18 Go disponibles au moment de l'audit. Ni `/var/lib/dental-lab-files` ni `/srv/dental-lab-private` n'existent. `file`/libmagic existent ; `clamscan` et `clamdscan` sont absents du PATH dental-ai ; aucun analyseur réel n'est raccordé. Tables 0006/0007, orchestrateur en flux et associations sont du code/propositions, pas une recette PostgreSQL réelle. Les routes de messagerie ne sont pas montées.

## Décisions bloquantes

1. Réserver une capacité **physiquement bornée** distincte du simple `df` partagé : proposition d'un fichier image ext4 préalloué, monté en loop sous `/srv/dental-lab-private`, hors Git et du web. La taille B, la marge minimale libre sur `/dev/sda1`, le budget temporaire/quarantaine, la concurrence maximale et les seuils d'arrêt doivent être approuvés après inventaire des besoins des autres applications. Une image sur le même disque n'isole pas l'I/O ni la panne du disque. Pas de `fallocate`/`mkfs`/`mount` avant cette décision et une fenêtre administrateur. Vérifier la couverture OVH de cette image et surtout une restauration cohérente avec PostgreSQL ; le backup du disque ne prouve pas cette cohérence.
2. Un compte de runtime dédié, différent de `dental-ai`, et le groupe/ACL minimal doivent être validés. Racine proposée root:root 0711, point de montage root:runtime-group 0710, objets et temporaires runtime-user:runtime-group 0700/0600, `umask 077`. Aucun Nginx/PM2/web ne reçoit accès au groupe, aucun chemin utilisateur utilisé comme clé. Autoriser le chemin dans `ReadWritePaths` de la future unité applicative uniquement ; ne pas élargir `dental-ai-remote.service` pour tester.
3. Un scanner externe réellement maintenu et borné (p. ex. ClamAV dédié) doit être sélectionné, installé et réceptionné séparément. L'accès à son socket n'est accordé qu'au runtime, avec versions de signatures, délais, mémoire/CPU et comportement indisponible = rejet/quarantaine. `file`/magic, extension et MIME ne prouvent ni la validité complète ni l'absence de malware. Pour STL/PLY/OBJ/JPG/PNG/HEIC/PDF : parseurs bornés et tests de fichiers tronqués, polyglottes, bombes et métadonnées. Aucun fournisseur ou scanner n'est réputé approuvé ici.
4. Politique de réservation persistée sous verrou transactionnel dans PostgreSQL, budget global B et réservations par session/assemblage/dérivés ; `SUM(reserved + used)` avec compteur atomique, sans lire `df` pour arbitrer chaque demande. Arrêt des admissions si réserve d'hôte sous la marge choisie, scanner indisponible, politique absente, ou dépassement. Limites métier existantes : 200 000 000 octets/fichier et 1 000 000 000 octets/commande initiale ou message ; aucun quota cumulatif conversation inventé.
5. Publication : écrire fragments à noms opaques et `O_NOFOLLOW|O_EXCL` sous répertoire privé, `fsync` fichier + répertoire, sceller et analyser l'objet immuable ; `rename` atomique sur le même montage vers la clé définitive (jamais overwrite), `fsync` destination. Persister ensuite `ready` et preuve dans une transaction SQL ; un objet publié sans reçu SQL reste **orphelin conservé**, et un `ready` SQL sans objet lisible bloque téléchargement et déclenche incident. L'association à une version/message se fait après contrôle courant du parent et du fichier dans sa transaction. Ne pas promettre l'atomicité PostgreSQL+filesystem.
6. Journal durable de phases et leases expirables, corrélés par ID serveur. Après timeout, COMMIT incertain ou redémarrage : lire l'état SQL autoritatif, verrouiller session/objet et associations dans l'ordre documenté, vérifier présence/hash/tailles, marquer incident ou reprise idempotente ; jamais supprimer sur la seule absence d'une réponse HTTP. Les expirations peuvent arrêter une session non liée ; la purge différée exige une politique TTL/rétention approuvée, un verrou, une double vérification d'absence d'association et une quarantaine préalable. Jamais effacer images/preuves v1–v3 ou fichier historique lié.

## Vérifications administrateur en lecture seule à faire approuver

Sur le VPS exact, session administrateur, **sans redirection vers fichier** :

```bash
hostname -f
findmnt -T /srv/dental-lab -o SOURCE,TARGET,FSTYPE,OPTIONS
findmnt -R /srv/dental-lab -o SOURCE,TARGET,FSTYPE,OPTIONS
df -B1 /srv/dental-lab
lsblk -o NAME,TYPE,SIZE,FSTYPE,MOUNTPOINTS
stat -c '%a %U:%G %n' /srv /srv/dental-lab /var/lib /var/lib/dental-lab-files /srv/dental-lab-private 2>&1
systemctl show dental-ai-remote.service -p User -p Group -p MemoryMax -p CPUQuotaPerSecUSec -p TasksMax -p ProtectSystem -p ReadWritePaths -p NoNewPrivileges --no-pager
dpkg-query -W 'clamav*' 'libmagic*' 'libheif*' 2>&1
systemctl list-units 'clamav*' --all --no-pager
ss -xlpn | grep -E 'clamd|dental' || true
```

La vue OVH doit confirmer explicitement que l'image proposée sera sauvegardée et qu'une restauration **testée isolément** remet ensemble objet + base au point cohérent. Les sorties de `ss` peuvent révéler des noms de processus des voisins : ne transmettre que les lignes Dental/clamd expurgées. Ces commandes ne prouvent pas la capacité réservée ni un scanner fonctionnel.

## Proposition de recette séparée, non exécutée

Après validation des valeurs B/marge/TTL/concurrence, du compte runtime, des sauvegardes et de la maintenance des signatures, faire préparer par l'administrateur un script versionné à empreinte : création de l'image préallouée et du filesystem sous un chemin root dédié, montage loop `nodev,nosuid,noexec`, permissions ci-dessus, unité dédiée avec `ReadWritePaths` strict, et refus de démarrage si montage/scanner/réserve absents. **Aucune commande destructrice `mkfs`, montage ou changement systemd n'est fournie comme prête à coller avant que ces valeurs et le chemin de l'image soient figés.** L'image ne doit pas se trouver sous une racine Git ni dans une preuve v1/v2/v3.

Recette sur environnement indépendant et données synthétiques, avec empreintes et état avant/après : deux réservations concurrentes au seuil B, `ENOSPC` injecté, scanner absent ou timeout, fichiers faux/tronqués/polyglottes, substitution symlink et traversal, crash avant/après rename et avant/après COMMIT, réponse COMMIT perdue, reprise des fragments, session expirée et attachement concurrent à la purge, refus intercliniques et révocation pendant téléchargement. Vérifier SQL 0006/0007 et privilèges réels avec rôle applicatif dédié, contrainte FK, dédoublonnage, verrous et rollback, comparer les services et démonter proprement l'environnement de recette **sans toucher aux images historiques**. Ne jamais utiliser les doubles TypeScript comme preuve de cette réception.

**Stop immédiat** si permissions plus larges, disque partagé sous marge, image non couverte/restaurable, absence de scanner qualifié, fuite d'octets ou de métadonnées, divergence SQL/objet non réconciliable, comportement de purge ambigu, processus/montage résiduel, ou variation des services existants. Conserver journaux et marqueurs pour diagnostic, sans assouplir les contrôles.
