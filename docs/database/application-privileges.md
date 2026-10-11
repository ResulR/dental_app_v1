# Privilèges futurs — proposition6.11 NON APPLIQUÉE

Audit IA lectureseule : 14objetsactuels sansACLapp/audit explicite, defaultACLmigrateurvide, appCREATEschéma/TEMPfalse, auditpas membre migrateur, runtime2connexions/nonadmin. R19/2.6 conservés. SQL0010 GRANT seulement dental_lab_app sur objets explicites ; aucunGRANTdental-ai/PUBLIC, rôle, HBA, propriétaire ou defaultprivilege automatique.

La table décrit un plan, pas des privilèges déjà installés. App est identité du serveur de confiance ; aucune clinique n'obtient connexionSQL. SELECTapp sur audit nécessaire à APIowner future : refus employé/admin/clinique doit être vérifié serveur ettestsIDOR. Pas de RLS/confinementcomplet prétendu. IA ne gagne aucunaccès.

| Table | INSERT | UPDATE | DELETE |
|---|---|---|---|
| accounts | id,profile,email_original,email_key,lifecycle | email_original,email_key,lifecycle,security_locked,credential_reset_required,auth_epoch,revision | non |
| owner_slot | non | non | non |
| clinics | oui | name,dentist_first_name,dentist_last_name,phone,address,review_state,suspended,revision | non |
| credentials | oui | password_hash,changed_at | non |
| sessions | oui | revoked_at | non |
| invitations | oui | consumed_at,revoked_at | non |
| permission_definitions | non | non | non |
| account_grants | oui | non | oui |
| employee_delegation_limits | oui | non | oui |
| catalog_references | oui | use_state,forbidden_reason,revision,changed_at,changed_by | non |
| catalog_entries | oui | label,is_active | oui |
| catalog_reference_snapshots | oui | non | non |
| orders | id,clinic_id,kind,origin,created_by,status,revision,current_version_id,manufacturing_version_id | status,revision,current_version_id,manufacturing_version_id | non |
| order_versions | oui | non | non |
| order_version_teeth | oui | non | non |
| order_logistics | oui | planned_delivery_date,priority,delivery_mode,delivered_at,delivered_by,archive_due_at,revision | non |
| order_status_events | oui | non | non |
| order_logistics_events | oui | non | non |
| order_security_blocks | oui | cleared_at,cleared_by,clearance_reason | non |
| submission_receipts | oui | non | non |
| order_requests | oui | state,decided_by,decided_at,decision_reason,close_cause,revision | non |
| work_links | oui | non | non |
| file_objects | oui | media_type_verified,content_sha256,state,verified_at | non |
| upload_sessions | oui | received_bytes,state,file_id,revision | oui |
| upload_chunks | oui | non | oui |
| order_version_files | oui | non | non |
| order_followup_files | oui | shared_with_clinic,changed_by,changed_at,revision | non |
| file_derivatives | oui | state | non |
| file_events | oui | non | non |
| conversations | oui | closed_at,revision,last_message_seq | non |
| messages | oui | current_version_id,revision,hidden_at,hidden_by | non |
| message_versions | oui | non | non |
| message_version_files | oui | non | non |
| conversation_reads | oui | last_read_seq,read_by,read_at,revision | non |
| message_reminder_cycles | oui | cycle_id,last_reminded_seq,last_reminder_at,first_unread_at,revision | non |
| outbox_events | oui | non | non |
| outbox_dispatches | oui | state,attempt_count,next_attempt_at,lease_id,lease_until | non |
| internal_notifications | oui | read_at | non |
| email_category_recipients | oui | non | oui |
| notification_deliveries | oui | state,attempt_count,next_attempt_at,lease_id,lease_until,provider_id,cancellation_code | non |
| notification_attempts | oui | non | non |
| audit_events | oui | non | non |
| drafts | oui | revision,state,updated_at,deleted_at,submission_receipt_id | non |
| draft_revisions | oui | non | non |
| draft_revision_files | oui | non | non |
| draft_sync_receipts | oui | non | non |
| draft_conflicts | oui | resolution,cloned_draft_id,resolved_at | non |

SELECT sur ces47tables et3vues explicites. Historique/audit/outbox/snapshots/versions/lien/reçus INSERTseulement, aucuneUPDATEDELETE/TRUNCATE/TRIGGER/ownership. Les mutables ontUPDATE parcolonnes, identités/clinique/profil/source/réception nonréassignables. Sourcechild_statuswork_links automatiquement parRIcascade, jamaisgrantUPDATEdirect. Bootstrapowner_slot etpermissiondefs lectureseulement. DELETE réservéconfigcourante/temporaires, service vérifieattachement/rétention/capacité. AucuneACLdefaultpourfuturetable : décision/revueàchaqueextension (H611-01), cohérente moindreprivilège.

NuméroIDENTITY : INSERTordreexclutnumber/received_at. Aucungrantdirectséquence n'est proposé ; recette réelle doit démontrer INSERT généré. Si refus effectif, arrêter seulement réception et préparerpermissionminimalerevue, ne pasgrantALLséquences. IDENTITYpeutavoirtrousaprèsROLLBACK.

17refusSQLpréparés sousSETLOCALROLEapp/audit avecpositifsSI,cascadeetCTECASrepoexact. Session_userpostgres conservée : ces tests ne prouventpas isolation LOGIN/SETROLE ; identitépeerclientprotégéR19 à recontrôler, sansrerunfixturesniaccèsautrebases. 4testsstatiqueprivilèges contreDDL/defaults/grantsdangereux ; aucunSQL exécutéIA. RôlemigrateurNOLOGIN/session0/locks0/reçus etsnapshots requis.

Retour arrière : aucunREVOKE global/cascade etaucunDROP ; application nonpubliée donc arrêtétape si testéchoue, proposition corrective migrationversionnée exacte àapprouver, conserveCONNECT/USAGER19etpreuvesregistre. Aucun rôle/changementproduction anticipé. Durées rétention/readiness/fichiers/permissionsmétier ne sont pasrésoluesparGRANT.

Sources primaires consultées12/10/2026 : https://www.postgresql.org/docs/17/sql-grant.html ; https://www.postgresql.org/docs/17/ddl-priv.html ; https://www.postgresql.org/docs/17/ddl-identity-columns.html . Les tests réels restent l'autorité pour cette installation.
