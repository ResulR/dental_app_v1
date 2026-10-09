# ADR 0002 — Frontières métier et décisions atomiques

Conception du point 3.1, dérivée de la cartographie validée en 1.4 et des principes d'architecture. Pas de nouvelle fonction métier ni installation.

Décision : conserver les propriétaires et le graphe orienté de [architecture](../architecture.md). Les demandes formelles appartiennent à orders ; linked-works compose ce workflow pour remplacement, supplément et retouche. Les noms candidats order-requests/retouches/chat du complément ne nécessitent pas de modules séparés : messaging porte la messagerie. Pas de dossiers vides.

Chaque module expose une API limitée. Les ports d'accès parent pour files/messaging et de lecture des retouches pour delivery sont raccordés par la composition à des lectures minimales sans appel récursif. Cela évite les cycles et conserve les recontrôles de sécurité côté serveur.

Une transaction partagée entre services garantit les invariants SQL et l'outbox/audit de l'action réussie. Le fournisseur e-mail reste hors transaction. L'attachement de fichiers exige une finalisation durable et réparable : la transaction SQL ne couvre pas le stockage binaire.

Alternatives écartées : accès direct aux repositories d'un autre module (couplage et contournement des règles), cycles d'import orders/files/messaging (autorisation ambiguë), microservices métier (coordination distribuée injustifiée dans le monolithe validé), action métier conditionnée au succès immédiat d'e-mail (contraire à §10.4).

Vérification de conception : modules définis, graphe sans cycle, correspondance avec §§2–17 et exclusions §18. Les contrôles d'import sur code et les tests atomiques métier restent à implémenter aux étapes concernées ; le modèle SQL détaillé n'est pas inventé ici.
