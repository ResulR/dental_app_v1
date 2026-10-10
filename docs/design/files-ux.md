# 4.11 — Fichiers et transferts
Sources CDC§§4.2,8,12 ; ../models/files-lifecycle.md (H37-01).
Indépendant FDI et sans transfert réel à cette étape.

## Ajout et liste
H411-01 réversible : bouton Shto skedarë utilisable tactile/clavier, zone dépôt desktop complément facultatif ; liste nom autorisé/taille exacte+lisible/type/statut/actions, puis total pour initial/message. Noms longs retour ligne, aucun chemin interne ou URL publique.
Formats STL/PLY/OBJ/JPG/PNG/HEIC/PDF. Afficher200MB/fichier et1GB initial/message, décimal :200000000/1000000000octets. Pas nombre maximal ni plafond supplémentaire pour retouche/modification/suivi, pas quota cumulé conversation.
Fichier choisi ≠ upload vérifié ≠ pièce attachée officiellement. Bouton retirer avant publication retire de préparation, sans effacer historique ; fichierfabricationdébutée verrouillé, aucun remplacement même via drop.
Origine fabrication, suivi, message, draft explicitement séparée. Suivi interne labo par défaut ; partager fichier individuel avec clinique après confirmation, droit dédié, révocation futurs accès seulement (copies téléchargées non récupérables). Pas partage global implicite.

| État affiché | Texte/action |
|---|---|
| À préparer / chiffrer localement | Préparation, pas Envoyé |
| En transfert | Octets reçus vérifiés / total, progress nommé et pourcentage ; pause/interruption explicite |
| Vérification | Indéterminé, contrôle intégrité/type ;100%réception n'est pas disponible |
| Prêt | Vérifié, prêt à joindre après confirmation métier ; pas commande créée |
| Réseau interrompu | Reprendre les segments acquittés tant qu'existants, même session autorisée |
| Saturation temporaire | Nouveaux transferts suspendus, consultation préservée si service viable ; fichiers locaux conservés |
| Expiré | Segments temporaires indisponibles, retransférer source locale, pas purge brouillon métier |
| Refusé taille/type/intégrité | Cause utile sans détails internes, retirer ou choisir autre fichier |
| Droit révoqué / parent inaccessible | Interrompre et retirer métadonnées non autorisées, pas forcer reprise |
| Publication incertaine | Vérifier reçu idempotent avant nouvelle soumission |

Statut role/status annoncé aux changements, progression throttled sans lire chaque fragment. Désactiver confirmation tant que pièce conservée non prête, possibilité retirer pour soumettre sans pièce si facultative. Envoi brouillon officiel toujours confirmation explicite.

## Aperçu, téléchargements et ZIP
Voir et Télécharger actions indépendantes sous leurs grants et accès parent/données ; cacher aussi noms/vignettes si non autorisé. Aucun aperçu arbitraire HTML ou original 3D exécuté dans navigateur.
JPEG/PNG/PDF/HEIC/3D : aperçu seulement si dérivé sûr supporté et autorisé ; sinon « Aperçu indisponible », téléchargement si grant. Ne pas promettre aperçuHEIC/3D universel avant tests convertisseurs.
ZIP « Tous les fichiers autorisés » inclut toutes catégories autorisées, sans nom/compteur des exclus. Construction progressive, échec explicitement affiché ; pas faux ZIP prêt ni archive publique permanente. Originaux octet-identiques, dérivés non substitués. Grant retiré recontrôlé avant/pendant accès.
Partage de suivi révoqué : vues/ZIP futurs refusent, téléchargement passé hors contrôle. Ne pas exposer noms sensibles dans notifications/logs.
Capacité dédiée, réserves/TTL/scan encore à fixer aux jalonsstockage ; aucun seuil arbitraire ni test saturant VPS.
Scénarios revus :100%encorevérification ; reprise puisexpiration ; initial+1octet refus ; interne absent côtéclinic ; fichier verrouillé nonretirable ; ZIP listeautorisée.
Maquette inerte ; aucune charge/upload/scan/ZIP/browse opérationnel testé. Recetteprogressionmobile/lecteur et tests sécurité/contenu/capacité requis aux étapes dédiées.
