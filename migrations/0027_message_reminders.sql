-- Prepared only: do not apply to production without a separate authorization.
-- The existing outbox and configured administrator recipients carry reminder intents.
ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_events_type_check;
ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_events_type_check
  CHECK(type IN ('order_submitted','clinic_registered','order_accepted','correction_requested','order_rejected','order_completed','modification_requested','cancellation_requested','retouch_requested','correction_resubmitted','request_decided','request_withdrawn','order_cancelled','instructions_changed','laboratory_order_created','manufacturing_started','order_delivered','delivery_corrected','logistics_changed','message_created','message_edited','message_hidden','conversation_read','file_shared','file_revoked','account_changed','permissions_changed','catalog_changed','settings_changed','maintenance_changed','security_alert','technical_alert','draft_changed','order_due_soon','order_overdue','message_reminder'));
ALTER TABLE public.email_category_recipients DROP CONSTRAINT email_category_recipients_category_check;
ALTER TABLE public.email_category_recipients ADD CONSTRAINT email_category_recipients_category_check
  CHECK(category IN ('order_submitted','clinic_registered','modification_requested','cancellation_requested','retouch_requested','correction_resubmitted','message_reminder'));
