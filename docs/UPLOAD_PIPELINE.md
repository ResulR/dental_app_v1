# Pipeline de réception privé — préparation, sans activation

État au 20 octobre 2026, départ e2bd530.

## État réel audité
Le module files contenait le pipeline de logo à ports obligatoires et les limites
de transfert. Aucun adaptateur de stockage, scanner ou réservation de capacité
n'est composé dans le runtime. Les tables 0006 et 0007 prévoient les fichiers,
sessions, fragments et associations aux versions de commandes/messages ; leur
présence dans les migrations ne prouve ni réception SQL ni activation.
Les créations/modifications de commandes et retouches conservent leur refus
files_not_ready. Aucun endpoint de transfert n'est ajouté.

## Implémentation
createUploadPipeline reçoit une politique explicite maxChunkBytes et cinq ports
obligatoires. Admission serveur avant consommation, réception avec backpressure,
taille exacte, limite mémoire par fragment avant copie, SHA-256 incrémental,
scellement et comparaison des preuves, validation complète et analyse, puis
finalisation privée. ready ne signifie jamais attaché, commande créée ou message
envoyé. Aucun buffering du fichier complet.

claim doit vérifier identité/session actuelles, clinique, destination, permissions,
expiration et capacité réservée, puis revendiquer la session atomiquement entre
processus. Les répétitions/concurrences sont refusées busy par l'adaptateur, sans
présenter un verrou JavaScript comme une garantie SQL. Une erreur ou réponse perdue
de claim exige une réconciliation durable de la réservation par l'adaptateur.
Aucun chemin, objet ou lease ne vient directement du navigateur.

open doit créer exclusivement un objet privé sous la réservation, sans suivi de
symlink ni remplacement, respecter le signal et fermer ses descripteurs lors de
recover. seal retourne taille/hash des octets réellement stockés et rend l'objet
immuable. inspect valide entièrement STL/PLY/OBJ/JPG/PNG/HEIC/PDF et analyse cet
objet immuable sous budgets approuvés. Une signature ou une attestation fictive
ne valide pas un fichier. Les doubles des tests ne sont pas des scanners.

ready doit revalider sous transaction les droits actuels, lease, preuve immuable
et capacité ; persister état et audit ensemble. La transaction métier ultérieure
doit vérifier et verrouiller les associations, appliquer les limites cumulatives
et créer versions/événements/audit atomiquement. Ce branchement reste à faire.

Échec avant finalisation : recover(rejected), uniquement sous verrou de lease et
après vérification d'absence d'association ; conserver les fragments vérifiés
reprenables selon TTL/politique approuvés. Réponse de commit inconnue :
recover(uncertain), conservation impérative jusqu'à interrogation autoritative.
Échec de récupération : reconciliation_required explicite, sans seconde tentative
de suppression. Ni nettoyage réel ni tâche de purge ne sont introduits.

Les sources et adaptateurs doivent respecter l'annulation et une deadline
opérationnelle : le générateur ne peut interrompre seul une attente réseau bloquée.
Le plafond mémoire des fragments, les budgets d'analyse, TTL, réserve disque et
concurrence ne reçoivent aucun défaut implicite.

## Validation et limites
Commande non privilégiée : python3 scripts/run-quality.py test:upload-pipeline
(après build:api). Tests avec octets fictifs en mémoire ; aucun transfert réel,
fichier patient, SQL, analyseur, route ou stockage public.

Restent indispensables avant activation : racine privée et droits vérifiés,
capacité effectivement réservée indépendante du simple espace libre, budgets/TTL
approuvés, adaptateurs durables avec réconciliation, validation de formats et
scanner réels, permissions de consultation/téléchargement et cloisonnement,
associations transactionnelles commandes/retouches/messages, interfaces albanaises,
réception PostgreSQL/concurrence réelle et recette du stockage.
L'absence d'adaptateurs bloque ces transferts ; elle ne clôt pas le chapitre 12.

## Associations initiales — 20 octobre 2026
prepareNewOrderFiles est appelé dans les transactions existantes de soumission
clinique et de retouche. Sans politique fournie par la composition serveur, les
fichiers restent refusés ; le runtime n'en fournit aucune. Une politique versionnée
n'est pas en soi une attestation de disponibilité du stockage/analyseur.

Le chemin préparé verrouille les objets triés puis les sessions triées, contrôle
clinique/auteur, état ready, intégrité, versions de politique, destination et
expiration. Les tailles viennent de la base : 1 Go pour la création initiale,
200 Mo/fichier sans plafond cumulatif inventé pour la retouche. Une retouche est
une nouvelle commande : son upload initial vise la commande source validée,
puis est rattaché au nouvel enfant. Les fichiers déjà liés sont refusés par ce
chemin ; leur réutilisation historique exige un chemin explicite distinct.

Association de version, événement fichier, commande, lien de retouche, audit et
reçu restent dans une transaction unique. Expiration après préparation ou échec
d'association provoquent une exception et le rollback, jamais un résultat partiel.
Les futurs nettoyeurs/réconciliateurs devront respecter le même ordre de verrous
et contrôler les associations sous verrou avant toute suppression.
Tests transactionnels avec doubles ; verrous/SQL/contraintes réels non réceptionnés.
Messages et modifications de versions ne sont pas encore raccordés à ce chemin.

## Consultation intégrée — 20 octobre 2026
POST /api/v1/orders/files utilise la session et l'origine vérifiées du suivi :
order_id/version_id obligatoires, curseur after facultatif, aucune clinique fournie
par le client. Le parent courant est verrouillé et filtré par clinique ; au labo,
orders.read_logistics + orders.read_details + files.view sont nécessaires.
files.download seul ne donne pas accès à cette consultation. Retouches incluses
comme commandes ; ni suivi interne ni messages ni versions historiques ajoutés
implicitement.

Réponse paginée de 50 métadonnées (aucune limite métier du nombre de fichiers) :
id, nom original échappé par React, format et taille, sans hash/path/object_key.
Uniquement les objets ready de la version courante. Le contrat annonce
download_available:false ; aucun endpoint de transfert binaire n'est créé.
Le panneau albanais est intégré à la fiche du travail, gère chargement/erreur,
pagination, annulation et changement de version. Il n'affiche pas de succès
d'upload ni de bouton de téléchargement simulé. Recette navigateur reportée.

Audit non privilégié 20/10/2026 14:52 UTC : /dev/sda1 dispose de
56 180 101 120 octets disponibles ; ce chiffre n'est PAS une réserve attribuée.
clamdscan et clamscan absents du PATH dental-ai ; cela ne prouve pas l'absence
de tout analyseur sur le VPS. Aucun adaptateur d'analyse opérationnel ni racine
privée/capacité réservée validée dans la composition applicative.
Avant activation : décision de stockage/réserve, budgets/TTL, validation des
formats et analyseur, puis réception du stockage et SQL. Aucune installation
globale ni activation effectuée. Le prochain travail applicatif indépendant
reste l'association des messages et les accès aux catégories supplémentaires.
