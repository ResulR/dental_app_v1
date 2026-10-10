# Navigation et accès par rôle — conception 4.2

Sources : CDC§§2/7/11/13/15, [droits](../models/permissions.md), [direction R16](visual-direction.md), [coffre](../models/drafts-sync.md). Aucun routeur React/API/session réelle déployé. Le [plan de navigation](navigation-plan.json) est un contrat de conception, pas une autorité de sécurité ni une déclaration de routes présentes.

## Deux portails et accès communs

| Contexte | Entrée et contenu | Restrictions |
|---|---|---|
| Non connecté | Connexion, inscription clinique, récupération, documents légaux et contact labo | Aucune liste clinique/travail, patient, compteur privé ou route administrateur |
| Contexte session en chargement | Shell neutre et message de chargement | Aucun menu privilégié brièvement affiché ; erreur distincte de compte suspendu |
| Clinique en attente/refusée | État de son inscription, connexion/récupération/contact/légal | Pas de soumission officielle ni aperçu d'autres cliniques ; droits supplémentaires non inventés |
| Clinique approuvée active | Ses travaux, nouvelle commande, brouillons, messages, notifications, contact/légal | Un seul compte partagé, son périmètre seulement ; sans choix arbitraire de clinic_id |
| Propriétaire actif | Portail labo complet selon invariants métier | Audit global lecture seule, pas de transfert propriétaire ni purge audit dans UI |
| Admin secondaire actif | Même portail labo, menus selon grants/prérequis actuels | Aucune administration d'autres admins ni auto-élévation ; employés uniquement selon délégation |
| Employé actif | Même portail labo, menus strictement selon grants | Aucune affectation personnelle, aucun email administratif automatique ; zéro grant = état simple sans données privées |
| Suspendu/session révoquée | Message clair de refus, récupération/contact selon procédure | Fermer flux, retirer projections/caches mémoire ; local chiffré suspension purgé au mieux à reconnexion |

Ne pas ajouter de sélecteur de rôle ou de bascule labo→clinique à un vrai compte. Une démo peut montrer des contextes fictifs, sans que ce contrôle devienne une fonctionnalité du produit.

## Navigation laboratoire

Ordre sobre : Pour traiter → Travaux → Prêts à livrer → Calendrier → Messagerie → Cliniques → Paramètres. Éléments absents si aucun droit utile. À traiter affiche seulement catégories pour lesquelles l'acteur peut réellement consulter/décider ; « lu » ne retire jamais une action pendante. Sans droit d'actions, accueil simple vers la première consultation autorisée.

| Entrée albanaise | Prérequis serveur de visibilité | Ce qui reste filtré |
|---|---|---|
| Për t’u trajtuar | Au moins une capacité pertinente de décision + prérequis | Catégories habilitées ; inscription seulement clinics.manage ; aucun compteur des autres catégories |
| Punët | orders.read_logistics | Projection logistique minimale ; détails/recherche patient/onglets sensibles selon droits |
| Gati për dorëzim | orders.read_logistics | Liste des Terminée ; bouton livrer seulement delivery.mark_delivered + état valide |
| Kalendari | orders.read_logistics | Dates/numéro/clinique ; édition seulement delivery.plan ; aucune donnée patient logistique |
| Mesazhet | messaging.general.read OU messaging.order.read effectif | Liste des conversations autorisées, compteur filtré ; réponse séparée, pièce jointe sans élévation fichiers |
| Klinikat | clinics.manage | Coordonnées/profil administrables selon autorité ; travaux/detail/chat exigent leurs droits propres |
| Parametrat | Owner OU au moins une capacité d'outil autorisée | Sous-sections séparées : catalogue, employés délégués, paramètres autorisés ; audit/incidents mails globaux/maintenance owner seulement |

Les capacités ne sont pas des rôles figés : un admin sans grant n'accède pas au catalogue parce qu'il est admin. Un droit général de conversation n'ouvre pas les conversations de travail. Visualiser ne donne pas Télécharger, ni réciproquement. Afficher au propriétaire l'exposition possible aux données patient dans des messages libres avant octroi du droit conversation.

## Navigation clinique

Actions quotidiennes : « Porosi e re », « Draftet », « Punët », « Mesazhet ». Notification et lien profil/contact/légal secondaires. Liste/page officielle = serveur en ligne ; brouillons = coffre local autorisé ou serveur selon état. Pas de menu cliniques autres ni outils labo.

Fiche travail : résumé/status/dates distinctes ; détail, fichiers autorisés, conversation propre, historique et liens vers travaux liés de la même clinique. Actions exposées seulement pour l'état courant : corriger/renvoyer/demander modification ou annulation/retirer demande/dupliquer/demander retouche. Aucune annulation directe dès fabrication, aucune soumission automatique et aucun chat transformé en instruction.

## Responsive et clavier

H42-01 réversible dans R16 : largeur≤600px = navigation clinique compacte, liens prioritaires sur deux lignes si nécessaire et menu « Më shumë » non modal pour secondaires ; labo même principes avec entrées autorisées. À partir de tablette, navigation latérale/compacte et contenu borné ; aucun lien sous une cible44px, pas de texte tronqué rendant l'action ambiguë. Ne pas imposer un tableau horizontal pour la navigation ou la liste mobile.

Structure nav/main, lien « Kalo te përmbajtja », titre unique de page, libellés textuels, aria-current sur page active. Menu non modal natif details/summary comme candidat réversible ; ouverture ne vole pas le focus, Tab parcourt naturellement, retour à déclencheur après fermeture lorsque pertinent. Écrans complexes/modales traités aux points suivants. Focus visible, ordre DOM = ordre visuel, changement de page annonce titre et place focus de façon cohérente ; badges textuels et statut accessibles sans couleur.

## Frontières et refus

Identité/droits inconnus = refus par défaut. Serveur filtre menus/contexte/projections et recontrôle chaque route/API, téléchargement, recherche et flux. Le client ne reçoit pas les données interdites pour ensuite les cacher. URLs directes/identifiants forgés = refus uniforme hors périmètre ; menu caché ne constitue jamais un contrôle d'accès.

À retrait grant/suspension/logout : invalider contexte courant, fermer événements, effacer projections mémoire de travaux/chat/aperçus, refermer écran interdit et revenir à un point autorisé. Pages retournées par historique/bfcache doivent revalider avant affichage protégé. Pas de cache automatique commandes/fichiers officiels dans service worker. Logout clinique conserve le coffre chiffré mais détruit au mieux clés actives ; autre compte ne l'ouvre pas. Hors réseau, seuls brouillons autorisés d'une session préalablement ouverte, pas de promesse d'autorité distante actualisée.

## Vérification de conception et tests futurs

Vérification actuelle : plan JSON, correspondance des capacités aux modèles existants, séparation des profils/menus owner-only, deny-by-default et projections détaillées vs logistiques ; mêmes règles responsive dans conception R16. Aucune requête privée ni donnée patient utilisée.

Tests à l'implémentation : tailles320/375/768/1024, clavier/focus/menu, lecteur d'écran, rôles et combinaisons de grants, retrait pendant navigation, URLs directes/interclinique, compte pending/suspendu, back/bfcache/logout, compteur illégitime et event filtré. La validation4.2 porte sur cette navigation conçue sans zone interdite accordée ; elle ne certifie pas un routeur/API ou affichage navigateur non encore construit.

[Exemples de menus](navigation-preview.html) : contextes statiques owner/logistique/sans grant/clinique, pas un sélecteur de rôle réel.
