# Rétention, sauvegardes et reprise — conception 3.10

Sources : CDC §§8, 11–12, 14–17 ; [fichiers](files-lifecycle.md), [brouillons/R15](drafts-sync.md), [événements/audit](events-notifications-audit.md), [architecture](../architecture.md). Conception uniquement ; aucun backup, export, effacement, restauration, configuration ni accès supplémentaire exécuté.

## Catégories et politique

| Catégorie | Conservation décidée / décision restante | Traitement et cohérence |
|---|---|---|
| Travail Livré et archive UI | Archive30jours après livraison effective ; durée légale du travail non fixée | Statut Livrée inchangé, données/fichiers/chat/historique accessibles selon droits ; retouche possible |
| Livraison corrigée | Échéance précédente invalidée ; nouvelle livraison réelle relance délai UI | Mise à jour atomique du marqueur/génération archive, pas de suppression |
| Versions et filiation de travaux | Durée légale/contractuelle et exceptions à valider R08 | Préserver chaîne tant que justifiée ; décision explicite d'anonymisation/effacement, sans FK cassée |
| Fichiers médicaux/fabrication, versions retirées | Politique par catégorie à valider, pas de purge disque arbitraire | Références/bindings, objets, miniatures/aperçus et index traités ensemble ; verrouillage ≠ conservation éternelle |
| Suivi et messagerie avec pièces | Politique propre à valider, liée à finalité/obligations | Masquage UI distinct d'effacement, versions et textes minimisés lors de décision validée |
| Brouillons serveur | Suppression manuelle, pas de purge métier par âge décidée ; minimisation à réévaluer | Tombstone/version protège conflits ; suppression objets seulement sans autre référence autorisée |
| Coffre local | Même compte/logout conservé ; suppression volontaire et purge suspension au mieux | Pas de sauvegarde du coffre ni récupération admin ; perte stockage/appareil ou des deux secrets selon R15 |
| Fragments/quarantaine/assemblage/ZIP temporaires | TTL et capacité bornés à fixer R07/ch12 | Nettoyage après expiration et absence d'association ; aucune destruction du brouillon local ou objet officiel |
| Audit métier / preuves d'acceptation / incidents | Durées et exceptions légales à valider ; pas de purge libre par UI | Auteur/action/identifiant et différences minimisés ; traitement légal contrôlé distinct du runtime |
| Logs techniques / reçus / notifications / sessions | Durées proportionnées à définir aux modules/opérations | Aucun secret/patient superflu ; expiration technique ne change pas la durée du travail |
| Sauvegardes DB+fichiers |30jours décidés | Rotation de jeux complets restaurables, chiffrés hors VPS ; suppressions légitimes réappliquées avant remise en service |

Durées « à valider » ne signifient ni durée universelle ni conservation indéfinie approuvée. R08 reste ouvert pour conseil compétent/propriétaire avant production et données réelles ; rôles responsables/sous-traitants, localisation/transferts, obligations sectorielles et fondement à confirmer. Aucune conclusion juridique nouvelle n'est produite par cette conception.

## Effacement/anonymisation contrôlés

1. Demande clinique via conversation générale, patient via contact/procédure externe ; vérifier identité/autorité et fondement, pas de tickets dédiés ajoutés.
2. Inventorier les références et catégories concernées, exceptions de litige/conservation ; signaler au propriétaire avant décision.
3. Plan versionné et approuvé : données, versions, messages, associations, dérivés, recherche/caches, audit minimisé et backups ; ne pas archiver30jours puis supprimer arbitrairement.
4. Décision et suppression/anonymisation idempotentes, avec état durable reprenable pour la phase DB/objets. Tant que suppression physique en attente, accès interdit par tombstone, pas d'objet servi après un simple échec de nettoyage.
5. Effacer un objet partagé uniquement si aucune référence restant légalement justifiée, aucun pin backup valide ; supprimer dérivés et index associés. Garbage collector ne résout pas la capacité en effaçant des travaux.
6. Registre minimisé de décisions de suppression, protégé et sauvegardé séparément des anciens jeux à restaurer, permet leur réapplication. Pas de copie des données à supprimer dans ce registre ; durée et accessibilité juridique à valider.
7. Purge backups selon fenêtre30jours, suppression légitime après restauration avant exposition ; ne pas promettre disparition instantanée des copies chiffrées historiques ni des téléchargements externes.

Le journal global est immuable applicativement ; éventuelle rétention légale se traite par procédure exceptionnelle approuvée, sans bouton purge et avec preuves minimisées. Supprimer/anonymiser ne crée pas un motif de garder indûment patient/texte dans l'audit.

## Plan DB-fichiers cohérent

Candidat technique H310-01 réversible : dump logique de la seule base dental_lab et manifeste de fichiers sous le même snapshot PostgreSQL17 ; objets finalisés immuables. Aucun pg_dumpall/backup global du cluster partagé, aucun autre service/base. Comptes et accès sauvegarde/restauration seront distincts, limités, approuvés administrateur au chapitre19 ; dental-ai reste audit.

Protocole proposé :
- Acquérir un pin de sauvegarde borné avant le snapshot : le nettoyeur/purge ne détruit aucun objet pouvant appartenir à ce jeu ; coordonner pin et suppressions concurrentes sans bloquer indéfiniment. Paramètres/timeout et limite mémoire/IO à auditer pour VPS partagé.
- Ouvrir un snapshot cohérent, exporter son identité ; dump et requête du manifeste utilisent ce même snapshot. Maintenir la transaction source jusqu'à acquisition/usage complet requis par les lecteurs, borner sa durée.
- Manifeste = identités opaques, taille/hash/version des objets finalisés référencés dans ce snapshot, y compris brouillons serveur et historiques encore retenus. Pas de nom patient dans les journaux de backup. Transferts partiels/ZIP temporaires exclus des données à garantir.
- Copier les objets immuables correspondants vers destination hors VPS approuvée, avec chiffrement authentifié et vérification intégrité ; ne jamais substituer un fichier d'une révision récente. Dérivés soit inclus explicitement, soit marqués régénérables à partir d'originaux vérifiés.
- Jeu porte snapshot_at, fin de copie, versions application/migrations/format, manifeste et empreintes. « Valide » uniquement si dump terminé sans erreur, objets requis tous présents/identiques, chiffrement et contrôle distant confirmés ; jeu partiel = failed, aucun succès silencieux. Relâcher les pins après copie certaine ou abandon contrôlé.
- Préserver chaque jeu pendant30jours et les objets communs jusqu'à expiration du dernier jeu qui les référence. Ne pas supprimer une base de chaîne/dépendance encore nécessaire ; restore complet vérifié, pas seule liste de fichiers.

Documentation PostgreSQL17 consultée10/10/2026 : https://www.postgresql.org/docs/17/app-pgdump.html et https://www.postgresql.org/docs/17/backup.html. pg_dump cible une base et --snapshot permet la coordination de sessions ; cela ne rend pas le stockage binaire transactionnel. L'algorithme de pin/manifeste reste à implémenter et éprouver. Dump logique répété n'est pas encore une preuve de RPO/RTO sur volumes réels ; si insuffisant, réviser architecture avec administrateur sans élargir au cluster partagé par défaut.

## Objectifs mesurables et secrets

RPO maximum1h : âge réel du dernier snapshot cohérent dont DB ET fichiers sont déjà disponibles hors VPS, évalué à l'incident ; planifier fréquence et marge de copie en conséquence. Une tâche démarrée chaque heure ne prouve pas ce seuil si son transfert échoue ou dure trop longtemps. Alerter P sur retard/échec, avant dépassement ; surveillance indépendante si possible.

RTO cible4h : mesurer depuis déclenchement de reprise jusqu'à application vérifiée utilisable (DB, fichiers, droits, sessions et intégrité) sur scénario/volume représentatifs. Ne pas promettre cette cible avant exercice chronométré. Cadence d'exercices, destination, capacité/débit, fournisseur, emplacement légal et budget restent décisions opérationnelles R09/ch19.

Clés de backup distinctes de la phrase/code R15 et du mot de passe applicatif. Stockage et secours des clés hors jeux chiffrés, responsables/accessibilité contrôlés, rotation/révocation/recouvrement éprouvés. Choix outil/fournisseur et permissions à approuver ; aucun secret dans Git/env-example/logs/commandes. Pas de générateur de clés, compte ou service installé ici.

## Reprise et non-réapparition des données supprimées

- Intervention administrateur explicitement approuvée, cible isolée dédiée au projet et fichiers protégés, jamais écraser une base/service voisin. Valider les sources/empreintes et plan retour arrière avant restauration.
- Restaurer sans exposition publique ni émission externe ; suspendre workers e-mail/jobs métier/flux et invalider anciennes sessions/tokens sensibles selon procédure de reprise, afin de ne pas rejouer aveuglément l'outbox historique.
- Restaurer DB et objets du même jeu, vérifier références/hashes, schéma/versions et droits minimaux. Objet absent ou mismatch = reprise non validée, pas de substitution silencieuse.
- Réappliquer toutes les décisions de suppression légitimes postérieures au snapshot depuis le registre protégé ; contrôle des versions, objets/dérivés et tombstones avant remise en ligne. Pas de restauration durable des données effacées.
- Réconcilier reçus métier et envois déjà remis au fournisseur : aucune duplication de commande ni relance d'anciennes notifications sans utilité/droit actuel. Réinitialisation de séquences publiques/numéros doit préserver invariants et preuve après sinistre.
- Tests synthétiques d'accès interclinique, lecture/download/ZIP, filiation/retouches, état maintenance, audit et reprise fichiers ; chronométrer et signer preuve administrateur.
- Autoriser la remise en service uniquement après contrôles et acceptation nécessaires. Informer des limites RPO mesurées. Aucun coffre local non synchronisé n'est recréé par la restauration serveur.

## Matrice de panne à vérifier plus tard

| Panne/course | Résultat requis |
|---|---|
| Upload nouveau pendant snapshot | Référence visible dans snapshot → objet présent ; sinon hors jeu sans corrompre celui-ci |
| Suppression/GC pendant copie | Pin empêche perte d'un objet du jeu ; décision post-snapshot réappliquée au restore |
| Dump ou objet distant incomplet | Jeu failed, dernier jeu valide conservé, alerte critique P |
| Perte clé de backup | Exercice de secours selon procédure ; aucune prétention de récupération sans clé |
| Snapshot ancien contenant donnée supprimée | Réapplication avant exposition, pas de réapparition durable |
| Livraison corrigée pendant archive | Génération/échéance recontrôlée ; aucune archive sur ancienne livraison |
| Manque de place / fournisseur inaccessible | Refus/échec explicite et alerte ; aucun nettoyage des données officielles pour réussir |
| Perte navigateur/coffre | Seul serveur réellement synchronisé reprend, aucune fausse garantie de backup local |

Validation3.10 limitée au plan de catégories, suppression et cohérence DB-fichiers. R08/R09 et tests restauration/sécurité/conformité restent ouverts aux jalons dédiés ; aucun transfert réel ou durée juridique inventée.
