# Lecture du catalogue courant — 8.1

Implémentation API/runtime/interface albanaise préparée ; aucune activation ni réception PostgreSQL. GET /api/v1/catalog/:kind, kinds material/shade/work_type séparés, pages50+1 par UUID et curseur after strict. Contrat id/kind/label/revision ; aucune sélection croisée matériau-teinte imposée. La route ne modifie aucun catalogue ni snapshot et ne valide aucune commande.

Conformément8.1 et CDC§3 : seuls les entries présents, actifs et use_state available sont proposés. Références retirées/inactives/interdites/indisponibles absentes de cette liste ; valeurs historiques et brouillons non effacés. Les parcours8.3–8.5 devront relire références/états pour conserver l'exception indisponible et refuser une interdiction ; ne pas déduire qu'un ancien choix absent est supprimé ni utiliser la liste comme preuve d'autorisation de soumission.

AccèsH81-01 : propriétaire courant, clinique active non suspendue/verrouillée/reset, ou laboratoire avec droit effectif catalog.manage ou orders.create_for_clinic (dépendances complètes). La lecture clinique ne change pas son approbation et n'autorise aucune commande ; un laboratoire sans droit pertinent ne reçoit pas les données. La décision est revalidée à chaque page après verrous compte/grants/session et contrôle session/epoch/limites existant. Le contrôle UI reflète ce périmètre mais ne remplace pas le serveur.

Runtime DENTAL_LAB_CATALOG_ENABLED désactivé par défaut, auth requise, readiness SELECT des deux tables et privilège nécessaire au verrou SHARE sur grants ; aucun grant automatique. Tables0003 et droits existants réutilisés, aucune migration nouvelle. Si l'installation manque d'un prérequis, refus de démarrage explicite, pas de connexion d'audit ni repli. Contention de lecture sous verrous bornée par les timeouts transactionnels existants. RéceptionSQL6.4 reste différée.

Interface en lecture seule, trois catégories, pages bornées, annulation8s, démontage et réponses tardives ignorées, erreurs sans ancienne liste de secours, aucun stockage navigateur/patient. Cache hors ligne et soumission officielle ne sont pas implémentés par ce lot. Le futur brouillon9/R15 doit utiliser son stockage chiffré propre.

Tests ciblés avec SQL doublé et HTTP local : matrice d'accès, état/epoch/revocation via adaptateur courant, dépendances, filtrage SQL, pagination/cursors et transport. Ils ne constituent pas une réception PostgreSQL/navigateur. Suite : administration du catalogue8.2 avec historique/audit et préservation des snapshots.
