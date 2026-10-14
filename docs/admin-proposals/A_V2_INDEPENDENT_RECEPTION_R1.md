# Clôture indépendante A v2 et contrôleur B r1 — proposition NON EXÉCUTÉE

14/10/2026. Historique conservé : commit105d443. Décision utilisateur :
A v2 techniquement réussie, réception administrative incomplète.
Cette révision prépare uniquement des fichiers et des tests sans privilège.
Elle n'autorise ni inspection administrateur, ni attestation, ni démarrage B.

## Différences précises

| Zone | Historique v2 | Nouvelle révision r1 |
|---|---|---|
| Gestion ERR | Héritée dans les substitutions, actions systemctl possibles dans un enfant, stdout capturé | Gestionnaire limité au shell principal pour les actions ; diagnostics stderr avec code/ligne/commande |
| Capture des sorties | test directement autour de $(commande) | capture explicite dans if, code de retour propagé |
| Absence de montage | findmnt -M sans résultat déclenche ERR | inventaire findmnt réussi puis recherche en Bash, détection des sous-montages |
| Absence de loop | code losetup masqué par test -z | succès de losetup exigé avant test de sortie vide |
| Absence de processus | pgrep 1 normal | même règle, plus existence du compte exigée ; autres codes refusés |
| Comparaison services/configs | substitution de processus <(state/configs) | producteur vérifié avant comparaison ; aucun <(...) |
| Preuve A | A.ok écrit uniquement à la fin du script A | attestation indépendante calculée après vérification des preuves existantes |
| Condition de B | A.ok | attestation root400, versionnée et liée aux preuves/image/scripts, revalidée intégralement |
| Écritures de supervision | dossier historique et écrasement possible | dossier control-r1 séparé, noclobber, tentative exclusive, pas de rejeu |
| PostgreSQL/SQL/confinement | runner/bundle/unité v2 | strictement inchangés |

Le gestionnaire nouveau n'arrête que dental-pg-recipe-v2@test.service,
et seulement si ce shell principal a demandé son démarrage.
Une erreur avant demande ne déclenche aucun stop. Aucun stop/reset-failed v1.
La suppression des effets du gestionnaire dans les enfants ne remplace pas la vérification
des codes : capture propage l'échec au parent. Ne pas entourer arbitrairement les fonctions
de supervision d'un if/|| qui désactiverait les garanties de set -e dans leur corps.
Les éventuels messages du gestionnaire enfant restent sur stderr, jamais dans la valeur capturée.

## Fichiers nouveaux

Dans docs/admin-proposals :
- accept-a-v2-r1.py : inspect, attest, verify.
- reception-v2-common-r1.sh : fonctions Bash corrigées, aucun effet au simple source.
- reception-v2-b-r1.sh : supervision B exclusivement sur attestation indépendante.
- PG_RECIPE_V2_CONTROL_R1_SHA256SUMS : manifeste de ces trois programmes.
- A_V2_INDEPENDENT_RECEPTION_R1.md : ce dossier.
Dans tests/migrations :
- test_reception_control_r1.py : mocks uniquement, jamais de service réel.

Les fichiers historiques, manifestes, images, journaux et marqueurs ne sont pas remplacés.
Aucune modification du bundle v2, de la migration0005 ou du runner interne.
Aucun nouveau script A : l'enveloppe et son isolation ne sont pas rejouées.
A.ok doit rester absent ; sa présence inattendue provoque un refus.

## Validation indépendante

Le validateur exige :
1. Console root sur vps-28bf7789 dans les namespaces hôte, dossiers root700.
2. Manifeste historique au SHA approuvé et sept artefacts conformes ; unité installée identique.
3. A.attempt, date de départ, A-service success/0 inactive/dead, journal avec JSON d'isolation.
4. Identité complète du JSON identique à celle de l'image, UID/GID et contexte d'isolation corrects.
5. Services/configurations/sockets avant/après identiques et conformes à l'état actuel.
6. Readiness PG production réussie ; toutes les unités v2 arrêtées, aucun processus/montage/loop v1/v2.
   v1 failed est volontairement accepté ; ce n'est pas un résultat de test positif.
7. Lecture de l'image par debugfs SANS -w, sans montage :
   répertoire de recette contenant uniquement isolation.json (hors . et ..),
   aucun marqueur d'approbation test, runner interne identique, identité conforme.
8. Image root600 de512Mio ; empreinte calculée avant/après inspection ; absence de résidus revérifiée.
9. Aucun début de B historique ou r1 ; pas de réutilisation automatique après tentative.

debugfs peut retourner0 en présence d'une erreur interne : tout diagnostic autre que sa bannière
est bloquant, tout JSON/listing inattendu également. Aucune relaxation automatique.
Les droits propriétaire/configs existants restent inchangés ; les empreintes portent sur leur contenu.
Le validateur ne lit aucune base ni aucun contenu d'une autre application.

inspect affiche le résultat seulement.
attest refait les contrôles et crée UNE FOIS :
/root/dental-pg-recipe-v2-control-r1/A-v2-attestation-r1.json
Ce fichier root400 contient date UTC, version, SHA du validateur/manifeste r1,
SHA de chaque preuve et artefact historique, identité et SHA de l'image.
Création O_EXCL et fsync ; un fichier partiel après interruption reste en place et bloque un rejeu.
Il ne s'agit pas d'un A.ok recréé : son origine et sa portée indépendante sont explicites.
verify refait les contrôles et refuse une attestation absente, périmée par modification,
incohérente, de mauvais propriétaire/type/mode ou liée à un autre validateur.
Cette attestation n'est ni une autorisation B ni une preuve de restaurabilité OVH.

## Procédure proposée — ne pas exécuter avant autorisation

Fenêtre calme, aucune autre intervention administrateur sur les recettes.
Conserver une console accessible ; ne pas relancer A.
La commande suivante crée uniquement un nouveau dossier de contrôle et copie les trois programmes.
Elle ne touche pas au dossier historique.

```bash
sudo bash --noprofile --norc <<'SH'
set -euo pipefail
umask 077
test "$(id -u)" = 0
test "$(hostname)" = vps-28bf7789
control=/root/dental-pg-recipe-v2-control-r1
test ! -e "$control"
test ! -L "$control"
install -d -o root -g root -m 700 "$control"
cd "$control"
for n in accept-a-v2-r1.py reception-v2-common-r1.sh reception-v2-b-r1.sh; do
 runuser -u dental-ai -- cat "/srv/dental-lab/docs/admin-proposals/$n" > "$n"
done
runuser -u dental-ai -- cat /srv/dental-lab/docs/admin-proposals/PG_RECIPE_V2_CONTROL_R1_SHA256SUMS > CONTROL_SHA256SUMS
printf '%s\n' '3aee2649215abefa8a8d5fe638a672770c6755d4d7196e9735f6e5aa6a86d313  CONTROL_SHA256SUMS' | sha256sum -c -
sha256sum -c CONTROL_SHA256SUMS
printf 'R1_STAGED_ONLY\n'
SH
```

Inspection en lecture seule, après autorisation :
```bash
sudo python3 -I /root/dental-pg-recipe-v2-control-r1/accept-a-v2-r1.py inspect
```
Attendu : A_V2_EVIDENCE_INSPECTION_PASSED et inventaire JSON.
Arrêt pour examiner le rapport. Si refus, conserver l'erreur et les preuves ; ne pas modifier
un fichier ou un contrôle pour faire accepter la tentative.

Production de l'attestation, après autorisation de clôture indépendante :
```bash
sudo python3 -I /root/dental-pg-recipe-v2-control-r1/accept-a-v2-r1.py attest
```
Attendu : A_V2_INDEPENDENT_ATTESTATION_CREATED. Arrêt.
Aucun A.ok et aucun démarrage. La validation complète est répétée avant cette écriture.

Seulement après une NOUVELLE autorisation explicite de B :
```bash
sudo bash /root/dental-pg-recipe-v2-control-r1/reception-v2-b-r1.sh
```
Attendu : attestation vérifiée, inspection image/bundle conforme, deux résultats SQL passed,
huit groupes linked dont six courses, arrêt PG propre, vérifications hôte conformes,
B_V2_R1_TECHNICAL_CHECKS_OK.
Une attestation valide ne fait jamais démarrer B toute seule.

## Risques et limites

- Aucune modification admin à cette étape de préparation. Les tests remplacent les commandes
  système par des fonctions simulées ; aucun start/stop/mount réel.
- L'inspection root lit deux fois l'image512Mio (environ1Gio de lecture) et les archives.
  Charge I/O/CPU transitoire possible sur ce VPS partagé ; ce n'est pas un test sans coût.
  Elle n'écrit pas dans l'image, mais les accès peuvent actualiser des métadonnées d'accès du FS hôte.
- Aucun montage pour l'attestation. B conserve ses montages privés et écrit dans l'image v2
  UNIQUEMENT lors d'une exécution B ultérieure autorisée ; l'image v1 n'est jamais réutilisée.
- Les limites B restent768Mio/swap0/CPU50%/48tâches/image512Mio/5min et les critères d'arrêt inchangés.
  IOWeight10 reste une priorité relative. Surveiller également la latence métier.
- Une empreinte/attestation root locale ne protège pas contre un administrateur malveillant
  ni contre une modification concurrente après le dernier contrôle : fenêtre sans autre chantier obligatoire.
- La réussite des contrôles actuels ne reconstitue pas tous les événements passés.
  L'attestation accepte les preuves d'isolation et de non-interférence, pas le succès du shell A historique.
- Reçus production toujours non inspectés par dental-ai ; aucune décision de migration production.
- En cas d'échec, garder attestations/tentatives/images ; pas de nettoyage ni reprise automatique.
  Si B r1 avait démarré, seul son service v2 est arrêté. Après erreur de montage, ne rien rejouer.

## Résultats de préparation

Tests unitaires Bash/attestation avec mocks ; tests de préservation byte-à-byte des fichiers
administrateur présents au commit105d443 ; syntaxe Bash et Python incluant les blocs embarqués.
Résultats chiffrés dans le rapport de livraison. Aucun essai privilégié du validateur ou de B réalisé.
