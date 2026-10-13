# Authentification et sessions — intégration 7.1–7.2

Le point d'entrée API compose désormais les services, repositories PostgreSQL et routes ci-dessous quand `DENTAL_LAB_AUTH_ENABLED=true`. Aucune installation de service ni activation sur le VPS n'a été effectuée. Sans activation explicite, le serveur conserve sa liveness et les routes auth sont absentes. La présence des objets et droits de lecture requis est contrôlée avant l'écoute ; un échec ferme le pool et arrête le démarrage, sans migration automatique.

## Contrats HTTP

Toutes les réponses portent Cache-Control:no-store et un identifiant de requête serveur. Titres d'erreur en albanais, codes Problem existants. Aucun hash, epoch, digest ou jeton de session dans le JSON, l'URL ou les logs. Le jeton n'est envoyé que dans Set-Cookie ; le navigateur le retourne dans Cookie.

| Méthode / chemin | Corps | Succès | Refus |
|---|---|---|---|
| POST /api/v1/auth/login | LoginRequest strict : email, password | 204 et cookie après commit | 400 corps, 403 origine, 401 neutre, 429 + Retry-After |
| GET /api/v1/auth/session | Aucun, aucun paramètre query | 200 SessionIdentity : account_id UUID, profile | 401 session absente/invalide ; 400 query |
| POST /api/v1/auth/renew | JSON {} strict | 204 ; nouveau cookie seulement si rotation due | 401 session invalide/course perdue |
| POST /api/v1/auth/logout | JSON {} strict | 204 et cookie supprimé ; idempotent si session absente | 400/403 ; échec DB ne prétend pas révoquer |
| POST /api/v1/auth/logout-all | JSON {} strict | 204 après epoch/révocations/audit et cookie supprimé | 401 session absente ; aucun account_id accepté du client |

Chaque mutation exige Content-Type:application/json et Origin exactement égal à l'origine HTTPS configurée, sans slash final ni identifiants. SameSite=Lax ne remplace pas ce contrôle. Le serveur reste sur 127.0.0.1 ; trust proxy=false, clé réseau tirée du socket, X-Forwarded-For ignoré. Un reverse proxy non configuré agrège les visiteurs sous son adresse : risque de limitation collective, aucun assouplissement par un header client. La topologie/proxy de production est à recevoir.

## Persistance et transactions

Le client vérifie identité runtime/PG17 et absence de privilèges administratifs à chaque checkout. Une transaction utilise une seule connexion, expire après 10s, exige des requêtes attendues séquentiellement, rollback sur échec ; une connexion occupée ou un COMMIT incertain est détruit, sans rejeu automatique. Aucun KDF ni appel réseau dans la transaction.

SessionStore utilise accounts/sessions/session_limits/audit_events existants et préparés. L'ordre est compte FOR UPDATE, éventuelle clinique FOR SHARE, session ; tous les futurs adaptateurs de sécurité doivent respecter cet ordre. Après le KDF, état/profil/epoch/clinique/owner_slot sont relus. Création session+limite+audit et rotation révocation-parent+enfant+limite+audit sont atomiques. Le renouvellement hérite exactement la borne absolue du parent ; une seule révocation conditionnelle du parent peut réussir. Si une étape échoue, aucun cookie n'est émis. La preuve de concurrence SQL réelle reste à recevoir.

La révocation ciblée exige account_id ET session_id. La révocation globale verrouille le compte, incrémente auth_epoch et revision, révoque les sessions et écrit l'audit. Le contexte account_id vient de la session revalidée, jamais du corps. Les opérations sensibles des autres modules restent à recontrôler dans leurs propres transactions. L'audit de session reprend le request_id serveur par contexte asynchrone ; hors HTTP, un identifiant aléatoire est généré. Aucun secret de session n'est stocké dans l'audit.

## Limitation durable

0013 prépare login_limit_guard et login_attempt_limits. L'admission précède lookup/KDF, compte et socket réseau ont des clés SHA-256 avec domaines distincts. Ce sont des pseudonymes techniques, pas une anonymisation garantie. Le verrou de ligne singleton sérialise admission/expiration/capacité entre instances ; horloge PostgreSQL, deux compteurs dans le même commit, capacité bornée, aucune éviction active ni prolongation de fenêtre lors d'un refus. Un redémarrage d'API conserve les compteurs. Le nettoyage ne concerne que les entrées expirées de cette table dédiée.

L'empreinte de politique est fixée au premier commit d'admission. Une configuration différente sur une autre instance/redémarrage échoue fermée. Une modification ultérieure de politique doit être préparée et approuvée avec son traitement des compteurs ; ne pas remettre l'empreinte à NULL pour contourner un refus. Bornes techniques H713-01 : fenêtre 1s–24h, tentatives 1–1million, capacité 2–100000clés. Ce ne sont pas les valeurs de production.

## Configuration et blocages effectifs

.env.example contient uniquement des paramètres publics. Activation exige origine HTTPS, durée de session/borne absolue et quatre paramètres limiteur explicites. Aucun seuil de production ou domaine/port n'est inventé. Connexion peer sous dental-lab-runtime exclusivement ; dental-ai conserve son accès d'audit. Ne pas lancer l'API avec auth active sous dental-ai.

Prérequis de fonctionnement : schéma identité0002 déjà reçu, audit0008, droits0010, limites0011 et limiteur0013 appliqués ET reçus. Le dossier chapitre6 conserve son ordre ; 0012 concerne la revue clinique, pas la connexion directement. Le registre privé reste l'autorité. Les objets manquants bloquent réellement le démarrage auth. Il faut ensuite un compte/credential provisionné par un parcours approuvé, une configuration runtime, le raccordement TLS/API et la recette utilisateur. Le bootstrap propriétaire n'est pas exposé ni réalisé par cette intégration.

Les tests HTTP ouvrent exclusivement leurs propres ports0 loopback et ferment serveur/pool. Les tests du runtime utilisent les vrais services/KDF/repositories mais doublent explicitement le transport pg ; ils ne valident pas syntaxe SQL, ACL, contraintes différées, courses PostgreSQL ou cookie navigateur HTTPS. Les alertes de connexion propriétaire/outbox, récupération, SSE, interface et recette navigateur sont encore des dépendances distinctes ; aucune readiness de production globale annoncée.

Prochaine recette : [POINT_7_1_2_INTEGRATION_ADMIN](admin-proposals/POINT_7_1_2_INTEGRATION_ADMIN.md). Migration limiteur : [POINT_7_1_LIMITER_ADMIN](admin-proposals/POINT_7_1_LIMITER_ADMIN.md).

## Interface raccordée —13/10/2026

App réutilise le shell/Card/Button existants et affiche AuthenticationPanel en albanais. Au chargement, GET session restaure uniquement une identité validée ;401 ouvre le formulaire, erreur/404/contrat invalide montrent l'indisponibilité et une action de relecture. Email/password sont envoyés exclusivement dans le corps POST JSON relatif same-origin ; le mot de passe est retiré de l'état du formulaire dès soumission. Aucun stockage local/sessionStorage/IndexedDB, header token, URL ou log d'authentification ajouté ; le coffreR15 reste distinct.

Un login ne devient visible comme succès qu'après lecture serveur de la session. Le client traite refus/429/Origin/panne avec textes albanais fixes, ne rend jamais un corps d'erreur distant. Requests credentialssame-origin/no-store/redirecterror, délais8s couvrant headers ET décodage du corps. Cookies uniquement gérés par le navigateur. Un résultat de login incertain passe en indisponibilité : relecture de session avant nouvelle soumission, aucun rejeu automatique de login/logout. Les actions sont sérialisées pour éviter chevauchement de rotation/déconnexion dans cet onglet. Les courses inter-onglets restent soumises au garde serveur et à la recette navigateur.

État connecté : contrôle de connexion, déconnexion de cet appareil ou de tous les appareils. À focus/visibilité et toutes30s tant que la page est visible et le navigateur online (hypothèse technique réversible H712-UI01), GET courant précède renouvellement puis relecture ; pas de nouvelle tentative de mutation sur un état non confirmé. La borne absolue du serveur n'est pas prolongée. Les changements de compte/permissions/droits continuent d'être validés par l'API : un profil dans le navigateur n'est jamais une permission. Les fonctions métier ultérieures ne sont pas ouvertes par ce shell.

Client et transport web→vraiesroutes HTTP testés sousNode, avec cookiejar synthétique et ports0, sessions doublées ; build/typecheck/lint/frontières réussis. Rendu, interactions React, tactile/accessibilité, vraiHTTPS/cookies, inter-onglets, réseau navigateur et PWA restent NON réceptionnés conformémentR17. Aucun service ou domaine activé pour tester.

## Complément13/10/2026 — prérequis et recette protégée

Le démarrage exige maintenant ACL SELECT/INSERT/UPDATEcolonnes/DELETElimiteur via auth-readiness, pas seulement lecture des tables. Loginowner prépare outbox/notice/livraisonpending atomiquement ;worker non livré. Prérequis/revue groupée :[FIRST_LOGIN_RECEPTION](admin-proposals/FIRST_LOGIN_RECEPTION.md), bundle/empreintes/commandes :[AUTH_RUNTIME_ADMIN](admin-proposals/AUTH_RUNTIME_ADMIN.md), entrée privée du premiercompte :[FIRST_OWNER_PROVISIONING](FIRST_OWNER_PROVISIONING.md), recette :[AUTH_HTTPS_RECIPE](AUTH_HTTPS_RECIPE.md).

Probe réel prêt à approuver, non exécuté :sousruntime994/APIarrêtée/ownerpréexistant/limiteurinutilisé, fixturesemployees et tousleursobjets annulés. Ne valide pasdurabilitéCOMMIT ni course réelle. L'outilprivé debootstrap et harnesscommit/concurrence restent à développer ;administrateur pasencoreseul dernierobstacle.
