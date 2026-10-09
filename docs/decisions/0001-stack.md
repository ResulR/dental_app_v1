# ADR 0001 — Stack du monolithe modulaire

Décision acceptée par le propriétaire le 09/10/2026 ; formalisée au point 3.1. Source historique exacte : section « ADR du point 1.3 — Stack validée » de ROADMAP.md. Cette ADR ne change pas cette décision.

Contexte : application privée à deux portails, PWA et brouillons hors ligne, fichiers volumineux, messagerie, permissions serveur. Aucun rendu public SEO ni fonctionnalité financière requis.

Décision : React + Vite + TypeScript 6 côté web, Express + TypeScript 6 côté API, PostgreSQL 17 exclusivement dental_lab ; monolithe modulaire. La composition vise apps/web, apps/api et packages/contracts avec npm workspaces et migrations SQL versionnées.

La proposition 1.3 comparait Fastify et Next.js ; le propriétaire a choisi React/Vite/Express. Le choix permet ces besoins mais ne fournit pas les garanties de cryptographie, isolation, streaming ou reprise par lui-même. Voir [architecture](../architecture.md) pour les limites et preuves nécessaires.

Versions : revérifier versions stables, moteurs, peers et résolution complète au moment de l'installation. Le tableau historique 1.3 est un relevé de métadonnées, pas un lockfile ni une preuve de paquets installés. Ne pas forcer TypeScript 7, ne pas changer le runtime Node global. pg/Zod et l'outillage qualité/UI proposés seront contrôlés aux fondations ; aucun ORM ou fournisseur externe choisi ici.

Conséquences : contrats communs sans code privé, API autorité métier, tests d'intégration de PostgreSQL et appareils PWA réels. Aucun privilège de migration permanent à dental-ai. Runtime indépendant de dental-site et approbations administrateur inchangées.
