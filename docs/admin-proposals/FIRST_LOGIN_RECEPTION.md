# Première connexion — réception groupée contrôlée13/10/2026

Ce dossier prépare les interventions ; AUCUNE exécution autorisée par sa seule présence. Une version/SHA et sa recette sont approuvés individuellement, précontrôle/reçu/recette/audit avant la suivante. Aucun script de migrations en batch, aucun rejeu.

## État réellement constaté

Dépôt propre d347e98 à la reprise. Audit READ ONLY sousdental-ai dans dental_lab/PG170011 :audit_events/session_limits/login_limit_guard absents, SELECTappaccounts et UPDATEappaccounts.revision faux. Les reçus root/.pending ne sont pas lisibles par l’agent :l’opérateur doit les rapprocher.0002 reçue ;0003 historiquement appliquée, réception finale différée :UNIQUEMENT phases3–4 de POINT_6_4_ADMIN.md, jamais sa nouvelle application.

## Migrations et commandes individuelles

Les dépendances directes du login sont0002/0008/0010/0011/0013.0004–0007 et0009 restent nécessaires au0010 actuel qui accorde des ACL à leurs objets ; ne pas modifier ou raccourcir0010 pour éviter ces dépendances.0012 n’est pas une dépendance fonctionnelle du login, mais conserve son ordre du chapitre7 et sa réception distincte.

### 0004_orders_versions.sql

SHA-256 : `4f4ce930b1422394e410ba5f9c3ee0ab90ce593718cfcf350f0c6c24a736c395`. Exécution unique seulement après accord particulier et précontrôle des dossiers CHAPTER_6_RECEPTION/CHAPTER_7_RECEPTION ; réception propre de cette version indispensable avant continuation.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0004_orders_versions.sql 4f4ce930b1422394e410ba5f9c3ee0ab90ce593718cfcf350f0c6c24a736c395
```

### 0005_requests_linked_works.sql

SHA-256 : `facd59495b8c8778f0a105a7b26e9253642afe8dbe64eaa07f570de0c800b61b`. Exécution unique seulement après accord particulier et précontrôle des dossiers CHAPTER_6_RECEPTION/CHAPTER_7_RECEPTION ; réception propre de cette version indispensable avant continuation.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0005_requests_linked_works.sql facd59495b8c8778f0a105a7b26e9253642afe8dbe64eaa07f570de0c800b61b
```

### 0006_files_uploads.sql

SHA-256 : `1d0a45256b7921d6e0198991fdc1c5f38fb16446c31ed9cfe81ed433a681b65f`. Exécution unique seulement après accord particulier et précontrôle des dossiers CHAPTER_6_RECEPTION/CHAPTER_7_RECEPTION ; réception propre de cette version indispensable avant continuation.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0006_files_uploads.sql 1d0a45256b7921d6e0198991fdc1c5f38fb16446c31ed9cfe81ed433a681b65f
```

### 0007_messaging_reads.sql

SHA-256 : `a0b4001b05d963cf64171f7093b2e663bae37497ce6b41304fc96da298d38c08`. Exécution unique seulement après accord particulier et précontrôle des dossiers CHAPTER_6_RECEPTION/CHAPTER_7_RECEPTION ; réception propre de cette version indispensable avant continuation.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0007_messaging_reads.sql a0b4001b05d963cf64171f7093b2e663bae37497ce6b41304fc96da298d38c08
```

### 0008_events_notifications_audit.sql

SHA-256 : `118d11a1c0608e7e1a19c26c2b1d143d3ce8fcd2e4304f7fc9597876fc28f54c`. Exécution unique seulement après accord particulier et précontrôle des dossiers CHAPTER_6_RECEPTION/CHAPTER_7_RECEPTION ; réception propre de cette version indispensable avant continuation.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0008_events_notifications_audit.sql 118d11a1c0608e7e1a19c26c2b1d143d3ce8fcd2e4304f7fc9597876fc28f54c
```

### 0009_drafts_conflicts.sql

SHA-256 : `ddec9bd1d7b27a625d6fbab87580d97fc1ffae888225caa6103fa51508588d21`. Exécution unique seulement après accord particulier et précontrôle des dossiers CHAPTER_6_RECEPTION/CHAPTER_7_RECEPTION ; réception propre de cette version indispensable avant continuation.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0009_drafts_conflicts.sql ddec9bd1d7b27a625d6fbab87580d97fc1ffae888225caa6103fa51508588d21
```

### 0010_application_table_privileges.sql

SHA-256 : `32889ead7b3c9db974835fa2efd0394d93593e1c8d287807fb9205f661e3c64b`. Exécution unique seulement après accord particulier et précontrôle des dossiers CHAPTER_6_RECEPTION/CHAPTER_7_RECEPTION ; réception propre de cette version indispensable avant continuation.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0010_application_table_privileges.sql 32889ead7b3c9db974835fa2efd0394d93593e1c8d287807fb9205f661e3c64b
```

### 0011_session_absolute_limits.sql

SHA-256 : `5485995b2f9ad6b2cc42603ffee29d3f97fb2dd826b1384a4aa56cf1d141d7e3`. Exécution unique seulement après accord particulier et précontrôle des dossiers CHAPTER_6_RECEPTION/CHAPTER_7_RECEPTION ; réception propre de cette version indispensable avant continuation.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0011_session_absolute_limits.sql 5485995b2f9ad6b2cc42603ffee29d3f97fb2dd826b1384a4aa56cf1d141d7e3
```

### 0012_clinic_review_history.sql

SHA-256 : `b1816885cce02cf518823ff59746308976c60e102051b889b2c8582b6e791ed5`. Exécution unique seulement après accord particulier et précontrôle des dossiers CHAPTER_6_RECEPTION/CHAPTER_7_RECEPTION ; réception propre de cette version indispensable avant continuation.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0012_clinic_review_history.sql b1816885cce02cf518823ff59746308976c60e102051b889b2c8582b6e791ed5
```

### 0013_login_attempt_limits.sql

SHA-256 : `5934c8f803168fad85efb63a19bbc2d50ee487c02f254d0caf523db01c7821d3`. Exécution unique seulement après accord particulier et précontrôle des dossiers CHAPTER_6_RECEPTION/CHAPTER_7_RECEPTION ; réception propre de cette version indispensable avant continuation.

```bash
set -euo pipefail
test "$(id -u)" = 0
/usr/local/sbin/dental-lab-migrate 0013_login_attempt_limits.sql 5934c8f803168fad85efb63a19bbc2d50ee487c02f254d0caf523db01c7821d3
```

Les empreintes des recettes SQL et leurs commandes ROLLBACK restent dans les propositions existantes :CHAPTER_6_RECEPTION.md,POINT_7_2_ADMIN.md,POINT_7_4_ADMIN.md,POINT_7_1_LIMITER_ADMIN.md. Le lanceur immuable SHA698472ebcc0ca0f8a1d74151cb7331ecfa9e113d8231f9262b3ba6f535de9ea1 est conservé. Aucune migration nouvelle pour les alertes propriétaire :objets/ACL0008/0010 réutilisés.

## Droits nécessaires, sans nouvelle délégation

SELECT :accounts/credentials/clinics/owner_slot/sessions/session_limits/audit_events/login_limit_guard/login_attempt_limits/outbox_events/outbox_dispatches/internal_notifications/notification_deliveries. INSERT :sessions/session_limits/audit_events/login_attempt_limits/outbox_events/outbox_dispatches/internal_notifications/notification_deliveries. UPDATE colonnes :accounts.auth_epoch/revision,sessions.revoked_at,clinics.suspended (verrou FOR SHARE),login_limit_guard.policy_digest,login_attempt_limits.attempts. DELETE :login_attempt_limits uniquement pour expiration.

Le contrôle auth-readiness teste ces droits avant écoute, en plus de la garde d’identité/absence de privilèges administratifs du client. Aucun DDL ni droit owner_slot/profile au runtime, aucun nouveau privilège IA. Le harness temporaire exige aussi INSERT(id,profile,email_original,email_key,lifecycle)accounts et INSERTcredentials déjà prévus0010 ; leurs fixtures ne sont jamais engagées.

## Suite ordonnée et état de disponibilité

1. Recevoir migrations/ACL ci-dessus ; arrêter si.pending, opincertaine ou divergent.
2. Préparer/approuver le bootstrap suivant FIRST_OWNER_PROVISIONING.md :l’outil administratif sécurisé reste à développer. Ne pas utiliser une invitation/récupération ou une route publique pour le contourner.
3. Copier et vérifier le bundle protégé selon AUTH_RUNTIME_ADMIN.md ; exécuter le probe sousruntime994 avec API arrêtée/limiteur inutilisé. Ce probe annule employee/sessions/audit/compteurs et valide SQL/ACL/FK séquentiels, PAS commitdurable/course/two-conn.
4. Paramètres publics à approuver :domaine HTTPS, port loopback, durées sessions/borne et seuils limiteur, origine/proxy fiable. Aucun port ou domaine n’est inventé. Pas de fallback aux headers réseau client.
5. Déploiement/TLS/routage dédié selon19.3/19.4, sans toucher d’autres services ; aucune commande de mise en service complète tant que ces valeurs/implémentation système ne sont pas validées.
6. Recette HTTP réelle et navigateur HTTPS selon AUTH_HTTPS_RECIPE.md et POINT_7_1_2_INTEGRATION_ADMIN.md ; worker/fournisseur d’alertes à recevoir.

**Prêt pour revue/exécution après approbation :** fichiers migrations/recettes déjà préparés, commandes individuelles, bundle figé et probe PostgreSQL rollback sousruntime, recette HTTPS automatique opt-in.

**Reste à développer :** bootstrapadministratif privé, harness commit/concurrence/pannesHTTP sur vraiebase, livraison du worker/template d’alertes et partie déploiement contrôlée. RéceptionsSQL et navigateur NON exécutées. L’administrateur n’est pas encore le seul obstacle :ne pas demander une validation qui prétendrait combler ces manques de code.
