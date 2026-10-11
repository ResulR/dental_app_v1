# Messagerie et lecture — schéma6.8 préparé

CDC9/10.3 et modèleevents audités. 0007 nonappliquée :6tables etdestinationuploadconversation FKclinique. Général uniqueclinique toujoursouvert ; ordre uniqueorder/clinique. Servicescréentconversationavecclinique/ordre etcohérenceLivrée→close/correction→reopen atomiquement ; DDL seul neprouvepas cestransactions.

Messages séquencepositive uniqueconversation, cléidempotentesender/conversation, versioncourante différée même message ; éditions versionnées créées par auteuroriginal FK,masquageauteurd'origine sans effacement. Textefacultatif si fichier côtéservice ; absence simultanée texte/fichier à contrôleravantpublication. PiècesversionnéesFKclinique, limite1Go globale service.

Lecturepartagée clinic/laboratory unique, marque uniquement séquenceexistante réellementouverte, auteur/date ; servicesfontavanceCAS/GREATEST aprèsautorisation, préchargement/SSE ne marque pasLu. Cycle rappelparconversation/côté, étatdurable ; temporel30min/24h/nouveauxmessages/lecturecomplète àimplémenter/tester6.9/14, pasdéclaré fonctionnelici.

11refus etpositifs historique message préparésNONexécutés ; POINT_6_8_ADMIN/propositionconsolidée. Auth/SSE/perms/appareils/close-read-only etnooverwriteoldversions auxchapitres dédiés. Aucune donnée réelle ni connexiontempsréel créée.
