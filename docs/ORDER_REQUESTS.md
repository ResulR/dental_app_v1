# Demandes d'annulation et retrait — 10.6/10.8

Intégration applicative désactivée par défaut : DENTAL_LAB_ORDER_REQUEST_ENABLED dépend explicitement de ORDER_LIFECYCLE et de ses prérequis. Routes POST privées `/api/v1/orders/cancellation-request` et `/api/v1/orders/request-context`. Aucun DDL ni migration appliquée.

Clinique approuvée et non suspendue : demande d'annulation sur sa commande acceptée, avec confirmation ; état officiel inchangé, un seul pending commun aux modifications/annulations. Retrait avant décision avec confirmation, contrôles version/révision commande et demande. Le retrait supporte une demande de modification existante, mais cet endpoint ne crée pas de proposition de modification.

Laboratoire : décision d'annulation réservée à la permission existante orders.cancel et ses prérequis. Accepter exige confirmation/motif comme l'annulation laboratoire ; refuser exige le motif prévu par la contrainte SQL des demandes. Aucune nouvelle permission n'est inventée. L'acceptation modifie demande et statut dans la même transaction ; le refus conserve accepted. Une demande de modification ne peut jamais être traitée comme annulation.

Chaque écriture verrouille les droits actuels puis la commande puis la demande ; incrémente la révision commande. Le moteur de fabrication existant relit la demande pending sous le même verrou commande. Versions/snapshots ne changent pas. Index pending conservé et violation précise traduite après rollback, aucun retry. Répétition avec ancienne révision = conflit sans double écriture ; pas de restitution idempotente d'un résultat perdu. Relecture nécessaire après ambiguïté.

Outbox unique request_decided pour une décision : évite de produire à la fois une décision et un second événement d'annulation destinés au même e-mail. Aucun worker ou message réel. Demande conserve auteur/date/décision/motif ; audit lié à la révision et événement transactionnel. La lecture du contexte ne fournit que numéro, état, révisions et type pending, jamais les instructions/propositions ou données patient.

UI albanaise : charger contexte, demander, retirer, accepter/refuser et afficher résultat ; garde contre doubles clics, timeout8s, purge après tentative, aucune répétition automatique. Réception navigateur encore nécessaire.

Tests unitaires/doubles transactionnels et HTTP local ne prouvent pas les verrous, contraintes ou privilèges PostgreSQL réels. Restent : édition versionnée et renvoi de correction, création/comparaison/approbation des propositions de modification, historique détaillé des demandes, retouches et réceptions SQL/navigateur. Les deux scripts historiques v2/v3 et leurs preuves restent intacts.
