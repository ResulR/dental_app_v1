# Contrats exécutables — point5.9

Source unique runtime : packages/contracts/src/schemas.ts, types inférés Zod et entrée publique @dental-lab/contracts. Web et API importent cette même entrée ; aucun DTO dupliqué. Les schémas de conception3.11 dans docs/contracts/common.schema.json restent la référence historique auditée ; champs, required et enums sont contrôlés contre l'implémentation. Snapshot runtime-v1.snapshot.json est un résultat généré de comparaison, pas une seconde source éditable manuellement.

Contrats : ObjectId opaque sans UUID imposé, révision entière sûre, huit statuts ; Patient (prénom+nom ou référence ou les deux), FDI32 (normal/pontic, unicité même entre états), soumission normale clinique, précondition, projection logistique fermée, reçu UTC, Problem fermé et santé minimale. Champs blancs refusés sans recopier leur valeur ; dates calendaires réelles, champs inattendus refusés. Description/dents facultatives au sens métier (liste vide autorisée), aucun nombre maximal arbitraire de pièces ; zéro dent et aucune description donnent seulement NO_TEETH_OR_DESCRIPTION. La soumission normale ne s'applique pas aux retouches/brouillons incomplets/créations labo.

Validation serveur et navigateur partagée ; catalogue courant, droits/clinique authentifiée, tailles/contenu/permissions fichiers, concurrence/transactions/idempotence restent des contrôles serveur métier aux chapitres dédiés. Ce schéma n'autorise aucune soumission à lui seul. Aucun endpoint métier, stockage ou donnée réelle créé au5.9.

Middleware serveur valide entrée et réponse, y compris résultat asynchrone ; projection de réponse hors contrat devient INTERNAL_ERROR expurgé, sans transmettre les données rejetées. Problèmes et health réels passent leur schéma avant émission. Côté web, réponse incompatible donne API_CONTRACT_MISMATCH sans détails sensibles. Les erreurs de saisie ne contiennent que pointer/champ attendu et code stable ; jamais message brut Zod, valeur ni liste de clés inconnues. Ces helpers concernent des objets fermés à clés prédéfinies, pas des maps de clés arbitraires contenant des valeurs médicales.

```sh
python3 scripts/run-quality.py build:packages
python3 scripts/run-quality.py check:contracts
python3 scripts/run-quality.py test:unit
python3 scripts/run-quality.py test:integration
```

Build obligatoire après changement de source avant tests important les packages compilés. Le contrôle snapshot compare structure et version, échoue sur dérive ; une modification contractuelle doit être examinée et versionnée selon3.11. Ne pas régénérer la référence pour cacher un échec. Le préparateur initial utilise flag wx et refuse d'écraser un snapshot existant. Les refinements sémantiques (identification, blancs, dates, unicité FDI, relation code/type) ne sont pas tous représentables en JSON Schema : tests sémantiques obligatoires en complément, le snapshot ne prouve pas à lui seul une compatibilité métier.

Tests synthétiques : mêmes décisions web/API, absence de patient dans projection logistique, pas d'écho de champs inconnus, calendrier/FDI/doublons/révision sûre, absence de plafond120pièces, refus de sortie contenant un champ patient, réponse problème/health validée et détection de réponse incompatible. Test HTTP utilise uniquement ses serveurs éphémères propres. Aucun navigateur réel validé sous R17.
