# Contrat de transport e-mail proposé — non activé

**Proposition d'architecture, pas une décision métier ni une intégration.**

## Invariants avant toute activation

1. Aucun transport réel tant que le propriétaire n'a pas accepté une borne
   de révocation explicite et une politique de résolution des ambiguïtés.
2. Un message déjà remis à un prestataire ne peut pas être rappelé par une
   transaction PostgreSQL. La dernière validation ne couvre que les
   révocations **commitées avant son instantané** ; les révocations non
   commitées ou postérieures peuvent échapper au contrôle.
3. Le fournisseur devra offrir, si possible, une **clé d'idempotence durable**
   par livraison logique, une interrogation du statut par clé ou identifiant,
   et une documentation précise des réponses ambiguës, délais et rétentions.
   Ne pas supposer que ces capacités existent : vérifier contractuellement.
4. Ne jamais rejouer automatiquement un résultat ambigu, y compris timeout,
   déconnexion après écriture, crash ou bail expiré. Le marquer pour
   réconciliation humaine ou fournisseur vérifiable.
5. Une erreur temporaire n'est réessayable que si le fournisseur garantit
   qu'il n'a **pas accepté** le message ; sinon la traiter comme ambiguë.
6. Une réponse `provider_accepted` signifie uniquement acceptation par le
   fournisseur, pas livraison à la boîte ni lecture par le destinataire.
7. Aucun patient, adresse, contenu de message, secret ou réponse libre du
   fournisseur dans les journaux techniques ; isoler les données nécessaires
   à l'envoi, appliquer une durée de conservation et limiter l'accès.
8. Prévoir un arrêt d'urgence des nouveaux départs, la révocation des
   credentials fournisseur et une revue d'audit des intentions en attente.

## Protocole candidat

- Réserver et contrôler en transactions courtes avec bail et numéro de
  tentative, puis refaire le contrôle immédiatement avant la remise.
- Produire une clé HMAC versionnée stable pour chaque tentative ; la même
  tentative garde sa clé pendant toute réconciliation, y compris après rotation.
  Une tentative nouvelle a une clé distincte. Elle ne contient aucune donnée patient.
- Enregistrer l'état de remise/ambiguïté, et réconcilier toute issue
  incertaine **avant** un éventuel nouvel appel.
- En cas de révocation après acceptation fournisseur, journaliser l'incident
  sans prétendre pouvoir annuler l'e-mail. Définir la notification interne
  de sécurité et les délais de traitement.
- Avant toute activation, auditer l'ensemble des chemins d'écriture
  des comptes, cliniques, grants, catégories et commandes : un verrouillage
  partiel d'un seul chemin ne garantit pas la politique globale.

## Décisions à faire valider

- Borne acceptable entre dernière validation et acceptation externe,
  y compris cas de révocation pendant une requête en vol.
- Fournisseur, idempotence et API de recherche/réconciliation réellement
  disponibles, et durée de conservation des clés.
- Politique des erreurs temporaires prouvées non acceptées et ambiguës.
- Rôles autorisés à résoudre manuellement les ambiguïtés, preuves d'audit,
  notification de sécurité et délai d'intervention.
- Protection des adresses, contenu minimal des modèles, secrets et
  conformité des données.

**Aucun fournisseur ni worker réel n'est ajouté par cette proposition.**

## Rotation et provenance des preuves — préparation hors production

Le noyau pur expose `versionedProviderAttemptKey` et
`verifyRecordedAttemptKey` : une version bornée accompagne la clé
d'idempotence originale. Le vérificateur utilise exclusivement le secret de
cette version ; son absence ou une discordance échoue sans dériver une nouvelle
clé avec le secret courant. La version, la clé et le numéro de tentative doivent
être conservés ensemble dans un stockage transactionnel privé avant tout appel.
La migration, le chiffrement, la politique de rétention et l'adaptateur réel
restent à concevoir/valider. Ce helper ne persiste rien et ne signe pas une
réponse du fournisseur.

Un simple objet `verified_acceptance` dans le noyau est forgeable par un
appelant : aucune authentification n'en découle. Le noyau refuse désormais
de le classer `accepted` sans callback de vérification injecté ; ce callback
n'authentifie rien par lui-même et doit provenir d'un adaptateur fournisseur
audité, lié à la bonne tentative. Une future intégration devra
vérifier l'origine par un canal authentifié lié au fournisseur choisi, la
correspondance exacte du compte, de la clé et de la tentative, l'identifiant
fournisseur et le statut confirmé, puis conserver la preuve brute sensible
hors journaux généraux avec accès et durée approuvés. Une assertion obtenue
par un fournisseur fictif est seulement un test du protocole local. Si la
provenance, la version du secret ou la consistance du résultat ne peuvent
être vérifiées, garder la livraison en revue manuelle, sans renvoi. Une
acceptation tardive après révocation demeure possible.
