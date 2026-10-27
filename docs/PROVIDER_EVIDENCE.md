# Preuve fournisseur et réconciliation HMAC — préparation dormante

**27 octobre 2026. Code pur et schéma candidat, aucune réception PostgreSQL ni
intégration fournisseur.** Références : cahier des charges, CTQ du chapitre 14,
`docs/EMAIL_PROVIDER_CONTRACT_PROPOSAL.md`, `docs/DORMANT_EMAIL_DELIVERY.md`
et revue statique v17. Le fichier
`docs/admin-proposals/PROVIDER_EVIDENCE_PERSISTENCE_CANDIDATE.sql` n'est
pas une migration enregistrée. Ne pas le lancer sur la base existante.

## Frontières et contrat

1. La livraison et son numéro de tentative sont issus du verrouillage local.
   Avant tout appel externe, un futur dépôt doit enregistrer la version de
   secret, la clé HMAC exacte, le fournisseur et le compte fournisseur dans
   `notification_provider_attempt_records`. La clé est liée à la livraison,
   au numéro et à la version ; le secret historique reste hors base.
2. La réponse brute reste **non fiable**. Un adaptateur approuvé devra
   authentifier le canal ou la signature selon le fournisseur réel et restituer
   les valeurs prouvées ou liées à une consultation authentifiée : fournisseur,
   compte, version, clé, statut et identifiant. Une propriété JSON
   `verified_acceptance` ou un callback arbitraire n'est pas une preuve.
   `EvidenceAuthenticator` est une interface de confiance non implémentée
   pour un fournisseur réel. Son résultat est ensuite comparé aux valeurs
   enregistrées par `assessProviderEvidence`.
3. Le noyau valide séparément clé historique, fournisseur/compte, version,
   clé exacte, statut, identifiant, date, méthode, référence et empreinte de
   la réponse brute. Secret absent, vérificateur absent ou en erreur,
   falsification, changement de tentative/version/compte et doublon connu
   échouent en `manual_review`. Rejet, résultat ambigu et `not_found`
   restent aussi en revue manuelle. Aucune relance n'en découle.
4. `acceptance_candidate` est une évaluation locale, **pas une écriture
   `provider_accepted`**. Il faut encore conserver la preuve brute dans un
   stockage privé durable et enregistrer preuve, évaluation et décision sous
   verrou transactionnel, avec contrôle de l'état et du bail. Aucun code
   existant n'effectue cette transition et aucun worker n'est branché.

Le test utilise un adaptateur HMAC entièrement synthétique pour vérifier
falsification et corrélation. Il ne démontre ni signature, ni identité, ni
idempotence d'un fournisseur réel. Un appelant qui contrôle l'implémentation du
callback peut toujours mentir ; il ne doit pas exposer cette interface à un
client, une route publique ou un plugin non approuvé.

## Schéma proposé et concurrence

`notification_attempts` est créé après l'issue de l'appel ; son unicité
`(delivery_id, attempt_number)` ne conserve ni la clé ni une réponse en vol.
La table candidate de réservation ajoute l'unicité de ce couple et celle de
`(provider_code, provider_account, idempotency_key)`. La table de preuves
append-only par privilèges futurs associe l'enregistrement de tentative à
l'empreinte des octets bruts et à une référence privée, uniques pour refuser
une réutilisation silencieuse. Elle distingue les champs **déclarés** du
résultat d'authentification local. Ses CHECK garantissent la forme et quelques
cohérences, jamais la provenance cryptographique : aucun rôle applicatif
n'obtient de droit par ce candidat et aucune ligne existante n'est modifiée.

Un futur dépôt devra verrouiller la livraison, comparer son numéro de
tentative et son bail, contrôler qu'aucune résolution ne l'a déjà clôturée,
vérifier l'existence durable de l'objet privé, puis insérer la preuve et
effectuer la transition autorisée dans une transaction. Les conflits
d'unicité sont des demandes de revue, sans renvoi automatique. Le stockage
privé et PostgreSQL ne forment pas une transaction atomique : conserver
d'abord l'objet de façon durable peut laisser un objet orphelin après rollback ;
prévoir un inventaire et un nettoyage contrôlé, jamais conclure à une
acceptation depuis la seule présence d'un objet. Le checksum ne remplace ni
chiffrement ni authentification. Référence, ciphertext éventuel, accès,
sauvegarde, rétention, effacement et audit doivent être validés avant usage.

Une acceptation déjà constatée ne doit pas être écrasée par `not_found` ou
une réponse contradictoire. Des preuves contradictoires appellent une revue
humaine. La migration candidate n'implémente pas cette politique ; une
réception SQL isolée, permissions négatives, courses et crashs est nécessaire
avant tout branchement. Une révocation committée après l'autorisation finale
peut précéder la transmission au fournisseur, sans atomicité externe.

## Décisions ouvertes

- Fournisseur, compte et mécanisme authentifié exacts ; disponibilité des
  recherches par clé et garanties d'idempotence/rétention du fournisseur.
- Qui arbitre les ambiguïtés et contradictions, avec quels délais et preuves.
- Conservation des anciens secrets, révocation des versions compromises,
  séparation des rôles, durée de rétention et protection des preuves brutes.
- Politique temporelle d'une révocation durant une requête fournisseur en vol.
- Validation des migrations 0022/0023 en attente et du nouveau candidat dans
  le chemin administratif existant, sans altérer les reçus historiques.

Statuts : contrat et tests **hors PostgreSQL** ; schéma **candidat non exécuté** ;
v17 **auditée statiquement, non exécutée** ; transport et résolution persistée
**bloqués** jusqu'aux décisions et réceptions dédiées.
