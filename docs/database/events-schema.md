# Notifications, événements et audit —6.9 préparé

CDC10/15 et events-notifications-audit audités. Port createAuditWriter existant conservé, pas deréimplémentation niadaptateurDBprétendu branché. 0008 nonappliquée :7tables, outboxévénementsappend séparée étatdispatch/envois/tentatives/notificationslues. FKrestreintes sanscascade, emailéchoué ne retirepasévénement/ordre.

Événementsdomaine fermé CDC, UUIDobjet/révision/corrélation/acteurouprocessus, aucunpayload librepatient/message/clécoffre. Audit champschangés autorisés/nomsdechamps seulement, code motif expurgé ; raisonslibres danshistoires métier. Adapterport futur doit valider UUID/révisionpositive deDB etrefuserdiffs sensibles, pasconsidérer une donnéeclientautorité.

Sixcatégories mailslabo exactes, destinataires configurables adminsFKprofil ; propriétairepar défaut etalertescritiques toujoursowner àimposer service. Notificationsinterne lue ne décide rien. Envoidédupliqué événement/cible/canal/usage, états pending/provider_accepted/failed/cancelled, lease/retry ettentativescodeerreurseulement, aucunsecret/payloadSMTP. Channeltechnical conceptualindépendant àimplémenter, aucunproviderexternechoisi.

Servicesdevrontvérifierdroits/étatactuels/utilité, construireemail sanscontenumedical, backoff/jitter/paramètres calibrés,30min24h/nouveauxmessages cycle6.8. Provideraccepted≠lecture/réception. AuditruntimeINSERTetSELECT filtréowner sansUPDATEDELETE6.11 ; pasimmutabilitécontre root.

11refus/positifs panneemail préparésNONexécutés ; permissionsDB/audittransactionnel/workerrecette différés. Aucunemail envoyé ni fournisseur/secrets/service créé.
