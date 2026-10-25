# Livraison e-mail métier dormante — revue technique

Le repository `dormant-delivery.repository.ts` et le harnais
`dormant-delivery.worker.ts` ne sont importés ni par le runtime HTTP, ni par un
planificateur. Le fournisseur synthétique ne reçoit qu'un identifiant de
livraison et un bail ; aucune adresse, contenu, clé ou transport n'est transmis.
Ce code n'envoie aucun e-mail.

## Séquence et preuves

1. Une transaction récupère au plus un bail expiré par `FOR UPDATE SKIP LOCKED`.
   Elle inscrit une tentative `ambiguous/LEASE_EXPIRED` et clôt la livraison en
   échec. Même si le processus est mort avant l'appel fournisseur, il n'est
   pas possible d'affirmer qu'il ne l'a pas atteint. Aucun réessai automatique.
2. La réservation d'une livraison due et libre se fait par verrou de ligne,
   affectation d'un UUID de bail et incrément du numéro de tentative dans une
   transaction. Les workers concurrents ignorent une ligne déjà verrouillée.
   Un bail expire après 60 secondes ; il n'est jamais renouvelé silencieusement.
3. Une seconde transaction revalide la révision et certains statuts de la
   commande, la clinique et le compte actifs, la catégorie configurée et les
   deux permissions des administrateurs. Elle annule l'intention obsolète sans
   tentative fournisseur ; un bail perdu refuse l'opération.
4. Le harnais appelle uniquement un fournisseur fictif injecté, avec un délai
   borné (5 s par défaut, 30 s maximum). Une exception ou un timeout de ce fournisseur donne `ambiguous`. Une transaction distincte
   écrit une tentative unique puis l'état final sous comparaison du bail non
   expiré. Une erreur temporaire reporte de 30 secondes à 1 heure selon le
   nombre de tentatives ; erreur permanente et ambiguïté restent en échec.
   Une erreur SQL annule tentative et état ensemble. Le numéro de tentative
   réservé et la contrainte `UNIQUE(delivery_id,attempt_number)` empêchent un
   deuxième reçu de cette tentative.

Aucun journal applicatif n'enregistre l'adresse, le contenu, le nom du patient
ou la réponse libre d'un fournisseur. L'identifiant fictif accepté est borné
aux caractères non sensibles. Le code ne consulte pas l'adresse du destinataire.

## Limites bloquant une activation

Le contrôle des grants et de la configuration est une lecture : leur révocation
peut être validée après la transaction de prévol et avant un transport externe.
La transaction de base ne peut pas rester ouverte pendant un appel réseau avec
le client courant. Une architecture de transport réel doit encore fixer ce
point, le modèle d'adresse/template privé, l'authentification du fournisseur,
les identifiants d'idempotence reconnus par celui-ci, ses délais et la
réconciliation humaine des ambiguïtés. Les événements de sécurité, invitations
et rappels ne sont pas couverts par cette file métier. Le statut
`provider_accepted` ne signifie jamais réception/lecture.

Le rôle applicatif dispose déjà de SELECT/INSERT sur les tentatives et de
UPDATE limité sur les deliveries (migration 0010). Le code n'ajoute aucun
privilège et n'utilise pas `FOR SHARE` sur les tables de grants/configuration.
Les tests avec doubles ne démontrent ni SQL PostgreSQL réel, ni absence de
deadlock, ni privilèges effectifs sous concurrence. Une réception distincte,
avec fixture synthétique, doit vérifier :

- deux workers réservant simultanément deux lignes ou une seule ligne sans
  doublon ; bail expiré en parallèle d'une finalisation, rollback et crash ;
- révocation de grant/configuration, suspension compte/clinique, changement de
  révision et état de commande entre préparation et prévol ;
- rôle applicatif et refus d'écriture sur comptes, grants et configuration ;
- tentative unique, retard progressif, clôture ambiguë et absence de seconde
  réservation, même après réponse fournisseur incertaine ;
- contrôle des PID, sockets, limites, services et preuves avant/après, avec
  arrêt garanti dans un environnement neuf distinct de v1–v12.

Cette recette n'est ni figée ni exécutée. Aucun cluster PostgreSQL nouveau
n'est autorisé par ce document. La réception v12 (107 assertions) ne couvre
pas cette implémentation.

## Autorisation finale et course de révocation

Le harnais dormant effectue maintenant une deuxième transaction `authorize`, qui
réexécute le contrôle SQL complet du bail, de la commande, du compte, de la
clinique, des grants et de la catégorie après le prévol initial et juste avant
l'appel fictif. Une révocation validée entre ces deux transactions bloque
l'appel. La vérification ne lit toujours aucune adresse et une expiration de
bail refuse l'envoi. Les tentatives ambiguës et expirées ne sont pas relancées.

Cette autorisation est un instantané au commit. Une suspension, suppression de
grant/configuration ou révision qui commit **après** cette transaction peut
précéder l'arrivée d'un appel externe. PostgreSQL et un fournisseur indépendant
ne partagent pas de transaction atomique ; maintenir un verrou SQL pendant
l'appel réseau violerait la limite transactionnelle actuelle, accroîtrait les
blocages sur le VPS partagé et ne résoudrait pas une réponse ambiguë après
crash. Aucun transport réel ne doit être branché sur ce harnais. Une activation
future exige une décision sur la borne de révocation, la coordination de tous
les writers concernés, le délai fournisseur, une éventuelle clé d'idempotence
reconnue et la réconciliation manuelle des ambiguïtés. Le propriétaire doit
pouvoir constater qu'une révocation postérieure à l'autorisation n'annule pas
une requête déjà remise au fournisseur.

La recette v13 réussie (39 assertions) est historique et ne teste pas ce
nouvel appel `authorize` du harnais. Son manifeste figé n'est pas recalculé.
Les tests ajoutés utilisent des doubles ; une nouvelle recette PostgreSQL
isolée distincte serait nécessaire pour valider ce protocole modifié sous
concurrence, sans relancer v13.
