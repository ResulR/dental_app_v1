# Remplacement et complément créés au laboratoire — 10.12 / 10.13

Implémentation préparée depuis deb18ce, sans activation. CDC §5.4–5.5 et décision R14 priment sur la ligne abrégée « ancienne annulée » de la roadmap.

| Source | Remplacement | Complément |
|---|---|---|
| En fabrication | Nouvelle commande Acceptée, source annulée avec motif dans la même transaction | Nouvelle commande Acceptée, source inchangée |
| Terminée / Livrée | Nouvelle commande Acceptée ; source, instructions et livraison inchangées | Nouvelle commande Acceptée ; source inchangée |
| Tout autre statut | Refus | Refus |

API `POST /api/v1/orders/laboratory-linked`, formulaire albanais dans le détail du suivi laboratoire. Nouveau numéro serveur, origine laboratory, nouveau formulaire complet (patient ou référence, matériau/teinte, type facultatif, date souhaitée facultative, description et FDI). Aucun préremplissage silencieux de données/fichiers historiques. Les liens bidirectionnels utilisent la navigation existante.

Autorisations courantes relues sous verrous : compte/session actifs, `orders.create_for_clinic` et `linked_works.manage` avec leurs prérequis effectifs. L'annulation de la source en fabrication exige aussi `orders.cancel`. La clinique destinataire est déduite de la source existante, jamais reçue du navigateur. Aucune nouvelle permission ou règle de revue de clinique n'est introduite : la suspension du compte clinique n'accorde ni ne retire des droits à l'acteur laboratoire.

Ordre de verrouillage : compte acteur, grants, session, références catalogue ordonnées, source. Version et révision de source vérifiées sous FOR UPDATE. Reçu idempotent par acteur/intention/clé ; replay avant validation de l'état source désormais éventuellement annulé. Pas de retry automatique après erreur ou COMMIT incertain. Le formulaire conserve la même commande en mémoire et propose explicitement de reprendre le résultat ; ne pas fermer/recharger le formulaire en cas d'incertitude. Aucune persistance patient navigateur ajoutée.

Snapshots, version, dents, commande, logistique, événement initial, conversation et états de lecture, outbox/dispatch, audit, reçu et filiation partagent une transaction. Le remplacement en fabrication ajoute annulation versionnée, fermeture des demandes pendantes avec trace, événement/audit de source et outbox d'annulation. Les instructions et la version de fabrication originales ne sont jamais réécrites. La source terminée/livrée n'a aucune UPDATE.

Catalogue manquant/interdit : refus. Référence indisponible : confirmation **et motif d'exception**, conservé dans l'événement d'acceptation. Peu de détails : confirmation. Pièces jointes non vides : refus explicite tant que le pipeline sécurisé n'est pas disponible. Une interdiction de catalogue ne peut pas être neutralisée par le motif. Les consommateurs de notifications/e-mails restent différés ; création d'événements ne signifie pas livraison.

Activation désactivée par défaut : `DENTAL_LAB_LABORATORY_LINKED_ENABLED`, dépendances submission et request (puis lifecycle/tracking/auth transitivement). Readiness exige stockage/privilèges des dépendances et deux FK séparées validées de work_links, statut en cascade et type sans cascade. Aucun schéma, droit SQL ou service modifié. Ne pas activer avant réception PostgreSQL des transactions, droits réels et concurrence multi-acteurs, puis recette navigateur.

Validation ciblée : doubles transactionnels pour matrice R14, permissions, versions, reçus, rollback à chaque écriture et erreur COMMIT ; HTTP origine/session/corps strict ; transport sans retry. La sérialisation du double ne démontre pas les verrous PostgreSQL réels. Les essais PostgreSQL historiques ne sont pas rejoués.
