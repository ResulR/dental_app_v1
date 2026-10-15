# Profil clinique — point 7.5

État : service et formulaire préparés ; tests hors ligne à consigner dans le journal. Le formulaire n'est pas encore branché dans App : l'identité/session HTTP et les adaptateurs PostgreSQL des points 7.1–7.4 restent à intégrer. Aucun accès réel ou test navigateur n'est annoncé.

Le contrat partagé autorise uniquement nom de clinique, prénom/nom du dentiste, téléphone, adresse et révision attendue. Tous les champs sont obligatoires, trimés ; H75-01 : limite technique réversible de 2000 caractères par champ, sans imposer un format téléphonique national inventé. E-mail, statut d'approbation, suspension, sécurité, permissions, identifiants de compte et suppression sont refusés. Le changement d'e-mail suit 7.6.

L'acteur provient exclusivement de la session serveur actuelle. La clinique ne peut lire/éditer que son clinicId vérifié ; le laboratoire doit posséder clinics.manage. L'adaptateur authorize doit aussi vérifier compte/session actifs et droit actuel. readAuthorized recontrôle l'accès au moment de la lecture ; un DTO d'une autre clinique est refusé. updateAtomic doit recontrôler identité, appartenance ou permission et révision dans la même transaction que la modification et l'audit append-only. Aucun adaptateur de stockage n'est simulé comme prêt.

Le formulaire React utilise les composants partagés, labels explicites, cibles 44 px, messages albanais, lecture seule et blocage hors connexion. Une réponse perdue, un conflit ou un refus impose une relecture avant nouvel essai ; aucune sauvegarde automatique ou stockage local des coordonnées. Le parent doit remonter le formulaire avec une clé clinicId/révision après chargement autorisé. canEdit protège l'ergonomie ; le serveur reste seul autoritaire.

Restent : adaptateur transactionnel, routes sous session/CSRF, audit durable et historique consultable selon permissions (sans valeurs sensibles dans les logs), branchement du formulaire et rechargement autorisé, tests PostgreSQL de concurrence/révocation/cloisonnement, tests navigateur clavier/tactile/mobile/lecteur selon R17. Aucun endpoint, table d'historique, déploiement ou migration nouvelle n'est prétendu réalisé. Le point reste partiellement implémenté jusqu'à ces preuves.

Dépendance précise relevée lors de l'audit 7.8 : la contrainte changed_fields de public.audit_events (migration 0008 préparée) autorise notamment lifecycle/email mais pas name, dentist_first_name, dentist_last_name, phone ou address. Avant le raccordement du profil, préparer une évolution versionnée ciblée ou un historique métier adapté ; ne pas injecter des noms de champs aujourd'hui interdits ni modifier une migration appliquée. Cela confirme que l'historique durable 7.5 reste incomplet.

## Lecture intégrée depuis 98d1261

GET /api/v1/clinics/self/profile et /api/v1/clinics/:id/profile : session authentifiée, recontrôle transactionnel compte/session/droits, clinique propre non suspendue ou permission clinics.manage. DTO strict sans e-mail ni sécurité. Panneau de lecture albanais monté seulement dans la vue authentifiée clinique, clé compte, requête relative sans cache, timeout/annulation et effacement au démontage. Aucun stockage local.

Le formulaire d’édition existant reste non branché : la contrainte changed_fields décrite ci-dessus exige une évolution versionnée avant écriture. Aucun nom de champ interdit ni faux historique injecté. Réception SQL et navigateur R17 ouvertes ; build/UI préparée ne signifie pas validation visuelle.

## Édition et historique intégrés — 14/10/2026, depuis 8172039

PUT /api/v1/clinics/:id/profile et GET /api/v1/clinics/:id/profile/history intégrés au service/runtime existant désactivé par défaut. Session/epoch/expiration, compte, permissions et propriété clinique recontrôlés sous verrou ; révision attendue comparée avant modification. Cinq champs de contact seulement. Profil, historique avant/après, audit sans coordonnées et outbox dans la même transaction ; échec propagé sans retry. Une soumission inchangée ne crée pas de fausse version. Historique paginé par révision décroissante, 50 entrées maximum ; même périmètre de lecture que profil.

Migration nouvelle 0015_clinic_contact_history.sql NON APPLIQUÉE : historique dédié append-only pour le rôle applicatif, actor/request/révisions et dix colonnes avant/après bornées. SHA256 2db5a810bb7d748ba00ec14e93f273e02d7cb7f391eea84ff96bf8f9f8da9511. Aucun changement de 0008 ni de ses champs autorisés ; aucune coordonnée injectée dans les logs/audit générique. Readiness exige SELECT/INSERT et absence UPDATE/DELETE/TRUNCATE sur l'historique. Vérifier reçus et absence collision0015 avant toute future décision de migration ; aucun lancement du migrateur ici.

Formulaire existant branché au transport réel depuis profil clinique et demande sélectionnée au laboratoire, historique avant/après albanais, hors ligne désactivé, erreurs ambiguës/conflits imposant relecture. Aucun stockage local, annulation à la déconnexion. 17 tests ciblés réussis, builds/types/lint/frontières/contrats et filtre migrations réussis. PostgreSQL réel/concurrence/rollback et navigateur restent à recevoir ; transport SQL doublé ne prouve pas leur exécution. Préparation v4 intacte et non utilisée.

## Annuaire laboratoire — 15/10/2026

GET `/api/v1/clinics/directory` et panneau albanais intégrés sous le flag de gestion existant. Pagination UUID50+1, nom/état de validation/suspension seulement ; le profil protégé charge les coordonnées après sélection. Accès refusé aux cliniques et comptes sans clinics.manage actuel ; un propriétaire doit être celui du slot courant. Aucun filtre qui ferait disparaître les cliniques approuvées/refusées/suspendues, aucune suppression ni mutation de leur état.

Les tests négatifs ont révélé que ObjectIdSchema est volontairement générique et ne valide pas un UUID. ClinicIdSchema spécifique est maintenant appliqué aux paramètres/cursors des routes profil/historique/approbation/listes et aux clients correspondants. Les identifiants invalides sont refusés avant SQL/fetch ; les contrats historiques de réponse restent inchangés, nouveau contrat annuaire strict ajouté seul au snapshot.
