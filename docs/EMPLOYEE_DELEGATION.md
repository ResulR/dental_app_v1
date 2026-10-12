# Délégation des droits employés — point 7.11

État : planificateur et noyau service préparés/testés hors ligne ; aucun grant réel changé. Registre/calcul 7.10 réutilisés et extraits dans permissions.ts pour éviter un cycle index/service. Schéma account_grants/employee_delegation_limits de 0002 réutilisé, sans nouvelle migration.

L'identité/session vient exclusivement du serveur. loadCurrent doit revalider session/epoch/compte et charger grants/enveloppe actuels avant le contexte cible. Owner actuel peut gérer les droits employee ; admin exige employees.manage_permissions effectif et enveloppe fixée par le propriétaire. Cible employee exacte seulement, jamais admin/owner/clinique ou auto-élévation. Champs de contexte, rôle et enveloppe injectés dans la commande sont refusés.

H711-01, interprétation réversible de moindre privilège : l'enveloppe borne chaque modification effective, pas les droits préexistants hors enveloppe laissés inchangés. Cela préserve les droits explicitement attribués par le propriétaire. L'autorité déléguée dépend de l'enveloppe et du droit de gestion, sans conférer à l'administrateur l'usage du contenu patient correspondant. Toute addition, retrait ou retrait dépendant hors enveloppe est refusé ; aucune élévation implicite.

Codes inconnus/doublons/capacités incompatibles avec employee sont refusés. Une nouvelle permission sans prérequis est invalide. Si le retrait d'un parent invalide des droits déjà possédés, le serveur prépare la liste exacte des dépendants et exige confirmation explicite de cette liste avant mutation ; révision cible attendue obligatoire. Aucune permission ajoutée automatiquement. L'enveloppe elle-même n'est pas modifiable par ce parcours.

applyAtomic doit recalculer autorité, enveloppe, cible, révision, diff exact/prérequis/confirmation sous verrous dans la transaction de remplacement des grants, incrément epoch/révocation sessions et audit. Une délégation retirée après le preview doit refuser la mutation. Les ports doubles testent les gardes et résultats, pas cette atomicité PostgreSQL.

Restent : adaptateurs de contexte/transactions/contrôle de session, configuration owner de l'enveloppe et gestion employés création/suspension selon leurs autres permissions, UI preview/confirmation et routes sous CSRF, recettes PostgreSQL de révocation/concurrence/rollback et navigateur. Aucun champ de requête client ne peut devenir une preuve d'autorité. Le point reste partiellement implémenté, pas reçu sur l'API réelle.
