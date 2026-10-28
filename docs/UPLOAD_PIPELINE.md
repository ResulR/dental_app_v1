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
Les messages ont désormais leur association préparée distincte (voir ci-dessous),
mais les modifications des versions de commande ne sont pas encore raccordées.

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

## Association préparée des messages — 20 octobre 2026

Le module `messaging` prépare `POST /api/v1/messages`, sans enregistrement dans
le runtime. Un texte seul peut être persisté par le service préparé ; pour tout
`file_id`, l'absence de politique explicite de stockage et de capacité entraîne
`files_not_ready` sans écriture. Le serveur contrôle à nouveau identité,
session, clinique approuvée ou permissions laboratoire (`messaging.*.reply`,
`files.view`), conversation ciblée, fermeture et clé d'idempotence. La réponse
n'annonce `sent` qu'après la transaction. Une répétition de même clé avec le
même contenu renvoie le reçu ; une autre charge utile renvoie `conflict`.

Dans la même transaction, sous verrou de conversation et verrous ordonnés des
fichiers/sessions, le chemin préparé exige état ready, preuve SHA-256 et format
vérifié, propriétaire et clinique identiques, versions de politique explicites,
destination `message` et conversation exacte, session non expirée et taille
cohérente. Il refuse les doubles et toute association antérieure à une version
de commande, un suivi ou un message. Limites : 200 Mo par fichier et 1 Go par
message. Le numéro séquentiel, le message, sa version, les liens vers les
fichiers, événements fichiers/outbox et audit sont écrits atomiquement ; une
expiration tardive ou un conflit annule l'ensemble. La FK composite de
`message_version_files` protège aussi la clinique au niveau SQL. Les tests
utilisent un double transactionnel ; ni contraintes PostgreSQL ni verrouillage
réel n'ont été reçus pour ce code.

Aucun adaptateur réel de stockage privé, réservation durable ou analyse de
sécurité n'est installé dans cette composition. L'espace libre du disque ne
constitue pas une réservation ; l'absence des binaires dans le PATH ne suffit
pas à qualifier un analyseur. Le pipeline ne doit pas être composé avec une
politique de test. Aucun upload, téléchargement, purge, reprise, interface
d'envoi ou succès de transfert n'est activé. Avant composition : décisions
explicites sur racine privée et ACL, réserve réelle, budgets/TTL et format,
analyseur qualifié, stratégie de réconciliation après COMMIT incertain,
réception PostgreSQL et stockage sous concurrence, puis recette d'accès aux
fichiers et habilitation de chaque destination. Les objets temporaires ou
incertains restent conservés jusqu'à une réconciliation autoritative ; aucun
nettoyage automatique n'a été ajouté.

La consultation des seules métadonnées de la version courante d'un message est
également préparée sous `POST /api/v1/messages/files`, sans montage runtime.
Elle verrouille le parent autorisé et exige la conversation de la même clinique,
le message non masqué et sa version courante ; au laboratoire, `files.view` et
`messaging.order.read` ou `messaging.general.read` sont requis. Seuls les objets
ready vérifiés sont paginés. Aucun chemin, hash ni octet n'est retourné et
`download_available` vaut toujours false. Sans API de lecture des conversations
réceptionnée, aucun panneau albanais de messagerie ou téléchargement n'est
annoncé actif.

## Fondation du stockage privé et filtrage — 28 octobre 2026

`private-object-store.ts` est une primitive de stockage locale non composée : exige une racine absolue préprovisionnée, ses sous-répertoires privés `quarantine`/`objects` et des frontières publiques explicites. Elle refuse les répertoires permissifs ou symboliques, crée un nom UUID exclusivement et écrit des fragments copiés, sans charger l’objet entier. Le scellement synchronise les octets, interdit l’écriture, crée exclusivement le lien final privé et conserve les traces en cas d’échec incertain. L’abandon ne supprime que le temporaire du même inode avant scellement. Tests en répertoires synthétiques privés du projet. Aucun chemin de stockage de production n’a été créé.

`format-probe.ts` est un filtre préliminaire borné à 4 Kio en tête/fin, pour STL, PLY, OBJ, JPG, PNG, HEIC et PDF. `candidate` signifie seulement que quelques marqueurs correspondent ; ce n’est pas une validation structurelle complète, une garantie d’innocuité, une analyse anti-malware ou une autorisation de publier. Le pipeline exige toujours un inspecteur indépendant avec parser complet et scanner qualifié. Ni le filtre ni l’adaptateur ne sont composés avec `createUploadPipeline` dans le runtime. Le stockage ne dispose pas encore de réservation de capacité durable, de réconciliation après crash, de route d’upload ou de téléchargement autorisé, ni d’ACL binaire. Les associations de correction, d’édition et de proposition restent donc bloquées pour les fichiers. Les limites 12.3/12.4 existantes continuent à rejeter les dépassements sur flux réels dans leurs tests, mais aucun transfert HTTP n’est activé.

## Fragments et reprise — 28 octobre 2026

La clé d'objet scellé a été alignée sur la contrainte SQL de 64 caractères hexadécimaux. La primitive `private-chunks.ts` utilise le même stockage privé préprovisionné et un sous-répertoire `chunks` privé. Elle reçoit des fragments en flux borné, vérifie leur SHA-256 et leur taille réellement écrite, scelle exclusivement le segment et refuse les répétitions différentes. Une répétition identique n'ouvre pas le flux source, mais ne vaut pas à elle seule reçu SQL : le contrôleur futur doit relire `upload_chunks` sous l'autorisation de session courante. `upload-progress.ts` calcule les index manquants et les octets reçus à partir de reçus SQL déjà autorisés, avec plafond explicite de segments et refus des métadonnées incohérentes.

L'assemblage contrôle ordre, taille par fragment selon `chunk_size`, hash individuel et hash global, sans assembler le fichier entier en mémoire. Un reçu officiel d'objet scellé peut être revérifié pour une répétition sans créer un second objet. Un échec après scellement conserve l'objet privé pour réconciliation ; aucune preuve ambiguë ne le rend ready. Il manque toujours le contrôleur transactionnel des sessions/chunks, l'ACL et la réservation de capacité durable, la politique d'expiration/nettoyage, le parser complet et le scanner, puis la réception PostgreSQL et navigateur. Aucun routeur, worker, téléchargement ou stockage de production n'est activé.

La garde `disk-headroom.ts` refuse une préadmission lorsque l’espace disponible mesuré ne couvre pas les octets entrants et la marge explicitement configurée. Elle échoue en cas de politique absente ou de mesure erronée. La mesure n’est **pas** une réservation atomique : le contrôleur futur doit encore appliquer la réserve durable de capacité de `upload_sessions` sous une politique validée. Aucune pause runtime ni purge automatique n’est activée. Le nettoyage 12.8 reste bloqué par la procédure de réconciliation et les politiques TTL/rétention.

## Contrôleur de session clinique préparé — 28 octobre 2026

`upload-session.repository.ts` relie les tables 0006/0007 au stockage privé pour le seul dépôt initial d’une clinique approuvée. L’admission contrôle les droits avant de révéler la capacité, puis sérialise le total des réservations actives sous un verrou de table bref. La politique de taille, durée, marge disque, plafond réservé et versions est obligatoire ; la réservation vaut deux copies (fragments + assemblage). L’autorité et l’expiration sont relues avant le flux et sous transaction au reçu. Un fragment réellement scellé reçoit une ligne `upload_chunks` et une incrémentation de `received_bytes` dans la même transaction ; une réponse perdue peut être rejouée après comparaison des octets privés et du reçu durable. La progression provient des reçus SQL, jamais du navigateur.

La finalisation verrouille la session, exige des reçus complets, passe à `verifying`, assemble hors transaction, puis insère `file_objects` en état `verifying` et lie `file_id` dans une transaction. Une réponse perdue après COMMIT relit le reçu, compare le hash, le nom et le format déclarés, et revérifie les octets privés, même après l’expiration de la session déjà en vérification. Un crash après la prise de `verifying` mais avant l’attachement SQL laisse `file_id` nul et exige une réconciliation explicite ; le contrôleur ne relance pas l’assemblage. Le format transmis ne sert que de métadonnée déclarée de l’objet non distribuable. Aucun scan ni parser complet, aucune transition ready, aucune route publique, aucun transfert vers la production. Les destinations modifications/messages, la libération et le nettoyage des réservations, l’ACL binaire et la recette PostgreSQL de concurrence restent à développer. Les tests utilisent le code de stockage réel et un double SQL sérialisé ; ils ne prouvent ni syntaxe/privileges ni verrouillage PostgreSQL réel.

## Expiration contrôlée — 28 octobre 2026

`abort` permet au propriétaire autorisé de terminer une session active et de libérer sa réserve ; la répétition n’écrit pas un second événement. `cleanupExpired` n’est accessible à aucune route ni tâche planifiée. Il sélectionne sous verrou `SKIP LOCKED` les seules sessions `initial_order` expirées en `initialized`/`receiving`, sans `file_id` ou destination liée ; `verifying` et `ready` restent réservées, même après expiration. Une transaction passe à `aborted`, remet la réserve à zéro et inscrit `cleanup_claimed`. Une seconde transaction verrouille la session, vérifie le reçu, retire uniquement les fragments nommés par l’UUID de session et les indices bornés, puis inscrit `cleanup_completed`. Une interruption laisse le reçu de revendication et rend la suppression relançable ; les reçus `upload_chunks` restent conservés. La réserve des sessions expirées ne disparaît du calcul d’admission qu’après le marquage durable. Les objets assemblés et les associations métier ne sont jamais parcourus par ce nettoyeur.

Le stockage n’est pas activé en production : la durée de la transaction de suppression sur un transfert très fragmenté, la concurrence et les privilèges SQL doivent encore être reçus sous PostgreSQL isolé. La politique de rétention des événements, les brouillons locaux et les destinations autres que dépôt initial restent à définir/implémenter.

## Inspections et lecture privée préparées — 28 octobre 2026

inspectFileStructure ajoute aux marqueurs de probeFileFormat une vérification bornée des triangles STL binaires et des chunks PNG (CRC, dimensions, ordre terminal). Un résultat candidate ne vaut ni décodage complet du PNG, ni verdict anti-malware ; les cinq autres familles restent sans inspection structurelle qualifiée. Le scan obligatoire n’a pas d’adaptateur fiable et aucun objet n’est promu ready par cette inspection.

createOrderFileDownloadRepository prépare une autorisation interne : identité actuelle et parent commande, version courante, association au fichier, état vérifié ready du fichier et de sa session, files.download distinct pour le personnel. La clinique a son accès intrinsèque limité à sa propre commande. readSealed vérifie sur un descripteur privé le SHA-256 entier avant de produire des blocs de 64 Kio. Aucun chemin ni binaire n’est exposé par une route ; la révocation pendant un long flux, le scanner et la réception PostgreSQL empêchent encore le branchement HTTP.

Le test de nettoyage inclut désormais un fragment scellé sans reçu SQL après interruption : le balayage borné par la session marquée le retire en conservant les reçus d’audit. Une écriture terminée après un marquage de nettoyage est retirée sous le verrou de session lors du contrôle du reçu. Une interruption avant ce contrôle peut encore laisser un fragment orphelin après le nettoyage ; une réconciliation opérateur reste nécessaire, sans purge automatique.

## Intégration privée sans publication — 28 octobre 2026

Le contrôleur expose désormais inspect après finalisation : autorité clinique et reçu SQL de la même session, lecture du descripteur privé, vérification SHA-256 complète, contrôle structurel, relecture de l’état et événement file_events avec verdict. Le fichier reste verifying même pour un candidat ; aucun scanner qualifié ne produit de verdict clean, aucune transition ready ou association métier ne suit. Le test de tranche verticale utilise les véritables modules de stockage, de fragments, de reprise, d’assemblage, d’inspection et d’association ; seul PostgreSQL est remplacé par un double. L’association rejette le fichier non validé. Aucune route publique n’a été ajoutée.

reconcileCleaned est un point d’intervention opérateur explicite sans job : il verrouille une session aborted sans fichier, exige les événements cleanup_claimed et cleanup_completed, puis retire les fragments connus par ses indices. Cela récupère un octet privé arrivé tard après un nettoyage terminé. Il ne couvre pas automatiquement un processus mort avant la vérification terminale ; cette détection et la réception des verrous sous PostgreSQL restent à développer.

Le filtre STL accepte aussi une forme ASCII bornée à 4 Mio et l’inspection impose une grammaire stricte de facettes et de valeurs numériques finies. La variante binaire demeure contrôlée séparément. Un STL structurellement candidat reste verifying faute d’analyse anti-malware qualifiée.

La frontière validation-evidence.ts exige deux ports backend distincts (parseur complet et scanner qualifié), leurs versions et références, un verdict clean et une concordance stricte avec la clé, la taille et le SHA-256 du reçu scellé. Elle recontrôle les octets avant et après analyse et bloque sur absence, erreur, réponse ambiguë, version obsolète ou incohérence. Le contrôleur l’appelle après le filtre structurel si elle est injectée ; aucun port n’est fourni au runtime. Même une preuve interne positive ne déclenche pas ready : il manque une persistance transactionnelle des références, une politique reçue, les véritables adaptateurs et une réception PostgreSQL. Les doubles des tests ne sont pas des analyseurs de sécurité.
