# Protection du propriétaire — point 7.13

## Périmètre et état

CDC §§2.1, 2.2, 11 et 15 ; modèles comptes/permissions ; migrations 0002, 0010 et 0011. Noyau et adaptateur de lecture préparés, sans raccordement HTTP ni réception PostgreSQL. Aucune modification de compte, session, privilège, migration ou interface de transfert. Les résultats réellement exécutés sont dans EXECUTION_LOG.md.

L'unicité est déjà assurée par 0002 reçue : accounts_one_owner, accounts_owner_active, owner_slot singleton, FK réciproques différées. Ne pas recréer ces contraintes ni rejouer la migration. Une base entièrement vide avant bootstrap reste permise ; ce n'est pas une autorisation de supprimer les comptes. Les gardes 7.9/7.12 refusent déjà le propriétaire comme cible d'administration ordinaire.

## Autorisation actuelle, sans délégation

hasOwnerPermission réutilise isCurrentOwner : profil owner, relation owner_slot actuelle, session valide, compte actif, aucun verrou ni reset obligatoire. Trois opérations sont nommées explicitement pour les noyaux présents : audit.read_global, admins.manage et clinics.secure. Elles ne font pas partie des 29 grants attribuables aux administrateurs/employés ; aucun grant ajouté en base. Ce registre limité n'ajoute pas les futurs modules de maintenance/notifications.

Une action inconnue est refusée, y compris transfert, suspension/suppression du propriétaire, modification/purge d'audit et récupération exceptionnelle. Cela ne remplace pas les gardes de chaque futur endpoint. Aucun endpoint ni bouton correspondant n'est créé. La sécurisation clinique 7.12 réutilise désormais le prédicat owner-only explicite.

createOwnerAccessService reçoit seulement les références compte/session issues du middleware authentifié côté serveur. Les références UUID sont copiées et figées avant await ; aucun profil, grant ou ownerCurrent transmis par le client n'est utilisé. Chaque autorisation recharge son contexte ; aucun cache d'autorité. Une erreur de stockage est propagée, jamais convertie en autorisation.

createOwnerAccessRepository fournit une lecture paramétrée accounts/sessions/session_limits/owner_slot. Elle vérifie compte lié à la session, révocation, epoch courant, création non future, expiration et limite absolue avec l'heure du serveur PostgreSQL. Une limite absente ne permet aucun accès. Aucune lecture de credential, digest, adresse ou données patients. La politique existante vérifie ensuite les flags et le propriétaire courant. Ce repository ne vérifie pas le secret de cookie : connaître deux UUID n'authentifie jamais un utilisateur.

## Raccordement obligatoire avant usage réel

1. Recevoir les grants 0010 et les limites 0011 (non appliqués à l'audit de reprise). Aucun fallback sans limite absolue ou avec identité d'audit.
2. Brancher le SessionStore et le middleware 7.2 : identité issue d'un cookie vérifié uniquement, protections CSRF pour mutations. Les ports authorizeOwner de 7.9 devront recevoir cette autorisation via une composition conservant sessionId, pas un simple profil.
3. Toute mutation sensible recontrôle propriétaire/session/epoch et cible sous verrous dans sa transaction métier, avec révocation et audit atomiques. Une lecture préalable autorisée n'est pas une preuve contre une révocation concurrente.
4. Le futur lecteur global 17.1 doit appliquer le contrôle à chaque requête/page/export et dans sa lecture transactionnelle ; aucun accès global pour un admin, même avec tous les grants. Aucun lecteur/export livré ici.
5. Recontrôler les flux SSE/jobs et les réponses sensibles après changement d'autorité. Ne pas présenter un booléen ancien comme une autorisation persistante.
6. Les alertes de connexion et de sécurité du propriétaire, l'outbox durable, les procédures 7.14/7.15 et la recette navigateur restent à réaliser. Pas de 2FA obligatoire ajoutée.

## Réception restant à exécuter

Les tests hors ligne couvrent la matrice profils/grants/états, actions interdites, relecture après révocation, références malformées, erreur de stockage, copie des références et contrat SQL sur transport doublé. Ils ne démontrent ni l'exécution PostgreSQL de la requête ni sa concurrence.

Sous le runtime autorisé, après migrations reçues : cas propriétaire actuel accepté ; ancien propriétaire/slot différent, admin tous droits, session d'un autre compte, epoch obsolète, session révoquée/expirée/future, limite absente/expirée et flags de sécurité refusés. Tester un changement d'autorité concurrent à une lecture/mutation ; vérifier rollback, audit et refus aux routes/API/export/SSE. Conserver les preuves expurgées et aucune fixture persistante. Tests d'unicité 0002 déjà reçus : ne pas les rejouer sans besoin identifié et autorisation.

Statut final à maintenir : implémentation préparée ; tests hors ligne selon journal ; aucune nouvelle application SQL ; intégration/réception différées. Le point ne devient pas entièrement validé sur le seul build.

## Alertes de connexion — intégration13/10/2026

SessionStore crée maintenant, uniquement pour l'émission initiale d'une session propriétaire courante, outbox security_alert +dispatchpending +notificationinterne au propriétaire +deliveryemail/securitypending. Même transaction que session/borne/audit, même corrélation que SESSION_ISSUED ; aucun secret/IP/adresseemail dans l'événement. Échec de l'une de ces étapes annule la connexion et aucun cookie n'est émis. Aucun événement de login lors d'un renouvellement ou pour admin/employee/clinic.

H713-ALERT01 :incrément de accounts.revision sous le verrou déjà acquis pour rendre chaque événement security_alert unique ;auth_epoch inchangé et autresappareils conservés. Peut invalider une édition administrative à ancienne révision :conflit explicite attendu, jamais écrasement. Migration/grants0008/0010 réutilisés, aucune nouvellepermission. Le futur worker doit reconnaître cet événement par aggregateaccount/corrélation/auditactionSESSION_ISSUED et produire le templatealbanais approuvé ;ne pas interpréter toutes les security_alert comme login.

Tests doubles :destination propriétaire/corrélation/durabilitéatomique simulée, échecs de chaque queue et absence pour employés. Worker/provider/template/lecture des notifications internes et preuve de livraison encore NON implémentés/réceptionnés :pending n'est pas email livré. Voir FIRST_LOGIN_RECEPTION/AUTH_RUNTIME_ADMIN pour la recette réelle.
