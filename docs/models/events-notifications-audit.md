# Événements, notifications et audit — conception 3.9

Sources : CDC §§2, 5–7, 9–10, 15–16 ; [architecture](../architecture.md), [permissions](permissions.md), [automate](order-state-machine.md), [coffre R15](drafts-sync.md). Aucun événement, worker, table ou fournisseur déjà implémenté n'est prétendu.

## Contrats et projections proposés

Événement durable : event_id unique, schema_version, type fermé, aggregate_type/id, aggregate_revision, clinic_id si applicable, actor_account_id/process, occurred_at serveur UTC, correlation/intent_id et référence de version utile. Payload minimal : ni patient, contenu de message, nom médical de fichier, secret ni clé du coffre. Déroulé : mutation + version + audit important + outbox dans la même transaction ; dispatch après commit. Historique métier, notification personnelle et audit global sont des projections distinctes.

La boîte prioritaire montre les actions encore à traiter à partir de l'état métier actuel, même si leur notification a été lue. Notifications internes : compte destinataire, event_id, catégorie, created/read_at ; unicité event/cible/canal pour déduplication. Lire une notification ne décide rien. Les événements ne sont ni des grants ni des instructions officielles ; toute ouverture recontrôle clinique/droits.

## Matrice événements / canaux / visibilité

L = destinataires labo de la catégorie, configurés par propriétaire parmi admins encore habilités, propriétaire par défaut pour événements importants. C = compte clinique de la ressource, adresse active et droits courants. P = propriétaire. E = e-mail asynchrone, I = portail/notification interne explicite, H = historique/projection autorisée, RT = signal connecté minimal. L ne désigne pas tous les employés. Les événements sans e-mail ne deviennent pas une nouvelle catégorie de mail.

| Événement métier | Destinataires / visibilité | Canaux | Règle d'envoi et audit |
|---|---|---|---|
| Nouvelle commande soumise par clinique | L catégorie nouvelle commande ; clinique voit son travail | E labo, boîte prioritaire/H/RT | Un seul événement de soumission réussie, audit création ; pas de mail clinique |
| Nouvelle inscription clinique | L catégorie inscription | E labo, boîte prioritaire/H/RT | Profil minimal autorisé, audit inscription/décision |
| Nouvelle demande modification | L catégorie modification | E labo, boîte prioritaire/H/RT | Pas d'email clinique supplémentaire ; original inchangé, audit demande |
| Nouvelle demande annulation | L catégorie annulation | E labo, boîte prioritaire/H/RT | Même exclusivité pending ; audit demande |
| Nouvelle retouche/refabrication clinique | L catégorie retouche | E labo, boîte prioritaire/H/RT | Prioritaire ; pas de second mail « nouvelle commande » pour le même acte ; audit filiation |
| Correction explicitement renvoyée | L catégorie renvoi corrigé | E labo, boîte prioritaire/H/RT | Simple édition sans renvoi n'émet pas ce mail ; audit version/renvoi |
| Acceptation / correction demandée / refus | C ; labo habilité voit l'historique | E clinique, H/RT | Audit décision, motif requis ; champs patients exclus du mail |
| Travail terminé | C ; labo habilité | E clinique, H/RT | Audit transition ; idem retouche |
| Décision acceptation/refus de demande modification | C | E clinique, H/RT | Audit décision et version si acceptée |
| Décision acceptation/refus de demande annulation | C | E clinique, H/RT | Audit décision ; acceptation et transition ne créent pas deux mails identiques |
| Annulation directe labo | C | E clinique, H/RT | Audit motif ; clôture technique pending selon H35-01 sans mail additionnel |
| Modification directe instructions labo | C | E clinique + I, H/RT | Motif/version, avant fabrication seulement, audit |
| Création labo, remplacement/supplément lié | C | E clinique + I, H/RT | Nouvelle identité Acceptée, origine/filiation ; remplacement en fabrication applique aussi annulation source et ses traces, destinataire commun regroupable sans perdre les conséquences |
| Édition clinique en attente/correction | Clinique et labo avec détail | H/RT | Version/audit ; pas de nouveau mail automatique |
| Retrait de demande par clinique | Même périmètre travail | H/RT, action pending retirée | Trace du retrait, pas de fausse décision ni catégorie email ajoutée |
| Début fabrication | Même périmètre travail | H/RT | Audit/verrouillage ; pas de mail systématique |
| Livraison physique | Même périmètre travail | H/RT | Audit sortie et fermeture chat, aucun mail clinique |
| Correction exceptionnelle livraison | Owner/admin habilité, clinique selon historique | H/RT | Audit motif, réouverture/invalidation archive, pas de mail inventé |
| Planning / priorité / urgence / retard | Selon accès logistique | H/RT et indicateur interne | Planning/priorité historisés ; pas de mail urgence/retard ; arrêter alertes Livrée/Refusée/Annulée |
| Message reçu | Lecteurs de la conversation côté destinataire | RT + non-lus ; rappel E sous conditions ci-dessous | Pas d'e-mail immédiat automatique ; contenu par lecture serveur autorisée |
| Conversation ouverte / lecture complète | Deux parties autorisées, sans audit global exposé | État Lu/RT | Lecture partagée labo constatée par un utilisateur autorisé, distincte du traitement métier |
| Édition / masquage message | Lecteurs autorisés | H/RT, mention Modifié | Versions/trace conservées ; ne pas réécrire autrui ; aucune copie de texte dans logs techniques |
| Partage/révocation fichier suivi | Périmètre parent/partage actuel | H/RT | Audit partage, pas de mail automatique inventé ; téléchargements passés non récupérables |
| E-mail clinique : demande/décision/confirmation | Clinique concernée et admin habilité selon étape | Workflow sécurisé ; avis de sécurité ancienne adresse | Activation après confirmation nouvelle adresse ; audit sans jetons |
| Invitation/récupération/authentification sensible | Compte concerné et P pour alertes de sécurité pertinentes | E transactionnel privé, alertes sécurité | Liens sensibles hors logs ; distinct des six catégories métier, audit expurgé |
| Comptes / grants / suspension / sécurisation | Acteurs habilités ; P pour sécurité | H/RT ; sécurité P si critique | Audit, révocation immédiate côté serveur, jamais déduction de droits par notification |
| Catalogue / interdiction | Utilisateurs concernés selon droits, impacts P | H/RT et blocages | Audit, pas de changement silencieux des travaux ; pas de nouvelle catégorie métier E |
| Paramètres / maintenance | P et projection de bandeau utilisateurs | H/RT, bandeau ; jamais mail maintenance | Audit activation/désactivation ; annonce n'active rien automatiquement |
| Incident technique / sauvegarde critique | P toujours | Canal technique critique indépendant du flux métier | Reprise/échec suivis ; ne pas croire canal opérationnel avant tests |
| Coffre local / récupération | Localement compte concerné seulement | État local | Ni phrase/code/clés ni événement de télémétrie contenant ces valeurs ; aucun mécanisme serveur de récupération |

Les équivalents de workflow retouche reprennent la même politique clinique. Tout e-mail contient au plus une référence professionnelle minimale et un lien privé exigeant authentification, sans patient, dents, matière clinique, texte libre, fichiers ni pièces jointes médicales. L'adresse et les décisions sensibles sont minimisées ; ne pas envoyer le motif libre brut. Les historiques autorisés fournissent le détail après connexion. Destinataires revérifiés juste avant envoi ; adresse obsolète = replanification/refus explicite, jamais ajout silencieux d'un destinataire.

## Outbox, concurrence et retries

Modèle proposé : outbox_event, notification_delivery (event/cible/canal/purpose unique, état pending/provider_accepted/failed/cancelled, next_attempt_at, attempt_count, lease, provider_id), tentatives expurgées et reçus idempotents. Le fournisseur n'est pas choisi : statut provider_accepted ne prouve ni réception ni lecture. Aucun secret de fournisseur dans event/payload.

Workers reprennent par bail borné et claim transactionnel, sans conserver une transaction DB ouverte pendant HTTP fournisseur. Avant chaque tentative : état compte, permission catégorie/ressource, destinataire et utilité actuelle. Notification ancienne dont l'action est déjà traitée : marquer annulée/obsolète avec cause non médicale, conserver trace ; ne pas annuler une alerte critique encore utile. Mutation et audit échouent ensemble ; erreur e-mail après commit ne revient jamais sur la décision métier.

H39-02, choix technique réversible : backoff exponentiel borné avec jitter et gestion des indications du fournisseur ; paramètres versionnés à calibrer au chapitre14. Erreur permanente d'adresse/permission ne boucle pas ; erreur temporaire/timeout retry. Épuisement = failed visible P, relance manuelle propriétaire reprend la même delivery avec trace, pas une nouvelle notification métier. Après timeout d'envoi ambigu, consulter état fournisseur si possible puis même clé d'idempotence si supportée. Sans preuve externe, un doublon reste possible : aucune promesse exactement une livraison.

## Messages non lus et cycle des rappels

Messages ont une séquence monotone par conversation. Curseur de lecture partagé pour la clinique et pour le côté labo ; seul lecteur autorisé fait avancer le curseur jusqu'à la séquence effectivement ouverte, jamais celle arrivée après. Publication RT ou préchargement ne marque pas Lu. Masquage/édition préserve identité/version/traçabilité.

État de rappel durable par conversation/côté destinataire : cycle_id, last_read_seq, last_reminder_at, last_reminded_seq et date d'arrivée de chaque nouveau message. Premier rappel si messages toujours non lus depuis au moins30min. Après premier, nouvel envoi seulement si au moins24h écoulées depuis le précédent ET présence de nouveaux messages depuis ce rappel, non lus depuis au moins30min. Pas de répétition pour les seuls anciens non-lus. Lecture complète ferme le cycle ; nouvelle arrivée crée un autre cycle. Lecture partielle n'est pas une lecture complète. Le compte partagé n'attribue pas la lecture à un dentiste physique certain.

Job planifié et lecture utilisent la même révision/claim du cycle : recontrôle avant envoi évite un rappel déjà inutile ; une course après remise au fournisseur ne peut pas rappeler un mail. Regrouper les arrivées proches par cible autorisée en un rappel générique ; n'inclure aucune conversation sans droit actuel. Destinataires labo parmi admins configurés et habilités à cette conversation, propriétaire selon réglage important ; pas d'envoi administratif automatique aux employés. Les comptes suspendus et droits retirés sont exclus. Clôture à livraison ne marque pas artificiellement les messages Lu ; les non-lus restent consultables selon droits.

## Transport connecté et reprise

H39-01, décision technique réversible : SSE même origine/cookie de session pour signaux serveur→client, mutations/messages/lecture via requêtes HTTP autorisées avec protection CSRF. Pas de jeton dans URL ni de contenu médical dans le flux ; event_id opaque/cursor borné, catégorie et référence autorisée suffisent à invalider/recharger les projections. Une seule connexion multiplexée par client actif, coopération entre onglets à éprouver ; support mobile/arrière-plan et contraintes HTTP/proxy à tester avant production.

Autoriser abonnement ET chaque diffusion/replay selon état actuel. Révocation/suspension ferme ou invalide le flux immédiatement côté serveur ; nouvelle connexion/relecture refuse. Cursor n'accorde aucun accès interclinique. SSE ne fait pas office d'archive : reconnexion relit un snapshot serveur autorisé, rejoue si fenêtre disponible, sinon resynchronisation complète. Événements dupliqués/hors ordre comparés par identifiant/révision ; aucune décision métier client induite. Si flux indisponible, lectures HTTP périodiques bornées en premier plan reprennent l'état sans perdre les messages persistés. Logout ferme connexion et caches mémoire ; aucun cache offline des travaux officiels.

Sources primaires consultées10/10/2026 : MDN EventSource https://developer.mozilla.org/en-US/docs/Web/API/EventSource et Using server-sent events https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events. Reconnexion SSE et limites HTTP/1 multi-onglets reconnues ; aucune configuration proxy/service modifiée.

## Audit applicativement immuable

Proposition audit_events append-only : auteur/compte ou processus, instant serveur, action, type/id objet, raison minimisée, révisions et différence utile (champs changés/références de version) ; pas de copies complètes patients/messages, secrets, tokens ou matériel cryptographique. Les motifs libres sensibles restent dans leur historique métier protégé plutôt que multipliés dans les logs. Seul P lit le journal global ; admin/employé/clinique ont uniquement les historiques de ressource autorisés.

Aucune API update/delete, pas de bouton purge propriétaire, pas d'audit arbitraire envoyé par le client. Futur rôle runtime : INSERT audit et lecture via interface propriétaire serveur, aucun UPDATE/DELETE/TRUNCATE ni ownership audit ; contraintes/migrations soumises à approbation administrateur. Ces droits ne sont pas installés à3.9. Accès DB exceptionnel et opérations de rétention légalement validées sont distincts, contrôlés et tracés. Ne pas qualifier ceci d'immutabilité contre root/superuser ni d'archive inviolable. Logs techniques expurgés distincts et rotation dédiée.

## Vérifications à l'implémentation

- Rollback métier → aucun événement/audit de succès ; panne fournisseur → métier préservé ; crash après commit → outbox reprise.
- Cible/rôle/email/droit révoqué avant tentative, replay interclinique, permission logistique et projection non médicale.
- Six catégories labo exactes ; pas de double nouvelle commande/retouche, décisions idempotentes, pas de mail livraison/urgence/maintenance.
- Rappel à29/30min, 24h, nouveaux messages lus/non lus, lecture partielle/complète et course worker/lecture ; pas de répétition sans nouveau message.
- SSE rupture/reconnexion/curseur périmé, multi-onglets et arrière-plan ; ordre/duplication sans doubles effets.
- Audit global owner seul, mutations audit refusées, histoire ressource filtrée, motifs/patient/phrase/code absents de logs/email/RT.

Validation3.9 : revue documentaire de cette matrice contre CDC et frontières existantes. Tests de code, fournisseur et appareils ultérieurs ; aucune affirmation de réussite d'un système non installé.
