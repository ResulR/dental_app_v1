# ARCHITECTURE ADAPTÉE — Laboratoire dentaire

**Statut :** complément contextualisé au fichier fourni `Prompt_Architecture_Web(1).md`, **pas une stack décidée**. Le fichier fourni est un *prompt générique de qualité/structure du code*, et non un document d'architecture technique complet ; éviter de le présenter comme un choix React/Express/etc. déjà validé.

## Principes conservés sans modification de fond

Monolithe modulaire ; découpage par modules métier ; routes et contrôleurs minces ; services métier distincts des repositories ; validation à toutes les frontières ; contrats frontend/backend partagés lorsque utile ; migrations versionnées ; tests et sécurité ; journalisation sans secrets ; Git et déploiement reproductible. La structure `apps/web`, `apps/api`, `packages/contracts` est **indicative**, adaptée à la stack réellement choisie.

## Décisions déjà confirmées pour ce projet

- **Produit :** application métier privée, deux portails lab/clinique, PWA tablette/mobile, interface exclusivement albanaise, Europe/Pristina. Ni e-commerce, ni Stripe, ni panier, ni SEO public à transposer de Flo's Bikes.
- **Données :** PostgreSQL 17 sur VPS existant ; base créée `dental_lab`, owner `dental_lab_owner` NOLOGIN ; compte Linux `dental-ai` et répertoire privé `/srv/dental-lab`. Le rôle SQL `dental-ai` dispose actuellement d'un accès d'audit : vérifier tous les privilèges avant changements.
- **Confidentialité :** données patients et scans de santé, cloisonnement strict par clinique ; permissions fines fichiers/messages/logistique ; aucun lien public ; pas de données patients dans les logs, notifications e-mail ou jeux de test partagés.
- **Migrations :** rôle `dental_lab_migrator` NOLOGIN avec CONNECT/USAGE/CREATE sur dental_lab/public ; **ne pas** accorder à l'agent un chemin détourné vers PostgreSQL superuser. Le rôle applicatif `dental_lab_app` est NOLOGIN à ce stade ; son accès réel n'est pas encore configuré.
- **Fichiers :** STL/PLY/OBJ/JPG/PNG/HEIC/PDF, 200 Mo par fichier, 1 Go par soumission initiale, 1 Go par message, uploads reprenables et ZIP à la demande. Originaux et fichiers de suivi séparés et privés ; hashes et périmètre d'accès validés côté serveur.
- **Offline :** seuls brouillons et fichiers du brouillon peuvent rester sur appareil ; chiffrement + déverrouillage approprié à tester sur navigateurs réels ; synchronisation versionnée, conflits explicites, soumission jamais automatique.
- **Temps réel :** une conversation générale par clinique, une par commande/retouche, état Lu, clôture à livraison, rappels e-mails spécifiques ; la messagerie ne remplace pas les décisions métier formelles.
- **Continuité :** objectifs RPO 1h, RTO 4h, sauvegardes 30 jours et preuve de restauration. Ne jamais transformer un objectif en garantie sans test.
- **Périmètre sécurité :** l’IA ne reçoit jamais un sudo général ; tout privilège ciblé doit être audité et démontré sûr ; un script privilégié ne doit pas exécuter un fichier modifiable par dental-ai.

## Modules métier candidats (noms non contractuels)

`identity`, `clinics`, `permissions`, `catalog`, `orders`, `order-requests`, `linked-works`, `retouches`, `delivery`, `files`, `drafts`, `chat`, `notifications`, `audit`, `settings`, `compliance`, `operations`. Un module peut être fusionné avec un voisin si les frontières réelles le justifient : n'ajouter aucun répertoire vide.

## Décisions architecturales à prendre au chapitre 1 de ROADMAP.md

1. Stack frontend/full-stack, API/backend, versions compatibles, choix du monorepo et de la validation.
2. Transport temps réel et résilience des messages ; synchronisation PWA offline et stratégie cryptographique réellement supportée.
3. Stockage gros fichiers et fragments, assemblage, chiffrement, analyse de fichiers et réserves disque ; contraintes navigateur et hébergement.
4. Exécution isolée des migrations, runtime production, autorisations systemd/Nginx, réseau local et Remote avec test de non-régression.
5. Hébergement des emails/backs-ups, authentification, gestion de secrets, stratégie d'audit et de rétention.
6. Faisabilité des objectifs RPO/RTO et obligations Kosovo avec responsables compétents.

**Règle de compatibilité :** le cahier des charges décide *quoi* ; le présent supplément et le prompt original définissent des principes de *comment* ; la roadmap ordonne *quand, comment vérifier et quand bloquer*. Une architecture technique réellement validée sera ensuite documentée dans `docs/architecture.md` avec ADRs.
