# Décisions initiales et démarrage — 8.3–8.5,10.1/10.2/10.11

POST /api/v1/orders/decision prépare trois actions seulement : accept, reject, start_manufacturing. Flag ORDER_DECISION désactivé par défaut et dépend du flag de dépôt ; readiness vérifie les objets/droits sans mutation. Aucune activation PostgreSQL, aucun compte ou e-mail réel.

Permission effective courante spécifique à l’action, session/epoch et rôle laboratoire obligatoires ; le propriétaire doit être réellement titulaire. Rejet avec motif obligatoire. Acceptation/refus seulement pending, démarrage seulement accepted. Version ET révision attendues doivent correspondre après verrouillage ; aucun client ne choisit le statut résultant.

Ordre de verrous : compte, droits, session, références catalogue triées, commande. Les identités immuables des snapshots sont découvertes avant les verrous puis la version est recontrôlée sous verrou commande. Tous les futurs writers d’instructions/demandes doivent partager ce protocole (références avant commande et création/décision de demande sous verrou commande). Une interdiction ou un blocage actif interdit acceptation/fabrication ; jamais d’override propriétaire. Indisponibilité : confirmation et motif nécessaires à l’acceptation exceptionnelle, conservés dans l’événement, sans réactiver le catalogue. Le refus motivé reste possible malgré un blocage.

Démarrage : aucune demande pendante, statut accepted et version courante ; manufacturing_version_id est fixé atomiquement. Pas de mutation des instructions/snapshots. Les pièces jointes entraînent encore files_not_ready : leur cycle privé n’est pas intégré. L’état métier, l’événement historique, l’outbox et l’audit sont transactionnels ; toute erreur se propage, aucun retry automatique. Un conflit impose une relecture. Les autres transitions et les writers de modification ne sont pas inventés.

Dix tests ciblés avec doubles transactionnels et HTTP local passent : droits/prérequis, version/révision obsolètes, concurrence de deux décisions, exception commerciale, interdictions, refus motivé, demandes pendantes, gel de version, échecs d’écriture/readiness. Ces tests ne constituent pas une réception PostgreSQL réelle. L’interface de décision et la lecture de la file restent à intégrer au moment de ce lot serveur.

## File de revue intégrée

GET /api/v1/orders/review retourne au plus50commandes pending/accepted par curseur UUID, réservé aux lecteurs détaillés laboratoire. Champs patient/instructions proviennent de la version actuelle ; matériaux/teintes/types proviennent des snapshots historiques, jamais des libellés courants. Dents, date souhaitée, origine/type, nombre de fichiers et présence de blocage sont affichés. La liste n’est pas une autorisation d’action ni une promesse d’absence de blocage futur.

Interface albanaise reliée aux API : sélection de la version, motif de refus/exception, confirmation d’exception commerciale, acceptation/refus/démarrage selon permissions effectives. Toute décision envoie version ET révision affichées. Résultat incertain, conflit, refus ou succès invalident la liste ; une relecture explicite est nécessaire. Aucun retry automatique, cache patient ou stockage local. PermissionBoundary transmet seulement le snapshot courant déjà vérifié ; aucune permission n’est déduite de la seule identité de session.

La file ne remplace pas le suivi clinique9.8, l’historique consultable complet ni toutes les actions10.14. Recette navigateur différée ; aucune affirmation de validation tactile/clavier/lecteur.
