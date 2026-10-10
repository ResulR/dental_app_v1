# Droits granulaires — point 3.3

Conception dérivée de CAHIER_DES_CHARGES §§2.3, 4–10 et 15, du [modèle comptes](accounts-clinics.md) et de [l'architecture](../architecture.md). Aucun grant, rôle SQL, service ou permission Linux modifié. Les identifiants proposés sont des capacités applicatives, pas des rôles PostgreSQL.

## Représentation et calcul

Tables proposées : permission_definitions(code PK), permission_prerequisites(permission_code, prerequisite_code, PK composée), account_grants(account_id, permission_code, PK composée), employee_delegation_limits(delegator_account_id, permission_code, PK composée) et historique de grants (acteur, cible, différence, motif si pertinent, date). FKs vers comptes/définitions ; pas de rôle métier personnalisé multiplié pour chaque combinaison.

Le propriétaire définit les grants individuels et, pour un administrateur, l'enveloppe de permissions d'employés explicitement délégables. Une capacité d'administration d'employés n'autorise pas à accorder toute permission : chaque grant doit appartenir à cette enveloppe. Aucun grant de gestion d'administrateurs ou d'audit global n'est délégable à un administrateur.

Les noms des capacités ci-dessous identifient les décisions ; l'inventaire de code sera fermé et versionné, sans capacité arbitraire créée par le navigateur. Profil clinic : accès intrinsèque aux seules données de sa clinique et opérations du workflow clinique, jamais grants labo. Profil owner : contrôle métier complet mais contraintes de statut/sécurité et impossibilité de falsifier/purger librement l'audit restent applicables. Admin/employee : refus par défaut, grants effectifs seulement.

Une autorisation exige conjointement : compte/session valides, état clinique si applicable, ressource dans le périmètre serveur, grants et tous leurs prérequis, état métier/révision valides et absence de blocage incompatible. Aucun grant ne contourne un catalogue interdit ou une instruction verrouillée.

## Matrice des prérequis

« Parent autorisé » est un contrôle dynamique de ressource, pas un grant envoyé par le client. Les capacités de lecture labo couvrent les travaux accessibles du laboratoire ; aucune affectation à un employé. Un grant de consultation détaillée dépend de la consultation logistique.

| Capacité proposée | Prérequis de grant | Contrôle dynamique supplémentaire |
|---|---|---|
| orders.read_logistics | Aucun | Projection : numéro, clinique, statut, priorité, dates, mode ; ni patient, dents, instructions ni noms de fichiers médicaux |
| orders.read_details | orders.read_logistics | Projection détaillée incluant patient/instructions autorisés |
| files.view | Aucun prérequis universel entre grants fichiers | Parent et données correspondantes accessibles ; catégories et partage contrôlés |
| files.download | Aucun lien d'implication avec files.view | Parent et données correspondantes accessibles ; même exigence pour ZIP |
| messaging.order.read | orders.read_logistics | Accès au travail et droit explicite de lecture de sa conversation ; ne confère pas la consultation détaillée du formulaire officiel |
| messaging.order.reply | messaging.order.read | Accès au travail, contenu autorisé, conversation ouverte |
| messaging.general.read | Aucun accès de commande exigé | Conversation générale clinique autorisée, indépendamment de toute commande |
| messaging.general.reply | messaging.general.read | Même parent ; compte clinique actif selon contrôle serveur |
| orders.accept / reject / request_correction | orders.read_details | Dernière version et statut valides ; motifs selon workflow |
| orders.edit_instructions | orders.read_details | Avant fabrication, statut autorisé, motif ; aucune demande pendante bloquante |
| orders.start_manufacturing | orders.read_details | Acceptée, aucune demande pendante, aucune référence interdite |
| orders.create_for_clinic | orders.read_details | Clinique existante autorisée, validation identique des données ; origine labo |
| orders.cancel | orders.read_logistics | Statuts permis, motif ; aucune annulation ordinaire de Terminée/Livrée |
| orders.change_status | orders.read_logistics | Transitions explicitement permises ; ne remplace pas start_manufacturing ni les actions plus sensibles |
| delivery.plan / set_priority / mark_delivered | orders.read_logistics | Dates/mode et éligibilité ; confirmation livraison, chaque item recontrôlé |
| delivery.correct | orders.read_logistics | Owner ou admin spécifiquement autorisé, motif, aucune contradiction de retouche |
| linked_works.manage | orders.read_details | Travail parent, règles de filiation et retouche ; même workflow d'approbation |
| files.add_followup / share_followup | files.view | Accès aux données du parent ; suivi distinct des instructions ; partage individuel confirmé/révocable |
| catalog.manage | Aucun prérequis de consultation des travaux | Autorité labo ; états interdits non contournables ; impacts signalés au propriétaire |
| clinics.manage | Aucun grant de lecture détaillée implicite | Profil/approbation/suspension selon autorité ; lire des travaux exige ses propres grants |
| employees.create / suspend / manage_permissions | Aucun grant métier implicite | Propriétaire ou admin délégué ; cible employee seulement ; enveloppe de délégation vérifiée |
| settings.manage | Aucun grant de lecture détaillée implicite | Catégories autorisées ; destinataires email métier parmi admins actuellement habilités |
| owner-only | Aucune délégation | Audit global, gestion admins, sécurisation compte compromis, maintenance, alertes critiques et interventions propriétaire |

L'accès logistique seul n'ouvre ni fichiers ni conversations. La lecture de messages est une autorisation de contenu distincte : un message libre peut contenir des informations patient, même si le formulaire officiel reste inaccessible en détail. Ne pas prétendre filtrer automatiquement ces informations dans un texte libre. L'interface de gestion des droits doit rendre cette exposition explicite au propriétaire. Pour les fichiers, l'accès aux données correspondantes est un prédicat supplémentaire ; les fichiers de fabrication requièrent l'accès détaillé. Les fichiers/messages généraux ne sont pas artificiellement rattachés à une commande. La conception détaillée des catégories/ACL en 3.7 conserve ces règles, sans grant global de contournement.

Visualisation et téléchargement restent deux droits distincts. Si une visualisation 3D doit transmettre les octets au navigateur, il est impossible de promettre qu'ils ne seront pas copiés : la séparation contrôle les fonctionnalités/accès du produit, pas une protection DRM.

## Cohérence et délégation

Refuser un ensemble de grants demandé si un prérequis manque ; ne pas ajouter silencieusement une permission plus large. Au retrait d'un prérequis, invalider les grants dépendants et montrer le résultat avant validation ; le calcul effectif les refuse immédiatement, même si la matérialisation n'est pas encore nettoyée. Les dépendances sont orientées et acycliques.

Une opération de gestion de droits verrouille acteur/cible et leur révision, recontrôle les droits actuels et l'enveloppe, puis persiste grants, dépendances invalidées et audit dans une même transaction. Un admin ne modifie pas sa propre autorité ou les droits d'un autre admin. Si la délégation est révoquée pendant l'opération, la décision est sérialisée, sans réutiliser un ancien contexte permissif.

Un grant « réponse » implique lecture via prérequis, mais lecture n'implique jamais réponse. Télécharger n'implique pas visualiser et visualiser n'implique pas télécharger. Les droits de conversations générale/de travail sont indépendants ; l'autorisation générale ne donne pas l'accès aux travaux de la clinique.

## Contrôles serveur

| Frontière | Vérification obligatoire |
|---|---|
| Routes de mutation | Identité actuelle, grant, parent, statut/révision, champs autorisés ; aucun clinic_id/role/effective_grants cru |
| Listes, recherche, calendrier | Filtres imposés serveur ; recherche patient impossible sans détail ; aucun compteur/résultat interclinique révélateur |
| Projection détail | Sélection serveur des champs ; masquer dans React ne suffit pas |
| Fichiers, noms, aperçus, ZIP | Recontrôle parent, accès aux données, catégorie/partage et capacité view/download sur chaque objet |
| Événements temps réel | Autorisation à l'abonnement et à la diffusion ; retrait de droit révoque contexte/canal, reprise filtrée |
| Notifications internes | Projection autorisée au moment de lecture ; cible/événement ne constituent pas une autorisation |
| E-mails asynchrones | Destinataire par catégorie et encore habilité, utilité de l'envoi tardif ; pas de données patient excessives |
| Jobs / traitements en lot | Identité de processus bornée, contrôle item par item ; aucune permission globale déduite du premier item |
| Journaux | Historique métier selon droits, audit global owner seulement ; payload expurgé |

## Matrice de validation future

- Logistique seul : API/recherche/notifications/temps réel ne retournent ni patient ni instructions ; accès direct par identifiant non autorisé refusé.
- Détail sans action : consultation possible, mutation refusée.
- View sans download et réciproquement : endpoints/fonctions distincts, ZIP n'élève pas les droits.
- Réponse sans lecture dans une demande de grants : refus ; lecture retirée → réponse invalide.
- Général seul : aucun accès conversation de travail ; ordre seul : aucun accès général implicite.
- Admin délégué : crée/modifie seulement employés dans l'enveloppe actuelle ; aucun autre admin ni auto-élévation.
- Owner : ne contourne pas verrouillage de fabrication, interdiction de référence ou audit immuable.
- Droits révoqués pendant un téléchargement, lot ou canal : nouvelle opération refusée, diffusion filtrée ; ne promet pas récupération des copies déjà reçues.
- Deux cliniques : refus sur toutes les frontières, y compris parent forgé, recherche, fichiers et événements.

Cette matrice décrit les tests à exécuter lors de l'implémentation. À 3.3 : revue des prérequis et frontières, pas de preuve de code d'autorisation existant.
