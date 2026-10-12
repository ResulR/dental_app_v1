# Approbation/refus clinique — noyau7.4 préparé

CDC2.2/10, modèleaccounts et registre0002 audités. Autorisation existante clinics.manage réutilisée, jamais privilège client ; acteurclinique ne décidepas sa propre inscription. expectedRevision positive, décisionapproved/refused, raison normalisée facultative : roadmapprévoit raison, CDC2.2 ne l'impose pas, H74-01 technique réversible sans imposer le motif obligatoire des refus de commande.

PortdecideAtomic revalide autorisationcourante/étatpending/révision sous transaction ; modifie seulementreview_state/revision, conserve suspension/reset/security, append décision/audit/événement prévu. Stale/notpending/permissionrevoked ne sontpasréussites. Aucun mail de décision d'inscription supplémentaire inventé ; politique CDC10 et destinataires sont leurs implementations, aucun mailenvoyé. Aucune réinscription/réouverture aprèsrefus ajoutée.

0012 prépareclinic_review_events append-only (4refus SQL), SIapp uniquement, aucune UPDATEDELETE/role/HBA. Source0002/29permissions/lanceurinchangés. Codeetunitaires utilisentportsdoublés ; persistance/autorisationDB/transactions etnotificationréelle restent àcompléter/recevoir. PasderouteHTTPbranchée.

5nouveauxunitaires,50totalpassent ; cataloguefiltre/lint/buildAPI/frontières/format passent,pic66/100. RecetteSQL/4refus/audit/ROLLBACK NON exécutée ; proposition POINT_7_4_ADMIN/SHA,jalonchapitre7 distinctdelot6. Aucune décision clinique réelle ni compte/permissioncréé.
