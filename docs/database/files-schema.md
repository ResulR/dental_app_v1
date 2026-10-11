# Médias et transferts — schéma6.7 préparé

CDC4.2/8/9/11/12 et files-lifecycle audités, aucun stockage/API/files existant. Migration0006 :7tables, cléshex64opaques serveur (H67-01), filenames uniquementmétadonnées jamaischemin, formatsfermés, hash32/size/étatvalidé. AucunURL ni objetbinaire/secret/répertoireruntime créé.

Upload appartient compte/clinique ; parentordreoptionnel FKtypée ; destinationmessage/brouillon introduiteaux6.8/6.10. Expiration/capacity_policy/reserved_bytes obligatoires sans valeur opérationnelleinventée. Sanspolitique réelle valide,service futur refuse ouverture. Chunk_size fixé parsessions/FKcomposée, indexsegment unique, offsetgénéré ettailleexacte dernierchunk empêchent chevauchementstructurel ; comptage complet/hashglobal/antimalware etreceived_bytes recontrôlés service.

Fabrication associationversion/ordre/clinique/fichier ; suivi indépendantordre, interne pardéfaut et partage/révocation versionnés ; dérivésprivés mêmesdroits parent, événementssanspayload patient. LesFK empêchentorphans etcrossclinique. Readinessréelle/gelmanufacturing/permissionview-download/ZIP/accessmétadonnées sontautoritéfuture serveur, pasgarantiesduDDL seul. Message/draftFKtypéesajoutéesétapes suivantes.

200Mo décimal =200000000octets H37-01 ;1Go initial/message sera compté partransaction/service, pasCHECKuneautretable fictif. Aucune limite de nombre ou quota conversation. Réserve/TTL/capacité sont paramètres d'exploitation non validés : aucunuploadréel avantvalidation.

files_constraints.sql prépare12refus etpositifs limiteexacte/chunks/suiviinterne,NONexécuté. RecettePG/ROLLBACK/ACL/objetsprivés/fichiersorphelins fonctionnels restent différés ; POINT_6_7_ADMIN.md puisdossierconsolidé.
