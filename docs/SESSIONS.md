# Sessions — noyau7.2 préparé, intégration différée

CDC11/2/15 et schema0002 audités ; aucun sessionmodule avantintervention. Serviceindépendant fournitjetonopaquealéatoire256bits/digestSHA256uniquementenstockage, cookies__Host-/Secure/HttpOnly/Path=/SameSiteLax, parsingcanonique/duplicatesrefusés,guardOrigineHTTPS exacte pourmutations, zérosecret enURL/log. Unecookie n'estpasungrant ; relecturestatut/epoch/expiration/revocation àchaqueopération.

Multiappareils indépendants, logoutciblé, révocationglobaleepoch, renouvellementrotation refuseancien/replay etne repoussepasborneabsolue. Policy requise lifetime/absoluteLifetime finie≤30jours (candidatetechniqueH72-01), aucunevaleurdéploiement choisie ; renouvellement àdemivie. Perte réponseaprèsrotation impose réauth si cookieancien révoqué, aucungracecontournant révocation. Clockretrogradefailclosed. Origine/domaine/TLS/CSRFroute/browsers etseuilsprod restent àrecevoir, pas d'endpointbranché. SameSiteLax seuln'estpasCSRFcomplet.

SessionStore estport : implémentationPGdoitrecontrôlercompte/epoch etatomiquementcréer/renouveler/révoquer avecaudit avantretourtrue. Ne pascacherAuthenticationFact/clientbody commeautorité. ServiceMock tests n'estpasadaptateurdurable, aucunepersistence/sessionréelle prétendue. API/transactionadapter etracesPG àimplémenter/recevoir ; `revokeAllForAccount` réservéappelserveuraprèsautorisationcourante,jamaisidentifiantbodytrusted.

0011 nonappliquée :borneabsoluepersistée session_limits obligatoireFKdifférée,expiresclamp etparent_keygénéré. FKparentmêmeaccount/mêmeabsoluteborne ; nouvelenfantn'augmente jamaisduréeracine. Exigesessionsvides :si sessionsprésentes,stratégie de migration doit êtrepréparée/revue, aucunepurge/backfillaveugle ni changementlanceurconservateur. App reçoitseulementSELECTINSERTnewtable ; aucuneUPDATEDELETE/DDL/role/HBA.0002 inchangée. SQL/SHA/recette5refus dansPOINT_7_2_ADMIN àregrouperjalon7, horslotchapitre6.

7testsunitaires de service/cookie avecstoreexplicitementmémoire passent (38unitaires total),lint/buildAPI/frontières/format passentaprèsreformatageciblé.5refusSQL NON exécutés ; cookieHTTPS/browser/SessionStorePG/réponseperdue/concurrence/revocationSSE/horsligne encore àrecevoir. LogoutvolontairecoffreR15 localdistinct etinchangé ; pasdepromesse révocationdonnéesofflineinstantanée.

Sourcesprimaires12/10/2026 : https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie ; https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies . AucunChrome/VPSguard modifié,testsR17 toujoursdifférés.
