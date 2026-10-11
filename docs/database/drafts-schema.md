# Brouillons et conflits —6.10 préparé

CDC11/R15 et drafts-sync audités ; aucuneimplémentationdraftsexistante. 0009 nonappliquée :5tables, propriétairescompte-cliniqueFK, révisionsappend etcurrentdifféré, tombstonesactif/deleted/submitted, associationsfichiers/révision/clinique, reçuintention etconflictsource/base/serveur/résolutionclone. Aucunnuméro officiel, TTL/purgeâge ou coffre/clé/phrase/code serveur ajouté.

Payloadpartiel formatinterne versionné (patient/date/material/shade/type/description/teeth), incompletautorisé brouillon ; clésracinefermées, schémas imbriquésstricts frontières futures, pasune promesse d'empêcher contenu sensible parCHECKseul. Il nechangepascontratClinicSubmission public. Reconnexion/clone/soumission revalidentréférences/fichiers/droits/catalogue actuel.

RepositorysaveCAS fourni indépendamment : une requêteUPDATE conditionnée draft/account/clinic/revision/active, INSERTnouvelle révision et reçu dansCTE, erreurunique annule tout ;zérorésultat =conflit/inaccessible àtraduire sansIDOR. Paramètres etbornesvalidés, noautorretry ni logpayload. Route/service futur revalidepayload/session/maintenance, calculefingerprint etrecouvre reçuidentique si réponseperdue. Fichiers encore àassocier dansmême transaction finale ; méthode actuelle n'annoncepas synchronisationcomplète ni clonefonctionnel. Aucunendpoint branché.

9refusSQL/positifsCASpérimé/tombstone préparésNONexécutés ; 4unitaires de portparamétré réussies, n'éprouventpas concurrencePG. Tests navigateurR15/R17 etdeuxappareils/conflitsfichiers/recuperationdemêmeintention différés. Aucun secret envoyé/créé.
