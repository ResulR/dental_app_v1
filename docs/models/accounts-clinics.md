# Modèle comptes et cliniques — point 3.2

Conception fondée sur CAHIER_DES_CHARGES §§2, 9, 11, 15 et 17. Les noms ci-dessous sont des tables proposées, pas des objets présents. Audit en lecture seule : connexion dental_lab/dental-ai et aucune table dans public. Aucune migration exécutée. La politique de rétention reste à valider ; conserver l'attribution des actes ne signifie pas conserver indéfiniment toutes les données personnelles.

## Entités, clés et associations

Identifiants internes opaques, stables et sans signification clinique ; horodatages serveur en UTC, affichage Europe/Pristina. Les enums ci-dessous sont internes, pas des libellés d'interface.

| Entité proposée | Clé et attributs structurants | Associations / contraintes |
|---|---|---|
| accounts | id PK ; profile owner/admin/employee/clinic ; email_original et email_key ; lifecycle invited/active/suspended ; security_locked ; credential_reset_required ; auth_epoch ; revision ; created_at | UNIQUE email_key ; aucun changement de profile depuis une route générique ; référence historique stable |
| owner_slot | singleton PK de valeur fixe 1 ; account_id ; profile fixé à owner | account_id UNIQUE ; FK composée vers accounts(id, profile), cible obligatoirement owner ; compte actif en régime normal |
| clinics | id PK ; account_id ; nom clinique ; prénom/nom dentiste de référence ; téléphone ; adresse complète ; review_state pending/approved/refused ; suspended ; revision | account_id UNIQUE et FK vers compte de profile clinic ; une clinique ↔ exactement un compte partagé ; aucun dentiste/secrétaire comme compte |
| credentials | account_id PK/FK ; password_hash ; changed_at | Un credential par compte ; absent avant acceptation d'invitation ; jamais de mot de passe en clair |
| sessions | id PK ; account_id FK ; secret_digest ; auth_epoch ; created_at ; expires_at ; revoked_at ; renouvellement/filiation | Plusieurs sessions par compte ; secret_digest UNIQUE ; aucune session valide après révocation/expiration/epoch obsolète |
| invitations | id PK ; account_id FK ; created_by FK accounts ; target_email ; purpose admin/employee ; token_digest ; expires_at ; consumed_at ; revoked_at ; état durable | token_digest UNIQUE ; au plus une invitation pendante par compte ; durée finie obligatoire, valeur exacte à décider à l'étape invitations |
| recovery_challenges | id PK ; account_id FK ; purpose ; token_digest ; expires_at ; consumed_at ; revoked_at | Usage unique, borné, lié au compte et au but ; pas interchangeable avec invitation ou confirmation e-mail |
| clinic_email_changes | id PK ; clinic_id FK ; requested_by FK accounts ; decided_by FK accounts nullable ; old_email ; proposed_email/email_key ; decision ; confirmation_digest ; expires_at ; confirmed_at ; revision | Au plus une demande ouverte par clinique pour éviter une activation ambiguë ; confirmation uniquement après décision favorable, unicité finale de email_key |
| account_events / clinic_events | id PK ; aggregate_id FK ; actor_account_id FK nullable pour processus identifié ; action ; at ; reason ; diff utile expurgé ; revision | Historique append des décisions, attribuable au compte partagé ; pas de secret ni token ; décisions importantes aussi dans audit global propriétaire |
| legal_acceptances | id PK ; account_id FK ; document_version_id FK vers compliance ; accepted_at | Référence à la version exacte ; pas un booléen écrasé à chaque modification |

Chaque FK vers un compte historique est conservée : pas de cascade de suppression du compte vers travaux/messages/audit. Les associations cross-module seront utilisées par API publique selon l'architecture. Les FK de profil et unicités seront traduites en migrations versionnées ; aucun trigger ou index n'est prétendu déjà installé.

UNIQUE(accounts.id, accounts.profile) fournit la cible des FK composées de owner_slot et clinics. Unicité partielle du profil owner limite à un propriétaire. Une vérification différée de cohérence en base et dans le service interdit, après initialisation, un slot manquant, un compte owner sans slot ou une clinique sans compte clinic correspondant. Le mécanisme SQL exact sera éprouvé en migration : une seule contrainte UNIQUE ne garantit pas l'existence d'un propriétaire.

L'initialisation du premier propriétaire sera une procédure contrôlée distincte, sans inscription publique owner. Un transfert exceptionnel exige l'identité/autorité vérifiées, une transaction réattribuant le slot et les profils, révocation des sessions et audit. Le devenir exact de l'ancien compte relève de cette procédure explicitement approuvée ; aucune conversion ou suppression automatique par le portail.

## États et opérations

L'état d'approbation clinique et l'état de sécurité du compte sont distincts. Un compte actif ne suffit pas à autoriser une soumission : il faut aussi une clinique approved, non suspendue, non bloquée pour sécurité, avec session valide.

| Objet / opération | Précondition et résultat |
|---|---|
| Inscription clinique | Créer atomiquement compte clinic, credentials, profil complet et clinique pending, preuve d'acceptation légale et événement ; aucune commande autorisée avant approbation |
| Approbation / refus | Utilisateur labo habilité ; dernière révision contrôlée ; décision et auteur historisés ; refused ne donne jamais accès à la soumission |
| Suspension clinique | Clinique existante ; drapeau suspended et révocation des sessions du compte dans la même transaction, sans effacer travaux/historique |
| Réactivation clinique | Décision habilitée et historisée ; retire la suspension, sans lever une mesure security_locked ou reset obligatoire |
| Invitation admin | Propriétaire seulement ; compte admin invited sans credential ; acceptation atomique avant expiration, création du mot de passe et passage active |
| Invitation employé | Propriétaire ou admin ayant la délégation adéquate ; limites de grants vérifiées ; même sécurité de token que pour admin |
| Suspension d'un compte labo | Propriétaire pour admins ; propriétaire/admin délégué pour employés ; compte suspended, sessions révoquées, aucun effacement d'attribution |
| Acceptation d'invitation | Digest, but, compte, état, expiration et non-consommation contrôlés ; consommation atomique à usage unique ; état active seulement après création du credential |
| Compte clinique compromis | Propriétaire ; security_locked + reset obligatoire + auth_epoch avancé/sessions révoquées ; vérification du demandeur avant reprise, conservation des données |
| Récupération ordinaire | Challenge borné/unique, réponses publiques ne révélant pas l'existence du compte ; révocation/renouvellement sécurisé ; ne lève pas implicitement suspension ou blocage administratif |
| Propriétaire sans e-mail accessible | Intervention technique exceptionnelle documentée, identité/autorité vérifiées, sessions révoquées et audit ; aucune route publique de transfert ou accès SQL administrateur IA |

Le compte owner est unique et ne peut pas être désactivé via une gestion ordinaire permettant de retirer le dernier propriétaire. Les interventions techniques exceptionnelles restent soumises à autorisation et au protocole sécurisé. Les administrateurs ne gèrent jamais les comptes des autres administrateurs, ne s'auto-attribuent pas de grants ; aucune affectation des travaux aux employés.

La réinscription après refus, le transfert de compte partagé à une autre clinique ou la fusion de cliniques ne sont pas des workflows demandés. Aucun de ces comportements n'est ajouté à ce modèle.

## Changement d'e-mail clinique

1. La clinique demande le changement ; l'e-mail de connexion actif reste inchangé.
2. L'administrateur habilité décide sur la révision attendue. Après accord, challenge à usage unique envoyé à la nouvelle adresse.
3. Confirmation valide : verrouiller compte/demande, vérifier unicité de email_key à nouveau, activer l'adresse, consommer le challenge, historiser et inscrire l'alerte à l'ancienne adresse dans l'outbox. Conserver des sessions sous ancienne identité n'est pas implicite : leur révocation et le renouvellement sont contrôlés dans la politique de sécurité.
4. Refus/expiration/révocation : aucune activation. Les tentatives concurrentes sur une même adresse sont départagées par la contrainte unique ; pas d'écrasement d'un autre compte.

La comparaison canonique d'e-mail et les règles de normalisation seront définies et testées au contrat d'authentification, sans transformation automatique de points, suffixes ou alias fournisseur. Conserver l'adresse saisie pour l'envoi. Aucun accès fournisseur ni envoi réel dans cette conception.

## Concurrence, historique et accès

- Chaque modification de profil/état utilise une révision attendue ; les décisions sensibles verrouillent le compte/clinique et les rows concernées. Un refus de version obsolète impose relecture.
- Expiration de token contrôlée à l'instant de consommation, même si un nettoyage n'est pas passé. Le remplacement d'une invitation invalide l'ancienne dans une transaction ; token secret absent des logs/historiques.
- Changement de droits/suspension révoque les sessions et invalide les contextes d'accès ; les jobs, recherches, téléchargements et canaux temps réel recontrôlent l'état courant. Les connexions déjà ouvertes ne doivent pas continuer à diffuser après révocation.
- Une expiration/session ou suspension côté serveur ne garantit pas une révocation immédiate du coffre local hors connexion. Au retour réseau, refus et demande de purge locale conformément au §11.
- La conversation générale permanente est créée/garantie par messaging avec unicité clinic_id ; elle ne dépend pas de l'existence d'une commande.
- Une action de clinique est attribuée au compte partagé ; prénom/nom du dentiste de référence ne prouvent pas l'identité physique de son auteur.
- Les données de comptes, tokens et événements sont projetées selon besoin ; owner seul lecteur de l'audit global. Historiques métier visibles suivant droits ; aucun mot de passe/digest de session dans un DTO.

## Vérification de conception et tests à implémenter

| Scénario | Résultat exigé à l'implémentation |
|---|---|
| Deux créations simultanées d'un propriétaire / second owner | Refus du second ; slot cohérent et aucune absence de propriétaire après commit |
| Deux cliniques sur le même compte / second compte pour une clinique | Refus par association et contraintes ; compte partagé unique |
| Deux invitations acceptées en concurrence | Une seule réussite ; aucun credential ou état partiellement créé |
| Invitation expirée mais pas nettoyée / token d'un autre but | Refus sans activation |
| Admin modifie un autre admin ou ses propres droits | Refus côté serveur et aucune élévation |
| Clinique pending/refused/suspended soumet | Refus sans commande, même avec session auparavant valide |
| Suspension pendant une opération / contexte obsolète | Décision sérialisée et recontrôle ; aucune nouvelle opération après suspension effective |
| Confirmation e-mail concurrente pour même adresse | Une activation au plus ; ancien e-mail conservé si échec, pas de collision silencieuse |
| Réactivation avec security_locked | Blocage conservé jusqu'à procédure de sécurité validée |
| Historique après suspension/changement d'adresse | Auteur stable et dates/décisions disponibles sans exposer de secrets |

Ces scénarios sont une matrice de validation future, pas des tests exécutés. 3.2 valide les clés, associations, unicités et états de la conception ; les migrations et tests réels restent aux fondations/authentification. Durées de tokens, algorithme de hash de mot de passe, renouvellement de session et procédure exceptionnelle seront précisés avant leur implémentation, sans chiffres arbitraires.
