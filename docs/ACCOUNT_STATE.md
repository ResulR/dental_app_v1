# Suspension, réactivation et sécurisation — noyau 7.12

État : noyau préparé et tests hors ligne ; aucune session ou compte réel modifié. Le service réutilise les contrôles 7.10 et délègue la gestion admin au parcours owner-only 7.9 ; toute opération ordinaire sur le propriétaire est refusée.

La cible est exclusivement clinic/employee, identifiée côté serveur. Owner actuel ou grant clinics.manage pour clinique / employees.suspend pour employé, avec session/epoch/grant actuel obligatoire. Une commande ne contient que cible, révision et opération ; aucun flag/profil/rôle client n'est accepté. secure_clinic exige owner actuel et cible clinique, jamais un grant délégué.

Suspension : compte suspended et flag clinique suspended si applicable, révocation sessions/invitations non terminales, auth_epoch incrémenté, audit/événement atomiques. Réactivation : clinic flag false et compte active si credential existe ; pour employee sans credential, rester invited avec nouvelle invitation nécessaire (H712-01, évite activation sans mot de passe). Ne jamais ressusciter les anciens tokens/sessions. La réactivation ne supprime pas reset_required et exige encore une récupération si nécessaire ; security_locked interdit la réactivation ordinaire.

Sécurisation clinique : security_locked et credential_reset_required à true, sessions et challenges/invitations actifs révoqués via epoch/registre, données et statuts métier conservés. Pas de retrait d'approbation, suppression de travaux, effacement d'historique ou récupération serveur du coffre R15. Un compte sécurisé reste bloqué : vérification du demandeur et reset sécurisé sont un parcours distinct à préparer, aucun déverrouillage automatique par la récupération ordinaire7.7.

applyAtomic doit recontrôler tous états/permissions/cibles/révisions sous verrous et appliquer compte+clinique+epoch+révocations+audit/outbox ensemble. Les streams/jobs/downloads doivent recontrôler session/état au moment de chaque action/diffusion ; fermer les flux après commit. Le noyau n'implémente pas encore ce raccordement, et ne prouve pas une révocation API/SSE réelle. Un appareil hors ligne ne peut être purgé immédiatement ; appliquer les règles coffre lors du retour réseau.

Restent : adaptateurs SQL/middleware/SSE, UI et preuve réelle de suspension/révocation/rejeu/concurrence/rollback, migration ciblée des champs d'audit pour security_locked/reset_required/clinic suspension (liste0008 actuellement fermée), procédure de vérification d'identité/récupération clinique compromise et navigateur. Aucun nouveau rôle, service, secret ou privilège installé.

## Intégration API/UI — 15/10/2026

Liste bornée et paginée des comptes clinic/employee, détail courant, PUT avec confirmation albanaise et historique avant/après intégrés. Le service métier existant recalcule son plan dans la transaction finale : compte(s) ordonnés/verrouillés, session/epoch/limites, grants courants, relation clinique verrouillée. Les administrateurs et propriétaire ne sont jamais des cibles de ce parcours ; sécurisation clinique seulement owner actuel. Aucun flag client accepté. Origine exacte, UUID/révision, no-store, timeout et absence de retry incertain.

Écritures atomiques prévues : lifecycle/flags de sécurité sans levée implicite, révision/epoch, suspension/révision clinique si applicable, révocation sessions et invitations non terminales, historique0017, audit et outbox. Approbation, données/attributions, credentials et grants restent préservés. Pour secure_clinic, l'action audit nomme la sécurisation ; changed_fields reste vide car0008 ne permet pas ces champs, détails vrais dans l'historique dédié. Aucun faux changement lifecycle déclaré. Réactivation employé sans credential resteinvited ; UI signale invitation nécessaire sans aucun envoi.

Flag DENTAL_LAB_ACCOUNT_STATE_ENABLED désactivé ; readiness obligatoire avant activation. Migration0017 préparée uniquement : f6d441615e5be5c29724a2d2f3f35f995e505a096a307ceb9759828ffcede8ff. Historique SELECT/INSERT uniquement, aucune migration0008 réécrite, aucun privilège installé. 16tests ciblés avec doublesSQL passent ; refus, seconde lecture après révocation, huit échecs propagés, préservation flags, HTTP et transportabandon. Pas de preuve SQL réel/stream/navigateur ni purge hors ligne.

Blocage spécifique maintenu : procédure humaine de vérification d'identité et reprise d'un compte compromis à valider avant exploitation ; aucune route de déverrouillage automatique. Les streams/jobs/downloads futurs devront lire l'état courant ; aucun SSE inexistant déclaré fermé.
