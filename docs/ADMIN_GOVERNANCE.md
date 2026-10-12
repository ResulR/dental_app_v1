# Administrateurs secondaires — point 7.9

État : noyaux invitation/gouvernance préparés ; aucune action réelle, réception différée. CDC2.1/2.2 : le propriétaire actuel seul crée et gère les administrateurs. Aucun grant employees.create/clinics.manage/settings.manage ne donne ce pouvoir à un administrateur secondaire.

createAdminInvitationService réutilise le moteur 7.8 avec cible admin fixée par la composition serveur et domaine admin-invitation distinct. authorizeOwner doit vérifier compte actif et relation owner_slot actuelle, jamais se limiter au profil déclaré. Profil admin/invited forcé ; activation individuelle par secret d'invitation et mot de passe choisi, sans grant implicite ni auto-session. Le service employé reste limité à sa cible et à employees.create. Le schéma 0002 supporte déjà les deux purposes ; aucune table ou migration recréée.

createAdminManagementService refuse les acteurs admin/employee/clinic avant toute lecture/mutation, ainsi que le ciblage du compte propriétaire lui-même. La lecture courante doit identifier exactement un admin ; owner/employee/clinic ne sont jamais mutés par ce parcours. Révision positive obligatoire, champs injectés refusés. Les permissions doivent être un ensemble unique borné au registre actuel (29 codes à ce stade), validé avec ses dépendances ; adapter 7.10 reste à implémenter.

mutateAtomic doit recontrôler propriétaire actuel, cible admin, révision, lifecycle et registre/dépendances dans la transaction. Suspension ou changement de droits doit incrémenter epoch/révoquer sessions et historiser. Réactivation ne lève pas de verrou de sécurité et ne doit jamais rendre actif un compte sans credential ; parcours invitation à préserver. Aucun changement owner_slot/profile/credential ou transfert propriétaire. Toute intervention exceptionnelle propriétaire suit son protocole technique séparé.

Restent : adaptateurs SQL atomiques et matrice 7.10, outbox chiffrée/provider, écrans/routes sous session/CSRF, tests réels révocation/concurrence/ROLLBACK/propriétaire changé, recettes navigateur. Les tests ports doubles démontrent les gardes du noyau, pas les effets PostgreSQL. Aucune permission système/SQL attribuée à l'IA.
