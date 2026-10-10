# API — point5.7

Express5/TypeScript6, factory importable sans écoute automatique ; démarrage explicite via entry compilée. Configuration avant écoute : NODE_ENV fermé, DENTAL_LAB_PORT explicite sans port de production inventé, zéro seulement en test ; binding127.0.0.1, autre PGDATABASE refusé. Aucune connexion SQL au point5.7. Le runtime dédié, les secrets et l'allocation du port restent à approuver en19.3/19.4 ; aucun service installé ou démarré.

GET /health est uniquement une liveness du processus, pas readiness SQL/stockage. Réponse sans état système/versions/identité/donnée sensible, Cache-Control no-store. Routes inconnues404 générique. Erreurs application/problem+json conformes au contrat conçu3.11, titre albanais/code stable/request_id aléatoire, jamais corps rejeté/URL/stack/SQL. Parser métadonnées32KiB initial technique réversible ; les gros fichiers futurs utilisent un transport streaming distinct, seuils à éprouver au module fichiers. Trust proxy false jusqu'au déploiement contrôlé, X-Powered-By désactivé.

Timeouts HTTP initiaux30s/request,10s/headers,5s/keepalive ; arrêt SIGINT/SIGTERM unique, fermeture des connexions inactives puis restantes après5s. Ces seuils de fondation seront mesurés aux transferts sans changer les limites métier200Mo/1Go. Les tests créent exclusivement leurs propres ports0 loopback et ferment en finally ; jamais lecture/connexion aux services voisins.

```sh
python3 scripts/run-quality.py build:api
python3 scripts/run-quality.py test:unit
python3 scripts/run-quality.py test:integration
```

Logs techniques expurgés et corrélation HTTP seront complétés5.8 ; contrats partagés validés5.9. Pas routes privées, auth, SQL ou readiness production déclarées.
