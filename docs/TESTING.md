# Tests — point5.5

Outils installés et verrouillés en ADR0004 : Vitest5.0.3 (unitaires/intégration), Playwright1.64.0 (API HTTP et future recette navigateur). Aucun nouveau téléchargement navigateur ou changement VPS. Configurations : un worker, fichiers séquentiels, aucun retry masquant une défaillance ; deadline du lanceur R18 en complément des timeouts de tests.

```sh
python3 scripts/run-quality.py test:unit
python3 scripts/run-quality.py test:integration
python3 scripts/run-quality.py test:e2e-api
```

Les exemples unitaires vérifient des frontières d'import réellement utilisées. L'intégration compose Express, le contrat partagé compilé et Zod, puis teste JSON valide/invalide. L'exemple Playwright vérifie le transport HTTP de bout en bout avec son client API isolé, sans fixture page/browser. Son serveur éphémère de test écoute uniquement sur une adresse loopback et un port alloué par le système, est fermé dans finally ; aucun service local existant n'est contacté. Ce probe est exclusivement une fixture tests/support, pas une route applicative ni une validation du futur parcours métier.

Aucune connexion ou migration PostgreSQL. Les fixtures ne contiennent ni patient ni secret et ne persistent aucune donnée métier. Les tests PostgreSQL futurs restent soumis au schéma versionné approuvé, aux seules permissions dental_lab et à l'isolation transactionnelle appropriée ; aucun privilège supplémentaire ou base concurrente inventée. Les artefacts techniques sont dans .local, ignorés par Git.

R17 : les tests E2E navigateur, tactile, clavier, responsive et lecteur d'écran restent à réaliser sur appareil autorisé isolé. La réussite du client API n'est pas une recette navigateur et ne clôture pas4.4/4.14. Les futurs tests visuels utiliseront les prototypes et fiches existants ; aucun Chromium lancé sur le VPS.

Références primaires vérifiées : https://vitest.dev/config/fileparallelism.html et https://playwright.dev/docs/api-testing. Les métadonnées locales installées restent la référence des versions exécutées.
