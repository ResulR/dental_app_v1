# Transitions complémentaires — préparation applicative

## Intégration sans activation

POST `/api/v1/orders/lifecycle` : complete (fabrication → terminée), deliver (terminée → livrée, mode et confirmation), correct_delivery (livrée → terminée, motif), request_correction (en attente → correction demandée, motif), cancel (clinique propre en attente/correction avec confirmation ; laboratoire jusqu’à fabrication incluse avec motif).

Permissions actuelles serveur, verrou compte/session/grants/clinique, puis catalogue ordonné avant commande pour les progressions. Contrôle version et révision, vérification du statut source, référence interdite/blocage sécurité/fichiers non intégrés/demande pendante refusés à la progression. Les indisponibilités déjà acceptées ne sont pas réactivées. Les versions et snapshots ne sont jamais réécrits. Une répétition avec ancienne révision donne conflit sans réécriture : pas de retry automatique ni de reçu d'idempotence reconstituant un succès perdu. Après résultat incertain, relecture obligatoire.

Livraison : horodatage serveur, mode/auteur, échéance archivage à30jours, historique logistique avant/après, fermeture conversation ; retour : annulation de ces champs, historique conservé et réouverture. Aucun worker d'archivage ni e-mail de livraison ajouté. Tout retouch lié bloque la correction, même clôturé. La collision SQL précise d'une retouche redevenue active avec une autre active est traduite après rollback ; jamais d'index contourné. L'ordre reste verrouillé ; les futurs créateurs de liens doivent aussi verrouiller/revalider la source.

Annulation : clôture technique des demandes pendantes avec cause order_cancelled et audit, conformément H35-01 ; aucune fausse acceptation. La clinique n'a pas à inventer un motif : sa confirmation est enregistrée comme CLINIC_CANCELLATION_CONFIRMED si aucun texte fourni, sans présenter ce code comme un commentaire humain.

POST `/api/v1/orders/lifecycle-context` fournit numéro/statut/version/révision sans patient ni instruction. Permet aux profils logistiques d'agir sans permission détaillée. Interface albanaise dans le suivi, droits d'affichage recontrôlés serveur, motif/confirmation/mode selon action, données invalidées après tentative. Le contexte affiché ne remplace jamais le verrou et le contrôle de révision.

Flag DENTAL_LAB_ORDER_LIFECYCLE_ENABLED désactivé par défaut, dépend de ORDER_DECISION et de ses propres dépendances. Vérification des droits supplémentaires avant composition runtime, sans DDL. Aucun environnement activé ni migration appliquée.

## Preuves et limites

Onze tests ciblés réussis avec doubles transactionnels, client et HTTP local : permissions/prérequis, transitions, isolation clinique, révisions, répétition/concurrence simulée, rollback sur chaque écriture critique, blocages et refus HTTP. Compilation contrats/API réussie à256Mio pour tsc seulement. Ce n'est PAS une validation PostgreSQL réelle, ni une preuve navigateur.

Les modifications d'instructions/propositions, le renvoi clinique de correction, décisions/retraits de demandes et création des retouches restent distincts et non implémentés par ces cinq actions. Réception SQL requise pour privilèges, verrous, FK cascade, unicité réelle et atomicité. Réception navigateur requise pour confirmations, clavier/tablette et parcours de permissions. Les fichiers restent bloqués tant que le pipeline réel n'est pas intégré. Aucun e-mail envoyé, preuve historique modifiée ou service redémarré.


Le suivi laboratoire propose deux vues de travail : commandes Acceptées pour
les titulaires de `orders.start_manufacturing`, commandes En fabrication pour
les titulaires de `orders.change_status`. Elles utilisent la recherche privée
existante avec filtre serveur, pagination et relecture explicite ; elles ne
modifient aucune commande. Le démarrage et la finalisation conservent les
contrôles de version, statut, permissions et transaction de leurs API.
