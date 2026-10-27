# Dépôt clinique intégré — 9.7

POST /api/v1/orders utilise un contrat strict, une session courante et une clinique approuvée non suspendue. Le serveur attribue identité, numéro et heure ; aucun numéro, clinic_id, snapshot ou date planifiée client accepté. Flag DENTAL_LAB_ORDER_SUBMISSION_ENABLED désactivé par défaut, exige AUTH/CATALOG/ORDER_PREFLIGHT et vérifie les privilèges de stockage au démarrage sans les modifier.

Une transaction vérifiée prend le verrou du compte, des droits/session/clinique puis les références catalogue ordonnées. Elle écrit snapshots immuables, commande pending, version, dents, logistique, événement de statut, conversation et états de lecture, outbox et dispatch pending, audit sans patient et reçu. Le résultat HTTP n’est rendu qu’après COMMIT du wrapper existant. Numéro bigint transporté comme chaîne, sans perte de précision ; les trous de séquence après rollback sont normaux. Aucun envoi e-mail.

La clé UUID est liée au compte/intent et au SHA-256 canonique du contenu validé (dents triées). Le verrou compte sérialise les premières insertions ; un reçu identique se relit sans nouvelle écriture ni revalidation du catalogue, après revalidation de l’autorité actuelle. Un contenu différent avec la même clé refuse. Aucun retry automatique du COMMIT. Le formulaire conserve en mémoire clé et contenu tant que la réponse est incertaine, gèle les éditions et propose une vérification explicite du même envoi. Aucun stockage local en clair ; récupération après fermeture du navigateur et suivi clinique restent à développer.

Interdit bloque ; indisponible avertit et demande confirmation explicite ; dents/description restent facultatives. Une entrée supprimée sans libellé serveur refuse : la reprise d’une référence historique devra utiliser un snapshot autorisé, jamais un libellé fourni librement. Les pièces jointes non vides refusent tant que le pipeline privé n’existe pas. Aucun fichier abandonné silencieusement. Détection de similarité9.6, liste/suivi9.8, fichiers et workflows suivants restent ouverts.

Tests ciblés : dépôt complet et snapshots, replay/conflit, appels concurrents dans double transactionnel, injection d’échec à chaque table et COMMIT incertain, permissions/validation/fichiers/interdiction, avertissements, client/readiness et HTTP local. Ils ne prouvent pas les verrous, contraintes différées ou rollback PostgreSQL réels : réception séparée requise avant activation. Aucun script historique ni migration existante modifié.


Complément du 28 octobre : un test simule un COMMIT réussi dont la réponse est
perdue ; la reprise explicite avec la même clé relit le reçu et ne crée pas
de seconde commande dans le double transactionnel. Cela ne démontre pas
encore les verrous, contraintes et rollback sur PostgreSQL réel. Le point 9.7
reste en cours et demande une recette isolée dédiée avant réception.

Le reçu visible dans le formulaire contient maintenant un lien vers le suivi
clinique prérempli avec son numéro serveur. La recherche est volontaire et
reste sous la portée de la session clinique courante ; le parcours navigateur
complet reste à recevoir.
