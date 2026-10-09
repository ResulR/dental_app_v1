Prompt architecture web. 

# <ARCHITECTURE_DU_PROJET> 

# **Rôle et portée de cette section** 

Cette section définit les règles d’architecture, d’organisation et de qualité du code pour l’ensemble du projet. 

Elle est autonome et doit rester valable indépendamment des instructions placées avant ou après elle. Les autres parties du prompt peuvent définir les fonctionnalités, le design, la stack technique, les règles métier ou le déploiement, mais elles ne doivent pas entraîner une dégradation silencieuse de l’architecture décrite ici. 

N’invente aucune fonctionnalité à partir de cette section. Utilise-la uniquement pour déterminer où et comment organiser le code demandé ailleurs. 

Si le projet existe déjà : 

1. inspecte d’abord sa structure et ses conventions ; 

2. identifie les écarts avec cette architecture ; 

3. conserve ce qui est propre et fonctionnel ; 

4. améliore progressivement les parties concernées ; 

5. ne réécris pas inutilement tout le projet ; 

6. ne déplace pas des fichiers sans vérifier et mettre à jour leurs imports, tests et dépendances. 

Si le projet est nouveau, utilise directement les principes et la structure définis ci-dessous. 

Les instructions explicites de l’utilisateur restent prioritaires. Si une demande entre réellement en conflit avec une règle architecturale, signale précisément le conflit et propose la solution la plus sûre et la plus maintenable. 

# **Objectif architectural** 

Construire une application : 

- claire ; 

- modulaire ; 

- sécurisée ; 

- testable ; 

- évolutive ; 

- maintenable sur plusieurs années ; 

- compréhensible par un autre développeur ou une autre IA ; 

- facile à déployer et à diagnostiquer ; 

- sans complexité inutile. 

L’architecture de référence est un monolithe modulaire organisé par fonctionnalités métier. 

Ne transforme pas automatiquement le projet en microservices. Les microservices ne sont autorisés que si des besoins réels justifient des déploiements, des équipes, des charges ou des cycles de vie indépendants. 

# **Principes obligatoires** 

1. Organiser principalement le code par fonctionnalité métier, et non uniquement par type technique. 

2. Donner une responsabilité claire à chaque fichier. 

3. Garder les routes et les pages légères. 

4. Séparer l’interface, la logique métier, l’accès aux données et les services externes. 

5. Éviter les dépendances circulaires. 

6. Centraliser les contrats échangés entre le frontend et le backend. 

7. Considérer le serveur comme l’autorité pour les données sensibles et les règles métier. 

8. Valider toutes les données reçues depuis l’extérieur. 

9. Prévoir les tests, les logs, les migrations et la documentation dès la structure initiale. 

10. Ne créer une abstraction que lorsqu’elle possède une utilité réelle et identifiable. 

11. Éviter aussi bien les fichiers monolithiques que la fragmentation excessive en dizaines de fichiers inutiles. 

12. Ne jamais utiliser un dossier shared, utils ou helpers comme dossier fourre-tout. 

# **Structure de référence** 

Adapte cette structure à la stack demandée, sans en changer les principes fondamentaux : project/ 

├── apps/ │   ├── web/ │   │   ├── public/ │   │   │   ├── images/ │   │   │   ├── fonts/ │   │   │   └── favicon.svg │   │   │ │   │   ├── src/ │   │   │   ├── app/ 

│   │   │   │   ├── routes/ │   │   │   │   ├── layouts/ 

│   │   │   │   ├── providers/ │   │   │   │   ├── guards/ │   │   │   │   └── styles/ │   │   │   │ 

- │   │   │   ├── features/ 

- │   │   │   │   ├── feature-a/ 

- │   │   │   │   │   ├── api/ 

│   │   │   │   │   ├── components/ │   │   │   │   │   ├── hooks/ │   │   │   │   │   ├── schemas/ │   │   │   │   │   ├── types/ │   │   │   │   │   ├── utils/ │   │   │   │   │   ├── tests/ │   │   │   │   │   └── index.ts │   │   │   │   └── feature-b/ │   │   │   │ │   │   │   ├── shared/ │   │   │   │   ├── ui/ │   │   │   │   ├── hooks/ │   │   │   │   ├── lib/ │   │   │   │   ├── config/ │   │   │   │   ├── types/ │   │   │   │   └── assets/ │   │   │   │ │   │   │   └── main.tsx │   │   │ │   │   ├── package.json │   │   └── tsconfig.json 

- │   │ 

- │   └── api/ 

- │       ├── src/ 

- │       │   ├── modules/ 

- │       │   │   ├── module-a/ 

- │       │   │   │   ├── module-a.routes.ts 

- │       │   │   │   ├── module-a.controller.ts 

- │       │   │   │   ├── module-a.service.ts 

- │       │   │   │   ├── module-a.repository.ts 

- │       │   │   │   ├── module-a.schema.ts 

- │       │   │   │   ├── module-a.types.ts 

- │       │   │   │   └── module-a.test.ts 

- │       │   │   └── module-b/ 

- │       │   │ 

- │       │   ├── shared/ 

- │       │   │   ├── database/ 

- │       │   │   ├── middleware/ 

- │       │   │   ├── errors/ 

- │       │   │   ├── security/ 

- │       │   │   ├── logger/ 

- │       │   │   ├── config/ 

- │       │   │   └── utils/ 

- │       │   │ 

- │       │   ├── app.ts 

- │       │   └── server.ts 

- │       │ 

- │       ├── migrations/ 

- │       ├── seeds/ 

│       ├── package.json │       └── tsconfig.json 

│ 

├── packages/ 

│   ├── contracts/ 

│   ├── validation/ 

│   └── tooling/ 

│ 

├── tests/ 

│   ├── e2e/ 

│   ├── fixtures/ 

│   └── helpers/ │ 

├── docs/ 

│   ├── architecture.md 

│   ├── database.md 

│   ├── deployment.md 

│   └── decisions/ 

│ 

├── infrastructure/ 

│   ├── nginx/ 

│   ├── docker/ 

│   ├── systemd/ 

│   └── scripts/ 

│ 

├── .github/ 

│   └── workflows/ 

├── .env.example 

├── .editorconfig 

├── .gitignore 

├── package.json 

├── package-lock.json 

- ├── tsconfig.base.json 

└── README.md 

Cette structure est une référence, pas une obligation de créer tous les dossiers immédiatement. 

Ne crée que les dossiers nécessaires au projet actuel. Par exemple : 

- si le projet ne possède pas de backend, ne crée pas artificiellement apps/api ; 

- si aucun code n’est réellement partagé, ne crée pas de package partagé inutile ; 

- si le projet est un simple site vitrine, utilise une version simplifiée ; 

- si le framework impose une structure particulière, respecte-la tout en conservant la séparation des responsabilités ; 

- si le frontend et le backend vivent dans la même application full-stack, adapte la structure sans dupliquer artificiellement le projet. 

# **Architecture du frontend** 

# **Dossier app** 

Le dossier app contient uniquement la structure générale de l’application : 

- routes ; 

- layouts ; 

- providers globaux ; 

- protections de routes ; 

- styles globaux indispensables ; 

- initialisation de l’application ; 

- configuration générale de la navigation. 

Une route ou une page doit principalement assembler des fonctionnalités. 

Elle ne doit pas contenir toute la logique métier, les appels API, la validation, la gestion complète de l’état et des centaines de lignes d’interface. 

Exemple attendu : 

export function CheckoutRoute() { 

return ( 

<CheckoutLayout> 

- <CustomerInformation /> 

- <OrderSummary /> 

<PaymentMethod /> 

<CheckoutSubmitButton /> 

</CheckoutLayout> 

); 

} 

# **Dossier features** 

Chaque fonctionnalité métier doit posséder son propre module. 

Exemples possibles : 

features/ 

├── authentication/ 

├── products/ 

├── cart/ 

├── checkout/ 

├── orders/ └── admin/ 

Une fonctionnalité peut contenir : 

feature/ 

- ├── api/          # Appels API propres à la fonctionnalité 

- ├── components/   # Composants propres à la fonctionnalité 

- ├── hooks/        # Hooks et logique réutilisable 

- ├── schemas/      # Validation des formulaires et données 

- ├── types/        # Types propres au domaine 

- ├── utils/        # Fonctions pures propres à la fonctionnalité 

- ├── tests/        # Tests de la fonctionnalité 

└── index.ts      # API publique contrôlée du module 

Tous ces sous-dossiers ne doivent pas être créés s’ils sont vides ou inutiles. 

Une fonctionnalité doit exposer uniquement ce qui est nécessaire à travers son fichier index.ts. Évite les imports profonds vers des fichiers internes depuis le reste du projet. 

# **Dossier shared** 

Le dossier shared contient uniquement les éléments réellement génériques et indépendants du métier : 

- boutons ; 

- fenêtres modales ; 

- champs de formulaire ; 

- composants de mise en page génériques ; 

- client HTTP ; 

- formatage générique ; 

- hooks génériques ; 

- configuration publique ; 

- types réellement transversaux. 

Un composant partagé ne doit pas connaître les notions spécifiques de commande, paiement, produit ou utilisateur. 

Si un élément n’est utilisé que par une fonctionnalité, conserve-le dans cette fonctionnalité. Ne le place pas prématurément dans shared. 

# **Gestion de l’état** 

Utilise d’abord l’état local au composant. 

Déplace l’état uniquement lorsque cela devient nécessaire : 

1. état local pour une interaction locale ; 

2. hook de fonctionnalité pour une logique partagée dans le module ; 

3. état serveur ou bibliothèque de requêtes pour les données API ; 

4. store global uniquement pour les données réellement globales. 

N’utilise pas un store global comme base de données générale du frontend. 

Sépare clairement : 

- l’état provenant du serveur ; 

- l’état de l’interface ; 

- l’état persistant local ; 

- les données personnelles ou sensibles. 

Ne stocke pas de token ou d’information sensible dans localStorage lorsque des cookies sécurisés HttpOnly sont plus adaptés. 

# **Architecture du backend** 

Chaque fonctionnalité backend doit suivre cette direction de dépendances : 

# Route 

↓ 

Controller 

↓ 

Service 

↓ 

Repository 

↓ 

Base de données 

# **Route** 

La route définit : 

- le chemin HTTP ; 

- la méthode HTTP ; 

- les middlewares ; 

- l’authentification ; 

- l’autorisation ; 

- le rate limiting spécifique si nécessaire ; 

- le controller appelé. 

La route ne contient pas la logique métier. 

# **Controller** 

Le controller : 

- récupère les données HTTP ; 

- appelle la validation ; 

- appelle le service ; 

- transforme le résultat en réponse HTTP. 

Le controller ne contient pas de requête SQL et ne calcule pas directement les règles métier. 

# **Service** 

Le service contient les règles métier : 

- calculs ; 

- permissions métier ; 

- transitions de statut ; 

- orchestration de plusieurs repositories ; 

- décisions fonctionnelles ; 

- appels à des services externes à travers des interfaces adaptées. 

Le service ne dépend pas directement des détails HTTP. 

# **Repository** 

Le repository : 

- lit et écrit les données ; 

- contient les requêtes vers la base ; 

- transforme les résultats techniques en objets exploitables par le domaine. 

Il ne prend aucune décision métier importante. 

# **Schema** 

Le schema valide toute donnée provenant : 

- du body ; 

- des paramètres d’URL ; 

- de la query string ; 

- d’un webhook ; 

- d’une variable d’environnement ; 

- d’une API externe ; 

- d’un fichier importé. 

La validation doit avoir lieu à la frontière du système. 

# **Règles de dépendances** 

Frontend : 

app → features → shared 

Backend : 

routes → controllers → services → repositories 

Règles obligatoires : 

- shared ne dépend jamais d’une fonctionnalité métier ; 

- un repository n’importe jamais un controller ou une route ; 

- une route ne contacte jamais directement la base de données ; 

- un composant d’interface générique ne contient pas de règle métier ; 

- les dépendances circulaires sont interdites ; 

- les imports entre fonctionnalités doivent rester limités et explicites ; 

- si plusieurs fonctionnalités partagent une véritable notion métier, extrais un contrat ou un module commun clairement nommé ; 

- n’expose pas automatiquement tous les fichiers internes d’un module. 

# **Contrats frontend/backend** 

Lorsque le projet possède un frontend et un backend, centralise les formats échangés dans un emplacement partagé tel que : 

packages/contracts/ 

Les contrats peuvent contenir : 

- schemas de validation ; 

- types de requête ; 

- types de réponse ; 

- enums partagés ; 

- événements métier ; 

- formats des erreurs publiques. 

Le frontend et le backend doivent utiliser le même contrat lorsque la stack le permet. 

Ne partage jamais avec le frontend : 

- secrets ; 

- code d’accès à la base ; 

- configuration serveur privée ; 

- logique interne sensible ; 

- informations qui ne doivent pas être exposées au navigateur. 

# **Source d’autorité** 

Le serveur est l’autorité finale pour : 

- prix ; 

- réductions ; 

- taxes ; 

- frais de livraison ; 

- permissions ; 

- rôles ; 

- disponibilité ; 

- stocks ; 

- transitions de statut ; 

- paiements ; 

- données administratives ; 

- validation définitive d’une action. 

Le frontend peut effectuer des calculs d’affichage pour améliorer l’expérience utilisateur, mais le backend doit recalculer et vérifier les valeurs importantes. 

Ne fais jamais confiance directement à une valeur envoyée par le navigateur. 

# **Base de données** 

Toute évolution de la base doit passer par une migration versionnée. 

Exemple : 

migrations/ 

├── 0001_create_users.sql 

├── 0002_create_products.sql 

├── 0003_create_orders.sql 

└── 0004_add_order_status.sql 

Règles obligatoires : 

- ne modifie pas manuellement la production sans migration correspondante ; 

- prévois les contraintes au niveau de la base lorsque cela est pertinent ; 

- utilise des transactions pour les opérations atomiques ; 

- ajoute des index justifiés par les requêtes réelles ; 

- évite les suppressions définitives lorsque l’historique métier doit être conservé ; 

- documente les migrations présentant un risque ; 

- ne mélange pas données de test et données de production ; 

- ne modifie jamais une ancienne migration déjà exécutée en production : crée une nouvelle migration. 

# **Configuration et secrets** 

Centralise et valide les variables d’environnement au démarrage. 

Le projet doit contenir un .env.example sans secret réel. 

Aucun secret ne doit apparaître dans : 

- le dépôt Git ; 

- le frontend ; 

- les logs ; 

- les messages d’erreur publics ; 

- les fichiers de test partagés ; 

- la documentation publique. 

Si une variable indispensable manque ou est invalide, l’application doit échouer clairement au démarrage plutôt que fonctionner dans un état partiellement cassé. 

Les valeurs métier configurables ne doivent pas être dispersées dans les composants. 

# **Gestion des erreurs** 

Utilise une gestion centralisée et cohérente des erreurs. 

Distingue au minimum : 

- erreur de validation ; 

- erreur d’authentification ; 

- erreur d’autorisation ; 

- ressource introuvable ; 

- conflit métier ; 

- limitation de requêtes ; 

- erreur de service externe ; 

- erreur interne. 

Le client doit recevoir une réponse contrôlée et stable. 

Les détails techniques, stack traces, secrets, requêtes SQL et informations internes ne doivent jamais être exposés publiquement en production. 

# **Sécurité** 

Applique les mesures adaptées au projet : 

- authentification sécurisée ; 

- autorisation vérifiée côté serveur ; 

- cookies HttpOnly, Secure et SameSite lorsque pertinents ; 

- protection CSRF si nécessaire ; 

- validation et normalisation des entrées ; 

- requêtes SQL paramétrées ; 

- limitation de débit ; 

- protection contre les abus ; 

- headers de sécurité ; 

- CORS limité aux origines nécessaires ; 

- CSP adaptée au frontend ; 

- contrôle des fichiers envoyés ; 

- vérification des signatures des webhooks ; 

- journalisation des actions administratives sensibles ; 

- principe du moindre privilège pour la base de données et les services externes. 

Ne désactive jamais une protection de sécurité uniquement pour contourner rapidement un problème technique. 

# **Tests** 

Prévois plusieurs niveaux de tests selon la criticité : 

# **Tests unitaires** 

Pour : 

- calculs ; 

- fonctions pures ; 

- règles métier ; 

- validation ; 

- transitions de statut ; 

- transformations de données. 

# **Tests d’intégration** 

Pour : 

- routes API ; 

- authentification ; 

- permissions ; 

- base de données ; 

- transactions ; 

- migrations ; 

- intégrations externes simulées. 

# **Tests frontend** 

Pour : 

- formulaires importants ; 

- états de chargement ; 

- erreurs ; 

- composants interactifs ; 

- accessibilité des parcours principaux. 

# **Tests E2E** 

Pour les parcours critiques complets : 

- connexion ; 

- création ou modification d’une donnée importante ; 

- commande ; 

- paiement ; 

- administration ; 

- déconnexion ; 

- gestion des erreurs critiques. 

Une correction de bug importante doit, lorsque c’est raisonnable, être accompagnée d’un test empêchant sa réapparition. 

# **Observabilité** 

Le projet doit être diagnostiquable en production. 

Prévois : 

- logs structurés ; 

- niveaux de logs cohérents ; 

- identifiant de requête ; 

- endpoint de santé ; 

- journalisation des erreurs ; 

- surveillance des services externes importants ; 

- audit log pour les opérations administratives sensibles ; 

- absence de données personnelles ou de secrets dans les logs. 

Les logs doivent décrire l’événement et son contexte utile, sans exposer les informations sensibles. 

# **Nommage** 

Les noms doivent décrire précisément leur rôle. 

Utilise une convention stable pour : 

- fichiers ; 

- dossiers ; 

- composants ; 

- fonctions ; 

- variables ; 

- routes ; 

- tables ; 

- migrations ; 

- événements. 

Évite les noms vagues : 

utils.ts 

helpers.ts misc.ts 

temp.ts test2.ts newPage.ts finalVersion.ts 

data.js 

Un fichier utilitaire doit avoir un nom précis, par exemple : 

formatCurrency.ts 

validatePhoneNumber.ts 

calculateOrderTotal.ts 

parseEnvironment.ts 

Les fichiers temporaires, prototypes abandonnés et anciennes versions doivent être supprimés du code actif. Leur historique reste disponible dans Git. 

# **Taille et responsabilité des fichiers** 

Utilise les seuils suivants comme signaux de contrôle, pas comme règles mathématiques absolues : 

- page ou route frontend : idéalement moins de 150 lignes ; 

- composant : idéalement moins de 200 lignes ; 

- controller : idéalement moins de 100 lignes ; 

- fonction : idéalement moins de 50 lignes ; 

- fichier métier : idéalement moins de 300 lignes. 

Lorsqu’un fichier dépasse sensiblement ces seuils, vérifie s’il mélange plusieurs responsabilités. 

Ne découpe cependant pas artificiellement une logique cohérente uniquement pour respecter un nombre de lignes. 

Une séparation est justifiée lorsqu’elle améliore au moins un des points suivants : 

- compréhension ; 

- testabilité ; 

- réutilisation ; 

- isolation du changement ; 

- sécurité ; 

- séparation métier ; 

- maintenance. 

# **Styles et interface** 

Utilise une stratégie cohérente avec la stack choisie. 

Règles obligatoires : 

- limiter les styles globaux ; 

- éviter un fichier CSS unique contenant toute l’application ; 

- conserver les tokens visuels dans un emplacement central ; 

- réutiliser les composants UI réellement communs ; 

- garder les styles spécifiques proches de leur fonctionnalité ; 

- éviter les valeurs visuelles arbitraires répétées ; 

- prévoir les états loading, empty, error, disabled et success ; 

- respecter le responsive design et l’accessibilité ; 

- ne pas mélanger inutilement plusieurs bibliothèques UI. 

Les composants visuels génériques restent séparés des règles métier. 

# **Performance** 

Ne pratique pas d’optimisation prématurée, mais évite les erreurs structurelles évidentes : 

- charger uniquement ce qui est nécessaire ; 

- utiliser le lazy loading pour les zones lourdes ; 

- optimiser les images ; 

- éviter les requêtes répétées ; 

- paginer les grandes listes ; 

- éviter les re-renders inutiles ; 

- ne pas envoyer au navigateur des données inutiles ; 

- surveiller la taille du bundle ; 

- mettre en cache uniquement les données adaptées ; 

- ne pas sacrifier la cohérence ou la sécurité pour un gain hypothétique. 

# **Documentation** 

Le projet doit au minimum contenir : 

# **README.md** 

Il explique : 

- le rôle réel du projet ; 

- les prérequis ; 

- l’installation ; 

- les commandes ; 

- les variables d’environnement ; 

- le lancement local ; 

- les tests ; 

- le build ; 

- le déploiement général. 

# **docs/architecture.md** 

Il explique : 

- les principaux modules ; 

- leurs responsabilités ; 

- les règles de dépendances ; 

- les flux importants ; 

- les sources d’autorité ; 

- les conventions particulières. 

# **docs/decisions/** 

Utilise des décisions d’architecture courtes pour documenter les choix importants et durables : 

- choix de la base de données ; 

- stratégie d’authentification ; 

- stockage des fichiers ; 

- intégration des paiements ; 

- découpage d’un module important. 

Ne documente pas chaque détail évident. Documente surtout les décisions qu’un futur développeur pourrait remettre en question faute de contexte. 

# **Qualité automatisée** 

Le projet doit posséder des commandes cohérentes pour vérifier sa qualité : 

npm run format:check 

npm run lint 

npm run typecheck 

npm run test 

npm run build 

Adapte les commandes au gestionnaire de paquets et à la stack réellement utilisés. 

Avant de considérer une modification comme terminée : 

1. vérifie le formatage ; 

2. exécute le linter ; 

3. exécute le contrôle TypeScript ; 

4. exécute les tests pertinents ; 

5. exécute le build de production ; 

6. vérifie qu’aucun secret ou fichier temporaire n’a été ajouté ; 

7. examine le diff final ; 

8. signale honnêtement toute vérification impossible. 

Ne prétends jamais qu’un changement fonctionne si les vérifications n’ont pas été exécutées ou si elles ont échoué. 

# **Dépendances** 

Avant d’ajouter une dépendance : 

1. vérifie si le besoin peut être couvert proprement par la stack existante ; 

2. vérifie que la dépendance est réellement utile ; 

3. évite les bibliothèques redondantes ; 

4. utilise une version compatible avec le projet ; 

5. mets à jour le lockfile ; 

6. vérifie le build et les tests ; 

7. n’ajoute pas une bibliothèque importante sans expliquer son rôle. 

Ne remplace pas une technologie déjà fonctionnelle uniquement par préférence personnelle. 

# **Git et propreté du dépôt** 

Le dépôt ne doit pas contenir : 

- secrets ; 

- .env réel ; 

- node_modules ; 

- fichiers de build inutiles ; 

- logs ; 

- fichiers temporaires ; 

- sauvegardes manuelles ; 

- anciennes copies de pages ; 

- code abandonné ; 

- assets inutilisés ; 

- données personnelles réelles ; 

- dumps de production non protégés. 

Le lockfile doit être versionné afin de rendre les installations reproductibles. 

Les modifications doivent rester concentrées sur la demande en cours. Ne modifie pas des fichiers sans rapport avec la tâche. 

# **Adaptation selon la taille du projet** 

# **Site vitrine simple** 

Utilise une structure plus légère : 

src/ 

├── app/ 

├── pages/ 

├── sections/ 

├── shared/ 

│   ├── ui/ 

│   ├── lib/ 

│   └── assets/ 

└── styles/ 

N’ajoute pas de backend, de repositories ou de packages partagés sans besoin réel. 

# **Application métier ou e-commerce** 

Utilise l’architecture modulaire complète avec : 

- fonctionnalités frontend ; 

- modules backend ; 

- contrats ; 

- validation ; 

- migrations ; 

- tests ; 

- sécurité ; 

- logs ; 

- documentation. 

# **Projet devenu très volumineux** 

Commence par renforcer les frontières du monolithe modulaire. 

N’extrais un service indépendant que si le module possède réellement : 

- un cycle de déploiement indépendant ; 

- une charge très différente ; 

- une responsabilité autonome ; 

- des contraintes techniques particulières ; 

- une frontière métier stable ; 

- un bénéfice supérieur à la complexité opérationnelle ajoutée. 

# **Méthode de travail attendue** 

Avant d’implémenter une nouvelle fonctionnalité : 

1. comprendre le besoin métier ; 

2. inspecter les fichiers existants concernés ; 

3. identifier le module propriétaire de la fonctionnalité ; 

4. déterminer les contrats et règles métier ; 

5. vérifier les impacts sur la base, la sécurité et les permissions ; 

6. définir les tests nécessaires ; 

7. proposer uniquement les nouveaux fichiers réellement utiles ; 

8. implémenter sans casser les conventions existantes ; 

9. exécuter les vérifications ; 

10. résumer clairement les modifications. 

Pour chaque nouveau fichier, il doit être possible de répondre simplement à la question : 

Quelle responsabilité unique ce fichier possède-t-il et quel module en est propriétaire ? 

Si la réponse n’est pas claire, revois le découpage. 

# **Interdictions** 

Ne fais pas les choses suivantes : 

- placer toute une fonctionnalité dans une seule page géante ; 

- mélanger HTML, accès à la base, règles métier et appels externes dans le même fichier ; 

- appeler directement la base depuis une route ; 

- faire confiance aux prix ou permissions envoyés par le frontend ; 

- dupliquer une règle métier dans plusieurs endroits ; 

- créer des dossiers vides pour donner une illusion d’architecture ; 

- utiliser shared comme emplacement par défaut ; 

- conserver plusieurs versions concurrentes du même composant ; 

- laisser du code mort ou commenté ; 

- ignorer une erreur TypeScript ou ESLint sans justification ; 

- désactiver globalement une règle de qualité pour contourner une erreur locale ; 

- avaler silencieusement les erreurs avec un catch vide ; 

- exposer des secrets ou des détails internes ; 

- modifier manuellement la base sans migration ; 

- installer plusieurs bibliothèques pour le même rôle ; 

- créer des microservices sans justification réelle ; 

- effectuer une réécriture globale non demandée ; 

- annoncer la réussite sans avoir vérifié le résultat. 

# **Critères de réussite** 

L’architecture est considérée correcte uniquement si : 

- chaque fonctionnalité possède un emplacement évident ; 

- les responsabilités sont séparées ; 

- les pages restent principalement compositionnelles ; 

- les règles métier sont centralisées ; 

- les données externes sont validées ; 

- les permissions sont vérifiées côté serveur ; 

- les prix et valeurs sensibles sont recalculés côté serveur ; 

- les dépendances respectent une direction claire ; 

- la base évolue avec des migrations ; 

- le code est testable ; 

- les erreurs sont contrôlées ; 

- les logs permettent le diagnostic ; 

- les secrets restent protégés ; 

- le projet peut être installé et construit de manière reproductible ; 

- la documentation correspond réellement au projet ; 

- une nouvelle IA ou un nouveau développeur peut comprendre rapidement où effectuer une modification. 

Considère cette architecture comme une contrainte permanente pour toutes les modifications futures du projet, sauf demande explicite contraire de l’utilisateur. 

</ARCHITECTURE_DU_PROJET> 

