# Logo laboratoire — préparation du pipeline privé (8.6)

## État réel

Le module files fournit une orchestration testée, sans adaptateur de stockage, de scan, de décodage ou de publication. Aucune route HTTP, activation runtime, interface de téléversement ou exposition publique n’est ajoutée. Le logo n’est donc pas une fonctionnalité terminée. Les coordonnées textuelles existantes restent indépendantes.

## Garanties du noyau

Autorisation serveur avant consommation du flux et réservation atomique de capacité par un port obligatoire ; identifiant UUID serveur opaque. Politique obligatoire sans valeurs par défaut : taille source, taille normalisée, pixels et nombre de fragments. Un seul traitement simultané par instance ; cette limite ne remplace pas une admission globale. Empreinte SHA-256, quarantaine préalable, inspection obligatoire, contrôle de cohérence de la sortie PNG et de sa provenance. Nouvelle autorisation avant publication ; révision attendue transmise à la transaction de publication.

Aucun échec ne déclenche une publication de secours. Un résultat incertain de publication conserve les éléments de diagnostic sans retry automatique ni suppression d’un objet potentiellement engagé. Un échec de conservation est lui-même remonté. Aucun nom client, chemin de stockage ou URL externe n’est accepté par ce noyau.

## Adaptateurs et décisions encore nécessaires

- Capacité et stockage privé hors répertoire public/Git : réservation persistante atomique, baux, admission globale, objets immuables et récupération après panne. Valider les budgets conformément à docs/models/files-lifecycle.md et R07 ; aucun quota métier inventé.
- Récepteur de flux borné en durée, annulation et mémoire. Les seules bornes octets/fragments du noyau ne constituent pas une protection contre un flux qui ne termine jamais ; la réservation doit avoir une gestion de durée sûre.
- Décodeur isolé et scanner effectifs : décodage complet, réencodage, retrait des métadonnées, scan source ET dérivé, budgets CPU/mémoire/temps approuvés et provenance vérifiable. Le contrôle de signature/IHDR ne prouve ni validité complète ni innocuité du fichier.
- Publication : vérifier le bail, l’objet immuable et son hash, relire settings.manage et la révision dans la transaction SQL ; historique/audit atomiques et récupération des résultats incertains. Ne pas remplacer rétroactivement les références historiques.
- Lecture privée autorisée, réponse de contenu sûre, intégration API/UI albanaise, contrat de remplacement et rétention validés ; réceptions SQL, fichiers réels et navigateur.

Aucune configuration, migration, permission système ou dépendance binaire n’a été installée. Ces adaptateurs ne doivent jamais être remplacés par un succès fictif dans le runtime.

## Vérification effectuée

Six tests unitaires ciblés avec ports doublés : refus avant lecture, capacité insuffisante, chaîne et empreintes, bornes, sortie incohérente/scan en erreur, révocation, publication incertaine, échec de conservation et concurrence locale. Le PNG synthétique des tests est un en-tête de fixture, pas une image réellement décodée ; ces tests ne valident aucun scanner. Build API, lint et frontières (146 sources) réussis. Aucun PostgreSQL ni environnement v1/v2/v3 exécuté.

Commande de test de développement bornée : `python3 scripts/run-quality.py test:logo-pipeline`, après build API si le code source a changé. Aucun droit administrateur requis. Cette commande ne remplace pas les réceptions différées et n’est pas une procédure d’activation.
