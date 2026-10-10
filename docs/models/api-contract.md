# Contrat API et erreurs métier — conception 3.11

Sources : CDC, [architecture](../architecture.md), [versions](orders-versions.md), [permissions](permissions.md), [synchronisation](drafts-sync.md), [événements](events-notifications-audit.md). Aucun endpoint ou middleware déjà déployé. La validation de ce point Audit/décision porte sur des contrats communs réutilisés dans les deux spécifications client/serveur ; leur import réel dans React/Express et génération TypeScript seront vérifiés après initialisation au chapitre5.

## Source commune et frontières

Les [schémas JSON communs](../contracts/common.schema.json) (JSON Schema2020-12) et leur [référencement par consommateurs](../contracts/consumers.json) fixent la même référence pour web et API. Pas de DTO dupliqués. Contrats initiaux : soumission clinique normale, précondition de mutation, projection logistique, reçu de soumission et erreur. Les autres contrats suivent ces conventions aux modules dédiés ; ne pas appliquer le formulaire clinique normal à une retouche ou création labo.

Le serveur valide les entrées, droits et règles métier ; le navigateur fournit une aide de saisie avec les mêmes formes, sans devenir autorité. Le mapping vers TypeScript6/Zod ou validateur compatible sera arrêté aux fondations, versions/peers vérifiés. DTO sans code de persistance, secret, rôle arbitraire ou clinic_id pris comme autorité. Le namespace clinique et l'acteur viennent de la session serveur ; id opaque n'est pas un grant.

Schéma seul ne garantit pas : trim/rejet de champs blancs, dates calendaires réelles, unicité FDI entre états différents, contenu/taille/permissions des fichiers, total initial1Go, catalogue courant, statut ou CAS. Ces validations sémantiques sont serveur et doivent être partagées par contrat lorsque déterministes, puis testées en intégration. Schémas fermés refusent propriétés inattendues aux entrées et projections ; zéro dent et description absente/vide sont autorisés, patient référence seule ou prénom+nom ou les deux.

## Versionnage et familles d'intentions

H311-01 technique réversible : préfixe API /api/v1, identifiants de schéma versionnés, nomenclature stable des codes. Aucun domaine/port réel déduit de ce préfixe. Ajout optionnel compatible, retrait/renommage/changement sémantique = nouvelle version/stratégie de migration ; formats du coffre et événements ont leur propre schema_version. Client inconnu/incompatible informe sans écraser données locales.

| Famille proposée | Frontière / contrat | Validation et effets |
|---|---|---|
| identity/clinics | Session, invitations, récupérations, demandes/décisions e-mail | Permissions profil et anti-énumération ; secrets jamais réémis dans DTO/logs |
| catalog | Lecture et états courants, mutation habilitée | Snapshots historiques séparés, interdit non contournable |
| drafts | Révision, manifeste de fichiers, reçu sync, conflit/tombstone | Même compte, CAS, clone explicite, pas de soumission automatique |
| orders | Soumission clinique et reçu ; actions explicitement nommées, pas PATCH status arbitraire | Dernière version/état ; transaction audit/outbox/numéro/conversation |
| requests/linked-works | Propositions avant/après, décisions/retrait, retouche/filiation | Demande unique, permissions et unicité retouche, R14 |
| delivery | Planning, priorité, livraison et correction exceptionnelle | Précondition courante, lot confirmé, aucune mutation instructions |
| files | Initialise/transfère/vérifie/attache, view/download/ZIP | Streaming séparé du JSON, taille réelle et parent/droits à chaque frontière |
| messaging | Message/version/masquage, curseur lu | Parent, conversation ouverte pour réponse, Lu séparé du métier |
| notifications/events | Liste/lecture et signaux SSE | Projections minimales, replay filtré, droits actuels |
| settings/audit/operations/compliance | Paramètres autorisés, lecture audit owner, maintenance/textes | Pas d'édition/purge audit libre ni élévation de grants |

Ces familles sont une conception de contrats, pas une liste de chemins fictivement présents. Une action mutation exige CSRF/session et authentification actuelle, même si un SSE est ouvert. Soumission officielle après confirmation explicite uniquement ; vérifier reçu après réponse perdue.

## Types de transport

Dates métier = YYYY-MM-DD sans convertir arbitrairement par timezone ; instants serveur = UTC RFC3339, interface DD/MM/YYYY Europe/Pristina. Valeurs de statuts machine fermées mappées aux huit libellés albanais futurs ; archive et blocage sécurité restent orthogonaux. Nombres de révision entiers sûrs monotones, pas timestamp comparé client. IDs/numéro professionnel distincts, pas format UUID commercial imposé.

Patient dans DTO détaillé autorisé seulement. Projection logistique commune exclut patient, dents, description, matériau et noms médicaux de fichiers ; recherche patient exige droit détaillé. Brouillon peut rester incomplet, schéma de soumission ne sert pas de prérequis à sa sauvegarde locale.

Content-Type application/json pour métadonnées et application/problem+json pour erreurs ; binaires/segments via transport streaming dédié borné sans lecture d'1Go par un JSON parser. Auth/session en cookies sûrs, aucun mot de passe/code de secours/clé dans URL ; corps/formulaires sensibles exclus des logs. GET n'effectue pas de décision métier.

## Pagination, filtres et limites techniques

H311-02 technique réversible : pagination par curseur serveur opaque lié au compte, filtre, tri et révision de projection ; page25 par défaut, maximum100 par réponse liste, à calibrer. Ce plafond de lecture n'est pas un nombre maximum métier de fichiers/travaux/messages. Tri déterministe date serveur + id ; curseur expiré/incompatible → recharger liste explicitement, pas changer de clinique.

Filtres fermés : statut, date, normal/retouche selon CDC ; recherche clinique/numéro et patient nom/référence uniquement si droit détaillé. Pas de filtre matériau ajouté. Requêtes SQL paramétrées ; noms de tris/colonnes jamais libres. Total facultatif : ne pas promettre un compteur stable entre modifications concurrentes. Page de fichiers/pieces n'implique pas que le ZIP exclut au-delà100 : parcourir toutes les références autorisées.

Rate limiting par route/intention, compte et origine avec protection contre blocage global partagé d'une clinique ; budgets distincts login/récupération/invitation, mutations, listes, SSE et uploads (segments repris ≠ double soumission). Seuils et taille JSON après mesures/configuration versionnée aux points sécurité et fichiers, aucun chiffre de production inventé. Quota stockage et limitation requêtes ne sont pas un nombre de commandes autorisées. 429 et attente explicite, pas retry agressif ; concurrence/temps/mémoire limités sans saturation voisins.

## Concurrence et idempotence

Mutations reçoivent expected_revision et, si nécessaire, version examinée ; absence précondition =428, révision ancienne =409 avec code stable après contrôle de droits. Réponse permet relecture autorisée, pas fuite du patient dans erreur. Services recontrôlent tous les invariants en transaction ; champs calculés (numéro, acteur, clinique, statut automatique) ne sont pas acceptés comme autorité du body.

Idempotency-Key opaque technique lié au compte ET intention, pas valeur médicale. Reçu unique contient empreinte canonique de l'intention et références vérifiées, résultat après commit ; même clé/même payload = même résultat autorisé, même clé/autre payload =409 IDEMPOTENCY_CONFLICT. Deux intents légitimes similaires restent distincts. Statut encore en cours explicite et consulta­tion du reçu, jamais créer un second travail sur timeout.

Garder les reçus de soumission avec le travail tant que justifié et support de reprise nécessaire ; durée minimale/rejeu et purge opérationnelle à préciser avec rétention, aucune expiration qui autorise silencieusement une ancienne clé à recréer le même travail. Client conserve l'intention jusqu'au reçu certain. Revocation/suspension toujours recontrôlée lors du retour d'un reçu ; connaître la clé ne contourne pas les ACL.

## Erreurs publiques stables

| HTTP / code | Sens et action client |
|---|---|
|400 VALIDATION_FAILED | Transport malformé/champ inconnu ; corriger sans retry aveugle |
|401 AUTHENTICATION_REQUIRED | Authentifier/renouveler session selon protocole ; coffre ne remplace pas login |
|403 FORBIDDEN | Action refusée pour acteur autorisé à connaître la ressource ; ne pas tenter contournement |
|404 RESOURCE_NOT_FOUND | Absent ou ressource hors périmètre, sans distinguer clinique étrangère |
|409 REVISION_CONFLICT / STATE_CONFLICT / REQUEST_ALREADY_PENDING | Recharger état autorisé, décision explicite requise |
|409 IDEMPOTENCY_CONFLICT | Même clé avec contenu divergent ; ne pas convertir automatiquement en nouvelle soumission |
|422 VALIDATION_FAILED / CATALOG_FORBIDDEN / FILE_NOT_READY | Règle métier/champ réel invalide, informations minimales pour corriger |
|422 CATALOG_UNAVAILABLE | Signal lié à acceptation exceptionnelle sans motif requis ; soumission indisponible reste avertissement non bloquant |
|413 FILE_TOO_LARGE | Taille réelle dépassée, supprimer/remplacer fichier ; pas limite métier arbitraire |
|410 UPLOAD_EXPIRED | Segments disparus, retransfert explicite, brouillon local intact |
|428 VALIDATION_FAILED | Précondition de mutation absente |
|429 RATE_LIMITED | Attendre Retry-After, conserver intention, pas boucler |
|503 MAINTENANCE | Maintenance volontaire ; sync suspendue, brouillon local préparé possible |
|503 STORAGE_UNAVAILABLE / DEPENDENCY_UNAVAILABLE | Panne/capacité, distincte de maintenance ; état local conservé |
|500 INTERNAL_ERROR | Identifiant expurgé de corrélation pour diagnostic, aucun SQL/stack/secret |

Problem.type est référence stable /api/v1/problems/<code>, sans domaine inventé ; le client ne déréférence pas automatiquement. title localisé albanais et code machine stable ; erreurs par JSON Pointer/champ et code sans valeur rejetée. request_id opaque non secret ; aucun corps medical ou motif libre réfléchi dans erreur. RFC9457 et JSON Schema2020-12 consultés10/10/2026 : https://www.rfc-editor.org/rfc/rfc9457.html ; https://json-schema.org/draft/2020-12/json-schema-core.

## Validation

Contrats communs vérifiables localement : méta-schéma2020-12, refs consommateurs web/API identiques/résolues, exemples synthétiques positifs et refus de champs sensibles/imposés, FDI invalide, identification manquante, fuite logistique et erreur hors contrat. Aucun patient réel.

Imports React/Express, validation réelle serveur, génération TS6, transport CSRF/session, scopes/idempotence/concurrence et middleware seront testés après fondations et par module. Aucun endpoint, test réseau ou schéma SQL déclaré installé. Cette portée documentaire correspond au point Audit/décision3.11, sans prétendre le client/serveur absent opérationnel.
