# Saisie clinique et vérification — 9.1–9.5, protections8.3–8.5

Préparation depuis893d078. Formulaire albanais réel dans le portail clinique : nom+prénom et/ou référence, matériau/teinte obligatoires, type facultatif, description, date souhaitée indépendante de la planification,32codesFDI avec cycle normal/pontique/vide. Zéro dent et description vide produisent un avertissement. Tout reste en mémoire ; aucune persistance locale non chiffrée et aucun faux dépôt ou numéro. Le texte utilisateur annonce la perte à fermeture.

POST /api/v1/orders/preflight authentifié, origin canonique/JSON strict, recontrôle compte/session/epoch/clinique approuvée non suspendue. Seule la clinique courante peut vérifier sa saisie ; aucun clinic_id, rôle, date planifiée ou snapshot fourni par client. Schémas additifs : anciens contrats inchangés. TypeScript strict corrige explicitement l'optionalité work_type_id ; aucune règle affaiblie.

readCatalogForUse partage la transaction : verrouillage des identités dans l'ordre UUID FOR SHARE puis lecture de l'état effectif. Catégories exactes et identités distinctes ; référence manquante/mauvaise catégorie ou interdiction bloque, indisponibilité seulement avertit. Aucun snapshot/commande/historique/audit/outbox écrit par un contrôle en lecture. Les références retirées peuvent encore apparaître avec libellé nul pour expliquer leur état historique, sans reconstruire ni remplacer leur snapshot.

Flag DENTAL_LAB_ORDER_PREFLIGHT_ENABLED false par défaut, dépend AUTH et CATALOG activés explicitement ; aucune configuration changée. Résultat strict persisted:false. Le contrôle ne conserve PAS de réservation après sa transaction : les futurs writers de soumission/acceptation doivent reprendre ces verrous puis revalider dans LEUR transaction. Aucune protection de progression complète revendiquée à ce stade.

Le formulaire utilise le catalogue paginé réel ; un choix devenu indisponible entre chargement et contrôle est signalé. Un fichier fourni en API bloque files_not_ready tant que le pipeline d'attachement réel manque ; aucun fichier silencieusement abandonné. Pas de champ d'upload simulé.

7tests ciblés SQL doublé/HTTP local passent : autorité courante, clinique approuvée, catégories/états, ordre verrous, absence de DML, identifications/date/FDI/injection, avertissements non bloquants, fichiers fermés, cache et faux reçu refusé. Buildscontrats/API/web, typesweb, lint, contrats2schémas additifs et frontières vérifiés. Aucun test PostgreSQL ni navigateur/FDI tactile annoncé reçu ; R17 conservée.

Prochain travail : dépôt officiel idempotent avec numéro serveur, snapshots/version/dents/logistique/conversation/audit/outbox/reçu en transaction ; confirmation avertissements, fichiers vérifiés, acceptation exceptionnelle motivée et progression bloquée. Ne pas utiliser un succès preflight comme autorisation différée. Les réceptionsSQL déjà validées ne doivent pas être rejouées ; aucune migration ou activation exécutée.

Suite16/10 : dépôt sans pièces jointes désormais intégré dans le code sous flag séparé, voir ORDER_SUBMISSION.md ; les limites du contrôle préalable ci-dessus restent valables.
