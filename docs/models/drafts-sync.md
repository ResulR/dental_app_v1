# Brouillons local/serveur et synchronisation — conception 3.8

Conception finalisée avec la décision R15 du propriétaire. Depuis le 29/10, une première tranche navigateur est codée : coffre IndexedDB par compte, formulaire textuel scellé, déverrouillage et récupération ; sa persistance réelle sur appareils et son aptitude production ne sont pas validées. Les fichiers, la session hors ligne après rechargement, la synchronisation serveur et les conflits multi-appareils restent à développer. Les tests navigateur demeurent obligatoires aux jalons PWA et sécurité. Pas de donnée médicale ou secret réel créé.

Références : CDC §11, [fichiers](files-lifecycle.md), [versions](orders-versions.md), [comptes](accounts-clinics.md), [architecture](../architecture.md). Ce document n'atteste pas la compatibilité des appareils ni la cryptographie de production.

## Identités, révisions et autorité

Serveur proposé : drafts(id PK, account_id, clinic_id, revision, payload, created_at, updated_at, deleted_at) ; draft_files avec FK de même compte/clinique ; receipts des intentions de synchronisation/soumission. Propriétaire : compte partagé clinique concerné, pas un dentiste individuel. Aucun numéro officiel avant soumission.

Local proposé : namespace par identifiant serveur stable de compte + vault_id ; draft_id/generation, base_server_revision, local_revision, manifeste chiffré et fragments chiffrés. Aucun nom de patient/fichier, instruction ou credential en clair dans localStorage/Cache API. IndexedDB est la cible initiale pour données chiffrées et transactions ; choix/dimensionnement à éprouver aux navigateurs cibles.

Révision serveur monotone pour comparaison ; l'horloge appareil ne tranche aucun conflit. Le catalogue précédemment chargé permet préparation ; au retour réseau, recharger les états actuels, contrôler compte/clinique et avertir/refuser selon règle disponible/indisponible/interdite. Aucune décision officielle acceptée hors ligne.

## Machine de synchronisation

| État local | Événement | État suivant et effet |
|---|---|---|
| locked | Même compte autorisé et déverrouillage valide | clean ou dirty selon révisions persistées ; autres comptes jamais ouverts |
| clean | Édition locale | dirty ; persistance atomique chiffrée, aucun appel de soumission |
| dirty | Hors réseau ou maintenance | dirty/offline ou paused ; préparation locale possible, aucune synchronisation en maintenance |
| dirty | Reconnexion autorisée et sync | syncing_files ; reprendre les segments temporaires existants, sans perdre originaux locaux |
| syncing_files | Fichiers vérifiés disponibles | syncing_metadata ; CAS sur base_server_revision |
| syncing_metadata | CAS/commit réussi | clean ; reçu/révision/fichiers acquittés, conserver local jusqu'à preuve certaine |
| syncing_files / syncing_metadata | Réponse perdue ou réseau coupé | uncertain ; consulter reçu/état avant retry, même intention idempotente |
| syncing_metadata | Révision serveur différente ou tombstone | conflict ; aucun écrasement |
| conflict | Choisir serveur après avertissement d'abandon local | clean après récupération complète ; version locale conservée tant que remplacement non confirmé |
| conflict | Conserver local comme nouveau brouillon | dirty sous nouvelle identité ; fichiers inclus, nouveau CAS/intent ; brouillon serveur existant inchangé |
| clean / dirty | Déconnexion volontaire | locked ; conserver coffre chiffré, effacer clés en mémoire au mieux |
| Tous | Compte suspendu reconnu à reconnexion | blocked ; refus serveur, verrouillage et demande de purge locale au mieux du navigateur |
| Tous | Quota/écriture locale impossible | storage_error ; message explicite, conserver ancien état valide, ne pas prétendre sauvegardé |
| Tous | Chiffrement/intégrité/clé invalide | crypto_error ; pas de donnée partiellement affichée ni remplacement/purge automatique |

Plusieurs onglets du même compte sérialisent les mutations dans IndexedDB et comparent les révisions ; les notifications interonglets ne transportent pas le contenu médical. Migration de format local : nouvelle génération vérifiée avant bascule, jamais supprimer l'ancienne avant réussite certaine. Pas de purge métier par âge ajoutée.

Suppression serveur : tombstone/version pour détecter modification concurrente ; une copie locale dirty ne disparaît pas silencieusement et peut être clonée après confirmation. Nettoyage de fragments temporaires n'efface pas le brouillon métier ni ses fichiers locaux.

## Soumission officielle distincte

1. Action explicite du dentiste en ligne ; contrôles serveur d'approbation, catalogue, contenu et fichiers, limites initiales.
2. Transferts vérifiés et confirmation finale ; intention idempotente conservée jusqu'au reçu certain.
3. Transaction identité/version/fichiers/conversation/audit/outbox, puis acquittement de number/order_id.
4. Si acquittement perdu, vérifier la même intention avant toute nouvelle soumission ; pas de double création après reconnexion.
5. Après preuve certaine, retirer le contenu/fichiers du coffre de brouillon conformément à la finalisation ; ne pas transformer cette copie en cache automatique de la commande envoyée.

Synchronisation peut être reprise en ligne, mais n'émet jamais de soumission officielle automatiquement. Après logout, le retour au même compte requiert l'authentification normale en ligne puis déverrouillage supplémentaire ; l'offline d'une session préalablement ouverte repose sur son contexte local connu, sans prétendre vérifier une suspension distante. Le serveur reste autorité au prochain accès réseau.

## Conception cryptographique candidate sous R15

Enveloppe candidate :
- Clé de coffre aléatoire 256 bits ; phrase locale indépendante du mot de passe de connexion, non transmise au serveur.
- KEK dérivée via Web Crypto PBKDF2/SHA-256, sel aléatoire par coffre et paramètres versionnés ; candidat 600 000 itérations minimum, à calibrer sans abaisser silencieusement sur appareils cibles.
- AES-KW pour envelopper clé de coffre et clés d'objets ; après encapsulation initiale, clés de travail réimportées/unwrap non extractables. L'export transitoire nécessaire au wrapping ne permet pas de promettre effacement mémoire ou résistance XSS.
- Chaque génération d'objet/manifeste a une nouvelle clé AES-GCM 256 bits ; tag 128 bits, IV 96 bits unique par clé, compteur de segment sans réutilisation. Réécriture = nouvelle clé/génération, jamais nouvel encrypt sous même couple clé/IV.
- Données associées authentifiées : version de format, account_id, vault_id, draft/generation, file_id, index et longueur ; manifeste authentifié pour détecter segments manquants, permutation ou collage intercompte. Métadonnées patient et noms sont chiffrés.
- Chiffrement/déchiffrement par portions bornées, pas d'un Go entier ; persister une génération complète/authentifiée avant bascule. Les dimensions de portions seront fixées après mesures navigateur.

Coffre jamais déverrouillé par la seule présence d'un CryptoKey persistant ou par une clé en clair à côté du ciphertext. Clés actives en mémoire seulement après unlock ; révoquer références, object URLs et timers lors de logout/verrouillage, sans garantie d'effacement forensic du navigateur. Aucune clé réelle, code de secours, secret ou phrase dans Git/logs.

Contre-menaces : extraction stockage d'un appareil verrouillé, altération/greffe de ciphertext, mauvais compte, oubli/éviction, copies anciennes. Limites : appareil déjà déverrouillé, malware/XSS et accès à la phrase/code peuvent compromettre le coffre ; un throttle UI ne bloque pas le bruteforce d'une copie hors application. PIN court seul non retenu comme protection suffisante.

## Récupération adoptée — R15 du 10/10/2026

Deux enveloppes indépendantes protègent la même clé de coffre : une sous la KEK dérivée de la phrase ; une sous une clé AES-KW 256 bits issue directement de 32 octets aléatoires générés par crypto.getRandomValues lors de l'initialisation. Ces octets constituent le code de secours encodé pour la remise humaine, sans réduction d'entropie. Un éventuel contrôle de saisie n'est pas un secret additionnel. Code unique par coffre/appareil, distinct de la phrase et du mot de passe de connexion ; ne pas dériver le code de ces mots de passe. Le stockage contient les enveloppes et paramètres publics, jamais les secrets ni les clés déchiffrées.

Changement de phrase : authentification normale au même compte, déverrouillage par ancienne phrase ou code ; unwrap transitoire de la même clé de coffre, nouveau sel et nouvelle KEK de phrase, puis wrap. Vérifier le nouvel unwrap et le manifeste avant bascule transactionnelle IndexedDB. Conserver l'ancienne enveloppe jusqu'au commit ; une interruption laisse l'ancien état utilisable. Ne pas modifier les clés des brouillons/fichiers ni l'enveloppe de secours lors de ce changement. Réimporter les clés actives non extractables ; éviter de prolonger leur présence en mémoire, sans garantie d'effacement physique.

Le code n'est pas une récupération administrateur : aucun endpoint de dépôt/récupération de phrase, code ou clés ; aucun séquestre serveur. La synchronisation transfère le brouillon autorisé selon le protocole métier, pas le coffre, ses enveloppes ou ses clés. Les données serveur synchronisées restent accessibles selon l'authentification et les droits ordinaires, indépendamment de la perte des secrets locaux. Une nouvelle installation peut préparer un autre coffre puis récupérer ces brouillons serveur en ligne ; elle ne récupère pas les brouillons restés seulement sur l'ancien appareil.

| Incident | Conséquence et récupération |
|---|---|
| Phrase perdue, code conservé, stockage local intact | Déverrouiller localement avec le code et définir une nouvelle phrase, sans perte des brouillons |
| Code perdu, phrase conservée | Déverrouillage normal possible ; avertir que le secours manque, ne pas promettre une copie serveur du code |
| Phrase et code perdus | Brouillons locaux chiffrés irrécupérables ; données serveur déjà synchronisées non affectées |
| Navigateur/appareil perdu, profil supprimé, stockage vidé/évincé | Code et phrase ne recréent pas les ciphertext absents ; seuls les brouillons réellement synchronisés peuvent être repris depuis le serveur |
| Mot de passe de connexion réinitialisé | Ne change ni la phrase ni la clé locale ; retour au même identifiant de compte et déverrouillage distinct requis |
| Compte suspendu | Le code ne contourne pas les droits ; à reconnexion appliquer le refus et la purge au mieux, sans révocation instantanée hors ligne |

## Initialisation compréhensible pour la clinique

1. Expliquer en albanais : protection des brouillons sur cet appareil, phrase distincte du mot de passe de connexion, absence de sauvegarde automatique du coffre.
2. Demander et confirmer une phrase suffisamment robuste selon la politique à éprouver ; ne jamais envoyer ces champs au serveur.
3. Générer localement la clé et le code de secours ; afficher le code dans un écran local dédié. Demander à la clinique de le conserver dans un endroit privé et sûr, puis confirmer sa conservation. Pas de copie automatique dans le presse-papiers, de mail ou de journal.
4. Expliquer les deux limites avant confirmation : perte des deux secrets = perte des brouillons seulement locaux ; perte du stockage/appareil = code insuffisant pour reconstituer les données. Montrer distinctement l'état local et l'état synchronisé.
5. Tester localement les enveloppes/manifeste puis enregistrer atomiquement l'initialisation complète ; en cas d'échec de stockage, ne pas annoncer le coffre initialisé. Effacer les champs et masquer le code après ce parcours.

Phrase et code exclus des URL, logs, exceptions sérialisées, analytics, événements de suivi et télémétrie. Champs de récupération traités uniquement dans le navigateur ; aucun secret dans les messages interonglets. Revue des outils de diagnostic/capture avant production, pour que la suppression des valeurs ne dépende pas seulement de l'interface.

## Pannes, quota et validations

Stockage persistant navigateur demandé si disponible, sans garantie d'accord/absence d'éviction. Estimer quota et taille avant ajout, traiter erreurs transactionnelles, afficher état réel local/synchronisé ; jamais « enregistré » sur échec. Tester tablette/mobile ciblés, fermeture process, redémarrage, eviction, mode privé, appareil presque plein et fichiers limites. Les appareils/navigateurs ne sont pas supposés validés.

Tests d'application attendus : mauvais compte/phrase/code, même compte après logout/reset password, nonce unique et replay/génération, erreur/tag/manifest/chunk, conflit incluant fichiers, tombstone versus édition locale, réponse perdue, maintenance/suspension, catalogue interdit, aucun envoi automatique, aucun cache officiel, migration interrompue, quota/éviction.

Contrôle préparatoire réel exécuté sous dental-ai sur Node 22.22.2, en mémoire et données synthétiques : PBKDF2 600 000, wrap/unwrap AES-KW, key non extractable, AES-GCM round-trip 4096 octets, ciphertext altéré refusé, AAD différent refusé, mauvaise phrase refusée, export de clé refusé. Résultat OK ; ce probe valide des primitives Node, pas le coffre/browser ni la sécurité de l'application absente.

Sources primaires consultées le 10/10/2026 :
- MDN AesGcmParams : https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams (IV unique et AAD).
- MDN wrapKey : https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/wrapKey (AES-KW et encapsulation).
- OWASP Key Management : https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html (cycle de clés et risque de perte).
- OWASP Password Storage : https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html (PBKDF2/SHA-256 ; paramètre candidat à réévaluer pour usage de dérivation locale).

Paramètres et formats cryptographiques versionnés/bornés ; refuser un format inconnu ou des paramètres dangereux plutôt que les abaisser silencieusement. Validation 3.8 limitée à la conception ; tests navigateur et revue cryptographique applicative restent requis avant production. Voir [ADR R15](../decisions/0003-local-vault-recovery.md).

Contrôle R15 complémentaire réel (10/10/2026) : Node Web Crypto, données synthétiques en mémoire ; code aléatoire AES-KW distinct, récupération de la racine, nouvelle enveloppe de phrase, déchiffrement du même ciphertext sans réécriture ; ancienne phrase refusée sur la nouvelle enveloppe, racine active non exportable, ancienne enveloppe conservée utilisable. Résultat OK. Aucune simulation IndexedDB ni validation navigateur.

Contraintes navigateur : contexte HTTPS sécurisé pour SubtleCrypto, détection effective de PBKDF2/AES-KW/AES-GCM et IndexedDB, absence de fallback en clair. Échec de support/quota = coffre indisponible explicite ; tests iOS/Android/tablette et PWA installée requis. Sources MDN getRandomValues et Web Crypto consultées : https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues et https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API.

Le retrait local après dépôt est actuellement manuel et limité à un brouillon dont les champs correspondent exactement au formulaire lors du reçu `submitted`. Un retour réseau incertain ou un brouillon différent ne déclenche aucune suppression. Ce parcours requiert encore une réception navigateur ; il ne synchronise ni les fichiers ni les autres appareils.

Le contrôleur serveur du 30/10 est une première tranche textuelle derrière `DENTAL_LAB_DRAFT_SYNC_ENABLED` fermé par défaut. Il réutilise 0009 : le compte clinique et la session sont revalidés sous transaction, création/révision/tombstone et reçu sont atomiques, et la même intention est relue après une réponse incertaine. Aucune route n’est active sans drapeau, ni synchronisation automatique, récupération dans l’interface multi-appareils, association de fichiers ou réception PostgreSQL réelle. Le payload serveur est une donnée applicative privée sous ACL et sauvegarde serveur, sans garantie de chiffrement de bout en bout du coffre local.

La tranche interface suivante garde l’intention et la révision serveur dans le ciphertext du coffre avant l’appel. Le bouton manuel rejoue la même clé après un résultat incertain ; conflit = choix explicite de la copie serveur ou nouvelle identité locale, jamais soumission de commande automatique. La liste serveur est bornée. Le transfert de fichiers reste refusé ; la suppression locale après dépôt est bloquée si le brouillon serveur n’est pas relié à la commande, pour éviter une copie active sur un autre appareil. Tests navigateur et PostgreSQL réel encore absents.

La suppression explicite du brouillon serveur est préparée dans le coffre avant l’appel, avec révision attendue et clé idempotente. Une réponse perdue laisse l’intention chiffrée pour un rejeu manuel identique ; un conflit ne détruit pas la copie locale. Une confirmation conserve le brouillon local chiffré. Cette tranche reste derrière les drapeaux désactivés et sans réception navigateur ou PostgreSQL réelle.

Pour 15.8, l’intention de dépôt dispose d’un enregistrement chiffré distinct du brouillon dans le même coffre IndexedDB et la même clé de compte. Le dépôt est refusé si le coffre n’est pas déverrouillé ou si l’écriture préalable échoue. « Préparé » signifie jamais envoyé par ce parcours ; l’état « incertain » est persisté avant l’appel réseau, et peut aussi couvrir une interruption avant son émission effective. La réouverture n’envoie rien : l’utilisateur rejoue manuellement la même requête et la même clé idempotente ; la transaction serveur reste l’autorité. Une réponse validée remplace la requête complète par le reçu chiffré, sans cache automatique de commande officielle. Le reçu peut être effacé manuellement. Tests cryptographiques Node et contrats ciblés réussis ; la fermeture réelle du navigateur, IndexedDB multi-onglets et la réception PostgreSQL restent à démontrer. Le lien transactionnel brouillon serveur/commande (15.9) n’est pas intégré.
