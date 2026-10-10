# ADR 0003 — Coffre local et récupération privée

Décision R15 du propriétaire, 10/10/2026, appliquée au point 3.8. Statut : principe accepté ; implémentation et production non validées.

Les brouillons locaux et leurs fichiers sont chiffrés dans le navigateur et isolés par compte. Une phrase indépendante du mot de passe de connexion et un code aléatoire privé détenu par la clinique protègent séparément la même clé de coffre. Le serveur ne reçoit ni phrase, ni code, ni clé de déchiffrement. La récupération ré-enveloppe cette clé sous une nouvelle phrase sans réécrire les fichiers. Aucun secours administrateur ni synchronisation automatique du coffre.

Perdre phrase et code rend les brouillons locaux chiffrés irrécupérables ; perdre les données du navigateur rend le code insuffisant. Les brouillons déjà synchronisés au serveur sont indépendants de ce secours local. La clinique reçoit une explication en albanais et confirme la conservation privée du code.

Le [modèle de synchronisation](../models/drafts-sync.md) définit les enveloppes candidates, la bascule atomique, les conflits, la procédure et les limites. Web Crypto / IndexedDB, quotas, stockage persistant, interruptions, multi-onglets, intégrité et absence de fuite doivent être éprouvés sur les navigateurs/appareils cibles avant production. La vérification préparatoire Node ne remplace pas ces tests. Ce critère futur ne bloque pas les autres conceptions indépendantes.

Aucune migration, installation, donnée réelle ou permission nouvelle n'est autorisée par cet ADR.
