# Transfert exceptionnel de propriété — point 7.15

**Statut : procédure préparée ; exécution et réception différées.** Source métier : CDC §2.2, modèle accounts-clinics, OWNER_PROTECTION.md, OWNER_RECOVERY.md. Aucun transfert dans l'interface ; aucun script privilégié installé ou exécuté.

## Objet et décisions indispensables

Changer la personne propriétaire est distinct de la récupération de l'accès du même propriétaire (7.14). Le transfert conserve les comptes et l'attribution historique des actes ; ne pas renommer l'ancien compte pour le faire passer pour le nouveau propriétaire.

Avant une intervention concrète, consigner dans un dossier privé :

- ancien propriétaire et bénéficiaire identifiés, compte cible individuel ou création contrôlée à préparer ;
- preuve de l'autorité à transférer, consentements ou acte de succession pertinent vérifiés par une personne compétente ; aucune conclusion juridique déduite d'un e-mail ou d'un accès VPS ;
- date d'effet, vérificateur, opérateur autorisé, référence de la décision et périmètre exact ;
- devenir explicite de l'ancien compte (profil non propriétaire, état, droits accordés ou aucun), sans choix automatique admin/employé, suspension ou suppression ;
- traitement des droits/délégations préexistants du compte cible, contacts de sécurité et destinataires configurés ;
- accord distinct sur l'artefact d'intervention, son empreinte, ses préconditions, la recette et le plan de reprise.

Les personnes, justificatifs juridiquement suffisants et décisions de succession ne sont pas fournis par le dépôt. Si autorité contestée ou dossier incomplet, arrêter l'intervention concernée. Un compte clinique partagé ne doit pas être reconverti en identité personnelle sans décision métier séparée ; aucun workflow de fusion de comptes ou de cliniques n'est ajouté.

## État SQL vérifié et obstacle actuel

Audit du 12/10/2026 sous dental-ai, connexion READ ONLY à dental_lab exclusivement : les définitions ci-dessous ont été lues dans pg_constraint/pg_indexes, sans consulter des données de comptes et sans exécuter de transfert.

| Invariant / relation | Définition constatée | Conséquence pour l'intervention |
|---|---|---|
| accounts_one_owner | Index unique immédiat sur profile WHERE profile='owner' | Jamais deux lignes owner, même provisoires |
| accounts_owner_active | CHECK owner implique lifecycle active | Impossible de suspendre directement le propriétaire |
| accounts_owner_pair_fk / owner_slot_account_fk | FK réciproques DEFERRABLE INITIALLY DEFERRED | Cohérence obligatoire au commit, à forcer avant succès |
| invitations_profile_fk | FK (account_id,purpose) vers accounts(id,profile), non différable | Une invitation historique admin/employé empêche de promouvoir son compte en owner |
| grants_account_profile_fk | FK immédiate profil admin/employé | Les grants doivent rester cohérents avec la disposition approuvée |
| delegation_admin_fk | FK immédiate delegator_profile='admin' | L'enveloppe d'un admin promu nécessite un traitement explicite |

**Obstacle démontré par la définition :** invitations_profile_fk couvre toutes les invitations, y compris consommées/révoquées. Révoquer une invitation n'enlève pas cette dépendance. Différer les autres contraintes ne résout ni cette FK ni le fait que purpose reste historiquement admin/employé. La tentative de transfert réelle n'a pas été exécutée.

Ne pas supprimer les invitations ni réécrire leur purpose pour contourner l'obstacle ; ne pas désactiver les contraintes. Une nouvelle évolution versionnée devra séparer le profil historique de l'invitation de l'exigence de concordance lors d'une invitation encore utilisable, avec conservation d'une référence au compte et maintien des refus de cible/profil/rejeu. Son dessin précis, son SQL, ses tests négatifs, SHA et approbation sont un préalable au cas concerné. 0002 reçue reste immuable. Un parcours vers un compte neuf ne doit pas être inventé pour éviter ce problème.

La proposition 0010 ne donne au runtime ni UPDATE(profile), ni mutation owner_slot. Cette restriction est conservée ; une intervention exceptionnelle n'autorise pas à élargir durablement ces droits.

## Préparation et contrat transactionnel

1. Préparer l'intervention après audit du schéma réellement reçu, des références des deux comptes et des règles d'audit. Toute nouvelle migration suit le lanceur et son approbation propre ; la mutation de compte suit un mécanisme ponctuel séparément audité/approuvé, pas une commande root exécutable depuis des sources modifiables par dental-ai.
2. Revoir une sauvegarde/reprise propre au projet et la possibilité d'annulation transactionnelle. Aucun changement de service voisin, de cluster, d'HBA ou de privilège pour faciliter l'opération.
3. Vérifier que le bénéficiaire maîtrise son adresse et un moyen d'authentification sûr ; ne pas transférer le mot de passe, la session, le compte partagé ou le coffre local de l'ancien propriétaire. Tout reset nécessaire passe par le mécanisme sûr prévu, pas par un mot de passe choisi/connu par l'opérateur.
4. Dans une transaction bornée, verrouiller le slot et les deux comptes dans un ordre déterministe cohérent avec les adapters applicatifs. Revalider slot attendu, révisions, identités, état de sécurité et préconditions approuvées. Toute divergence impose rollback/réaudit.
5. Appliquer ensemble la disposition approuvée de l'ancien compte, le nouveau profil owner, le slot, les révisions et les adaptations de grants/délégations. L'ordre SQL final doit respecter l'index unique immédiat et toutes les FK : pas de promotion avant résolution du propriétaire existant, pas d'état partiel commité. Aucune recette SQL générique n'est prétendue exécutable avant correction du blocage ci-dessus.
6. Incrémenter l'epoch et révoquer sessions/challenges/invitations encore utilisables des deux comptes. Préserver leurs invitations historiques et tous les auteurs de travaux/messages. Ne conserver aucun accès à l'audit global pour l'ancien propriétaire via session ou cache.
7. Consigner l'intervention attribuée à un processus identifié, ancien/nouveau compte, décision privée référencée, instant serveur, révisions et différence utile expurgée ; enregistrer les avis de sécurité destinés aux canaux vérifiés. Aucun token, hash ou preuve d'identité dans les logs/Git/audit.
8. Forcer la vérification de toutes les contraintes avant commit et constater exactement un owner actif correspondant au slot. En cas d'échec d'audit ou de contrainte, tout annuler. Pas d'envoi avant commit.
9. Après commit : nouvelles authentifications, contrôle d'accès owner-only, refus des anciennes sessions/SSE, recontrôle des notifications/jobs et destinataires. Les alertes critiques doivent aboutir au propriétaire courant, sans envoi de secrets à l'ancien propriétaire.

Aucune liste de permissions de l'ancien propriétaire ne peut être déduite arbitrairement. Aucun effacement de compte/historique, aucune réattribution des actes passés au nouveau propriétaire, aucune récupération du coffre R15 par l'opérateur.

## Résultat incertain et retour arrière

Une réponse perdue ne prouve pas l'échec. Contrôler le processus ponctuel, rapprocher référence du dossier/audit, slot, profils, révisions et epochs sans afficher de données sensibles. Si commit confirmé, poursuivre les contrôles ; si rollback certain, revoir avant nouvelle tentative ; si incertain, ne pas rejouer.

Après un transfert commité, « annuler » constitue une nouvelle intervention de propriété, avec autorité et contexte à revérifier. Ne pas restaurer un cluster partagé ni un ancien snapshot qui réactive des sessions compromises ou efface des travaux intervenus depuis.

## Matrice de recette à exécuter

| Cas | Résultat attendu |
|---|---|
| Identité, autorité, consentement ou disposition ancien compte manquants | Aucun transfert |
| Admin appelle une route de transfert ou injecte profile=owner | Refus, aucune route de transfert disponible |
| Bénéficiaire avec invitation consommée/révoquée dans le schéma actuel | Refus FK ; arrêt, aucune suppression d'historique |
| Schéma corrigé et invitations actives/historiques | Concordance à l'émission/activation, historique conservé ; aucun rejeu |
| Deux interventions simultanées ou révision obsolète | Une décision cohérente, seconde refusée après relecture |
| Promotion alors qu'un owner existe | Index unique refuse, aucune double autorité |
| Slot manquant/incohérent à la fin | Refus des contraintes, rollback |
| Nominal autorisé sur schéma compatible | Un owner actif, slot correct, identifiants et auteurs historiques conservés |
| Échec audit/transaction ou réponse perdue | Rollback ou rapprochement explicite ; aucun rejeu aveugle |
| Anciennes sessions/challenges, export audit, flux SSE | Refus pour les droits retirés, autorité courante recontrôlée |
| Destinataires sécurité après transfert | Propriétaire courant correctement destinataire ; aucun secret diffusé |
| Panne e-mail après commit | Transfert conservé, intention suivie/reprise |

Aucune ligne marquée réussie sans simulation contrôlée sur identités fictives, sous opérateur autorisé, après prérequis reçus. Les tests existants refusant owner.transfer et validant l'unicité de 0002 ne prouvent pas un transfert complet.

## Dépendances restantes

Correction versionnée du lien invitations/profil ; audit durable et champs profile/epoch/slot pertinents (liste changed_fields de 0008 actuellement insuffisante) ; mécanisme ponctuel d'exécution ; adapters transactionnels/révocation ; configuration des avis ; validation de l'autorité et disposition de l'ancien compte ; tests PostgreSQL/API/SSE/navigateur.

Aucun nom/numéro de migration future ni accord juridique inventé. Point 7.15 documenté, non réceptionné. Le [bilan de chapitre](admin-proposals/CHAPTER_7_RECEPTION.md) distingue le développement encore manquant des opérations administrateur.
