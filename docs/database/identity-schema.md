# Identité, cliniques et permissions — préparation du point 6.3

Statut : migration préparée, NON APPLIQUÉE. Références : CAHIER_DES_CHARGES §2, docs/models/accounts-clinics.md et permissions.md. Aucun compte réel créé, aucun grant PostgreSQL ajouté. Réception administrateur requise avant validation de 6.3.

## Schéma préparé

| Objet | Invariant |
|---|---|
| accounts | UUID, profil fermé, email_key unique, état, verrous de sécurité, auth_epoch/révision positifs |
| owner_slot | Singleton1 lié au seul compte owner ; tous les comptes nécessitent le slot |
| clinics | Un seul compte clinic par clinique et un seul profil clinique par compte clinic |
| credentials | Un hash non vide par compte ; aucun mot de passe en clair |
| sessions | Digest32octets unique, expiration finie, révocation, renouvellement lié au même compte |
| invitations | Cible admin/employee concordante, digest32octets unique, expiration bornée, une invitation non consommée/non révoquée par compte |
| permission_definitions | Registre fermé des capacités labo et leur prérequis direct |
| permission_prerequisites | Vue dérivée du registre, pas une seconde liste mutable |
| account_grants | Admin/employee seuls ; prérequis exact et grant parent obligatoires |
| employee_delegation_limits | Enveloppe explicite uniquement pour un administrateur |

Les FK réciproques différées permettent le bootstrap propriétaire et la création compte/clinique dans une seule transaction. Le slot et le compte owner doivent correspondre ; un profil clinic sans clinique ou une clinique liée à un autre profil ne peuvent être validés. L’index propriétaire interdit un second owner, même en concurrence. Supprimer le slot est refusé tant qu’un compte existe. Une base entièrement vide avant bootstrap est volontairement autorisée ; le bootstrap réel et les droits applicatifs de suppression ne sont pas ouverts par cette migration.

H63-01, choix technique réversible : contraintes déclaratives, sans trigger/fonction privilégiée. Les références historiques n’ont aucun ON DELETE CASCADE. Les opérations exceptionnelles de transfert restent humaines et futures ; cette migration ne les implémente pas.

H63-02 : le service fournit email_key suivant la future politique canonique ; la base garantit son unicité, sans inventer une transformation d’adresse fournisseur ou une règle de normalisation non décidée. UUID natif PostgreSQL17, aucun plugin/extension requis. Les durées exactes restent paramètres de sécurité futurs ; expires_at doit être fini et supérieur à created_at. Digest32octets pour SHA256 d’un token aléatoire ; l’algorithme de mot de passe reste indépendant et à valider au chapitre authentification.

H63-03 : les prérequis sont stockés une seule fois dans permission_definitions. Une vue représente la table de relations proposée en conception3.3. account_grants référence (code,prerequisite_key) pour empêcher un prérequis falsifié/vidé ; sa FK vers le grant parent assure la présence du prérequis. Retirer un parent exige de retirer les dépendants dans la même transaction. Les capacités owner-only sont absentes du registre délégable. Les définitions ne reçoivent aucun accès applicatif en écriture.

## Frontières encore à implémenter

Les contraintes ne remplacent pas les services d’authentification et d’autorisation : contrôle acteur/cible/enveloppe, consommation atomique à usage unique, expiration au moment de consommation, vérification session/auth_epoch/état actuel, suspension et révocation atomiques, administration owner-only. Un digest stocké n’est jamais un secret public. Les états terminaux d’invitation sont cohérents à l’insertion/mise à jour ; leur irréversibilité et l’historisation ne sont pas encore un mécanisme serveur livré.

L’index invitation inclut une invitation expirée mais non révoquée : la remplacer exige la révocation de l’ancienne dans la transaction ; aucune expiration automatique ni suppression de preuve. Une session expirée/révoquée ou epoch obsolète reste stockable pour l’historique, mais devra être refusée par le serveur.

Les comptes peuvent conserver leurs credentials après suspension ; aucun FK de lifecycle ne les efface. Le fait qu’une clinique soit approved n’autorise pas à lui seul une opération. Pas de données patient. Récupération, changements d’email, événements métier et acceptations légales seront raccordés dans leurs étapes dédiées, avec les FK et migrations nécessaires.

## Validation préparée

- Catalogue et filtre rev3 vérifient seulement les fichiers/empreintes et instructions permises, pas la validité PostgreSQL complète.
- Trois tests hors ligne vérifient les prérequis métier, l’absence d’implication view/download, la séparation conversations et la fermeture sans cycle du registre.
- tests/migrations/identity_constraints.sql prépare des cas positifs et23refus SQLSTATE. Aucune exécution SQL par IA ; recette réelle sous administrateur, dans une transaction annulée.
- docs/admin-proposals/POINT_6_3_ADMIN.md donne la migration aller via le lanceur existant et la recette bornée sans élargir les permissions.

Une réception réussie doit montrer les neuf tables/la vue, leurs contraintes validées et ownership attendu, puis23refus+cas positifs, aucune fixture persistante après ROLLBACK, NOLOGIN/sessions0/locks0 et aucunpending. Aucun accès applicatif à ces tables ne doit être supposé : l’audit préalable ne constate aucun default ACL propriétaire/migrateur. Les permissions minimales devront être autorisées à leur étape.

Sources techniques primaires consultées : https://www.postgresql.org/docs/17/ddl-constraints.html ; https://www.postgresql.org/docs/17/ddl-generated-columns.html ; https://www.postgresql.org/docs/17/sql-createtable.html ; https://www.postgresql.org/docs/17/plpgsql-control-structures.html .
