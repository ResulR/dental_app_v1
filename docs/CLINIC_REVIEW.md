# Approbation/refus clinique — noyau7.4 préparé

CDC2.2/10, modèleaccounts et registre0002 audités. Autorisation existante clinics.manage réutilisée, jamais privilège client ; acteurclinique ne décidepas sa propre inscription. expectedRevision positive, décisionapproved/refused, raison normalisée facultative : roadmapprévoit raison, CDC2.2 ne l'impose pas, H74-01 technique réversible sans imposer le motif obligatoire des refus de commande.

PortdecideAtomic revalide autorisationcourante/étatpending/révision sous transaction ; modifie seulementreview_state/revision, conserve suspension/reset/security, append décision/audit/événement prévu. Stale/notpending/permissionrevoked ne sontpasréussites. Aucun mail de décision d'inscription supplémentaire inventé ; politique CDC10 et destinataires sont leurs implementations, aucun mailenvoyé. Aucune réinscription/réouverture aprèsrefus ajoutée.

0012 prépareclinic_review_events append-only (4refus SQL), SIapp uniquement, aucune UPDATEDELETE/role/HBA. Source0002/29permissions/lanceurinchangés. Codeetunitaires utilisentportsdoublés ; persistance/autorisationDB/transactions etnotificationréelle restent àcompléter/recevoir. PasderouteHTTPbranchée.

5nouveauxunitaires,50totalpassent ; cataloguefiltre/lint/buildAPI/frontières/format passent,pic66/100. RecetteSQL/4refus/audit/ROLLBACK NON exécutée ; proposition POINT_7_4_ADMIN/SHA,jalonchapitre7 distinctdelot6. Aucune décision clinique réelle ni compte/permissioncréé.

## Intégration depuis 98d1261

POST /api/v1/clinics/:id/review, schéma strict partagé, origine HTTPS exacte, JSON, pas de query ; identité extraite de la session, aucun acteur fourni par le client. 204 après commit, 409 conflit, 403 refus, 401 sans session. Nouveau flag DENTAL_LAB_CLINIC_MANAGEMENT_ENABLED false par défaut, auth et readiness ACL exigées avant activation. Aucune configuration d'exploitation changée.

Le repository relit et verrouille compte puis session ; vérifie révocation/epoch/expiration absolue ; verrou SHARE de account_grants jusqu’au commit, décision pending/révision sous FOR UPDATE. Historique 0012, audit et événement account_changed/dispatch dans la même transaction. Suspension/sécurité non modifiées ; pas de nouvelle catégorie mail. Le verrou de table peut retarder une modification des permissions : timeouts existants conservés, aucun repli non verrouillé ou retry. Privilège DELETE de 0010 compatible avec LOCK SHARE selon https://www.postgresql.org/docs/17/sql-lock.html ; comportement effectif/concurrence/rollback à recevoir sur PostgreSQL isolé. Ne pas l’inférer des doubles de tests.

GET /api/v1/clinics/pending : pagination par UUID, maximum 50 éléments, contrôle de permission dans la transaction, aucune donnée patient. Interface lab intégrée à la vue authentifiée, sélection de demande et décision/révision/raison facultative ; purge après tentative, rechargement manuel et aucune resoumission automatique. Aucun stockage navigateur ; démontage/annulation lors de la déconnexion. Réception navigateur encore ouverte. Aucun changement 0012 ni migration exécutée. Le bundle v4 partagé figé reprend la recette inscription précédente : il ne valide pas ce nouveau repository.
