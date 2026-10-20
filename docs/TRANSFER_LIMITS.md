# Limites des fichiers — préparation 12.3 / 12.4

Le module files/transfer-limits applique H37-01 : 200 000 000 octets par fichier, 1 000 000 000 octets par dépôt initial ou message. Chaque message a sa propre limite ; pas de quota cumulatif de conversation. Aucun plafond agrégé supplémentaire inventé pour révision, suivi ou retouche.

assertAttachmentLimits attend des tailles issues des métadonnées serveur vérifiées et des identifiants distincts. À brancher dans la transaction qui autorise et crée les associations, après verrouillage/relecture de leur état. Une déclaration navigateur n'est pas une preuve de taille ni d'autorisation.

boundedUploadBytes compte les octets réels progressivement, refuse les fragments vides/non binaires, les dépassements et les flux tronqués ; il propage annulation et panne amont. Il n'assemble pas le fichier en mémoire. Sa destination doit être la quarantaine privée uniquement : des octets déjà transmis avant une erreur ne doivent jamais être publiés. La consommation complète est obligatoire avant validation ; abandonner l'itérateur ne vaut pas réussite. Le lecteur amont doit lui-même respecter le signal et une deadline validée pour ne pas attendre indéfiniment une source bloquée.

Ces fonctions ne prouvent ni stockage, ni analyse antimalware, ni hash, ni capacité disponible. Aucun branchement runtime, upload HTTP, écriture de fichier patient ou changement des refus files_not_ready existants.

Blocages réels pour les transferts : racine privée et droits du runtime, capacité dédiée et marge de quarantaine/assemblage, expiration des fragments, outils de validation/analyse et limites CPU/mémoire/temps. Le modèle docs/models/files-lifecycle.md exige leur validation avant transfert. Aucun choix de fournisseur, secret, installation système ou quota implicite effectué.

Tests sans gros fichiers : limites exactes/+1, valeurs invalides, doublons, indépendance entre messages, absence de plafond métier supplémentaire, comptage réel en petits flux, panne/annulation et fermeture de l'itérateur. Ce sont des tests unitaires, pas une réception de stockage ou de PostgreSQL.
