# 4.7 — Changements et décisions
Sources CDC§5 et ../models/order-state-machine.md. Conception indépendante du tactile FDI ; édition du champ dents dépendra4.4.

| État / acteur | Parcours | Confirmation et résultat |
|---|---|---|
| En attente / clinique | Modifier directement | Revoir nouvelle version ; reste En attente, historique conservé |
| Correction demandée / clinique | Corriger puis renvoyer | Enregistrer reste Correction demandée ; action distincte Renvoyer = En attente et nouvelle décision manuelle |
| Acceptée / clinique | Demander modification | Avant officiel vs proposition ; original inchangé, demande pending |
| Acceptée / clinique | Demander annulation | Demande pending, pas fausse annulation immédiate |
| Pending demande / clinique | Retirer avant décision | Confirmer retrait, historique et original préservés |
| Pending demande / labo habilité | Accepter ou refuser | Comparaison + décision tracée/email ; recontrôle révision ; acceptation modification crée version, annulation acceptée annule |
| En attente/Correction demandée / clinique | Annuler directement | Confirmation explicite numéro et conséquence ; pas de motif obligatoire ajouté |
| Acceptée avant fabrication / labo habilité | Éditer instructions | Motif obligatoire, version et email/interne ; interdit avec pending |
| Jusqu'à En fabrication incluse / labo habilité | Annuler directement | Motif obligatoire + confirmation + email ; pending éventuel closed/order_cancelled, pas accepté fictivement |
| Dès En fabrication / tous | Instructions/fichiers fabrication verrouillés | Pas de boutons Modifier/remplacer les originaux ; travaux liés4.8 |
| Terminée/Livrée | Pas annulation ordinaire | Exceptions de livraison4.10 ou remplacementR14 seulement |

## Écran avant/après
H47-01 réversible : deux blocs empilés sur mobile, intitulés « Version zyrtar » / « Propozim në pritje », chaque champ modifié annoncé Ancien→Nouveau ; valeur supprimée indiquée textuellement. Liste fichiers Ajoutés/Retirés distincte sans modifier l'original avant acceptation.
Cartouche permanent numéro/statut du travail et état de demande. « Kërkesë në pritje » n'est pas un statut de travail. Fabrication et édition directe labo désactivées avec explication tant que pending ; logistique compatible reste accessible.
Un seul pending tous types confondus. Deuxième demande mène vers la demande existante, pas deux lignes concurrentes autorisées.

## Motifs, confirmations, erreurs
Motif obligatoire : demande correction, refus commande, édition directe labo, annulation labo. Motif de refus d'une demande saisi/consigné selon service et CDC sans créer obligation partout. Message clinique de demande possible, ne pas imposer un champ métier absent.
Écran de confirmation avec numéro, action et conséquence, boutons nommés (Retirer la demande / Annuler le travail), Retour annule l'intention avant envoi. Pas simple OK. Pas changement optimiste définitif ; annonce succès après reçu serveur.
Focus au titre confirmation puis retour au déclencheur si fermeture. Si dialogue implémenté : focus contenu, Tab contenu, Escape abandonne avant soumission, restaurer focus ; recette réelle au gate4.14. Maquette emploie sections, aucune modale non testée prétendument fonctionnelle.
Course retrait/décision, acceptation/version ou création pending/fabrication : conflit relecture, conserver proposition ; aucune décision sur version ancienne. Échec réseau résultat inconnu : vérifier reçu idempotent ; ne pas créer seconde intention.
Chat : aide « Mesazhet nuk ndryshojnë udhëzimet zyrtare », lien au parcours formel selon état et permission.
Scénarios revus : correction enregistrée sans renvoi ; pending reste Acceptée ; retrait ne supprime pas traces ; annulation directe labo clôt pending ; impossible de modifier fabrication via fichiers/chat.
