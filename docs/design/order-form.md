# 4.5 — Formulaire de commande
Conception indépendante du rendu FDI ; recette réelle du composant 4.4 reste obligatoire.
Sources : CDC§§3,4,5.4,11,12 ; contrats Patient et ClinicSubmission dans ../contracts/common.schema.json ; R16.

## Écran clinique, une colonne (max720px)
1. Patient : prénom ET nom, OU référence interne. Deux modes peuvent être remplis ; aide visible permanente. Aucune obligation de prénom/nom si référence, ni obligation de référence si noms. Pas de dossier patient transversal.
2. Livraison souhaitée obligatoire. Libellé « Data e dëshiruar e dorëzimit » ; date locale DD/MM/YYYY, Europe/Pristina. Aucun champ planifié modifiable par clinique ni promesse de délai.
3. Un matériau et une teinte obligatoires pour toute commande, pas par dent. Type facultatif. Matériau/teinte du catalogue conservent noms techniques.
4. Dents facultatives : lien au prototype FDI avec résumé texte. Description facultative même sans dents. Pas de bridge automatique. Réception finale dépend de4.4.
5. Fichiers facultatifs, formats exacts STL/PLY/OBJ/JPG/PNG/HEIC/PDF, 200Mo/fichier et1Go initial (convention décimale3.7), pas de nombre maximal ajouté.
6. Enregistrer brouillon ou revoir puis confirmer explicitement l'envoi. Pas de numéro officiel avant reçu serveur.

## Validation et états
| Condition | Retour |
|---|---|
| Identité absente/incomplète sans référence | Erreur ciblée et résumé de champs ; focus au résumé puis liens aux champs |
| Date/matériau/teinte absent | Erreur bloquante ciblée |
| Aucune dent ni description | Avertissement non bloquant dans récapitulatif ; « Dërgo gjithsesi » après confirmation |
| Catalogue indisponible | Avertissement ; soumission autorisée, laboratoire décide exception motivée |
| Catalogue interdit | Bloquer envoi, expliquer élément à remplacer ; conserver brouillon |
| Commande similaire même clinique | Montrer lien autorisé vers existante ou poursuivre ; jamais comparer autres cliniques |
| Fichier refusé/pas prêt | Erreur du fichier, conserver champs/éléments valides ; retirer ou reprendre avant confirmation |
| Offline/coffre verrouillé | Brouillon local seulement ; déverrouiller via4.12, envoi désactivé |
| Double clic/réseau interrompu | Même intention idempotente ; résultat inconnu expliqué, vérifier reçu avant nouvel envoi |
| Succès serveur | Numéro et réception serveur ; aucune confirmation mensongère avant transaction |
| Révision/conflit | Recharger informations et conserver préparation, ne pas écraser silencieusement |

H45-01 réversible : sections courtes, une colonne à toute largeur, actions en fin ; pas de barre fixe cachant clavier/champs. Écran récapitulatif séparé des erreurs ; retour Modifier conserve préparation. Contrôles≥44px et champs48px, labels au-dessus. Lecture DOM identique visuelle, textes multiligne.
Numéro/date de réception/statut/clinic_id ne sont pas des entrées utilisateur.
Création laboratoire : choix clinique existante autorisée, patient/matériau/teinte mêmes règles ; date souhaitée obligatoire seulement pour clinique, date planifiée distincte ; création acceptée immédiatement et notification, aucune fausse validation clinique.
Maquette statique ne simule pas un envoi ni des quotas réels. Recette téléphone, clavier/erreurs, FDI et linguistique à4.14 et implémentation.
