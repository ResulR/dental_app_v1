# Récupération exceptionnelle du propriétaire — point 7.14

**Statut : procédure préparée ; simulation opérationnelle non exécutée.** Références : CDC §2.2/15, modèles accounts-clinics et events-notifications-audit, PASSWORD_RECOVERY.md, OWNER_PROTECTION.md, CONSIGNE.md. Ce document n'autorise aucune commande privilégiée ni aucun changement réel.

## Objet et limites

Restituer l'accès au **même propriétaire, même account_id, même owner_slot**, lorsque son adresse e-mail est inaccessible. Si l'adresse reste accessible et non compromise, utiliser d'abord la récupération ordinaire 7.7 ; ne pas déclencher une intervention technique de confort. Un changement de personne propriétaire relève de 7.15 et ne peut pas être déguisé en récupération.

Aucune route publique/administrateur, mot de passe maître, compte de secours permanent, paramètre d'environnement de bypass, écriture SQL depuis le compte dental-ai ou accès aux clés du coffre R15. Le fait de contrôler le VPS ou une adresse nouvelle ne démontre pas l'autorité du demandeur sur le laboratoire.

## Dossier d'intervention et vérification humaine

1. Ouvrir un dossier privé avec référence opaque, horodatage, compte cible, motif de perte d'accès, demandeur, vérificateur et opérateur technique. Ne placer dans Git/chat/logs ni pièce d'identité ni secret. L'audit applicatif conserve seulement référence et résultat utile ; preuves d'autorité conservées séparément avec accès et rétention à faire valider.
2. Vérifier l'identité et le pouvoir du demandeur par un canal indépendant déjà établi avec le laboratoire et des pièces/preuves contrôlées par la personne responsable. Ne pas se fier uniquement à un e-mail entrant, une session suspecte, un document envoyé au dernier moment ou la possession de l'accès hébergeur.
3. Nommer le vérificateur et l'opérateur autorisés, documenter la méthode et le résultat avant toute mutation. Les personnes et preuves acceptables ne sont pas connues dans le dépôt : elles doivent être arrêtées pour l'intervention concrète. Autorité contestée, justificatifs insuffisants ou impossibilité de vérification indépendante = arrêt, aucune restauration d'accès.
4. Confirmer la maîtrise de la nouvelle adresse de récupération, son unicité et le destinataire. Ne pas envoyer une preuve secrète à l'ancienne boîte potentiellement compromise. Une simple notification de sécurité à l'ancienne adresse peut être prévue selon l'incident, sans token ni nouvelle donnée sensible.
5. Faire approuver **cette intervention précise** : cible, référence, adresse vérifiée via canal privé, effets, outil versionné et empreinte, opérateur, fenêtre et plan de reprise. L'accord de développer le projet n'est pas cette approbation.

## Préparation technique avant approbation d'exécution

Auditer sous identité permise l'état réel du dépôt/schéma et le propriétaire courant, sans publier ses coordonnées. Préparer un artefact d'intervention borné à dental_lab et à ce compte, avec préconditions explicites, arrêt à l'erreur, timeouts et résultat expurgé. Il doit être revu et rendu non modifiable par dental-ai avant toute exécution privilégiée. Aucun script éditable du dépôt exécuté comme root/postgres ; aucune délégation durable créée pour faciliter cette procédure.

Ne pas réutiliser aveuglément le lanceur de migrations pour une opération de compte : il gère des versions SQL approuvées, pas une interface de récupération. Le mécanisme et l'identité d'exécution de cette intervention ponctuelle restent à concevoir/approuver après audit des privilèges. Aucune commande prête à lancer n'est fournie tant que ces dépendances manquent.

Vérifier sauvegarde pertinente et capacité de reprise sans restaurer le cluster partagé. Préserver les preuves d'incident. La préparation ne nécessite aucune lecture de données patients ou d'autres applications.

## Contrat atomique de l'intervention à implémenter

Sous transaction et verrous cohérents avec les futurs adapters d'identité :

- Relire owner_slot, compte/profil et révision attendue ; exiger le même propriétaire confirmé. Un changement concurrent de slot, d'epoch ou d'adresse impose arrêt et réaudit, jamais écrasement.
- Conserver account_id, profil, slot, attributions historiques, travaux, cliniques et droits des autres comptes.
- Si nécessaire, remplacer uniquement l'adresse par celle vérifiée, avec emailKey existant et contrainte d'unicité ; aucune fusion/alias fournisseur.
- Incrémenter auth_epoch, révoquer toutes les sessions et tous les challenges de reprise encore utilisables du compte dans le même engagement. Ne pas ressusciter de token ancien.
- Exiger un nouveau mot de passe choisi par le propriétaire via le mécanisme de challenge borné/unique 7.7 adapté et testé ; ne pas envoyer ni définir un mot de passe connu de l'opérateur. Le password_hash final utilise le mécanisme versionné existant. L'ancien mot de passe ne doit plus permettre une connexion pendant ou après la récupération.
- Le passage de security_locked à un état permettant ce challenge est une décision explicite après vérification de l'incident, jamais un effet implicite du reset ordinaire. credential_reset_required reste actif jusqu'à consommation réussie. La cohérence de ces états et l'admission du challenge doivent être éprouvées avant exécution ; ne pas simplement lever tous les flags.
- Consigner une intervention technique attribuée à un processus identifié, référence du dossier, instant serveur, objet compte, motif expurgé, révision et changements utiles ; aucun secret/hash/token/pièce justificative dans l'audit.
- Enregistrer l'intention de notification de sécurité dans une outbox privée appropriée, puis envoyer après commit. Aucun envoi sensible avant transaction réussie ; une panne d'e-mail après commit ne doit pas annuler silencieusement l'intervention.

L'outil concret devra résoudre et tester toutes ces conditions avant approbation. En cas d'échec de l'audit durable, de collision e-mail ou de révision obsolète : transaction annulée et aucune preuve de succès. Pas de connexion automatique après reset ; nouvelle authentification obligatoire.

## Résultat incertain et contrôles après intervention

Si la réponse est interrompue, ne pas relancer : vérifier le processus exact et rapprocher dossier/audit, révision, epoch et état du challenge sans afficher de secret. État engagé confirmé = poursuivre les contrôles ; rollback confirmé = nouvelle revue avant nouvelle tentative ; état indéterminé = arrêt et investigation. Ne pas supprimer de preuve ni réutiliser automatiquement la même opération.

Contrôler l'unicité et le slot inchangés, anciens mot de passe/sessions/challenges rejetés, seul nouveau challenge valide, jeton expiré/rejoué refusé, nouveau login possible après reset, audit global accessible au seul propriétaire actuel. Tester fermeture/refus SSE et absence de mutation des autres comptes et historiques. Une restauration de sauvegarde ne doit pas réactiver des sessions ou tokens compromis : la traiter comme une intervention séparée avec révocation conservée.

Informer le propriétaire par le canal privé vérifié ; clôturer le dossier avec résultats réels, éventuels échecs d'envoi et reprise exacte. Conserver les exigences de sauvegarde et de preuve sans prétendre à une immutabilité contre l'administrateur système.

## Simulation encadrée à réaliser avant réception

Uniquement identités fictives, environnement autorisé dédié au projet, aucune donnée médicale ; scénario nominal et refus avec preuves expurgées. Aucun essai privilégié réalisé par l'IA. Une revue de ce tableau n'est pas une simulation exécutée.

| Scénario | Résultat attendu |
|---|---|
| Adresse initiale accessible | Utiliser 7.7, aucune intervention exceptionnelle |
| Identité/autorité non vérifiées ou conflit de propriété | Arrêt avant mutation |
| Compte cible admin/employé/clinique ou slot changé | Refus ; aucun transfert |
| Nouvelle adresse déjà utilisée ou révision obsolète | Rollback complet |
| Vérification complète, même propriétaire, artefact approuvé | Mutation atomique limitée, reset obligatoire, sessions révoquées, audit |
| Audit indisponible ou panne avant commit | Aucun succès, aucune modification partielle |
| Commit réussi puis réponse perdue | Rapprochement par référence, aucun rejeu aveugle |
| Panne de fournisseur après commit | Intervention conservée, notification suivie/reprise |
| Ancien mot de passe/session/token ou challenge rejoué/expiré | Refus serveur, aucun rétablissement de droits |
| Tentative de récupération via HTTP/compte admin | Aucun mécanisme exceptionnel exposé |
| Autres comptes, historique, coffre R15 | Préservés ; aucun déchiffrement par l'opérateur |

Pour chaque cas : référence d'essai, SHA du code et de l'outil d'intervention, versions de schéma reçues, opérateur/vérificateur, date/fuseau, résultat attendu/observé, preuve de rollback/nettoyage et absence de sessions résiduelles. Aucun cas marqué réussi dans cette version.

## Dépendances et porte de réception

- 7.7 : schéma challenges, adapters atomiques, transport sûr, outbox chiffrée et notice encore absents ; aucune simulation réelle de reset exceptionnel possible aujourd'hui.
- 0010/0011 et réception du lot6 nécessaires à l'exécution applicative ; 0008 audit non appliquée. Les listes changed_fields de 0008 et le writer applicatif 5.8 ne couvrent pas encore tous les changements de credential/epoch/flags de cette procédure. Préparer une évolution versionnée ciblée et son approbation avant usage ; ne pas modifier silencieusement la migration historique.
- Mécanisme ponctuel d'intervention, désignation humaine, contrôle d'autorité et preuve de nouvelle adresse à finaliser pour un cas concret. Ce document ne désigne personne arbitrairement.
- Simulation PostgreSQL/API/navigateur/SSE et notification à exécuter après ces prérequis. Les tests hors ligne de 7.13 refusent déjà l'action owner.recover_exceptional dans le portail, mais ne prouvent pas une intervention technique.

**7.14 reste préparé, non réceptionné**, jusqu'à simulation encadrée et validation de l'opérateur responsable. Poursuivre les travaux indépendants sans installer de porte dérobée.
