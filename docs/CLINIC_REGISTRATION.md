# Inscription clinique — intégration HTTP préparée

Mise à jour du 14 octobre 2026 ; CDC §§2.2, 10.1, 11 et 17.

Le service existant est raccordé à une route Express composable `POST /api/v1/clinics/registration`. La composition de production n'active pas cette route : aucun stockage fictif, version de conditions par défaut ou compte propriétaire n'est ajouté.

## Comportement implémenté

- Contrats requête/reçu partagés, stricts. Champs de contact bornés à 2 000 caractères comme le profil clinique ; email à 320 ; mot de passe limité à 1 024 octets et au moins 15 points de code côté serveur. Le mot de passe n'est pas trimé.
- Profil clinic et review_state pending imposés par le service. Refus des champs supplémentaires, absence d'acceptation explicite, version périmée et adresse invalide.
- Admission synchrone ou asynchrone attendue avant lecture des préconditions, KDF et stockage ; une défaillance du limiteur remonte sans repli permissif.
- Origine exacte, JSON et absence de query exigés. La clé réseau vient de socket.remoteAddress, jamais des en-têtes Forwarded.
- 201/pending uniquement après succès de registerAtomic. Aucun cookie/session, approbation automatique, mot de passe ou coordonnées dans la réponse.
- 400 validation/version changée ; 409 STATE_CONFLICT ; 429 avec Retry-After ; 503 DEPENDENCY_UNAVAILABLE si propriétaire/conditions manquent ; erreur privée masquée en 500.
- Les deux schémas ajoutés au snapshot ne modifient aucun contrat antérieur.

## Persistance préparée, non exécutée sur PostgreSQL

Le nouvel adaptateur registration.repository.ts utilise l'enveloppe transactionnelle bornée existante : compte, credential hashé, clinique pending, acceptation datée, conversation générale, audit, événement clinic_registered et dispatch sont huit écritures dans une seule transaction. Le KDF reste hors transaction. La version courante est relue et verrouillée FOR SHARE avant écriture ; le propriétaire est recontrôlé. Le conflit email ne correspond qu'à accounts_email_key_key/23505 ; les autres erreurs et commits incertains remontent sans nouvelle tentative.

La migration 0014_clinic_registration_terms.sql prépare trois tables : versions de conditions albanaises avec texte/empreinte/référence de validation ; pointeur unique de version courante ; acceptations append-only liées au compte clinique et à la version. Aucune version, donnée légale, ligne de pointeur ou identité n'est insérée.

SHA-256 : `fa96b14e3d30ef3a996f59f4a8e5e2051873ba1bf89c31c2a501529c43ff6e10`.

Le droit UPDATE(singleton) sur le pointeur est limité à une colonne contrainte à 1 : il sert au verrouillage de lecture ; le runtime ne reçoit aucun droit pour changer version_id, publier un texte ou réécrire une acceptation. PostgreSQL exige UPDATE sur au moins une colonne pour FOR SHARE : [documentation PostgreSQL 17 SELECT](https://www.postgresql.org/docs/17/sql-select.html). Cette conception et ses privilèges doivent encore être éprouvés sur PostgreSQL réel ; le catalogue hors ligne ne remplace pas cette recette.

Publication future : conserver chaque version immuable, vérifier le SHA-256 du texte exact et une validation humaine traçable, puis publier le pointeur dans une transaction administrateur distincte. Ne pas déduire la validité juridique d'un simple champ approval_reference. Aucun texte ou accord n'est inventé ici.

## Prochaine porte de réception

Avant toute décision sur les migrations de production, vérifier les reçus administrateur existants, y compris l'absence de collision de version 0014 ; ne jamais déduire leur état du seul dépôt. Préparer une recette indépendante des images v1/v2/v3, puis obtenir un accord explicite avant son exécution PostgreSQL. Elle devra tester avec dental_lab_app : insertion complète et limites ACL ; refus de publication/réécriture ; rollback à chaque écriture ; deux inscriptions du même email (une réussite, un conflit, aucune ligne orpheline) ; publication concurrente des conditions bloquée jusqu'à fin de la transaction ; conditions devenues obsolètes avant verrou refusées ; perte de connexion/commit incertain sans retry. Vérifier ensuite les preuves de non-interférence et conservation des anciennes images.

La composition runtime reste non modifiée tant que cette réception, les préconditions de stockage, la politique du limiteur d'inscription et les conditions publiées ne sont pas réunies. Le branchement UI et le worker e-mail restent des travaux applicatifs ultérieurs ; ce lot ne clôt pas toute la roadmap.

Les textes albanais et leur validation ne sont pas inventés. La livraison réelle de l'e-mail d'inscription et la sélection des destinataires restent à intégrer au worker ; un événement durable seul ne prouvera pas un e-mail livré.

## Vérifications du lot

159 tests unitaires et 16 tests d'intégration passent, dont 3 tests d'admission asynchrone et 4 tests HTTP d'inscription nouveaux, plus 5 tests de l'adaptateur transactionnel avec transport doublé. 58 tests hors ligne migrations/recettes et 18 tests du gate passent. HTTP local réel avec services composés, persistance et KDF doublés dans les tests HTTP, exécuteur transactionnel doublé dans les tests repository : aucune inscription PostgreSQL prétendue.

Build contracts/API, types des trois workspaces, lint, snapshot des contrats et frontières passent. Le contrôle global de formatage échoue sur deux scripts historiques inchangés : scripts/linked-works-postgres-v2.mjs et scripts/linked-works-postgres-v3.mjs. Ils restent figés ; aucune exclusion ou réécriture automatique n'a été ajoutée. La commande format:changed du runner borne l'écriture aux fichiers applicatifs/tests modifiés, sous les mêmes limites de ressources ; elle ne remplace pas le contrôle global.

Le point 7.3 reste partiel. La réception v3 concerne son propre bundle, pas ces nouveaux changements.
