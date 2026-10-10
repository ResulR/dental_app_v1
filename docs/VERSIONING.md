# Garde-fous — 5.2
Aucun secret, upload, stockage, backup ou cache npm dans Git ; migrations versionnées et propositions administrateur conservées.
Le .env.example PostgreSQL déjà versionné est conservé sans identifiants secrets ; .env et variantes privées ignorées.
Contrôle : python3 scripts/check-versioning.py ; ajouter --staged pour l'index avant commit.
Hook local : git config core.hooksPath scripts/git-hooks ; à refaire dans un clone, contrôle explicite aussi en CI.
Le contrôle lit les blobs de l'index seulement, refuse chemins sensibles, signatures de credentials connues et scripts package privilégiés/globaux. Aucune lecture de .env ignoré, aucun lancement de migration/service.
Filtre non exhaustif : revue du diff requise. Les ZIP synthétiques de recette peuvent être versionnés, jamais fichiers médicaux.
