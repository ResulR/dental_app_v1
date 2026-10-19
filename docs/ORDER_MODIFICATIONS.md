# Demandes de modification — 19 octobre 2026

CDC §5.2 et ROADMAP10.5 : la clinique propose des instructions pour une commande Acceptée avant fabrication. La version officielle ne change pas avant acceptation du laboratoire. Le laboratoire conserve son édition directe motivée (10.10), interdite si une demande est pendante.

POST /api/v1/orders/modification-propose : permissions actuelles et clinique approuvée, validation complète, nouvelle version immuable et demande modification dans la même transaction. Le verrou de commande, CAS et l’index unique commun aux demandes d’annulation/modification empêchent deux demandes pendantes. Une collision exacte de cet index est traduite après rollback, sans retry automatique. L’ancienne version officielle est conservée. Les snapshots des références inchangées restent historiques.

POST /api/v1/orders/modification-context : contexte officiel et proposé lu dans une seule transaction, clinique cloisonnée ou permission laboratoire orders.edit_instructions avec ses prérequis. Tableau albanais avant/après ; aucune mutation lors de la consultation.

POST /api/v1/orders/modification-decide : acceptation ou refus par laboratoire habilité, contrôle version/révision de commande et révision de demande, statut Acceptée sans version de fabrication. Acceptation revalide catalogue, fichiers et blocage de sécurité ; références indisponibles exigent acquittement. Refus motivé libère la demande sans remplacer les instructions ; il reste possible si les références proposées sont devenues interdites. État de demande, version officielle, révision, audit et unique événement request_decided sont atomiques. Aucun double événement instructions_changed, aucun envoi réel. Le retrait clinique existant reste disponible et concurrence les décisions sur le même verrou/CAS.

DENTAL_LAB_ORDER_MODIFICATION_ENABLED désactivé par défaut ; exige les activations édition et demandes, elles-mêmes dépendantes du cycle de vie et de ses readiness. Aucune activation ni migration exécutée. Fichiers non vides bloqués jusqu’au pipeline sécurisé réel. Le formulaire de proposition partage les validations de l’édition ; la réponse de succès provient exclusivement de l’API.

Tests ciblés : 10 tests édition/proposition, 8 décision/revue/concurrence/rollback/client/configuration, 1 HTTP origine/session/contrat/no-store. Les courses sont sérialisées par un double transactionnel, pas une preuve de verrouillage PostgreSQL réel. Validation réelle PostgreSQL et recette navigateur restent nécessaires, ainsi que livraison des notifications par les consommateurs d’outbox.
