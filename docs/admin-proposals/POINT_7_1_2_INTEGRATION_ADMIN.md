# 7.1–7.2 — Réception PostgreSQL/API — préparée, NON EXÉCUTÉE

Le code compose effectivement les repositories dans le point d'entrée API. Les tests hors ligne ne prouvent ni SQL/ACL/concurrence réels ni cookie TLS navigateur. Ce document définit la réception ; il n'autorise aucune migration, copie privilégiée, fixture persistante, service ou port public.

## Portes préalables et ordre

1. Rapprocher les reçus/snapshots root, objets réels et SHA ; aucune version enregistrée rejouée, aucune.pending supprimée. 0003 déjà appliquée : recette finale seulement. Finir les réceptions du chapitre6 dans leur ordre, notamment audit0008 et ACL0010 ; puis0011/0012/0013 selon dossier chapitre7 et approbations spécifiques.
2. Recevoir les contraintes0011 et0013 avec les procédures ROLLBACK existantes avant activation auth. SQL0013 exige un limiteur inutilisé ; sinon adapter une recette sûre, jamais purger. Vérifier ownership/ACL, identités NOLOGIN/sessions/verrous et reçus après chaque version.
3. Conserver l'identité runtime UID994/peer déjà reçue6.1. Reprendre le protocole de copie protégée R19 : snapshot approuvé du code compilé, dépendances et tests, SHA vérifiés, non modifiable par dental-ai. Aucun code projet exécuté comme root, postgres ou migrateur ; les tests applicatifs doivent s'exécuter sous dental-lab-runtime uniquement. Un artefact de déploiement/runtime complet reste à préparer avant cette copie ; ne pas utiliser une commande runuser vers le dépôt IA modifiable.
4. Faire approuver origine HTTPS, port loopback, durées/session et seuils limiteur, isolation du test et fixture non médicale. Aucun compte/credential/bootstrap propriétaire ne doit être créé par une route publique. La base de recette/fixture doit être autorisée et préparée selon les contraintes propriétaire0002 ; le test runtime ne possède ni DDL ni droit owner_slot. Ne pas tester les révocations sur un compte réel.
5. Établir une preuve initiale des compteurs/fixtures et un plan de fin qui conserve l'audit requis. La suppression d'audit n'est pas une opération applicative autorisée. Ne pas prétendre ROLLBACK d'un parcours HTTP dont des transactions ont été engagées : prévoir un environnement/fixture et une réception administrateur spécifiques.

## Matrice de réception réelle

| Cas | Résultat exigé | Preuve expurgée |
|---|---|---|
| Identité/privilèges runtime | même garde6.1, aucune connexion audit/admin acceptée | refus et SQLSTATE/identités publiques |
| Schéma absent ou droits manquants | démarrage auth échoue avant écoute, pool fermé | code de sortie, aucun secret |
| Connexion valide | lookup paramétré, KDF, admission puis session+limite+audit dans même commit ; 204 et cookie | compte synthétique, contraintes et corrélation HTTP/audit |
| Absence/password faux/compte suspendu/verrou/reset/clinique suspendue | même401 neutre, aucune session créée | comparaison sans request_id, compteurs |
| État/epoch changés pendant KDF | recontrôle transactionnel refuse création | orchestration de deux connexions autorisées |
| Limitation compte/réseau | toutes intentions consommées,429/Retry-After, aucun KDF après refus | plusieurs comptes synthétiques/socket fiable |
| Redémarrage/deux instances | compteurs conservés, limite partagée ; politique incompatible refuse | avant/après et absence d'éviction active |
| Capacité/expiration/erreur seconde clé | pas de dépassement/éviction active, fenêtres fixes, rollback des deux clés | contraintes et comptages synthétiques |
| Deux appareils | sessions distinctes et simultanées | aucun token imprimé |
| Rotation simultanée | une seule gagne ; parent révoqué, enfant mêmeborneabsolue | deux connexions, IDs synthétiques, compte rendu sans cookies |
| Audit/limite indisponibles | aucune session/rotation partiellement engagée ; aucun Set-Cookie | erreur contrôlée de fixture, rollback démontré |
| COMMIT incertain/perte de réponse | aucun rejeu automatique, cookieancien révoqué impose réauth si rotation engagée | état réel vérifié avant reprise |
| Logout ciblé/global | ciblé laisse autreappareil ; global epoch+sessions+audit atomiques | sessions synthétiques/epoch, aucun secret |
| Origin/header/body/query forgés |403/400, X-Forwarded-For ignoré, account_id client refusé | requêtes expurgées |
| Cookie TLS réel | __Host-, Secure, HttpOnly, Path=/, SameSite=Lax ; pas d'accès JS | navigateur avec domaine/TLS approuvés |
| Expiration et borne absolue | renouvellements n'étendent jamais la racine, sessions expirées rejetées | dates sans token |
| Arrêt/reprise/pool/ressources | fermeture serveur/pool, aucune tâche/vérou résiduel, limites VPS conservées | processus du test uniquement |
| Compte propriétaire | owner_slot actuel requis ; alertes de connexion et protections compensatoires reçues avant production |7.13/outbox, encore à développer |

Les scénarios de concurrence, injection de panne et bootstrap nécessitent un harness/fixture runtime protégé à finaliser avec l'administrateur ; ils sont des tests différés, pas des résultats passés. Les contrôles de syntaxe et ACL ne peuvent pas être remplacés par le transport pg doublé.

## Fin et statuts

Conserver rapport de chaque scénario, artefact/SHA et reçus. Ne journaliser ni password/hash/digest/cookie ni e-mail/adresse réseau réelle. Vérifier zéro processus et verrou du test, NOLOGIN des identités migratrices, reçus inchangés, absence de nouvelles opérations incertaines. Toute panne arrête le scénario concerné ; diagnostic avant reprise et aucune purge des autres projets.

Implémenté : transactions, SessionStore PostgreSQL, limiteur durable, routes et composition/configuration. Testé hors ligne : service/repos avec doubles + HTTP + vraiKDF du test composition. Appliqué : aucun schéma ou runtime activé par l'agent. Réceptionné : aucune recette réelle de ce document. Interface, alertes propriétaire, récupération/SSE et navigateur restent séparés.

## Précisions13/10/2026

AUTH_RUNTIME_ADMIN.md fournit maintenant un bundlefigé et le probePGrollback à exécuter uniquementaprès accord/provisionowner/migrationsreçues. Les préconditions refusent APIactive/policydéjàfixée ;pas de purge. Les scénariosCOMMIT/courses/pannesHTTP restent à finaliser. AUTH_HTTPS_RECIPE.md et playwright.https.config.mjs fournissent la recetteHTTPS opt-in ;NON exécutée. FIRST_LOGIN_RECEPTION.md regroupeSHA/commandes/dependances, FIRST_OWNER_PROVISIONING.md distingue les conditionsdubootstrap et l'outilprivéencoreàécrire.
