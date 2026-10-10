# Architecture applicative — laboratoire dentaire

Ce document décline les décisions de ROADMAP 1.3, 1.4 et 2.1–2.9 pour le point 3.1. Le cahier des charges reste l'autorité métier. Cette conception ne prouve ni l'implémentation, ni la faisabilité sur les appareils cibles, ni l'aptitude à la production.

## État audité et références

Au contrôle du 10/10/2026 (Europe/Brussels), aucun package applicatif, frontend, API ou schéma métier n'est présent. Le dépôt contient les références, le suivi, les protections documentées et le mécanisme de migration. Les chemins applicatifs ci-dessous sont des cibles de construction, pas des fichiers prétendument existants.

Références : [cahier des charges](../CAHIER_DES_CHARGES.md), [principes génériques](../Prompt_Architecture_Web.md), [complément](../ARCHITECTURE_ADAPTEE.md), [roadmap](../ROADMAP.md), [protocole](../CONSIGNE.md), [environnement](ENVIRONMENT.md), [runtime](RUNTIME_PRIVILEGES.md), [garde-fous](INFRASTRUCTURE_GUARDS.md).

## Stack et organisation

React + Vite + TypeScript 6 pour le navigateur ; Express + TypeScript 6 pour l'API ; PostgreSQL 17, exclusivement dental_lab. Monolithe modulaire : une application métier, deux portails, pas de services métier indépendants.

La structure cible reprend la proposition 1.3 : npm workspaces, apps/web, apps/api et packages/contracts ; SQL versionné dans migrations. Les versions stables, moteurs, peers, plugins et lockfile seront contrôlés à l'installation. Aucun changement de Node global ni passage forcé à TypeScript 7. pg, Zod, TanStack Router/Query, Tailwind, Vitest et Playwright restent des outils proposés à vérifier aux fondations ; leur présence ou leur installation n'est pas supposée.

| Zone cible | Responsabilité | Limite |
|---|---|---|
| apps/web/src/app | Composition, navigation, deux portails, gestion du cycle de session | Ne décide pas les autorisations métier |
| apps/web/src/features/<module> | Écrans, formulaires et interactions propres à une fonctionnalité | Utilise les contrats publics ; pas de SQL ni secret |
| apps/web/src/shared | Composants génériques, transport et utilitaires techniques | Ne dépend pas des fonctionnalités métier |
| apps/api/src/modules/<module> | Routes, contrôleurs, schémas, services, repositories et API publique du module | Pas d'import des internes d'un autre module |
| apps/api/src/app | Composition des modules, ports/adaptateurs et providers | Pas de règles métier déplacées dans le bootstrap |
| packages/contracts | DTO, schémas d'entrée/sortie, erreurs publiques et événements exposables | Pas de credentials, configuration privée ou code de persistance |
| migrations | Évolutions SQL immuables après exécution, versionnées | Approbation administrateur du fichier et du SHA256 à chaque exécution |

Créer seulement les dossiers et fichiers nécessaires au point d'implémentation concerné. Les détails d'arborescence ne deviennent pas une obligation de multiplier les fichiers.

## Propriétaires métiers et contrats

Les contrats suivants nomment des intentions ; ils ne déclarent pas de routes, tables ou fonctions déjà présentes.

| Module | Propriété et contrat public | Source métier |
|---|---|---|
| identity | Comptes, credentials, sessions, invitations, récupération et révocation ; fournit une identité serveur minimale | §§2, 11, 15 |
| clinics | Profil, compte partagé, approbation/refus/suspension, demande d'e-mail ; retourne le contexte clinique autorisé | §2 |
| permissions | Grants individuels, prérequis, délégabilité et droits effectifs par action/ressource | §§2.3, 15 |
| catalog | Matériaux, teintes, types et états de sécurité ; fournit des snapshots historiques | §3 |
| orders | Travail officiel, versions, dents, statuts, demandes pendantes et verrouillage ; soumission, décision et progression | §§4–5 |
| linked-works | Filiation, remplacement/supplément, retouche/refabrication et unicité active ; applique le workflow orders | §§5.5, 6 |
| delivery | Dates planifiées, priorité, modes de sortie, calendrier et correction exceptionnelle ; délègue les transitions à orders | §7 |
| files | Métadonnées, intégrité, fragments, catégories et partage ; transferts, attachement, lecture et ZIP autorisés | §§4.2, 8, 12 |
| drafts | Brouillons serveur, révisions, fichiers et protocole de conflit ; synchronisation et acquittement sans soumission automatique | §11 |
| messaging | Conversations, messages/version/masquage, lecture et clôture ; une générale par clinique et une par travail | §9 |
| notifications | Notifications internes, sélection des destinataires, rappels, relances et état fournisseur | §10 |
| audit | Append des traces expurgées et lecture globale propriétaire ; aucune API publique d'édition/purge | §15 |
| settings | Informations labo, destinataires par catégorie et paramètres approuvés avec historique | §§3, 10, 16 |
| compliance | Versions de textes, acceptations et décisions de conservation validées | §§14, 17 |
| operations | Maintenance, état, capacité et politiques d'exploitation propres au labo | §§12, 16 |
| events | Outbox transactionnelle et dispatch technique rejouable, sans décision métier | §10.4 |

Les demandes de modification/annulation restent dans orders ; les retouches dans linked-works et le workflow orders. Pas de module financier, patient transversal, affectation d'employés ou tickets de droits des personnes. Les demandes légales passent par la conversation générale et la procédure propriétaire.

## Dépendances et autorisation des ressources

Frontend : app → features → shared. Backend : routes → controllers → services → repositories. Les routes valident le transport, les contrôleurs traduisent les contrats, les services décident les règles, les repositories exécutent les requêtes paramétrées. Une route ne contacte jamais la base ; un repository ne dépend pas d'un contrôleur.

Le graphe ci-dessous reprend 1.4. A → B signifie accès à l'API publique de B. Aucun import interne ni cycle n'est permis.

```json
{
  "permissions": [],
  "audit": [],
  "events": [],
  "compliance": ["permissions", "audit", "events"],
  "identity": ["permissions", "compliance", "audit", "events"],
  "clinics": ["identity", "permissions", "audit", "events"],
  "catalog": ["permissions", "audit", "events"],
  "files": ["permissions", "audit", "events"],
  "messaging": ["clinics", "files", "permissions", "audit", "events"],
  "orders": ["clinics", "catalog", "files", "messaging", "permissions", "audit", "events"],
  "drafts": ["clinics", "catalog", "files", "permissions", "audit", "events"],
  "linked-works": ["orders", "permissions", "audit", "events"],
  "delivery": ["orders", "permissions", "audit", "events"],
  "notifications": ["identity", "permissions"],
  "settings": ["permissions", "audit", "events"],
  "operations": ["settings", "events"]
}
```

files et messaging déclarent un port d'autorisation de la ressource parente. La composition raccorde ce port à une lecture minimale orders/clinics/permissions qui ne rappelle pas files/messaging. Ce contexte est calculé sur le serveur, jamais accepté tel quel du navigateur. delivery contrôle les retouches via un port de lecture minimal ou une orchestration de service, sans dépendance inverse orders → linked-works.

events ne connaît pas les handlers métier : la composition les enregistre. notifications reçoit ses projections nécessaires via les événements et ports raccordés ; une notification ancienne ne constitue jamais un grant. Les workers recontrôlent l'état, les droits et l'utilité avant envoi.

L'identité authentifiée, la clinique, les permissions et la ressource sont vérifiées à chaque opération. Les projections logistiques excluent patient et instructions techniques à la source, pas seulement dans l'UI. Même contrôle pour recherches, aperçus/noms de fichiers, ZIP, notifications et événements temps réel. L'absence de droit ne doit pas révéler la présence d'un objet d'une autre clinique.

## Transactions, concurrence et fichiers

Une unité de transaction partage le même contexte de connexion PostgreSQL entre les API publiques des modules participant à une décision atomique. Chaque repository accepte ce contexte explicitement ; aucun module ne peut terminer la transaction de son appelant.

Cas à éprouver : décision sur dernière version ; exclusivité d'une demande pendante ; verrouillage au début de fabrication ; création de travail lié et annulation du précédent ; unicité de retouche active ; livraison/clôture de conversation et correction/réouverture ; ordre officiel + références fichiers + audit + événement durable. Les constraints SQL et contrôles de versions seront conçus aux points 3.2–3.6, puis testés à l'implémentation. Aucune contrainte ou table absente n'est présentée comme déployée.

Les données officielles ne sont pas écrasées : nouvelle version et trace de décision. Les clés d'idempotence sont liées au compte et à l'intention, avec résultat récupérable après réponse perdue ; leurs formats/durées seront précisés à la conception dédiée.

Les fichiers sont transférés et vérifiés avant confirmation finale. Une transaction SQL ne rend pas atomique un système de fichiers : la finalisation associe seulement des objets vérifiés, suivis par un état durable ; une réparation bornée distingue transferts temporaires et données attachées. Ne jamais supprimer un fichier historique pour libérer de l'espace. Assemblage, stockage/chiffrement/antimalware, dimensions des fragments et seuils sont à décider en 3.7 et chapitre 12.

Les e-mails sont traités après commit via outbox et retries. Un échec fournisseur n'annule pas une action métier. Une émission externe peut être répétée après incident : déduplication et état fournisseur, sans promesse d'exactement une livraison.

## PWA, gros fichiers et échanges

- Shell installable, interface albanaise, JJ/MM/AAAA et Europe/Pristina ; labels de matériaux/teintes conservés.
- Coffre local : seuls brouillons et leurs fichiers, séparation par compte, chiffrement et déverrouillage supplémentaire ; logout conserve les données protégées. Le service worker ne met pas automatiquement en cache les commandes officielles ni leurs fichiers.
- Synchronisation versionnée avec choix serveur ou clone local incluant les fichiers ; acquittement certain avant abandon local. Toujours une confirmation explicite pour la soumission officielle.
- Au retour réseau : session/état du compte et catalogue revalidés ; purge locale d'un compte suspendu au mieux des capacités du navigateur. Aucune révocation instantanée hors réseau.
- Streaming et reprise des fragments ; 200 Mo/fichier, 1 Go initial et 1 Go/message. Aucun quota cumulatif de conversation ni limite additionnelle non décidée. Origines privées, ZIP filtré et fidèle ; pas de chargement d'un Go en mémoire.
- Messages persistants et récupération après déconnexion ; temps réel ne remplace pas les lectures serveur. Transport et reprise seront décidés en 3.9 ; chiffrement/offline en 3.8, avec tests sur appareils réels.

## Exploitation, secrets et frontières du VPS

dental-ai reste un compte d'audit sans sudo général ni appartenance migrator/owner. Le lanceur administrateur révision 3 est installé ; son utilisation exige chaque SQL et SHA approuvés. Les trois fixtures validées en 2.6 ne seront pas rejouées.

Le runtime de ce projet sera indépendant. dental-site, son compte, ses chemins et secrets sont exclus. RUNTIME_PRIVILEGES.md contient une conception, pas un runtime installé. Pas de nouveau compte, service, secret, port, DNS/TLS ou modification système à cette étape.

L'environnement est validé au démarrage, secrets absents du client/Git/logs. Les erreurs publiques ont un code stable : validation, authentification, autorisation, introuvable, conflit, limitation, fournisseur, interne ; aucun SQL/stack/secrets dans la réponse. Les logs techniques expurgés ne remplacent pas l'audit métier.

Confinement systemd de développement accepté avec risques réseau local/processus/IPC/ressources partagées ; pas d'isolation complète. Les garde-fous ne prouvent pas la confidentialité production. Réévaluation avant production ; aucune donnée médicale réelle avant les validations correspondantes.

Archivage UI à J+30 distinct de rétention légale ; durées par catégorie à valider, pas de purge automatique métier. Backups chiffrés hors VPS et rétention 30 jours ; RPO 1h/RTO 4h restent des objectifs nécessitant restauration éprouvée.

## Preuves attendues et décisions restantes

| Jalons | Décision ou preuve |
|---|---|
| 3.2–3.6 | Modèles, clés, permissions, versions, automates et filiations |
| 3.7–3.9 | Fichiers, coffre/synchronisation et transport/notifications |
| Fondations applicatives | Installation stable, lockfile, typage/lint/format/build et règles d'import |
| Chapitres métier et tests | Refus intercliniques/IDOR, concurrence, rollback, idempotence, droits révoqués |
| PWA et transferts | Appareils réels, quotas/éviction/déverrouillage, conflits avec fichiers, interruption et limites |
| Production/exploitation | Runtime séparé, permissions effectives, sécurité, conformité, sauvegarde/restauration et recette |

Les ADR ci-dessous enregistrent les décisions déjà établies, sans clôturer ces preuves futures : [stack](decisions/0001-stack.md), [frontières et atomicité](decisions/0002-module-boundaries.md). Le [modèle comptes et cliniques](models/accounts-clinics.md) détaille le point 3.2. Le [modèle des droits](models/permissions.md) détaille le point 3.3. Le [modèle commandes et versions](models/orders-versions.md) détaille le point 3.4. Le [modèle des travaux liés](models/linked-works.md) détaille le point 3.6. Le suivi des états reste dans ROADMAP.md et EXECUTION_LOG.md.
