# Délégation des droits employés — point 7.11

État : planificateur et noyau service préparés/testés hors ligne ; aucun grant réel changé. Registre/calcul 7.10 réutilisés et extraits dans permissions.ts pour éviter un cycle index/service. Schéma account_grants/employee_delegation_limits de 0002 réutilisé, sans nouvelle migration.

L'identité/session vient exclusivement du serveur. loadCurrent doit revalider session/epoch/compte et charger grants/enveloppe actuels avant le contexte cible. Owner actuel peut gérer les droits employee ; admin exige employees.manage_permissions effectif et enveloppe fixée par le propriétaire. Cible employee exacte seulement, jamais admin/owner/clinique ou auto-élévation. Champs de contexte, rôle et enveloppe injectés dans la commande sont refusés.

H711-01, interprétation réversible de moindre privilège : l'enveloppe borne chaque modification effective, pas les droits préexistants hors enveloppe laissés inchangés. Cela préserve les droits explicitement attribués par le propriétaire. L'autorité déléguée dépend de l'enveloppe et du droit de gestion, sans conférer à l'administrateur l'usage du contenu patient correspondant. Toute addition, retrait ou retrait dépendant hors enveloppe est refusé ; aucune élévation implicite.

Codes inconnus/doublons/capacités incompatibles avec employee sont refusés. Une nouvelle permission sans prérequis est invalide. Si le retrait d'un parent invalide des droits déjà possédés, le serveur prépare la liste exacte des dépendants et exige confirmation explicite de cette liste avant mutation ; révision cible attendue obligatoire. Aucune permission ajoutée automatiquement. L'enveloppe elle-même n'est pas modifiable par ce parcours.

applyAtomic doit recalculer autorité, enveloppe, cible, révision, diff exact/prérequis/confirmation sous verrous dans la transaction de remplacement des grants, incrément epoch/révocation sessions et audit. Une délégation retirée après le preview doit refuser la mutation. Les ports doubles testent les gardes et résultats, pas cette atomicité PostgreSQL.

Restent : adaptateurs de contexte/transactions/contrôle de session, configuration owner de l'enveloppe et gestion employés création/suspension selon leurs autres permissions, UI preview/confirmation et routes sous CSRF, recettes PostgreSQL de révocation/concurrence/rollback et navigateur. Aucun champ de requête client ne peut devenir une preuve d'autorité. Le point reste partiellement implémenté, pas reçu sur l'API réelle.

## Intégration applicative — 15/10/2026

API `/api/v1/delegation/{employee|envelope}` : liste paginée50+1, détail, PUT strict et historique paginé par révision. Identité issue exclusivement du cookie serveur, origine exacte sur PUT, UUID et révision contrôlés, réponse privée no-store. Enveloppe admin réservée au propriétaire courant ; employé/clinique/admin non habilité exclus. Aucun workflow de création ou transfert propriétaire. Interface albanaise branchée, droits non modifiables verrouillés, confirmation exacte des dépendants supprimés, pas de resoumission automatique après réponse incertaine.

Chaque écriture reprend les verrous de comptes ordonnés, puis SHARE ROW EXCLUSIVE sur account_grants et employee_delegation_limits, puis contrôle session/epoch/expiration/compte/owner/enveloppe courants. Les deux tables sont sérialisées pour couvrir aussi les suppressions/ajouts de délégation ; contention possible, timeouts existants2s/5s/10s inchangés, aucune reprise sans verrou. Les lectures de gestion utilisent le même chemin borné pour préserver l'autorité pendant leur projection. La concurrence PostgreSQL réelle reste à recevoir.

Les droits inchangés conservent created_by/created_at. Toute modification effective augmente revision/auth_epoch et révoque les sessions du compte cible ; pour l'enveloppe, le compte cible est l'administrateur. Un no-op ne crée ni version, révocation, historique ou événement artificiel. Le contenu de l'enveloppe ne devient jamais un droit d'usage de l'administrateur. Historique avant/après dans0016_delegation_history.sql, action auditpermissions et événement outbox dans la même transaction ; aucun message envoyé.

Activation future conditionnée par DENTAL_LAB_DELEGATION_ENABLED=true avec auth configurée et readiness des privilèges. Flag absent donc désactivé ; aucun environnement modifié. Migration0016 préparée seulement, SHA256 c1a20067a544052de7880d511aa41fe388379bd1f0afa1e364909f27eb6dc153 ; SELECT/INSERT uniquement sur l'historique, UPDATE/DELETE/TRUNCATE refusés par readiness. Nouvelles permissions supplémentaires non accordées.

20tests ciblés réussis avec doublesSQL : refus/révisions/confirmation/retrait entre lecture et écriture/no-op/échecs propagés/HTTP/transport/runtime. Ils démontrent le comportement du code et la composition transactionnelle, pas les verrous ou rollback PostgreSQL réels. Recette SQL et navigateur différées sans reprisev4.
