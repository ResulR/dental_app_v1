# Environnement et secrets — préparation du nouveau laboratoire

Validation documentaire du point2.7, 10/10/2026. ROADMAP.md et docs/EXECUTION_LOG.md portent les statuts canoniques. Aucun runtime, compte système ou secret créé. Aucun secret réel disponible dans le projet.

## Périmètre définitivement décidé

Décision administrateur : runtime indépendant pour dental-lab. dental-site.service, utilisateur/groupe dental-site, /etc/dental-site/dental-site.env, ses secrets et /srv/dental-site sont intégralement hors périmètre. Aucun réemploi, accès, sondage ou modification de ces éléments pour le nouveau projet. Les rapports précédents restent historiques et ne donnent aucune autorisation d'accès.

Rapport utilisateur : release20260904-e94c64a, packages dental-site et @dental-site/server0.0.0, aucune provenance Git exploitable ; runtime préexistant, appartenance au nouveau projet non démontrée. Il n'est plus nécessaire de poursuivre cet audit de provenance : la décision d'exclusion est suffisante pour délimiter le nouveau projet. Aucun isolement complet de l'hôte n'est déduit de ses permissions.

## Préparation effectivement vérifiée

- Travail sous dental-ai UID1002 uniquement dans /srv/dental-lab privé ; ce compte reste audit SQL, sans rôle migrateur/propriétaire ni compte administrateur.
- Aucun .env réel ou fichier .log dans le projet, aucun de ces fichiers suivi dans Git. .env.example est régulier, privé0600, sans secret réel ; paramètres constatés dental_lab/socket PostgreSQL/5432, PGUSER/PGPASSWORD vides. Il n'est pas une configuration runtime utilisable.
- .gitignore exclut .env et variantes (sauf .env.example), logs, node_modules, dist, coverage et caches Python. Tests git check-ignore sans création de secret. Un ignore n'empêche pas git add -f : contrôle de diff/secrets nécessaire avant chaque commit.
- Pas de credential ou variable privée VITE_*. Noms définitifs des variables et validation serveur à aligner sur le backend lorsqu'il existe. Variable obligatoire absente/invalide : arrêt explicite au démarrage, jamais connexion implicite sous dental-ai.
- dental_lab_app est NOLOGIN et sans CONNECT selon audit2.7 initial : aucune identité runtime SQL authentifiable validée. Ne pas employer audit ou migrateur pour le runtime ; aucun rôle changé pour terminer ce point.

## Contrat du futur runtime indépendant

Configuration publique et exemple versionnés ; secrets réels hors dépôt/source éditable, sous contrôle administrateur et accès strictement nécessaire au service approuvé. Aucune valeur réelle dans chat, logs, arguments de commande, frontend ou fixtures. Ne pas créer un secret tant que le besoin, le service destinataire et la méthode d'injection ne sont pas établis.

La conception des seuls privilèges/services propres au laboratoire relève de2.8. Configuration production/secrets et création des unités/comptes propres sont prévues en19.3 et19.4 ; toute intervention système ou PostgreSQL exige l'autorisation distincte de CONSIGNE. Vérifier alors propriétaires, modes, ACL, liens/parents, accès refusé à l'agent, injection correcte au service et absence Git/logs. En cas d'EnvironmentFile d'une unité système, le gestionnaire peut lire un fichier root0600 et transmettre les variables ; le compte de service n'a pas à lire directement le fichier. Le mode d'injection final reste à valider selon les secrets requis, sans réduire de permissions.

## Portée et portes restantes

Point2.7 valide la séparation décidée et la préparation sans secret de développement. Il ne prouve ni existence ni protection effective des secrets futurs, ni disponibilité applicative/production. Les contrôles de19.3/19.4, permissions runtime sans DDL, sécurité/conformité et absence de données médicales réelles restent obligatoires. Aucune création anticipée de compte/service/secret et aucune migration autorisée par cette validation ; chaque SQL et son SHA256 gardent leur approbation administrateur explicite.
