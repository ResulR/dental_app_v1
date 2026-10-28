# ROADMAP — Plateforme privée de gestion d’un laboratoire dentaire

**Version :** 1.0 — 09/10/2026  
**Statut :** plan de développement exhaustif à exécuter et vérifier — pas une preuve d’implémentation  
**Documents sources :** `CAHIER_DES_CHARGES.md` (vérité métier), `ARCHITECTURE_ADAPTEE.md` (règles de structure ; décisions à compléter), modèle de présentation `ROADMAP.docx` de Flo’s Bikes (structure uniquement).  
**Périmètre :** laboratoire et cliniques au Kosovo, application privée en albanais, PWA tablette-first.  
**Environnement connu :** Debian 13, PostgreSQL 17, `/srv/dental-lab`, utilisateur Linux `dental-ai`, base `dental_lab`, rôles `dental_lab_owner`, `dental_lab_audit`, `dental_lab_migrator`, `dental_lab_app`. Les droits existants sont à **réauditer**, pas à recréer ; stack et domaine applicatifs non choisis.

> Cette roadmap n'ajoute pas de fonction métier non validée. Les sujets juridiques et techniques encore ouverts sont des **portes de validation** : l'IA doit les instruire, pas inventer leur résolution. Elle ne doit jamais considérer « tous les points cochés » comme équivalent à un site exploitable si les tests terrain ou obligations avant production échouent.

## Réception PostgreSQL v3 — 14/10/2026

Phases A/B v3 réussies selon les preuves administrateur communiquées ; hashes du dépôt et de l'archive, Git et unités arrêtées contrôlés directement. Voir [réception détaillée](docs/POSTGRES_V3_RECEPTION_2026-10-14.md). Bootstrap et travaux liés éprouvés sur PostgreSQL réel dans les scénarios du bundle v3 ; aucune application de production ni validation globale des chapitres 6/7 déduite. Les suivis antérieurs ci-dessous sont historiques.

## Suivi réception bootstrap — 13/10/2026

Proposition uniquement : alternative sans deuxième VPS préparée dans `docs/admin-proposals/SHARED_VPS_POSTGRES_RECEPTION.md`. Audit en lecture seule au commit164ab82 ; enveloppe systemd/compte dédié/disque plafonné préparés, syntaxe contrôlée. Aucune instance, aucun compte Linux, montage, service ou objet SQL créé. Phase A (preuve d’isolation sans PostgreSQL) exige accord administrateur ; Phase B (recette réelle) exige preuves A et accord distinct. Interdiction originale hors-VPS conservée, aucune garde du harness supprimée. Recettes PG/bootstrap/HTTPS et production toujours différées. Prochaine action : revue et accord Phase A, sinon VM Linux locale.

## Progression et règles d'exécution

- Statuts permis : `☐ À faire`, `◐ En cours`, `☑ Validé`, `⚠ Bloqué`, `↷ Sans objet justifié`.
- **Un point = un objectif atomique vérifiable.** Plusieurs fichiers peuvent être nécessaires à un même comportement, mais une même étape ne doit pas mélanger deux besoins indépendants.
- Avant chaque point : lire le code, les décisions, les migrations et l'état effectif du VPS ; relever contradictions et dépendances ; ne pas réinitialiser des objets déjà créés.
- La roadmap est un **plan, jamais une autorisation d'exécuter** des migrations, de modifier Nginx, de redémarrer des services ou de changer les privilèges sur un VPS partagé.
- Les modifications sont strictement confinées au projet, à sa base et à ses services ; toute opération privilégiée exige un mécanisme validé et borné.
- Vérifier proportionnellement : format, lint, types, tests pertinents, build, migration, sécurité, diff, état Git et effets externes. Ne jamais affirmer un test non fait.
- Toute étape touchant des données réelles exige une revue de confidentialité ; aucune donnée réelle de patient avant les portes légales et sécurité.
- Les catégories prix/facturation/paiement/garantie financière et portail patient sont **hors périmètre V1** ; ne pas importer Stripe, panier, SEO e-commerce ou réservations de Flo's Bikes.

**Politique de dépendances :** toutes les tâches d'un chapitre exigent les fondations pertinentes des chapitres antérieurs ; la ligne « Dépend de » indique les portes minimales, sans empêcher la parallélisation sûre d'étapes indépendantes. Les chapitres architecture/UX peuvent itérer avant le choix de stack, mais aucune initialisation ne doit supposer un framework non validé.

## Table des chapitres

- ☐ **Chapitre 01 — Cadrage, sources et contrôle du périmètre** (6 points)
- ☐ **Chapitre 02 — Sécurisation initiale du VPS et de l’accès IA** (9 points)
- ☐ **Chapitre 03 — Architecture détaillée et modélisation** (11 points)
- ☐ **Chapitre 04 — Design UX tablette-first et validation** (14 points)
- ☐ **Chapitre 05 — Initialisation du code et qualité** (9 points)
- ☐ **Chapitre 06 — Fondations PostgreSQL et migrations** (11 points)
- ☐ **Chapitre 07 — Authentification, comptes et gouvernance** (15 points)
- ☐ **Chapitre 08 — Catalogue et paramètres** (6 points)
- ☐ **Chapitre 09 — Commande clinique : saisie et dépôt** (10 points)
- ☐ **Chapitre 10 — Workflow et décisions des commandes** (15 points)
- ☐ **Chapitre 11 — Retouches et refabrications** (6 points)
- ☐ **Chapitre 12 — Fichiers privés et transferts** (13 points)
- ☐ **Chapitre 13 — Messagerie temps réel** (9 points)
- ☐ **Chapitre 14 — Notifications, e-mails et alertes** (9 points)
- ☐ **Chapitre 15 — PWA, hors ligne et brouillons** (10 points)
- ☐ **Chapitre 16 — Planning, livraisons, archives et recherche** (9 points)
- ☐ **Chapitre 17 — Administration, audit, rétention et conformité** (13 points)
- ☐ **Chapitre 18 — Sécurité, fiabilité et performances** (8 points)
- ☐ **Chapitre 19 — Infrastructure production et exploitation** (12 points)
- ☐ **Chapitre 20 — Recette de bout en bout** (12 points)
- ☐ **Chapitre 21 — Mise en production et clôture** (10 points)

## Modèle de réception d’un point

Une étape ne devient `☑ Validé` qu'avec : **(1)** l'inventaire de l'état initial, **(2)** les fichiers/objets affectés, **(3)** la preuve de tests adaptés, **(4)** le contrôle des privilèges et du non-impact sur les autres projets le cas échéant, **(5)** un diff Git/release propre si du code a été modifié, **(6)** les limitations connues documentées. Un point de conformité nécessite en outre un justificatif vérifiable de la personne compétente, pas une auto-attestation de l'IA.

---


## Chapitre 01 — Cadrage, sources et contrôle du périmètre

### 1.1 — Auditer les trois documents de référence
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Cadrage, sources et contrôle du périmètre
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** auditer les trois documents de référence.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Établir la traçabilité entre exigences métier, principes architecturaux et étapes techniques.
- **Validation :** Matrice sans exigence oubliée ni technologie présentée comme déjà décidée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 1.2 — Auditer le répertoire de développement et les dépôts existants
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Cadrage, sources et contrôle du périmètre
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** auditer le répertoire de développement et les dépôts existants.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Vérifier le contenu effectif de /srv/dental-lab, les dépôts et tout code à préserver.
- **Validation :** État initial et décision de réutilisation documentés ; aucun écrasement.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 1.3 — Valider le choix de stack par décision d’architecture
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Cadrage, sources et contrôle du périmètre
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** valider le choix de stack par décision d’architecture.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Comparer stack compatible PWA, temps réel, uploads, sécurité et déploiement ; choisir explicitement versions et outils avant initialisation.
- **Validation :** ADR validée avec critères de compatibilité et sans supposer TanStack, Express ou ORM.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 1.4 — Définir les frontières et contrats des modules métier
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Cadrage, sources et contrôle du périmètre
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** définir les frontières et contrats des modules métier.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Cartographier comptes, cliniques, commandes, travaux liés, messages, fichiers, catalogue et exploitation.
- **Validation :** Dépendances orientées ; propriétaires métiers explicites.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 1.5 — Établir une matrice des exigences vers tests et chapitres
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Cadrage, sources et contrôle du périmètre
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** établir une matrice des exigences vers tests et chapitres.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Pour chaque exigence du cahier, relever identifiant, couverture roadmap et preuve attendue.
- **Validation :** Aucun besoin obligatoire orphelin ; exclusions conservées.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 1.6 — Établir registre des risques et décisions ouvertes
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Cadrage, sources et contrôle du périmètre
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** établir registre des risques et décisions ouvertes.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Lister faisabilités PWA, réseau, capacité VPS, conformité Kosovo, continuité et sauvegardes.
- **Validation :** Responsables, conditions et jalons bloquants explicites.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 02 — Sécurisation initiale du VPS et de l’accès IA

### 2.1 — Réauditer les identités Linux et les ACL
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Sécurisation initiale du VPS et de l’accès IA
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** réauditer les identités Linux et les ACL.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Contrôler dental-ai, groupes, sudo, /srv/dental-lab et protection effective des autres projets.
- **Validation :** Aucun droit élargi ni altération des autres services.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 2.2 — Réauditer les frontières réseau et processus
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Sécurisation initiale du VPS et de l’accès IA
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** réauditer les frontières réseau et processus.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Tester ports locaux, sockets, services internes, accès interprojets et limites Linux sans privilèges.
- **Validation :** Risques de traversée identifiés et contrôles décidés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 2.3 — Définir le mode d’isolation de l’agent Remote
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Sécurisation initiale du VPS et de l’accès IA
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** définir le mode d’isolation de l’agent Remote.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Comparer utilisateur seul, sandbox système, conteneur rootless et VPS isolé ; documenter les risques résiduels.
- **Validation :** Solution explicitement approuvée pour l’accès IA ; aucun accès global par défaut.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 2.4 — Encadrer le connecteur Remote sur dental-ai
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Sécurisation initiale du VPS et de l’accès IA
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** encadrer le connecteur Remote sur dental-ai.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Configurer le connecteur pour exécuter les commandes dans l’identité dédiée et le répertoire autorisé.
- **Validation :** Test d’identité et de refus hors périmètre ; pas de credentials de debian.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 2.5 — Réauditer PostgreSQL et les rôles dental_lab existants
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Sécurisation initiale du VPS et de l’accès IA
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** réauditer PostgreSQL et les rôles dental_lab existants.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Vérifier réellement la base dental_lab, NOLOGIN, audit, migrator et pg_hba ; ne pas recréer les objets existants.
- **Validation :** Inventaire des privilèges et test de refus sur les autres bases.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 2.6 — Mettre en place une exécution de migrations strictement scoped
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Sécurisation initiale du VPS et de l’accès IA
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** mettre en place une exécution de migrations strictement scoped.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Définir identité de migration distincte, autorisation contrôlée et revue des migrations risquées ; ne jamais exécuter SQL arbitraire en superuser.
- **Validation :** Migrations uniquement sur dental_lab, sauvegarde/rollback selon risque.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 2.7 — Préparer les secrets et l’environnement du projet
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Sécurisation initiale du VPS et de l’accès IA
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** préparer les secrets et l’environnement du projet.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Isoler configuration, secrets et compte runtime, sans lecture des .env des autres applications.
- **Validation :** Fichiers de secrets privés, absent de Git/logs et non accessibles à l’agent hors besoin.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 2.8 — Concevoir les privilèges ciblés des services applicatifs
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Sécurisation initiale du VPS et de l’accès IA
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** concevoir les privilèges ciblés des services applicatifs.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Définir seulement les unités propres au labo et des wrappers root-owned non modifiables par l’IA si indispensables.
- **Validation :** Aucun sudo générique, aucun systemctl * et aucune exécution root de code éditable.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 2.9 — Valider les garde-fous infrastructure
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Sécurisation initiale du VPS et de l’accès IA
- **Dépend de :** État préalable à vérifier ; obligations et accès autorisés
- **But :** valider les garde-fous infrastructure.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Prouver les refus d’accès aux projets, bases, services et secrets voisins, et relever les limites réseau.
- **Validation :** Rapport de tests reproductible ; accès Remote activable seulement après validation.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 03 — Architecture détaillée et modélisation

### 3.1 — Établir l’architecture applicative détaillée
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Architecture détaillée et modélisation
- **Dépend de :** Fondations pertinentes des chapitres 01–02 et tâches préalables de ce chapitre
- **But :** établir l’architecture applicative détaillée.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Décliner le monolithe modulaire générique en modules propres au laboratoire avec choix de stack validé.
- **Validation :** docs/architecture.md et ADR cohérents.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 3.2 — Concevoir le modèle de données comptes et cliniques
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Architecture détaillée et modélisation
- **Dépend de :** Fondations pertinentes des chapitres 01–02 et tâches préalables de ce chapitre
- **But :** concevoir le modèle de données comptes et cliniques.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Schématiser propriétaire unique, administrateurs, employés, compte partagé de clinique, invitations et états.
- **Validation :** Clés, unicités, historique et associations explicités.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 3.3 — Concevoir le modèle des droits granulaires
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Architecture détaillée et modélisation
- **Dépend de :** Fondations pertinentes des chapitres 01–02 et tâches préalables de ce chapitre
- **But :** concevoir le modèle des droits granulaires.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Distinguer accès logistique/détaillé, fichiers lecture/téléchargement, messages lecture/réponse et actions.
- **Validation :** Matrice de dépendances et contrôle serveur définis.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 3.4 — Concevoir le modèle de commande et versions
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Architecture détaillée et modélisation
- **Dépend de :** Fondations pertinentes des chapitres 01–02 et tâches préalables de ce chapitre
- **But :** concevoir le modèle de commande et versions.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Modéliser dentition FDI, snapshot des référentiels, dates, fichiers, versions et verrouillage.
- **Validation :** Statuts et versions sans perte d’historique.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 3.5 — Formaliser les automates de statuts et demandes
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Architecture détaillée et modélisation
- **Dépend de :** Fondations pertinentes des chapitres 01–02 et tâches préalables de ce chapitre
- **But :** formaliser les automates de statuts et demandes.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Définir transitions, annulations, corrections, demandes pendantes et invariants.
- **Validation :** Table de transitions exhaustive et scénarios concurrents documentés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 3.6 — Concevoir les commandes liées et retouches
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Architecture détaillée et modélisation
- **Dépend de :** Fondations pertinentes des chapitres 01–02 et tâches préalables de ce chapitre
- **But :** concevoir les commandes liées et retouches.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Modéliser remplacement, travail supplémentaire, retouche liée au travail livré et unicité d’intervention active.
- **Validation :** Liens cohérents, règles d’identité et anti-doublon.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 3.7 — Concevoir les fichiers, leurs ACL et leur cycle de vie
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Architecture détaillée et modélisation
- **Dépend de :** Fondations pertinentes des chapitres 01–02 et tâches préalables de ce chapitre
- **But :** concevoir les fichiers, leurs ACL et leur cycle de vie.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Séparer originaux de fabrication, suivi interne/partagé, messages et fragments temporaires.
- **Validation :** Modèle de référence et politique de visibilité documentés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 3.8 — Concevoir brouillons local/serveur et synchronisation
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Architecture détaillée et modélisation
- **Dépend de :** Fondations pertinentes des chapitres 01–02 et tâches préalables de ce chapitre
- **But :** concevoir brouillons local/serveur et synchronisation.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Définir versionnement, conflits, cryptographie locale, pièces jointes, soumission explicite.
- **Validation :** Machine d’état de synchronisation et comportements de panne spécifiés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 3.9 — Concevoir les événements, notifications et audit
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Architecture détaillée et modélisation
- **Dépend de :** Fondations pertinentes des chapitres 01–02 et tâches préalables de ce chapitre
- **But :** concevoir les événements, notifications et audit.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Événements métier, destinataires, e-mails asynchrones, message lu, alertes et audit immuable applicativement.
- **Validation :** Matrice événements / canaux / visibilité / retries.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 3.10 — Concevoir rétention, sauvegardes et reprise
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Architecture détaillée et modélisation
- **Dépend de :** Fondations pertinentes des chapitres 01–02 et tâches préalables de ce chapitre
- **But :** concevoir rétention, sauvegardes et reprise.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Cartographier suppression, archives J+30, backups 30 jours, RPO 1h/RTO 4h sous réserve de tests.
- **Validation :** Plan de rétention et cohérence DB-fichiers.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 3.11 — Concevoir contrat API et erreurs métier
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Audit / décision
- **Zone concernée :** Architecture détaillée et modélisation
- **Dépend de :** Fondations pertinentes des chapitres 01–02 et tâches préalables de ce chapitre
- **But :** concevoir contrat API et erreurs métier.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Définir schémas, versionnage, pagination, rate limiting, idempotence et erreurs stables.
- **Validation :** Contrats réutilisés entre clients et serveur.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 04 — Design UX tablette-first et validation

### 4.1 — Définir direction visuelle en albanais
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** définir direction visuelle en albanais.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Concevoir une interface privée de laboratoire épurée, lisible et accessible, sans tableau de bord chargé.
- **Validation :** Tokens, typographie et parcours prioritaires approuvés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.2 — Dessiner navigation et accès par rôle
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** dessiner navigation et accès par rôle.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Portails labo/clinique, authentification, menu et permissions visibles.
- **Validation :** Navigation responsive sans fuite de zones interdites.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.3 — Concevoir inscription, approbation et récupération
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** concevoir inscription, approbation et récupération.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Écrans et états de formulaire, invitation et sécurité de compte.
- **Validation :** Parcours validables sur téléphone et tablette.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.4 — Concevoir schéma dentaire tactile FDI
- **Statut :** ◐ Conception préparée — recette navigateur reportée
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** concevoir schéma dentaire tactile FDI.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** 32 dents, 3 états au toucher, résumé accessible et sans sélection obligatoire.
- **Validation :** Test tactile + clavier/lecteur si applicable.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.5 — Concevoir formulaire de commande complet
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** concevoir formulaire de commande complet.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Patient nom/prénom ou référence, matériau, teinte, dates, pièces jointes et avertissements.
- **Validation :** Formulaire cohérent sur petit écran, sans exigences ajoutées.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.6 — Concevoir listes et détail des travaux
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** concevoir listes et détail des travaux.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Boîte de réception prioritaire, listes filtrées, détail, versions et actions d’état.
- **Validation :** Travail identifiable et traitable en peu d’actions.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.7 — Concevoir modifications, annulations et corrections
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** concevoir modifications, annulations et corrections.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Avant/après, demande en attente, retrait, motifs et confirmation.
- **Validation :** Actions et statuts non ambigus.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.8 — Concevoir retouches et chaînes de travaux
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** concevoir retouches et chaînes de travaux.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Retouche simplifiée, commande liée, remplacement, historique lisible.
- **Validation :** Travail réellement livré identifié sans confusion.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.9 — Concevoir messagerie temps réel
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** concevoir messagerie temps réel.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Conversation générale versus commande, unread, pièces jointes, Lu et clôture.
- **Validation :** Parcours complet sans croisement des conversations.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.10 — Concevoir calendrier et livraison groupée
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** concevoir calendrier et livraison groupée.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Semaine/mois, drag-drop desktop, détail mobile, Prêts à livrer, confirmation en lot.
- **Validation :** Dates distinctes et manipulation mobile claire.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.11 — Concevoir fichiers et progression des transferts
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** concevoir fichiers et progression des transferts.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Ajout/retrait, aperçu autorisé, zip, erreurs, reprise et saturation.
- **Validation :** États progressifs et taille affichée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.12 — Concevoir brouillons PWA hors ligne
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** concevoir brouillons PWA hors ligne.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** État offline, déverrouillage, stockage limité, conflit, reprise et confirmation avant envoi.
- **Validation :** Scénarios offline complets visibles et compréhensibles.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.13 — Concevoir outils propriétaire et exceptions
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** concevoir outils propriétaire et exceptions.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Permissions, comptes, catalogue interdit, audit, mails échoués, stockage, maintenance et archives.
- **Validation :** Fonctions sensibles accessibles mais non envahissantes.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 4.14 — Auditer et valider design et accessibilité
- **Statut :** ◐ Conception préparée — recette navigateur reportée
- **Priorité :** Haute
- **Catégorie / type :** Design
- **Zone concernée :** Design UX tablette-first et validation
- **Dépend de :** Fondations pertinentes des chapitres 01–03 et tâches préalables de ce chapitre
- **But :** auditer et valider design et accessibilité.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Tester responsive, albanais, textes longs, loading, erreurs, empty, modal, focus et contrastes.
- **Validation :** Maquettes et règles visuelles acceptées avant câblage.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 05 — Initialisation du code et qualité

### 5.1 — Initialiser le dépôt Git dans le périmètre
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Initialisation du code et qualité
- **Dépend de :** Fondations pertinentes des chapitres 01–04 et tâches préalables de ce chapitre
- **But :** initialiser le dépôt Git dans le périmètre.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Vérifier le dépôt existant, initialiser seulement si absent, configurer remote validé.
- **Validation :** État Git propre et reproductible.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 5.2 — Créer les garde-fous de versionnement
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Initialisation du code et qualité
- **Dépend de :** Fondations pertinentes des chapitres 01–04 et tâches préalables de ce chapitre
- **But :** créer les garde-fous de versionnement.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Configurer .gitignore, env.example, fichiers sensibles et scripts interdits.
- **Validation :** Aucun secret ni upload dans l’index Git.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 5.3 — Initialiser le monorepo ou structure retenue
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Initialisation du code et qualité
- **Dépend de :** Fondations pertinentes des chapitres 01–04 et tâches préalables de ce chapitre
- **But :** initialiser le monorepo ou structure retenue.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Mettre en place web/API/contracts selon ADR sans dossiers vides inutiles.
- **Validation :** Installation reproductible et scripts stables.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 5.4 — Configurer TypeScript et conventions
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Initialisation du code et qualité
- **Dépend de :** Fondations pertinentes des chapitres 01–04 et tâches préalables de ce chapitre
- **But :** configurer TypeScript et conventions.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Configurer typecheck strict, formatage, lint, boundaries et règles d’import.
- **Validation :** Commandes de contrôle fonctionnelles.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 5.5 — Configurer tests unitaires/intégration/e2e
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Initialisation du code et qualité
- **Dépend de :** Fondations pertinentes des chapitres 01–04 et tâches préalables de ce chapitre
- **But :** configurer tests unitaires/intégration/e2e.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Outils retenus via ADR, bases et fixtures isolées, commandes reproductibles.
- **Validation :** Exemple de chaque type de test passe.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 5.6 — Initialiser frontend et design system
- **Statut :** ◐ En cours
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Initialisation du code et qualité
- **Dépend de :** Fondations pertinentes des chapitres 01–04 et tâches préalables de ce chapitre
- **But :** initialiser frontend et design system.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Créer shell PWA web conforme aux maquettes sans logique métier.
- **Validation :** Build fonctionnel et responsive.
- **Dépendance ouverte R17 :** build et contrôles code réussis ; recette responsive/installation/offline/interactions navigateur reportée, point non clôturé. Suite serveur indépendante autorisée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 5.7 — Initialiser serveur API et santé
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Initialisation du code et qualité
- **Dépend de :** Fondations pertinentes des chapitres 01–04 et tâches préalables de ce chapitre
- **But :** initialiser serveur API et santé.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Démarrage contrôlé, validation config, /health, erreurs stables.
- **Validation :** Service local et tests santé OK.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 5.8 — Configurer logging sûr et correlation IDs
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Initialisation du code et qualité
- **Dépend de :** Fondations pertinentes des chapitres 01–04 et tâches préalables de ce chapitre
- **But :** configurer logging sûr et correlation IDs.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Journal structuré, pas de données de santé ni secrets, journal audit distinct.
- **Validation :** Exemple d’erreur corrélée et expurgée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 5.9 — Configurer contrats et schémas partagés
- **Statut :** ☑ Validé
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Initialisation du code et qualité
- **Dépend de :** Fondations pertinentes des chapitres 01–04 et tâches préalables de ce chapitre
- **But :** configurer contrats et schémas partagés.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Formats requêtes/réponses validés aux frontières et synchronisés.
- **Validation :** Détection automatique de rupture contrat.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 06 — Fondations PostgreSQL et migrations

### 6.1 — Mettre en place client PostgreSQL de l’application
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fondations PostgreSQL et migrations
- **Dépend de :** Fondations pertinentes des chapitres 01–05 et tâches préalables de ce chapitre
- **But :** mettre en place client PostgreSQL de l’application.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Connexion avec rôle dédié à droits minimaux, pool et timeout.
- **Validation :** Aucune permission externe à dental_lab.
- **Réception R19 validée11/10/2026 :** rapport administrateur B1–B5 reçu : vrai clientNode passed/code0, quatre refusSQL42501, quatre refusauth, HBA dédié sans erreur/rechargé, copie protégée. Audit direct UID994/runtimeLOGIN/limite2/membreappuniquement/nonadmin ; CONNECT/USAGE true, CREATE/TEMP/CREATEschéma false ; tableprobeabsente, session0, migrateurNOLOGIN ; copieclient inaccessibleaudit. Client pool/timeouts/tests de44dcb45. Aucune modification privilégiée ni migration IA. Réseau/processus/IPC/ressources partagés : aucune isolationcomplète/production revendiquée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 6.2 — Mettre en place moteur de migrations versionnées
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fondations PostgreSQL et migrations
- **Dépend de :** Fondations pertinentes des chapitres 01–05 et tâches préalables de ce chapitre
- **But :** mettre en place moteur de migrations versionnées.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Historique de migration, verrous, transactions et stratégie de reprise.
- **Validation :** Migration/rejeu testés sur base isolée.
- **Audit/préparation11/10/2026 :** moteur installé2.6 rev3 conservé/SHA confirmé ; historique root, flock/advisoryxactlock, transactionpsql et reprisepending déjà présents. Catalogue source privé/pinsfixtures,11tests6.2 et18tests2.6 horsligne réussis ; anciennesfixtures non rejouées. Nouvelle sondeSELECT0001/SHA et réceptionrejeu/concurrence proposées dans docs/admin-proposals/POINT_6_2_ADMIN.md. Réceptionréelle complémentaire après approbation SQL/SHA requise ;6.2 nonvalidé et aucun6.3. Baseprojet dental_lab dédiée/zérotablesapp, pas d’isolationcomplète du cluster.
- **Reprise 2026-10-11T06:00:28+00:00 :** préparation autonome revérifiée ; catalogue et29 tests hors ligne réussis, pic49/100 tâches. Audit dental_lab seul : PostgreSQL17.11, migrateur NOLOGIN, sessions0, tables applicatives0. Procédure administrateur finalisée (arrêt sur erreur, vérification SHA bloquante, environnement SQL explicite) ; lanceur/SQL/fixtures inchangés. Refus de rejeu/concurrence sur installation réelle toujours non démontrés ; approbation et réception administrateur requises, aucun6.3.
- **Réception 2026-10-11T18:48:40+00:00 :** rapport administrateur explicitement VALIDÉ : premier passage0001/SHA approuvé, identités/verrou transactionnel conformes ; rejeu et concurrence refusés/reçu inchangé ; snapshot/reçu contrôlés, aucunpending ; NOLOGIN/sessions0/locks0/tables0 et lanceurSHA inchangé. Corroboration IA readonly dental_lab : PostgreSQL17.11, NOLOGIN/sessions0/locks0/aucune tableapp ; fichiersSHA exacts. Aucun rejeu IA. Base dédiée dans cluster partagé, limites résiduelles conservées.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 6.3 — Créer schéma identité/clinique/permissions
- **Statut :** ☑ Validé
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fondations PostgreSQL et migrations
- **Dépend de :** Fondations pertinentes des chapitres 01–05 et tâches préalables de ce chapitre
- **But :** créer schéma identité/clinique/permissions.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Tables et contraintes pour comptes, cliniques, invitations, grants et sessions.
- **Validation :** Contraintes et migration aller vérifiées.
- **Préparation 2026-10-11T21:00:17+02:00 :** audit base vide/default ACL migrateur-owner absents, modèles3.2/3.3 relus. Migration0002 préparée : neuf tables/une vue, propriétaire/clinique réciproques différés, invitations/sessions et grants avec prérequis ; aucune permission SQL ajoutée. Trois tests graphe +11moteur +18régressions réussis, catalogue/filtre rev3 OK. Recette PostgreSQL23refus/cas positifs NON exécutée ; SQL/SHA et commandes/risques dans docs/admin-proposals/POINT_6_3_ADMIN.md, approbation/réception administrateur indispensable pour migration aller/contraintes. Aucun6.4.
- **Réception 2026-10-11T23:04:24+02:00 :** administrateur confirme0002/SHA approuvé exécuté une fois,9tables/1vue ownershipmigrateur,74contraintes validées,29permissions,23refus/cas positifs etROLLBACK/zérofixture, reçu/snapshot conformes/pendingabsent. Audit IA readonly confirme objets/ownership/74contraintes, SELECTapp/auditfalse, NOLOGIN/sessions0/locks0 etSHA fichiers ; aucune lecture de données applicatives ni rejeu.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 6.4 — Créer schéma catalogue et snapshots
- **Statut :** ◐ Implémenté et testé hors ligne — migration appliquée, réception finale en attente
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fondations PostgreSQL et migrations
- **Dépend de :** Fondations pertinentes des chapitres 01–05 et tâches préalables de ce chapitre
- **But :** créer schéma catalogue et snapshots.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Matériaux, teintes, types, états interdits et snapshots historiques.
- **Validation :** Suppression catalogue préserve historique.
- **Préparation 2026-10-11T23:13:27+02:00 :** 3 tables et 1 vue proposées dans 0003_catalog_snapshots.sql ; identités durables, entrées courantes supprimables et snapshots historiques séparés. SHA-256 9118fd82740fb914b69fd79946bebca1ca0c1b32b679709b48217edec7df7c5c. Recette catalog_constraints.sql : 15 refus et cas positifs renommage/suppression/interdiction, NON exécutée ; SHA-256 875b13445535ef8d188659953fe27541f4dd8bff4cd6a4c5c49549ec7ab316d2. Catalogue/filtre et 32 tests hors ligne réussis ; procédure exacte dans docs/admin-proposals/POINT_6_4_ADMIN.md. Aucun DDL, privilège ou service modifié par IA. Validation PostgreSQL réelle indispensable avant clôture ; point 6.5 non commencé.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation :** terminée, commit 84129e2.
- **Validation hors ligne :** 32 tests réussis.
- **Application PostgreSQL :** administrateur confirme 0003/SHA approuvé exécutée avec succès une fois ; audit IA confirme 3 tables/1 vue nouvelles, ownership migrateur et 93 contraintes validées au total.
- **Réception finale :** EN ATTENTE : 15 refus SQL, préservation historique, ROLLBACK, audit final et reçu/snapshot. Aucun rejeu ; progression indépendante vers 6.5 autorisée par stratégie du 12/10/2026.

### 6.5 — Créer schéma commande, dents et versions
- **Statut :** ◐ Implémenté — validation hors ligne réussie, réception PostgreSQL différée
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fondations PostgreSQL et migrations
- **Dépend de :** Fondations pertinentes des chapitres 01–05 et tâches préalables de ce chapitre
- **But :** créer schéma commande, dents et versions.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Commandes, dents FDI, snapshots, événements, dates et historique immuable logique.
- **Validation :** Contraintes des champs et relations démontrées.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation :** migration0004, 8tables/index/FK, versions/dents/snapshots/événements/logistique/idempotence préparés.
- **Validation hors ligne :** filtre exact/catalogue réussi ;17tests unitaires de non-régression passés,32tests moteur/gate précédemment passés ; syntaxe Bash/Python administrative et diff contrôlés.
- **Application PostgreSQL :** NON APPLIQUÉE, SHA et proposition POINT_6_5_ADMIN.md à approuver au jalon.
- **Réception finale :** 15refus SQL et cas positifs/ROLLBACK/audit/immutabilité logique future à réceptionner ; aucun résultat SQL revendiqué. Progression6.6 indépendante autorisée.

### 6.6 — Créer schéma des demandes et travaux liés
- **Statut :** ◐ Implémenté — validation hors ligne réussie, réception PostgreSQL différée
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fondations PostgreSQL et migrations
- **Dépend de :** Fondations pertinentes des chapitres 01–05 et tâches préalables de ce chapitre
- **But :** créer schéma des demandes et travaux liés.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Modifications, annulations, corrections, retouches, liens et états.
- **Validation :** Une seule demande pendante et retouche active garanties sous concurrence.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation :**0005, demandes pending communes et liens ; retouche active index unique sur état enfant maintenu par FK CASCADE, vue slots. H66-01 technique documentée sans changement R14.
- **Validation hors ligne :** catalogue/filtrerev3 et syntaxe Bash/Python de proposition réussis ; non-régressions17unitaires/32migrations déjà passées.
- **Application PostgreSQL :** NON APPLIQUÉE ; SQL/SHA/recette dans POINT_6_6_ADMIN.md, à approuver au jalon.
- **Réception finale :**11refus/positifs/ROLLBACK et course réelle deuxsessions/atomicité R14 différés ; pas de concurrence prétendue testée. Suite6.7 indépendante.

### 6.7 — Créer schéma médias et transferts temporaires
- **Statut :** ◐ Implémenté — validation hors ligne réussie, réception PostgreSQL différée
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fondations PostgreSQL et migrations
- **Dépend de :** Fondations pertinentes des chapitres 01–05 et tâches préalables de ce chapitre
- **But :** créer schéma médias et transferts temporaires.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Métadonnées, checksum, ACL, fragments et ownership.
- **Validation :** Aucune URL publique ni lien orphelin.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation :**0006,7tables médias/transferts/chunks/FKtypées fabrication/suivi/dérivés/événements ; clés opaques, suiviinterne défaut, limite200Mo H37-01.
- **Validation hors ligne :**catalogue/filtrerev3 et syntaxe proposition réussis, diff contrôlé ; régressions précédemment passées.
- **Application PostgreSQL :**NON APPLIQUÉE ; SQL/SHA/recettePOINT_6_7_ADMIN à approuver au jalon.
- **Réception finale :**12refus SQL/ROLLBACK/audit différés ; ACL/transferts réels/stockage/antimalware/capacité/quotascumulés auxchapitres dédiés, pas prétendus fonctionnels. Suite6.8.

### 6.8 — Créer schéma messageries et reçus de lecture
- **Statut :** ◐ Implémenté — validation hors ligne réussie, réception PostgreSQL différée
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fondations PostgreSQL et migrations
- **Dépend de :** Fondations pertinentes des chapitres 01–05 et tâches préalables de ce chapitre
- **But :** créer schéma messageries et reçus de lecture.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Conversations générales, par commande, messages versionnés et Lu.
- **Validation :** Une conversation générale par clinique et une par commande.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation :** 6tables conversations/messages/versions/pièces/lectures/cycles ; destinationuploadclinique typée, unicités générale etordre, versions auteurd'origine et curseurs existants.
- **Validation hors ligne :** Catalogue exactrev3 réussi(0.20s/pic48), propositions Bash-n/Pythoncompile sans exécution, revue CHECK NULL etFK ;17unitaires/32offline déjàpassés sansrépétition TS inchangé.
- **Application PostgreSQL :** NON APPLIQUÉE ; migration 0007_messaging_reads.sql, SHA a0b4001b05d963cf64171f7093b2e663bae37497ce6b41304fc96da298d38c08, proposition POINT_6_8_ADMIN.md à approuver au jalon.
- **Réception finale :** 11refus/caspositifs/ROLLBACK/audit différés ; concurrencecurseurs, lifecycleconversation/SSE/droits/rappels auxservices, aucune messagerie fonctionnelle prétendue. Suite6.9 indépendante.

### 6.9 — Créer schéma notifications, mails et audit
- **Statut :** ◐ Implémenté — validation hors ligne réussie, réception PostgreSQL différée
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fondations PostgreSQL et migrations
- **Dépend de :** Fondations pertinentes des chapitres 01–05 et tâches préalables de ce chapitre
- **But :** créer schéma notifications, mails et audit.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Outbox, destinataires, retries, audit et notifications internes.
- **Validation :** Événements conservés indépendamment des e-mails.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation :** 7tables outbox/dispatch/notifications/destinataires/envois/tentatives/audit expurgé ; portauditexistant conservé.
- **Validation hors ligne :** Catalogueexactrev3 réussi(0.20s/pic48),Bash/Pythonproposition syntaxe contrôlée sansexécution, revueSQL/fixture/diff ; régressions déjàpassées.
- **Application PostgreSQL :** NON APPLIQUÉE ; migration 0008_events_notifications_audit.sql, SHA 118d11a1c0608e7e1a19c26c2b1d143d3ce8fcd2e4304f7fc9597876fc28f54c, proposition POINT_6_9_ADMIN.md à approuver au jalon.
- **Réception finale :** 11refus/caspositifs panneemail/ROLLBACK/auditSQL différés ; retries/utilité/rappels/ownerlecture/perms6.11/services nonprétendus fonctionnels. Suite6.10 indépendante.

### 6.10 — Créer schéma brouillons serveur et conflits
- **Statut :** ◐ Implémenté — validation hors ligne réussie, réception PostgreSQL différée
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fondations PostgreSQL et migrations
- **Dépend de :** Fondations pertinentes des chapitres 01–05 et tâches préalables de ce chapitre
- **But :** créer schéma brouillons serveur et conflits.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Révisions, états, pièces jointes et déduplication.
- **Validation :** Deux appareils ne peuvent écraser silencieusement une révision.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation :** 5tables révisions/tombstones/reçus/conflits/fichiers etFKpropriétaire ; repositoryCAS paramétré une requête atomique version/reçu, aucunendpointbranché.
- **Validation hors ligne :** Catalogueexactrev3passé,pic49 ;quality compilation/typage3workspaces/lint/format/frontières/workspace tous0,pic55 ;21unitaires dont4nouveauxCAS et6intégrations horsDBréelle passés,pic65. Verrou a refusé lancement prématuré avant finquality, aucunoutilheavyconcurrent ; reprise séquentielle réussie. Bash/Pythonproposition etdiff contrôlés.
- **Application PostgreSQL :** NON APPLIQUÉE ; migration 0009_drafts_conflicts.sql, SHA ddec9bd1d7b27a625d6fbab87580d97fc1ffae888225caa6103fa51508588d21, proposition POINT_6_10_ADMIN.md à approuver au jalon.
- **Réception finale :** 9refusSQL/caspositifsCAS/ROLLBACK/audit, course réelledeuxappareils/reçuaprèsréponseperdue/clonefichiers etcoffre navigateur différés. Suite6.11 indépendante.

### 6.11 — Établir privilèges futurs et tests DB
- **Statut :** ◐ Implémenté — validation hors ligne réussie, réception PostgreSQL différée
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fondations PostgreSQL et migrations
- **Dépend de :** Fondations pertinentes des chapitres 01–05 et tâches préalables de ce chapitre
- **But :** établir privilèges futurs et tests DB.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** GRANT/ALTER DEFAULT PRIVILEGES sur seules tables requises ; séparation audit/migration/app.
- **Validation :** Tests SELECT/INSERT/DDL autorisé/refusé par identité.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


- **Implémentation :**0010 proposeGRANTapp explicites/UPDATEcolonnes, historiquesappend-only, aucunélargissementIA/defaultACL/rôle/HBA ; matrice et dossierconsolidé préparés.
- **Validation hors ligne :**36tests migrations/gate dont4politiquesprivilèges réussis ;21unitaires/6intégrations/quality précédemmentréussis, catalogue/filtre/SHA/Bash-n/Pythoncompile/diff contrôlés.
- **Application PostgreSQL :**NON APPLIQUÉE ; SQL/SHA/procédure POINT_6_11_ADMIN etCHAPTER_6_RECEPTION àapprouver aujalon.
- **Réception finale :**17refusSQL/CAS/cascade/IDENTITY/ROLLBACK et7refuspeer,2coursesréelles avecfixturetemporairementengagée/cleanupspécifique différés. 6.4recette finale et0004–0010restent àréceptionner ; chapitre6NON entièrementvalidé. Développementsindépendants chapitre7 permis.

## Chapitre 07 — Authentification, comptes et gouvernance

### 7.1 — Implémenter authentification email/mot de passe
- **Statut :** ◐ Authentification/API/limiteur PostgreSQL implémentés et testés hors ligne — application et réception différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter authentification email/mot de passe.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Hash, vérification, erreurs neutres et limitation de tentatives.
- **Validation :** Tests de connexion valide/invalide.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation :**hash/vérification scryptversionné,budgetKDF1,serviceerreursneutres,repositoryemailparamétré, limiteur PostgreSQL et login/API composés au démarrage explicite. H71-01/02 dansAUTHENTICATION.md.
- **Validation hors ligne :**31unitaires dont10nouveaux (vraisKDF/testservicesdoublés) et6intégrationspassés,pic66/100 ;compilation/typage3workspaces/lint/format/frontières réussis aprèscorrectionlint.
- **Application PostgreSQL :**0013_login_attempt_limits préparée NON appliquée ; audit0008/grants0010 requis, objets confirmés absents13/10.
- **Réception finale :**HTTP testé avec services réels et pg doublé ; PostgreSQL/ACL/concurrence/runtimeconfig/proxy/charge/UI/alertes owner différés. Pasd'authproductionready. Suite7.2 indépendante.

- **Intégration13/10/2026 :** runtime compose lookup/scrypt/admission durable puis création de session,5routes auth strictes, cookies/Origin ;3contrats ajoutés après preuve de préservation intégrale des anciens.134unitaires/11intégrations passent, dont composition réelle HTTP/KDF/repositories avec pg doublé ; filtres/36tests migrations hors SQL passent. Voir AUTH_API.md et propositions administrateur.

- **Interface13/10/2026 :** App/authpanel albanais raccordés aux5endpoints, restauration identité validée, formulaire/password éphémère, déconnexions, gestion refus/pannes/429 et relecture avant renouvellement.139unitaires/12intégrations horsPG réel etbuildweb passent. Client testé, interactionsReact/TLS/navigateur reportéesR17 ; aucune activationruntime.

### 7.2 — Implémenter sessions multi-appareils
- **Statut :** ◐ SessionStore PostgreSQL et API implémentés/testés hors ligne — application et recette différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter sessions multi-appareils.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Cookies sûrs, renouvellement, révocation ciblée et globale.
- **Validation :** Sessions révoquées rejetées côté serveur.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation :**servicetokens/digests/cookies/rotation/revocation/epoch/Origin ;SessionStore PostgreSQL transactionnel et API composés, audit corrélé au request_id serveur.0011bornepersistée préparée.
- **Validation hors ligne :**38unitaires dont7sessionsportsmémoire passent ;catalogue/filtre/SHA/lint/buildAPI/frontières/format passent aprèscorrectionformat.
- **Intégration 12/10/2026, checkpoint transactions :** client PostgreSQL expose désormais un callback sur une seule connexion vérifiée, commit/rollback, délai SQL/local 10s, refus des requêtes concurrentes/oubliées et aucun rejeu de commit ambigu. 117 tests unitaires passent dont6 nouveaux cas transactionnels avec transport doublé ; tests PostgreSQL réels non exécutés. SessionStore/API finalisés au checkpoint13/10, réception PG différée.
- **Application PostgreSQL :**0011 NONAPPLIQUÉE,SQL/SHA/POINT_7_2_ADMIN préparés,jalon7distinctdelot6 ;exigesessionsvides sinonarrêtétapeSQL.
- **Réception finale :**5refusSQL/ACL/coursesPG/cookiesTLS-browser/revocationSSE différés ; two-devices/rotation/logout HTTP testés avec store doublé ;pas desessionsréelles annoncéesvalidées. Suite7.3indépendante.

- **Recette protégée13/10/2026 :** archiveAPI/web/deps et probePGrollback prêts à approbation, jamais exécutés ;contrôle ACLauth avantdémarrage. FIRST_LOGIN_RECEPTION précisechaquemigration/SHA/commande etpermissions. RecetteHTTPprivée/HTTPSPlaywright opt-inpréparée,NONréceptionnée. Bootstrapprivé et harnesscommit/courses restentcodeàécrire.

### 7.3 — Implémenter inscription clinique

> Reprise 14/10 : contrats partagés, route HTTP composable et adaptateur transactionnel préparés/testés hors ligne ; admission asynchrone corrigée. Migration 0014 des conditions/acceptations préparée et non appliquée. Route non activée au runtime ; recette PostgreSQL du nouvel adaptateur/ACL, conditions publiées, branchement UI et livraison email restent incomplets. Voir docs/CLINIC_REGISTRATION.md. Réception v3 séparée : docs/POSTGRES_V3_RECEPTION_2026-10-14.md. Aucun point déclaré entièrement validé par ce seul lot.


> Complément intégration première connexion13/10 : bootstrap privé du propriétaire implémenté (hors inscription publique), autorisation privée/empreintes/transaction verrouillée/refus réutilisation/audit et marqueur durable ; harness PostgreSQL isolé commit/rollback/concurrence préparé. Contrôles hors ligne réussis, aucune création réelle ni réception SQL/HTTPS. Dossiers FIRST_OWNER_BOOTSTRAP_ADMIN et FIRST_LOGIN_RUNTIME ; validation réelle groupée possible après accords particuliers. L'inscription clinique de ce point reste partielle. Email critique livré et déploiement complet restent ouverts.

- **Statut :** ◐ Noyau implémenté/testé hors ligne — persistance/API/recette différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter inscription clinique.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Champs obligatoires, validations et état non approuvé.
- **Validation :** Inscription non approuvée ne peut commander.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation 7.3 :** service champs/signup toujoursclinicpending/hashonly/termsactuels/ownerinit/guardéligibilité ; registerAtomic etregistrydurables/API àcompléter,aucunbootstrappublic.
- **Validation hors ligne 7.3 :** 45unitaires dont7signupportsdoublés,lint/buildAPI/frontières/format passés,pic66/100.
- **Application PostgreSQL 7.3 :** aucunnouvelSQL7.3appliqué ;stockageacceptations/docversions/bootstrapowner etgrants0010 requis avantintégration.
- **Réception finale 7.3 :** signupPG/API/commandeinterditepending,acceptances/audit/outbox/conversation etraceTermsdifférés ;aucuntextejuridique/identitéownerinventé. Suite7.4indépendante.

### 7.4 — Implémenter approbation et refus de clinique

> Lot depuis 98d1261 : adaptateur transactionnel et POST de décision intégrés au runtime sous DENTAL_LAB_CLINIC_MANAGEMENT_ENABLED=false par défaut. Session/compte/permissions relus sous verrou ; révision, historique 0012, audit et outbox atomiques. Aucune activation ni recette PostgreSQL réelle ; liste paginée et interface de décision lab branchées ; validation navigateur reportée R17.

- **Statut :** ◐ Noyau implémenté/testé hors ligne — persistance/API/recette différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter approbation et refus de clinique.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Décision lab, raison du refus, notifications selon cahier.
- **Validation :** Transitions et contrôle autorisation testés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation 7.4 :** serviceautorisationclinics.manage/casrévision/décision/raisonfacultative ; decideAtomic/PGetauditnotifications àcompléter, 0012historiqueappend préparé.
- **Validation hors ligne 7.4 :** 50unitaires dont5décisionportsdoublés,catalogue/filtre/lint/buildAPI/frontières/format passent,pic66/100.
- **Application PostgreSQL 7.4 :** 0012 NONAPPLIQUÉE,SHA/procédurePOINT_7_4_ADMIN,jalon7 àpréparer.
- **Réception finale 7.4 :** 4refusSQL/ROLLBACK etpermissions/race/transaction/audit/notificationsPG-API différés ; pas de décision réelle ni étatproductionvalidé. Suite7.5indépendante.

### 7.5 — Implémenter profil clinique et modifications autorisées

> Lot depuis 8172039 : édition transactionnelle du profil et historique paginé avant/après intégrés API/UI albanaise, permissions courantes/révision/audit, sans stockage local. Migration0015 dédiée préparée, non appliquée ; 0008 intacte. 17 tests ciblés réussis ; réception PostgreSQL/navigateur et activation toujours différées. Voir CLINIC_PROFILE.md.

- **Statut :** ◐ Édition, historique et annuaire intégrés — réception PostgreSQL/navigateur différée
- **Avancement :** Contrats stricts partagés, périmètre clinique serveur, habilitation clinics.manage, révision attendue et formulaire albanais préparés. Aucun changement e-mail/statut/sécurité/suppression permis. Voir docs/CLINIC_PROFILE.md. Adaptateur transactionnel, routes/session/origine, historique consultable, formulaire et annuaire laboratoire sont reliés. Recette PostgreSQL et navigateur non exécutée. Schémas ajoutés au snapshot après contrôle de préservation intégrale des contrats précédents.
- **Implémentation :** API et interface albanaise reliées ; annuaire toutes cliniques réservé aux habilités, identifiants UUID contrôlés avant SQL.
- **Validation hors ligne :** tests ciblés et contrôles techniques consignés dans EXECUTION_LOG.
- **Application PostgreSQL :** migration0015 proposée, non exécutée.
- **Réception finale :** différée ; aucune activation ou validation de production.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter profil clinique et modifications autorisées.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Écran informations coordonnées et historique sans suppression permanente.
- **Validation :** Seule la clinique concernée ou l’habilité édite.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 7.6 — Implémenter demande de changement d’email
- **Statut :** ◐ Noyau de workflow préparé — validation hors ligne ; intégration et réception différées
- **Avancement :** Demande propre clinique, décision owner/admin habilité, challenge privé après accord, confirmation canonique/expirante/unique et admission réseau préparés. Réutilise emailKey sans fusion des alias. Aucun changement avant accord et confirmation. Ports transactionnels, schéma versionné, outbox privée chiffrée, provider et routes à implémenter ; aucune activation ou livraison réelle. Voir docs/CLINIC_EMAIL_CHANGE.md.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter demande de changement d’email.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Décision lab, confirmation nouvelle adresse, alerte ancienne.
- **Validation :** Changement non effectif avant double condition.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation e-mail15/10 :** modèles albanais et codec privé AES-GCM préparés/testés, clés synthétiques seulement ; origine/page HTTPS et expiration explicites, token en fragment uniquement. Persistance atomique/worker/routes/livraison encore absents. Voir docs/ACCOUNT_EMAIL_PREPARATION.md.

### 7.7 — Implémenter récupération de mot de passe
- **Statut :** ◐ Noyau récupération préparé — validation hors ligne ; intégration et réception différées
- **Avancement :** Réutilise scrypt et emailKey ; demandes génériques, admission compte/réseau, jetons aléatoires à digest séparé, expiration avant/après KDF, rejeu/epoch/suspension/verrou refusés. Contrat reset atomique avec révocation de toutes sessions à compléter. Schéma, outbox chiffrée, adaptateurs, routes/UI et tests PostgreSQL/énumération/navigateur non réalisés. Aucun coffre R15 ou compte réel modifié. Voir docs/PASSWORD_RECOVERY.md.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter récupération de mot de passe.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Jetons uniques expirants, invalidation des sessions selon cas.
- **Validation :** Jeton rejoué ou expiré rejeté.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation e-mail15/10 :** modèles albanais et codec privé AES-GCM préparés/testés, clés synthétiques seulement ; origine/page HTTPS et expiration explicites, token en fragment uniquement. Persistance atomique/worker/routes/livraison encore absents. Voir docs/ACCOUNT_EMAIL_PREPARATION.md.

### 7.8 — Implémenter invitation employés
- **Statut :** ◐ Noyau invitations préparé — validation hors ligne ; intégration et réception différées
- **Avancement :** Schéma invitations 0002 réutilisé sans nouvelle migration ; autorisation employees.create owner/admin, profil employee forcé, preuve unique expirante/périmètre e-mail, KDF scrypt existante et contrat activation atomique préparés. Helper de jetons mutualisé sans changer les domaines de 7.6/7.7. Aucun compte activé, droit attribué ou e-mail envoyé. Repositories, outbox chiffrée, routes et recettes PG/navigateur restent à implémenter. Voir docs/EMPLOYEE_INVITATIONS.md.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter invitation employés.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Lien sécurisé à durée bornée, activation individuelle et historisation.
- **Validation :** Lien expiré ou réutilisé rejeté.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation e-mail15/10 :** modèles albanais et codec privé AES-GCM préparés/testés, clés synthétiques seulement ; origine/page HTTPS et expiration explicites, token en fragment uniquement. Persistance atomique/worker/routes/livraison encore absents. Voir docs/ACCOUNT_EMAIL_PREPARATION.md.

- **Préparation16/10 :** Persistance chiffrée d’intention invitation employee/admin sous transaction fournie, vérification du destinataire/jeton/état et INSERT-only ; migration0021 proposée. Émetteur/activation, routes/UI et livraison non branchés. Voir docs/ACCOUNT_EMAIL_PREPARATION.md.

### 7.9 — Implémenter gestion des administrateurs secondaires
- **Statut :** ◐ Gestion des administrateurs existants intégrée — invitation/livraison et réceptions différées
- **Avancement :** Gestion owner-only des comptes admin existants reliée API/runtime/UI albanaise : liste, détail, permissions, suspension/réactivation, historique0018/audit/outbox. Recontrôle session/owner courant/révision sous verrous, no-op sans effet et aucun contournement récupération. Invitation et livraison chiffrée encore non branchées. Flag désactivé ; migration0018 proposée seulement. Voir docs/ADMIN_GOVERNANCE.md.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter gestion des administrateurs secondaires.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Propriétaire seul, invitation, habilitation, suspension.
- **Validation :** Aucun admin ne peut gérer un autre admin.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation e-mail15/10 :** modèles albanais et codec privé AES-GCM préparés/testés, clés synthétiques seulement ; origine/page HTTPS et expiration explicites, token en fragment uniquement. Persistance atomique/worker/routes/livraison encore absents. Voir docs/ACCOUNT_EMAIL_PREPARATION.md.

- **Préparation16/10 :** Persistance chiffrée d’intention invitation employee/admin sous transaction fournie, vérification du destinataire/jeton/état et INSERT-only ; migration0021 proposée. Émetteur/activation, routes/UI et livraison non branchés. Voir docs/ACCOUNT_EMAIL_PREPARATION.md.

### 7.10 — Implémenter permissions granulaires et dépendances
- **Statut :** ◐ Registre/calcul et lecture effective API/UI intégrés — réception SQL/navigateur différée
- **Avancement :** 29 codes/prérequis exacts de 0002, ensemble demandé strict sans ajout implicite, calcul récursif et droits distincts, owner_current et périmètre propre clinique, protections de profil. Validation locale raccordée à7.9 ; lecture effective session/compte/grants reliée au runtime GET auth/permissions et contrôle de visibilité clinique en albanais, 25 tests ciblés réussis. Autorisations transactionnelles des mutations, projections/SSE/jobs futurs et recettes réelles restent à compléter. Aucun grant réel ou rôle SQL modifié. Voir docs/PERMISSIONS_IMPLEMENTATION.md.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter permissions granulaires et dépendances.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Matrice actions/visibilité/logistique/détaillé/messages/fichiers et déléguabilité.
- **Validation :** Tests négatifs pour chaque règle sensible.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 7.11 — Implémenter délégation limitée des employés
- **Statut :** ◐ API et interface albanaise intégrées — réception SQL/navigateur différée
- **Implémentation :** délégation employés et configuration des enveloppes admin réservée au propriétaire, contrôle serveur courant, confirmation des dépendants, historique/audit/outbox et révocation atomiques dans le code ; flag désactivé.
- **Validation hors ligne :** 20tests ciblés réussis ; détails et limites dans EMPLOYEE_DELEGATION.md/EXECUTION_LOG.md.
- **Application PostgreSQL :** nouvelle migration0016 proposée, non exécutée ; aucun grant réel modifié.
- **Réception finale :** différée ; concurrence/rollback réels et navigateur non reçus. Aucune activation ou clôture du chapitre.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter délégation limitée des employés.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Admin habilité peut gérer employés sans accorder permissions hors délégation.
- **Validation :** Escalade impossible par édition de requête.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 7.12 — Implémenter suspension, réactivation et sécuriser compte
- **Statut :** ◐ Suspension/réactivation/sécurisation API/UI intégrées — réception différée
- **Implémentation :** comptes clinique/employé, contrôles serveur courants, confirmation albanaise, état/revocation/history/audit/outbox transactionnels ; sécurisation owner seul et aucune levée de verrou par réactivation.
- **Validation hors ligne :** 16tests ciblés réussis, détails dans ACCOUNT_STATE.md et EXECUTION_LOG.md.
- **Application PostgreSQL :** migration0017 proposée, non appliquée ; flag désactivé.
- **Réception finale :** SQL/navigateur/flux temps réel futurs non reçus ; procédure humaine de récupération compromise à valider avant exploitation. Aucune activation de production.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter suspension, réactivation et sécuriser compte.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Révoquer sessions, bloquer actions, récupération clinique compromise.
- **Validation :** Suspension effective sur API et événements.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 7.13 — Implémenter protections de compte propriétaire
- **Statut :** ◐ Protections et adaptateur de lecture préparés — tests hors ligne ; intégration/réception différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** implémenter protections de compte propriétaire.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Un seul propriétaire, audit global exclusif, aucune cession UI.
- **Validation :** Autorisation sensible protégée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation :** unicité 0002 conservée ; opérations owner-only fermées/non délégables, service de relecture et repository paramétré compte/session/epoch/owner_slot/limites. Sécurisation clinique réutilise le prédicat commun. Aucun transfert/suspension propriétaire ou mutation audit exposé. Voir docs/OWNER_PROTECTION.md.
- **Testé hors ligne :** qualité complète (build contrats/API, trois typechecks, lint, format, frontières, résolution), 111 tests unitaires dont 7 nouveaux, 6 intégrations hors PostgreSQL et build web réussis. Le transport SQL est doublé, pas une preuve des prédicats PostgreSQL.
- **Appliqué :** aucune nouvelle migration ni opération sur comptes réels ; audit readonly confirme 12 tables/2 vues, session_limits absente, migrateurs NOLOGIN et zéro session de migration. 0002 déjà réceptionnée ; 0010/0011 restent prérequis.
- **Réception :** raccordement middleware/SessionStore et ports 7.9, recontrôle transactionnel mutations/lecture audit 17.1, tests SQL/API/concurrence/SSE/navigateur et alertes propriétaire encore différés. Pas de validation globale du chapitre.

- **Alertesconnexion13/10/2026 :** SessionStoreowner revalidé prépare security_alert/outbox/notificationinterne/livraisonsecuritypending atomiquement avecsession/audit/corrélation ;échecsannulentlogin. Grants0008/0010réutilisés ;worker/provider/template etpreuvesdelivrance restentdifférés.


- **Intégration15/10 :** gouvernance7.9, délégation7.11 et sécurisation7.12 recontrôlent propriétaire courant/session dans leurs transactions. Aucun endpoint propriétaire destructif/transfert ni mutation audit. Lecture audit17.1, alertes livrées, SSE et réception réelle restent différés.

### 7.14 — Documenter récupération exceptionnelle propriétaire
- **Statut :** ◐ Procédure documentée — simulation encadrée et réception différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** documenter récupération exceptionnelle propriétaire.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Procédure technique hors UI avec preuve d’autorité, traçabilité et sessions révoquées.
- **Validation :** Simulation encadrée vérifiée sans porte dérobée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation :** procédure hors UI dans docs/OWNER_RECOVERY.md : même propriétaire/slot, contrôle indépendant identité/autorité, approbation ponctuelle, révocation/challenge/reset/audit atomiques, preuve expurgée et reprise sans rejeu. Aucun mécanisme privilégié, secret maître ou route de secours installé.
- **Testé hors ligne :** revue documentaire contre CDC, modèle, récupération7.7, audit0008 et protections7.13 ; matrice de 11 scénarios préparée. Test existant7.13 de refus owner.recover_exceptional réussi dans le lot111 ; aucune simulation d'intervention réelle annoncée.
- **Appliqué :** documentation seulement, aucun compte/session/SQL/service modifié.
- **Réception :** identité opérateur/vérificateur et méthode d'autorité, artefact ponctuel approuvé, adapters/challenges/outbox/audit et simulation PostgreSQL/API/SSE/navigateur requis. Suite indépendante7.15 ; ne pas exécuter la procédure sur cette seule préparation.

### 7.15 — Documenter transfert exceptionnel de propriété
- **Statut :** ◐ Procédure documentée — prérequis de schéma et réception différés
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Authentification, comptes et gouvernance
- **Dépend de :** Fondations pertinentes des chapitres 01–06 et tâches préalables de ce chapitre
- **But :** documenter transfert exceptionnel de propriété.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Procédure technique et juridique vérifiable hors UI.
- **Validation :** Succession documentée et un propriétaire unique.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


- **Implémentation :** docs/OWNER_TRANSFER.md décrit autorité/succession vérifiées, disposition explicite de l'ancien compte, transaction/slot unique, révocations, audit et reprise sans rejeu. Aucun transfert UI ou script privilégié installé. Bilan consolidé docs/admin-proposals/CHAPTER_7_RECEPTION.md.
- **Testé hors ligne / audité :** catalogue/SHA et36tests migration/garde passent ; métadonnées READ ONLY confirment index unique, FKowner différées et invitations_profile_fk non différable. Revue de12scénarios ; aucune simulation de transfert exécutée.
- **Appliqué :** documentation seulement, migration0002 et schéma existant inchangés. 0011/0012/audit_events absents au contrôle de reprise.
- **Réception :** corriger par évolution versionnée le lien historique invitations/profil avant promotion d'un compte invité ; préserver l'historique, jamais supprimer les invitations/contraintes pour contourner. Autorité, devenir de l'ancien compte, artefact ponctuel, audit/adapters et simulation réelle à recevoir.
- **Suite de développement au jalon7 :** intégrer les parties encore incomplètes7.1–7.2, d'abord support transactionnel du client et SessionStore PG, puis auth/API. Ces préparations sont indépendantes de l'application administrateur différée. Ne pas présenter les callbacks et gardes hors ligne comme des parcours connectés.

## Chapitre 08 — Catalogue et paramètres

### 8.1 — Implémenter lecture des catalogues actifs
- **Statut :** ◐ Lecture API/runtime/UI intégrée — réception SQL/navigateur différée
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Catalogue et paramètres
- **Dépend de :** Fondations pertinentes des chapitres 01–07 et tâches préalables de ce chapitre
- **But :** implémenter lecture des catalogues actifs.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Types, matériaux, teintes indépendantes et catalogue simple.
- **Validation :** Seules références proposées disponibles apparaissent.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


- **Implémentation15/10 :** lecture paginée des trois catégories actives/disponibles, session/droits courants, UI albanaise, contrats stricts et flagCATALOG désactivé. Aucun catalogue/snapshot modifié, aucune migration. Voir docs/CATALOG_READ.md.

### 8.2 — Implémenter administration des catalogues
- **Statut :** ◐ Administration API/runtime/UI intégrée — réception SQL/navigateur différée
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Catalogue et paramètres
- **Dépend de :** Fondations pertinentes des chapitres 01–07 et tâches préalables de ce chapitre
- **But :** implémenter administration des catalogues.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Ajout, renommage, désactivation et retrait du catalogue courant.
- **Validation :** Snapshots historiques préservés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation15/10 :** Ajout, édition, disponibilité, retrait courant, permissions actuelles, révisions, historique/audit/outbox intégrés. Références/snapshots préservés ; migration0019 proposée seulement. Voir docs/CATALOG_MANAGEMENT.md.

### 8.3 — Implémenter références indisponibles
- **Statut :** ◐ État administrable — parcours soumission/exception à intégrer
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Catalogue et paramètres
- **Dépend de :** Fondations pertinentes des chapitres 01–07 et tâches préalables de ce chapitre
- **But :** implémenter références indisponibles.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Soumission avec avertissement, confirmation exceptionnelle avec motif.
- **Validation :** Aucune réactivation globale implicite.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation15/10 :** État indisponible administrable sans altérer les snapshots. Avertissement de soumission et acceptation exceptionnelle justifiée/confirmée restent dépendants des writers commandes9–10. Aucune clôture du parcours.

### 8.4 — Implémenter références interdites
- **Statut :** ◐ Interdiction motivée et alerte préparées — protections des futurs writers à intégrer
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Catalogue et paramètres
- **Dépend de :** Fondations pertinentes des chapitres 01–07 et tâches préalables de ce chapitre
- **But :** implémenter références interdites.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Motif obligatoire, refus de soumission/acceptation, alerte propriétaire.
- **Validation :** Impossible de bypass par API ou édition formulaire.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation15/10 :** Commande restrict, aucun contournement par édition/retrait, alerte propriétaire transactionnelle préparée sans livraison. Refus de soumission/acceptation à brancher aux futurs writers ; SQL/navigateur et décision de levée différés.

### 8.5 — Implémenter blocage des travaux concernés
- **Statut :** ◐ Blocages et examen propriétaire intégrés — réception et progression différées
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Catalogue et paramètres
- **Dépend de :** Fondations pertinentes des chapitres 01–07 et tâches préalables de ce chapitre
- **But :** implémenter blocage des travaux concernés.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Lister historiques actifs/livrés, bloquer progression non livrés sans auto-annuler.
- **Validation :** Tests statut et levée conforme.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation15/10 :** Blocages non livrés sans mutation de statut ; examen owner paginé inclut historiques/livrés. Limite technique1000 refuse atomiquement au-delà, aucune troncature. Verrouillage des futurs writers et levée conforme restent à recevoir.

### 8.6 — Implémenter paramètres publics du laboratoire
- **Statut :** ◐ Coordonnées API/runtime/UI intégrées — logo et réceptions différés
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Catalogue et paramètres
- **Dépend de :** Fondations pertinentes des chapitres 01–07 et tâches préalables de ce chapitre
- **But :** implémenter paramètres publics du laboratoire.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Nom, adresse, téléphone, mail, horaires, logo, localisation.
- **Validation :** Édition admin et lecture clinique autorisées.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


- **Préparation16/10 :** Nom/adresse/téléphone/e-mail/horaires/carte, lecture authentifiée, settings.manage serveur, révision/historique/audit/outbox. Aucun envoi ni configuration réelle ; logo dépend du pipeline fichiers. Migration0020 proposée seulement ; voir docs/LABORATORY_SETTINGS.md.

- **Préparation logo16/10 :** Orchestration privée fail-closed et six tests unitaires ; adaptateurs effectifs de stockage/scan/décodage/publication encore absents. Aucun upload/API/UI activé, aucune clôture8.6. Voir docs/LOGO_PIPELINE.md.

## Chapitre 09 — Commande clinique : saisie et dépôt

### 9.1 — Implémenter formulaire d’identification patient
- **Statut :** ◐ Dépôt clinique API/UI intégré sans pièces jointes — réceptions SQL/navigateur différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Commande clinique : saisie et dépôt
- **Dépend de :** Fondations pertinentes des chapitres 01–08 et tâches préalables de ce chapitre
- **But :** implémenter formulaire d’identification patient.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Nom+prénom et/ou référence de clinique ; champs et validation cohérents.
- **Validation :** Une des deux méthodes requise, deux noms si civil.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation16/10 :** Formulaire clinique albanais relié au contrôle serveur/catalogue, sans persistance ni dépôt simulé. Validation partagée et avertissements ; voir docs/ORDER_PREFLIGHT.md. Aucune clôture SQL/navigateur ou dépôt officiel.

- **Implémentation16/10 :** Dépôt transactionnel, reçu idempotent et snapshots serveur reliés au formulaire ; docs/ORDER_SUBMISSION.md. Hors ligne testé, aucune application PostgreSQL ni réception finale.

### 9.2 — Implémenter sélection du matériau, teinte et type
- **Statut :** ◐ Dépôt clinique API/UI intégré sans pièces jointes — réceptions SQL/navigateur différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Commande clinique : saisie et dépôt
- **Dépend de :** Fondations pertinentes des chapitres 01–08 et tâches préalables de ce chapitre
- **But :** implémenter sélection du matériau, teinte et type.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Un matériau, une teinte obligatoire, type optionnel, descriptions optionnelles.
- **Validation :** Validation client et serveur identique.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation16/10 :** Formulaire clinique albanais relié au contrôle serveur/catalogue, sans persistance ni dépôt simulé. Validation partagée et avertissements ; voir docs/ORDER_PREFLIGHT.md. Aucune clôture SQL/navigateur ou dépôt officiel.

- **Implémentation16/10 :** Dépôt transactionnel, reçu idempotent et snapshots serveur reliés au formulaire ; docs/ORDER_SUBMISSION.md. Hors ligne testé, aucune application PostgreSQL ni réception finale.

### 9.3 — Implémenter schéma FDI 32 dents et pontiques
- **Statut :** ◐ Dépôt clinique API/UI intégré sans pièces jointes — réceptions SQL/navigateur différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Commande clinique : saisie et dépôt
- **Dépend de :** Fondations pertinentes des chapitres 01–08 et tâches préalables de ce chapitre
- **But :** implémenter schéma FDI 32 dents et pontiques.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Cycle touch normal/pontique/vide et résumé, responsive.
- **Validation :** 32 codes corrects ; aucune dent obligatoire.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation16/10 :** Formulaire clinique albanais relié au contrôle serveur/catalogue, sans persistance ni dépôt simulé. Validation partagée et avertissements ; voir docs/ORDER_PREFLIGHT.md. Aucune clôture SQL/navigateur ou dépôt officiel.

- **Implémentation16/10 :** Dépôt transactionnel, reçu idempotent et snapshots serveur reliés au formulaire ; docs/ORDER_SUBMISSION.md. Hors ligne testé, aucune application PostgreSQL ni réception finale.

### 9.4 — Implémenter dates souhaitée et planifiée distinctes
- **Statut :** ◐ Dépôt clinique API/UI intégré sans pièces jointes — réceptions SQL/navigateur différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Commande clinique : saisie et dépôt
- **Dépend de :** Fondations pertinentes des chapitres 01–08 et tâches préalables de ce chapitre
- **But :** implémenter dates souhaitée et planifiée distinctes.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Date souhaitée obligatoire, date serveur automatique, planification côté lab.
- **Validation :** Aucune promesse de date planifiée par la clinique.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation16/10 :** Formulaire clinique albanais relié au contrôle serveur/catalogue, sans persistance ni dépôt simulé. Validation partagée et avertissements ; voir docs/ORDER_PREFLIGHT.md. Aucune clôture SQL/navigateur ou dépôt officiel.

- **Implémentation16/10 :** Dépôt transactionnel, reçu idempotent et snapshots serveur reliés au formulaire ; docs/ORDER_SUBMISSION.md. Hors ligne testé, aucune application PostgreSQL ni réception finale.
- **Planification 20/10 :** édition laboratoire de la date planifiée, contexte/historique/API/panneau albanais, permission `delivery.plan`, révisions et audit transactionnels ; voir docs/DELIVERY_PLAN.md. Drapeaux désactivés, SQL/concurrence/navigateur réels non réceptionnés.

### 9.5 — Implémenter avertissement commande peu détaillée
- **Statut :** ◐ Dépôt clinique API/UI intégré sans pièces jointes — réceptions SQL/navigateur différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Commande clinique : saisie et dépôt
- **Dépend de :** Fondations pertinentes des chapitres 01–08 et tâches préalables de ce chapitre
- **But :** implémenter avertissement commande peu détaillée.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Aucune dent + description vide => avertissement non bloquant.
- **Validation :** Envoi possible après confirmation.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation16/10 :** Formulaire clinique albanais relié au contrôle serveur/catalogue, sans persistance ni dépôt simulé. Validation partagée et avertissements ; voir docs/ORDER_PREFLIGHT.md. Aucune clôture SQL/navigateur ou dépôt officiel.

- **Implémentation16/10 :** Dépôt transactionnel, reçu idempotent et snapshots serveur reliés au formulaire ; docs/ORDER_SUBMISSION.md. Hors ligne testé, aucune application PostgreSQL ni réception finale.

### 9.6 — Implémenter détecteur non bloquant de doublons
- **Statut :** ◐ En cours
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Commande clinique : saisie et dépôt
- **Dépend de :** Fondations pertinentes des chapitres 01–08 et tâches préalables de ce chapitre
- **But :** implémenter détecteur non bloquant de doublons.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Recherche uniquement clinique courante, preuve de similarité et option continuer.
- **Validation :** Faux positif jamais bloquant.
- **Implémentation 27/10 :** Route de similarité sous drapeau de précontrôle, requête bornée à la clinique actuelle et à la version courante, indice non bloquant affiché avec accès à la liste et possibilité de poursuivre. Voir docs/ORDER_SIMILARITY.md et docs/ROADMAP_PROGRESS_2026-10-27.md. Tests hors ligne ciblés ; réception PostgreSQL spécifique et navigateur encore ouverts, donc point non clos.
- **Complément 27/10 :** Recette PostgreSQL indépendante order-similarity-v1 préparée avec 250 empreintes, non exécutée en attente d'autorisation dédiée. Harnais navigateur synthétique préparé ; Chromium bloqué par la limite de processus du VPS avant les scénarios, sans réception. Numéro de correspondance prérempli dans le suivi, test de rendu réussi. Suite hors PostgreSQL 572/572 sur 129 fichiers ; statut ◐ maintenu ; voir docs/ORDER_SIMILARITY.md.
- **Réception SQL 28/10 :** Recette order-similarity-v1 exécutée une fois : 16 assertions PostgreSQL réelles réussies, cluster arrêté, services inchangés. Navigateur non reçu (marge de tâches insuffisante) ; statut ◐ maintenu. Voir docs/ORDER_SIMILARITY.md.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 9.7 — Implémenter dépôt transactionnel et numérotation
- **Statut :** ◐ Dépôt clinique API/UI intégré sans pièces jointes — réceptions SQL/navigateur différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Commande clinique : saisie et dépôt
- **Dépend de :** Fondations pertinentes des chapitres 01–08 et tâches préalables de ce chapitre
- **But :** implémenter dépôt transactionnel et numérotation.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** ID unique serveur à confirmation, sauvegarde initiale et état En attente.
- **Validation :** Échec évite commande incomplète ; idempotence garantie.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation16/10 :** Dépôt transactionnel, reçu idempotent et snapshots serveur reliés au formulaire ; docs/ORDER_SUBMISSION.md. Hors ligne testé, aucune application PostgreSQL ni réception finale.

- **Complément 28/10 :** Test de réponse perdue après COMMIT dans le double transactionnel : reprise même clé sans seconde commande. PostgreSQL réel et navigateur non reçus ; statut ◐ maintenu.
- **Interface 28/10 :** Le reçu de dépôt confirmé mène au suivi, numéro serveur prérempli ; recherche explicite, test de rendu réussi. Statut ◐ maintenu.

### 9.8 — Implémenter interface récap et suivi clinique
- **Statut :** ◐ Suivi intégré et testé hors ligne — réceptions SQL/navigateur différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Commande clinique : saisie et dépôt
- **Dépend de :** Fondations pertinentes des chapitres 01–08 et tâches préalables de ce chapitre
- **But :** implémenter interface récap et suivi clinique.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Récapitulatif commandes, confirmations et retours erreurs.
- **Validation :** Clinique ne voit que ses commandes.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation16/10 :** API/UI albanaise de suivi clinique/laboratoire : recherche POST, filtres, pagination, fiche snapshots et historique des statuts ; permissions actuelles et cloisonnement serveur. Voir docs/ORDER_TRACKING.md.
- **Validation hors ligne :** buildAPI réussi après patch heap256Mio autorisé, tests ciblés avec doubles SQL/HTTP, typesweb, lint, architecture, buildweb et contrats additifs vérifiés. Résultats détaillés dans le journal.
- **Application PostgreSQL :** aucune ; runtime désactivé par défaut, aucun nouveau DDL.
- **Réception finale :** différée SQL/navigateur ; ne clôture ni les transitions restantes ni l'historique comparé de toutes les versions.
- **Complément 27/10 :** Le numéro d'une correspondance 9.6 préremplit le champ de recherche de la clinique ; le serveur de suivi conserve ses contrôles de portée et permissions. Test de rendu et régressions ciblées réussis ; navigateur et PostgreSQL non reçus, statut ◐ maintenu.

- **Complément 28/10 :** Le reçu de dépôt 9.7 contient un lien vers le suivi, avec le numéro serveur prérempli sous le compte courant. Test de rendu et régressions ciblées réussis ; réception navigateur et SQL de suivi toujours ouvertes.

### 9.9 — Implémenter création au nom de la clinique par le labo
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Commande clinique : saisie et dépôt
- **Dépend de :** Fondations pertinentes des chapitres 01–08 et tâches préalables de ce chapitre
- **But :** implémenter création au nom de la clinique par le labo.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Commande directement Acceptée et origine auteur identifiée.
- **Validation :** Mail + notification clinique ; aucun double accord.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 9.10 — Implémenter duplication depuis refusée/annulée
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Commande clinique : saisie et dépôt
- **Dépend de :** Fondations pertinentes des chapitres 01–08 et tâches préalables de ce chapitre
- **But :** implémenter duplication depuis refusée/annulée.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Nouveau numéro, lien historique, références et dates revérifiées.
- **Validation :** Original jamais réactivé.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 10 — Workflow et décisions des commandes

### 10.1 — Implémenter moteur de transitions des commandes
- **Statut :** ◐ Transitions complémentaires intégrées — autres flux et réceptions différés
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter moteur de transitions des commandes.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** En attente, Acceptée, En fabrication, Terminée, Livrée, Refusée, Correction demandée, Annulée.
- **Validation :** Transitions interdites systématiquement refusées.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation16/10 :** Acceptation/refus/version courante et démarrage protégé, historique/audit/outbox atomiques ; périmètre et limites dans docs/ORDER_DECISIONS.md. Aucun workflow complet ni réception SQL déclaré.

- **Implémentation16/10 :** voir docs/ORDER_LIFECYCLE.md : cinq actions versionnées, audit/outbox et fermeture/réouverture atomiques. Validation hors ligne avec doublesSQL ; aucune application PostgreSQL ni réception finale.

- **Complément 28/10 :** Vues de travail laboratoire pour commandes Acceptées et En fabrication, selon permissions respectives, reliées à la recherche privée et aux actions de démarrage/finalisation existantes. Tests ciblés hors navigateur ; statut ◐ maintenu.

### 10.2 — Implémenter acceptation/refus initial
- **Statut :** ◐ API et revue albanaise intégrées — réceptions différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter acceptation/refus initial.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Manuel avec motif sur refus, vérification version et permissions.
- **Validation :** Ancienne version ne peut être acceptée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation16/10 :** Acceptation/refus/version courante et démarrage protégé, historique/audit/outbox atomiques ; périmètre et limites dans docs/ORDER_DECISIONS.md. Aucun workflow complet ni réception SQL déclaré.

- **Interface16/10 :** File paginée pending/accepted, instructions/snapshots historiques, permissions détaillées et décisions versionnées ; relecture imposée après toute décision ou résultat incertain. Les autres files et le suivi clinique restent ouverts.

- **Complément 28/10 :** Après une décision ou une réponse incertaine, la revue conserve l’identifiant et propose une relecture autorisée de la fiche : statut et historique des événements visibles sans rejouer l’action. Tests ciblés hors navigateur ; réception SQL/navigateur toujours ouverte, statut ◐ maintenu.

### 10.3 — Implémenter demande et renvoi de correction
- **Statut :** ◐ Correction et renvoi intégrés — fichiers et réceptions différés
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter demande et renvoi de correction.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Statut distinct, motif, correction de données/fichiers, renvoi explicite.
- **Validation :** Re-validation obligatoire et email lab.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation16/10 :** voir docs/ORDER_LIFECYCLE.md : cinq actions versionnées, audit/outbox et fermeture/réouverture atomiques. Validation hors ligne avec doublesSQL ; aucune application PostgreSQL ni réception finale.

- **Implémentation17/10 :** API et interface albanaise, versions immuables, snapshots conservés, permissions actuelles, CAS et demandes pendantes ; voir docs/ORDER_EDIT.md.
- **Validation hors ligne :** 10 tests ciblés avec doubles SQL/HTTP ; builds, types web, lint, contrats et architecture réussis.
- **Application PostgreSQL :** aucune ; activation désactivée par défaut.
- **Réception finale :** différée (PostgreSQL réel, navigateur, pipeline fichiers et livraison des notifications).

### 10.4 — Implémenter modification directe En attente
- **Statut :** ◐ Édition versionnée intégrée — fichiers et réceptions différés
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter modification directe En attente.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Versions et historique champ/fichier, protections concurrence.
- **Validation :** Pas de modification silencieuse après acceptation.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation17/10 :** API et interface albanaise, versions immuables, snapshots conservés, permissions actuelles, CAS et demandes pendantes ; voir docs/ORDER_EDIT.md.
- **Validation hors ligne :** 10 tests ciblés avec doubles SQL/HTTP ; builds, types web, lint, contrats et architecture réussis.
- **Application PostgreSQL :** aucune ; activation désactivée par défaut.
- **Réception finale :** différée (PostgreSQL réel, navigateur, pipeline fichiers et livraison des notifications).

### 10.5 — Implémenter demandes de modification Acceptée
- **Statut :** ◐ Propositions et décisions intégrées — fichiers et réceptions différés
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter demandes de modification Acceptée.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Diff avant/après et acceptation/refus sans changer officiel avant décision.
- **Validation :** Une seule demande pendante, notification décision.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation19/10 :** proposition clinique séparée, comparaison avant/après albanaise, acceptation/refus laboratoire avec permissions et CAS ; retrait existant réutilisé. Voir docs/ORDER_MODIFICATIONS.md.
- **Validation hors ligne :** 19 tests ciblés (édition incluse), doubles transactionnels et HTTP.
- **Application PostgreSQL :** aucune, nouvelle activation désactivée par défaut.
- **Réception finale :** PostgreSQL réel, navigateur, fichiers et notifications différés.

### 10.6 — Implémenter retrait des demandes pendantes
- **Statut :** ◐ Retrait clinique versionné intégré — réceptions différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter retrait des demandes pendantes.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Dentiste peut retirer sa demande tant que pas de décision.
- **Validation :** Retrait historisé, aucune ambiguïté concurrente.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation16/10 :** API/UI albanaise, droits actuels, CAS commande/demande et audit/outbox transactionnels ; docs/ORDER_REQUESTS.md. Tests hors ligne avec doublesSQL ; aucune application PostgreSQL, réception finale différée. Propositions de modification non créées par ce lot.

### 10.7 — Implémenter annulation directe préacceptation
- **Statut :** ◐ Annulation directe clinique intégrée — réceptions différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter annulation directe préacceptation.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** En attente/Correction demandée, confirmation et historique.
- **Validation :** Aucun besoin accord laboratoire.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation16/10 :** voir docs/ORDER_LIFECYCLE.md : cinq actions versionnées, audit/outbox et fermeture/réouverture atomiques. Validation hors ligne avec doublesSQL ; aucune application PostgreSQL ni réception finale.

### 10.8 — Implémenter annulation sur demande Acceptée
- **Statut :** ◐ Demande et décision d’annulation intégrées — réceptions différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter annulation sur demande Acceptée.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Demande unique, décision laboratoire, mail résultat.
- **Validation :** Fabrication interdite durant pendance.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation16/10 :** API/UI albanaise, droits actuels, CAS commande/demande et audit/outbox transactionnels ; docs/ORDER_REQUESTS.md. Tests hors ligne avec doublesSQL ; aucune application PostgreSQL, réception finale différée. Propositions de modification non créées par ce lot.

### 10.9 — Implémenter annulation directe côté labo
- **Statut :** ◐ Annulation laboratoire intégrée — réceptions différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter annulation directe côté labo.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Jusqu’à En fabrication inclus, motif obligatoire.
- **Validation :** Terminée/Livrée impossible.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation16/10 :** voir docs/ORDER_LIFECYCLE.md : cinq actions versionnées, audit/outbox et fermeture/réouverture atomiques. Validation hors ligne avec doublesSQL ; aucune application PostgreSQL ni réception finale.

### 10.10 — Implémenter modification labo avant fabrication
- **Statut :** ◐ Édition laboratoire motivée intégrée — fichiers et réceptions différés
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter modification labo avant fabrication.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Motif, versions, diff, mail+notification clinique.
- **Validation :** Écriture interdite si demande pendante.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation17/10 :** API et interface albanaise, versions immuables, snapshots conservés, permissions actuelles, CAS et demandes pendantes ; voir docs/ORDER_EDIT.md.
- **Validation hors ligne :** 10 tests ciblés avec doubles SQL/HTTP ; builds, types web, lint, contrats et architecture réussis.
- **Application PostgreSQL :** aucune ; activation désactivée par défaut.
- **Réception finale :** différée (PostgreSQL réel, navigateur, pipeline fichiers et livraison des notifications).

### 10.11 — Implémenter verrouillage des instructions dès fabrication
- **Statut :** ◐ Décisions serveur intégrées — interface et réceptions différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter verrouillage des instructions dès fabrication.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Interdit changement champ officiel et fichier original.
- **Validation :** API, jobs et concurrence protègent verrouillage.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Préparation16/10 :** Acceptation/refus/version courante et démarrage protégé, historique/audit/outbox atomiques ; périmètre et limites dans docs/ORDER_DECISIONS.md. Aucun workflow complet ni réception SQL déclaré.

### 10.12 — Implémenter commande liée de remplacement
- **Statut :** ◐ En cours
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter commande liée de remplacement.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Nouvel ID Acceptée, origine, ancienne annulée motif.
- **Validation :** Liens bidirectionnels et audit.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation19/10 :** API transactionnelle et formulaire albanais intégrés derrière activation désactivée ; création Acceptée, origine laboratoire, contrôle des permissions, snapshots, reçu, filiation, audit/outbox. R14 : source annulée uniquement pour remplacement en fabrication ; Terminée/Livrée conservées. Voir docs/LABORATORY_LINKED_WORK.md.
- **Validation hors ligne :** 8 tests ciblés réussis (doubles transactionnels et HTTP), builds contrats/API/web, types web, lint, architecture, contrats additifs et workspace réussis ; aucune équivalence avec PostgreSQL.
- **Application PostgreSQL :** aucune ; pas de nouvelle migration dans ce lot.
- **Réception finale :** différée (transactions/verrous/privilèges réels, navigateur, pipeline fichiers et notifications).

### 10.13 — Implémenter commande liée supplémentaire
- **Statut :** ◐ En cours
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter commande liée supplémentaire.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Nouvel ID Acceptée, origine ; ancienne poursuit.
- **Validation :** Type de lien explicite et historique indépendant.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation19/10 :** API transactionnelle et formulaire albanais intégrés derrière activation désactivée ; création Acceptée, origine laboratoire, contrôle des permissions, snapshots, reçu, filiation, audit/outbox. R14 : source annulée uniquement pour remplacement en fabrication ; Terminée/Livrée conservées. Voir docs/LABORATORY_LINKED_WORK.md.
- **Validation hors ligne :** 8 tests ciblés réussis (doubles transactionnels et HTTP), builds contrats/API/web, types web, lint, architecture, contrats additifs et workspace réussis ; aucune équivalence avec PostgreSQL.
- **Application PostgreSQL :** aucune ; pas de nouvelle migration dans ce lot.
- **Réception finale :** différée (transactions/verrous/privilèges réels, navigateur, pipeline fichiers et notifications).

### 10.14 — Implémenter vues de la file des actions
- **Statut :** ◐ En cours
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** implémenter vues de la file des actions.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Nouvelles demandes, corrections, modifications, annulations et demandes prioritaires.
- **Validation :** Lire une notification ne traite pas une action.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation19/10 :** file serveur paginée et interface albanaise intégrées, permissions effectives par catégorie, retouches prioritaires et branchement sur décisions existantes. État métier indépendant de lecture des notifications. Voir docs/ACTION_INBOX.md.
- **Validation hors ligne :** 7 tests ciblés réussis (doubles/HTTP et régression revue), builds contrats/API/web, types web, lint, frontières, contrats et workspace réussis.
- **Application PostgreSQL :** aucune, aucune nouvelle migration.
- **Réception finale :** SQL réel/ACL/concurrence de lecture et navigateur différés.

### 10.15 — Tester concurrence métier extrême
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Workflow et décisions des commandes
- **Dépend de :** Fondations pertinentes des chapitres 01–09 et tâches préalables de ce chapitre
- **But :** tester concurrence métier extrême.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Validation simultanée, retrait, double clic, remplacement et version obsolète.
- **Validation :** Un seul résultat cohérent à chaque course.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 11 — Retouches et refabrications

### 11.1 — Implémenter initiation depuis commande livrée
- **Statut :** ◐ Initiation clinique intégrée — réceptions différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Retouches et refabrications
- **Dépend de :** Fondations pertinentes des chapitres 01–10 et tâches préalables de ce chapitre
- **But :** implémenter initiation depuis commande livrée.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Bouton lié au travail effectivement livré, jamais à annulation.
- **Validation :** Aucune retouche sur travail non livré.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation19/10 :** voir docs/RETOUCH_SUBMISSION.md : source Livrée revalidée, nouveau numéro/conversation/version/lien, reçu idempotent et unicité active ; UI albanaise reliée.
- **Validation hors ligne :** 8 tests ciblés avec doubles transactionnels/HTTP, aucune équivalence PostgreSQL réelle.
- **Application PostgreSQL :** aucune, feature désactivée par défaut, schéma existant réutilisé.
- **Réception finale :** PostgreSQL/concurrence réelle, navigateur et notifications différés.

### 11.2 — Implémenter formulaire de retouche simplifié
- **Statut :** ◐ Formulaire simplifié intégré — fichiers différés — réceptions différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Retouches et refabrications
- **Dépend de :** Fondations pertinentes des chapitres 01–10 et tâches préalables de ce chapitre
- **But :** implémenter formulaire de retouche simplifié.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Matériau/teinte préremplis modifiables, description obligatoire, fichiers facultatifs, sans odontogramme.
- **Validation :** Formulaire distinct et champs validés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation19/10 :** voir docs/RETOUCH_SUBMISSION.md : source Livrée revalidée, nouveau numéro/conversation/version/lien, reçu idempotent et unicité active ; UI albanaise reliée.
- **Validation hors ligne :** 8 tests ciblés avec doubles transactionnels/HTTP, aucune équivalence PostgreSQL réelle.
- **Application PostgreSQL :** aucune, feature désactivée par défaut, schéma existant réutilisé.
- **Réception finale :** PostgreSQL/concurrence réelle, navigateur et notifications différés.

### 11.3 — Implémenter demande retouche et historique
- **Statut :** ◐ Dépôt transactionnel et lien intégrés — réceptions différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Retouches et refabrications
- **Dépend de :** Fondations pertinentes des chapitres 01–10 et tâches préalables de ce chapitre
- **But :** implémenter demande retouche et historique.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Numéro distinct, conversation distincte, lien à commande source.
- **Validation :** Une retouche active à la fois par commande livrée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation19/10 :** voir docs/RETOUCH_SUBMISSION.md : source Livrée revalidée, nouveau numéro/conversation/version/lien, reçu idempotent et unicité active ; UI albanaise reliée.
- **Validation hors ligne :** 8 tests ciblés avec doubles transactionnels/HTTP, aucune équivalence PostgreSQL réelle.
- **Application PostgreSQL :** aucune, feature désactivée par défaut, schéma existant réutilisé.
- **Réception finale :** PostgreSQL/concurrence réelle, navigateur et notifications différés.

### 11.4 — Appliquer états, modifications et annulations des commandes aux retouches
- **Statut :** ◐ Socle commandes réutilisé — validation bout en bout différée
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Retouches et refabrications
- **Dépend de :** Fondations pertinentes des chapitres 01–10 et tâches préalables de ce chapitre
- **But :** appliquer états, modifications et annulations des commandes aux retouches.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Même workflow avec correction/acceptation/modification et livraison.
- **Validation :** Tests communs réussis.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation19/10 :** retouche créée comme orders.kind=retouch, mêmes décisions/lifecycle/édition/demandes, absence de dents et problème obligatoire vérifiés par édition. Synchronisation work_links via FK existante. Aucun rejeu des recettes historiques ; parcours PostgreSQL complet encore à réceptionner.

### 11.5 — Implémenter nouvelle retouche après refus/annulation/livraison
- **Statut :** ◐ Nouvelle demande après état terminal intégrée — réceptions différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Retouches et refabrications
- **Dépend de :** Fondations pertinentes des chapitres 01–10 et tâches préalables de ce chapitre
- **But :** implémenter nouvelle retouche après refus/annulation/livraison.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Nouvelle demande liée ; refusée/ancienne conservée.
- **Validation :** Pas de double retouche active.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation19/10 :** voir docs/RETOUCH_SUBMISSION.md : source Livrée revalidée, nouveau numéro/conversation/version/lien, reçu idempotent et unicité active ; UI albanaise reliée.
- **Validation hors ligne :** 8 tests ciblés avec doubles transactionnels/HTTP, aucune équivalence PostgreSQL réelle.
- **Application PostgreSQL :** aucune, feature désactivée par défaut, schéma existant réutilisé.
- **Réception finale :** PostgreSQL/concurrence réelle, navigateur et notifications différés.

### 11.6 — Implémenter navigation chaîne de commandes et retouches
- **Statut :** ◐ Navigation bidirectionnelle intégrée — réceptions différées
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Retouches et refabrications
- **Dépend de :** Fondations pertinentes des chapitres 01–10 et tâches préalables de ce chapitre
- **But :** implémenter navigation chaîne de commandes et retouches.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Afficher historique de remplacements/travaux supplémentaires et retouches réellement livrées.
- **Validation :** Navigation explicite sans confusion matérielle.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


- **Implémentation19/10 :** POST orders/links paginé, autorité commune au suivi, métadonnées sans patient, UI albanaise source/enfant avec ouverture des détails selon permissions.
- **Validation hors ligne :** tests ciblés de cloisonnement, droits logistiques/détails, curseur et HTTP ; voir docs/RETOUCH_SUBMISSION.md.
- **Application PostgreSQL :** aucune ; même activation différée que les retouches.
- **Réception finale :** PostgreSQL et navigation navigateur à réceptionner.

## Chapitre 12 — Fichiers privés et transferts

### 12.1 — Implémenter stockage privé des fichiers
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter stockage privé des fichiers.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Hors répertoire web, noms internes non prédictibles, clés et ACL.
- **Validation :** URL devinée ne révèle jamais contenu.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 12.2 — Implémenter validation des formats fichiers
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter validation des formats fichiers.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** STL PLY OBJ JPG PNG HEIC PDF, signature réelle et contrôles anti-malware adaptés.
- **Validation :** Format trompeur refusé.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 12.3 — Implémenter limites 200 Mo / 1 Go par commande
- **Statut :** ◐ Contrôles préparés — branchement transferts différé
- **Implémentation20/10 :** limites décimales, tailles réelles en flux, doublons et erreurs fermées dans files/transfer-limits ; voir docs/TRANSFER_LIMITS.md. Aucun upload activé.
- **Validation hors ligne :** 5 tests ciblés réussis, build API, lint et frontières réussis ; aucun stockage réel éprouvé.
- **Application PostgreSQL :** aucune.
- **Réception finale :** dépend des adaptateurs de stockage, capacité, analyse et de leur recette.
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter limites 200 Mo / 1 Go par commande.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** 200 Mo par fichier ; 1 Go total de la commande à la soumission.
- **Validation :** Limites vérifiées côté serveur.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 12.4 — Implémenter limite 1 Go par message
- **Statut :** ◐ Contrôles préparés — branchement transferts différé
- **Implémentation20/10 :** limites décimales, tailles réelles en flux, doublons et erreurs fermées dans files/transfer-limits ; voir docs/TRANSFER_LIMITS.md. Aucun upload activé.
- **Validation hors ligne :** 5 tests ciblés réussis, build API, lint et frontières réussis ; aucun stockage réel éprouvé.
- **Application PostgreSQL :** aucune.
- **Réception finale :** dépend des adaptateurs de stockage, capacité, analyse et de leur recette.
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter limite 1 Go par message.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** 200 Mo par fichier, 1 Go combiné par message et pas de quota cumulatif conversation.
- **Validation :** Tests tailles et abus réussis.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 12.5 — Implémenter téléversement par fragments
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter téléversement par fragments.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Progression, checksum, validation fragments, reprise explicite.
- **Validation :** Reprise sans retransmettre fragments valides.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 12.6 — Implémenter idempotence et finalisation fichiers
- **Statut :** ◐ Orchestration en flux et associations initiales intégrées — activation différée
- **Associations 20/10/2026 :** commandes/retouches raccordées transactionnellement à `prepareNewOrderFiles`, avec contrôles de périmètre, état, taille et expiration, événements et rollback. Politique absente du runtime : fichiers toujours refusés en exploitation. Messages raccordés dans un chemin préparé distinct sans route runtime ; réutilisation historique reste à intégrer ; réception SQL indépendante requise.
- **Avancement 20/10/2026 :** `upload-pipeline.ts` prépare admission exclusive, taille/hash, scellement, attestation et récupération distinguant rejet/commit incertain. `docs/UPLOAD_PIPELINE.md` décrit les obligations des adaptateurs ; aucun transfert ni association activé. Tests avec doubles uniquement, pas preuve PostgreSQL/stockage/analyse.
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter idempotence et finalisation fichiers.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Assemblage atomique et prévention des doublons commande/transfert.
- **Validation :** Pas d’ordre partiellement validé.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 12.7 — Implémenter pauses pour saturation disque
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter pauses pour saturation disque.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Réserve critique, pause, segments temporaires bornés, reprise lorsque possible.
- **Validation :** Pas de disque saturé par uploads.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 12.8 — Implémenter nettoyage des fragments expirés
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter nettoyage des fragments expirés.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** TTL validée, jobs sûrs et conservation du brouillon local.
- **Validation :** Jamais suppression des fichiers historiques.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 12.9 — Implémenter aperçus protégés et permissions fichier
- **Statut :** ◐ Consultation des métadonnées intégrée — aperçus et réception différés
- **Avancement 20/10/2026 :** API privée paginée `/api/v1/orders/files`, version courante et clinique vérifiées, droits détaillés + files.view côté laboratoire. Panneau albanais branché à la fiche commande/retouche. Aucun binaire, hash ou chemin exposé ; téléchargement explicitement indisponible. Tests unitaires/HTTP avec doubles, aucune recette PostgreSQL ou navigateur réelle.
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter aperçus protégés et permissions fichier.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Prévisualisation selon format/faisabilité, contrôle lecture et téléchargement distincts.
- **Validation :** Accès par ID erroné refusé.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 12.10 — Implémenter fichiers de suivi internes
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter fichiers de suivi internes.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Ajouter après début fabrication sans modifier les originaux.
- **Validation :** Interne par défaut et auteur horodaté.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 12.11 — Implémenter partage unitaire des fichiers de suivi
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter partage unitaire des fichiers de suivi.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Confirmer partage, autorisations, retrait de partage historisé.
- **Validation :** Accès clinique révoqué pour futur.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 12.12 — Implémenter téléchargements individuels et ZIP
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter téléchargements individuels et ZIP.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Ensemble exact des fichiers autorisés, noms corrects, streaming sans copies permanentes.
- **Validation :** Contenu zip identique originaux autorisés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 12.13 — Implémenter audit sécuritaire des téléchargements
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Fichiers privés et transferts
- **Dépend de :** Fondations pertinentes des chapitres 01–11 et tâches préalables de ce chapitre
- **But :** implémenter audit sécuritaire des téléchargements.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Tester IDOR, noms malveillants, limites HTTP, race avec révocation.
- **Validation :** Aucune fuite inter-cliniques.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 13 — Messagerie temps réel

### 13.1 — Créer conversation générale par clinique
- **Statut :** ◐ Création transactionnelle avec les deux marqueurs de lecture intégrée ; lecture/envoi textuels derrière drapeau fermé, réception PostgreSQL et navigateur différées
- **Preuve code 22/10 :** inscription clinique insère conversation générale et marqueurs `clinic`/`laboratory` dans la même transaction ; index SQL d'unicité par clinique dans 0007. Migration 0023 proposée : n'ajoute que les marqueurs absents avec curseur zéro, sans prétendre à une lecture passée ; ni exécutée ni réceptionnée sur PostgreSQL. Aucune migration de production ni activation.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Messagerie temps réel
- **Dépend de :** Fondations pertinentes des chapitres 01–12 et tâches préalables de ce chapitre
- **But :** créer conversation générale par clinique.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Une conversation durable pour chaque clinique, protégée.
- **Validation :** Aucune clinique ne voit la conversation d’une autre.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 13.2 — Créer conversation liée à chaque commande
- **Statut :** ◐ Création transactionnelle existante, lecture/envoi textuels, interface depuis liste/détail et permissions serveur intégrés derrière drapeau distinct fermé ; recettes PostgreSQL et navigateur différées.
- **Preuve code 20/10 :** soumission clinique, retouche et création laboratoire insèrent conversation et marqueurs de lecture avec la commande ; clôture/réouverture sur livraison corrigée. Réception PostgreSQL et interface de messagerie restent ouvertes.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Messagerie temps réel
- **Dépend de :** Fondations pertinentes des chapitres 01–12 et tâches préalables de ce chapitre
- **But :** créer conversation liée à chaque commande.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Une conversation spécifique par travail et retouche.
- **Validation :** Lien et permissions serveur corrects.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 13.3 — Implémenter réception/envoi des messages
- **Statut :** ◐ Réception paginée et envoi idempotent textuels intégrés pour conversations générales, commandes et retouches ; fichiers refusés, drapeaux fermés. Tests PostgreSQL réel, navigateur, éditions et fichiers restent ouverts.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Messagerie temps réel
- **Dépend de :** Fondations pertinentes des chapitres 01–12 et tâches préalables de ce chapitre
- **But :** implémenter réception/envoi des messages.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Historique paginé, fichiers et liens internes sans fuite.
- **Validation :** Messages cohérents persistants.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 13.4 — Implémenter temps réel et reconnexion
- **Statut :** ◐ Rattrapage incrémental borné, interrogation toutes les 10 s en onglet visible, reprise réseau et déduplication intégrés. Un cycle limité à cinq pages reste signalé comme incomplet jusqu'au cycle suivant ; relecture refusée efface le contenu local. Tests avec doubles (43 ciblés). Bundle PostgreSQL v6 isolé préparé avec fixture, runner et empreintes (docs/MESSAGING_RECEPTION_V6_PROPOSAL.md), **non exécuté**, donc concurrence SQL et navigateur multi-session non réceptionnés. Aucun nouveau service.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Messagerie temps réel
- **Dépend de :** Fondations pertinentes des chapitres 01–12 et tâches préalables de ce chapitre
- **But :** implémenter temps réel et reconnexion.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Transport validé, reconnexion sûre, reprise des messages manqués.
- **Validation :** Pas de perte ni duplication après rupture réseau.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 13.5 — Implémenter Envoyé et Lu
- **Statut :** ◐ Conversations générales et de commande textuelles : marqueur monotone, reçu idempotent, non-lus de l'autre côté, Envoyé/Lu et lecture automatique des seuls messages visibles avec curseur contigu ; drapeaux fermés, tests avec doubles. Migration 0023 pour marqueurs antérieurs préparée, non appliquée. Validation PostgreSQL concurrente et navigateur/IntersectionObserver multi-session restent ouvertes ; ne vaut pas réception de 13.5.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Messagerie temps réel
- **Dépend de :** Fondations pertinentes des chapitres 01–12 et tâches préalables de ce chapitre
- **But :** implémenter Envoyé et Lu.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Accusé de lecture collectif selon règle et lecture sans traitement.
- **Validation :** Statuts exacts côté clinique et labo.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 13.6 — Implémenter édition et masquage de messages
- **Statut :** ◐ Édition versionnée et masquage de l'auteur intégrés pour le texte général/commande, contrôle de révision et conversation close, historique paginé réservé à l'auteur, audit/outbox transactionnels ; fichiers refusés. Tests avec doubles uniquement, recettes PostgreSQL/navigateur différées.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Messagerie temps réel
- **Dépend de :** Fondations pertinentes des chapitres 01–12 et tâches préalables de ce chapitre
- **But :** implémenter édition et masquage de messages.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Auteur édite, badge Modifié, versions, retrait visible et audit.
- **Validation :** Historique non falsifiable via UI.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 13.7 — Clôturer conversation lors de livraison
- **Statut :** ◐ Clôture/réouverture transactionnelle existante, envoi textuel serveur refusé si close et interface lecture seule, hors activation. Concurrence PostgreSQL et navigateur non réceptionnés.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Messagerie temps réel
- **Dépend de :** Fondations pertinentes des chapitres 01–12 et tâches préalables de ce chapitre
- **But :** clôturer conversation lors de livraison.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Conversation commande lecture seule à Livrée ; réouverte si livraison corrigée.
- **Validation :** Aucun envoi malgré appel API forcé.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

- **Implémentation16/10 :** voir docs/ORDER_LIFECYCLE.md : cinq actions versionnées, audit/outbox et fermeture/réouverture atomiques. Validation hors ligne avec doublesSQL ; aucune application PostgreSQL ni réception finale.

### 13.8 — Implémenter boîte de réception laboratoire
- **Statut :** ◐ Boîte textuelle laboratoire intégrée derrière drapeau fermé : recherche clinique/numéro, filtres général/commande et non-lus, pagination, permissions distinctes et revalidation. Tests avec doubles ; PostgreSQL réel, navigateur mobile/desktop et comportement sous charge non réceptionnés.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Messagerie temps réel
- **Dépend de :** Fondations pertinentes des chapitres 01–12 et tâches préalables de ce chapitre
- **But :** implémenter boîte de réception laboratoire.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Recherche, filtres, non-lus et permissions générales/commandes distinctes.
- **Validation :** Peu de clics, pas de données masquées visibles.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 13.9 — Tester pièces jointes des conversations
- **Statut :** ⚠ Bloqué : stockage privé, réservation de capacité et analyseur réel non validés. Routes de transfert non activées ; aucune preuve de réception de fichiers.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Messagerie temps réel
- **Dépend de :** Fondations pertinentes des chapitres 01–12 et tâches préalables de ce chapitre
- **But :** tester pièces jointes des conversations.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Même ACL et limites que fichiers ; aucune pièce jointe partagée entre cliniques.
- **Validation :** Tests d’accès et d’upload réussis.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 14 — Notifications, e-mails et alertes

### 14.1 — Définir événements et notifications internes
- **Statut :** ◐ Matrice e-mail testable ; notifications internes au propriétaire pour inscription, nouvelle commande, renvoi de correction, demandes de modification et d'annulation, et retouche ajoutées dans les transactions métier. Notifications des messages généraux, de commandes et de retouches codées pour chaque compte laboratoire actuellement autorisé (ou compte clinique destinataire), avec lecture individuelle, compteur/pagination filtrés selon les droits actuels et navigation vers la conversation. L'auteur est exclu, le couple événement/destinataire est unique, et lire un avis ne lit pas les messages. Les actions métier affichent leur état réel lors de l'ouverture. Drapeau fermé par défaut ; validation PostgreSQL réelle des scénarios couverts réussie en v12 (107 assertions), navigateur non exécuté, demande initiale de correction vers la clinique encore incomplète, aucun e-mail livré.
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Notifications, e-mails et alertes
- **Dépend de :** Fondations pertinentes des chapitres 01–13 et tâches préalables de ce chapitre
- **But :** définir événements et notifications internes.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Six événements e-mail labo et décisions mails clinique exactement conformes au cahier.
- **Validation :** Matrice exhaustive testable.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 14.2 — Implémenter destinataires configurables par catégorie
- **Statut :** ◐ Structure `email_category_recipients` et cinq intentions de catégories commande préparées hors runtime : auteur clinique lié à la commande, propriétaire par défaut, admins explicitement configurés avec grants détaillés/logistiques courants ; inscription clinique conserve son adaptateur. Verrouillage des comptes admissibles et de la commande proposé ; une suppression concurrente de grant/configuration peut encore laisser une intention obsolète, à refuser impérativement avant livraison. Gestion des catégories et réception navigateur restent à faire ; scénarios PostgreSQL des intentions couverts par v12 réussis. Aucune intention livrée.
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Notifications, e-mails et alertes
- **Dépend de :** Fondations pertinentes des chapitres 01–13 et tâches préalables de ce chapitre
- **But :** implémenter destinataires configurables par catégorie.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Propriétaire par défaut, administrateurs secondaires habilités, pas d’employés automatiques.
- **Validation :** Aucun envoi à un admin sans droit.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 14.3 — Implémenter outbox et file de relance e-mail

- **Réception isolée v17 (27/10/2026) :** exécution unique autorisée réussie, 77 assertions, exit 0, `V17_SQL_OK_STOPPED` ; identité du bloqueur exigée avant commit et refus métier après commit dans le scénario. Cluster arrêté, socket absente, captures services/production/sockets identiques. Voir `docs/POSTGRES_DORMANT_DELIVERY_V17_RECEPTION_2026-10-27.md`. Transport réel et réconciliation persistée restent bloqués ; 14.3 demeure partiel.
- **Audit v16 (26/10/2026) :** SHA du manifeste vérifié `83cba08558fc5d9c20b25f8c21374539bbf511eee72cfc4248786968fd08c9ee`, 248 chemins vérifiés ; erreur de SHA dans le dossier corrigée. V16 bloquée : attente `Lock` observée dans le test, sans vérifier que le PID administrateur est le bloqueur. V16 non exécutée, bundle préservé. V17 distincte préparée avec PID bloqueur, requête, barrière avant commit, résultat après commit et promesse sans rejet non géré ; 248 empreintes vérifiées statiquement, aucun cluster lancé. Voir `docs/admin-proposals/DORMANT_DELIVERY_V16_STATIC_REVIEW.md` et `DORMANT_DELIVERY_V17_RECEPTION.md`. Une réception PostgreSQL v17 séparée est nécessaire.
- **Audit indépendant v17 (27/10/2026) :** conforme sur le plan statique avec réserves d'exécution ; manifeste 248/248, SHA annoncé confirmé, PID bloqueur corrélé avant commit et refus métier après libération exigé. Aucune exécution v17 ni réception fonctionnelle ; pas de v18 justifiée. Voir `docs/admin-proposals/DORMANT_DELIVERY_V17_STATIC_REVIEW.md`.
- **Preuves fournisseur dormantes (27/10/2026) :** évaluateur pur liant réponse authentifiée par adaptateur de confiance, tentative, version historique, fournisseur/compte, clé et empreinte ; tests synthétiques adversariaux. Résultat limité à `acceptance_candidate`, sans écriture de livraison. Schéma PostgreSQL candidat séparé, non enregistré ni exécuté, pour réservations et preuves uniques. Voir `docs/PROVIDER_EVIDENCE.md`. Adaptateur réel, stockage privé, droits et réception SQL restent bloqués.
- **Rotation HMAC dormante :** helpers purs versionnés et vérification avec ancien secret, tests unitaires fictifs ; acceptation brute sans vérificateur désormais en revue manuelle, aucune persistance de version/clé ni preuve fournisseur authentifiée. Destinataire réel, contrat fournisseur et borne de révocation après le dernier contrôle restent bloquants. Pas de livraison réelle.

- **Revue v15 :** manifeste et isolation vérifiés statiquement ; réception bloquée car le délai de 50 ms ne prouve pas l’attente effective du verrou concurrent. Bundle v16 distinct préparé avec observation explicite du verrou, non exécuté ; voir docs/admin-proposals/DORMANT_DELIVERY_V15_STATIC_REVIEW.md. Aucun PostgreSQL v15 lancé.
- **Préflight v14 et contrat fictif :** manifeste figé 248 empreintes initialement vérifié, puis une empreinte générée divergente après build API, expliquée par un commentaire compilé avant sa correction ; v14 bloquée et jamais exécutée. Bundle v15 distinct préparé, jamais exécuté. Deux tests statiques et syntaxes initialement vérifiés. Clé d’idempotence HMAC par tentative et politique pure de réconciliation ajoutées, sans fournisseur ni persistance. Une absence chez le fournisseur ne déclenche jamais de réessai automatique. Voir `docs/admin-proposals/DORMANT_DELIVERY_V14_PREFLIGHT.md`.
- **Réception v13 (2026-10-25) :** recette PostgreSQL isolée exécutée une seule fois, réussie (39 assertions, exit 0, `V13_SQL_OK_STOPPED`). Cluster arrêté, socket absente, journal d'erreurs vide, captures services/production/sockets identiques ; preuves conservées dans `.local/notifications-v13`. Détails : `docs/POSTGRES_DORMANT_DELIVERY_V13_RECEPTION_2026-10-25.md`. Ne pas relancer.
- **Suite v14 préparée, non exécutée :** nouveau bundle isolé de courses de révocation après prévol et de la seconde validation `authorize` (contrôles statiques seulement). Voir `docs/admin-proposals/DORMANT_DELIVERY_V14_RECEPTION.md`. Contrat fournisseur et bornes de révocation à décider : `docs/EMAIL_PROVIDER_CONTRACT_PROPOSAL.md`. Aucune garantie de révocation instantanée ou de livraison exactement une fois ; aucune activation.

- **Après réception v13 :** preuve conservée de 39 assertions et `V13_SQL_OK_STOPPED`. Une autorisation finale dormante recontrôle maintenant tous les prédicats en transaction juste avant le fournisseur fictif ; tests adversariaux avec doubles. La révocation après son commit reste une course impossible à rendre strictement atomique avec un fournisseur externe sans protocole supplémentaire. V13 figé ne valide pas ce nouveau harnais ; ne jamais le relancer. Voir `docs/DORMANT_EMAIL_DELIVERY.md`.
- **Suite dormante hors production :** réservation transactionnelle de deliveries avec `SKIP LOCKED`, bail de 60 s, récupération conservatrice d'un bail expiré en tentative ambiguë sans renvoi, prévol de destinataire/commande/grants/configuration, tentative et état final dans une transaction, retry borné pour erreur temporaire seulement. Harnais fournisseur fictif sans adresse ni transport. Tests avec doubles uniquement ; pas de worker branché, pas de SQL réel sur ce lot, pas de garantie exactement une fois. Course de révocation après prévol et avant transport réel encore bloquante. Voir `docs/DORMANT_EMAIL_DELIVERY.md`. Recette v13 distincte proposée, manifeste et contrôles statiques vérifiés, jamais exécutée : `docs/admin-proposals/DORMANT_DELIVERY_V13_RECEPTION.md`.
- **Suite hors production :** inventaire candidat 0022/0023 complet en lecture seule (`scripts/check-proposed-migrations.py`), sans remplacer le validateur historique ; neuf tests candidat passent. Politique pure de retry/backoff préparée et testée, sans worker ni destinataire revalidé à l'envoi. Voir `docs/admin-proposals/MIGRATIONS_0022_0023_CANDIDATE_INVENTORY.md`. Réception v12 limitée aux 107 assertions déjà obtenues.
- **Réception v12 (2026-10-25) :** recette PostgreSQL isolée exécutée **une seule fois**, réussie (`real-postgres-notification-outbox-v12-passed`, **107 assertions**, exit 0) ; marqueur `V12_SQL_OK_STOPPED`, serveur et socket privés absents, captures production/services/sockets avant-après identiques. Preuves immuables `.local/notifications-v12` ; détails dans `docs/POSTGRES_NOTIFICATIONS_V12_RECEPTION_2026-10-25.md`. Les scénarios réels couvrent notifications internes et intentions e-mail, mais pas l’envoi par fournisseur, le worker, les parcours navigateur ni le validateur administratif 0022/0023.
- **Réception v11 (2026-10-25) :** fixture chargée et erreurs de privilège/syntaxe dépassées ; échec 23505 sur deux événements synthétiques identiques `order_accepted` commande 2 révision 1. Unicité correcte, aucune validation des assertions restantes. Bundle v12 distinct avec commande synthétique 7 active et test statique des neuf clés d'événements, non exécuté (`docs/admin-proposals/NOTIFICATIONS_OUTBOX_V12_RECEPTION.md`).
- **Réception v10 (2026-10-25) :** fixture et dix refus de privilège passés, puis 42601 au premier `list` à cause d'une parenthèse excédentaire dans `visible`. Aucune assertion métier restante n'est réceptionnée. Prédicat corrigé, test structurel des clauses d'autorisation ajouté ; bundle v11 séparé préparé, non exécuté (`docs/admin-proposals/NOTIFICATIONS_OUTBOX_V11_RECEPTION.md`).
- **Réception v9 (2026-10-25) :** fixture SQL chargée, puis échec 42501 dès le premier appel JavaScript : `owner_slot FOR SHARE` sans droit UPDATE. Aucune assertion métier v9 reçue. Correctif applicatif de moindre privilège préparé et recette v10 distincte dans `docs/admin-proposals/NOTIFICATIONS_OUTBOX_V10_RECEPTION.md` ; PostgreSQL v10 et navigateur non exécutés. Les intentions restent sans fournisseur, worker ni envoi.
- **Statut :** ◐ Tables outbox et deliveries, unicité et intentions d'inscription disponibles. Appendices transactionnels préparés hors runtime pour décisions cliniques et cinq catégories labo : verrou dispatch et commande, contrôle de révision, compte/cliniques admissibles, reprise après erreur et dédoublonnage. Tests avec doubles complétés par la recette PostgreSQL réelle v12 sur les scénarios couverts ; v7 figé et inchangé mais ses dépendances ont évolué, v8 exécuté une fois : échec de fixture sur FK immédiate avant assertions, arrêt propre et preuves conservées ; v9 exécuté une fois, fixture chargée puis erreur 42501 avant assertions ; v10 exécuté une fois, dix refus passés puis 42601 avant assertions métier ; v11 exécuté une fois, erreur 23505 sur collision de fixture ; v12 exécuté une seule fois et réussi (107 assertions, arrêt et non-impact vérifiés). Reçus 0022/0023 protégés et non lisibles par dental-ai ; vérification administrateur et réception PostgreSQL séparées. Aucun worker actif, fournisseur réel ou envoi ; prévol et retry/backoff dormants testés avec doubles seulement, réception SQL réelle et verrouillage de révocation à finaliser. Avis personnels distincts des lectures de conversation et des intentions e-mail.
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Notifications, e-mails et alertes
- **Dépend de :** Fondations pertinentes des chapitres 01–13 et tâches préalables de ce chapitre
- **But :** implémenter outbox et file de relance e-mail.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Enregistrer action indépendamment fournisseur, retry/backoff et dédoublonnage.
- **Validation :** Panne SMTP/API ne perd aucune commande.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 14.4 — Implémenter e-mails cliniques requis
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Notifications, e-mails et alertes
- **Dépend de :** Fondations pertinentes des chapitres 01–13 et tâches préalables de ce chapitre
- **But :** implémenter e-mails cliniques requis.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Acceptation, corrections, refus, Terminée, décisions modification/annulation, création labo, annulation labo.
- **Validation :** Langue albanaise et liens privés sans données médicales.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 14.5 — Implémenter six alertes e-mail laboratoire
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Notifications, e-mails et alertes
- **Dépend de :** Fondations pertinentes des chapitres 01–13 et tâches préalables de ce chapitre
- **But :** implémenter six alertes e-mail laboratoire.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Nouvelle commande, inscription, modification, annulation, retouche, correction renvoyée.
- **Validation :** Aucun envoi intempestif pour les autres statuts.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 14.6 — Implémenter rappels messages non lus
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Notifications, e-mails et alertes
- **Dépend de :** Fondations pertinentes des chapitres 01–13 et tâches préalables de ce chapitre
- **But :** implémenter rappels messages non lus.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Premier après 30min, suivants ≥24h seulement si nouveaux non lus ≥30min ; reset après lecture complète.
- **Validation :** Scénarios temps simulés et absence de spam.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 14.7 — Implémenter consultation et renvoi des emails échoués
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Notifications, e-mails et alertes
- **Dépend de :** Fondations pertinentes des chapitres 01–13 et tâches préalables de ce chapitre
- **But :** implémenter consultation et renvoi des emails échoués.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Propriétaire voit état En attente/Envoyé/Échec et relance.
- **Validation :** Pas de ré-expédition d’événements obsolètes.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 14.8 — Implémenter alertes techniques propriétaires
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Notifications, e-mails et alertes
- **Dépend de :** Fondations pertinentes des chapitres 01–13 et tâches préalables de ce chapitre
- **But :** implémenter alertes techniques propriétaires.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Échec backup, stockage, sécurité et indisponibilité avec canal indépendant.
- **Validation :** Déclenchement testé même service app indisponible.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 14.9 — Tester délivrabilité et confidentialité des mails
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Notifications, e-mails et alertes
- **Dépend de :** Fondations pertinentes des chapitres 01–13 et tâches préalables de ce chapitre
- **But :** tester délivrabilité et confidentialité des mails.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** DNS domaine, SPF/DKIM/DMARC selon prestataire réel, pas de PHI.
- **Validation :** Tests de réception en environnement contrôlé.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 15 — PWA, hors ligne et brouillons

### 15.1 — Installer manifest et service worker PWA
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** PWA, hors ligne et brouillons
- **Dépend de :** Fondations pertinentes des chapitres 01–14 et tâches préalables de ce chapitre
- **But :** installer manifest et service worker PWA.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Installation sur appareils supportés, versioning et cache limité aux ressources non sensibles.
- **Validation :** Installation testée tablette/mobile.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 15.2 — Implémenter stockage local des brouillons
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** PWA, hors ligne et brouillons
- **Dépend de :** Fondations pertinentes des chapitres 01–14 et tâches préalables de ce chapitre
- **But :** implémenter stockage local des brouillons.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Formulaire et fichiers en stockage adapté ; gestion quotas, erreurs et nettoyage manuel.
- **Validation :** Reste accessible sans Internet.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 15.3 — Implémenter chiffrement et déverrouillage local
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** PWA, hors ligne et brouillons
- **Dépend de :** Fondations pertinentes des chapitres 01–14 et tâches préalables de ce chapitre
- **But :** implémenter chiffrement et déverrouillage local.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Choix cryptographique réellement supporté et testé ; liaison au compte et protection des secrets.
- **Validation :** Accès brouillon verrouillé sans identité+déverrouillage.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 15.4 — Implémenter conservation brouillon après déconnexion
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** PWA, hors ligne et brouillons
- **Dépend de :** Fondations pertinentes des chapitres 01–14 et tâches préalables de ce chapitre
- **But :** implémenter conservation brouillon après déconnexion.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Données locales chiffrées restent jusqu’au retour même compte.
- **Validation :** Autre compte ne peut consulter.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 15.5 — Implémenter révocation sur suspension lors du retour réseau
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** PWA, hors ligne et brouillons
- **Dépend de :** Fondations pertinentes des chapitres 01–14 et tâches préalables de ce chapitre
- **But :** implémenter révocation sur suspension lors du retour réseau.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Détection serveur, blocage et suppression locale du compte suspendu selon règle, limites forensiques documentées.
- **Validation :** Scénario hors ligne puis reconnexion testé.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 15.6 — Implémenter synchronisation des brouillons serveur
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** PWA, hors ligne et brouillons
- **Dépend de :** Fondations pertinentes des chapitres 01–14 et tâches préalables de ce chapitre
- **But :** implémenter synchronisation des brouillons serveur.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Créer/modifier brouillon distant avec révisions et fichiers.
- **Validation :** Reprise multi-appareils possible.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 15.7 — Implémenter détection des conflits
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** PWA, hors ligne et brouillons
- **Dépend de :** Fondations pertinentes des chapitres 01–14 et tâches préalables de ce chapitre
- **But :** implémenter détection des conflits.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Choisir serveur ou cloner local avec pièces jointes sans écraser silencieusement.
- **Validation :** Tests modifications concurrentes.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 15.8 — Implémenter envoi explicite et récupération interruption
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** PWA, hors ligne et brouillons
- **Dépend de :** Fondations pertinentes des chapitres 01–14 et tâches préalables de ce chapitre
- **But :** implémenter envoi explicite et récupération interruption.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Revalidation catalogues, fichiers et jeton idempotent ; pas d’envoi auto après connexion.
- **Validation :** Date d’envoi serveur et confirmation UI.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 15.9 — Implémenter nettoyage post-soumission confirmée
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** PWA, hors ligne et brouillons
- **Dépend de :** Fondations pertinentes des chapitres 01–14 et tâches préalables de ce chapitre
- **But :** implémenter nettoyage post-soumission confirmée.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Conserver jusqu’à ack entier, retirer copie locale au bon moment.
- **Validation :** Aucune perte après coupure.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 15.10 — Tester limites browser et stabilité PWA
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** PWA, hors ligne et brouillons
- **Dépend de :** Fondations pertinentes des chapitres 01–14 et tâches préalables de ce chapitre
- **But :** tester limites browser et stabilité PWA.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** iOS/Android/tablettes cibles, éviction storage, fermeture navigateur, updates et connexion instable.
- **Validation :** Matrice d’appareils documentée et exigences réalistes.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 16 — Planning, livraisons, archives et recherche

### 16.1 — Implémenter recherche des travaux et filtres
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Planning, livraisons, archives et recherche
- **Dépend de :** Fondations pertinentes des chapitres 01–15 et tâches préalables de ce chapitre
- **But :** implémenter recherche des travaux et filtres.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Recherche patient/référence/clinique/numéro sous permissions, filtres statut/date/type.
- **Validation :** Aucune fuite logistique vers patient.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 16.2 — Implémenter priorité et urgence
- **Statut :** ◐ Partiel — priorité manuelle versionnée sous drapeaux inactifs ; repères J-2/retard visuels sur les données suivies. Notifications fiables, calendrier et réception PostgreSQL restent à réaliser (docs/DELIVERY_PRIORITY.md).
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Planning, livraisons, archives et recherche
- **Dépend de :** Fondations pertinentes des chapitres 01–15 et tâches préalables de ce chapitre
- **But :** implémenter priorité et urgence.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Manuel, J-2 et en retard selon planifiée ou souhaitée provisoire.
- **Validation :** Pas d’e-mail d’urgence ; arrêt au statut terminal.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 16.3 — Implémenter calendrier semaine/mois
- **Statut :** ◐ Partiel — calendrier albanais semaine/mois branché sur la recherche serveur cloisonnée, date planifiée ou souhaitée provisoire, pagination explicite et ouverture du détail selon permission ; recette navigateur et réception PostgreSQL restent à réaliser.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Planning, livraisons, archives et recherche
- **Dépend de :** Fondations pertinentes des chapitres 01–15 et tâches préalables de ce chapitre
- **But :** implémenter calendrier semaine/mois.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Date planifiée ou souhaitée provisoire, lien détail.
- **Validation :** Aucune modification silencieuse des deux dates.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 16.4 — Implémenter ajustement date par glisser-déposer desktop
- **Statut :** ◐ Partiel — glisser-déposer sous permission et drapeau de planification, relecture serveur, confirmation/annulation et commande versionnée ; formulaire mobile/clavier existant. Recette navigateur desktop/mobile et PostgreSQL restent nécessaires.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Planning, livraisons, archives et recherche
- **Dépend de :** Fondations pertinentes des chapitres 01–15 et tâches préalables de ce chapitre
- **But :** implémenter ajustement date par glisser-déposer desktop.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Seule date planifiée change ; confirmation/annulation et historique.
- **Validation :** Desktop drag et mobile édition détail.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 16.5 — Implémenter Prêts à livrer
- **Statut :** ◐ Partiel — raccourci laboratoire réservé à `delivery.mark_delivered`, liste serveur filtrée `Terminée`, pagination et action individuelle existante avec mode/confirmation ; recette PostgreSQL et UX restent à réaliser.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Planning, livraisons, archives et recherche
- **Dépend de :** Fondations pertinentes des chapitres 01–15 et tâches préalables de ce chapitre
- **But :** implémenter Prêts à livrer.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Lister Terminée uniquement, méthode livraison décidée par lab.
- **Validation :** Statuts non éligibles invisibles/non traitables.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 16.6 — Implémenter livraison individuelle et groupée
- **Statut :** ◐ Code intégré ; recette PostgreSQL 17 isolée v5 réceptionnée le 21/10/2026 (atomicité, rollback, idempotence, verrous concurrents, permissions, immutabilité des reçus et éligibilité). Preuves conservées dans `.local/delivery-batch-v5/` (`result.json`, `ok`, journaux, états avant/après et empreintes vérifiées) ; PostgreSQL v5 arrêté et services inchangés. Recette navigateur, migration/activation de production et autres scénarios hors 16.6 restent ouverts.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Planning, livraisons, archives et recherche
- **Dépend de :** Fondations pertinentes des chapitres 01–15 et tâches préalables de ce chapitre
- **But :** implémenter livraison individuelle et groupée.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Sélection multi, confirmation et validation atomique adéquate.
- **Validation :** Chaque livraison datée/mode/auteur ; pas mail clinique.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 16.7 — Implémenter correction exceptionnelle de livraison
- **Statut :** ◐ Déjà intégrée au cycle de vie (motif, permission admin, retouche bloquante, réouverture conversation, archive remise à zéro) ; recette PostgreSQL réelle restante
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Planning, livraisons, archives et recherche
- **Dépend de :** Fondations pertinentes des chapitres 01–15 et tâches préalables de ce chapitre
- **But :** implémenter correction exceptionnelle de livraison.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Propriétaire/admin autorisé, motif, retour Terminée et réouverture chat.
- **Validation :** Refus si retouche contradictoire ; reset archive.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 16.8 — Implémenter archivage à J+30 après Livrée
- **Statut :** ◐ Projection de recherche active/archive intégrée ; recette PostgreSQL réelle et activation restantes
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Planning, livraisons, archives et recherche
- **Dépend de :** Fondations pertinentes des chapitres 01–15 et tâches préalables de ce chapitre
- **But :** implémenter archivage à J+30 après Livrée.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Sortir de travaux actifs, préserver recherche et données.
- **Validation :** Aucune suppression matérielle.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 16.9 — Implémenter consultation des archives
- **Statut :** ◐ Recherche et détail sous permissions existantes intégrés ; recette PostgreSQL réelle restante
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Planning, livraisons, archives et recherche
- **Dépend de :** Fondations pertinentes des chapitres 01–15 et tâches préalables de ce chapitre
- **But :** implémenter consultation des archives.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Selon permissions, anciens travaux et liens retouches accessibles.
- **Validation :** Accès clinique strictement isolé.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 17 — Administration, audit, rétention et conformité

### 17.1 — Implémenter journal d’audit global propriétaire
- **Statut :** ◐ Consultation paginée propriétaire intégrée derrière drapeau fermé ; validation PostgreSQL et activation restantes
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** implémenter journal d’audit global propriétaire.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Actions comptes, permissions, catalogue, commandes, paramètres et connexions sensibles.
- **Validation :** Aucun admin secondaire ne lit journal global.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 17.2 — Rendre journal non modifiable dans l’application
- **Statut :** ◐ Aucune route de mutation, privilèges SQL applicatifs sans UPDATE/DELETE/TRUNCATE et garde de démarrage en place ; falsification PostgreSQL réelle et rétention à valider
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** rendre journal non modifiable dans l’application.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Aucune route suppression/édition de traces, contrôle DB et rétention.
- **Validation :** Tests de falsification refusés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 17.3 — Implémenter gestion de la rétention à échéance
- **Statut :** ☐ Décisions métier/juridiques requises avant calcul d'échéance ou effacement ; catégories et questions consignées dans `docs/admin-proposals/POST_V5_VALIDATION_GAPS.md`. J+30 reste uniquement une archive d'interface.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** implémenter gestion de la rétention à échéance.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Signaler propriétaire, examiner et valider effacement/anonymisation autorisés.
- **Validation :** Exceptions légales et sauvegardes traitées.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 17.4 — Implémenter informations légales et CGU
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** implémenter informations légales et CGU.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Pages albanaises, version acceptée, confirmation changements importants si nécessaire.
- **Validation :** Textes issus de validation responsable, pas de faux contenu.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 17.5 — Implémenter politique de confidentialité
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** implémenter politique de confidentialité.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Accès public selon besoin, finalités et contacts réels.
- **Validation :** Publication des textes revus juridiquement.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 17.6 — Implémenter demandes via messagerie générale
- **Statut :** ◐ Conversation générale textuelle : lecture paginée par clinique/permission, envoi idempotent et interface albanaise intégrés derrière drapeaux fermés. Pas de tickets dédiés, fichiers refusés ; réception PostgreSQL, vérification navigateur, procédures de réponse du propriétaire et activation restent à faire.
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** implémenter demandes via messagerie générale.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Aucune nouvelle interface ticket ; réponse du propriétaire.
- **Validation :** Conversations retrouvables et audit des actions effectives.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 17.7 — Implémenter mode maintenance propriétaire
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** implémenter mode maintenance propriétaire.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Blocage opérations serveur ; message ; accès restreint de sortie et secours hors UI.
- **Validation :** Aucun envoi de commande pendant maintenance.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 17.8 — Implémenter bandeau maintenance planifiée
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** implémenter bandeau maintenance planifiée.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Annonce date/heure, modification/annulation sans e-mail ni activation automatique.
- **Validation :** Bandeau distinct de panne technique.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 17.9 — Valider qualifications juridiques des acteurs
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** valider qualifications juridiques des acteurs.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Déterminer rôles légaux clinique/labo et accords nécessaires par juriste local.
- **Validation :** Avis et mesures formellement documentés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 17.10 — Valider localisation et transferts de données
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** valider localisation et transferts de données.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Hébergement réel, backups et emails, transferts hors Kosovo et accords.
- **Validation :** Conformité vérifiée avant données réelles.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 17.11 — Valider dispositifs dentaires et traçabilité
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** valider dispositifs dentaires et traçabilité.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Exigences kosovares des dispositifs sur mesure, interdiction, rappels et responsabilité.
- **Validation :** Procédure professionnelle validée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 17.12 — Valider durées de rétention par catégorie
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** valider durées de rétention par catégorie.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Commandes, messages, fichiers, logs, comptes, sauvegardes et brouillons.
- **Validation :** Politique adoptée et contrôles implémentés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 17.13 — Valider procédure d’incident et notification
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Administration, audit, rétention et conformité
- **Dépend de :** Fondations pertinentes des chapitres 01–16 et tâches préalables de ce chapitre
- **But :** valider procédure d’incident et notification.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Canaux chat ou direct, contact externe, obligations notification et escalade.
- **Validation :** Exercice pratique et procédures documentées.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 18 — Sécurité, fiabilité et performances

### 18.1 — Auditer autorisations de bout en bout
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Sécurité / performance
- **Zone concernée :** Sécurité, fiabilité et performances
- **Dépend de :** Fondations pertinentes des chapitres 01–17 et tâches préalables de ce chapitre
- **But :** auditer autorisations de bout en bout.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Tests IDOR intercliniques, scopes propriétaire/admin/employé, temps réel, médias et exports.
- **Validation :** Toutes tentatives non autorisées refusées.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 18.2 — Auditer sessions, CSRF, XSS et injection
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Sécurité / performance
- **Zone concernée :** Sécurité, fiabilité et performances
- **Dépend de :** Fondations pertinentes des chapitres 01–17 et tâches préalables de ce chapitre
- **But :** auditer sessions, CSRF, XSS et injection.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Cookies, revocation, input validation, CSP, headers et queries paramétrées.
- **Validation :** Tests négatifs et corrections.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 18.3 — Auditer upload hostile et ZIP
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Sécurité / performance
- **Zone concernée :** Sécurité, fiabilité et performances
- **Dépend de :** Fondations pertinentes des chapitres 01–17 et tâches préalables de ce chapitre
- **But :** auditer upload hostile et ZIP.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** MIME, noms, contenu, antivirus si retenu, decompression, zip-bombs et temporaires.
- **Validation :** Aucun fichier public ni débordement quotas.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 18.4 — Auditer dépendances, secrets et supply chain
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Sécurité / performance
- **Zone concernée :** Sécurité, fiabilité et performances
- **Dépend de :** Fondations pertinentes des chapitres 01–17 et tâches préalables de ce chapitre
- **But :** auditer dépendances, secrets et supply chain.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Audit libs, lockfiles, Git, permissions runtime et mises à jour.
- **Validation :** Risques critiques corrigés ou blocage documenté.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 18.5 — Auditer performance sur volumes réalistes
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Sécurité / performance
- **Zone concernée :** Sécurité, fiabilité et performances
- **Dépend de :** Fondations pertinentes des chapitres 01–17 et tâches préalables de ce chapitre
- **But :** auditer performance sur volumes réalistes.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Grand nombre commandes, messages, modèles 200Mo et ZIP 1Go sur ressources VPS.
- **Validation :** Seuils mesurés et améliorations justifiées.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 18.6 — Auditer accessibilité et compatibilité tablette
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Sécurité / performance
- **Zone concernée :** Sécurité, fiabilité et performances
- **Dépend de :** Fondations pertinentes des chapitres 01–17 et tâches préalables de ce chapitre
- **But :** auditer accessibilité et compatibilité tablette.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Touch, clavier, Albanais, contrastes, erreurs, date et graphique FDI.
- **Validation :** Parcours essentiels testés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 18.7 — Auditer concurrence et idempotence serveur
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Sécurité / performance
- **Zone concernée :** Sécurité, fiabilité et performances
- **Dépend de :** Fondations pertinentes des chapitres 01–17 et tâches préalables de ce chapitre
- **But :** auditer concurrence et idempotence serveur.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Double soumission, versions, retouches simultanées, livraisons en lot, file de mails.
- **Validation :** Aucune double commande et aucun historique incohérent.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 18.8 — Auditer politique de données minimales
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Sécurité / performance
- **Zone concernée :** Sécurité, fiabilité et performances
- **Dépend de :** Fondations pertinentes des chapitres 01–17 et tâches préalables de ce chapitre
- **But :** auditer politique de données minimales.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Logs sans santé, recherche sans fuite, exports limités, retention selon droits.
- **Validation :** Revue sécurité documentée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 19 — Infrastructure production et exploitation

### 19.1 — Réauditer capacité du VPS multi-sites
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Infrastructure production et exploitation
- **Dépend de :** Fondations pertinentes des chapitres 01–18 et tâches préalables de ce chapitre
- **But :** réauditer capacité du VPS multi-sites.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** CPU, RAM, disques, services, ports, ACL, Nginx, PG, Node, backups et périmètre agent.
- **Validation :** Inventaire daté et risques de cohabitation.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 19.2 — Choisir topologie et réserve stockage
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Infrastructure production et exploitation
- **Dépend de :** Fondations pertinentes des chapitres 01–18 et tâches préalables de ce chapitre
- **But :** choisir topologie et réserve stockage.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Chemins persistants, quota et réserve, backup hors VPS, test de croissance.
- **Validation :** Capacité confirmée pour uploads et DB.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 19.3 — Préparer configuration production et secrets
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Infrastructure production et exploitation
- **Dépend de :** Fondations pertinentes des chapitres 01–18 et tâches préalables de ce chapitre
- **But :** préparer configuration production et secrets.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Rôles runtime sans droit DDL, secrets hors dépôt, séparation opérateur/agent.
- **Validation :** Secrets uniquement service autorisé.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 19.4 — Préparer services dédiés du laboratoire
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Infrastructure production et exploitation
- **Dépend de :** Fondations pertinentes des chapitres 01–18 et tâches préalables de ce chapitre
- **But :** préparer services dédiés du laboratoire.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Unités et compte système propres, ports locaux sans conflit.
- **Validation :** Démarrage/arrêt sans toucher aux autres sites.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 19.5 — Préparer reverse proxy et TLS
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Infrastructure production et exploitation
- **Dépend de :** Fondations pertinentes des chapitres 01–18 et tâches préalables de ce chapitre
- **But :** préparer reverse proxy et TLS.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Config dédiée vérifiée par nginx -t, domaine confirmé, redirection HTTPS.
- **Validation :** Pas de modification globale non autorisée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 19.6 — Préparer stockage persistant et sécurité fichiers
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Infrastructure production et exploitation
- **Dépend de :** Fondations pertinentes des chapitres 01–18 et tâches préalables de ce chapitre
- **But :** préparer stockage persistant et sécurité fichiers.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Chemins privés, quotas et permissions lecture écriture runtime.
- **Validation :** Redémarrage ne perd aucun média.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 19.7 — Configurer surveillance santé applicative
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Infrastructure production et exploitation
- **Dépend de :** Fondations pertinentes des chapitres 01–18 et tâches préalables de ce chapitre
- **But :** configurer surveillance santé applicative.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Uptime, logs, disponibilité DB, services externes et TLS.
- **Validation :** Alertes opérationnelles de test.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 19.8 — Configurer surveillance espace indépendante
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Infrastructure production et exploitation
- **Dépend de :** Fondations pertinentes des chapitres 01–18 et tâches préalables de ce chapitre
- **But :** configurer surveillance espace indépendante.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Alerte hors application avec seuils mesurés, blocage upload sécurisé.
- **Validation :** Signal même si application indisponible.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 19.9 — Configurer sauvegardes DB + pièces jointes
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Infrastructure production et exploitation
- **Dépend de :** Fondations pertinentes des chapitres 01–18 et tâches préalables de ce chapitre
- **But :** configurer sauvegardes DB + pièces jointes.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Backups chiffrés hors VPS, cohérents, périodicité RPO 1h et rétention 30j selon faisabilité.
- **Validation :** Restauration sur environnement isolé testée.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 19.10 — Tester restauration totale et RTO
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Infrastructure production et exploitation
- **Dépend de :** Fondations pertinentes des chapitres 01–18 et tâches préalables de ce chapitre
- **But :** tester restauration totale et RTO.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Simulation panne complète, reconstruction appli+DB+fichiers et vérification cohérence.
- **Validation :** RPO ≤1h et RTO ≤4h démontrés, sinon blocage.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 19.11 — Configurer maintenance et rollback
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Infrastructure production et exploitation
- **Dépend de :** Fondations pertinentes des chapitres 01–18 et tâches préalables de ce chapitre
- **But :** configurer maintenance et rollback.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Migrations compatibles, retour version, procédure panne et communication interne.
- **Validation :** Rollback testé sans perte incohérente.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 19.12 — Déployer préproduction sans données réelles
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Infrastructure production et exploitation
- **Dépend de :** Fondations pertinentes des chapitres 01–18 et tâches préalables de ce chapitre
- **But :** déployer préproduction sans données réelles.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Environnement contrôlé, fixtures fictives, tests TLS, API, PWA et e-mails.
- **Validation :** Non-régression des autres services.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Non (rapport / décision, sauf document à versionner)
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 20 — Recette de bout en bout

### 20.1 — Tester inscription/approbation/suspension clinique
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Recette de bout en bout
- **Dépend de :** Fondations pertinentes des chapitres 01–19 et tâches préalables de ce chapitre
- **But :** tester inscription/approbation/suspension clinique.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** De création à récupération en session multiple.
- **Validation :** Trajet démontré et erreurs prévues.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 20.2 — Tester tous les rôles et permissions
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Recette de bout en bout
- **Dépend de :** Fondations pertinentes des chapitres 01–19 et tâches préalables de ce chapitre
- **But :** tester tous les rôles et permissions.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Matrice complète sur UI, API, message et fichiers.
- **Validation :** Aucune escalade ni accès croisé.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 20.3 — Tester formulaire FDI et commandes atypiques
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Recette de bout en bout
- **Dépend de :** Fondations pertinentes des chapitres 01–19 et tâches préalables de ce chapitre
- **But :** tester formulaire FDI et commandes atypiques.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Sans dents/description, références patient, catalogues indisponibles/interdits.
- **Validation :** Comportements exacts du cahier.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 20.4 — Tester cycles complets de commande
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Recette de bout en bout
- **Dépend de :** Fondations pertinentes des chapitres 01–19 et tâches préalables de ce chapitre
- **But :** tester cycles complets de commande.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Acceptation, correction, versions, annulation et verrouillage.
- **Validation :** Tous statuts documentés testés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 20.5 — Tester retouches et remplacements
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Recette de bout en bout
- **Dépend de :** Fondations pertinentes des chapitres 01–19 et tâches préalables de ce chapitre
- **But :** tester retouches et remplacements.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Chaine liée, retouche réellement livrée, une active et refus/annulation.
- **Validation :** Aucun lien incohérent.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 20.6 — Tester messagerie et rappel non-lus
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Recette de bout en bout
- **Dépend de :** Fondations pertinentes des chapitres 01–19 et tâches préalables de ce chapitre
- **But :** tester messagerie et rappel non-lus.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Messages temps réel, offline/reconnect, lecture, pièces jointes, 30m/24h.
- **Validation :** Aucun spam ni message perdu.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 20.7 — Tester livraison/archivage
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Recette de bout en bout
- **Dépend de :** Fondations pertinentes des chapitres 01–19 et tâches préalables de ce chapitre
- **But :** tester livraison/archivage.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Lot, correction, délai 30j, réouverture et rétention.
- **Validation :** Traçabilité intacte.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 20.8 — Tester PWA sur appareils représentatifs
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Recette de bout en bout
- **Dépend de :** Fondations pertinentes des chapitres 01–19 et tâches préalables de ce chapitre
- **But :** tester PWA sur appareils représentatifs.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Préparation offline avec modèles volumineux, chiffrement, conflit, suspension.
- **Validation :** Résultats d’appareils et limites reconnus.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 20.9 — Tester upload pause/reprise/ZIP et saturation
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Recette de bout en bout
- **Dépend de :** Fondations pertinentes des chapitres 01–19 et tâches préalables de ce chapitre
- **But :** tester upload pause/reprise/ZIP et saturation.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Fichiers 200Mo, total 1Go, seuil disque, expiration fragments.
- **Validation :** Intégrité checksum et non-régression.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 20.10 — Tester panne email et panne service
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Recette de bout en bout
- **Dépend de :** Fondations pertinentes des chapitres 01–19 et tâches préalables de ce chapitre
- **But :** tester panne email et panne service.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Outbox, retries, notification erronée, mode maintenance.
- **Validation :** Aucune action métier perdue.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 20.11 — Tester backup, redéploiement, rollback et non-régression
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Recette de bout en bout
- **Dépend de :** Fondations pertinentes des chapitres 01–19 et tâches préalables de ce chapitre
- **But :** tester backup, redéploiement, rollback et non-régression.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Exercice complet d’exploitation multi-sites.
- **Validation :** RPO/RTO, monitoring et retour arrière démontrés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 20.12 — Valider textes et obligations avant données patients
- **Statut :** ☐ À faire
- **Priorité :** Critique
- **Catégorie / type :** Test / recette / exploitation
- **Zone concernée :** Recette de bout en bout
- **Dépend de :** Fondations pertinentes des chapitres 01–19 et tâches préalables de ce chapitre
- **But :** valider textes et obligations avant données patients.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Validation professionnelle et juridique documentée.
- **Validation :** Aucune donnée réelle avant feu vert.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Chapitre 21 — Mise en production et clôture

### 21.1 — Préparer release Git revue et approuvée
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Mise en production et clôture
- **Dépend de :** Fondations pertinentes des chapitres 01–20 et tâches préalables de ce chapitre
- **But :** préparer release Git revue et approuvée.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Diff, lint, typecheck, test, build, détection secrets, tag release.
- **Validation :** Version identifiée et reproductible.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 21.2 — Vérifier autorisations d’intervention production
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Mise en production et clôture
- **Dépend de :** Fondations pertinentes des chapitres 01–20 et tâches préalables de ce chapitre
- **But :** vérifier autorisations d’intervention production.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Droits ciblés root-owned, migration contrôlée, séparations des identités.
- **Validation :** dental-ai ne peut intervenir sur autre application.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 21.3 — Effectuer déploiement initial contrôlé
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Mise en production et clôture
- **Dépend de :** Fondations pertinentes des chapitres 01–20 et tâches préalables de ce chapitre
- **But :** effectuer déploiement initial contrôlé.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Déployer services du labo et appliquer migrations approuvées sur dental_lab.
- **Validation :** Services sains et aucun site voisin touché.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 21.4 — Activer TLS, domaine et configuration d’envoi réel
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Mise en production et clôture
- **Dépend de :** Fondations pertinentes des chapitres 01–20 et tâches préalables de ce chapitre
- **But :** activer TLS, domaine et configuration d’envoi réel.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** DNS validé et e-mails albanais vérifiés avec comptes de test.
- **Validation :** Connexions sécurisées et chemins privés.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 21.5 — Effectuer recette production avec données fictives
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Mise en production et clôture
- **Dépend de :** Fondations pertinentes des chapitres 01–20 et tâches préalables de ce chapitre
- **But :** effectuer recette production avec données fictives.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Inscription, commande, retouche, fichiers, messages, offline, livraisons.
- **Validation :** Preuves d’essai et nettoyage fixtures sans risque.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 21.6 — Valider sauvegardes, monitoring et stockage en production
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Mise en production et clôture
- **Dépend de :** Fondations pertinentes des chapitres 01–20 et tâches préalables de ce chapitre
- **But :** valider sauvegardes, monitoring et stockage en production.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Exécutions indépendantes et seuils réalistes, reprise testée isolée.
- **Validation :** Rapports de restauration et alertes probants.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 21.7 — Vérifier non-régression des applications VPS existantes
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Mise en production et clôture
- **Dépend de :** Fondations pertinentes des chapitres 01–20 et tâches préalables de ce chapitre
- **But :** vérifier non-régression des applications VPS existantes.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Comparer disponibilité et configurations avant/après.
- **Validation :** Aucun incident sur autres projets.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 21.8 — Documenter exploitation et procédures d’urgence
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Mise en production et clôture
- **Dépend de :** Fondations pertinentes des chapitres 01–20 et tâches préalables de ce chapitre
- **But :** documenter exploitation et procédures d’urgence.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** README, architecture, database, deployment, restore, incidents, utilisateurs et limites.
- **Validation :** Un second opérateur peut restaurer et maintenir.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 21.9 — Effectuer audit final des exigences
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Mise en production et clôture
- **Dépend de :** Fondations pertinentes des chapitres 01–20 et tâches préalables de ce chapitre
- **But :** effectuer audit final des exigences.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Passer la matrice ligne par ligne et obtenir preuves/tests de chaque point.
- **Validation :** Aucun critère requis restant non validé.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.

### 21.10 — Déclarer clôture technique et métier
- **Statut :** ☐ À faire
- **Priorité :** Haute
- **Catégorie / type :** Implémentation / test
- **Zone concernée :** Mise en production et clôture
- **Dépend de :** Fondations pertinentes des chapitres 01–20 et tâches préalables de ce chapitre
- **But :** déclarer clôture technique et métier.
- **Pourquoi :** répondre à une exigence du cahier des charges avec un résultat testable et sans régression.
- **Préconditions / à vérifier :** état réel du code et des privilèges, documents de référence, dépendances ; aucune hypothèse sur les éléments non décidés.
- **Travail attendu :** Signer la recette et constater conformité, sécurité, reprise, documentation et release.
- **Validation :** Projet terminé seulement si toutes portes critiques sont vertes.
- **Preuves attendues :** résultat vérifiable (test, journal expurgé, capture, rapport ou requête d'audit) + diff Git lorsque applicable ; noter les impossibilités.
- **Commit Git :** Oui si un fichier versionné change ; sinon sans objet
- **Pourquoi maintenant :** respecter l'ordre des dépendances et obtenir une preuve de clôture avant la suite.


## Portes de passage et interdictions de clôture

1. **G0 — Cadrage et stack :** une ADR technique réelle existe et respecte les règles génériques d'architecture ; la situation VPS est auditée. L'exemple Flo’s Bikes n'est pas une décision de stack.
2. **G1 — Remote et isolation :** accès dédié vérifié, pas de sudo large, tests d'interdiction sur autres bases, répertoires, services et secrets ; risques réseau/hôte résiduels explicitement acceptés ou traités.
3. **G2 — Données sensibles :** rôles métiers et séparation clinique testés sur API, messages, fichiers, exports, caches et recherches ; les identifiants patient sont minimisés.
4. **G3 — Offline & volumétrie :** PWA, chiffrement local, limitations réelles navigateurs, uploads par fragments, ZIP et capacité VPS démontrés sur appareils et fichiers représentatifs.
5. **G4 — Continuité :** sauvegardes chiffrées indépendantes, 30 jours de rétention, restauration cohérente DB/fichiers, RPO 1 h et RTO 4 h mesurés et non simplement déclarés. Si inatteignables : bloquer l'ouverture et faire arbitrer l'infrastructure.
6. **G5 — Juridique Kosovo :** validation documentée du traitement des données patients, transferts internationaux, conservation, dispositifs dentaires sur mesure, incidents et textes légaux ; aucune donnée réelle avant cette porte.
7. **G6 — Exploitation :** TLS, DNS, mails, monitoring hors application, réserve stockage, maintenance, rollback, aucune régression des autres sites VPS.
8. **G7 — Clôture :** critères du §20 du cahier couverts par tests ; audit final signé/accepté par le responsable. Un statut administratif ne remplace aucune preuve.

## Scénarios transversaux indispensables

- Connexion et révocation multi-appareils ; compromis clinique et récupération propriétaire hors UI.
- Deux cliniques distinctes : accès indirect par identifiant, fichiers ZIP, temps réel, cache et recherche refusé.
- Deux sessions concurrentes : validation d'ancienne version, retrait de modification, annulation, livraison et retouche active.
- Catalogue retiré puis utilisé via brouillon offline ; indisponible accepté exceptionnellement, interdit non contournable.
- Coupure pendant upload à 700 Mo, stockage saturé, pause/reprise, retour du réseau sans soumission automatique.
- Deux appareils modifient le même brouillon et ses fichiers : sélectionner serveur ou dupliquer local, jamais fusion automatique silencieuse.
- E-mail indisponible au moment d'une commande, rappel non lu à 30min/24h, destinataires configurés, échec durable.
- Livraison marquée par erreur, conversation rouverte, J+30 réinitialisé ; retouche existante bloque correction automatique.
- Retouche après remplacement : lien au travail réellement livré ; une seule retouche active pour cette commande livrée.
- Perte complète du VPS : restaurer base, fichiers, privilèges, TLS, services et audit, sans casser les autres applications.

## Livrables de clôture

- Code source versionné et reproductible ; migrations + tests ; README + ADR et architecture réelle ; interface en albanais ; documents légaux validés.
- Instructions d'installation et d'exploitation ; schéma base/permissions ; procédure de sauvegarde/restauration ; guide incident, procédure de récupération exceptionnelle et répertoire des services/ports.
- Rapports de tests fonctionnels, inter-cliniques, performance et sécurité ; rapports RPO/RTO ; validation conformité ; matrice exigences→preuves ; preuve non-régression des autres sites.
- Release identifiée et procédure rollback testée.

**Règle finale :** le projet est « terminé » uniquement quand toutes les exigences obligatoires sont couvertes, les portes G0–G7 sont franchies et les preuves sont vérifiables. Les tâches exclues du périmètre V1 n'empêchent pas la clôture.


## Suivi de préparation — 09/10/2026 (Europe/Brussels)

Cette section complète la roadmap originale ; les 217 points, leurs critères et leurs dépendances sont conservés. Le présent fichier est le suivi canonique dans `/srv/dental-lab`. Les documents joints sont copiés sous les noms ci-dessous, sans modifier leur contenu. Les mentions historiques `(1)` dans les documents désignent le prompt générique fourni sous `(2)` : son contenu est un principe d’organisation, pas une décision de stack. Le fichier joint `ARCHITECTURE.md` est le complément adapté, désormais nommé `ARCHITECTURE_ADAPTEE.md`.

### Provenance des références

| Pièce jointe | Nom dans le projet | SHA-256 de la pièce jointe |
|---|---|---|
| `CAHIER_DES_CHARGES(1).md` | `CAHIER_DES_CHARGES.md` | `15b97894ae4bbbfd89c7ad3ff70345b5072f07fafdd7836efce0eb346792fb29` |
| `ARCHITECTURE.md` | `ARCHITECTURE_ADAPTEE.md` | `4a8ad8de92f2a51b809c98df526f264cd26a0cafcd207447cd2dbf9febd71c4a` |
| `Prompt_Architecture_Web(2).md` | `Prompt_Architecture_Web.md` | `5b6259873bbf34663a071d275450ce6ee3def44ccdf6025514bbd27befbdeb3e` |
| `CONSIGNE(1).md` | `CONSIGNE.md` | `b4c0efd857f39953ca37ce14e5c449333ccaf95f8b4fbb54a19c28765b7d4a85` |
| `ROADMAP(3).md` | `ROADMAP.md` | `54d8ce1be8e0dc294cce6ddd370ddc62264b128d569cf036f4590a3f59aa7f96` |

### Preuves initiales contrôlées

- Remote sélectionné exclusivement : `vps-28bf7789`, identifiant `d378742a-d803-4e4f-be42-22c866312043`, annoncé en ligne.
- Exécution réelle : UID/GID 1002, `dental-ai`, groupes `dental-ai` et `users`, HOME `/home/dental-ai`, hostname conforme. Le cwd initial du connecteur est son dossier d’installation ; toutes les interventions projet commencent par `cd /srv/dental-lab` et vérifient `pwd -P`.
- Chemin réel `/srv/dental-lab`, propriétaire/groupe `dental-ai`, mode 700, ACL sans délégation supplémentaire. Inventaire initial vide ; aucune entrée `.git` à la racine.
- Versions exécutées : Git 2.47.3, Node 22.22.2, npm 10.9.7, client psql 17.11, Python et getfacl disponibles.
- `df -h /srv/dental-lab` : volume partagé de 74 Go, 18 Go utilisés, 54 Go disponibles (valeurs arrondies). Ce constat n’est ni un quota réservé au labo, ni une preuve de capacité production.
- Audit SQL exclusivement dans `dental_lab`, transaction `READ ONLY` avec arrêt sur erreur : serveur 17.11 ; `current_user` et `session_user` = `dental-ai`. Owner DB = `dental_lab_owner`. CONNECT autorisé ; CREATE DB et TEMP refusés. USAGE public autorisé ; CREATE public refusé.
- Rôles owner/audit/migrator/app présents, tous NOLOGIN et sans superuser/CREATEDB/CREATEROLE/replication/BYPASSRLS. `dental-ai` LOGIN sans ces privilèges, membre de `dental_lab_audit`, sans ADMIN OPTION. Aucune table applicative visible par information_schema ; ce dernier constat reste limité à la visibilité du compte d’audit.
- Configuration Remote lue : chemins autorisés `/srv/dental-lab` et `/home/dental-ai`, commande sudo bloquée. Cela ne prouve ni la politique sudo Linux complète ni une isolation réseau/hôte. Aucun test de connexion à un autre service ou une autre base, aucune lecture de secrets voisins.
- Aucun code, migration, service, rôle, privilège ou paramètre global modifié. Aucun dépôt/remote Git confirmé ; aucun commit/push.

### Compte rendu du point 1.1 — Audit des références

Statut : ☑ Validé pour l’audit documentaire uniquement. Les cinq documents ont été lus intégralement. Les 217 identifiants sont uniques et tous initialement à faire. La matrice ci-dessous relie chaque passage prescriptif en liste et chaque arbitrage tabulaire du cahier à des points réels. Les paragraphes introductifs et les clauses finales sont couverts par la revue de périmètre et les gates G0–G7. Le texte de chaque passage reste présent pour éviter une omission par résumé.

La couverture indique des interventions et des preuves futures, jamais une fonctionnalité déjà implémentée. La définition détaillée de cas de tests reste au point 1.5. Aucun framework, ORM, domaine, port, prestataire ou seuil n’est réputé décidé. Seuls PostgreSQL 17, le périmètre système et les règles métier confirmées servent de prérequis.

Lecture de cohérence à appliquer :

- La limite de 1 Go au point 12.3 concerne la soumission initiale (§4.2) ; elle ne peut pas devenir un quota historique de la commande ou une nouvelle limite cumulative de modification/suivi/retouche.
- L’accès aux commandes/fichiers exige la clinique et les droits adaptés, y compris recherche, aperçus, export, notifications et temps réel. Les aperçus 3D ne garantissent pas l’impossibilité de copier les octets.
- Les demandes de motifs de refus d’inscription (7.4) et l’édition du profil par la clinique (7.5) seront confrontées au §2.2 avant implémentation : aucun nouveau champ obligatoire ni droit de modification ne sera ajouté sans décision si non établi. Ce sont des précisions de ces futurs points, pas des comportements développés aujourd’hui.
- Les tests interprojets des points 2.2, 2.5, 2.9 et G1 ne constituent pas une autorisation de contacter d’autres services/bases. L’interdiction explicite de la mission prime. Leurs preuves non intrusives ou administrateur devront être définies lors de ces points ; ils restent non validés.
- L’ordre logique des fondations pertinentes prime sur une lecture exigeant mécaniquement tout le chapitre précédent : les fixtures DB, uploads, messagerie, mails et brouillons devront disposer de leurs fondations avant validation de leurs scénarios intégrés.
- Les validations UX sur appareils, les décisions d’infrastructure et les avis professionnels/juridiques ne peuvent être auto-attestés. Leur absence n’est pas masquée par une compilation.

Vérifications effectuées : lecture complète ; décompte et unicité 217 points ; rapprochement automatique des identifiants de couverture avec les points réels ; inventaire des sources et empreintes ; contrôle manuel des interactions sensibles (demandes, versions, catalogue, retouches, fichiers, offline, e-mails, archivage/rétention, sauvegardes). Aucune exécution de test applicatif : aucun code n’existe. Suite : 1.2.

### Matrice de traçabilité initiale (1.1)

Les identifiants CDC ci-dessous sont créés pour la traçabilité de cet audit ; ils ne sont pas des identifiants antérieurs. Les numéros de lignes se réfèrent à la pièce jointe `CAHIER_DES_CHARGES(1).md`, dont l’empreinte figure ci-dessus. Les preuves indiquées sont À PRODUIRE. Les points des chapitres 20 et 21 assurent la recette transversale/finale ; ils ne remplacent pas les tests spécifiques.

| Identifiant d’audit | Source exacte | Exigence / exclusion / condition | Couverture roadmap prévue | Preuve à produire | Cas de validation |
|---|---|---|---|---|---|
| CDC-1-01 | §1, ligne 17 | 1. Simplicité opérationnelle : peu de clics et d'informations inutiles, interface adaptée aux tablettes et téléphones, travail quotidien prioritaire sur les statistiques. | 1.4, 3.1, 4.1, 7.10, 18.1, 20.2 | Revue des frontières, simplicité UX, confidentialité et périmètre. | V-CDC-1-01 (F-1) |
| CDC-1-02 | §1, ligne 18 | 2. Traçabilité : commandes, décisions, changements de statut, historiques de versions et interventions liées ne sont jamais silencieusement écrasés. | 1.4, 3.1, 4.1, 7.10, 18.1, 20.2 | Revue des frontières, simplicité UX, confidentialité et périmètre. | V-CDC-1-02 (F-1) |
| CDC-1-03 | §1, ligne 19 | 3. Séparation des cliniques : aucune clinique n'accède aux données d'une autre. | 1.4, 3.1, 4.1, 7.10, 18.1, 20.2 | Revue des frontières, simplicité UX, confidentialité et périmètre. | V-CDC-1-03 (F-1) |
| CDC-1-04 | §1, ligne 20 | 4. Moindre privilège : permissions granulaires, contrôlées côté serveur, accès aux données patient limité selon le besoin métier. | 1.4, 3.1, 4.1, 7.10, 18.1, 20.2 | Revue des frontières, simplicité UX, confidentialité et périmètre. | V-CDC-1-04 (F-1) |
| CDC-1-05 | §1, ligne 21 | 5. Résilience : brouillons utilisables hors ligne, transferts volumineux reprenables, stockage protégé, sauvegardes et procédures de récupération. | 1.4, 3.1, 4.1, 7.10, 18.1, 20.2 | Revue des frontières, simplicité UX, confidentialité et périmètre. | V-CDC-1-05 (F-1) |
| CDC-1-06 | §1, ligne 22 | 6. Une seule application, deux portails : laboratoire et clinique ; ni portail patient, ni facturation au lancement. | 1.4, 3.1, 4.1, 7.10, 18.1, 20.2 | Revue des frontières, simplicité UX, confidentialité et périmètre. | V-CDC-1-06 (F-1) |
| CDC-2.1-01 | §2.1, ligne 28 | - Propriétaire principal : compte unique disposant du contrôle complet, sauf impossibilité de falsifier ou d'effacer l'audit. Seul lecteur du journal d'audit global. | 3.2, 7.3, 7.9, 7.10, 7.13, 17.1, 20.2 | Propriétaire unique, compte clinique partagé, délégation et refus d’escalade. | V-CDC-2.1-01 (F-2.1) |
| CDC-2.1-02 | §2.1, ligne 29 | - Administrateurs secondaires : comptes créés et administrés par le propriétaire ; permissions déterminées individuellement ; aucune élévation personnelle de privilèges. | 3.2, 7.3, 7.9, 7.10, 7.13, 17.1, 20.2 | Propriétaire unique, compte clinique partagé, délégation et refus d’escalade. | V-CDC-2.1-02 (F-2.1) |
| CDC-2.1-03 | §2.1, ligne 30 | - Employés du laboratoire : comptes individuels à permissions limitées, créés par invitation e-mail sécurisée ; pas d'attribution de commandes à un employé. | 3.2, 7.3, 7.9, 7.10, 7.13, 17.1, 20.2 | Propriétaire unique, compte clinique partagé, délégation et refus d’escalade. | V-CDC-2.1-03 (F-2.1) |
| CDC-2.1-04 | §2.1, ligne 31 | - Clinique : un compte partagé par clinique, sans comptes séparés pour dentiste ou secrétaire. Les actions attribuables à une clinique sont attribuées au compte partagé, non à un individu physique précis. | 3.2, 7.3, 7.9, 7.10, 7.13, 17.1, 20.2 | Propriétaire unique, compte clinique partagé, délégation et refus d’escalade. | V-CDC-2.1-04 (F-2.1) |
| CDC-2.2-01 | §2.2, ligne 35 | - La clinique s'inscrit avec : nom de clinique, prénom et nom du dentiste de référence, e-mail, mot de passe, téléphone et adresse complète. Son inscription nécessite l'approbation du laboratoire ; aucun envoi de commande avant approbation. | 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.11, 7.12, 7.14, 7.15, 20.1 | Inscription, décisions, invitations, suspension, récupération, changement d’adresse et interventions exceptionnelles. | V-CDC-2.2-01 (F-2.2) |
| CDC-2.2-02 | §2.2, ligne 36 | - Le laboratoire peut approuver/refuser, consulter les cliniques et leurs travaux, mettre à jour leurs coordonnées selon les permissions, suspendre/réactiver et lancer une récupération d'accès. Pas de suppression permanente simple d'une clinique. | 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.11, 7.12, 7.14, 7.15, 20.1 | Inscription, décisions, invitations, suspension, récupération, changement d’adresse et interventions exceptionnelles. | V-CDC-2.2-02 (F-2.2) |
| CDC-2.2-03 | §2.2, ligne 37 | - Le propriétaire administre les administrateurs secondaires. Il peut déléguer à des administrateurs secondaires la création, la suspension/réactivation et la gestion des permissions des employés, dans la limite des autorisations explicitement délégables. Aucun administrateur secondaire ne gère les comptes d'autres administrateurs secondaires. | 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.11, 7.12, 7.14, 7.15, 20.1 | Inscription, décisions, invitations, suspension, récupération, changement d’adresse et interventions exceptionnelles. | V-CDC-2.2-03 (F-2.2) |
| CDC-2.2-04 | §2.2, ligne 38 | - Invitation des employés par e-mail : lien à usage unique, durée de validité bornée (durée précise à déterminer), création de mot de passe par le destinataire. Le mécanisme d'invitation des administrateurs secondaires doit suivre une sécurité équivalente. | 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.11, 7.12, 7.14, 7.15, 20.1 | Inscription, décisions, invitations, suspension, récupération, changement d’adresse et interventions exceptionnelles. | V-CDC-2.2-04 (F-2.2) |
| CDC-2.2-05 | §2.2, ligne 39 | - Suspension : révocation des sessions et refus des nouvelles opérations serveur. Les actes historiques demeurent attribuables à l'ancien compte. | 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.11, 7.12, 7.14, 7.15, 20.1 | Inscription, décisions, invitations, suspension, récupération, changement d’adresse et interventions exceptionnelles. | V-CDC-2.2-05 (F-2.2) |
| CDC-2.2-06 | §2.2, ligne 40 | - Changement d'e-mail d'une clinique : demande de la clinique, décision d'un administrateur habilité, confirmation par la nouvelle adresse avant activation ; alerte de sécurité à l'ancienne adresse. | 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.11, 7.12, 7.14, 7.15, 20.1 | Inscription, décisions, invitations, suspension, récupération, changement d’adresse et interventions exceptionnelles. | V-CDC-2.2-06 (F-2.2) |
| CDC-2.2-07 | §2.2, ligne 41 | - Compte de clinique suspect de compromission : action propriétaire « Sécuriser le compte » ; révocation de toutes les sessions, blocage temporaire, réinitialisation obligatoire du mot de passe, vérification du demandeur, sans suppression des données. | 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.11, 7.12, 7.14, 7.15, 20.1 | Inscription, décisions, invitations, suspension, récupération, changement d’adresse et interventions exceptionnelles. | V-CDC-2.2-07 (F-2.2) |
| CDC-2.2-08 | §2.2, ligne 42 | - Compte propriétaire perdu : récupération ordinaire par e-mail ; récupération technique exceptionnelle si l'e-mail est inaccessible, selon une procédure documentée vérifiant identité et autorité, révoquant les sessions et consignant l'intervention. | 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.11, 7.12, 7.14, 7.15, 20.1 | Inscription, décisions, invitations, suspension, récupération, changement d’adresse et interventions exceptionnelles. | V-CDC-2.2-08 (F-2.2) |
| CDC-2.2-09 | §2.2, ligne 43 | - Changement de propriétaire principal : uniquement intervention technique exceptionnelle, documentée, vérifiée et auditée ; un seul propriétaire à la fois ; aucune action de transfert dans l'interface. | 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.11, 7.12, 7.14, 7.15, 20.1 | Inscription, décisions, invitations, suspension, récupération, changement d’adresse et interventions exceptionnelles. | V-CDC-2.2-09 (F-2.2) |
| CDC-2.3-01 | §2.3, ligne 49 | - Consultation logistique : numéro de commande, clinique, statut, priorité, dates et mode de livraison ; aucune donnée patient ni instruction technique. | 3.3, 6.3, 7.10, 7.11, 12.9, 13.8, 14.2, 18.1, 20.2 | Matrice de droits et prérequis ; tests négatifs UI/API/fichiers/messages/recherches et révocation. | V-CDC-2.3-01 (F-2.3) |
| CDC-2.3-02 | §2.3, ligne 50 | - Consultation détaillée : données logistiques plus identification patient, dents, matériau, teinte, type et description. | 3.3, 6.3, 7.10, 7.11, 12.9, 13.8, 14.2, 18.1, 20.2 | Matrice de droits et prérequis ; tests négatifs UI/API/fichiers/messages/recherches et révocation. | V-CDC-2.3-02 (F-2.3) |
| CDC-2.3-03 | §2.3, ligne 51 | - Visualisation des fichiers et téléchargement des fichiers : deux permissions distinctes, chacune exigeant aussi l'accès à la commande et aux données correspondantes. | 3.3, 6.3, 7.10, 7.11, 12.9, 13.8, 14.2, 18.1, 20.2 | Matrice de droits et prérequis ; tests négatifs UI/API/fichiers/messages/recherches et révocation. | V-CDC-2.3-03 (F-2.3) |
| CDC-2.3-04 | §2.3, ligne 52 | - Lecture et réponse aux conversations de commande : deux permissions distinctes ; la réponse implique la lecture et l'accès à la commande. | 3.3, 6.3, 7.10, 7.11, 12.9, 13.8, 14.2, 18.1, 20.2 | Matrice de droits et prérequis ; tests négatifs UI/API/fichiers/messages/recherches et révocation. | V-CDC-2.3-04 (F-2.3) |
| CDC-2.3-05 | §2.3, ligne 53 | - Lecture et réponse aux conversations générales : deux permissions distinctes des conversations de commande ; réponse implique lecture. | 3.3, 6.3, 7.10, 7.11, 12.9, 13.8, 14.2, 18.1, 20.2 | Matrice de droits et prérequis ; tests négatifs UI/API/fichiers/messages/recherches et révocation. | V-CDC-2.3-05 (F-2.3) |
| CDC-2.3-06 | §2.3, ligne 54 | - Actions métier : accepter/refuser, demander correction, modifier instructions, démarrer fabrication, changer autres statuts, planifier livraison, modifier priorité, livrer, créer commandes pour une clinique, traiter retouches, gérer catalogue, comptes et paramètres, partager fichiers de suivi, etc., selon les besoins. | 3.3, 6.3, 7.10, 7.11, 12.9, 13.8, 14.2, 18.1, 20.2 | Matrice de droits et prérequis ; tests négatifs UI/API/fichiers/messages/recherches et révocation. | V-CDC-2.3-06 (F-2.3) |
| CDC-2.3-07 | §2.3, ligne 55 | - Acceptation/refus, modification des instructions et démarrage fabrication exigent l'accès détaillé en plus de la permission d'action. Les actions purement logistiques peuvent être déléguées avec accès logistique. | 3.3, 6.3, 7.10, 7.11, 12.9, 13.8, 14.2, 18.1, 20.2 | Matrice de droits et prérequis ; tests négatifs UI/API/fichiers/messages/recherches et révocation. | V-CDC-2.3-07 (F-2.3) |
| CDC-2.3-08 | §2.3, ligne 56 | - Une autorisation ne doit pas pouvoir être accordée si ses prérequis manquent. Le retrait d'un prérequis invalide les permissions dépendantes. Contrôles effectués par le serveur et lors de chaque téléchargement, recherche, notification et accès temps réel. | 3.3, 6.3, 7.10, 7.11, 12.9, 13.8, 14.2, 18.1, 20.2 | Matrice de droits et prérequis ; tests négatifs UI/API/fichiers/messages/recherches et révocation. | V-CDC-2.3-08 (F-2.3) |
| CDC-2.3-09 | §2.3, ligne 57 | - Les utilisateurs autorisés peuvent voir toutes les commandes du laboratoire dans les limites de leurs permissions ; pas d'affectation individuelle de commande. | 3.3, 6.3, 7.10, 7.11, 12.9, 13.8, 14.2, 18.1, 20.2 | Matrice de droits et prérequis ; tests négatifs UI/API/fichiers/messages/recherches et révocation. | V-CDC-2.3-09 (F-2.3) |
| CDC-2.3-10 | §2.3, ligne 58 | - La liste des destinataires d'e-mails métier est configurable par catégorie par le propriétaire parmi les administrateurs secondaires habilités ; propriétaire destinataire par défaut des notifications importantes. Les employés ne reçoivent pas automatiquement ces e-mails administratifs. Alertes critiques de sécurité/sauvegarde toujours transmises au propriétaire. | 3.3, 6.3, 7.10, 7.11, 12.9, 13.8, 14.2, 18.1, 20.2 | Matrice de droits et prérequis ; tests négatifs UI/API/fichiers/messages/recherches et révocation. | V-CDC-2.3-10 (F-2.3) |
| CDC-3-01 | §3, ligne 62 | - Catalogues administrables : matériaux, teintes (communes à tous les matériaux), types de travaux (facultatifs dans les commandes). | 3.4, 6.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 20.3 | Catalogue, snapshots, exception commerciale et interdiction non contournable, paramètres sans finance. | V-CDC-3-01 (F-3) |
| CDC-3-02 | §3, ligne 63 | - Ajout, renommage/modification, activation, désactivation et suppression des références du catalogue courant, sans supprimer les valeurs historiques déjà utilisées. | 3.4, 6.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 20.3 | Catalogue, snapshots, exception commerciale et interdiction non contournable, paramètres sans finance. | V-CDC-3-02 (F-3) |
| CDC-3-03 | §3, ligne 64 | - Les références supprimées ou inactives restent préservées dans les commandes, brouillons, archives et duplications préremplies : il faut distinguer référence de catalogue et valeur historique figée. | 3.4, 6.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 20.3 | Catalogue, snapshots, exception commerciale et interdiction non contournable, paramètres sans finance. | V-CDC-3-03 (F-3) |
| CDC-3-04 | §3, ligne 65 | - États d'utilisation : disponible, indisponible (exception commerciale possible), interdite pour raison de sécurité/conformité (aucune exception d'utilisation). | 3.4, 6.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 20.3 | Catalogue, snapshots, exception commerciale et interdiction non contournable, paramètres sans finance. | V-CDC-3-04 (F-3) |
| CDC-3-05 | §3, ligne 66 | - Une référence indisponible peut figurer dans un brouillon et être soumise avec avertissement. Le laboratoire peut l'accepter exceptionnellement avec justification et confirmation explicite sans la réactiver globalement. | 3.4, 6.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 20.3 | Catalogue, snapshots, exception commerciale et interdiction non contournable, paramètres sans finance. | V-CDC-3-05 (F-3) |
| CDC-3-06 | §3, ligne 67 | - Une référence interdite ne peut pas servir à une nouvelle soumission ou à une acceptation ; son motif est obligatoire. Les travaux non livrés l'utilisant sont bloqués préventivement dans leur progression, mais pas annulés automatiquement. Le propriétaire est alerté et peut examiner tous les travaux concernés ; ceux déjà livrés sont signalés pour examen. Une interdiction réglementaire ne peut pas être contournée par un administrateur. | 3.4, 6.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 20.3 | Catalogue, snapshots, exception commerciale et interdiction non contournable, paramètres sans finance. | V-CDC-3-06 (F-3) |
| CDC-3-07 | §3, ligne 68 | - Informations publiques du laboratoire dans le portail : nom, adresse, téléphone, e-mail, horaires, logo, lien de localisation/carte. Mise à jour depuis les paramètres, selon permissions. | 3.4, 6.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 20.3 | Catalogue, snapshots, exception commerciale et interdiction non contournable, paramètres sans finance. | V-CDC-3-07 (F-3) |
| CDC-3-08 | §3, ligne 69 | - Aucun prix ou champ financier visible dans le portail clinique au lancement. | 3.4, 6.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 20.3 | Catalogue, snapshots, exception commerciale et interdiction non contournable, paramètres sans finance. | V-CDC-3-08 (F-3) |
| CDC-4.1-01 | §4.1, ligne 75 | - Numéro unique attribué par le serveur à la soumission effective, date et heure de réception serveur enregistrées automatiquement. | 6.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 12.2, 20.3 | Combinaisons patient, FDI tactile, champs obligatoires/facultatifs, dates et numéro serveur. | V-CDC-4.1-01 (F-4.1) |
| CDC-4.1-02 | §4.1, ligne 76 | - Identification patient : soit prénom ET nom, soit référence interne de la clinique ; possibilité de fournir les deux, sans exiger les deux modes. Un patient n'a pas de dossier transversal dans l'application et l'égalité des noms ne signifie pas identité commune. | 6.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 12.2, 20.3 | Combinaisons patient, FDI tactile, champs obligatoires/facultatifs, dates et numéro serveur. | V-CDC-4.1-02 (F-4.1) |
| CDC-4.1-03 | §4.1, ligne 77 | - Date de livraison souhaitée obligatoire pour la clinique ; distincte de la date de livraison planifiée par le laboratoire. Les deux restent visibles, sans promesse de respect garanti de l'échéance. | 6.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 12.2, 20.3 | Combinaisons patient, FDI tactile, champs obligatoires/facultatifs, dates et numéro serveur. | V-CDC-4.1-03 (F-4.1) |
| CDC-4.1-04 | §4.1, ligne 78 | - Matériau obligatoire, teinte obligatoire, et un seul matériau + une seule teinte par commande, communs à toutes les dents. | 6.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 12.2, 20.3 | Combinaisons patient, FDI tactile, champs obligatoires/facultatifs, dates et numéro serveur. | V-CDC-4.1-04 (F-4.1) |
| CDC-4.1-05 | §4.1, ligne 79 | - Type de travail : facultatif ; description : facultative, même sans dents sélectionnées. | 6.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 12.2, 20.3 | Combinaisons patient, FDI tactile, champs obligatoires/facultatifs, dates et numéro serveur. | V-CDC-4.1-05 (F-4.1) |
| CDC-4.1-06 | §4.1, ligne 80 | - Schéma dentaire FDI permanent à 32 dents : 11–18, 21–28, 31–38, 41–48. Premier appui : dent normale ; deuxième : pontic/« antar » ; troisième : non sélectionnée. Fonctionne au toucher sur tablette. Aucune dent obligatoire, aucun regroupement automatique des bridges ; expliciter au besoin dans la description. | 6.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 12.2, 20.3 | Combinaisons patient, FDI tactile, champs obligatoires/facultatifs, dates et numéro serveur. | V-CDC-4.1-06 (F-4.1) |
| CDC-4.1-07 | §4.1, ligne 81 | - Si aucune dent ni description, afficher un avertissement non bloquant avant envoi : ne pas créer une obligation contredisant le choix métier. | 6.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 12.2, 20.3 | Combinaisons patient, FDI tactile, champs obligatoires/facultatifs, dates et numéro serveur. | V-CDC-4.1-07 (F-4.1) |
| CDC-4.1-08 | §4.1, ligne 82 | - Pièces jointes facultatives : STL, PLY, OBJ, JPG, PNG, HEIC et PDF. | 6.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 12.2, 20.3 | Combinaisons patient, FDI tactile, champs obligatoires/facultatifs, dates et numéro serveur. | V-CDC-4.1-08 (F-4.1) |
| CDC-4.2-01 | §4.2, ligne 86 | - 200 Mo par fichier. | 3.7, 12.2, 12.3, 12.4, 12.5, 12.7, 12.13, 20.9 | Limites de taille exactes, intégrité, formats et droits ; aucune nouvelle limite cumulative hors décision. | V-CDC-4.2-01 (F-4.2) |
| CDC-4.2-02 | §4.2, ligne 87 | - 1 Go cumulé pour les fichiers de la commande initiale lors de sa création ; pas de nombre maximal arbitraire de fichiers. | 3.7, 12.2, 12.3, 12.4, 12.5, 12.7, 12.13, 20.9 | Limites de taille exactes, intégrité, formats et droits ; aucune nouvelle limite cumulative hors décision. | V-CDC-4.2-02 (F-4.2) |
| CDC-4.2-03 | §4.2, ligne 88 | - 1 Go par message dans la messagerie, toujours dans la limite de 200 Mo par fichier ; pas de quota cumulatif fixe par conversation. | 3.7, 12.2, 12.3, 12.4, 12.5, 12.7, 12.13, 20.9 | Limites de taille exactes, intégrité, formats et droits ; aucune nouvelle limite cumulative hors décision. | V-CDC-4.2-03 (F-4.2) |
| CDC-4.2-04 | §4.2, ligne 89 | - Limites des fichiers ajoutés lors des modifications, des fichiers de suivi ou des retouches : appliquer au minimum 200 Mo/fichier, prévoir des règles de capacité cohérentes avec le stockage ; ne pas présumer une limite cumulative supplémentaire non décidée. | 3.7, 12.2, 12.3, 12.4, 12.5, 12.7, 12.13, 20.9 | Limites de taille exactes, intégrité, formats et droits ; aucune nouvelle limite cumulative hors décision. | V-CDC-4.2-04 (F-4.2) |
| CDC-4.2-05 | §4.2, ligne 90 | - Validation du type, du contenu, des droits, de la taille et de l'intégrité côté serveur ; progression, erreurs explicites, reprise sécurisée, aucune exposition par URL publique. | 3.7, 12.2, 12.3, 12.4, 12.5, 12.7, 12.13, 20.9 | Limites de taille exactes, intégrité, formats et droits ; aucune nouvelle limite cumulative hors décision. | V-CDC-4.2-05 (F-4.2) |
| CDC-4.3-01 | §4.3, ligne 94 | - Protection technique contre les doubles soumissions d'une même commande (idempotence). | 9.6, 9.7, 10.15, 18.7 | Idempotence sous concurrence ; similarité limitée à la clinique et jamais bloquante. | V-CDC-4.3-01 (F-4.3) |
| CDC-4.3-02 | §4.3, ligne 95 | - Avertissement non bloquant lorsqu'une commande semble similaire à une autre de la même clinique ; le dentiste peut consulter l'existante ou poursuivre. Aucune comparaison entre cliniques ni blocage fondé uniquement sur un nom de patient. | 9.6, 9.7, 10.15, 18.7 | Idempotence sous concurrence ; similarité limitée à la clinique et jamais bloquante. | V-CDC-4.3-02 (F-4.3) |
| CDC-5.1-01 | §5.1, ligne 105 | - `En attente` : soumission enregistrée, à décider manuellement par le laboratoire. | 3.5, 10.1, 10.2, 10.3, 9.9, 16.6, 20.4 | Automate exhaustif, décisions manuelles, correction explicitement renvoyée, blocage séparé du statut. | V-CDC-5.1-01 (F-5.1) |
| CDC-5.1-02 | §5.1, ligne 106 | - `Correction demandée` : motif de correction obligatoire, attente d'une action du dentiste. Il corrige informations et fichiers, puis renvoie explicitement ; retour `En attente`, nouvelle décision manuelle du laboratoire et e-mail au laboratoire. | 3.5, 10.1, 10.2, 10.3, 9.9, 16.6, 20.4 | Automate exhaustif, décisions manuelles, correction explicitement renvoyée, blocage séparé du statut. | V-CDC-5.1-02 (F-5.1) |
| CDC-5.1-03 | §5.1, ligne 107 | - `Refusée` : décision lab avec motif obligatoire, historique conservé, pas de réouverture directe. | 3.5, 10.1, 10.2, 10.3, 9.9, 16.6, 20.4 | Automate exhaustif, décisions manuelles, correction explicitement renvoyée, blocage séparé du statut. | V-CDC-5.1-03 (F-5.1) |
| CDC-5.1-04 | §5.1, ligne 108 | - `Acceptée` : acceptation manuelle d'une commande venant de la clinique ; acceptation automatique si commande créée par le laboratoire pour une clinique existante. | 3.5, 10.1, 10.2, 10.3, 9.9, 16.6, 20.4 | Automate exhaustif, décisions manuelles, correction explicitement renvoyée, blocage séparé du statut. | V-CDC-5.1-04 (F-5.1) |
| CDC-5.1-05 | §5.1, ligne 109 | - `En fabrication`, `Terminée`, `Livrée` : transitions manuelles selon permissions. `Terminée` = travail prêt, pas encore expédié/retiré. `Livrée` = travail physiquement sorti du laboratoire ou récupéré par la clinique, sans confirmation du dentiste. | 3.5, 10.1, 10.2, 10.3, 9.9, 16.6, 20.4 | Automate exhaustif, décisions manuelles, correction explicitement renvoyée, blocage séparé du statut. | V-CDC-5.1-05 (F-5.1) |
| CDC-5.1-06 | §5.1, ligne 110 | - Le changement de statut, ses dates et son auteur sont historisés. Ne pas confondre drapeaux de blocage de sécurité et statut métier ; une commande `En fabrication` bloquée demeure dans ce statut tant qu'une action métier valide n'est pas prise. | 3.5, 10.1, 10.2, 10.3, 9.9, 16.6, 20.4 | Automate exhaustif, décisions manuelles, correction explicitement renvoyée, blocage séparé du statut. | V-CDC-5.1-06 (F-5.1) |
| CDC-5.2-01 | §5.2, ligne 114 | - `En attente` : la clinique modifie directement formulaire, dents et fichiers, avec versions et historique. La commande reste `En attente` ; si le laboratoire lit une ancienne version, il doit recharger la dernière avant acceptation. | 3.4, 6.5, 6.6, 10.4, 10.5, 10.6, 10.10, 10.11, 10.15, 20.4 | Versions, demande pendante unique, version obsolète, verrouillage et absence de changement officiel via chat. | V-CDC-5.2-01 (F-5.2) |
| CDC-5.2-02 | §5.2, ligne 115 | - `Correction demandée` : la clinique peut corriger, sans retour automatique en attente ; renvoi explicite nécessaire. | 3.4, 6.5, 6.6, 10.4, 10.5, 10.6, 10.10, 10.11, 10.15, 20.4 | Versions, demande pendante unique, version obsolète, verrouillage et absence de changement officiel via chat. | V-CDC-5.2-02 (F-5.2) |
| CDC-5.2-03 | §5.2, ligne 116 | - `Acceptée` : la clinique peut soumettre une demande de modification proposant les valeurs avant/après ; l'original reste inchangé jusqu'à acceptation lab ; acceptation/refus motivé ou historisé et notifié par e-mail. | 3.4, 6.5, 6.6, 10.4, 10.5, 10.6, 10.10, 10.11, 10.15, 20.4 | Versions, demande pendante unique, version obsolète, verrouillage et absence de changement officiel via chat. | V-CDC-5.2-03 (F-5.2) |
| CDC-5.2-04 | §5.2, ligne 117 | - Une seule demande de modification ou d'annulation en attente au total par commande. La première doit être traitée ou retirée avant une autre demande. La demande peut être retirée par la clinique avant décision, avec confirmation et historique. Une demande pendante interdit le début de fabrication et interdit au laboratoire de modifier directement les instructions ; les opérations logistiques compatibles restent possibles. | 3.4, 6.5, 6.6, 10.4, 10.5, 10.6, 10.10, 10.11, 10.15, 20.4 | Versions, demande pendante unique, version obsolète, verrouillage et absence de changement officiel via chat. | V-CDC-5.2-04 (F-5.2) |
| CDC-5.2-05 | §5.2, ligne 118 | - Laboratoire : modification directe d'une commande `Acceptée` uniquement avant fabrication, permission adéquate, motif obligatoire, historique des versions, e-mail et notification interne à la clinique. Idem pour retouches. Une demande du dentiste pendante doit être résolue d'abord. | 3.4, 6.5, 6.6, 10.4, 10.5, 10.6, 10.10, 10.11, 10.15, 20.4 | Versions, demande pendante unique, version obsolète, verrouillage et absence de changement officiel via chat. | V-CDC-5.2-05 (F-5.2) |
| CDC-5.2-06 | §5.2, ligne 119 | - Dès le début de fabrication, les instructions et fichiers de fabrication sont verrouillés ; ils ne peuvent plus être écrasés ou remplacés. Les ajouts documentaires de suivi sont distincts (voir §8). | 3.4, 6.5, 6.6, 10.4, 10.5, 10.6, 10.10, 10.11, 10.15, 20.4 | Versions, demande pendante unique, version obsolète, verrouillage et absence de changement officiel via chat. | V-CDC-5.2-06 (F-5.2) |
| CDC-5.2-07 | §5.2, ligne 120 | - Les instructions contenues dans un message de chat ne changent jamais automatiquement la commande officielle. | 3.4, 6.5, 6.6, 10.4, 10.5, 10.6, 10.10, 10.11, 10.15, 20.4 | Versions, demande pendante unique, version obsolète, verrouillage et absence de changement officiel via chat. | V-CDC-5.2-07 (F-5.2) |
| CDC-5.3-01 | §5.3, ligne 124 | - Clinique : annulation directe avec confirmation en `En attente` et `Correction demandée` ; en `Acceptée`, demande nécessitant la décision du laboratoire ; aucune annulation directe par clinique dès `En fabrication`. | 9.10, 10.7, 10.8, 10.9, 10.15, 20.4 | Annulations selon acteur/statut, demande/retrait, motifs et duplication sous nouveau numéro. | V-CDC-5.3-01 (F-5.3) |
| CDC-5.3-02 | §5.3, ligne 125 | - Laboratoire : annulation directe possible jusqu'à `En fabrication` inclus, motif obligatoire, notification e-mail à la clinique, conservation des traces. Pas d'annulation ordinaire à `Terminée` ou `Livrée`. | 9.10, 10.7, 10.8, 10.9, 10.15, 20.4 | Annulations selon acteur/statut, demande/retrait, motifs et duplication sous nouveau numéro. | V-CDC-5.3-02 (F-5.3) |
| CDC-5.3-03 | §5.3, ligne 126 | - Demande d'annulation pendante bloque passage en fabrication ; retrait autorisé avant décision. | 9.10, 10.7, 10.8, 10.9, 10.15, 20.4 | Annulations selon acteur/statut, demande/retrait, motifs et duplication sous nouveau numéro. | V-CDC-5.3-03 (F-5.3) |
| CDC-5.3-04 | §5.3, ligne 127 | - Envoi d'une commande préremplie depuis une commande `Refusée` ou `Annulée` : nouveau numéro, statut `En attente`, lien de filiation, ancien historique inchangé ; revalidation de dates, référentiels et disponibilité réelle des fichiers. | 9.10, 10.7, 10.8, 10.9, 10.15, 20.4 | Annulations selon acteur/statut, demande/retrait, motifs et duplication sous nouveau numéro. | V-CDC-5.3-04 (F-5.3) |
| CDC-5.4-01 | §5.4, ligne 131 | - Création pour une clinique existante par utilisateur habilité ; origine clairement indiquée « Créée par le laboratoire », avec auteur. | 9.9, 14.4, 10.5, 10.8 | Création labo immédiatement acceptée, auteur/origine, e-mail et notification, demandes avant fabrication. | V-CDC-5.4-01 (F-5.4) |
| CDC-5.4-02 | §5.4, ligne 132 | - Statut immédiat `Acceptée`, sans approbation obligatoire de la clinique. | 9.9, 14.4, 10.5, 10.8 | Création labo immédiatement acceptée, auteur/origine, e-mail et notification, demandes avant fabrication. | V-CDC-5.4-02 (F-5.4) |
| CDC-5.4-03 | §5.4, ligne 133 | - Envoi d'un e-mail et d'une notification interne à la clinique, avec lien privé vers la commande et sans données patient excessives. | 9.9, 14.4, 10.5, 10.8 | Création labo immédiatement acceptée, auteur/origine, e-mail et notification, demandes avant fabrication. | V-CDC-5.4-03 (F-5.4) |
| CDC-5.4-04 | §5.4, ligne 134 | - La clinique peut demander modification ou annulation tant que le travail est `Acceptée`, avant `En fabrication`. | 9.9, 14.4, 10.5, 10.8 | Création labo immédiatement acceptée, auteur/origine, e-mail et notification, demandes avant fabrication. | V-CDC-5.4-04 (F-5.4) |
| CDC-5.5-01 | §5.5, ligne 138 | - Les instructions initiales restent verrouillées. Un utilisateur habilité crée une nouvelle commande liée ayant ses propres données, fichiers et numéro ; en tant que commande créée par le laboratoire, elle est immédiatement `Acceptée`. | 3.6, 6.6, 10.11, 10.12, 10.13, 10.15, 20.5 | Travail lié atomique, remplacement ou supplément, liens réciproques sans écraser les instructions. | V-CDC-5.5-01 (F-5.5) |
| CDC-5.5-02 | §5.5, ligne 139 | - Deux types explicites de lien : remplacement (l'ancienne commande est annulée, motif obligatoire) ou travail supplémentaire (l'ancienne commande continue). | 3.6, 6.6, 10.11, 10.12, 10.13, 10.15, 20.5 | Travail lié atomique, remplacement ou supplément, liens réciproques sans écraser les instructions. | V-CDC-5.5-02 (F-5.5) |
| CDC-5.5-03 | §5.5, ligne 140 | - Les liens sont visibles dans les deux sens ; les opérations sont atomiques autant que nécessaire pour éviter une filiation incomplète. | 3.6, 6.6, 10.11, 10.12, 10.13, 10.15, 20.5 | Travail lié atomique, remplacement ou supplément, liens réciproques sans écraser les instructions. | V-CDC-5.5-03 (F-5.5) |
| CDC-5.5-04 | §5.5, ligne 141 | - L'ancien travail n'est jamais réécrit silencieusement. Si la décision implique une interdiction de sécurité, le nouveau travail doit respecter les références autorisées. | 3.6, 6.6, 10.11, 10.12, 10.13, 10.15, 20.5 | Travail lié atomique, remplacement ou supplément, liens réciproques sans écraser les instructions. | V-CDC-5.5-04 (F-5.5) |
| CDC-6-01 | §6, ligne 145 | - Le dentiste ouvre une commande Livrée et sélectionne « Demander une retouche » ; possibilité de qualifier l'intervention (retouche ou refabrication). | 3.6, 6.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 14.5, 20.5 | Retouche du travail réellement livré, description obligatoire, sans FDI/finance, une active sous concurrence. | V-CDC-6-01 (F-6) |
| CDC-6-02 | §6, ligne 146 | - Nouvelle intervention liée à la commande livrée réellement concernée, même si cette commande est elle-même un remplacement ; traçabilité complète de la chaîne. | 3.6, 6.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 14.5, 20.5 | Retouche du travail réellement livré, description obligatoire, sans FDI/finance, une active sous concurrence. | V-CDC-6-02 (F-6) |
| CDC-6-03 | §6, ligne 147 | - Formulaire simplifié : matériau et teinte préremplis mais modifiables, description du problème et des dents concernées obligatoire, sans schéma dentaire, pièces jointes facultatives. | 3.6, 6.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 14.5, 20.5 | Retouche du travail réellement livré, description obligatoire, sans FDI/finance, une active sous concurrence. | V-CDC-6-03 (F-6) |
| CDC-6-04 | §6, ligne 148 | - La retouche est un travail distinct, avec numéro, conversation, historique et même workflow d'approbation, correction, modification, annulation, fabrication, livraison et verrouillage des instructions que les commandes normales. | 3.6, 6.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 14.5, 20.5 | Retouche du travail réellement livré, description obligatoire, sans FDI/finance, une active sous concurrence. | V-CDC-6-04 (F-6) |
| CDC-6-05 | §6, ligne 149 | - Nouvelle retouche signalée en priorité et e-mail au laboratoire ; acceptation/refus/correction manuels. | 3.6, 6.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 14.5, 20.5 | Retouche du travail réellement livré, description obligatoire, sans FDI/finance, une active sous concurrence. | V-CDC-6-05 (F-6) |
| CDC-6-06 | §6, ligne 150 | - Une seule retouche active par commande livrée ; une nouvelle devient possible quand la précédente est `Refusée`, `Annulée` ou `Livrée`. Une retouche refusée reste dans l'historique et une nouvelle demande peut être déposée sur le travail original. | 3.6, 6.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 14.5, 20.5 | Retouche du travail réellement livré, description obligatoire, sans FDI/finance, une active sous concurrence. | V-CDC-6-06 (F-6) |
| CDC-6-07 | §6, ligne 151 | - L'annulation d'une retouche ne change pas le statut du travail initial. Une commande historique annulée ou refusée ne peut pas recevoir de retouche. | 3.6, 6.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 14.5, 20.5 | Retouche du travail réellement livré, description obligatoire, sans FDI/finance, une active sous concurrence. | V-CDC-6-07 (F-6) |
| CDC-6-08 | §6, ligne 152 | - Tarification, garantie, prise en charge et coût de retouche : hors périmètre de la version initiale ; à traiter dans la phase financière future. | 3.6, 6.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 14.5, 20.5 | Retouche du travail réellement livré, description obligatoire, sans FDI/finance, une active sous concurrence. | V-CDC-6-08 (F-6) |
| CDC-7-01 | §7, ligne 156 | - Le laboratoire choisit le mode : livraison par laboratoire, retrait par clinique, coursier externe. | 10.14, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 20.7 | Planning, urgences sans e-mail, dates distinctes, livraisons en lot, correction bloquée avec retouche, filtres autorisés. | V-CDC-7-01 (F-7) |
| CDC-7-02 | §7, ligne 157 | - Vue « Prêts à livrer » = commandes `Terminée` non encore déclarées livrées ; marquage individuel ou multi-sélection après confirmation, uniquement sur commandes éligibles. | 10.14, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 20.7 | Planning, urgences sans e-mail, dates distinctes, livraisons en lot, correction bloquée avec retouche, filtres autorisés. | V-CDC-7-02 (F-7) |
| CDC-7-03 | §7, ligne 158 | - Date, mode et auteur de sortie du laboratoire enregistrés. La clinique ne confirme pas la livraison. Pas d'e-mail au dentiste lors de la livraison. | 10.14, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 20.7 | Planning, urgences sans e-mail, dates distinctes, livraisons en lot, correction bloquée avec retouche, filtres autorisés. | V-CDC-7-03 (F-7) |
| CDC-7-04 | §7, ligne 159 | - Erreur de livraison : le propriétaire ou un administrateur secondaire spécifiquement autorisé peut exceptionnellement revenir de `Livrée` à `Terminée`, avec motif et historique. Réouverture de la conversation, annulation de l'ancien compteur d'archivage. S'il existe une retouche liée, correction automatique bloquée jusqu'à résolution explicite de la contradiction. | 10.14, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 20.7 | Planning, urgences sans e-mail, dates distinctes, livraisons en lot, correction bloquée avec retouche, filtres autorisés. | V-CDC-7-04 (F-7) |
| CDC-7-05 | §7, ligne 160 | - Date souhaitée par la clinique et date planifiée par le laboratoire visibles et distinctes ; date planifiée modifiable sans approbation de la clinique, chaque changement historisé. | 10.14, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 20.7 | Planning, urgences sans e-mail, dates distinctes, livraisons en lot, correction bloquée avec retouche, filtres autorisés. | V-CDC-7-05 (F-7) |
| CDC-7-06 | §7, ligne 161 | - Alerte d'urgence à J-2 avant la date planifiée et alerte de retard après ; à défaut, date souhaitée comme repère provisoire. Drapeau de priorité manuel. Les alertes de progression cessent pour les travaux clôturés (`Livrée`, `Refusée`, `Annulée`). Pas d'e-mails automatiques pour ces alertes. | 10.14, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 20.7 | Planning, urgences sans e-mail, dates distinctes, livraisons en lot, correction bloquée avec retouche, filtres autorisés. | V-CDC-7-06 (F-7) |
| CDC-7-07 | §7, ligne 162 | - Calendrier hebdomadaire et mensuel : travail positionné sur date planifiée, sinon souhaitée (provisoire) ; ouverture détail en un clic. Glisser-déposer sur desktop pour modifier seulement date planifiée avec confirmation/annulation et trace ; édition détaillée sur mobile. | 10.14, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 20.7 | Planning, urgences sans e-mail, dates distinctes, livraisons en lot, correction bloquée avec retouche, filtres autorisés. | V-CDC-7-07 (F-7) |
| CDC-7-08 | §7, ligne 163 | - Liste des travaux : recherche par patient (nom ou référence), clinique, numéro ; filtres statut, date, normal/retouche ; pas de filtre matériau prévu. | 10.14, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 20.7 | Planning, urgences sans e-mail, dates distinctes, livraisons en lot, correction bloquée avec retouche, filtres autorisés. | V-CDC-7-08 (F-7) |
| CDC-7-09 | §7, ligne 164 | - Vue principale laboratoire : boîte de réception prioritaire pour nouvelles commandes, demandes de correction renvoyées, modifications, annulations, retouches et inscriptions, avec distinction entre notification lue et action restant à traiter. Liste simple, peu de colonnes. | 10.14, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 20.7 | Planning, urgences sans e-mail, dates distinctes, livraisons en lot, correction bloquée avec retouche, filtres autorisés. | V-CDC-7-09 (F-7) |
| CDC-8-01 | §8, ligne 168 | - Fichiers de fabrication : versions officielles attachées à une commande, modifiables seulement avant `En fabrication` suivant les règles métier, ensuite verrouillés ; versions retirées non disponibles comme instructions actives, éventuelle conservation selon politique légale. | 3.7, 12.1, 12.9, 12.10, 12.11, 12.12, 12.13, 18.1 | Originaux verrouillés, suivi interne par défaut, partage unitaire révocable, ZIP limité aux fichiers autorisés. | V-CDC-8-01 (F-8) |
| CDC-8-02 | §8, ligne 169 | - Fichiers de suivi : documents/photos ajoutés par le laboratoire, séparés des instructions, y compris pendant et après fabrication ; auteur, date, droits et conservation tracés. | 3.7, 12.1, 12.9, 12.10, 12.11, 12.12, 12.13, 18.1 | Originaux verrouillés, suivi interne par défaut, partage unitaire révocable, ZIP limité aux fichiers autorisés. | V-CDC-8-02 (F-8) |
| CDC-8-03 | §8, ligne 170 | - Visibilité des fichiers de suivi : interne au laboratoire par défaut ; un utilisateur habilité peut partager individuellement avec la clinique, après confirmation ; partage révocable pour les accès futurs, mais aucune promesse de suppression des copies déjà téléchargées. | 3.7, 12.1, 12.9, 12.10, 12.11, 12.12, 12.13, 18.1 | Originaux verrouillés, suivi interne par défaut, partage unitaire révocable, ZIP limité aux fichiers autorisés. | V-CDC-8-03 (F-8) |
| CDC-8-04 | §8, ligne 171 | - Chaque fichier est soumis à authentification, autorisation et isolation par clinique, sans URL publique permanente ni partage externe anonyme. Le stockage n'expose pas directement les fichiers via un répertoire web public. | 3.7, 12.1, 12.9, 12.10, 12.11, 12.12, 12.13, 18.1 | Originaux verrouillés, suivi interne par défaut, partage unitaire révocable, ZIP limité aux fichiers autorisés. | V-CDC-8-04 (F-8) |
| CDC-8-05 | §8, ligne 172 | - Téléchargement individuel et ZIP de tous les fichiers autorisés de la commande, sans contourner les droits ni conserver inutilement des archives permanentes. ZIP non destructif : contenu extrait identique aux originaux. | 3.7, 12.1, 12.9, 12.10, 12.11, 12.12, 12.13, 18.1 | Originaux verrouillés, suivi interne par défaut, partage unitaire révocable, ZIP limité aux fichiers autorisés. | V-CDC-8-05 (F-8) |
| CDC-8-06 | §8, ligne 173 | - Séparer juridiquement et techniquement les fichiers de commande, messagerie, suivi, transferts temporaires, brouillons et archives. Une interdiction d'accès doit aussi s'appliquer aux aperçus, noms, miniatures, moteurs de recherche et téléchargements en masse. | 3.7, 12.1, 12.9, 12.10, 12.11, 12.12, 12.13, 18.1 | Originaux verrouillés, suivi interne par défaut, partage unitaire révocable, ZIP limité aux fichiers autorisés. | V-CDC-8-06 (F-8) |
| CDC-9-01 | §9, ligne 177 | - Une conversation générale permanente par clinique, indépendante des commandes, possible sans commande préalable. | 6.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 17.6, 17.13, 20.6 | Conversations séparées, non-lus/Lu, versions, droits d’auteur, clôture/réouverture et absence de décision métier via chat. | V-CDC-9-01 (F-9) |
| CDC-9-02 | §9, ligne 178 | - Une conversation distincte par commande, y compris chaque retouche, accessible depuis sa fiche ; ne pas mélanger les conversations de différentes commandes. | 6.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 17.6, 17.13, 20.6 | Conversations séparées, non-lus/Lu, versions, droits d’auteur, clôture/réouverture et absence de décision métier via chat. | V-CDC-9-02 (F-9) |
| CDC-9-03 | §9, ligne 179 | - Interface type messagerie moderne, quasi temps réel, pièces jointes selon §4.2, compteurs de messages non lus, statuts `Envoyé` et `Lu`. | 6.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 17.6, 17.13, 20.6 | Conversations séparées, non-lus/Lu, versions, droits d’auteur, clôture/réouverture et absence de décision métier via chat. | V-CDC-9-03 (F-9) |
| CDC-9-04 | §9, ligne 180 | - Lecture d'une conversation partagée côté laboratoire constatée lorsqu'un utilisateur autorisé l'ouvre ; la lecture ne vaut pas traitement métier. | 6.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 17.6, 17.13, 20.6 | Conversations séparées, non-lus/Lu, versions, droits d’auteur, clôture/réouverture et absence de décision métier via chat. | V-CDC-9-04 (F-9) |
| CDC-9-05 | §9, ligne 181 | - Édition des messages avec indication « Modifié » et conservation des versions ; suppression apparente/masquage avec traçabilité, pas d'effacement silencieux. Un utilisateur ne réécrit pas les messages d'un autre. Les exigences légales de conservation priment. | 6.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 17.6, 17.13, 20.6 | Conversations séparées, non-lus/Lu, versions, droits d’auteur, clôture/réouverture et absence de décision métier via chat. | V-CDC-9-05 (F-9) |
| CDC-9-06 | §9, ligne 182 | - À `Livrée`, conversation de commande automatiquement close en lecture seule ; reste accessible selon permissions ; nouvelle retouche = nouvelle conversation. Conversation générale toujours active. Si livraison erronée corrigée selon §7, conversation rouverte si aucune contradiction avec une retouche existante. | 6.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 17.6, 17.13, 20.6 | Conversations séparées, non-lus/Lu, versions, droits d’auteur, clôture/réouverture et absence de décision métier via chat. | V-CDC-9-06 (F-9) |
| CDC-9-07 | §9, ligne 183 | - Fichiers : jusqu'à 200 Mo chacun, 1 Go par message, pas de quota cumulatif fixe par conversation ; surveillance de capacité et protection contre l'abus. | 6.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 17.6, 17.13, 20.6 | Conversations séparées, non-lus/Lu, versions, droits d’auteur, clôture/réouverture et absence de décision métier via chat. | V-CDC-9-07 (F-9) |
| CDC-9-08 | §9, ligne 184 | - Les messages ne remplacent jamais les demandes formelles de modification/cancellation ni les instructions officielles. | 6.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 17.6, 17.13, 20.6 | Conversations séparées, non-lus/Lu, versions, droits d’auteur, clôture/réouverture et absence de décision métier via chat. | V-CDC-9-08 (F-9) |
| CDC-9-09 | §9, ligne 185 | - Demandes d'accès, rectification, effacement de données : formulées par la clinique via messagerie générale, traitées par le propriétaire sans module dédié de tickets ; contact externe possible pour patients sans compte. La procédure interne doit garantir le traitement légal même sans outil de suivi automatisé. | 6.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 17.6, 17.13, 20.6 | Conversations séparées, non-lus/Lu, versions, droits d’auteur, clôture/réouverture et absence de décision métier via chat. | V-CDC-9-09 (F-9) |
| CDC-9-10 | §9, ligne 186 | - Signalement de sécurité : via messagerie générale pour cliniques ; contact direct propriétaire pour employés et administrateurs secondaires ; informations de contact disponibles sans connexion si l'application le permet. | 6.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 17.6, 17.13, 20.6 | Conversations séparées, non-lus/Lu, versions, droits d’auteur, clôture/réouverture et absence de décision métier via chat. | V-CDC-9-10 (F-9) |
| CDC-10.1-01 | §10.1, ligne 194 | 1. Nouvelle commande. | 3.9, 14.1, 14.2, 14.5 | Six déclencheurs et destinataires exacts, propriétaire par défaut, pas d’envoi automatique hors matrice. | V-CDC-10.1-01 (F-10.1) |
| CDC-10.1-02 | §10.1, ligne 195 | 2. Nouvelle demande d'inscription de clinique. | 3.9, 14.1, 14.2, 14.5 | Six déclencheurs et destinataires exacts, propriétaire par défaut, pas d’envoi automatique hors matrice. | V-CDC-10.1-02 (F-10.1) |
| CDC-10.1-03 | §10.1, ligne 196 | 3. Demande de modification. | 3.9, 14.1, 14.2, 14.5 | Six déclencheurs et destinataires exacts, propriétaire par défaut, pas d’envoi automatique hors matrice. | V-CDC-10.1-03 (F-10.1) |
| CDC-10.1-04 | §10.1, ligne 197 | 4. Demande d'annulation. | 3.9, 14.1, 14.2, 14.5 | Six déclencheurs et destinataires exacts, propriétaire par défaut, pas d’envoi automatique hors matrice. | V-CDC-10.1-04 (F-10.1) |
| CDC-10.1-05 | §10.1, ligne 198 | 5. Nouvelle demande de retouche. | 3.9, 14.1, 14.2, 14.5 | Six déclencheurs et destinataires exacts, propriétaire par défaut, pas d’envoi automatique hors matrice. | V-CDC-10.1-05 (F-10.1) |
| CDC-10.1-06 | §10.1, ligne 199 | 6. Commande corrigée et renvoyée. | 3.9, 14.1, 14.2, 14.5 | Six déclencheurs et destinataires exacts, propriétaire par défaut, pas d’envoi automatique hors matrice. | V-CDC-10.1-06 (F-10.1) |
| CDC-10.2-01 | §10.2, ligne 205 | - Acceptation d'une commande, demande de correction, refus, travail terminé. | 3.9, 14.1, 14.4, 14.9, 20.10 | Déclencheurs cliniques exacts, retouches équivalentes, exclusions et absence de données patient dans les mails. | V-CDC-10.2-01 (F-10.2) |
| CDC-10.2-02 | §10.2, ligne 206 | - Décisions d'acceptation/refus des modifications et des demandes d'annulation. | 3.9, 14.1, 14.4, 14.9, 20.10 | Déclencheurs cliniques exacts, retouches équivalentes, exclusions et absence de données patient dans les mails. | V-CDC-10.2-02 (F-10.2) |
| CDC-10.2-03 | §10.2, ligne 207 | - Annulation directe par le laboratoire, modification directe d'instructions par le laboratoire avant fabrication. | 3.9, 14.1, 14.4, 14.9, 20.10 | Déclencheurs cliniques exacts, retouches équivalentes, exclusions et absence de données patient dans les mails. | V-CDC-10.2-03 (F-10.2) |
| CDC-10.2-04 | §10.2, ligne 208 | - Création d'une commande au nom de la clinique par le laboratoire (e-mail et notification interne). | 3.9, 14.1, 14.4, 14.9, 20.10 | Déclencheurs cliniques exacts, retouches équivalentes, exclusions et absence de données patient dans les mails. | V-CDC-10.2-04 (F-10.2) |
| CDC-10.2-05 | §10.2, ligne 209 | - Notifications équivalentes des retouches lorsqu'applicables. | 3.9, 14.1, 14.4, 14.9, 20.10 | Déclencheurs cliniques exacts, retouches équivalentes, exclusions et absence de données patient dans les mails. | V-CDC-10.2-05 (F-10.2) |
| CDC-10.2-06 | §10.2, ligne 210 | - Pas d'e-mail systématique pour nouvelle commande soumise par la clinique, entrée en fabrication, livraison, urgence interne, ou annonce de maintenance. | 3.9, 14.1, 14.4, 14.9, 20.10 | Déclencheurs cliniques exacts, retouches équivalentes, exclusions et absence de données patient dans les mails. | V-CDC-10.2-06 (F-10.2) |
| CDC-10.2-07 | §10.2, ligne 211 | - Les changements d'adresse e-mail déclenchent des avis de sécurité à l'ancienne adresse suivant §2.2. | 3.9, 14.1, 14.4, 14.9, 20.10 | Déclencheurs cliniques exacts, retouches équivalentes, exclusions et absence de données patient dans les mails. | V-CDC-10.2-07 (F-10.2) |
| CDC-10.3-01 | §10.3, ligne 215 | - Notification temps réel si connecté. | 13.5, 14.6, 20.6 | Horloge simulée : 30 min, puis au moins 24 h avec nouveaux messages non lus ; lecture complète réinitialise. | V-CDC-10.3-01 (F-10.3) |
| CDC-10.3-02 | §10.3, ligne 216 | - Rappel e-mail si conversation contient toujours des messages non lus 30 minutes après réception. | 13.5, 14.6, 20.6 | Horloge simulée : 30 min, puis au moins 24 h avec nouveaux messages non lus ; lecture complète réinitialise. | V-CDC-10.3-02 (F-10.3) |
| CDC-10.3-03 | §10.3, ligne 217 | - Pour la même période continue de non-lecture, rappel supplémentaire au moins 24 heures après le précédent, seulement si de nouveaux messages sont arrivés depuis le précédent rappel et sont restés non lus 30 minutes. | 13.5, 14.6, 20.6 | Horloge simulée : 30 min, puis au moins 24 h avec nouveaux messages non lus ; lecture complète réinitialise. | V-CDC-10.3-03 (F-10.3) |
| CDC-10.3-04 | §10.3, ligne 218 | - Lecture complète réinitialise le cycle ; regrouper les arrivées proches dans un seul e-mail. Aucune donnée patient sensible dans le contenu du rappel. Appliquer les droits et destinataires pertinents pour les boîtes de messagerie partagées. | 13.5, 14.6, 20.6 | Horloge simulée : 30 min, puis au moins 24 h avec nouveaux messages non lus ; lecture complète réinitialise. | V-CDC-10.3-04 (F-10.3) |
| CDC-10.4-01 | §10.4, ligne 222 | - Une transaction métier réussie ne dépend jamais de l'envoi immédiat d'un e-mail. | 6.9, 14.3, 14.7, 14.8, 20.10 | Panne fournisseur indépendante de la transaction, retries/dédoublonnage, obsolescence et alertes indépendantes. | V-CDC-10.4-01 (F-10.4) |
| CDC-10.4-02 | §10.4, ligne 223 | - Envois en attente, acceptés par le fournisseur, échoués ; relances automatiques progressives, possibilité de consultation et de relance manuelle par le propriétaire. | 6.9, 14.3, 14.7, 14.8, 20.10 | Panne fournisseur indépendante de la transaction, retries/dédoublonnage, obsolescence et alertes indépendantes. | V-CDC-10.4-02 (F-10.4) |
| CDC-10.4-03 | §10.4, ligne 224 | - Éviter les doublons autant que possible ; un statut `Envoyé` ne garantit ni réception ni lecture. | 6.9, 14.3, 14.7, 14.8, 20.10 | Panne fournisseur indépendante de la transaction, retries/dédoublonnage, obsolescence et alertes indépendantes. | V-CDC-10.4-03 (F-10.4) |
| CDC-10.4-04 | §10.4, ligne 225 | - Réévaluer l'utilité d'une notification avant un envoi très tardif lorsque son action a déjà été traitée. | 6.9, 14.3, 14.7, 14.8, 20.10 | Panne fournisseur indépendante de la transaction, retries/dédoublonnage, obsolescence et alertes indépendantes. | V-CDC-10.4-04 (F-10.4) |
| CDC-10.4-05 | §10.4, ligne 226 | - Alertes techniques critiques indépendantes des e-mails métier, propriétaire systématiquement destinataire. | 6.9, 14.3, 14.7, 14.8, 20.10 | Panne fournisseur indépendante de la transaction, retries/dédoublonnage, obsolescence et alertes indépendantes. | V-CDC-10.4-05 (F-10.4) |
| CDC-11-01 | §11, ligne 230 | - PWA installable et responsive : smartphone, tablette (usage principal) et ordinateur. Interface exclusivement en albanais ; dates `JJ/MM/AAAA`, fuseau `Europe/Pristina` ; labels techniques de matériaux/teintes conservés. | 3.8, 7.1, 7.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 20.8 | Appareils réels, brouillons chiffrés isolés par compte, quotas, conflits avec fichiers, envoi explicite, pas de cache commandes officielles. | V-CDC-11-01 (F-11) |
| CDC-11-02 | §11, ligne 231 | - Connexion par e-mail/mot de passe ; pas de 2FA obligatoire retenue. Mots de passe protégés, limitation des tentatives, anti-abus, cookies/sessions sûrs, possibilité de sessions simultanées et de révocation ; authentification persistante avec renouvellement sécurisé, non « connexion éternelle ». | 3.8, 7.1, 7.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 20.8 | Appareils réels, brouillons chiffrés isolés par compte, quotas, conflits avec fichiers, envoi explicite, pas de cache commandes officielles. | V-CDC-11-02 (F-11) |
| CDC-11-03 | §11, ligne 232 | - Préparation hors ligne de brouillons complets, fichiers inclus, avec données de catalogue précédemment chargées ; pas d'envoi officiel hors connexion. | 3.8, 7.1, 7.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 20.8 | Appareils réels, brouillons chiffrés isolés par compte, quotas, conflits avec fichiers, envoi explicite, pas de cache commandes officielles. | V-CDC-11-03 (F-11) |
| CDC-11-04 | §11, ligne 233 | - Protection forte du stockage local des brouillons, déverrouillage local supplémentaire et isolation par compte ; chiffrage effectif à concevoir et tester sur les navigateurs visés, sans présumer que les protections de la PWA suffisent. | 3.8, 7.1, 7.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 20.8 | Appareils réels, brouillons chiffrés isolés par compte, quotas, conflits avec fichiers, envoi explicite, pas de cache commandes officielles. | V-CDC-11-04 (F-11) |
| CDC-11-05 | §11, ligne 234 | - Déconnexion volontaire : conserver les brouillons locaux protégés, accessibles uniquement au retour du même compte et après déverrouillage. | 3.8, 7.1, 7.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 20.8 | Appareils réels, brouillons chiffrés isolés par compte, quotas, conflits avec fichiers, envoi explicite, pas de cache commandes officielles. | V-CDC-11-05 (F-11) |
| CDC-11-06 | §11, ligne 235 | - Suspension du compte hors ligne : impossibilité de révoquer immédiatement les données sur un appareil déconnecté ; à la reconnexion, refuser l'accès et demander la purge locale des brouillons/fichiers associés au compte suspendu, au mieux des possibilités du système. Pas de garantie d'effacement forensic à distance. | 3.8, 7.1, 7.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 20.8 | Appareils réels, brouillons chiffrés isolés par compte, quotas, conflits avec fichiers, envoi explicite, pas de cache commandes officielles. | V-CDC-11-06 (F-11) |
| CDC-11-07 | §11, ligne 236 | - Brouillons synchronisés sur serveur pour reprise multi-appareils, sans envoi automatique. Détecter versions divergentes : permettre de prendre la version serveur ou conserver la version locale sous un nouveau brouillon, pièces jointes comprises. Pas d'écrasement silencieux. Avertir avant abandon éventuel d'une version locale. | 3.8, 7.1, 7.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 20.8 | Appareils réels, brouillons chiffrés isolés par compte, quotas, conflits avec fichiers, envoi explicite, pas de cache commandes officielles. | V-CDC-11-07 (F-11) |
| CDC-11-08 | §11, ligne 237 | - Brouillons supprimables manuellement ; pas de purge par âge des brouillons métier demandée, sous réserve des obligations de minimisation/rétention à valider. Les transferts temporaires expirés suivent une règle de nettoyage distincte. | 3.8, 7.1, 7.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 20.8 | Appareils réels, brouillons chiffrés isolés par compte, quotas, conflits avec fichiers, envoi explicite, pas de cache commandes officielles. | V-CDC-11-08 (F-11) |
| CDC-11-09 | §11, ligne 238 | - Reconnexion : mise à jour du catalogue, contrôles métier, avertissements pour références indisponibles, refus des références interdites ; le dentiste valide toujours explicitement la soumission. | 3.8, 7.1, 7.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 20.8 | Appareils réels, brouillons chiffrés isolés par compte, quotas, conflits avec fichiers, envoi explicite, pas de cache commandes officielles. | V-CDC-11-09 (F-11) |
| CDC-11-10 | §11, ligne 239 | - Ordre recommandé : transferts temporaires vérifiés, confirmation finale, enregistrement serveur unique/atomique de la commande, acquittement ; conserver le brouillon local jusqu'à confirmation certaine. | 3.8, 7.1, 7.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 20.8 | Appareils réels, brouillons chiffrés isolés par compte, quotas, conflits avec fichiers, envoi explicite, pas de cache commandes officielles. | V-CDC-11-10 (F-11) |
| CDC-11-11 | §11, ligne 240 | - Les commandes déjà officiellement envoyées et leurs pièces jointes ne sont pas conservées automatiquement hors ligne dans la PWA. Consultation de leurs fichiers via connexion au serveur. Les fichiers téléchargés volontairement dans le système d'exploitation restent hors contrôle de l'application. | 3.8, 7.1, 7.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 20.8 | Appareils réels, brouillons chiffrés isolés par compte, quotas, conflits avec fichiers, envoi explicite, pas de cache commandes officielles. | V-CDC-11-11 (F-11) |
| CDC-12-01 | §12, ligne 244 | - Transferts par portions avec reprise des segments déjà reçus et vérifiés tant que les données temporaires existent ; reprise après coupure réseau ou interruption liée au manque d'espace ; progression visible. | 12.5, 12.6, 12.7, 12.8, 14.8, 19.1, 19.2, 19.8, 20.9 | Pause/reprise, seuils et TTL à décider, réserve indépendante, consultation préservée, aucune purge des fichiers historiques. | V-CDC-12-01 (F-12) |
| CDC-12-02 | §12, ligne 245 | - Aucune commande officielle créée en double après reconnexion ; confirmation finale explicite. | 12.5, 12.6, 12.7, 12.8, 14.8, 19.1, 19.2, 19.8, 20.9 | Pause/reprise, seuils et TTL à décider, réserve indépendante, consultation préservée, aucune purge des fichiers historiques. | V-CDC-12-02 (F-12) |
| CDC-12-03 | §12, ligne 246 | - Refus temporaire des nouveaux transferts à l'approche d'une réserve de stockage de sécurité ; alertes préventives au propriétaire, message explicite aux utilisateurs ; consultation des données existantes préservée dans la mesure où le service reste fonctionnel. | 12.5, 12.6, 12.7, 12.8, 14.8, 19.1, 19.2, 19.8, 20.9 | Pause/reprise, seuils et TTL à décider, réserve indépendante, consultation préservée, aucune purge des fichiers historiques. | V-CDC-12-03 (F-12) |
| CDC-12-04 | §12, ligne 247 | - Les portions temporaires interrompues sont gardées dans des limites bornées en durée et capacité, puis nettoyées si expirées. Les brouillons locaux ne sont pas détruits par cette opération. | 12.5, 12.6, 12.7, 12.8, 14.8, 19.1, 19.2, 19.8, 20.9 | Pause/reprise, seuils et TTL à décider, réserve indépendante, consultation préservée, aucune purge des fichiers historiques. | V-CDC-12-04 (F-12) |
| CDC-12-05 | §12, ligne 248 | - Protection de la base de données, du système, des autres sites/services du VPS et des sauvegardes ; surveillance indépendante de l'application, car une panne disque peut rendre le portail indisponible. | 12.5, 12.6, 12.7, 12.8, 14.8, 19.1, 19.2, 19.8, 20.9 | Pause/reprise, seuils et TTL à décider, réserve indépendante, consultation préservée, aucune purge des fichiers historiques. | V-CDC-12-05 (F-12) |
| CDC-12-06 | §12, ligne 249 | - Afficher l'espace occupé et capacité disponible réelle dans l'administration ; seuils, politique de nettoyage temporaire, dimensionnement, éventuel stockage déporté : à fixer après audit du VPS et de `architecture.md`. | 12.5, 12.6, 12.7, 12.8, 14.8, 19.1, 19.2, 19.8, 20.9 | Pause/reprise, seuils et TTL à décider, réserve indépendante, consultation préservée, aucune purge des fichiers historiques. | V-CDC-12-06 (F-12) |
| CDC-12-07 | §12, ligne 250 | - Aucune purge automatique des fichiers déjà attachés à des travaux pour résoudre un manque d'espace. | 12.5, 12.6, 12.7, 12.8, 14.8, 19.1, 19.2, 19.8, 20.9 | Pause/reprise, seuils et TTL à décider, réserve indépendante, consultation préservée, aucune purge des fichiers historiques. | V-CDC-12-07 (F-12) |
| CDC-13.1-01 | §13.1, ligne 256 | - Accueil prioritaire orienté actions à traiter, distinct des notifications lues : commandes à décider, demandes de modification, annulation, retouches, corrections renvoyées, inscriptions, alertes importantes. | 4.2, 4.6, 4.10, 4.13, 10.14, 13.8, 16.1, 17.1 | Parcours laboratoire/actions à traiter, permissions, fichiers, clinique, planning et paramètres sans dashboard financier. | V-CDC-13.1-01 (F-13.1) |
| CDC-13.1-02 | §13.1, ligne 257 | - Liste Travaux, filtres et recherche (§7), fiche de commande claire : informations, schéma dentaire, pièces jointes, conversation, historique, décisions disponibles et liens vers travaux liés. | 4.2, 4.6, 4.10, 4.13, 10.14, 13.8, 16.1, 17.1 | Parcours laboratoire/actions à traiter, permissions, fichiers, clinique, planning et paramètres sans dashboard financier. | V-CDC-13.1-02 (F-13.1) |
| CDC-13.1-03 | §13.1, ligne 258 | - Vue des travaux prêts à livrer, calendrier, fiches cliniques avec coordonnées/historique/conversation générale, messagerie unifiée et compteurs non lus. | 4.2, 4.6, 4.10, 4.13, 10.14, 13.8, 16.1, 17.1 | Parcours laboratoire/actions à traiter, permissions, fichiers, clinique, planning et paramètres sans dashboard financier. | V-CDC-13.1-03 (F-13.1) |
| CDC-13.1-04 | §13.1, ligne 259 | - Paramètres : gestion des référentiels, informations du laboratoire, utilisateurs/permissions, destinataires d'e-mails, annonces de maintenance, stockage. Journal d'audit intégral et incidents d'envoi accessibles au propriétaire. | 4.2, 4.6, 4.10, 4.13, 10.14, 13.8, 16.1, 17.1 | Parcours laboratoire/actions à traiter, permissions, fichiers, clinique, planning et paramètres sans dashboard financier. | V-CDC-13.1-04 (F-13.1) |
| CDC-13.1-05 | §13.1, ligne 260 | - Pas de tableaux de bord financiers ni surabondance de métriques. | 4.2, 4.6, 4.10, 4.13, 10.14, 13.8, 16.1, 17.1 | Parcours laboratoire/actions à traiter, permissions, fichiers, clinique, planning et paramètres sans dashboard financier. | V-CDC-13.1-05 (F-13.1) |
| CDC-13.2-01 | §13.2, ligne 264 | - Inscription / attente de validation, connexion et récupération de mot de passe. | 4.3, 4.5, 4.7, 4.8, 4.9, 4.12, 7.3, 9.8, 11.1, 15.10 | Parcours clinique tactile albanais, étapes authentification/commande/retouche/messages/brouillons et indication réseau. | V-CDC-13.2-01 (F-13.2) |
| CDC-13.2-02 | §13.2, ligne 265 | - Création et consultation des commandes, brouillons synchronisés et hors ligne, suivi des statuts et dates, modifications/corrections/annulations selon conditions, duplications de commandes refusées/annulées, retouches depuis travaux livrés. | 4.3, 4.5, 4.7, 4.8, 4.9, 4.12, 7.3, 9.8, 11.1, 15.10 | Parcours clinique tactile albanais, étapes authentification/commande/retouche/messages/brouillons et indication réseau. | V-CDC-13.2-02 (F-13.2) |
| CDC-13.2-03 | §13.2, ligne 266 | - Conversations générales et par travail, fichiers autorisés, notifications, coordonnées du laboratoire, documents légaux. | 4.3, 4.5, 4.7, 4.8, 4.9, 4.12, 7.3, 9.8, 11.1, 15.10 | Parcours clinique tactile albanais, étapes authentification/commande/retouche/messages/brouillons et indication réseau. | V-CDC-13.2-03 (F-13.2) |
| CDC-13.2-04 | §13.2, ligne 267 | - Interface optimisée tactile et en albanais, indication claire des opérations nécessitant une connexion. | 4.3, 4.5, 4.7, 4.8, 4.9, 4.12, 7.3, 9.8, 11.1, 15.10 | Parcours clinique tactile albanais, étapes authentification/commande/retouche/messages/brouillons et indication réseau. | V-CDC-13.2-04 (F-13.2) |
| CDC-14-01 | §14, ligne 271 | - Une commande `Livrée` est automatiquement archivée 30 jours après la livraison effective. Ce délai est une règle d'organisation de l'interface, non une durée légale de conservation. | 3.10, 16.7, 16.8, 16.9, 17.3, 17.6, 17.12, 19.9, 19.10, 20.7 | Archivage UI J+30 distinct de la rétention, exceptions et effacement autorisé, restauration sans réapparition durable. | V-CDC-14-01 (F-14) |
| CDC-14-02 | §14, ligne 272 | - Archives consultables et recherchables par utilisateurs habilités ; statut `Livrée` inchangé, pièces jointes, conversations et historique préservés selon leurs règles de conservation. Une retouche peut être initiée depuis une commande livrée archivée. | 3.10, 16.7, 16.8, 16.9, 17.3, 17.6, 17.12, 19.9, 19.10, 20.7 | Archivage UI J+30 distinct de la rétention, exceptions et effacement autorisé, restauration sans réapparition durable. | V-CDC-14-02 (F-14) |
| CDC-14-03 | §14, ligne 273 | - Correction exceptionnelle de livraison : annuler l'échéance d'archivage en cours ; repartir de la livraison réelle suivante. | 3.10, 16.7, 16.8, 16.9, 17.3, 17.6, 17.12, 19.9, 19.10, 20.7 | Archivage UI J+30 distinct de la rétention, exceptions et effacement autorisé, restauration sans réapparition durable. | V-CDC-14-03 (F-14) |
| CDC-14-04 | §14, ligne 274 | - En fin de durée légale ou contractuellement justifiée, les données concernées sont signalées au propriétaire avant effacement ou anonymisation, sous réserve d'exceptions légales (litige, traçabilité, obligation de conservation). Historiser les décisions sans conserver indûment les données à supprimer. | 3.10, 16.7, 16.8, 16.9, 17.3, 17.6, 17.12, 19.9, 19.10, 20.7 | Archivage UI J+30 distinct de la rétention, exceptions et effacement autorisé, restauration sans réapparition durable. | V-CDC-14-04 (F-14) |
| CDC-14-05 | §14, ligne 275 | - Distinguer les durées par catégories : commandes, documents médicaux et pièces jointes, conversations, sauvegardes, brouillons locaux/serveur, fichiers temporaires et audits. Aucune durée légale universelle n'est présumée ici. | 3.10, 16.7, 16.8, 16.9, 17.3, 17.6, 17.12, 19.9, 19.10, 20.7 | Archivage UI J+30 distinct de la rétention, exceptions et effacement autorisé, restauration sans réapparition durable. | V-CDC-14-05 (F-14) |
| CDC-14-06 | §14, ligne 276 | - Sauvegardes : conservation décidée de 30 jours, avec une politique de rotation compatible avec RPO et restauration ; gestion des suppressions légitimes après restauration (éviter la réapparition durable de données effacées). | 3.10, 16.7, 16.8, 16.9, 17.3, 17.6, 17.12, 19.9, 19.10, 20.7 | Archivage UI J+30 distinct de la rétention, exceptions et effacement autorisé, restauration sans réapparition durable. | V-CDC-14-06 (F-14) |
| CDC-14-07 | §14, ligne 277 | - Droit des personnes : procédure hors application possible pour les patients ; demandes des cliniques via messagerie générale, sans formulaire ni suivi de tickets spécifiques. Identité, autorité, fondement et délais applicables doivent être gérés selon une procédure interne. | 3.10, 16.7, 16.8, 16.9, 17.3, 17.6, 17.12, 19.9, 19.10, 20.7 | Archivage UI J+30 distinct de la rétention, exceptions et effacement autorisé, restauration sans réapparition durable. | V-CDC-14-07 (F-14) |
| CDC-14-08 | §14, ligne 278 | - Usages autorisés des données patients : fabrication, suivi des commandes, communication professionnelle, retouches, traçabilité nécessaire ; pas d'utilisation marketing ou revente. | 3.10, 16.7, 16.8, 16.9, 17.3, 17.6, 17.12, 19.9, 19.10, 20.7 | Archivage UI J+30 distinct de la rétention, exceptions et effacement autorisé, restauration sans réapparition durable. | V-CDC-14-08 (F-14) |
| CDC-15-01 | §15, ligne 282 | - Auditer les actions importantes : créations/acceptations/refus, modifications de versions, décisions, annulations, retouches, livraisons et corrections de livraison ; comptes, permissions, suspensions et reprises d'accès ; catalogues et interdictions ; authentifications sensibles ; paramètres, activation/désactivation maintenance, interventions techniques exceptionnelles. | 5.8, 7.13, 7.14, 17.1, 17.2, 17.13, 18.1, 18.2, 18.8, 20.2 | Audit global propriétaire seul non modifiable, données minimales, incident, limites compte partagé et protections sans 2FA imposée. | V-CDC-15-01 (F-15) |
| CDC-15-02 | §15, ligne 283 | - Chaque événement : auteur/compte ou processus, horodatage, action, identifiant d'objet, motif et différence utile sans enregistrer inutilement des données médicales ou secrets. | 5.8, 7.13, 7.14, 17.1, 17.2, 17.13, 18.1, 18.2, 18.8, 20.2 | Audit global propriétaire seul non modifiable, données minimales, incident, limites compte partagé et protections sans 2FA imposée. | V-CDC-15-02 (F-15) |
| CDC-15-03 | §15, ligne 284 | - Seul le propriétaire consulte le journal d'audit global ; ni employés, ni administrateurs secondaires. Aucun utilisateur ne peut le modifier ou le purger librement via l'interface. Les historiques métier de commandes restent visibles selon droits. | 5.8, 7.13, 7.14, 17.1, 17.2, 17.13, 18.1, 18.2, 18.8, 20.2 | Audit global propriétaire seul non modifiable, données minimales, incident, limites compte partagé et protections sans 2FA imposée. | V-CDC-15-03 (F-15) |
| CDC-15-04 | §15, ligne 285 | - Sécuriser les fichiers téléchargés, les API, les échanges temps réel, les exports, les recherches, l'affichage des noms de patients et les aperçus. Pas de stockage direct public des pièces jointes. | 5.8, 7.13, 7.14, 17.1, 17.2, 17.13, 18.1, 18.2, 18.8, 20.2 | Audit global propriétaire seul non modifiable, données minimales, incident, limites compte partagé et protections sans 2FA imposée. | V-CDC-15-04 (F-15) |
| CDC-15-05 | §15, ligne 286 | - Incidents : signalement via messagerie générale (clinique) ou contact direct propriétaire (personnel) ; procédure de réponse, révocation de sessions, conservation de preuves, analyse des impacts et obligations de notification à vérifier. | 5.8, 7.13, 7.14, 17.1, 17.2, 17.13, 18.1, 18.2, 18.8, 20.2 | Audit global propriétaire seul non modifiable, données minimales, incident, limites compte partagé et protections sans 2FA imposée. | V-CDC-15-05 (F-15) |
| CDC-15-06 | §15, ligne 287 | - Une seule identité partagée par clinique ne permet pas d'attribuer avec certitude une action à un dentiste précis. Risque accepté fonctionnellement, à signaler au laboratoire et au conseil juridique ; pas de promesse d'audit individuel interne à une clinique. | 5.8, 7.13, 7.14, 17.1, 17.2, 17.13, 18.1, 18.2, 18.8, 20.2 | Audit global propriétaire seul non modifiable, données minimales, incident, limites compte partagé et protections sans 2FA imposée. | V-CDC-15-06 (F-15) |
| CDC-15-07 | §15, ligne 288 | - Le choix de ne pas imposer de 2FA ne doit pas conduire à affaiblir les comptes propriétaires : protections compensatoires, alertes de connexion, révocation et récupération encadrée à valider. | 5.8, 7.13, 7.14, 17.1, 17.2, 17.13, 18.1, 18.2, 18.8, 20.2 | Audit global propriétaire seul non modifiable, données minimales, incident, limites compte partagé et protections sans 2FA imposée. | V-CDC-15-07 (F-15) |
| CDC-16-01 | §16, ligne 292 | - Objectifs demandés : RPO maximum 1 heure ; RTO cible 4 heures. Ce sont des objectifs, pas des garanties sans validation du plan d'infrastructure, tests de restauration et prise en compte des fichiers volumineux. | 3.10, 14.8, 17.7, 17.8, 19.7, 19.8, 19.9, 19.10, 19.11, 20.10, 20.11 | RPO/RTO mesurés, backups chiffrés hors VPS 30 j, alertes indépendantes, maintenance et sortie de secours. | V-CDC-16-01 (F-16) |
| CDC-16-02 | §16, ligne 293 | - Sauvegardes automatiques, chiffrées, hors VPS, cohérentes entre base de données et pièces jointes, rétention 30 jours, restauration testée régulièrement ; les seuls brouillons locaux non synchronisés ne sont pas couverts. | 3.10, 14.8, 17.7, 17.8, 19.7, 19.8, 19.9, 19.10, 19.11, 20.10, 20.11 | RPO/RTO mesurés, backups chiffrés hors VPS 30 j, alertes indépendantes, maintenance et sortie de secours. | V-CDC-16-02 (F-16) |
| CDC-16-03 | §16, ligne 294 | - Surveillance stockage/état des services indépendante si possible ; alertes critiques au propriétaire. | 3.10, 14.8, 17.7, 17.8, 19.7, 19.8, 19.9, 19.10, 19.11, 20.10, 20.11 | RPO/RTO mesurés, backups chiffrés hors VPS 30 j, alertes indépendantes, maintenance et sortie de secours. | V-CDC-16-03 (F-16) |
| CDC-16-04 | §16, ligne 295 | - Mode maintenance activable/désactivable par le propriétaire : blocage des opérations serveur, message clair pour utilisateurs, possibilité technique de sortie d'urgence si le portail ne fonctionne pas. Les brouillons locaux restent préparables ; aucune synchronisation pendant maintenance. | 3.10, 14.8, 17.7, 17.8, 19.7, 19.8, 19.9, 19.10, 19.11, 20.10, 20.11 | RPO/RTO mesurés, backups chiffrés hors VPS 30 j, alertes indépendantes, maintenance et sortie de secours. | V-CDC-16-04 (F-16) |
| CDC-16-05 | §16, ligne 296 | - Annonce préalable facultative via bandeau dans l'application, date/heure en heure locale ; pas d'e-mail ; annonce ne déclenche pas automatiquement maintenance. Maintenance urgente sans préavis possible. | 3.10, 14.8, 17.7, 17.8, 19.7, 19.8, 19.9, 19.10, 19.11, 20.10, 20.11 | RPO/RTO mesurés, backups chiffrés hors VPS 30 j, alertes indépendantes, maintenance et sortie de secours. | V-CDC-16-05 (F-16) |
| CDC-16-06 | §16, ligne 297 | - Distinguer panne réseau/serveur du mode maintenance volontaire, sans afficher de fausse annonce. | 3.10, 14.8, 17.7, 17.8, 19.7, 19.8, 19.9, 19.10, 19.11, 20.10, 20.11 | RPO/RTO mesurés, backups chiffrés hors VPS 30 j, alertes indépendantes, maintenance et sortie de secours. | V-CDC-16-06 (F-16) |
| CDC-16-07 | §16, ligne 298 | - Toute mise à jour ordinaire devrait viser l'absence d'interruption, lorsque l'architecture le permet. | 3.10, 14.8, 17.7, 17.8, 19.7, 19.8, 19.9, 19.10, 19.11, 20.10, 20.11 | RPO/RTO mesurés, backups chiffrés hors VPS 30 j, alertes indépendantes, maintenance et sortie de secours. | V-CDC-16-07 (F-16) |
| CDC-17-01 | §17, ligne 304 | 1. Politique de confidentialité. | 17.4, 17.5, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12, 21.10 | Validation professionnelle/juridique attribuable, textes albanais versionnés, lieu réel et politique rétention ; aucune auto-attestation. | V-CDC-17-01 (F-17) |
| CDC-17-02 | §17, ligne 305 | 2. Conditions d'utilisation professionnelles. | 17.4, 17.5, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12, 21.10 | Validation professionnelle/juridique attribuable, textes albanais versionnés, lieu réel et politique rétention ; aucune auto-attestation. | V-CDC-17-02 (F-17) |
| CDC-17-03 | §17, ligne 306 | 3. Informations légales du laboratoire. | 17.4, 17.5, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12, 21.10 | Validation professionnelle/juridique attribuable, textes albanais versionnés, lieu réel et politique rétention ; aucune auto-attestation. | V-CDC-17-03 (F-17) |
| CDC-17-04 | §17, ligne 312 | - Loi kosovare n° 06/L-082 sur la protection des données personnelles, applicable au traitement et à la protection des données personnelles ; autorité : Information and Privacy Agency (AIP). | 17.4, 17.5, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12, 21.10 | Validation professionnelle/juridique attribuable, textes albanais versionnés, lieu réel et politique rétention ; aucune auto-attestation. | V-CDC-17-04 (F-17) |
| CDC-17-05 | §17, ligne 313 | - Rôles réels des cliniques et du laboratoire dans les traitements (responsable, sous-traitant, responsabilités potentiellement propres), base juridique, données de santé et mesures renforcées, contrats nécessaires. | 17.4, 17.5, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12, 21.10 | Validation professionnelle/juridique attribuable, textes albanais versionnés, lieu réel et politique rétention ; aucune auto-attestation. | V-CDC-17-05 (F-17) |
| CDC-17-06 | §17, ligne 314 | - Localisation réelle du VPS, de l'e-mail et des sauvegardes ; transferts internationaux éventuels et conditions applicables. | 17.4, 17.5, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12, 21.10 | Validation professionnelle/juridique attribuable, textes albanais versionnés, lieu réel et politique rétention ; aucune auto-attestation. | V-CDC-17-06 (F-17) |
| CDC-17-07 | §17, ligne 315 | - Droits des personnes et procédures de traitement des demandes ; délais légaux à confirmer à partir du texte et des circonstances, sans les coder arbitrairement dans cette spécification. | 17.4, 17.5, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12, 21.10 | Validation professionnelle/juridique attribuable, textes albanais versionnés, lieu réel et politique rétention ; aucune auto-attestation. | V-CDC-17-07 (F-17) |
| CDC-17-08 | §17, ligne 316 | - Obligations de conservation, sécurité, notification des incidents, traçabilité des dispositifs médicaux dentaires sur mesure et éventuelles exigences sectorielles : examiner les textes kosovars pertinents et leurs versions à jour, notamment loi n° 04/L-190 et ses amendements, avec conseil local qualifié. | 17.4, 17.5, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12, 21.10 | Validation professionnelle/juridique attribuable, textes albanais versionnés, lieu réel et politique rétention ; aucune auto-attestation. | V-CDC-17-08 (F-17) |
| CDC-17-09 | §17, ligne 317 | - La conservation indéfinie des brouillons ou de documents médicaux doit être réexaminée au regard de la minimisation des données ; les décisions ergonomiques ne peuvent l'emporter sur les obligations de protection des données. | 17.4, 17.5, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12, 21.10 | Validation professionnelle/juridique attribuable, textes albanais versionnés, lieu réel et politique rétention ; aucune auto-attestation. | V-CDC-17-09 (F-17) |
| CDC-17-10 | §17, ligne 320 | - Agence kosovare d'information et de protection de la vie privée : https://aip.rks-gov.net/personal-data-protection/legislation/ | 17.4, 17.5, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12, 21.10 | Validation professionnelle/juridique attribuable, textes albanais versionnés, lieu réel et politique rétention ; aucune auto-attestation. | V-CDC-17-10 (F-17) |
| CDC-17-11 | §17, ligne 321 | - Journal officiel, loi 06/L-082 : https://gzk.rks-gov.net/ActDetail.aspx?ActID=18616&langid=2 | 17.4, 17.5, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12, 21.10 | Validation professionnelle/juridique attribuable, textes albanais versionnés, lieu réel et politique rétention ; aucune auto-attestation. | V-CDC-17-11 (F-17) |
| CDC-17-12 | §17, ligne 322 | - Journal officiel, loi 04/L-190 relative aux produits et dispositifs médicaux : https://gzk.rks-gov.net/ActDetail.aspx?ActID=9437&langid=2 | 17.4, 17.5, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12, 21.10 | Validation professionnelle/juridique attribuable, textes albanais versionnés, lieu réel et politique rétention ; aucune auto-attestation. | V-CDC-17-12 (F-17) |
| CDC-18-01 | §18, ligne 326 | - Finance reportée volontairement : prix par dent/matériau, devis, tarification, factures, paiements, suivi des sommes dues, marges, tableaux de bord financiers, gestion des garanties et prix des retouches. | 1.4, 1.5, 4.14, 9.2, 9.5, 18.8, 21.9 | Revue de périmètre : pas de finance/patient/affectation/2FA imposée, pas d’e-mails ni de liens publics ajoutés. | V-CDC-18-01 (F-18) |
| CDC-18-02 | §18, ligne 327 | - Aucun espace patient, aucune base de dossiers patient transversale, aucune intégration médicale externe décidée. | 1.4, 1.5, 4.14, 9.2, 9.5, 18.8, 21.9 | Revue de périmètre : pas de finance/patient/affectation/2FA imposée, pas d’e-mails ni de liens publics ajoutés. | V-CDC-18-02 (F-18) |
| CDC-18-03 | §18, ligne 328 | - Aucun compte individuel dentiste/secrétaire au sein d'une clinique ; un seul compte partagé par clinique. | 1.4, 1.5, 4.14, 9.2, 9.5, 18.8, 21.9 | Revue de périmètre : pas de finance/patient/affectation/2FA imposée, pas d’e-mails ni de liens publics ajoutés. | V-CDC-18-03 (F-18) |
| CDC-18-04 | §18, ligne 329 | - Aucun système d'affectation des commandes aux employés. | 1.4, 1.5, 4.14, 9.2, 9.5, 18.8, 21.9 | Revue de périmètre : pas de finance/patient/affectation/2FA imposée, pas d’e-mails ni de liens publics ajoutés. | V-CDC-18-04 (F-18) |
| CDC-18-05 | §18, ligne 330 | - Pas d'e-mails pour toutes les actions, pas de chat entre cliniques, pas de partage de fichiers par liens publics, pas de transfert de propriété depuis le portail. | 1.4, 1.5, 4.14, 9.2, 9.5, 18.8, 21.9 | Revue de périmètre : pas de finance/patient/affectation/2FA imposée, pas d’e-mails ni de liens publics ajoutés. | V-CDC-18-05 (F-18) |
| CDC-18-06 | §18, ligne 331 | - Pas de fonctionnalité imposant de remplir description ou dents lorsque les deux sont vides ; avertissement non bloquant seulement. | 1.4, 1.5, 4.14, 9.2, 9.5, 18.8, 21.9 | Revue de périmètre : pas de finance/patient/affectation/2FA imposée, pas d’e-mails ni de liens publics ajoutés. | V-CDC-18-06 (F-18) |
| CDC-18-07 | §18, ligne 332 | - Pas de multi-matériau ou multi-teinte par commande ; envoyer plusieurs commandes si nécessaire. | 1.4, 1.5, 4.14, 9.2, 9.5, 18.8, 21.9 | Revue de périmètre : pas de finance/patient/affectation/2FA imposée, pas d’e-mails ni de liens publics ajoutés. | V-CDC-18-07 (F-18) |
| CDC-18-08 | §18, ligne 333 | - Pas de promesse de consultation des modèles 3D sans possibilité technique d'en copier les octets. | 1.4, 1.5, 4.14, 9.2, 9.5, 18.8, 21.9 | Revue de périmètre : pas de finance/patient/affectation/2FA imposée, pas d’e-mails ni de liens publics ajoutés. | V-CDC-18-08 (F-18) |
| CDC-18-09 | §18, ligne 334 | - Pas de suppression automatique de fichiers historiques pour dégager de l'espace. | 1.4, 1.5, 4.14, 9.2, 9.5, 18.8, 21.9 | Revue de périmètre : pas de finance/patient/affectation/2FA imposée, pas d’e-mails ni de liens publics ajoutés. | V-CDC-18-09 (F-18) |
| CDC-19-01 | §19, ligne 342 |  Demande pendante  /  Une seule modification ou annulation à la fois ; pas de démarrage fabrication ; pas de modification directe des instructions par le laboratoire avant décision/retrait.  | 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 10.15, 18.1, 20.4, 20.5, 20.7, 20.8, 21.9 | Scénarios transversaux reproduisant les interactions consolidées et les exclusions. | V-CDC-19-01 (F-19) |
| CDC-19-02 | §19, ligne 343 |  Commande en attente modifiée  /  Dernière version soumise visible ; acceptation d'une version obsolète interdite.  | 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 10.15, 18.1, 20.4, 20.5, 20.7, 20.8, 21.9 | Scénarios transversaux reproduisant les interactions consolidées et les exclusions. | V-CDC-19-02 (F-19) |
| CDC-19-03 | §19, ligne 344 |  Correction demandée  /  Distincte d'`En attente` ; retour seulement après renvoi explicite.  | 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 10.15, 18.1, 20.4, 20.5, 20.7, 20.8, 21.9 | Scénarios transversaux reproduisant les interactions consolidées et les exclusions. | V-CDC-19-03 (F-19) |
| CDC-19-04 | §19, ligne 345 |  Travail commencé  /  Instructions et fichiers verrouillés ; nouveau travail lié de remplacement ou supplémentaire.  | 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 10.15, 18.1, 20.4, 20.5, 20.7, 20.8, 21.9 | Scénarios transversaux reproduisant les interactions consolidées et les exclusions. | V-CDC-19-04 (F-19) |
| CDC-19-05 | §19, ligne 346 |  Livraison erronée  /  Retour exceptionnel à `Terminée` ; vérifier absence de retouche contradictoire.  | 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 10.15, 18.1, 20.4, 20.5, 20.7, 20.8, 21.9 | Scénarios transversaux reproduisant les interactions consolidées et les exclusions. | V-CDC-19-05 (F-19) |
| CDC-19-06 | §19, ligne 347 |  Référence supprimée  /  Non proposée dans le catalogue courant, mais valeurs figées historiques et brouillons préservés.  | 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 10.15, 18.1, 20.4, 20.5, 20.7, 20.8, 21.9 | Scénarios transversaux reproduisant les interactions consolidées et les exclusions. | V-CDC-19-06 (F-19) |
| CDC-19-07 | §19, ligne 348 |  Référence indisponible  /  Soumission possible avec avertissement ; acceptation exceptionnelle avec motif.  | 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 10.15, 18.1, 20.4, 20.5, 20.7, 20.8, 21.9 | Scénarios transversaux reproduisant les interactions consolidées et les exclusions. | V-CDC-19-07 (F-19) |
| CDC-19-08 | §19, ligne 349 |  Référence interdite  /  Soumission/acceptation impossible ; blocage préventif des travaux non livrés, sans annulation automatique ; examen des travaux livrés.  | 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 10.15, 18.1, 20.4, 20.5, 20.7, 20.8, 21.9 | Scénarios transversaux reproduisant les interactions consolidées et les exclusions. | V-CDC-19-08 (F-19) |
| CDC-19-09 | §19, ligne 350 |  Rétention versus archivage  /  30 jours avant archivage UI ≠ durée de conservation ; fin de rétention signalée au propriétaire pour décision légalement encadrée.  | 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 10.15, 18.1, 20.4, 20.5, 20.7, 20.8, 21.9 | Scénarios transversaux reproduisant les interactions consolidées et les exclusions. | V-CDC-19-09 (F-19) |
| CDC-19-10 | §19, ligne 351 |  Téléchargement ZIP  /  Identiques permissions que le téléchargement individuel ; inclusion sélective automatique des seuls fichiers autorisés.  | 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 10.15, 18.1, 20.4, 20.5, 20.7, 20.8, 21.9 | Scénarios transversaux reproduisant les interactions consolidées et les exclusions. | V-CDC-19-10 (F-19) |
| CDC-19-11 | §19, ligne 352 |  PWA hors ligne  /  Brouillons seulement ; aucune promesse d'effacement ou de révocation instantanée sur appareil sans connexion.  | 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 10.15, 18.1, 20.4, 20.5, 20.7, 20.8, 21.9 | Scénarios transversaux reproduisant les interactions consolidées et les exclusions. | V-CDC-19-11 (F-19) |
| CDC-19-12 | §19, ligne 353 |  Compte de clinique partagé  /  Confidentialité par clinique assurée, mais responsabilité individuelle des membres de la clinique non identifiable techniquement.  | 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 10.15, 18.1, 20.4, 20.5, 20.7, 20.8, 21.9 | Scénarios transversaux reproduisant les interactions consolidées et les exclusions. | V-CDC-19-12 (F-19) |
| CDC-19.1-01 | §19.1, ligne 359 | - Motifs / procédure interne de refus, corrections et annulations ; formulations albanaises exactes. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-01 (F-19.1) |
| CDC-19.1-02 | §19.1, ligne 360 | - Traitement pratique des demandes de retouche sans prix ni garantie dans la version initiale. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-02 (F-19.1) |
| CDC-19.1-03 | §19.1, ligne 361 | - Confirmation du fonctionnement opérationnel avec patient identifié uniquement par référence et avec commandes sans dents/description ; ces choix sont validés mais impliquent un risque de dossier incomplet. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-03 (F-19.1) |
| CDC-19.1-04 | §19.1, ligne 362 | - Qui est habilité à décider une mesure sur matériau interdit ou sur une commande livrée concernée, sous réserve des prescriptions légales et de la responsabilité du laboratoire. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-04 (F-19.1) |
| CDC-19.1-05 | §19.1, ligne 366 | - Audit du VPS existant, volumes/disques, services et autres applications, capacité d'extension, confidentialité des autres sites. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-05 (F-19.1) |
| CDC-19.1-06 | §19.1, ligne 367 | - Faisabilité éprouvée du chiffrement et déverrouillage local des brouillons PWA selon les navigateurs/appareils réellement utilisés ; gestion de l'expiration des espaces temporaires, des quotas navigateurs et des pertes de stockage local. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-06 (F-19.1) |
| CDC-19.1-07 | §19.1, ligne 368 | - Faisabilité de la reprise d'upload des fragments et fichiers jusqu'à 1 Go par commande, gestion du ZIP, contrôle antivirus/fichiers malveillants, monitoring et contraintes de coût. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-07 (F-19.1) |
| CDC-19.1-08 | §19.1, ligne 369 | - Conception et tests des sauvegardes incluant gros fichiers, RPO 1h / RTO 4h, indépendance des alertes et restauration depuis un incident complet. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-08 (F-19.1) |
| CDC-19.1-09 | §19.1, ligne 370 | - Sécurité des sessions persistantes et procédure d'intervention technique exceptionnelle sur le propriétaire. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-09 (F-19.1) |
| CDC-19.1-10 | §19.1, ligne 374 | - Qualifications des acteurs dans le traitement des données, droits d'accès et de rectification, consentements/accords si requis et clauses contractuelles. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-10 (F-19.1) |
| CDC-19.1-11 | §19.1, ligne 375 | - Hébergement et transferts internationaux éventuels ; sécurité du prestataire e-mail et sauvegardes. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-11 (F-19.1) |
| CDC-19.1-12 | §19.1, ligne 376 | - Durées exactes par catégorie de données, conservation des versions médicales, anonymisation, effacement, demandes patient, incidents et notifications. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-12 (F-19.1) |
| CDC-19.1-13 | §19.1, ligne 377 | - Exigences de traçabilité et obligations relatives aux dispositifs dentaires sur mesure, y compris les retraits/interdictions de sécurité. | 1.6, 2.9, 15.10, 18.3, 19.1, 19.10, 17.9, 17.10, 17.11, 17.12, 17.13, 20.12 | Responsables métier/juridique et preuves terrain nécessaires ; faisabilités/limites explicitement non acquises. | V-CDC-19.1-13 (F-19.1) |
| CDC-19.2-01 | §19.2, ligne 381 | - Les seuils de stockage, durées de conservation des uploads temporaires, durée d'expiration des invitations et cadence des tests de restauration sont des paramètres à déterminer, et non des chiffres approuvés. | 1.6, 3.8, 4.14, 7.8, 12.8, 19.2 | Paramètres ouverts enregistrés ; aucune durée/seuil/obligation supplémentaire arbitraire. | V-CDC-19.2-01 (F-19.2) |
| CDC-19.2-02 | §19.2, ligne 382 | - Les libellés exacts et le design des pages devront suivre une conception UI simplifiée ultérieure, sans changer les workflows. | 1.6, 3.8, 4.14, 7.8, 12.8, 19.2 | Paramètres ouverts enregistrés ; aucune durée/seuil/obligation supplémentaire arbitraire. | V-CDC-19.2-02 (F-19.2) |
| CDC-19.2-03 | §19.2, ligne 383 | - La mise en œuvre technique peut proposer des garanties meilleures que les exigences ci-dessus, mais ne doit pas ajouter de validation clinique obligatoire, de 2FA obligatoire, de module financier ou de suppression automatique de commandes sans nouvel accord. | 1.6, 3.8, 4.14, 7.8, 12.8, 19.2 | Paramètres ouverts enregistrés ; aucune durée/seuil/obligation supplémentaire arbitraire. | V-CDC-19.2-03 (F-19.2) |
| CDC-20-01 | §20, ligne 389 | 1. Une clinique peut s'inscrire, être approuvée, se connecter et soumettre une commande complète avec ou sans sélection de dents, et avec patient identifié par nom/prénom ou référence. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-01 (F-20) |
| CDC-20-02 | §20, ligne 390 | 2. Deux cliniques ne peuvent consulter ni deviner les données ou fichiers l'une de l'autre, y compris dans la messagerie, les téléchargements et les recherches. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-02 (F-20) |
| CDC-20-03 | §20, ligne 391 | 3. Le laboratoire traite une commande de `En attente` à `Livrée` et peut demander une correction avant acceptation ; toutes les dates et décisions restent traçables. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-03 (F-20) |
| CDC-20-04 | §20, ligne 392 | 4. Les corrections directes avant acceptation et les modifications soumises après acceptation respectent l'historique et les verrouillages concurrentiels. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-04 (F-20) |
| CDC-20-05 | §20, ligne 393 | 5. Les règles d'annulation, retrait des demandes, duplications, commandes créées par le laboratoire et retouches se comportent selon §§5–6. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-05 (F-20) |
| CDC-20-06 | §20, ligne 394 | 6. Les instructions/fichiers de fabrication restent verrouillés après le début de fabrication ; un remplacement crée bien une commande liée sans réécriture de l'ancienne. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-06 (F-20) |
| CDC-20-07 | §20, ligne 395 | 7. Les permissions logistiques/détaillées, visualisation/téléchargement, lecture/réponse et actions métier sont effectivement contrôlées côté serveur. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-07 (F-20) |
| CDC-20-08 | §20, ligne 396 | 8. Les e-mails et rappels respectent leur matrice de destinataires, leurs déclencheurs et leur politique de relance ; les actions métier survivent à une panne d'e-mail. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-08 (F-20) |
| CDC-20-09 | §20, ligne 397 | 9. Les brouillons hors ligne conservent informations et fichiers, exigent un déverrouillage adéquat, détectent les conflits, et ne soumettent jamais automatiquement une commande. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-09 (F-20) |
| CDC-20-10 | §20, ligne 398 | 10. Un transfert interrompu peut reprendre sans doublon tant que les fragments existent ; les limites de taille et seuils de sécurité sont appliqués. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-10 (F-20) |
| CDC-20-11 | §20, ligne 399 | 11. Une référence interdite empêche effectivement une nouvelle fabrication et signale/bloque les commandes actives concernées ; une référence simplement indisponible conserve le parcours d'exception validé. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-11 (F-20) |
| CDC-20-12 | §20, ligne 400 | 12. La livraison groupée, sa correction exceptionnelle, le calendrier, l'archivage à J+30 et les conversations clôturées/réouvertes restent cohérents. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-12 (F-20) |
| CDC-20-13 | §20, ligne 401 | 13. Les alertes de stockage et de sauvegarde, le mode maintenance et les procédures de reprise sont testés dans l'environnement effectivement retenu. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-13 (F-20) |
| CDC-20-14 | §20, ligne 402 | 14. Les validations légales et professionnelles ont été réalisées et documentées avant de traiter des données réelles de patients. | 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 21.9 | Critères d’acceptation à prouver individuellement en recette ; aucune preuve de réalisation à ce stade. | V-CDC-20-14 (F-20) |

### Compte rendu du point 1.2 — Répertoire et dépôts

Date de clôture : 09/10/2026, Europe/Brussels. Statut : ☑ Validé.

État initial contrôlé : /srv/dental-lab était vide avant copie des cinq références. L’inventaire Remote, le chemin réel, mode 700 et ACL ont été lus ; aucune entrée .git ni code ni migration ni fichier de suivi préexistant. Aucun dépôt/remote n’a donc été repris ou supposé. Les cinq fichiers actuellement présents sont uniquement les références copiées au point 1.1, avec annexe de suivi dans ROADMAP.md.

Décision de réutilisation : préserver les préparations système et SQL observées ; aucune recréation. Préserver le contenu des références. Ne pas initialiser le dépôt avant le point 5.1 et ses dépendances ; ne pas choisir de remote ou d’identité Git sans donnée confirmée.

Fichiers modifiés à ce point : ROADMAP.md (statut 1.2 et ce compte rendu). Aucune modification de code/SQL/service/privilège. Validation : inventaire relu, absence de .git vérifiée, absence de lien symbolique dans le projet, identifiants et couverture documentaire contrôlés. Git : sans objet, aucune initialisation/commit/push. Risques restants : politique sudo et isolation réseau non prouvées ; mode runtime/migration absent ; remote Git non défini. Suite : 1.3, décision de stack à valider avant initialisation.

### Compte rendu du point 1.3 — Proposition d’ADR à approuver

Date : 09/10/2026, Europe/Brussels. Statut : ⚠ Bloqué — décision de stack non encore approuvée par le propriétaire du projet. Aucun point suivant entamé. Aucun paquet installé, aucun squelette généré.

Contexte établi : application privée sans besoin de SEO public, usage tactile/PWA, brouillons hors ligne chiffrés, messages temps réel, gros fichiers privés, monolithe modulaire. PostgreSQL 17 existe. Node 22.22.2 et npm 10.9.7 ont été exécutés sous dental-ai. Aucun code préexistant ni choix de framework validé dans les sources.

Comparaison préparée (analyse d’architecture, pas benchmark exécuté) :

| Option | Intérêt pour ce projet | Compromis | Proposition |
|---|---|---|---|
| React + Vite SPA + Express, TypeScript partagé | Client PWA clairement séparé de l’autorité API, contrats communs, SQL explicite, outillage compatible avec Node existant | Autorisations, sessions, transferts et temps réel restent à concevoir/tester ; le framework ne fournit pas ces garanties | Recommandée |
| React + Vite SPA + Fastify | Frontend identique ; API avec primitives de plugins et validation orientées serveur | Autre convention API à adopter ; aucune mesure ici ne démontre un besoin de performance imposant ce choix | Alternative viable |
| Next.js full-stack | Conventions full-stack et routage intégrés ; évite un framework API séparé dans certains usages | Le rendu serveur n’est pas une exigence métier de cette application ; organisation spécifique à documenter pour PWA/offline/fichiers/jobs | Alternative viable |

Proposition concrète (À APPROUVER, rien de ceci n’est encore décidé) :

- Monorepo npm workspaces, apps/web, apps/api, packages/contracts. Modules réellement nécessaires seulement. API structurée routes → controllers → services → repositories, PostgreSQL via pg et migrations SQL versionnées.
- Frontend React + Vite SPA, TanStack Router (sans supposer TanStack Start), TanStack Query pour l’état serveur, Tailwind pour les styles avec composants accessibles à concevoir au chapitre 4.
- TypeScript 6 strict et Zod partagé pour les frontières. TypeScript 7 est désormais latest au registre interrogé mais n’est PAS retenu dans cette proposition : le peer déclaré de typescript-eslint 8.71.1 est >=4.8.4 <6.1.0. Ne pas forcer une incompatibilité pour adopter latest.
- Tests : Vitest pour règles et intégration ; Playwright pour E2E. Installation réelle, navigateur système et environnement PostgreSQL de test restent à auditer ; aucune promesse que les dépendances système Playwright existent déjà.
- Conservation de Node 22.22.2 pendant le développement initial, sous réserve des audits de sécurité/support ultérieurs. Aucune modification de Node global sur VPS partagé.
- Sessions, transport temps réel, cryptographie offline, stockage/antimalware, emails, backups et runtime isolé restent aux ADR/points pertinents. Ne pas les déduire du choix de frameworks.

Versions exactes candidates, vérifiées par GET HTTPS publics du registre npm depuis dental-ai, le 09/10/2026 ; métadonnées seulement :

| Paquet | Version candidate |
|---|---|
| react / react-dom | 19.3.0 / 19.3.0 |
| vite / @vitejs/plugin-react | 8.3.4 / 6.1.2 |
| typescript | 6.0.3 |
| express | 5.2.1 |
| pg | 8.23.1 |
| zod | 4.6.5 |
| @tanstack/react-router | 1.170.41 |
| @tanstack/react-query | 5.104.1 |
| tailwindcss / @tailwindcss/vite | 4.3.3 / 4.3.3 |
| vitest | 5.0.3 |
| @playwright/test | 1.64.0 |
| eslint / typescript-eslint | 10.12.0 / 8.71.1 |
| prettier | 3.9.9 |

Contrôle réellement fait : moteurs Node et peerDependencies déclarés sont compatibles pour les versions candidates principales listées ci-dessus (Node 22.22.2 ; React 19.3 ; Vite 8 ; TS 6.0.3). Ce contrôle documentaire n’est ni une installation complète ni une preuve de résolution de toutes les dépendances transitives, ni un build, ni une preuve de sécurité. Un lockfile et les types/plugins nécessaires seront définis et contrôlés lors de l’initialisation autorisée ; réauditer les métadonnées si la reprise est tardive.

Sources primaires consultées :
- https://react.dev/versions
- https://vite.dev/guide/
- https://vite.dev/blog/announcing-vite8.html
- https://expressjs.com/en/guide/migrating-5/
- https://registry.npmjs.org/ (ressources package/latest, et versions stables 6.x de typescript).

Action humaine minimale attendue : approuver cette proposition React/Vite/Express/PostgreSQL avec TypeScript 6, npm workspaces, Zod et outillage proposé, ou désigner une alternative. Cette décision débloque la finalisation de l’ADR 1.3 ; elle n’accorde aucun nouveau privilège ni une autorisation de production.

Fichiers modifiés : ROADMAP.md uniquement (statut et proposition). Git : dépôt absent, aucun commit/push. Reprise : vérifier identité dental-ai, état du répertoire, empreintes et proposition ; enregistrer la décision reçue au point 1.3, terminer ses validations, puis seulement passer à 1.4.

### ADR du point 1.3 — Stack validée le 09/10/2026 à 05:54 Europe/Brussels

Statut : ☑ Validé pour la décision d’architecture et la compatibilité structurelle. La proposition antérieure bloquée est un état historique ; la présente décision la remplace pour le cœur de stack. Autorité : validation explicite de Resul dans la conversation, le 09/10/2026 à 05:53–05:54 Europe/Brussels.

Décision actée : frontend React + Vite + TypeScript 6 ; backend Express + TypeScript 6 ; PostgreSQL 17 exclusivement dental_lab ; monolithe modulaire. Les versions candidates du tableau précédent sont des métadonnées vérifiées, pas des paquets installés. Les versions stables, leurs moteurs et leurs peers seront revérifiés à l’installation ; aucun passage forcé à TS 7 ni changement du runtime global. L’outillage annexe (npm workspaces, pg, Zod, qualité et tests) demeure une proposition d’implémentation cohérente à contrôler lors des fondations, sans imposer de nouvel accord de confort.

Audit de reprise : identité dental-ai/UID 1002, hostname vps-28bf7789, HOME attendu, chemin physique /srv/dental-lab, mode 700 et sources inchangées vérifiés. SHA-256 ROADMAP initial = 5e4f1c1c0f5a6b9f89ba8d1c27a732d441df5f09bbfc508102a9435a1f73de75. Git absent. Aucun code à préserver autre que les références. Node 22.22.2, npm 10.9.7 confirmés.

| Exigence obligatoire | Capacité envisagée avec la stack | Limite et preuve requise avant validation fonctionnelle |
|---|---|---|
| PWA installable tablette/mobile | Manifest, service worker, shell React/Vite servi en HTTPS | Installation et mises à jour sur appareils cibles aux points 15.1, 15.10, 20.8 ; domaine/TLS non encore configurés |
| Brouillons complets hors ligne, fichiers compris | Stockage navigateur adapté au binaire, séparation par compte, Web Crypto ; cache du shell seulement | Quotas/éviction et mémoire réels, clé/déverrouillage et pertes à tester ; aucun cache automatique des commandes officielles |
| Chiffrement et retour du même compte | Primitives de cryptographie authentifiée utilisables côté navigateur, clé liée à l’espace du compte | La stratégie cryptographique complète reste à concevoir en 3.8/15.3 ; aucune garantie de révocation instantanée hors réseau |
| Synchronisation multi-appareils | API Express, versions serveur PostgreSQL et transactions ; conflit explicite serveur ou nouveau brouillon local | Tests de divergence avec fichiers, acquittement et reprise ; jamais d’envoi officiel automatique |
| 200 Mo/fichier et 1 Go initial/message | HTTP par fragments, streaming Node, métadonnées/checksums et finalisation contrôlée | Réserve disque/quota, validation du contenu et antivirus à décider, interruptions/ZIP à éprouver ; aucun gros fichier intégral en mémoire |
| Droits fins et isolement clinique | Contrôles serveur par ressource et action, requêtes SQL paramétrées et projections selon droits | Tests IDOR/concurrence/révocation sur API, recherche, fichiers, ZIP, événements et notifications ; React/Express n’assurent pas ces droits seuls |
| Temps réel et lecture | Express peut héberger un transport adapté ; messages persistants et reprise pilotée par serveur | Choix de transport en 3.9/13.4, recontrôle des droits et récupération des messages manqués |
| Traçabilité, e-mail indépendant et maintenance | Transactions PostgreSQL, événements/outbox et workers propres au projet | Outbox/relances, audit propriétaire, verrouillages et tests de panne à réaliser ; fournisseur non sélectionné |
| Backups, rétention et exploitation | La stack permet des sauvegardes SQL/fichiers et un runtime dédié | RPO/RTO, budgets, délégations, localisation/conformité sont des préconditions externes, jamais garanties par la stack |

Sources primaires lues le 09/10/2026 : MDN Using Service Workers (HTTPS et cycle de vie), Storage quotas and eviction criteria, SubtleCrypto.encrypt (AES-GCM), documentation Node 22 Stream/pipeline, documentation officielle Express Production Best Practices: Security. URLs : https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers ; https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria ; https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt ; https://nodejs.org/docs/latest-v22.x/api/stream.html ; https://expressjs.com/en/advanced/best-practice-security/ .

Vérification exécutée sous dental-ai sans installer ni écrire de code : disponibilité de Web Crypto dans Node et pipeline en mémoire de deux fragments de 4096 octets, résultat 8192 octets, assertions réussies. Ce contrôle prouve uniquement la présence de primitives serveur, pas la cryptographie navigateur ni un transfert réel de 1 Go. Revue des APIs et règles : aucune incompatibilité importante identifiée pour la stack validée, sous réserve des portes de faisabilité déjà prévues.

Modifications : ROADMAP.md, statut 1.3 et présente ADR. Installation/migration/service/privilège : aucune. Git : absent, aucun commit/push. Risques restants : appareils/quotas, cryptographie, capacité et G1–G7 ; enregistrés au point 1.6. Suite : 1.4.

### Compte rendu du point 1.4 — Frontières et contrats des modules métier

Date : 09/10/2026, Europe/Brussels. Statut : ☑ Validé pour la cartographie de cadrage. La structure détaillée sera déclinée en 3.1 ; ces noms sont des frontières proposées, pas des dossiers déjà créés. Audit préalable : références inchangées et seuls cinq fichiers de documentation dans le projet, Git absent, décision 1.3 actée ; aucun code, schéma ou convention existante à déplacer.

| Module propriétaire | Données / décisions qu’il possède | Contrats publics attendus (intentions, pas routes existantes) |
|---|---|---|
| identity | Compte, identité, credentials, sessions, invitations, accès exceptionnel propriétaire | Authentifier, renouveler/révoquer, inviter, activer, récupérer ; identité serveur minimale et état de compte |
| clinics | Profil clinique, approbation/refus/suspension, compte partagé et demande d’e-mail | Lire la clinique autorisée, décider son état, proposer/confirmer le changement d’adresse ; aucune attribution à un dentiste individuel |
| permissions | Grants individuels, prérequis et délégabilité | Calculer les droits effectifs, refuser un grant sans prérequis, autoriser action/visibilité dans un contexte serveur |
| catalog | Matériaux, teintes, types ; disponibilité/interdiction et valeurs historiques | Lire le catalogue courant, valider une référence et son état, fournir un snapshot, signaler les références touchées |
| orders | Identité de travail, version officielle, dents, dates, statut, demandes pendantes, verrouillage | Soumettre une version idempotente, corriger/renvoyer, accepter/refuser, demander/retirer/décider, avancer/annuler ; lecture logistique ou détaillée |
| linked-works | Liens remplacement/supplément, retouche/refabrication liée au travail livré, unicité active | Créer atomiquement un travail lié, appliquer le workflow orders, lire la chaîne ; jamais remplacer les instructions de l’ancien travail |
| delivery | Planification/priorité/calendrier, sortie physique et correction exceptionnelle, échéance UI d’archive | Planifier, choisir mode, livrer individuellement/en lot, corriger avec droits/motif et contrôle de retouche ; déléguer les transitions à orders |
| files | Métadonnées/checksums, stockage privé, fragments, catégories de fichier, cycle de partage | Initialiser/reprendre/finaliser, attacher sans perte, lire/streamer un contenu autorisé, générer ZIP filtré ; ni URL publique ni propriété dérivée d’un body client |
| drafts | Version de brouillon serveur, liens fichiers, protocole de conflit, acquittement | Synchroniser sous révision attendue, lire/supprimer son brouillon, conserver serveur ou cloner local ; aucun envoi officiel automatique |
| messaging | Conversation générale/par travail, messages, versions, masquage, lecture et clôture | Garantir une conversation, envoyer/éditer/masquer par auteur, marquer Lu, fermer/rouvrir, publier les changements autorisés |
| notifications | Notifications internes et livraison e-mail par catégorie, rappels et retries | Traiter des événements/outbox, sélectionner des destinataires encore habilités, réévaluer l’utilité d’un envoi tardif, exposer incidents au propriétaire |
| audit | Append des traces importantes et projection globale propriétaire | Ajouter une trace expurgée, consulter selon autorité propriétaire ; aucune commande publique d’édition/purge |
| settings | Coordonnées du laboratoire, destinataires par catégorie, paramètres opérationnels approuvés | Lire/mettre à jour selon droits ; modifications historisées et valeurs validées, pas de prix |
| compliance | Versions de documents légaux, preuves d’acceptation, décisions de rétention validées | Lire le document applicable, enregistrer la version acceptée, signaler une échéance ; aucune auto-attestation juridique ni durée légale inventée |
| operations | Santé, maintenance/annonce, capacité, tâches d’exploitation propres au labo | Déterminer si une opération est permise, publier l’état non sensible, appliquer une politique approuvée ; aucun accès aux services voisins |
| events | Enregistrement transactionnel d’événements/outbox et dispatch technique | Émettre/consommer de façon rejouable sans dépendre du fournisseur e-mail ; transport générique, aucune décision métier déplacée ici |

Règles de contrats et dépendances :
- Frontend : app → features → shared ; shared ne connaît pas le métier. Web/API réutilisent des DTO/schémas de packages/contracts sans secret ni code SQL.
- Backend : routes → controllers → services → repositories ; le service décide, le repository persiste. Aucun import inverse. La composition de l’application raccorde les modules et fournisseurs ; les contrôleurs ne deviennent pas des orchestrateurs métier géants.
- Graph proposé (A → B signifie A utilise uniquement l’API publique de B) : {"permissions":[],"audit":[],"events":[],"compliance":["permissions","audit","events"],"identity":["permissions","compliance","audit","events"],"clinics":["identity","permissions","audit","events"],"catalog":["permissions","audit","events"],"files":["permissions","audit","events"],"messaging":["clinics","files","permissions","audit","events"],"orders":["clinics","catalog","files","messaging","permissions","audit","events"],"drafts":["clinics","catalog","files","permissions","audit","events"],"linked-works":["orders","permissions","audit","events"],"delivery":["orders","permissions","audit","events"],"notifications":["identity","permissions"],"settings":["permissions","audit","events"],"operations":["settings","events"]}.
- files et messaging ont besoin de l’autorisation de leur ressource parente, mais ne doivent pas importer orders en retour. Ils déclarent un port d’autorisation ; l’adaptateur serveur de composition utilise une lecture d’accès orders/clinics/permissions qui ne rappelle pas files/messaging. Le contexte ne vient jamais directement du navigateur. La politique est recontrôlée pour aperçu, téléchargement, ZIP, événements et recherches.
- orders peut garantir la conversation via l’API publique messaging ; la finalisation d’un travail et de ses références utilise une unité de transaction partagée. La clôture/réouverture d’une conversation et la livraison/archive doivent rester cohérentes dans l’opération métier, pas dépendre d’un e-mail réussi.
- Les contraintes croisées de retouche/livraison passent par un port de lecture minimal de linked-works ou une orchestration de service dédiée ; aucune dépendance inverse delivery/orders et linked-works/orders. Tests de liens et transactions exigés aux points 3.6, 6.6, 10.15, 16.7.
- Un événement durable est enregistré dans la transaction de la décision. Les handlers sont enregistrés dans la composition, events n’importe aucun module métier. Les payloads externes/logs ne contiennent pas de données patient.
- Les listes/logistique utilisent une projection serveur ne contenant aucun identifiant patient ou instruction technique. La réponse implique lecture ; accès fichier implique l’accès parent et les données concernées. Aucun rôle, workflow ou champ financier ajouté.
- La synchronisation serveur des brouillons relève de drafts ; le coffre local et son chiffrement restent dans la fonctionnalité web drafts. Le service worker ne cache pas les données de commandes soumises.

Validation effectuée : revue de propriété contre §§2–17 et exclusions §18 ; toutes les dépendances du graphe ciblent un module défini ; parcours de graphe sans cycle ; aucun module financier/patient/affectation. Ce contrôle est une preuve de conception, pas un test d’import de code absent. Modifications : ROADMAP.md seulement. Git absent, aucun commit/push. Suite : 1.5.

### Compte rendu du point 1.5 — Matrice exigences → cas → preuves

Date : 09/10/2026, Europe/Brussels. Statut : ☑ Validé pour le plan de validation et sa couverture. Audit : matrice 1.1 relue, 244 passages identifiés et 217 points uniques ; frontières 1.4 définies ; aucun code/tests exécutables encore présents.

La matrice initiale est enrichie en place par la colonne « Cas de validation ». Chaque passage CDC possède un identifiant V-CDC unique, une famille et la source exacte qui fournit ses assertions. La source reste intacte : toutes les propositions/conjonctions de sa ligne sont à vérifier, les variantes ci-dessous ne sont pas une réduction de la règle. Aucun test n’est réputé exécuté ; les rapports futurs porteront ces identifiants et les points concernés.

Protocole commun : données fictives uniquement ; propriétaire, admin délégué/non délégué, employé logistique/détaillé et cliniques A/B selon cas ; état initial explicite ; action nominale puis refus/conflict/rejeu pertinent ; contrôle effet serveur, versions/événements/outbox et absence de fuite. « A/B » sont des noms de fixtures conceptuelles, pas des identifiants existants. Les tests DB/stockage/charge seront isolés et bornés avant exécution, jamais des essais de saturation sur le volume partagé.

| Famille (section du cahier) | Fixture / contexte | Variantes concrètes et observations attendues | Niveau de preuve à produire |
|---|---|---|---|
| F-1 | Architecture + recette UX | Revoir portails privés, séparation des cliniques, opérations quotidiennes, historique et périmètre ; vérifier l’absence de finance/patient/affectation. | Revue de conception puis E2E |
| F-3 | Trois catalogues et travaux fictifs | Renommer/désactiver/retirer des références utilisées ; conserver snapshots ; soumettre indisponible avec avertissement, accepter avec justification sans réactiver ; interdire et tester progression/non-annulation/alerte/examen livré. | Unitaire + transactions + E2E |
| F-6 | Source livrée, remplacement et retouches | Tenter retouche sur non-livrée, refusée ou annulée ; formulaire sans FDI avec description obligatoire ; créer deux demandes en course, une active ; appliquer workflow commun ; rouvrir possibilité après refus/annulation/livraison ; vérifier lien au travail effectivement livré et absence de finance. | Concurrence + E2E chaîne |
| F-7 | Dates, planning et sortie physique | Comparer souhaitée/planifiée, repère provisoire et J-2/retard avec horloge Pristina ; drag desktop confirmer/annuler, mobile détail ; prêts uniquement Terminée ; livraison en lot revalidée ; correction motivée avec droits, refus si retouche contradictoire ; pas d’e-mail livraison/urgence ni filtre matériau. | Horloge + E2E appareils + transactions |
| F-8 | Originaux, suivi interne et pièces autorisées | Remplacer originaux avant fabrication selon workflow puis refuser après ; ajouter suivi interne sans écraser ; partager un fichier confirmé, révoquer futurs accès ; comparer ZIP/octets originaux et filtrage des noms/miniatures sous droits. | ACL/API + intégrité binaire |
| F-9 | Conversations A/B et par travail | Créer générale sans commande et distincte par travail/retouche ; reconnecter après rupture, vérifier déduplication et Lu partagé ; éditer/masquer seulement son message avec traces ; livrer et forcer envoi refusé, corriger livraison et rouvrir ; demandes vie privée restent messagerie générale. | Temps réel + concurrence + E2E |
| F-11 | Deux comptes, deux appareils, brouillons fictifs | Installer PWA, couper réseau et relancer ; joindre fichiers au brouillon chiffré ; verrouiller/déconnecter puis changer de compte ; suspendre pendant offline et reconnecter ; diverger local/serveur avec fichiers ; choix serveur ou copie locale ; acquittement perdu et catalogue actualisé ; aucune soumission automatique/cache officiel. | Appareils réels + crypto + interruption |
| F-12 | Flux artificiels et stockage de test borné | Couper upload, reprendre fragments validés, simuler réserve/ENOSPC sans remplir disque partagé ; expirer temporaires sans détruire brouillon/historique ; finalisation/idempotence ; consultation préservée et alertes hors app. | Stockage isolé simulé + contrôle capacité |
| F-14 | Horloge livraison, archives et rétention | Avancer à J+29 puis J+30, consulter archive et demander retouche ; corriger livraison et réinitialiser ; distinguer archive et suppression ; signaler échéance au propriétaire, gérer exception ; restaurer sauvegarde sans réapparition durable d’un effacement légitime. | Horloge + exercice rétention/restauration |
| F-15 | Traces sensibles et rôles fictifs | Déclencher actions importantes, contrôler auteur/date/objet/motif/diff minimal ; tenter lecture globale par admin/employé et édition/purge via UI/API ; inspecter logs/export ; exercer incident/révocation et limites de l’identité clinique partagée. | Sécurité négative + exercice responsable |
| F-16 | Pannes contrôlées hors production | Mesurer cohérence et RPO/RTO sur environnement isolé, sauvegardes chiffrées hors VPS et rotation30j ; arrêter app de test et vérifier alerte ; maintenance bloque opérations/sync mais brouillon local possible, sortie de secours ; annonce distincte de panne, sans e-mail/activation automatique. | Restauration chronométrée + exercice maintenance |
| F-17 | Documents et responsable compétent | Présenter textes albanais/version acceptée ; collecter validation attribuable des acteurs, transferts, dispositifs, rétention et incidents ; vérifier contacts/localisations réels et absence de données patient avant feu vert. | Revue juridique/professionnelle manuelle documentée |
| F-18 | Revue des exclusions | Chercher finance, patient transversal, comptes individuels internes clinique, affectation employés, mails non prévus, liens publics, transfert propriétaire UI, champs dents/description obligatoires, multi-matériau/teinte, purge historique et promesse anticopie ; vérifier leur absence. | Revue code/schéma/UI + tests négatifs |
| F-19 | Scénarios transversaux | Exécuter les interactions exactes de chaque ligne : pendance/version/correction/verrouillage, livraison-retouche, snapshot/cataloque, archive-rétention, ZIP, offline et attribution clinique. | Intégration + concurrence + revue |
| F-20 | Recette finale des 14 critères | Pour chaque critère numéroté, joindre résultats de ses cas fonctionnels et négatifs, appareils/exercices/avis requis ; refuser validation par simple build ou présence de fichiers. | Recette de bout en bout + responsable |
| F-2.1 | Quatre profils fictifs | Connecter propriétaire, admin secondaire, employé et clinique ; tenter gestion d’un autre admin et attribution individuelle ; vérifier compte partagé unique et audit global exclusif. | Intégration/API + E2E |
| F-2.2 | Comptes et tokens fictifs | Inscrire clinique non approuvée puis approuver/refuser ; inviter, expirer/rejouer, suspendre sessions multiples ; changer e-mail avec deux conditions et alerte ancienne adresse ; simuler récupération/transfert exceptionnel encadré. | Intégration + horloge simulée + exercice opérateur |
| F-2.3 | Matrice de grants | Pour chaque permission, enlever son prérequis puis tester accord/retrait ; comparer projections logistique/détaillée, lecture/réponse générale/commande, aperçu/téléchargement ; révoquer durant téléchargement/temps réel et vérifier destinataires. | Tests paramétrés négatifs/API/fichiers/événements |
| F-4.1 | Formulaires patients fictifs | Tester nom+prénom, référence seule et les deux ; refuser identité absente ou nom incomplet sans référence ; matériau/teinte uniques, type/description/dents facultatifs, 32 codes/cycle FDI, date souhaitée, numéro/horodatage serveur. | Validation frontière + tactile/E2E |
| F-4.2 | Fichiers artificiels de limites | Tester chaque format accepté et contenu trompeur ; limites exacte et ±1 octet (unité à acter), total initial/message, nombre non plafonné arbitrairement ; modifications/suivi/retouches sans quota nouveau non décidé. | Intégration/flux + appareils + capacité |
| F-4.3 | Deux cliniques A/B et concurrence | Rejouer la même soumission et une course ; un seul numéro. Proposer un travail similaire au sein de A et permettre continuer ; ne révéler aucun résultat de B, ne fusionner aucun patient sur nom. | Concurrence/transactions + E2E |
| F-5.1 | Chaque statut de travail | Parcourir transitions autorisées et refusées ; correction avec motif et renvoi explicite, refus sans réouverture, autoacceptation d’origine labo ; vérifier auteur/date et blocage sécurité distinct du statut. | Automate unitaire + intégration |
| F-5.2 | Deux sessions et version officielle | Modifier avant acceptation ; accepter une ancienne version doit échouer ; proposer sans changer officiel ; créer modification/annulation simultanément ; bloquer fabrication/édition labo durant demande ; retirer versus décider ; vérifier originaux verrouillés et chat sans effet officiel. | Concurrence + versions + API |
| F-5.3 | Clinique et labo à chaque statut | Annuler directement avant acceptation ; demander puis retirer/décider en Acceptée ; refuser clinique dès fabrication ; labo annule jusque fabrication avec motif ; refus ordinaire à Terminée/Livrée ; duplication nouveau numéro et revalidation. | Table acteur/statut + E2E |
| F-5.4 | Origine labo et clinique existante | Créer sous utilisateur habilité, obtenir Acceptée et auteur/origine ; refuser requête clinique usurpant origine ; vérifier e-mail/notification et demandes possibles avant fabrication sans approbation clinique supplémentaire. | API + outbox + E2E |
| F-5.5 | Travail commencé et nouveaux liens | Créer remplacement avec ancienne annulation motivée et nouveau numéro Acceptée ; créer supplément sans arrêter original ; provoquer un échec à mi-opération et contrôler atomicité, bidirection et instructions historiques ; revalider références. | Transactions + concurrence |
| F-10.1 | Six événements labo | Déclencher chacun des six événements, vérifier destinataires autorisés par catégorie et propriétaire par défaut ; traiter l’action puis contrôler un envoi devenu tardif ; les autres statuts ne créent pas un e-mail labo arbitraire. | Outbox avec fournisseur simulé |
| F-10.2 | Décisions cliniques et retouches | Déclencher chaque décision positive/négative prévue, création/édition/annulation labo ; vérifier liens privés sans patient ; vérifier exclusions soumission clinique/fabrication/livraison/urgence/maintenance et avis sécurité d’e-mail. | Outbox + confidentialité |
| F-10.3 | Horloge virtuelle et non-lus | Lire avant 30 min, attendre 30 min sans lecture ; tester nouveaux messages, absence de nouveaux, seuil ≥24 h après rappel, nouveaux non lus ≥30 min ; lecture complète réinitialise et regroupe les arrivées. | Horloge déterministe + boîte partagée |
| F-10.4 | Fournisseur e-mail simulé en panne | Faire réussir une décision avec fournisseur indisponible ; contrôler outbox/relances/doublons, statut accepté fournisseur sans promesse de réception, obsolescence tardive et alerte critique indépendante vers propriétaire. | Panne contrôlée + worker |
| F-13.1 | Parcours laboratoire par habilitation | Traiter file d’actions, liste/détail, calendriers/livraison, cliniques et conversations, paramètres/audit/mails/stockage ; ouvrir notification sans solder action ; pas de métriques financières envahissantes. | Recette UX/E2E tablet |
| F-13.2 | Parcours clinique albanais | Inscription/attente/login/récupération, commande/correction/demande/retrait/duplication/retouche, messages/fichiers/notifications/brouillons ; tester petit écran, réseau et documents légaux. | Recette tactile/E2E |
| F-19.1 | Responsables et preuves de faisabilité | Obtenir validations ciblées métier ; auditer infrastructure sans toucher voisins ; tester navigateurs/chiffrement, fichiers/ZIP/antimalware, restauration et récupération ; obtenir décisions juridiques avant patients. | Exercices techniques + validations attribuables |
| F-19.2 | Paramètres non encore actés | Identifier seuils/TTL/invitations/restore non décidés, les figer seulement au point pertinent ; vérifier que design et garanties ne créent pas finance/2FA/validation clinique/suppression non autorisée. | Revue ADR/périmètre avant implantation |

Compléments non tabulaires : introduction/objectifs généraux sont couverts par F-1 ; paragraphes légaux non listés par F-17 ; distinction architecturale du §19.2 par F-19.2 ; §21 et interdiction finale de patients réels avant sécurité/conformité par F-17/F-20 et G2–G7. Les valeurs à décider (octets de Mo/Go, seuils/TTL, crypto, durée invitations, rôles légaux) ne deviennent pas des fixtures arbitraires : elles restent décisions ouvertes en 1.6. Les précisions métier signalées lors de 1.1 restent à traiter au point concerné avant de coder leur assertion.

Critères de réception du plan : 244 passages = 244 identifiants de cas distincts ; chaque cas pointe une famille définie et des points roadmap existants ; chaque source et exclusion est conservée ; les avis humains et preuves terrain sont distingués de l’automatisation. Vérification exécutée : parse/décompte, unicité des cas et références, comparaison des colonnes de source/points/preuve à la matrice précédente, revue manuelle des interactions critiques. Aucune validation applicative/clinique/juridique aujourd’hui.

Modifications : ROADMAP.md uniquement (colonne et catalogue des variantes, statut 1.5). Git absent, aucun commit/push. Suite : 1.6.

### Compte rendu du point 1.6 — Registre des risques et décisions ouvertes

Statut : TERMINÉ pour le registre ; aucune résolution technique ou juridique n’est présumée. Responsables ci-dessous : rôles attendus, pas personnes déjà désignées. L’agent prépare les preuves dans son périmètre ; le propriétaire désigne les intervenants manquants et tranche les choix métier. Chaque entrée reste OUVERTE jusqu’à preuve ou décision consignée.

| ID | Constat / risque ou décision ouverte | Responsable attendu | Point bloquant et condition de clôture |
|---|---|---|---|
| R01 | CLÔTURÉ à 2.1 par audit administrateur utilisateur et contrôles directs concordants ; identité/dossier/sudo/protection des chemins audités établis. Isolation réseau et autres chemins non garantie. Ancien constat : identité et dossier dédiés vérifiés ; politique sudo complète et protection effective des projets voisins non prouvées. RDC bloque sudo ; le groupe users ne démontre ni accès ni absence d’accès. | Administrateur VPS | 2.1 : audit sudo/ACL attribuable par administrateur, sans lecture de secrets voisins ni élargissement des droits. |
| R02 | Restrictions actuelles non assimilables à une isolation réseau/processus ; interdiction utilisateur de contacter les services voisins. | Administrateur VPS + propriétaire | 2.2–2.4 / G1 : preuves administrateur des frontières et approbation explicite du mode d’isolation en 2.3. Ne pas exécuter les sondes interprojets suggérées par la roadmap. |
| R03 | Migrations2.6 validées ; préparation/conception runtime indépendant2.7–2.8 validées sans installation ; secrets et permissions opérationnels à prouver19.3–19.4. | Administrateur VPS/DB | 2.5–2.8 : identité runtime séparée, migrations bornées et secrets protégés ; aucune délégation générique ni code éditable lancé sous root/postgres. |
| R04 | Versions compatibles déclarées, sans résolution/installations encore faites ; évolution possible avant installation. | Agent | 5.2 et fondations : revérifier versions stables, engines/peers, résolution et contrôles ; TS6 retenu, ne pas imposer TS7. |
| R05 | PWA et stockage chiffré réalisables par API ; quotas, éviction, verrouillage et fichiers volumineux pas éprouvés sur appareils réels. | Agent + propriétaire pour appareils cibles | 3.8, 15.3, 15.10 / G3 : crypto et récupération conçues, tests navigateurs/appareils avec quota atteint et pertes contrôlées ; aucune garantie illimitée de stockage local. |
| R06 | Hors ligne, suspension non instantanément révocable ; conflit et envoi doivent rester explicites. | Agent + propriétaire pour recette | 15.5–15.9 / G3 : isolation par compte, purge au retour réseau, version concurrente, reprise/ack fichiers et absence de soumission automatique démontrées. |
| R07 | Volume partagé : espace disponible observé, aucune réserve dédiée garantie. Unités exactes Mo/Go, seuils disque et TTL fragments non actés. | Agent pour proposition ; propriétaire + administrateur pour capacité | 3.7, 12.3–12.8, 19.1–19.2 : unités et seuils consignés, réserve/topologie approuvées, charge/ZIP/reprise/antimalware évalués sans saturation des voisins. |
| R08 | Rétention catégories, qualification des acteurs, localisation/transferts et traçabilité réglementaire Kosovo non validés. Archive UI 30 jours ne fixe pas la suppression. | Propriétaire + conseil juridique compétent à désigner | 3.10, 17.9–17.13 / G5 : avis et décisions attribuables avant données de patients réels ; aucune durée légale inventée. |
| R09 | RPO ≤1 h, RTO ≤4 h et sauvegarde hors hôte chiffrée 30 jours exigés ; destination, clé, cohérence fichiers/DB et restauration non démontrées. | Administrateur + propriétaire ; agent pour protocole | 3.10, 19.9–19.10 / G4 : destination et accès bornés, exercice de restauration chronométré et preuve de cohérence, gestion clés/incident. |
| R10 | Fournisseur e-mail, identité expéditeur/DNS et destinataires opérationnels non définis ; alerte critique doit survivre à panne applicative. | Propriétaire + administrateur ; agent pour intégration | Chapitre 14, 19.3, 19.7–19.8 : choix/configuration et tests panne/retry/doublons/non-lus ; pas de promesse de réception à partir de l’acceptation fournisseur. |
| R11 | Domaine/TLS et services dédiés non configurés ; pas de modification autorisée des services existants par défaut. | Propriétaire + administrateur | 19.4–19.6 : identité et chemins dédiés, TLS, routage et changements revus ; arrêter si un autre projet peut être affecté. |
| R12 | Git absent, remote et identité de commit non établis. | Agent pour dépôt local ; propriétaire pour remote/identité | 5.1 : configuration examinée, identité/remote autorisés avant commit/push applicable ; aucun remote déduit d’un projet voisin. |
| R13 | Compte clinique partagé demandé ; attribution individuelle limitée. Invitations/expiration/récupération et textes légaux non figés. | Propriétaire + conseil juridique ; agent pour sécurité | 7.8, chapitre 7, 17.4–17.5 : paramètres/textes validés et permissions/session testées ; ne pas imposer 2FA obligatoire ni comptes employés cliniques. |
| R14 | Précisions métier déjà repérées en 1.1 : motif de refus clinique (7.4), modifications du profil par clinique (7.5), limites des travaux de remplacement selon état source à formaliser. | Propriétaire | 3.5–3.6, 7.4–7.5 : confronter clauses exactes et poser question ciblée avant toute règle supplémentaire ; aucune fonctionnalité déduite du seul intitulé roadmap. |
| R15 | Interface albanaise, tactile et scénarios complets non réalisés ; conformité documentaire ne prouve pas qualité clinique ni applicative. | Agent + propriétaire pour recette albanaise | Chapitre 4, chapitre 20 / G6–G7 : contrôle traductions/accessibilité et recette réelle ; tous points obligatoires doivent disposer de leur propre preuve. |

Validation du registre : 15 identifiants distincts, responsables et conditions de clôture renseignés ; correspondance revue avec cahier des charges §19.1–19.2, consigne et jalons existants. Pas de nouvelle exigence métier. Les inconnues sont conservées comme telles ; R01 sera traité immédiatement au prochain audit, sans contourner le connecteur.

Modifications : ROADMAP.md uniquement (registre et statut 1.6). Aucun paquet installé, code applicatif, migration, service ou permission modifié. Git absent, aucun commit/push. Suite : 2.1.

### Compte rendu du point 2.1 — Réaudit identités Linux et ACL

Statut : BLOQUÉ. Date de session : 09/10/2026, UTC. Audit effectivement exécuté par RDC sur vps-28bf7789 : id, hostname, getent passwd dental-ai, getfacl du projet et du HOME dédié, chemin réel, inventaire limité aux cinq documents du projet, propriétaires/modes/liens/hachages, absence de Git ; configuration RDC relue.

Résultats : UID/GID 1002 dental-ai, groupe additionnel users (100), HOME /home/dental-ai ; dossier /srv/dental-lab et HOME 700 sans ACL étendue affichée ; cinq fichiers 600 appartenant à dental-ai, aucun lien symbolique ; quatre références inchangées. Six points du chapitre 1 validés. Aucun code installé, SQL modifié, service ou permission changé.

Cause : critère 2.1 exige contrôle sudo et protection effective des autres projets. Commande sudo explicitement bloquée par RDC ; ne pas tenter chemin alternatif, wrapper ou changement de configuration. L’absence du groupe sudo ne prouve pas l’absence de règles sudoers individuelles. Les ACL du dossier dédié ne prouvent pas les protections des dossiers voisins. Aucune lecture de projet voisin/secrets ni connexion à service voisin effectuée. Point non validable avec les seules preuves obtenues.

Action humaine minimale : administrateur VPS, fournir résultat expurgé de sudo -l -U dental-ai (en identité administrateur, sans modifier la politique) et rapport de contrôle des permissions/ACL effectives du compte dental-ai, y compris groupe users, sur les autres projets et leurs répertoires parents. Confirmer absence de lecture/écriture des secrets et absence de droits d’altération des autres projets ; si une délégation existe, préciser commandes et cibles bornées et qui peut modifier les exécutables concernés. Aucun besoin d’accorder sudo à l’agent ni de transmettre des secrets. L’administrateur choisit les chemins réels depuis son inventaire ; l’agent ne les invente pas.

Modifications : ROADMAP.md uniquement, statut 2.1 et ce rapport ; registre R01 reste ouvert. Aucun commit/push (Git absent). Arrêt avant 2.2 et avant installation. Reprise : vérifier identité, hachages, preuves administrateur et état réel ; clôturer 2.1 seulement si son critère est satisfait, puis poursuivre 2.2 avec les restrictions utilisateur prévalant sur les sondes suggérées.

### Réévaluation du point 2.1 — Preuves administrateur intégrées

Date : 09/10/2026, session commencée à 12:32 Europe/Brussels. Statut final : TERMINÉ. Le blocage du précédent compte rendu est levé pour 2.1 ; ce compte rendu historique reste conservé.

Preuve fournie par l’utilisateur, issue de son audit administrateur complémentaire, et explicitement autorisée comme preuve : sudo -l -U dental-ai ne donne aucun droit sudo ; UID/GID 1002, groupes dental-ai et users (100) ; /srv/dental-lab dental-ai:dental-ai 700 ; /home/debian drwx--x--- avec ACL de traversée uniquement pour remote-planning-walibi, pas dental-ai ; /home/debian/apps et huit dossiers voisins debian:debian 775, aucune ACL supplémentaire pour dental-ai. Tests effectifs sous dental-ai rapportés : lecture refusée sur /home/debian/apps, flos-bikes, elamora, llg, /home/debian/.ssh et /etc/shadow. Résultats attribués à l’audit utilisateur, non présentés comme commandes exécutées par l’agent ; aucun contenu secret demandé.

Vérification directe à la reprise : appareil RDC d378742a-d803-4e4f-be42-22c866312043 en ligne, hostname vps-28bf7789 ; commandes exécutées UID/GID 1002 dental-ai, groupes concordants ; chemin réel /srv/dental-lab ; ACL projet rwx/---/--- ; cinq documents 600 appartenant à dental-ai sans lien symbolique ; quatre références inchangées par hachage ; Git absent. RDC conserve sudo bloqué et chemins autorisés /srv/dental-lab, /home/dental-ai.

Conclusion limitée : critères identités/groupes/sudo/dossier/protection des projets voisins satisfaits par ces preuves combinées ; aucun droit élargi ni altération de service. Le parent /home/debian protège la traversée malgré les modes 775 en aval. Aucune conclusion d’isolation complète des ports, processus, ressources partagées ou de tous les chemins système. Les refus PostgreSQL des huit autres bases rapportés par l’utilisateur seront considérés à 2.5, sans nouvelle tentative vers ces bases.

R01 du registre : CLÔTURÉ pour les éléments demandés à 2.1 sur les chemins audités ; R02 reste ouvert et toute protection non démontrée reste non garantie. Modifications : ROADMAP.md uniquement, statut 2.1 et cette preuve. Aucun paquet, migration, permission ou service modifié ; aucun commit/push (Git absent). Suite : 2.2.

### Compte rendu du point 2.2 — Frontières réseau et processus

Date : 09/10/2026, Europe/Brussels (UTC+02:00). Statut : BLOQUÉ ; audit partiel terminé en lecture seule, pas de validation du point.

Périmètre effectivement audité : propre processus lancé via RDC sous dental-ai (UID/GID effectifs, réels et sauvegardés 1002), /proc/self uniquement pour métadonnées de sécurité/namespaces/cgroup, limites du processus et espace du volume portant /srv/dental-lab. Aucun environnement, ligne de commande de processus voisin, secret ou contenu de service inspecté ; aucun scan, connexion, listener, bind, accès à socket voisin ou tentative sur autre base. Documents et restrictions relus ; configuration RDC inchangée. Les noms de namespaces ci-dessous identifient uniquement le processus courant ; aucune comparaison aux processus voisins n’a été faite.

Résultats réels :
- CapInh/CapPrm/CapEff/CapAmb : 0 ; CapBnd : 000001ffffffffff ; NoNewPrivs : 0 ; Seccomp : 0 et Seccomp_filters : 0. L’absence de capabilities effectives ne constitue pas une isolation réseau.
- Namespaces propres : user [4026531837], net [4026531840], pid [4026531836], mnt [4026531841]. Ces identifiants seuls ne prouvent pas la séparation de l’hôte ou des voisins.
- Cgroup propre : 0::/user.slice/user-1000.slice/session-173.scope. UID effectif 1002 confirmé indépendamment ; ce chemin ne démontre pas une unité de confinement dédiée à dental-ai, ni des quotas dédiés. Aucun processus du compte 1000 inspecté.
- RLIMIT_CPU, RLIMIT_AS, RLIMIT_FSIZE : (-1, -1) ; RLIMIT_NPROC : (30859, 30859) ; RLIMIT_NOFILE : (524288, 524288). Aucune limite cgroup CPU/mémoire/IO dédiée démontrée.
- Volume projet : total 79048540160 octets, utilisé 18406973440, libre 57378197504 ; instantané de volume partagé, pas une réserve contractuelle dédiée.
- Commande d’audit achevée avec code 0 ; reprise 2.1 également achevée avec code 0. Aucun échec de connexion Remote.

Risques identifiés et limites des preuves : protection fichiers établie en 2.1 ne protège pas automatiquement services accessibles par réseau local, sockets, visibilité des processus ou consommation des ressources partagées. Inventaire des chemins réseau/socket réellement accessibles, réglages de visibilité des processus et restrictions effectives non établis dans le périmètre permis. Les interdictions opérationnelles sont appliquées, mais leur respect par l’agent ne prouve pas un confinement système.

Cause de blocage : 2.2 demande audit des frontières et contrôles décidés. Les sondes interprojets suggérées par la roadmap sont interdites par l’utilisateur et ne seront pas exécutées. Sans preuves administrateur des frontières effectives, leur évaluation reste partielle et aucun contrôle technique suffisant ne peut être déclaré décidé/vérifié. Il ne s’agit pas d’exiger une isolation complète du VPS par défaut : le niveau retenu et ses limites doivent être documentés, puis le mode d’isolation fera l’objet de 2.3, sans sauter 2.2.

Action humaine minimale attendue : rapport administrateur expurgé, limité aux droits et restrictions de dental-ai/RDC, précisant :
1. Séparation ou partage des namespaces réseau/processus et règles effectives bornant les accès réseau locaux ; si aucune restriction dédiée, le dire explicitement sans présenter les ACL fichiers comme une protection réseau.
2. Visibilité et possibilités d’action sur les processus des autres identités, et accessibilité des sockets sensibles/administrateurs réellement présents, contrôlées depuis l’inventaire administrateur ; aucun secret ni test vers les applications en production demandé.
3. Unité/cgroup et limites éventuelles CPU/mémoire/IO/processus applicables à dental-ai/RDC ; distinguer limites effectives et absence de quotas.
4. Contrôles retenus pour les risques constatés, ou propositions à trancher avant toute modification. Toute modification d’isolation/permissions nécessite son autorisation propre ; ne donner à l’agent aucun accès plus large.

Modifications : ROADMAP.md uniquement (statut 2.2 et ce compte rendu). R02 reste ouvert. Pas d’installation, code, migration, privilège, configuration RDC, service ou projet voisin modifié. Git absent, aucun commit/push. Arrêt ici ; 2.3 non commencé. Reprise : contrôler Remote et identité, intégrer les preuves ciblées et clôturer 2.2 seulement si son critère est satisfait.

### Réévaluation du point 2.2 — Service dédié et frontières effectives

Session : 09/10/2026, début 12:49 Europe/Brussels. Statut final : TERMINÉ pour l’audit ; ancien blocage conservé comme historique et levé par les nouvelles preuves. Critère exact : risques de traversée identifiés et contrôles décidés ; pas une certification d’isolation complète.

Contrôles directs exécutés via RDC sous UID/GID 1002 dental-ai sur vps-28bf7789 :
- Identité, chemin réel /srv/dental-lab et ACL 700 concordants ; quatre documents de référence inchangés par SHA256 ; roadmap identique à l’état précédent avant intervention.
- Propre processus dans /system.slice/dental-ai-remote.service. systemctl show ciblé : service active/running, enabled, User/Group dental-ai ; WorkingDirectory /srv/dental-lab. Unité réelle /etc/systemd/system/dental-ai-remote.service, root:root 644, non modifiable par dental-ai, pas de lien ni drop-in affiché. Lecture limitée aux propriétés non sensibles, sans Environment ou commandes contenant des secrets.
- Limites effectives lues dans le cgroup : memory.max 1073741824 ; cpu.max 50000 100000 ; pids.max 100. Correspondance MemoryMax=1G (1 Gio), CPUQuota=50% d’un cœur, TasksMax=100. Quotas applicables aux processus de cette unité, pas garantie de capacité disque réservée ni borne du total de tous les futurs processus du compte.
- NoNewPrivileges=yes et NoNewPrivs=1 ; ensembles capabilities effectifs/permis/héritables/ambiants nuls, CapabilityBoundingSet et AmbientCapabilities vides dans systemd ; Seccomp=2 pour le processus courant. ProtectSystem=strict, ReadWritePaths /home/dental-ai et /srv/dental-lab, PrivateTmp/PrivateDevices=yes, ProtectProc=invisible. ProtectHome=no : confidentialité des homes repose aussi sur les ACL, pas sur une invisibilité générale des chemins.
- /proc courant monté hidepid=invisible ; test de métadonnées os.access('/proc/1/status', R_OK) = False, sans lecture du contenu du processus 1. Le résultat utilisateur antérieur « lisible » est conservé comme observation d’un autre contexte ; il ne décrit pas ce processus Remote actuellement confiné. kernel.yama.ptrace_scope lu = 0 ; aucune modification globale de ce réglage.
- PrivateNetwork=no ; AF_UNIX/AF_INET/AF_INET6 autorisés ; IPAddressAllow/Deny vides au niveau de cette unité. Aucune isolation du réseau local ni politique exhaustive du filtrage hôte démontrée. ProtectSystem en lecture seule ne filtre pas les connexions aux sockets.
- Preuves administrateur utilisateur supplémentaires attribuées comme telles : aucun socket Docker/Podman aux emplacements vérifiés (pas preuve d’absence partout), socket PostgreSQL accessible en permissions fichiers mais permissions d’audit SQL bornées ; nft/ufw absents ne démontrent pas absence de filtrage. Dental-site.service resté actif selon l’utilisateur ; aucune inspection/action de l’agent sur ce service voisin.
- Git initialisé par l’utilisateur depuis la session précédente : main propre, cinq documents suivis, HEAD et origin/main 6d01a90e06d4aa5f9f8ebb7f972c4534efb9b228 ; remote git@github-dental:ResulR/dental_app_v1.git, alias SSH résolu vers github.com sous git ; git ls-remote confirme main distant au même hash. Identité Git existante Dental Lab Agent / dental-ai@localhost conservée. Point 5.1 non marqué automatiquement validé : audit dédié quand il devient éligible.

Risques et contrôles retenus :
1. Traversée par fichiers/processus : compte sans sudo (preuve 2.1), ACL, unité root non éditable, capabilities retirées, NoNewPrivileges, montage système protégé et /proc invisible ; pas d’essai de ptrace/signal sur un voisin.
2. Ressources : bornes CPU/mémoire/tâches démontrées pour Remote ; disque/IO et hôte restent partagés, pas de stress test ni de réserve déduite ; capacité à traiter aux points prévus.
3. Réseau et sockets : risque résiduel explicite, absence de confinement réseau démontré ; interdiction absolue de scan/connexion aux services voisins, seul dental_lab permis pour PostgreSQL. L’approbation du mode d’accès et de ces limites relève de 2.3 ; aucun droit réseau supplémentaire accordé ou test interprojet lancé.
4. Secrets : aucun environnement/token/secret SQL/SSH lu ou exposé ; répertoire HOME dédié techniquement accessible, obligation de ne pas publier ses secrets. Les filtres RDC ne remplacent pas les contrôles Linux.

Conclusion : informations manquantes à l’audit précédent désormais établies ou explicitement bornées ; contrôles actuels consignés, limites et responsabilités connues. Aucun contrôle imposé par 2.2 n’exige ici une isolation réseau complète ; les tests interdits sont remplacés par preuves administrateur et métadonnées autorisées. Ne pas assimiler validation 2.2 à approbation 2.3 ou porte G1 achevée.

Modifications : ROADMAP.md (statut et preuve), création docs/EXECUTION_LOG.md maintenant que Git existe, conformément à CONSIGNE §6. Pas de code applicatif, paquet, migration, permission ou service modifié. Validation documentaire : statuts/217 points/244 cas, références conservées, diff limité aux deux fichiers et contrôle de secrets. Git : résultat réel communiqué après opérations, aucun hash présumé. Suite automatique : 2.3, comparaison puis application de son critère d’approbation explicite.

### Compte rendu du point 2.3 — Comparaison du mode d’isolation de l’agent

Session : 09/10/2026, début 12:49 Europe/Brussels. Statut : BLOQUÉ sur approbation explicite ; analyse et proposition préparées, aucune modification technique de l’isolation effectuée.

État initial audité : 2.2 validé par commit 53540f67786ea4ce52ef3fa87755c19f9b69e4fa, poussé et confirmé égal au main distant ; Git propre après ce commit. systemd 257.13-1~deb13u1, unité dédiée et contrôles effectifs détaillés au compte rendu 2.2. Commandes podman/docker/pasta/slirp4netns non trouvées dans le PATH de cette session ; absence de disponibilité observée, pas affirmation d’absence de tous binaires/containers sur l’hôte.

| Option | Protection envisagée / état réel | Limites et travail requis | Avis pour cette mission |
|---|---|---|---|
| A — Utilisateur dédié seul | ACL et droits SQL minimaux déjà établis, sans service de confinement dans cette option théorique. | Ne reprend pas les bornes CPU/mémoire/tâches et protections de montage actuellement actives ; réseau/processus nécessiteraient contrôles séparés. | Ne pas remplacer le mode actuel par une protection moindre. |
| B — Utilisateur dédié + confinement systemd actuel | État réellement disponible : unité root non éditable, UID 1002, capacités nulles, NoNewPrivileges, quotas 1 Gio/50% CPU/100 tâches, protections système/proc/tmp/devices ; deux chemins de travail définis. | Réseau local et sockets Unix pas complètement cloisonnés ; noyau, disque/IO et hôte partagés ; permissions des fichiers encore importantes. HOME dédié accessible, ses secrets restent à protéger. | Proposition recommandée pour poursuivre l’agent dans le périmètre autorisé, sous acceptation explicite de ces limites ; pas autorisation de production ou de données patients. |
| C — Conteneur rootless dédié | Option possible à concevoir avec namespace utilisateur, montages minimaux, réseau et ressources configurés. Aucun moteur disponible dans le PATH ici. | Faisabilité (moteur, délégations, mapping UID, réseau, volumes, accès dental_lab/Remote) non auditée ; nouvelle préparation administrateur et tests indispensables. Partage du noyau et risques de mauvais montages/réseau subsistent. | Alternative si un confinement plus fort est demandé ; ne pas installer/configurer sans décision et procédure dédiée. |
| D — VPS séparé dédié | Séparer le système invité du laboratoire de celui portant les projets voisins ; topologie future, non disponible vérifiée. | Nouvel environnement, accès, sauvegardes, réseau et migration de préparation à organiser ; pas de prix ni de délai supposé. Les services du laboratoire nécessitent toujours leurs propres permissions et contrôles. | Alternative pour réduire la dépendance aux protections d’un hôte multi-projets ; décision d’hébergement par propriétaire, pas action automatique de l’agent. |

Proposition concrète B, à approuver pour l’accès IA :
- Conserver l’unité actuelle dental-ai-remote.service et son identité UID 1002 ; pas de sudo, de capabilities supplémentaires ou d’accès aux voisins.
- Écritures de projet seulement dans /srv/dental-lab ; HOME dédié utilisé uniquement pour les besoins déjà autorisés du connecteur/outillage/Git, sans publier de secrets. Les tmp privés techniquement accessibles ne deviennent pas un nouveau répertoire de projet autorisé.
- PostgreSQL exclusivement dental_lab, compte d’audit pour l’audit ; runtime/migrations restent à encadrer aux points prévus. Pas de scan ou connexion aux services voisins, même techniquement accessibles.
- Accepter pour ce mode d’agent les limites démontrées : pas de garantie de confinement réseau/IPC complet, partage noyau/disque/IO et protections non exhaustives de tous les chemins ; toute modification de périmètre/isolation se traite séparément avant exécution.
- Respecter toutes les portes de validation suivantes, particulièrement sécurité, sauvegardes et conformité avant patients réels. Ce choix ne vaut ni déploiement ni acceptation de toute future configuration production.
- Réauditer identité/cgroup/limites à chaque reprise ; arrêt si connexion perdue, identité différente, limites inattendues ou besoin hors périmètre.

Sources primaires consultées pour distinguer mécanismes et limites : documentation systemd, https://raw.githubusercontent.com/systemd/systemd/main/man/systemd.exec.xml (ProtectProc, ProtectSystem et sockets) ; documentation Podman, https://docs.podman.io/en/latest/markdown/podman.1.html (rootless). Les propriétés réellement observées sur systemd 257, et non des options de versions futures, fondent la proposition B. Les options C/D sont des scénarios, pas installations réalisées ni garanties testées.

Critère bloquant exact, ROADMAP 2.3 : « Solution explicitement approuvée pour l’accès IA ; aucun accès global par défaut. » L’utilisateur confirme une configuration permanente opérationnelle et ses résultats ; aucune approbation explicite du choix comparé et de l’acceptation de ses limites résiduelles n’est présumée. La recommandation B est prête à être examinée ; il manque seulement cette décision de mode, pas un nouvel audit global ou une permission élargie.

Action attendue : propriétaire, approuver B pour l’agent avec les limites ci-dessus, ou choisir C/D et faire organiser la préparation ciblée correspondante. Aucune question de poursuite ordinaire. À réponse, réauditer, consigner l’approbation et clôturer 2.3 si elle couvre la solution ; poursuivre alors 2.4.

Modifications : ROADMAP.md (statut, comparaison/proposition/limites) et docs/EXECUTION_LOG.md (trace et commit 2.2 réel). Vérifications : comparaison des quatre options, critères relus, 217 points/244 cas préservés, diff et contrôle secrets. Aucun service/unité/permission/paquet/code/migration modifié, aucun accès voisin effectué. Changements 2.3 conservés non commités et non poussés dans l’attente de décision, attribuables à cette intervention. Arrêt avant 2.4 ; R02 reste ouvert pour cette approbation.

### Décision approuvée et clôture du point 2.3

Date de décision utilisateur : 09/10/2026 à 13:31 Europe/Brussels. Statut final : TERMINÉ pour la phase de développement. L’approbation explicite lève le blocage de décision du compte rendu précédent ; l’analyse comparative et son historique restent conservés.

Choix approuvé : option B, maintien de dental-ai dans le confinement systemd actuel, exclusivement comme mode d’isolation de l’agent pendant le développement. Conditions utilisateur consignées :
1. Utilisateur dédié dental-ai, sans sudo général.
2. Maintien des protections systemd et limites CPU/mémoire/tâches existantes.
3. Interdiction d’accéder aux projets voisins, leurs services, sockets ou données, même techniquement accessibles.
4. Risques résiduels réseau local/processus/IPC/ressources partagées explicitement documentés ; aucune présentation comme isolation complète du VPS.
5. Aucune donnée médicale réelle avant validation des contrôles sécurité/confidentialité/production.
6. Réévaluation obligatoire avant production, notamment si réglementation ou tests révèlent l’insuffisance de systemd seul.
7. Aucune modification globale du VPS ou des applications voisines autorisée par cette décision.

Vérifications directes de reprise : appareil en ligne, UID/GID 1002 dental-ai ; cgroup /system.slice/dental-ai-remote.service ; NoNewPrivs=1, CapEff/CapAmb nuls ; memory.max 1073741824, cpu.max 50000 100000, pids.max 100 ; service active/enabled, User/Group dental-ai, capacités systemd vides, ProtectSystem=strict, ProtectProc=invisible, PrivateTmp/PrivateDevices=yes, chemins ReadWritePaths inchangés. PrivateNetwork=no reste consigné. RDC garde mêmes chemins autorisés et commandes bloquées. Les quatre références sont inchangées ; les deux modifications Git en attente sont exactement celles de 2.3 et leurs hashes concordent avec la session précédente.

Correspondance au critère exact : solution explicitement approuvée pour accès IA en développement, aucun accès global par défaut ajouté. Aucun besoin obligatoire de développement identifié incompatible avec cette décision ; garanties de sécurité/production non encore validées restent des portes ultérieures, pas promesses acquises. R02 : approbation de développement satisfaite ; risques résiduels persistent et réévaluation obligatoire à préparer avant production (19.1–19.2 et G1/G2/G5 selon les résultats).

Modifications : ROADMAP.md et docs/EXECUTION_LOG.md uniquement. Aucune modification du service, des ACL, de sudo, de SQL ou du réseau ; aucun paquet installé. Vérifications documentaires : critères/statuts, 217 points/244 cas conservés, diff ciblé, absence de secrets et whitespace check. Commit/push seulement après réussite de ces contrôles ; résultat réel consigné au point suivant. Suite automatique : 2.4.

### Compte rendu du point 2.4 — Encadrement du connecteur Remote

Session du 09/10/2026, début 13:31 Europe/Brussels. Statut : DÉJÀ CONFORME pour le mode de développement approuvé en 2.3 ; aucune reconfiguration du connecteur nécessaire. Commit 2.3 réel : 794af590335ab012ae66ab34f05022c65323efa1, poussé et confirmé égal au main distant, arbre propre avant cet audit.

Vérifications réellement exécutées :
- Appareil d378742a-d803-4e4f-be42-22c866312043 en ligne sur vps-28bf7789 ; commandes UID/GID 1002 dental-ai, cgroup dédié confirmé. Aucun changement d’identité ou credential Linux debian utilisé.
- Configuration RDC relue : allowedDirectories /srv/dental-lab et /home/dental-ai ; sudo/su et autres commandes sensibles toujours bloqués. Deuxième chemin conservé pour l’outillage dédié conformément à 2.3, pas nouveau périmètre de projet.
- Contrôle positif read_file sur /srv/dental-lab/CONSIGNE.md : lecture autorisée.
- Contrôle négatif read_file sur /proc/self/status (métadonnées publiques de son propre processus, sans secret voisin) : refus explicite « Path not allowed », chemins permis affichés. Résultat négatif attendu = test de refus réussi ; aucune tentative de lire ce contenu par une autre voie après refus.
- Particularité du terminal : son cwd initial est /home/dental-ai/.npm/_npx/c329005a7fd3ed13/node_modules/@wonderwhy-er/desktop-commander/dist, malgré WorkingDirectory=/srv/dental-lab du service. Un contrôle initial ajoutant l’exigence plus stricte « cwd initial exactement /srv/dental-lab » a donc quitté avec code 1, avant toute écriture. Ce résultat est consigné, non masqué : ce défaut initial dans le HOME d’outillage autorisé n’est pas un accès voisin ni le répertoire retenu pour une intervention du projet.
- Contrôle du garde-fou effectif utilisé dans toutes les commandes de projet : set -eu ; vérifier id -u =1002 et id -un =dental-ai ; cd /srv/dental-lab ; vérifier pwd -P exactement /srv/dental-lab avant audit/modification. Test avec assertions UID, cwd, cgroup et arbre Git propre : PASS. Ne jamais utiliser de chemin relatif de projet avant ce garde-fou.
- Aucun secret du connecteur, environnement, SSH ou autre application lu/exposé ; aucune demande de credential debian.

Conclusion et limites : identité dédiée, opérations de projet dans le chemin vérifié, refus hors chemins de l’API fichier et absence d’utilisation de credentials debian satisfont le critère 2.4. Le contrôle supplémentaire sur le cwd initial ne devient pas une nouvelle exigence métier/sécurité ; le garde-fou existant produit le contexte de travail requis. Les filtres de fichiers RDC ne bornent pas à eux seuls toute commande shell : protections Linux/systemd et restrictions utilisateur restent indispensables, avec risques acceptés pour développement en 2.3. Aucun confinement complet supplémentaire revendiqué.

Modifications : ROADMAP.md (statut/preuves) et docs/EXECUTION_LOG.md seulement. Aucune option de sécurité, permission, unité, service ou projet voisin modifié. Vérifications documentaires/diff/secrets avant commit ciblé ; résultat Git réel consigné ensuite. Suite automatique : 2.5, audit lecture seule exclusivement dental_lab.

### Compte rendu du point 2.5 — Audit PostgreSQL dental_lab

Session du 09/10/2026, début 13:31 Europe/Brussels. Statut : BLOQUÉ sur preuve de configuration HBA manquante. Commit 2.4 réel : 619a8cba8284577008d11af7840680b1c03345a2, poussé et confirmé égal au main distant ; arbre propre avant cet audit.

Commande réellement exécutée : psql -X -w -U dental-ai -d dental_lab, pager désactivé et ON_ERROR_STOP ; transaction BEGIN READ ONLY, requêtes de métadonnées ciblées puis COMMIT de cette transaction en lecture seule. Aucune connexion à une autre base, aucun mot de passe demandé/affiché, aucune écriture SQL.

Résultats :
- current_database dental_lab, current_user/session_user dental-ai ; PostgreSQL 17.11 (Debian), transaction_read_only on.
- Base appartenant à dental_lab_owner ; dental-ai CONNECT oui, CREATE et TEMP non.
- dental-ai LOGIN sans superuser/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS.
- dental_lab_owner/audit/migrator/app existent, NOLOGIN, aucun de ces privilèges élevés. Objets existants conservés, pas de recréation.
- Seule appartenance visible concernant ces membres : dental-ai membre de dental_lab_audit, ADMIN OPTION non, INHERIT/SET oui ; aucune appartenance migrator/app donnée à dental-ai.
- Schéma public possédé par pg_database_owner ; USAGE oui, CREATE non sous l’identité audit.
- Zéro table applicative visible via information_schema sous audit : ce résultat ne prouve pas l’absence de tables invisibles. Zéro default ACL retournée pour owner/migrator/app dans cette base.
- Précontrôle avant accès à configuration sensible : SELECT sur pg_catalog.pg_hba_file_rules = false ; accès pg_read_all_settings et pg_read_server_files = false. Aucune requête de lecture HBA ou fichier serveur tentée après ce constat ; aucune élévation demandée ou contournement par fichiers.
- Refus de connexion aux huit autres bases déjà fournis par audit administrateur utilisateur et autorisés comme preuves, conformément à la réévaluation 2.1. Ils ne sont pas retestés par l’agent et ne sont pas présentés comme résultat de cette commande.

Évaluation : base/rôles et privilèges d’audit confirmés, pas d’objet à reconstruire. Le travail attendu de 2.5 mentionne explicitement « vérifier réellement [...] pg_hba » ; les permissions du rôle empêchent de vérifier les règles applicables et leur ordre/méthode d’authentification. Les refus SQL antérieurs bornent des accès effectifs mais ne décrivent pas toute la configuration HBA applicable. Pas de validation de 2.5 en l’absence de cette preuve, pas de passage à 2.6.

Action humaine minimale : administrateur PostgreSQL, fournir un rapport expurgé des seules règles pg_hba effectivement applicables à dental-ai pour dental_lab (ordre des règles, types de connexion concernés, méthode d’authentification et restriction de rôle/base). Confirmer que ce rapport correspond à la configuration en vigueur ; signaler une éventuelle erreur de règle. Aucune valeur d’auth_options, clé, mot de passe ou détail de projet voisin requis. Pas besoin d’accorder pg_read_server_files/pg_read_all_settings/superuser ou sudo à l’agent, ni de modifier pg_hba globalement. Les refus sur les huit autres bases sont déjà reçus : aucune répétition de ces tests demandée.

Modifications : ROADMAP.md (statut/preuves/blocage) et docs/EXECUTION_LOG.md seulement ; base, rôles, services et permissions inchangés. Audit SQL terminé sans erreur, vérifications documentaires/diff/secrets exécutées. Ces changements de suivi 2.5 restent non commités/non poussés tant que la preuve obligatoire manque, clairement attribuables. Reprise : vérifier Remote/UID/Git et intégrer rapport HBA ciblé ; clôturer 2.5 si critères satisfaits, puis audit du mécanisme de migrations scoped à 2.6.

### Réévaluation et clôture du point 2.5 — Rapport HBA administrateur

Rapport utilisateur reçu le 09/10/2026 à 13:50 Europe/Brussels, audit administrateur PostgreSQL 17 en lecture seule sans modification de configuration/permissions. Statut final : TERMINÉ. Le blocage de preuve HBA précédent est levé, son historique conservé.

Preuves administrateur attribuées à l’utilisateur :
- Fichier HBA configuré /etc/postgresql/17/main/pg_hba.conf, aucune erreur dans pg_hba_file_rules, service postgresql@17-main actif.
- Ordre déclaré : règle 2/ligne 124 local dental_lab dental-ai peer ; règle 3/ligne 125 local toutes bases dental-ai reject ; règle 4/ligne 126 host toutes bases dental-ai 127.0.0.1 reject ; règle 5/ligne 127 host toutes bases dental-ai ::1 reject ; règles générales à partir de 6.
- Dernier rechargement déclaré : 2026-10-09 03:15:24.346768+00.
- Tests précédents sous dental-ai : connexion dental_lab réussie et refus des huit autres bases. Aucune répétition agent vers les bases interdites, aucune extrapolation à d’autres comptes/adresses.

Vérifications directes de reprise : RDC en ligne, UID/GID 1002 dental-ai, cgroup dédié ; références sources inchangées ; fichiers non commités correspondent exactement au suivi 2.5 précédent (hashes concordants), aucun changement étranger. Nouvelle connexion autorisée exclusivement à dental_lab en transaction READ ONLY : current_user/session_user dental-ai, PostgreSQL 17.11, read_only on, CONNECT oui et CREATE/TEMP non. pg_conf_load_time() retourne exactement 2026-10-09 03:15:24.346768+00, cohérent avec le rapport. Commande SQL terminée sans erreur ; pas de mot de passe, secret ou fichier HBA obtenu par l’agent.

Interprétation bornée : pg_hba_file_rules décrit le fichier courant, pas une copie des règles en mémoire. La date de rechargement seule ne prouve pas l’absence d’une édition ultérieure. L’audit du fichier, la date concordante et les tests effectifs reçus/directs constituent ensemble les preuves de 2.5 ; ne pas revendiquer inspection intégrale des règles chargées ni test TCP/non-local non exécuté. Les lignes spécifiques rapportées précèdent les règles générales ; le succès local dental_lab et les refus antérieurs bornent l’identité audit dans les connexions testées. Les authentifications de runtime/migration restent à traiter séparément, pas autorisées par ces règles d’audit.

Critères satisfaits : inventaire réel base/rôles NOLOGIN/privilèges et configuration HBA ciblée documentés ; refus hors base fournis par administrateur ; aucun objet à recréer. Droits minimaux d’audit conservés, pas de modification pg_hba, de rôle ni de cluster.

Modifications : ROADMAP.md et docs/EXECUTION_LOG.md uniquement. Vérifications avant commit : 217 points/244 cas, références préservées, diff exclusivement suivi 2.5, check secrets/whitespace. Commit/push ciblés de 2.5 après succès, résultat réel consigné ensuite. Suite automatique : 2.6, audit de l’identité et du mécanisme d’exécution des migrations ; aucune permission PostgreSQL à modifier par l’agent.

### Compte rendu du point 2.6 — Exécution des migrations : audit et contrat préparé

Session du 09/10/2026, début 13:50 Europe/Brussels. Statut : BLOQUÉ sur mécanisme d’exécution/identité authentifiable non disponible. Commit 2.5 réel : 502ceb08dcad21d2645df0009339c3e06a3568e9, poussé et confirmé égal au main distant ; arbre propre avant cet audit.

Audit effectivement exécuté : inventaire limité à /srv/dental-lab hors .git, six fichiers documentaires, aucun runner/migration/configuration d’exécution dans le projet ; git ls-files/status et inspection bornée des noms de fichiers (pas de secret). Requêtes de privilèges et d’appartenance uniquement sur dental_lab, sous dental-ai, en transaction READ ONLY achevée code 0. Aucune interrogation d’une autre base, aucun SET ROLE/DDL/tentative d’authentification migration.

Résultats réels :
| Rôle | LOGIN | CONNECT dental_lab | CREATE base | USAGE public | CREATE public |
|---|---|---|---|---|---|
| dental-ai | oui | oui | non | oui | non |
| dental_lab_audit | non | oui | non | oui | non |
| dental_lab_migrator | non | oui | non | oui | oui |
| dental_lab_owner | non | oui | oui | oui | oui |
| dental_lab_app | non | non | non | non | non |

Appartenances concernant ces rôles : seulement dental-ai vers dental_lab_audit (ADMIN OPTION non, INHERIT/SET oui). Aucun membre LOGIN de dental_lab_migrator retourné ; dental-ai n’est membre ni de migrator ni d’owner. La politique sudo utilisateur reçue en 2.1 ne donne aucun droit ; RDC bloque sudo/su. Aucun contrat d’invocation externe de migrations n’a été fourni. Cela ne prouve pas qu’aucun outil administrateur n’existe ailleurs, mais aucun mécanisme autorisé/utilisable par l’agent n’est établi.

Conclusion : droits SQL de création dans public déjà préparés sur le rôle migrator, à conserver sans recréation ni ajout aveugle. NOLOGIN et absence de délégation/membre authentifiable empêchent d’utiliser ce rôle pour une migration sous l’accès actuel. Le compte d’audit doit rester audit ; pas de GRANT à dental-ai, activation LOGIN du rôle métier, secret improvisé, SQL superuser ou contournement Linux/Remote pour avancer.

Contrat concret proposé pour le mécanisme à préparer par l’administrateur (proposition, pas configuration déjà réalisée) :
1. Identité d’exécution distincte du compte d’audit, sans superuser/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS, utilisant les droits de dental_lab_migrator. Conserver les rôles métier NOLOGIN ; l’identité d’authentification et son mode (par exemple peer sous un exécutant Linux dédié sans privilèges) doivent être désignés et documentés par administrateur, pas inventés par l’agent.
2. Invocation bornée à dental_lab : destination imposée et vérification current_database/session_user/current_user avant exécution ; aucune option de l’appelant ou variable de connexion ne doit permettre de choisir une autre base. Accès direct à d’autres bases et administration générale exclus. Preuves de bornage à fournir sans sonder les applications voisines.
3. Si un lanceur délégué est nécessaire, commande/destination/arguments précisément bornés, composant de contrôle non modifiable par dental-ai ; aucun script librement éditable du projet lancé sous root/postgres. Le code et SQL de migration éventuels s’exécutent sous une identité système et SQL limitée, jamais sous superuser ; ne pas substituer un sudo générique.
4. Aucun secret dans chat/Git/logs/arguments ; mode d’authentification ou secret protégé transmis par procédure dédiée, visibilité minimale. Aucun secret d’application voisine ou credential postgres/debian mis à disposition de l’agent.
5. Migrations versionnées et revues, identité/objet/base attendus consignés, journal de versions/checksums et verrou d’exécution à construire aux fondations prévues ; aucun fichier de migration métier créé avant modèle/conventions appropriés. Le lanceur ne doit pas servir à exécuter arbitrairement une commande système privilégiée.
6. Avant chaque migration : audit état courant et effets, classification du risque ; revue et autorisation humaine si destruction/perte potentielle/production ; preuve de sauvegarde cohérente et restauration/rollback adaptée avant risque matériel. Rollback SQL non supposé universel ; aucun essai destructif sur données réelles.
7. Preuve initiale minimale : invocation du mécanisme sous contexte limité retournant identités et dental_lab, permissions effectives, absence de secret exposé ; tests de refus des destinations/arguments interdits sans connecter une base voisine. Ensuite validation d’une migration de fondation versionnée selon les points concernés et sa classification de risque, pas de DDL jetable improvisé aujourd’hui.

Action humaine minimale : administrateur, fournir ou faire préparer ce mécanisme borné, puis communiquer son mode d’invocation autorisé, l’identité réellement employée et les preuves de permissions/authentification/scoping. Si un mécanisme existe déjà, fournir son contrat et ses chemins réels pour audit avant invocation. Aucune permission PostgreSQL, délégation ou configuration globale ne sera modifiée par l’agent sans autorisation distincte ; l’instruction actuelle interdit ces modifications. Aucun droit de migration supplémentaire sur dental-ai demandé.

Critères de 2.6 pas encore validables : migrations exécutables uniquement dans dental_lab sous identité distincte et autorisation contrôlée non démontrées. Risque R03 ouvert. Pas de passage à 2.7 ni tentative d’installation pour masquer ce blocage.

Modifications : ROADMAP.md (statut/audit/contrat/blocage) et docs/EXECUTION_LOG.md seulement. Vérifications documentaires/invariants/diff/secrets ; données, rôles, HBA, services et permissions inchangés. Suivi 2.6 non commité/non poussé en attente du mécanisme. Reprise : vérifier Remote/UID/Git, auditer la procédure fournie sans secret ni élévation générale, puis tester seulement les opérations explicitement autorisées.


### Complément du point 2.6 — Séparation confirmée et procédure administrateur prête

Session 09/10/2026 — 12:33 UTC. Statut canonique conservé : ⚠ Bloqué ; audit terminé, mécanisme proposé mais non installé. Décision utilisateur : dental-ai reste exclusivement audit, sans appartenance migrator/owner ni privilège permanent de modification. Aucun élargissement autorisé/exécuté.

Reprise directe : Remote en ligne, commandes UID 1002/dental-ai, chemin physique /srv/dental-lab ; état Git et hashes des deux changements de suivi 2.6 concordants. Identifiants proposés dental-migrate et chemins d'installation absents à l'audit ; binaires administrateur présents aux chemins documentés, aucune invocation privilégiée. Dans dental_lab en READ ONLY : plpgsql 1.0 seule extension, zéro serveur étranger et zéro SECURITY DEFINER exécutable par migrator, attributs administratifs audit/migrator false. Requête achevée code 0.

Proposition précise : docs/admin-proposals/POINT_2_6_ADMIN.md contient comptes, droits, commandes d'installation/HBA/reload, installation du lanceur par copie approuvée et SHA, invocation humaine bornée, contrôles et arrêt/retour arrière ciblé. docs/admin-proposals/dental-lab-migrate.py reste un fichier de proposition non privilégié dans le projet, sans installation ni délégation sudo. Copie SQL bornée sans symlinks sous dental-ai, exécution systemd/SQL distincte sous dental-migrate puis SET ROLE migrator, base/socket/port fixes, LOGIN temporaire et NOLOGIN finally, registre root version/hash et .pending durable interdisant reprise aveugle. Protection du client distincte de PostgreSQL serveur partagé ; interruption brutale/charge/verrous et réseau/IPC partagés documentés. HBA partagé : ajout ciblé administrateur seulement, revue du diff et fenêtre de rechargement nécessaires ; pas de redémarrage.

migrations/0000_execution_probe.sql : probe versionné SELECT uniquement, aucune migration métier/DDL/donnée patient, NON EXÉCUTÉ dans PostgreSQL. SHA256 25e6cafc724d2b6ddd6c6be23f6fc44b4a5a21ea318cbfedac48a93bee7d1734. Lanceur SHA256 703cbb43b1d7b1b97cf6faa3cfac95832f1070d9b377ba86300f2a9235acaf02.

Vérifications réelles : quatre tests de garde-fous réussis localement et sur VPS (SHA/noms/connexion-shell/transaction) ; syntaxe Python et blocs Bash vérifiée sans exécution administrative ; hashes cohérents ; refus non-root du lanceur proposé confirmé sous UID 1002 avant toute opération administrative. Ces contrôles ne prouvent ni installation root, ni règles HBA chargées pour la nouvelle identité, ni succès du probe : preuves administrateur indispensables.

Action attendue : administrateur relire/approuver la proposition, exécuter les blocs contrôlés du runbook, fournir identités/modes/HBA/date reload, résultat du probe et des refus attendus, NOLOGIN/zéro session au repos et reçu/version/SHA. Consigne §§4/8 interdit toute création/élargissement par l'IA sans autorisation spécifique. Aucun autre projet/service/base sondé ou modifié. Sauvegarde/restauration selon risque avant migration matérielle ; pas de rollback SQL automatique.

Fichiers de suivi et quatre fichiers de proposition/probe uniquement ; aucun rôle, permission d'exécution, service, paquet, HBA ou objet SQL modifié. Git : suivi et proposition 2.6 non commités/non poussés ; point non validé. R03 reste ouvert. Suite : reprendre 2.6 sur preuves, jamais 2.7 avant validation.


### Révision du point 2.6 — Correction transactionnelle après revue utilisateur

09/10/2026 13:12 UTC. Statut : ⚠ Bloqué, principe général approuvé mais installation explicitement NON autorisée. Défaut critique de la première proposition confirmé : psql --single-transaction employé avec stdin sans -c/-f, contrat PostgreSQL17 non respecté ; ancienne proposition retirée, ne pas installer ses anciens checksums.

Correction : -c préambule fixe, -f snapshot root approuvé, -c contrôle final, --single-transaction et ON_ERROR_STOP=1, stdin DEVNULL ; SQL projet toujours sous dental-migrate/SET LOCAL ROLE migrator. Contrat atomique pour DDL/DML transactionnel ; effets hors transaction (séquences existantes, appels externes/defaults/triggers) explicitement exclus/revue obligatoire. Pas de garantie inventée du résultat après coupure autour du commit.

Sécurité revue : copies et parents root non modifiables, Python -I, sources sans symlink/FIFO et UID1002 privées/un lien, limites taille/temps, snapshots root fsync conservés ; SQL admin limité aux littéraux fixes, précontrôle rôle/attributs/membership/transitivité et séparation audit ; marqueur JSON avant LOGIN, fermeture SIGINT/SIGTERM best effort, aucun reçu avant NOLOGIN/zéro session ; tout pending bloque toutes migrations, archive rollback-verified empêche rejeu. Risques SIGKILL/panne/fermeture échouée/commit incertain/charge PostgreSQL partagé maintenus.

Vérifications réelles : UID1002, Remote en ligne, chemins/Git/hashes initiaux concordants ; audit dental_lab READ ONLY PostgreSQL17.11 confirme absence CREATE/TEMP et dental-migrate, tables de test absentes. 13 tests unitaires locaux et VPS réussis, avec appels admin/SQL simulés explicitement ; syntaxe 11 blocs Bash/3 Python et checksums cohérents ; refus non-root réel confirmé. Test d’intégration réel ajouté (lanceur installé, contrôle positif puis CREATE/INSERT/erreur22012 et absence table/receipt, pending et fermeture), NON EXÉCUTÉ : retourne BLOQUÉ code77 sous UID1002 avant toute DDL. Aucun cluster parallèle/installation/élargissement pour masquer ce manque.

Fichiers : cinq documents/scripts dans docs/admin-proposals, trois SQL techniques versionnés dans migrations, SHA256SUMS de livraison ; ROADMAP et journal. VALIDATION_2_6.md détaille preuves et limites. Destinations /usr/local/sbin/dental-lab-migrate et /var/lib/dental-lab-migrations/admin-tests absentes : installation proposée, pas effectuée ; binaires et parents existants contrôlés, HBA/service gardent preuve administrateur antérieure sans nouvelle lecture privilégiée.

Action attendue : utilisateur fait relire fichiers corrigés/rapport, aucune commande administrateur maintenant ; après approbation explicite future, installation et intégration contrôlée devront fournir les preuves avant validation 2.6. Suivi non commité/non poussé ; aucun rôle/permission/HBA/service/base modifié, aucun voisin accédé. 2.7 non commencé. R03 ouvert.


### Clôture du point 2.6 — Révision 3 installée et intégration réelle prouvée

2026-10-10T01:33:55+02:00 [Europe/Brussels, horloge VPS]. Statut : ☑ Validé. Rapport administrateur utilisateur : installation root rev3 SHA256 698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1, root:root 555, rev2 sauvegardée ; comptes Linux/SQL dédiés et HBA ciblé installés. Probe 0000 identité dental_lab/dental-migrate/dental_lab_migrator et permissions 1 ; contrôle positif 9901 CREATE/INSERT/assertion/DROP ; 9900 CREATE/INSERT puis erreur 22012, rollback sans table persistante. Refus non-root/traversée/SHA erroné réussis. Deux reçus succès, archive rollback-verified et aucun pending ; snapshot/SHA de l'échec contrôlés avant archivage. Preuves administrateur attribuées, pas réexécutées par l'IA.

Vérifications directes de reprise : Remote en ligne sous dental-ai UID1002/cgroup dédié ; /srv/dental-lab propriétaire privé 700 ; lanceur installé SHA exact et root:root 555. Audit dental_lab BEGIN READ ONLY/COMMIT achevé : PostgreSQL17.11, dental-migrate NOLOGIN sans attribut administratif, zéro session ; dental-ai ni migrator ni owner ni CREATE base/public ; deux tables techniques absentes. Services dental-ai-remote, dental-site et postgresql@17-main actifs. Aucun rôle/HBA/lanceur root/service modifié et aucune fixture rejouée.

Concordance source corrigée dans le projet uniquement : source principale et tests alignés sur rev3 validée ; copie temporaire de revue identique retirée pour éviter deux sources concurrentes ; trois SQL et test d'intégration inchangés, versions déjà consommées à ne pas rejouer. Documents de proposition étiquetés historiques, contrat actuel ajouté et SHA actualisés. Tous changements précédents non commités attribuables au seul point2.6.

Autorisation future : chaque SQL ET SHA256 exigent toujours approbation administrateur explicite. Aucun droit permanent de migration/administration pour l'IA. Sauvegarde et retour arrière adaptés obligatoires avant risque matériel ; atomicité démontrée sur ces fixtures transactionnelles uniquement, pas pour séquences/effets externes ni coupure près du commit. Pending reste bloquant et à résoudre humainement ; NOLOGIN n'arrête pas les sessions existantes. Réseau/processus/IPC/CPU/IO serveur partagés, client systemd non assimilé à isolation complète, rétention snapshots et sécurité production à réévaluer ; données médicales réelles toujours interdites avant gates dédiées. R03 : composante migrations résolue, runtime/secrets restent à traiter en2.7–2.8.

Contrôles avant commit : tests unitaires rev3 (appels administrateur simulés uniquement), syntaxe scripts/blocs historiques sans exécution, manifest SHA/diff/check secrets/invariants. Git : commit ciblé puis push main après succès, résultat réel dans compte rendu/journal suivant. Suite :2.7, audit secrets/runtime sans lecture d'un secret ni projet voisin.


### Point 2.7 — Secrets et environnement : préparation puis blocage

2026-10-10T01:35:30+02:00 Europe/Brussels. Commit2.6 confirmé f1d58d4f5de7e22b387ef1e207aff691c452c2cd poussé, HEAD distant identique, arbre propre avant audit2.7. Statut : ⚠ Bloqué.

Audit direct : dental-site.service sous dental-site UID999/GID989, WorkingDirectory=/srv/dental-site/current, EnvironmentFiles=/etc/dental-site/dental-site.env ; protections strict/home/NoNewPrivileges actives, limites ressources runtime non bornées selon propriétés observées, à examiner en2.8. /etc/dental-site root:GID989 0750 sans symlink, agent sans lecture/écriture ; métadonnées enfant protégées non obtenues. Aucun contenu de secret lu. dental_lab_app NOLOGIN sans CONNECT, aucun rôle changé. Projet sans .env réel, gitignore/exemple absents initialement.

Préparation permise effectuée : .gitignore et .env.example sans secret réel ni identité/port HTTP supposé ; docs/ENVIRONMENT.md explique contrat, limites et bloc administrateur de métadonnées seulement. Aucun compte/permission/HBA/service/lanceur root ni chemin runtime modifié. Tests pertinents : syntaxe Bash/Python de procédure sans exécution, exclusions Git effectives, exemple sans secret, diff/whitespace et audit fichiers nouveaux.

Action attendue : administrateur confirmer si le service et /srv/dental-site/current sont le runtime de ce projet, et fournir métadonnées/ACL du fichier environnement plus tests lecture runtime/agent (sans contenu). CONSIGNE §§3/4/8 interdit de contourner les protections ou de supposer le périmètre. Validation secrets privés et cloisonnés non complètement établie ; pas de2.8 avant preuve. Aucun droit supplémentaire demandé ; aucune instruction de migration autorisée. Suivi et préparation2.7 conservés non commités en attente de validation, conformément au protocole ; rapport publié dans chat.


### Point2.7 — Rapport de protection reçu, provenance du runtime non établie

2026-10-10T01:40:06+02:00 Europe/Brussels. Statut conservé : ⚠ Bloqué. Reprise RDC en ligne UID1002/cgroup dédié, /srv/dental-lab réel, HEAD f1d58d4 ; cinq changements2.7 précédents identifiés, aucune modification étrangère. Lecture critères roadmap2.7/2.8, consigne3/4, architecture et mentions runtime du suivi : aucune décision de rattachement dental-site au nouveau projet.

Preuves administrateur utilisateur : service Dental_site backend actif, compte/groupe dental-site, current root:root symlink vers release20260904-e94c64a, runtime/parents root:dental-site0750 ; environnement root:root0600 et droits ACL rw-/---/--- ; agent sans lecture ni traversée ; services concernés actifs. Ces preuves sont attribuées à l’utilisateur, pas réexécutées par l’IA. La protection filesystem est documentée, pas une isolation complète ou une appartenance au nouveau projet.

Correction explicite : ancien critère lecture directe du fichier par dental-site trop strict pour EnvironmentFile d’un gestionnaire système root ; aucune permission à élargir. Documentation primaire systemd consultée. État actif et description ne démontrent ni provenance, ni bonne configuration du futur laboratoire. Release antérieure au cadrage : indice seulement.

Fichier mis à jour : docs/ENVIRONMENT.md, plus ce suivi ROADMAP/journal uniquement. Préparation .gitignore/.env.example conservée sans secret. Procédure précédente de métadonnées remplacée par contrôle conditionnel de provenance Git, lecture seule administrateur sans URL brute, sans réseau ni script projet root ; si métadonnées absentes, preuve de déploiement/attestation projet propriétaire. Tests syntaxe Python/Bash sans exécution, diff/check et critères inchangés à vérifier avant compte rendu.

Action humaine indispensable : déterminer dépôt/commit et projet propriétaire de la release, confirmer rattachement autorisé OU classer dental-site hors périmètre puis décider runtime distinct. Aucun secret à transmettre ; aucun service/rôle/HBA/permission/lanceur root modifié, aucune fixture rejouée. Pas de2.8, aucun commit/push de validation2.7 ; préparations et suivi non commités en attente de preuve/décision.


### Clôture2.7 — Préparation documentaire et runtime indépendant

2026-10-10T01:44:30+02:00 Europe/Brussels. Statut : ☑ Validé (préparation documentaire sans installation). Décision administrateur explicite : nouveau runtime indépendant ; dental-site, son compte, environnement/secrets et /srv/dental-site intégralement exclus. Rapport attribué : packages dental-site/@dental-site/server0.0.0, release préexistante sans provenance Git exploitable ; aucune recherche supplémentaire utile après exclusion. Aucun fait de provenance inventé.

Reprise : RDC en ligne UID1002/cgroup dédié, chemin physique /srv/dental-lab ; HEAD f1d58d4, changements2.7 précédents attribuables. Vérifications directes : exemple/ignore/doc réguliers UID1002 mode0600 sans symlink ; aucun env réel ni log dans projet/ fichiers Git suivis ; exemple sans secret, rôle runtime SQL non activé. Critères préparation/configuration et cloisonnement documentés ; aucune utilisation d’un secret/runtime existant.

Fichiers : .gitignore, .env.example, docs/ENVIRONMENT.md et suivi ROADMAP/journal. Document actualisé retire le contrôle devenu inutile sur runtime exclu ; contrat secrets publics/privés, validation serveur future et séparation audit/runtime explicites. Point2.7 ne déclare pas les secrets futurs installés/protégés : contrôles effectifs19.3/19.4 obligatoires avant mise en service, autorisation administrateur distincte, aucune donnée patient réelle. Critères non réalisés de production ne sont pas marqués validés.

Vérifications : check-ignore de variantes env/log/cache et exemple versionnable, contenu exemple sans credential, syntaxe/documentation/217points/diff--check et secrets avant commit. Aucune modification service/permission/rôle/HBA/lanceur root, aucune lecture de secret, aucune fixture rejouée. Git : commit ciblé2.7 puis push main après succès ; hash réel enregistré au compte rendu et entrée suivante. Suite automatique2.8, conception des privilèges seulement, pas installation.


### Point2.8 — Conception des privilèges du runtime indépendant

2026-10-10T01:45:53+02:00 Europe/Brussels. Statut : ☑ Validé (conception seulement). Commit2.7 confirmé03bee91f3ae8e769725d3cb87e2941a04e68f7e3 poussé, distant égal, arbre propre. Audit : pas de code/package applicatif ; compte candidat dental-lab-runtime et rôle SQL du même nom absents, unité candidate /etc/systemd/system/dental-lab-api.service et wrapper /usr/local/sbin/dental-lab-service-control absents. Noms/emplacements proposés explicitement, pas objets installés. dental_lab_app NOLOGIN sans attributs administrateur, audit ni migrator ni owner ; transaction READ ONLY achevée. Aucune ressource dental-site réinterrogée.

Document docs/RUNTIME_PRIVILEGES.md : compte indépendant non root, unité backend seule proposée, identities/configurations distinctes, artifacts protégés et secrets hors source, droits SQL uniquement runtime sans DDL/ownership, aucun wrapper nécessaire ni sudo/polkit/wildcard. Création/installation/grants/HBA/secrets/ports/limites et validation opérationnelle restent19.3/19.4 avec approbation explicite ; aucun ExecStart/port/paramètre de production inventé. Approbation SQL/SHA à chaque migration inchangée.

Fichiers : nouveau document de conception et suivi ROADMAP/journal. Vérifications doc/invariants/diff/secrets avant commit ciblé ; aucune création runtime/rôle/unité/secret/wrapper/délégation ni modification de service/HBA/global/voisin. Critères de conception2.8 satisfaits, pas déclaration production prête. Risques réseau/processus/IPC/CPU/IO serveur partagés et absence de confinement complet documentés. Git : commit/push ciblés après contrôles ; résultat réel enregistré ensuite. Suite2.9, rapport des garde-fous, aucune sonde hors périmètre.


### Point2.9 — Consolidation des garde-fous, preuve services manquante

2026-10-10T01:47:53+02:00 Europe/Brussels. Statut : ⚠ Bloqué. Commit2.8 confirmé0c116d094e9c5e77b82dd058cd67a82c88e0b746 poussé, distant identique, arbre propre. Critères2.9 relus : refus projets/bases/services/secrets et limites réseau dans rapport reproductible. Preuves2.1–2.8 disponibles consolidées dans docs/INFRASTRUCTURE_GUARDS.md ; sources administrateur/directes et limites distinctes. Aucun test vers un voisin effectué.

Manque : preuve de refus de gestion des services via autorisations systemd/Polkit/délégations effectives applicables à dental-ai ; absence de sudo seule insuffisante. Contrôle minimal demandé : rapport administrateur lecture seule des politiques/délégations couvrant ce compte, actions et unités hors périmètre, commandes/resultats expurgés ; aucune action start/stop/restart/reload réelle pour tester, aucune modification de politique/droits/service. La règle accès Remote activable après validation est confrontée à l’autorisation utilisateur2.3 déjà en vigueur : ne pas arrêter Remote, aucune extension autorisée. Risques réseau/IPC/ressources déjà acceptés en développement ne sont pas effacés ni transformés en isolation complète.

Fichiers : document de rapport, ROADMAP/statut/R03 et journal seulement ; aucun secret/compte/runtime/rôle/service/HBA/lanceur créé ou modifié. Vérifications structure217points/doc/absence secrets/diff--check ; suivi non commité/non poussé puisque2.9 non validé. Pas de3.1. Action : preuve administrateur d’autorisation/refus des services, puis réévaluation2.9 ; aucun élargissement de permissions demandé.


### Clôture2.9 — Garde-fous validés pour développement

2026-10-10T01:51:59+02:00 Europe/Brussels. Statut : ☑ Validé (mode de développement2.3, pas production/isolation complète). Reprise Remote en ligne UID1002/cgroup dédié/projet réel ; changements2.9 identifiés, HEAD0c116d0. Rapport Polkit administrateur intégré : pas sudo/groupes administratifs/règle locale, règles système identifiées sans délégation dans lignes examinées ; manage-units auth_admin/auth_admin/auth_admin_keep, pkcheck sans interaction code2. Résultat attribué, pas absence universelle de permissions inventée.

Complément direct ciblé et lecture seule : pkcheck présent /usr/bin ; manage-unit-files, reload-daemon, set-environment sous sujet bash dental-ai/cgroup Remote : trois code2 et authentification requise. Aucune option interactive ni demande d’opération réelle, aucun accès/service voisin ciblé. Audit4catégories générales plus preuves2.1–2.8 satisfont le rapport reproductible dans le mode explicitement accepté. L’exigence de rapport précédente « toutes les autorisations » est corrigée : limites non effacées, exceptions par unité/contexte/voie différente non entièrement démontrées ; tout changement entraîne réaudit.

Fichiers : docs/INFRASTRUCTURE_GUARDS.md, ROADMAP et journal. Réseau/IPC/processus/ressources hôte/cluster partagés, production et runtime effectifs non validés, gates19.3/19.4 et sécurité inchangés ; Remote2.3 autorisé reste actif sans extension. Pas de service/root-lanceur/rôle/HBA/secret/permission modifié, aucune fixture rejouée. Contrôles : syntaxe du bloc sans re-test Polkit, invariants217points/diff/absence secrets. Git : commit et push ciblés après succès, résultat réel au compte rendu/journal suivant. Suite automatique3.1, audit architecture applicative.

### Point 3.1 — Architecture applicative détaillée

Date : 10/10/2026 à 01:55 Europe/Brussels (UTC+02:00). État initial : 2.9 validé, HEAD 4042311, arbre propre ; UID 1002 et chemin /srv/dental-lab vérifiés. Aucun code applicatif ni modèle SQL métier présent. Cahier des charges relu, principes/complément et décisions 1.3/1.4 confrontés à l'état actuel.

Modifications : docs/architecture.md et docs/decisions/0001-stack.md, 0002-module-boundaries.md. Formalisation de la stack approuvée, des 16 propriétaires, des contrats et ports sans cycle, des transactions/outbox, des projections autorisées, de la PWA/fichiers et des frontières du runtime indépendant. Le graphe est exactement celui validé en 1.4 ; aucune nouvelle fonction ni outil installé. Les choix de 3.2–3.9 restent à leur étape.

Validation : comparaison JSON du graphe à 1.4 réussie ; toutes les cibles définies, parcours sans cycle ; liens relatifs résolus ; UID 1002/modes 600/non-symlinks contrôlés ; scan élémentaire de secrets et git diff --check réussis. Revue documentaire contre §§2–17 et exclusions §18, distinction de conception et implémentation maintenue. Typage/lint/build/tests applicatifs sans objet, code absent. Aucun service, permission, SQL, launcher ou fixture modifié/exécuté.

Risques restants : faisabilité appareils/offline, capacité/stockage, transport, fournisseurs, sécurité/conformité et production aux jalons existants. Statut final : ☑ Validé pour 3.1. Git : commit ciblé après contrôle du diff ; identifiant porté par l'historique Git et compte rendu, push à vérifier. Suite : 3.2, modèle comptes et cliniques.

### Point 3.2 — Modèle comptes et cliniques

Date : 2026-10-10T01:58:10.180718+02:00 (Europe/Brussels). État initial : 3.1 validé, commit 4acb5a41d11a861e2a4bb11c62622b7d4716a56c poussé et arbre propre ; identité UID 1002 et chemin projet contrôlés. Audit SQL en lecture seule : current_database/current_user = dental_lab/dental-ai ; aucune table public. Critères 3.2 et §§2, 9, 11, 15, 17 confrontés.

Modifications : docs/models/accounts-clinics.md et lien dans docs/architecture.md. Modèle proposé : compte propriétaire unique, profils individuels labo et compte partagé clinique, clés/FK/unicités, invitations et sessions, états d'approbation/suspension/blocage séparés, changement d'e-mail confirmé, historique et récupération exceptionnelle. Aucun workflow financier ou rôle ajouté ; paramètres de tokens et sécurité à préciser aux étapes d'implémentation.

Validation : revue des associations et des invariants/exceptions contre le cahier des charges, liens résolus, UID/modes privés/non-symlinks, scan élémentaire secrets et diff Git contrôlés. La matrice de concurrence/refus est une conception de tests futurs ; aucun test applicatif ou migration prétendu exécuté. Aucun SQL écrit/exécuté en modification, aucune fixture ni service touché.

Statut final : ☑ Validé pour la conception 3.2 ; migration et contraintes réelles non installées. Git : commit ciblé après contrôles, push à vérifier et identifiant dans l'historique/compte rendu. Risques : choix sécurité et procédures exceptionnelles avant implémentation, confidentialité et données réelles avant production. Suite automatique : 3.3, droits granulaires.

### Point 3.3 — Droits granulaires

Date : 2026-10-10T02:00:39.771078+02:00 (Europe/Brussels). État initial : 3.2 validé et poussé (d48dc12107a1fb1a8b7663c451dcf5198deb390b), arbre propre ; audit des modèles et critères 3.3, §2.3 et frontières §§8–10/15. Le registre R14 reste ouvert pour 3.5–3.6.

Modifications : docs/models/permissions.md et lien architecture. Grants individuels, prérequis, accès parent serveur, enveloppe explicite de délégation employés et refus d'auto-élévation ; capacités logistique/détail, view/download, général/travail, lecture/réponse et actions séparées. La lecture de chat est une autorisation distincte de contenu libre, sans prétendu filtrage automatique patient ; les projections officielles logistiques restent expurgées.

Validation : revue matrice/prérequis et retrait des dépendances contre CDC, liens et fichiers privés contrôlés ; diff et scan élémentaire secrets OK. Tests API/IDOR/révocation/ZIP/temps réel listés pour implémentation, non prétendus exécutés ; pas de code, grant système/SQL ni service modifié. Statut final : ☑ Validé pour conception 3.3. Git : commit ciblé après revue, push à vérifier ; hash via historique et compte rendu. Suite : 3.4, modèle de commandes et versions.

### Point 3.4 — Commandes et versions

Date : 2026-10-10T02:02:22.164297+02:00 (Europe/Brussels). État initial : 3.3 validé et poussé (87597f80e102c150d47bdabc18f0d10a7fec28bb), arbre propre et UID 1002 ; critères 3.4 et clauses §§3–8/11/14/15/19 relus. Pas de table métier ni code à adapter.

Modifications : docs/models/orders-versions.md et lien architecture. Identité officielle/numéro serveur, versions append, FDI, snapshots, identifications patient alternatives, dates souhaitée/planifiée distinctes, fichiers versionnés/verrouillés, demandes exclusives, reçu idempotent, historique/logistique séparés. R14 (état source du remplacement) conservé explicitement ouvert pour l'automate 3.5 ; aucune transition non validée ajoutée.

Validation : revue des clés/FK de même commande, unicités et scénarios de concurrence contre CDC ; dates, avertissements non bloquants et exclusions préservés ; liens/propriété/modes et scan élémentaire secrets OK ; diff Git contrôlé. Tests SQL/API et transfert réels non exécutés à cette étape de conception. Aucun fichier de migration, objet SQL, service ou privilège modifié.

Statut final : ☑ Validé pour 3.4, statuts et stockage de versions sans écrasement décrits. Git : commit ciblé après contrôle du diff, push à vérifier. Suite : 3.5 ; consulter R14 et arrêter pour décision si la table de transitions ne peut pas être complète sans trancher le remplacement après fabrication.

### Point 3.5 — Automate partiel et décision R14 indispensable

Date : 2026-10-10T02:04:13.462575+02:00 (Europe/Brussels). État initial : 3.4 validé, commit 9326b5823372009dda5ba9a869ffdb97df27d805 poussé, arbre propre ; UID 1002 et chemin projet contrôlés. Audit critères 3.5, CDC §§5.3/5.5/6/7/19 et registre R14 existant.

Préparation : docs/models/order-state-machine.md, table des transitions établies, automate des demandes et scénarios de concurrence. Aucun choix adopté pour les états source Terminée/Livrée des travaux liés. Le §5.5 parle d'après démarrage et exige annulation du remplacé ; le §5.3 exclut l'annulation ordinaire Terminée/Livrée ; le §6 définit retouche après livraison. Sans préciser la portée de l'exception, table exhaustive non validable.

Décision minimale attendue du propriétaire : états autorisés pour remplacement et travail supplémentaire ; proposition à confirmer = En fabrication seulement, parcours normal à Terminée et retouche/refabrication §6 à Livrée. Si d'autres états autorisés, préciser par type et autorisation exceptionnelle d'annuler le remplacé. Aucune nouvelle règle implémentée ou présumée.

Vérifications : revue partielle contre clauses, liens/propriétés/modes privés et scan élémentaire secrets, diff de suivi contrôlé. Aucun test applicatif/migration/service/privilège modifié. Statut final : ⚠ Bloqué (R14) ; document partiel et suivi laissés non committés, aucun commit/push du point non validé. 3.6 et suivants non commencés. Reprise : lire décision et arbre Git, compléter/valider l'automate puis commit ciblé et push seulement après critères satisfaits.

### Clôture 3.5 — R14 et progression approuvées

Date : 2026-10-10T02:08:10.070339+02:00. Reprise : Remote en ligne, UID/GID 1002, cgroup dental-ai-remote.service et /srv/dental-lab vérifiés ; modifications précédentes exactement attribuables à la préparation bloquée 3.5, HEAD 9326b58. R14 reçue explicitement le 10/10/2026 : remplacement En fabrication annule la source ; remplacement exceptionnel Terminée/Livrée la laisse inchangée. §5.5 complété/version 1.1, §§5.3/6 inchangés. CONSIGNE 1.1 consigne la progression sur ambiguïtés mineures ; aucune protection diminuée.

Modifications : automate finalisé, modèle de demandes ajusté pour clôture technique closed, CDC et protocole ; H35-01/02/03 explicitement réversibles et non présentées comme accord supplémentaire. Validation documentaire : revue des huit statuts, transitions autorisées/refus par défaut, demandes exclusives, concurrence, R14 et séparation retouche/remplacement ; liens, fichiers UID1002/modes600, scan secrets élémentaire et diff OK. Espaces de fin de ligne du titre de version corrigés après diff-check ; aucun échec critique. Aucune migration, fixture, permission ni service modifié. Statut final : ☑ Validé pour conception 3.5. Risques d'implémentation et production conservés. Commit ciblé/push après contrôle du diff ; identifiant dans historique et compte rendu. Suite automatique 3.6.

### Point 3.6 — Travaux liés et retouches

Date : 2026-10-10T02:09:56.371312+02:00. État initial : 3.5 finalisé/poussé a6b1b6991f5bdaf5800a3b71a0b32fb42847831a, arbre propre avant création ; audit CDC §§5.3–6/R14 et modèles présents. Modifications : docs/models/linked-works.md, liens architecture et suivi. Clés/FK de même clinique, enfant distinct, filiation append sans cycle, transitions R14, slot d'unicité retouche active et libération atomique, reçu idempotent et ordre des verrous documentés.

Validation documentaire : revue contre critères 3.6, distinction replacement/supplement/resubmission/retouch, contrôles de concurrence et historiques ; liens, UID1002/modes600/non-symlinks, scan secrets et diff OK. Tests d'intégration futurs spécifiés, pas exécutés ; aucun schéma/migration/fixture/service/privilège modifié. Statut final : ☑ Validé pour conception 3.6 ; risques réels de concurrence/stockage à valider à l'implémentation. Git : commit/push ciblés après diff, hash dans historique/compte rendu. Suite automatique : 3.7.

### Point 3.7 — Fichiers et cycle de vie

Date : 2026-10-10T02:11:47.453147+02:00. État initial : 3.6 validé/poussé 67468d0a8faaca57b356fa198e9c18f77d345ec2, arbre propre ; audit des clauses fichiers §§4.2/8/9/11/12 et droits/modelés existants. Modifications : docs/models/files-lifecycle.md, lien architecture et suivi. Catégories/associations typées, ACL par parent/clinique, états de fragments/finalisation/réparation, objets immuables, partage individuel/révocation, ZIP fidèle et capacité séparée documentés.

H37-01 réversible : Mo/Go décimaux pour contrats ; aucune limite cumulative non demandée. Réserve, budgets, TTL, topologie et antimalware restent aux audits opérationnels R07/chapitre12 avant tout transfert réel. Validation documentaire : revue matrices visibilité/cycle selon CDC, liens/propriété/modes/non-symlinks, scan secrets élémentaire et diff OK. Tests upload/ZIP/charge refus/scan sont futurs, non exécutés. Aucun stockage/service/SQL/migration/permission modifié, pas de fixture rejouée. Statut final ☑ Validé pour conception 3.7. Commit/push après revue ; hash dans historique/compte rendu. Suite automatique 3.8.

### Point 3.8 — Synchronisation préparée, récupération à décider

Date : 2026-10-10T02:16:15.568470+02:00. État initial : 3.7 validé/poussé 1c479068074a99f10435a82f23e953059f9703de, arbre propre ; audit CDC §11, modèles et critères 3.8, Node22.22.2 confirmé. Conception préparée dans docs/models/drafts-sync.md : CAS, conflits fichiers compris, tombstones, incertitude/ack/idempotence, soumission explicite, coffre par compte, quota/pannes/maintenance/suspension, proposition d'enveloppe et formats cryptographiques.

Vérification réelle préparatoire : probe Node en mémoire sous UID1002, données synthétiques, PBKDF2 600000 + AES-KW/AES-GCM round-trip4096 octets ; ciphertext altéré, AAD différent, phrase incorrecte et export nonextractable refusés, succès. Sources primaires MDN/OWASP lues ; ce contrôle ne valide ni navigateur ni app absente. Liens/propriétés/modes600/non-symlinks, scan secrets élémentaire et diff contrôlés. Aucun stockage sensible, clé réelle, SQL, fixture, service ou privilège changé.

Blocage unique R05 : récupération du coffre. Option recommandée A = phrase locale indépendante et code de secours privé détenu par clinique, sans clé serveur ; option B = phrase seule, oubli rend brouillons non synchronisés irrécupérables. Choix important sécurité/perte irréversible, non assimilable à une ambiguïté mineure : aucun choix adopté. Action attendue : valider option de récupération ; l'email de récupération du compte ne doit pas promettre la récupération de clé locale.

Statut final ⚠ Bloqué pour3.8 ; document et suivi laissés non committés, pas de commit/push du point non validé. 3.9 non commencé. Reprise après décision : finaliser ADR et coffre, contrôler critères/diff, commit/push puis poursuite automatique. Les tests sur appareils réels demeurent aux jalons PWA, pas une prétention de réussite de conception.

### Point 3.8 — Clôture de conception avec R15

Date : 2026-10-10T07:56:16.363822+02:00. Remote en ligne, UID1002/cgroup dental-ai-remote et /srv/dental-lab confirmés ; HEAD1c47906, changements préparatoires uniquement attribuables à3.8. R15 reçue : deux enveloppes indépendantes, code aléatoire privé, nouvelle phrase sans perte et aucune clé serveur. Fichiers : CDC1.2, modèle drafts-sync, ADR0003, lien architecture et suivi. Limites stockage/appareil, procédure clinique, absence de logs/URL/télémétrie et secours administrateur documentées. Historique du blocage conservé.

Validation : revue de conception contre CDC§11/R15 et critères3.8, machine de synchronisation et pannes/conflicts/fichiers/soumission explicite documentées. Probe Node préparatoire antérieur seulement ; aucun test navigateur prétendu. Contrôle liens, permissions et diff avant commit ; pas de migration, fixture, service, privilège ou donnée réelle modifié. Statut final ☑ Validé pour conception3.8 ; R05 conserve les gates navigateur/revue crypto/production. Commit ciblé et push après contrôle, hash dans historique/compte rendu. Suite automatique3.9.

Complément de validation3.8 : probe R15 Node en mémoire réussi (secours indépendant → nouvelle phrase → même ciphertext lisible, ancienne phrase refusée sur nouvelle enveloppe, nonextractable et ancienne enveloppe conservée). HTTPS/support/quota et absence de fallback clair documentés après lecture MDN. Le contrôle trop large des espaces a rencontré les doubles espaces Markdown historiques du CDC ; permissions réinspectées conformes et diff-check ciblé OK, aucun changement de sécurité nécessaire.

### Point3.9 — Événements, notifications et audit

Date : 2026-10-10T07:59:40.293234+02:00. État initial : HEAD c04672ae4ddd10b43ea2a9bc15378ef371ef5082 poussé, arbre propre ; CDC§§2/5–7/9–10/15–16 et modèles droits/automate audités, aucun fichier de ce modèle présent. Modifications : modèle events-notifications-audit, lien architecture et suivi. Matrice des six catégories labo et mails clinique, exclusions, destinataires, outbox/claims/retries, Lu partagé/cycles30min/24h, audit append-only applicatif et tests futurs. H39-01 SSE/HTTP et H39-02 backoff sont techniques réversibles, pas de fournisseur installé.

Validation : revue de matrice contre CDC, cloisonnement/droits et distinction Lu/action ; sources primaires MDN consultées pour SSE/reconnexion/limites. Contrôles liens/modes/diff avant commit ; aucun test applicatif/fournisseur/navigateur prétendu. Aucun SQL, fixture, service, compte ou secret touché. Statut final ☑ Validé pour conception3.9 ; gates d'implémentation et production conservés. Commit/push ciblés après diff ; hash dans historique et compte rendu. Suite automatique3.10.

### Point3.10 — Rétention, sauvegardes et reprise

Date : 2026-10-10T08:01:50.980270+02:00. État initial : HEAD589619979dc234c83f0498a43513b49803d5495f poussé, arbre propre ; audit CDC§§8/11–12/14–17, fichiers et risques R08/R09. Aucun plan dédié présent. Modifications : modèle retention-backup-recovery, lien architecture et suivi. Catégories/durées connues vs décisions légales futures, archive UI30jours, backups30jours, effacement contrôlé et registre minimisé de réapplication ; proposition H310-01 snapshot unique dental_lab/manifeste/pins objets immuables, mesure RPO1h/RTO4h et reprise sans e-mails/sessions historiques.

Validation documentaire contre critères3.10 : couverture rétention/cohérence DB-fichiers et courses/échecs ; documentation PostgreSQL17 pg_dump/snapshot consultée, aucun outil exécuté ni dump. Contrôles liens/propriétés/modes et diff avant commit. R08/R09 restent ouverts avant patients réels/production : durées légales, destination/clés/capacité et exercices non décidés ou non démontrés. Statut final ☑ Validé pour conception3.10 uniquement. Aucune migration/fixture/service/privilège/donnée réelle modifié. Commit/push ciblés après revue, hash historique/compte rendu. Suite automatique4.1 ; son approbation visuelle exacte sera contrôlée avant clôture.

### Point3.11 — Contrat API et erreurs métier

Date : 2026-10-10T08:06:06.771701+02:00. État initial : HEAD96e6a73d4fe72b52241907c5d9f94f1d96eab2e7 poussé, arbre propre ; audit ADRstack, versions/permissions, chapitre3 complet et absence de contrats. Correction de suite : annonce4.1 prématurée après3.10 ; aucun fichier UX créé, 3.11 traité avant chapitre4. Modifications : api-contract, common.schema.json, consumers.json, check_contracts.py, lien architecture et suivi. H311-01 préfixe APIv1 et H311-02 pagination technique sont réversibles ; aucune limite métier additionnelle.

Portée de réception : point Audit/décision = mêmes schémas réutilisés dans spécifications web/API via références identiques ; imports React/Express effectifs aux fondations après création des applications. Pas de preuve de code client/serveur absent. Validation réelle : python3 docs/contracts/check_contracts.py avec jsonschema préexistant, méta-schéma2020-12, références communes résolues, exemples synthétiques et refus identification vide, autorité injectée, date/FDI/fichiers invalides, fuite projection logistique et erreurs sensibles : OK. Sources primaires RFC9457/JSONSchema consultées. Liens/propriétés/modes/diff contrôlés avant commit. Statut final ☑ Validé pour conception3.11, imports/types/middleware/CSRF/concurrence futurs non validés. Aucun SQL/fixture/service/secret/privilège modifié. Commit/push ciblés après revue ; hash historique/compte rendu. Suite4.1.

### Point4.1 — Direction visuelle proposée, approbation attendue

Date : 2026-10-10T08:08:24.690824+02:00. État initial : HEAD1fab333 poussé, arbre propre ; architecture3.1–3.11 conception validée, aucun frontend/asset/charte/logo présent. Audit CDC§§1/7/11/13/18 et critères chapitre4. Modifications : docs/design/visual-direction.md, tokens.json, direction-preview.html et validation.md ; suivi canonique et journal. Proposition H41-01 sobre blanc/gris, accent vert pétrole, police système16px, cibles44px et parcours priorisés labo/draft/livraison/message/coffre. Libellés albanais candidats, données fictives seulement, maquette statique locale sans réseau/JS/secret. Skill Superdesign consulté mais CLI/service externe non exécuté pour conserver périmètre Remote/VPS autorisé.

Validation réelle : JSON/HTMLParser, langue sq, ancres et absence de ressources externes/scripts/formulaires ; calculs de contrastes texte≥4.5 et bordure/focus≥3 : OK, détails validation.md. Pas de rendu navigateur/tactile/lecteur ou revue linguistique prétendu. Diff/propriétés/modes et liens contrôlés. Blocage limité : ROADMAP4.1 exige « Tokens, typographie et parcours prioritaires approuvés » ; proposition concrète prête mais aucune approbation de direction visuelle reçue. Statut final ⚠ Bloqué, aucun commit/push de4.1 avant validation ; 4.2 non commencé. Action attendue : approbation ou modification ciblée de cette direction, pas autorisation système. Aucun runtime/permission/SQL/fixture/service modifié. Reprise : intégrer revue, clôturer4.1 avec commit/push puis4.2 automatiquement.

### Point4.1 — Clôture avec R16

Date : 2026-10-10T09:36:31.768987+02:00. Remote en ligne, UID1002 dental-ai, /srv/dental-lab et cgroup dental-ai-remote vérifiés ; HEAD1fab333, seuls changements préparatoires4.1 présents. R16 approuve la maquette existante, couleurs/police16px/cibles44px/responsive mobile-first clinique/albanais/parcours et critères complémentaires. Mise à jour visual-direction, tokens et validation ; HTML approuvé conservé. Historique du blocage conservé.

Validation : reprise des fichiers réellement présents et critères4.1, JSON/HTML/liens/modes/propriétés et diff contrôlés avant commit ; contrastes calculés préalables inchangés. Statuts textuels, erreurs/confirmations claires, confidentialité selon droits et tests clavier/mobile/contrastes à l'implémentation documentés. Pas de test navigateur réel ni certification accessibilité prétendu. Statut final ☑ Validé conception4.1, R16 consignée, détail esthétique réversible autonome. Aucun runtime/permission/SQL/fixture/service modifié. Commit/push ciblés après revue ; hash historique/compte rendu. Suite automatique4.2.

### Point4.2 — Navigation et accès par rôle

Date : 2026-10-10T09:39:47.881893+02:00. État initial : HEADd873e5a poussé, arbre propre ; audit CDC§§2/11/13 et modèle droits3.3/R16, aucun modèle navigation existant. Créations : navigation.md, navigation-plan.json et navigation-preview.html. Deux portails, profils/session inconnue/pending/suspendu, menus par grants effectifs, owner-only et projection logistique sans patient ; règle responsive mobile-first clinique/cibles44px, focus et refus direct/caches/revocation décrits. Aucun sélecteur de rôle produit ajouté.

Validation conception : planJSON et capacités retrouvées dans modèle3.3, scopes clinic/owner-only et deny-by-default. Premier parseur de contrôle limité à deux segments a mal lu messaging.order.read ; cause identifiée, correction des segments puis contrôle réussi, aucune permission produit changée. Prototype statique sq sans donnée sensible, liens/modes/diff contrôlés. Ce contrôle ne prouve pas un routeur/serveur absent : tests responsive/clavier/IDOR réels à implémentation et4.14. Statut final ☑ Validé conception4.2. Aucun runtime/SQL/fixture/service/secret/privilège touché. Commit/push ciblés après revue ; hash historique/compte rendu. Suite automatique4.3.

### Point4.3 — Inscription, approbation et récupération

Date : 2026-10-10T09:42:13.297699+02:00. État initial : HEADb7378aa poussé, arbre propre ; audit CDC§§2/11/15/17 et comptes3.2/navigation/R15/R16. Créations account-access.md, account-flows.json et account-preview.html. Champs inscription exacts, approbation manuelle, compte partagé, invitation bornée/usage unique, récupération générique, suspension/blocage distincts et e-mail en étapes ; aucun compte/secret créé. H43-01 adresse complète multiligne réversible sans champ obligatoire ajouté.

Validation réelle de conception : planJSON/champsCDC, HTMLsq/labels/IDs et contrôles inertes, reset sans déblocage suspension/coffre, liens/propriétés/modes/diff. Formulaires en une colonne validables téléphone/tablette ; aucun rendu/test navigateur/anti-énumération opérationnel prétendu. Token TTL/politique hash et conformité aux jalons dédiés. Statut final ☑ Validé conception4.3. Aucun mail réel/SQL/fixture/runtime/service/permission modifié. Commit/push ciblés après revue ; hash historique/compte rendu. Suite automatique4.4.

### Point4.4 — FDI préparé, test navigateur BLOQUÉ

Date : 2026-10-10T09:48:58.558248+02:00. État initial : HEADe9189d9 poussé, arbre propre ; CDC§4.1/versions/R16 audités. Chromium154 présent /usr/bin/chromium ; Playwright/Puppeteer absents depuis projet. Créations fdi.md, fdi-model.js, fdi-preview.html, check-fdi-browser.mjs, fdi-validation.md ; .gitignore exclut uniquement profil/rapport QA privé docs/design/.browser-qa. H44-01 quadrants et grille responsive réversibles,32dents/cycle/textes/clavier/cibles44px sans dents obligatoires ni bridge automatique.

Vérifications réellement exécutées : Node logique32dents/cycles/entrée intacte/état vide/refus horsFDI OK, HTMLsq/32boutons/noms accessibles/ressource locale OK. Test navigateur CDP avec sandbox intact échoue avant page : SIGTRAP/exit1, pthread_create EAGAIN et NETLINK refusé. Aucun test tactile/clavier/375–1024 validé. Contrôle systemd ciblé en lecture seule confirme TasksMax100, MemoryMax1GiB, NoNewPrivilegesyes et AF_INET/AF_INET6/AF_UNIX ; TasksCurrent48 après échec. NETLINK exclu, création threads sous pression compatible avec confinement, pas de causalité exclusive inventée. PID de test identifiés absents après fin.

Statut final ⚠ Bloqué : critère exact4.4 « Test tactile + clavier/lecteur si applicable » non satisfait. Pas de commit/push de4.4 après échec, changements attribuables laissés dans projet ; 4.5 non commencé. Aucune migration/fixture/service/permission/sandbox/limite changée ni données sensibles créées. Action minimale : recette des fichiers HTML+JS sur navigateur/tablette de test isolé, fournir résultats/proof du cycle tactile/clavier/états/résumé/cibles et largeurs. Ne pas élargir Remote ou passer au suivant sans résolution explicite. Empreintes et détails fdi-validation.md, rapport privé .browser-qa/fdi-result.json.

### Point4.4 — Recette externe organisée, exception de progression

Date : 2026-10-10T09:57:29.278296+02:00. Remote/UID1002/cgroup/chemin confirmés ; changements préparatoires attribuables à4.4, HEAD e9189d9. Le propriétaire a examiné prototype et rapport : conservation du blocage navigateur, interdiction de contourner Chromium, poursuite des seules conceptions indépendantes. Protocole fdi-acceptance.md et archive fdi-review.zip contenant HTML+JS+fiche+SHA256SUMS ; empreintes fdi-review.sha256. Archive contrôlée par lecture ZIP/empreintes, sans profil QA ni données réelles. CONSIGNE reçoit cette exception ciblée, aucun changement de sécurité. Statut4.4 reste ⚠ Bloqué, aucune recette navigateur réussie ni clôture prétendue. Versionnement de la préparation examinée et du suivi de dépendance, pas validation du point. Prochain point4.5 : structure du formulaire indépendante du rendu FDI ; intégration et recette interactive restent dépendantes de4.4.

### Point4.5 — Formulaire de commande complet

Date : 2026-10-10T09:59:27.698026+02:00. État initial : arbre propre, HEAD ffad617. Audit : CDC§§3–4/5.4/11/12, contrat ClinicSubmission3.11, navigation4.2 et tokensR16 ; aucun formulaire de commande existant. Conception indépendante de la recette FDI selon exception du propriétaire ; aucune clôture4.4 implicite. Fichiers : docs/design/order-form.md, docs/design/order-form-preview.html. Identification alternative, matériau/teinte uniques, date souhaitée obligatoire, FDI facultatif et avertissements non bloquants ; catalogue interdit bloque. H45-01 formulaire une colonne + récapitulatif avant envoi réversible.

Validation réellement exécutée : revue règles/sources, HTMLParser (sq, IDs uniques, labels, liens, contrôles inertes, aucune ressource externe), JSON si présent, tokens R16 (16px/44px/règle mobile), droits1002/mode600, diff avant commit. Cohérence de conception évaluée sur structure et scénarios ; aucun rendu navigateur ni test fonctionnel/accessibilité réel prétendu. Recette mobile/clavier/lecteur et intégration aux gates4.14/implémentation ;4.4 reste bloqué. Statut final ☑ Validé pour conception4.5 uniquement. Aucun SQL/migration/secret/runtime/service/privilège modifié. Commit/push ciblés après revue ; identifiant dans historique Git et chat. Suite 4.6.

### Point4.6 — Listes et détail des travaux

Date : 2026-10-10T10:00:35.553320+02:00. État initial : arbre propre, HEAD c55caa9. Audit : CDC§§2.3/5/7/13, automate3.5 et projections3.11 ; aucun écran travaux existant. Conception indépendante de la recette FDI selon exception du propriétaire ; aucune clôture4.4 implicite. Fichiers : docs/design/works.md, docs/design/works-preview.html. Réception orientée action, recherche selon droits, fiches logistique/détaillée distinctes, versions et actions contextuelles. H46-01 cartes compactes mobile et sections de détail, sans tableau financier.

Validation réellement exécutée : revue règles/sources, HTMLParser (sq, IDs uniques, labels, liens, contrôles inertes, aucune ressource externe), JSON si présent, tokens R16 (16px/44px/règle mobile), droits1002/mode600, diff avant commit. Cohérence de conception évaluée sur structure et scénarios ; aucun rendu navigateur ni test fonctionnel/accessibilité réel prétendu. Recette mobile/clavier/lecteur et intégration aux gates4.14/implémentation ;4.4 reste bloqué. Statut final ☑ Validé pour conception4.6 uniquement. Aucun SQL/migration/secret/runtime/service/privilège modifié. Commit/push ciblés après revue ; identifiant dans historique Git et chat. Suite 4.7.

### Point4.7 — Modifications, annulations et corrections

Date : 2026-10-10T10:01:39.883426+02:00. État initial : arbre propre, HEAD 71522d8. Audit : CDC§§5.1–5.3 et automate3.5 reconsultés ; aucun écran de décision existant. Conception indépendante de la recette FDI selon exception du propriétaire ; aucune clôture4.4 implicite. Fichiers : docs/design/order-decisions.md, docs/design/order-decisions-preview.html. Matrice acteur/état, original/proposition séparés, un seul pending, retrait et conflits, motifs et confirmations sans changer les statuts.

Validation réellement exécutée : revue règles/sources, HTMLParser (sq, IDs uniques, labels, liens, contrôles inertes, aucune ressource externe), JSON si présent, tokens R16 (16px/44px/règle mobile), droits1002/mode600, diff avant commit. Cohérence de conception évaluée sur structure et scénarios ; aucun rendu navigateur ni test fonctionnel/accessibilité réel prétendu. Recette mobile/clavier/lecteur et intégration aux gates4.14/implémentation ;4.4 reste bloqué. Statut final ☑ Validé pour conception4.7 uniquement. Aucun SQL/migration/secret/runtime/service/privilège modifié. Commit/push ciblés après revue ; identifiant dans historique Git et chat. Suite 4.8.

### Point4.8 — Retouches et chaînes de travaux

Date : 2026-10-10T10:02:40.482333+02:00. État initial : arbre propre, HEAD 564972b. Audit : CDC§§5.3/5.5/6/7 et modèle linked-works3.6 lus ; R14 et H35-02 ; aucun écran chaîne existant. Conception indépendante de la recette FDI selon exception du propriétaire ; aucune clôture4.4 implicite. Fichiers : docs/design/linked-works-ux.md, docs/design/linked-works-preview.html. Retouche textuelle sans FDI sur parent réellement livré, unicité active, remplacement/supplément distincts et conséquences source visibles. Révision historique conservée.

Validation réellement exécutée : revue règles/sources, HTMLParser (sq, IDs uniques, labels, liens, contrôles inertes, aucune ressource externe), JSON si présent, tokens R16 (16px/44px/règle mobile), droits1002/mode600, diff avant commit. Cohérence de conception évaluée sur structure et scénarios ; aucun rendu navigateur ni test fonctionnel/accessibilité réel prétendu. Recette mobile/clavier/lecteur et intégration aux gates4.14/implémentation ;4.4 reste bloqué. Statut final ☑ Validé pour conception4.8 uniquement. Aucun SQL/migration/secret/runtime/service/privilège modifié. Commit/push ciblés après revue ; identifiant dans historique Git et chat. Suite 4.9.

### Point4.9 — Messagerie temps réel

Date : 2026-10-10T10:03:47.897520+02:00. État initial : arbre propre, HEAD 947aa15. Audit : CDC§§9–10 et modèle événements/lecture partagée3.9 reconsultés ; aucune interface messagerie existante. Conception indépendante de la recette FDI selon exception du propriétaire ; aucune clôture4.4 implicite. Fichiers : docs/design/messaging.md, docs/design/messaging-preview.html. Conversation générale/per-work identifiables, non-lus versus traitement, envoyé/lu, modifications traçables et lecture seule livraison ; reprise connectée sans cache médical officiel.

Validation réellement exécutée : revue règles/sources, HTMLParser (sq, IDs uniques, labels, liens, contrôles inertes, aucune ressource externe), JSON si présent, tokens R16 (16px/44px/règle mobile), droits1002/mode600, diff avant commit. Cohérence de conception évaluée sur structure et scénarios ; aucun rendu navigateur ni test fonctionnel/accessibilité réel prétendu. Recette mobile/clavier/lecteur et intégration aux gates4.14/implémentation ;4.4 reste bloqué. Statut final ☑ Validé pour conception4.9 uniquement. Aucun SQL/migration/secret/runtime/service/privilège modifié. Commit/push ciblés après revue ; identifiant dans historique Git et chat. Suite 4.10.

### Point4.10 — Calendrier et livraison groupée

Date : 2026-10-10T10:04:55.392606+02:00. État initial : arbre propre, HEAD 4103c96. Audit : CDC§7, automate3.5/H35-03, permissions et R16 ; aucun calendrier existant. Conception indépendante de la recette FDI selon exception du propriétaire ; aucune clôture4.4 implicite. Fichiers : docs/design/delivery.md, docs/design/delivery-preview.html. Semaine/mois, planifiée versus souhaitée provisoire, alternative détail mobile au drag, lot confirmé et recontrôle atomique ; correction exceptionnelle motivée séparée.

Validation réellement exécutée : revue règles/sources, HTMLParser (sq, IDs uniques, labels, liens, contrôles inertes, aucune ressource externe), JSON si présent, tokens R16 (16px/44px/règle mobile), droits1002/mode600, diff avant commit. Cohérence de conception évaluée sur structure et scénarios ; aucun rendu navigateur ni test fonctionnel/accessibilité réel prétendu. Recette mobile/clavier/lecteur et intégration aux gates4.14/implémentation ;4.4 reste bloqué. Statut final ☑ Validé pour conception4.10 uniquement. Aucun SQL/migration/secret/runtime/service/privilège modifié. Commit/push ciblés après revue ; identifiant dans historique Git et chat. Suite 4.11.

Contrôle complémentaire4.10 : libellé français résiduel Semaine corrigé en Javë ; maquette mensuelle31jours ajoutée avec grille sept jours, liste chronologique mobile conservée. Calendar Python vérifie octobre2026 ; aucune interaction/rendu réel prétendu. Commit correctif ciblé, historique conservé.

### Point4.11 — Fichiers et progression des transferts

Date : 2026-10-10T10:06:39.995009+02:00. État initial : arbre propre, HEAD 3927fb3. Audit : CDC§§4.2/8/12 et modèle files-lifecycle3.7 reconsultés ; aucun écran transfert existant. Conception indépendante de la recette FDI selon exception du propriétaire ; aucune clôture4.4 implicite. Fichiers : docs/design/files-ux.md, docs/design/files-preview.html. États par fichier avec progression/verification distincte, reprise/expiration/saturation, fichiers de fabrication verrouillés et suivi interne/partagé, ZIP autorisé.

Validation réellement exécutée : revue règles/sources, HTMLParser (sq, IDs uniques, labels, liens, contrôles inertes, aucune ressource externe), JSON si présent, tokens R16 (16px/44px/règle mobile), droits1002/mode600, diff avant commit. Cohérence de conception évaluée sur structure et scénarios ; aucun rendu navigateur ni test fonctionnel/accessibilité réel prétendu. Recette mobile/clavier/lecteur et intégration aux gates4.14/implémentation ;4.4 reste bloqué. Statut final ☑ Validé pour conception4.11 uniquement. Aucun SQL/migration/secret/runtime/service/privilège modifié. Commit/push ciblés après revue ; identifiant dans historique Git et chat. Suite 4.12.

### Point4.12 — Brouillons PWA hors ligne

Date : 2026-10-10T10:07:55.695226+02:00. État initial : arbre propre, HEAD 5443c6f. Audit : CDC§11/R15/12 et modèle drafts-sync3.8 reconsultés ; aucune interface offline existante. Conception indépendante de la recette FDI selon exception du propriétaire ; aucune clôture4.4 implicite. Fichiers : docs/design/drafts-ux.md, docs/design/drafts-preview.html. États local/synchronisé/offline/coffre, initialisation et secours sans secret réel, conflit serveur/clone local fichiers compris, quotas et reprise, soumission explicite.

Validation réellement exécutée : revue règles/sources, HTMLParser (sq, IDs uniques, labels, liens, contrôles inertes, aucune ressource externe), JSON si présent, tokens R16 (16px/44px/règle mobile), droits1002/mode600, diff avant commit. Cohérence de conception évaluée sur structure et scénarios ; aucun rendu navigateur ni test fonctionnel/accessibilité réel prétendu. Recette mobile/clavier/lecteur et intégration aux gates4.14/implémentation ;4.4 reste bloqué. Statut final ☑ Validé pour conception4.12 uniquement. Aucun SQL/migration/secret/runtime/service/privilège modifié. Commit/push ciblés après revue ; identifiant dans historique Git et chat. Suite 4.13.

### Point4.13 — Outils propriétaire et exceptions

Date : 2026-10-10T10:09:23.687190+02:00. État initial : arbre propre, HEAD 9182755. Audit : CDC§§2–3/14–16 et modèles droits/événements/rétention ; aucun écran propriétaire existant. Conception indépendante de la recette FDI selon exception du propriétaire ; aucune clôture4.4 implicite. Fichiers : docs/design/owner-tools.md, docs/design/owner-tools-preview.html. Outils sensibles secondaires selon grants, dépendances de permissions, interdiction sans contournement, audit et mails owner-only, capacité non inventée, maintenance explicite et archives distinctes de purge.

Validation réellement exécutée : revue règles/sources, HTMLParser (sq, IDs uniques, labels, liens, contrôles inertes, aucune ressource externe), JSON si présent, tokens R16 (16px/44px/règle mobile), droits1002/mode600, diff avant commit. Cohérence de conception évaluée sur structure et scénarios ; aucun rendu navigateur ni test fonctionnel/accessibilité réel prétendu. Recette mobile/clavier/lecteur et intégration aux gates4.14/implémentation ;4.4 reste bloqué. Statut final ☑ Validé pour conception4.13 uniquement. Aucun SQL/migration/secret/runtime/service/privilège modifié. Commit/push ciblés après revue ; identifiant dans historique Git et chat. Suite 4.14 (audit préparatoire puis attente de recette réelle).

### Point4.14 — Audit préparatoire, recette réelle BLOQUÉE

Date : 2026-10-10T10:12:02.985220+02:00. État initial : HEAD4272f4a poussé, arbre propre ;4.5–4.13 conceptions indépendantes validées,4.4 encore bloqué conformément consigne propriétaire. Audit exact4.14 : responsive/albanais/textes longs/loading/erreurs/empty/modal/focus/contrastes, acceptation avant câblage. Créations docs/design/check-design.py, design-validation.json, design-review.html, design-acceptance.md, design-review.sha256 et design-review.zip.

Vérifications réelles :13maquettes HTMLParser (sq/viewport/labels/IDs/liens locaux/contrôles inertes, scripts seulementFDI), tokens16px/44px/règlesresponsive, rapportsSHA256 ; contrastes calculés17.85 texte,7.58 secondaire,5.47 primaire,6.84 warning,5.91 danger,6.81 success,6.70 focus,4.76 border. Index13liens revus en albanais, propriétés1002/mode600, archive et manifeste octet-identiques contrôlés. Empreinte archive complète c2dc88a8063d9fc46c3a4778249208d6796189450440d67e7e95a32e72489e87. Pas de lancement Chromium, aucun test tactile/clavier/lecteur/rendu réel prétendu. Prototypes statiques ne prouvent pas formulaires/modales/ACL/PWA/crypto/ZIP/runtime ; ces preuves restent aux jalons correspondants.

Statut final ⚠ Bloqué4.14 : recette FDI4.4 réelle, revue navigateur responsive/focus/états et acceptation maquettes manquantes ; directionR16 seule ne vaut pas ces tests. Chapitre5 non commencé. Commit/push de préparation et suivi uniquement, pas clôture de point. Aucun service/sécurité/permission/SQL/migration/fixture modifié. Action minimale : télécharger dossier, extraire ensemble sur navigateur/appareil local isolé, retourner fiches complétées (appareil/version/testeur/date/SHA/résultats/preuves), puis corriger/retester tout échec. Aucun élargissement VPS autorisé. Reprise après ces preuves, pas nouvelle confirmation pour les opérations ordinaires.

### R17 — Report de recette et reprise du développement

Date : 2026-10-10T10:51:13.462564+02:00. Remote en ligne, dental-ai UID1002, cgroup/chemin vérifiés, HEADc66a0a8 propre et égal distant. Décision propriétaire : report4.4/4.14 jusqu'à disponibilité PC/tablette, reprise chapitre5 et tâches indépendantes. Statuts canoniques actualisés, CONSIGNE1.2 intègre exception ciblée ; historique des blocages conservé. Tests encore attendus : tactile réel32FDI/cycle, Entrée/Espace/focus, résumé, responsive/zoom, lecteur si applicable, revue albanais et acceptation maquettes. Aucun succès navigateur, production ou tests fonctionnels prétendu. Empreintes de tous fichiers design inchangées contrôlées ; aucune sécurité/service/SQL modifié. Commit/push documentaire ciblé après diff. Suite5.1.

### Point5.1 — Dépôt existant déjà conforme

Date : 2026-10-10T10:51:51.375236+02:00. État initial : HEADa493dd5, main, arbre propre avant suivi ; RemoteUID1002, /srv/dental-lab, .git réel UID1002 (775 protégé par parent700). Modifications : suivi seulement, aucune réinitialisation Git. Vérifications réellement exécutées : toplevel exact, main, remote validé git@github-dental:ResulR/dental_app_v1.git et ls-remote égal ; git fsck exit0 (deux blobs non référencés, aucune corruption), aucune suppression/GC. Statut final : ☑ Validé. R17 maintient4.4/4.14 reportés ; aucun succès navigateur ou aptitude production déclaré. Aucun service voisin/permission/SQL/migration modifié. Commit/push ciblés après revue, hash dans historique Git et compte rendu. Suite : 5.2.

### Point5.2 — Garde-fous de versionnement

Date : 2026-10-10T10:54:11.298161+02:00. État initial : HEADcff8327 propre ; .gitignore et .env.example PostgreSQL préexistants lus/audités sans affichage secrets. Modifications : exclusions runtime/cache/clés/backups ; scripts/check-versioning.py, hook pré-commit local et docs/VERSIONING.md ; modèle env conservé. Vérifications réellement exécutées : première création arrêtée par assertion fichier existant sans écriture, cause identifiée puis modèle réutilisé ; base dédiée et credential vide vérifiés sans sortie valeurs ; cas synthétiques chemins refusés/autorisé et token détecté OK ; check-ignore et contrôle index/staged OK ; diff et hook avant commit. Statut final : ☑ Validé. R17 maintient4.4/4.14 reportés ; aucun succès navigateur ou aptitude production déclaré. Aucun service voisin/permission/SQL/migration modifié. Commit/push ciblés après revue, hash dans historique Git et compte rendu. Suite : 5.3 (versions stables/peers avant installation).

### Point5.3 — Monorepo npm et versions verrouillées

Date : 2026-10-10T10:58:38.077972+02:00. État initial : HEADd24af58 propre, aucun package/apps/packages ; ADR0001 confirmé, Node22.22.2/npm10.9.7 linuxx64 existants. Modifications : npm workspaces web/api/contracts, entrée publique contracts, manifests privés, lockfile et .npmrc sans lifecycle automatique, ADR0004 et contrôle résolution. Vérifications réellement exécutées : versions/engines/peers npm view ; TypeScript6.0.3 et TS-eslint<6.1 compatibles ; npm install puis npm ci ignore-scripts réussis ; lockSHA identique d12be81a1a42ca9a908e481e03014ee9082eaee0622441c7a7e01d3384ff0e3f ; check:workspace et imports Vite/plugin natifs OK ; npm ls sans rupture ; audit npm0 vulnérabilité, aucun upgradeglobal/browser. Statut final : ☑ Validé. R17 maintient4.4/4.14 reportés ; aucun succès navigateur ou aptitude production déclaré. Aucun service voisin/permission/SQL/migration modifié. Commit/push ciblés après revue, hash dans historique Git et compte rendu. Suite : 5.4.

### Point5.4 — Configuration préparée, exécution Remote indisponible

Date : 10/10/2026, Europe/Brussels (heure précise non récupérable après refus d'exécution). État initial : HEAD4e3d446 poussé, point5.3 validé ; arbre propre avant5.4. Fichiers préparés : tsconfig.base.json, tsconfig web/API/contracts, eslint.config.mjs, .prettierrc.json/.prettierignore, scripts/check-boundaries.mjs, docs/QUALITY.md, entrées src/index.ts web/API ; manifests/scripts et check-workspace ajustés. Aucun service/SQL/privilège/protection modifié. npm run format a réussi sur code/config uniquement, prototypes approuvés conservés.

Processus de vérification1939479 : build:packages est entré dans tsc contracts ; sortie finale et succès non établis. Typecheck/lint/format:check/boundaries/exemples négatifs/workspace suivants non prouvés. Aucun relancement ni arrêt global. Une commande ciblée de diagnostic puis la commande minimale id ont reçu « Failed to get process ID. The command could not be executed. » (INVALID_ARGUMENT). Device reste listé Online, lecture de fichiers/process output fonctionne ; ceci ne prouve pas exécution active ni cause (ressources/service à vérifier). Aucun contournement/augmentation des limites tenté.

Statut5.4 ⚠ Bloqué, pas commit/push de ses modifications ;5.5 non commencé. Suivi conservé par opérations fichier Remote normales uniquement, sans shell ni poursuite de code. Dernier point validé5.3, commit4e3d446 ; R17 garde4.4/4.14 reportés et ne constitue pas ce blocage. Action minimale administrateur : vérifier en lecture seule l'état et TasksCurrent/TasksMax/MemoryCurrent/MemoryMax du seul dental-ai-remote.service et le processus1939479 si encore présent, puis rétablir l'exécution autorisée sous dental-ai sans affaiblir les protections. À reprise : revérifier UID1002/Git, état du processus existant et diff, établir cause avant nouveaux tests ; ne pas supposer qu'un build a fini ni recommencer migrations/fixtures.

### Point5.4 — TypeScript strict et contrôles bornés R18

Date : 2026-10-10T23:28:47.966131+02:00. Reprise contrôlée : UID1002, chemin réel /srv/dental-lab, Remote Online, cgroup dental-ai-remote.service, TasksMax100/NoNewPrivileges conservés ; baseline46 hors commande,47–48 pendant audit. Ancien build interrompu par administrateur : aucun succès attribué. Origine16workers prouvée dans bootstrap Remote DEFAULT_THREADPOOL_SIZE16, héritage enfant16 ; aucun changement Remote. Mémoire audit anon182661120/file581672960/kernel38588416, pas assimilation cache à heap.

Modifications : configs TS strict/ESLint/Prettier et frontières initialement préparées ; lanceur Python séquentiel sans npm imbriqué, pool libuv1/Rayon1/V8pool1/heap192MiB par enfant, deadline90s, verrou exclusif, admission24tâches et448MiB hors cache, surveillance, TERM/KILL groupe enfant seulement. Commandes workspace conservent leur portée. CONSIGNEv1.3 et docs/QUALITY.md documentent R18. Prototypes, fixturesSQL et services conservés.

Vérifications réellement exécutées : probe5threads ; tests admission tâches/mémoire refusées, environnement parent inchangé, timeout avec enfant ignorant TERM nettoyé et résultat non nul, verrou exclusif et portée workspace, refus/import public OK. Pipeline quality complet exit0 en29.25s : builds contrats3.60s/API5.11s, trois typechecks2.89/4.91/4.00s, lint5.50s, format1.41s, boundaries1.58s, résolution0.20s ; pic52/100. Dernier format check après ajustement alias exit0 pic53/100. Diff/check secrets revus avant commit. Aucun succès navigateur déclaré sous R17 ; aucune migration, permission ou opération sur service voisin.

Statut final : ☑ Validé. Commit/push ciblés après revue ; hash vérifiable Git et compte rendu. Risques résiduels : outils natifs peuvent créer d’autres workers, surveillance non isolation VPS, pics très courts entre échantillons possibles ; conservation limites et absence concurrence obligatoire. Suite :5.5.

### Point5.5 — Outils de tests et fixtures isolées

Date : 2026-10-10T23:30:58.950374+02:00. État initial : HEAD66e4b6d propre, versions Vitest5.0.3/Playwright1.64.0 vérifiées dans packages locaux et ADR0004. Fichiers : vitest.config.mjs, playwright.config.mjs, tests unit/intégration/e2e API et probe Express/Zod test-only ; commandes bornées et documentation. Créations initiales des fixtures refusées ENOENT (dossiers absents), puis dossiers privés explicitement créés ; aucune fixture SQL modifiée.

Résultats réels :8 tests unitaires frontières passent (4.14s,pic64),1 intégration Express/ESM/Zod sur serveur éphémère (2.72s,pic65),1 Playwright client API requêtes valide/refusée (8.52s,pic58), lint5.54s/pic55 et format1.49s/pic52 exit0. Un seul worker et contrôles séquentiels. Aucune connexion à services existants ; port0 créé et serveur fermé en finally. Pas DB/migration/donnée médicale ni Chromium. Exemple transport démontre outillage, pas validation de parcours métier.

Statut final : ☑ Validé pour configuration et exemples de chaque type, E2E API explicitement distinct de navigateur. R17 garde les recettes visuelles/tactile/clavier/lecteur reportées ; aucune aptitude production. Diff et guard examinés avant commit/push ciblés, hash dans Git et compte rendu. Suite :5.6, build et parties indépendantes de recette responsive.

### Point5.6 — Shell React/PWA, recette responsive reportée

Date : 2026-10-10T23:34:12.474691+02:00. État initial : HEAD7d55552 propre ; prototypes direction/navigation lus et CDC privé/installable revérifié. Fichiers : entry HTML React, App/public-shell sans identité/données/navigations privées, composants shared et CSS R16 ; manifeste/icônes, build via API Vite sans npm enfant, serviceworker généré sur whitelist publique. Commandes et docs/FRONTEND.md. Aucun déploiement/port permanent/runtime/secret créé.

Tests réels : buildweb1.55s/pic63, TSweb5.80s/pic52, lint6.95s/pic53, frontières9sources1.76s/pic52,9tests unitaires4.40s/pic65 incluant refuscache API/fichier/query/externe/POST, format2.46s/pic52 ; exit0. Manifeste lang/display, dimensions192/512 et7assets publics vérifiés. Refus de cache privé testé comme politique, pas exécutionSW dans navigateur. Archives/prototypes préexistants inchangés.

Statut final : ◐ En cours — implémentation/build validés, recette responsive/installation/offline/clavier/tactile/lecteur/contraste réelle reportée R17. Aucun faux succès ni readinessproduction. Commit des parties indépendantes après diff/guard, autorisé R17 ; hash dans Git/compte rendu. Dépendance ouverte suivie ici et docs/FRONTEND.md, ne bloque pas serveur indépendant. Suite :5.7.

### Point5.7 — API Express, configuration et liveness

Date : 2026-10-10T23:37:06.663402+02:00. État initial : HEADf079365 propre ; contrat3.11 et runtime indépendant2.8 relus. Fichiers : factory/config/problems/server et entry API, tests config/santé/erreurs et docs/API_FOUNDATION.md. Configuration explicite loopback/port, refus autre PGDATABASE, démarrage/arrêt contrôlés ; health uniquement liveness, pas readinessDB. Erreurs publiques albanaises expurgées, no-store, parser métadonnées borné et timeouts ; aucune connexionSQL/runtime permanent.

Résultats : build6.21s puis6.26s exit0,10 unitaires4.81s/pic66,3intégration4.04s/pic65 (health200,404générique,no-store,no-XPoweredBy,500sansmarqueur/stack,JSONmalformé400, fermeture serveur finally). Premierlint échoue _next inutilisé ; cause identifiée (signature Express4paramètres), ajout void explicite sans changer arité. Lint relancé6.96s exit0,pic53 ; frontières13sources1.74s et format3.07s OK. Tests réseau ciblent leurs seuls serveurs loopback port0, aucun voisin.

Statut final : ☑ Validé. Diff/guard avant commit/push ciblés, hash dans Git/compte rendu. Port/runtime/identitéSQL production toujours non créés ni approuvés ; R17 maintient5.6/4.4/4.14 recette reportée. Suite :5.8.

### Point5.8 — Logs expurgés, corrélation et canal audit séparé

Date : 2026-10-10T23:40:18.384249+02:00. État initial : HEAD724cc8f propre ; modèle événements/audit3.9 relu. Modifications : logger technique whitelist/UTC/JSON, middleware UUIDserveur finish-close sans doublon, lifecycle même format ; port append-only audit distinct reconstruisant record minimal readonly, codes fermés et échec propagé. Docs/LOGGING.md distingue infrastructure de logs et futur auditSQL transactionnel/policies owner encore non installés. Aucune routeaudit ni événement métier créé.

Validation réelle : exempleHTTP500 réponse/header/log UUIDidentique ; marqueur synthétique absent malgré body/Authorization/query/error ; pas body/url/header/stack/patient. Deux destinations fichiers privés temporaires distinctes, extra champs sensibles exclus, panneappend propagée, action arbitraire et UUIDmalformé refusés ; fichiers test supprimés finally. Build6.55s/6.75s exit0,pic52 ;5intégration5.01s/5.18s exit0,pic66/64 ; lint7.74s/pic53, frontières16sources1.86s/pic52, format3.26s/pic52 OK. Modifications finales UUIDregex/tests reformatées, compilées et retestées ; pas retests redondants des contrôles indépendants.

Statut final : ☑ Validé pour fondations5.8 ; durableauditSQL/transaction/ACL restent aux étapes dédiées, jamais prétendus opérationnels. Diff/guard avant commit/push ciblés. R17 et limites Remote inchangés, aucun voisin/secret/migration. Suite :5.9.

### Point5.9 — Contrats runtime partagés et dérive contrôlée

Date : 2026-10-10T23:45:09.683095+02:00. État initial : HEADf9530a7 propre ; CDC4.1/4.2, contrat3.11 et schémas/consumers relus. Modifications : source Zod unique dans contracts, types inférés, validation déterministe patient/date/FDI/uniqueness et warning nonbloquant ; schémas fermés projections/erreurs/reçu/santé. API valide entrée/sortie async ; health/Problem réels validés. Web importe mêmes schémas et refuse réponseincompatible. Problems déplacé de app vers shared pour conserver direction des couches. SnapshotJSON dérivé/version et check:contracts ; préparateur flagwx refuse overwrite ; docs/CONTRACTS.md et prérequis build tests.

Résultats réels : buildscontracts9.38s/API7.80s, puisAPI7.50/7.72s aprèsmiddleware ; TSweb11.08s exit0. Snapshotversion/structure0.40s OK.14unitaires5.65s/pic65 dont correspondance champs/required/enums conception, patientref/noms/both,32FDI/doublons/white/calendar/unsafeinteger,120fichiers acceptés et pas réflexionvaleurs.6intégration6.88s puis6.90s/pic66 : décisionsidentiquesweb/API, refusclinic_id,500sanspatientpourréponsehorscontrat async, health/Problemdécodés. Lint7.88s,pic53 ; frontières19sources1.89s,pic52 ; format4.27s,pic53 ; webbuild1.41s,pic64 ; E2EAPI confirmé avantcommit dans sortieRemote. Aucunendpointofficiel/soumission/DB créé. Les refinements non représentablesJSON restent protégés par tests sémantiques, snapshotseul ne prouve pas compatibilité métier.

Statut final : ☑ Validé. Diff/guard avantcommit/push ciblés ; hashdansGit/compterendu. R17 garde recettes4.4/4.14/5.6reportées. Aucun secret/service/migration/privilège modifié. Suite :6.1, auditer connexionruntime dédiée sans élargir identité dental-ai.

### Point6.1 — Blocage identité PostgreSQL applicative

Date : 2026-10-10T23:47:14.974029+02:00. État initial : HEADfb113d4 propre/push confirmé,5.9validé ;6.1 exige client PostgreSQL avec connexion rôle dédié minimal, pool/timeout et preuve de périmètre dental_lab. Audit ciblé docs/ENVIRONMENT.md et RUNTIME_PRIVILEGES.md : création identité/runtime/secrets prévue19.3/19.4, aucune autorisation de création anticipée. LookupLinux candidat dental-lab-runtime absent.

AuditSQL réellement exécuté sous UID1002, psql/usr/bin/psql -X/-w sur socket/port du modèle public vérifié /var/run/postgresql:5432, database dental_lab et rôle dental-ai ; options read-only/timeout5s, deadline15s. Aucune lecture secret/connexion autrebase. Résultat : dental_lab/dental-ai/version170011 (PostgreSQL17.11) ; dental-ai LOGIN sans superuser/createdb/createrole/replication/bypassrls ; dental_lab_app NOLOGIN sans attributs administratifs, CONNECTdental_lab=false ; audit membreapp=false. Aucun rôle dental-lab-runtime dans résultat ciblé. WarningPGPASSFILE/dev/null nonplain consigné, aucune utilisation de motdepasse ni modification SQL.

Statut : ⚠ Bloqué avant installation/client/connexionruntime. Aucun code6.1, compte/secret/grant/HBA/service/migration créé. Le manque n’est pas la recette navigateur R17. Il faut une décision administrateur sur l’identité et le mécanisme de test contrôlé limité dental_lab, compatible avec créationruntime19.3/19.4 : ne pas utiliser dental-ai/audit ou migrateur comme runtime et ne pas donner à l’IA des privilèges permanents. Les choix/commandes privilégiées exactes ne peuvent pas être fixés sans ce choix ; aucun changement administrateur proposé à exécuter aveuglément. Rapport public suffisant attendu, jamais secret dans chat.

Suivi seul versionné après diff/guard, commit/push confirmé dans compte rendu. Arrêt au6.1,6.2 non commencé. État R18 conservé : Remote actif, NoNewPrivilegesyes/TasksMax100, compilations séquentielles terminées et aucun enfant de build laissé. Recettes4.4/4.14/5.6toujoursreportées, pas productionready.

## Checkpoint 14/10/2026 — suite de 39ac3de, 6.4 / 7.3

- Dernier socle SQL entièrement reçu : 6.3 ; 6.4 reste le premier point SQL sans réception complète. Audit READ ONLY : quatre objets catalogue, propriétaire migrateur, 19 contraintes validées. Reçu/snapshot administrateur et équivalence de schéma restent à comparer ; ne jamais rejouer 0003. Recette indépendante proposée dans docs/admin-proposals/CATALOG_REGISTRATION_V4_RECEPTION.md, non exécutée.
- 7.3 reste partiel : runtime flag désactivé par défaut, contrôles ACL, conditions approuvées vérifiées par SHA, route de lecture et formulaire albanais préparés. Préparation durable des destinataires email sans envoi, sans worker ni acquittement global de l'outbox. Aucun texte juridique inventé, aucun propriétaire réel créé.
- 165 unitaires, 17 intégrations HTTP, 76 tests hors ligne migrations/gate réussis ; builds/typechecks/lint/contrats/frontières/résolution réussis. Format global toujours en échec uniquement sur scripts historiques v2/v3 inchangés ; pas d'exclusion. UI navigateur R17 non réceptionnée.
- Bundle v4 distinct préparé, empreintes dans REGISTRATION_V4_ARTIFACTS.json. Prochaine porte : accord pour VM indépendante et recette PostgreSQL ; preuve root du reçu 0003 ; validation des conditions/politique anti-abus puis fournisseur email. Aucune activation, migration ou configuration de production autorisée par ce checkpoint. Perte de connexion/COMMIT incertain réel, permissions du planificateur email, livraison et HTTPS restent à recevoir séparément.
- Conservation v1/v2/v3, aucun nettoyage ni relancement. Les tâches applicatives indépendantes demandées sont préparées ; aucune clôture globale des chapitres 6/7.

## Checkpoint 14/10/2026 — fonctionnalités depuis 98d1261

7.3 : texte e-mail albanais sans donnée personnelle/patient, URL HTTPS canonique vérifiée ; fournisseur/worker/livraison et conditions humaines restent ouverts. 7.4 : API/persistance de décision préparées et intégrées derrière flag, non activées. 7.5 : lecture profil intégrée API/UI, édition/historique non reçus. Aucun de ces points entièrement clôturé.

Enveloppe v4 pour VPS existant préparée seulement dans le dépôt : image future/compte/unité/chemins distincts, contrôles d’isolation avant initdb, empreintes figées. Aucun compte/image/montage/unité réellement créé. Voir SHARED_VPS_POSTGRES_V4_PREPARATION.md ; ce bundle reçoit le code 98d1261, pas les nouveaux adaptateurs de décision/profil. Tests limités aux changements ; aucune ancienne recette PostgreSQL rejouée.

La liste paginée et l’interface de décision 7.4 sont maintenant intégrées. Prochaine partie applicative indépendante : évolution versionnée de l’historique contact et raccordement de l’édition 7.5. Réceptions SQL, activation, publication des conditions et fournisseur e-mail nécessitent les accords distincts déjà définis. Les blocages privilégiés ne ferment pas ces tâches applicatives.

### Reprise 14/10/2026 — suite de 8172039

7.5 : édition et historique fonctionnels dans le code intégré, migration0015 proposée et non exécutée. Tests17 ciblés et contrôles de compilation réussis ; aucune validation de production déclarée. Relecture des points7.6–7.9 : livraison des challenges/invitations exige outbox privée chiffrée, clé hors IA, fournisseur et durées explicitement configurées ; aucun contournement par secret en clair ou token retourné au client. Les tâches indépendantes de permissions courantes7.10 peuvent progresser sans ces prérequis.
