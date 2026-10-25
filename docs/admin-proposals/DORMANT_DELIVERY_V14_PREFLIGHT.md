# Préflight v14 en lecture seule — 25 octobre 2026

Commit de départ f0badf7, main propre. Recette v14 non exécutée :
`.local/notifications-v14` absent. Manifeste figé de 248 fichiers, SHA-256
`84fc841e96917f54f47f7c4d7458fe468c38ca8e6e1f011915865ebfa048bcdf`.
Contrôle initial `sha256sum -c`, deux tests statiques, `bash -n` et
`node --check` réussis avant le build API. Après ce build, le contrôle
**échoue** sur un unique fichier généré :
`apps/api/dist/modules/notifications/dormant-delivery.worker.js`.
Empreinte attendue `e64a81bf8ac753c1ebbbf9df2736e432c980257819483863fcff46a75b064c3d`,
actuelle `99b2dd78553c036fcf75476e7bf25da194979a0ffc647673c2ad39ce8998f74a`.
La source versionnée de ce module est identique à f0badf7. Cause démontrée : le build v14 avait conservé l'ancien commentaire compilé « closes the interval between », alors que le commit 10f0a08 a corrigé la source en « narrows the interval after » après le build. Substituer uniquement cette phrase dans une copie en mémoire du JS actuel redonne exactement l'empreinte attendue e64a81b…064c3d. Le code exécuté est identique ; les octets vérifiés ne le sont pas. Aucun fichier du bundle n'a été
modifié. **v14 est bloquée : ne pas exécuter avec ce manifeste.** La version v15 distincte est préparée avec le build actuel, sans réécrire v14.

La fixture v14 charge un cluster neuf dans le répertoire v14, port 55444 sur
socket Unix privée, sans écoute TCP. Le runner exige UID/cgroup/limites
CPU-mémoire-tâches, marge disque et mémoire, Git propre, production joignable,
empreintes correctes et répertoire absent. Il conserve les sorties, compare
services/production/sockets avant-après et arrête sous trap EXIT/INT/TERM.
Une panne machine ou SIGKILL exige contrôle indépendant. Aucun résultat v14
n'est affirmé.

La suite JavaScript propose les cas suivants : révocation de catégorie et
grant après prévol ; suspension de clinique ; révision de commande ; bail
expiré ; attente d'un verrou sur le compte ; suppression de catégorie non
commitée puis commitée ; fournisseur fictif jamais appelé après autorisation
finale refusée. Les résultats réels de verrouillage, timing et permissions
restent inconnus jusqu'à l'unique exécution autorisée.

Risques résiduels : contention ou timeout sous charge VPS, fixture/SQL
incompatibles non détectés statiquement, résultat de test incertain après
interruption brutale. Une réussite ne prouverait ni transport externe, ni
révocation atomique après le commit d'autorisation, ni livraison exactement
une fois. En cas d'échec, arrêter, conserver le dossier de preuves et préparer
un bundle ultérieur ; ne jamais rejouer v14.

Préflight et commande proposée figurent dans
`docs/admin-proposals/DORMANT_DELIVERY_V14_RECEPTION.md`. L'exécution exige
une autorisation explicite séparée.
