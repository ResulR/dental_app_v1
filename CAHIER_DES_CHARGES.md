# CAHIER DES CHARGES — Plateforme de gestion d'un laboratoire dentaire

**Version :** 1.0 — 08/10/2026  
**Statut :** cadrage fonctionnel consolidé ; conformité et faisabilité à vérifier avant mise en production  
**Langue du présent document :** français. **Langue de l'application :** albanais.  
**Périmètre géographique :** laboratoire et cliniques au Kosovo.  
**Document complémentaire attendu :** `architecture.md` (à fournir séparément).  

> Ce document décrit le besoin métier et les comportements attendus. Il ne choisit pas de framework, de base de données ou d'architecture. Les éléments « à vérifier » ne doivent pas être transformés en hypothèses techniques ou en garanties réglementaires. Les fonctionnalités non prévues sont explicitement exclues.

## 1. Objectif et principes

Créer une application web privée et installable (PWA) reliant un laboratoire dentaire à ses cliniques partenaires, permettant de recevoir, valider, fabriquer, livrer et suivre des travaux dentaires ainsi que leurs échanges et pièces jointes.

Principes non négociables :

1. **Simplicité opérationnelle :** peu de clics et d'informations inutiles, interface adaptée aux tablettes et téléphones, travail quotidien prioritaire sur les statistiques.
2. **Traçabilité :** commandes, décisions, changements de statut, historiques de versions et interventions liées ne sont jamais silencieusement écrasés.
3. **Séparation des cliniques :** aucune clinique n'accède aux données d'une autre.
4. **Moindre privilège :** permissions granulaires, contrôlées côté serveur, accès aux données patient limité selon le besoin métier.
5. **Résilience :** brouillons utilisables hors ligne, transferts volumineux reprenables, stockage protégé, sauvegardes et procédures de récupération.
6. **Une seule application, deux portails :** laboratoire et clinique ; ni portail patient, ni facturation au lancement.

## 2. Acteurs et gouvernance

### 2.1 Profils

- **Propriétaire principal :** compte unique disposant du contrôle complet, sauf impossibilité de falsifier ou d'effacer l'audit. Seul lecteur du journal d'audit global.
- **Administrateurs secondaires :** comptes créés et administrés par le propriétaire ; permissions déterminées individuellement ; aucune élévation personnelle de privilèges.
- **Employés du laboratoire :** comptes individuels à permissions limitées, créés par invitation e-mail sécurisée ; pas d'attribution de commandes à un employé.
- **Clinique :** un **compte partagé par clinique**, sans comptes séparés pour dentiste ou secrétaire. Les actions attribuables à une clinique sont attribuées au compte partagé, non à un individu physique précis.

### 2.2 Gestion des comptes

- La clinique s'inscrit avec : nom de clinique, prénom et nom du dentiste de référence, e-mail, mot de passe, téléphone et adresse complète. Son inscription nécessite l'approbation du laboratoire ; aucun envoi de commande avant approbation.
- Le laboratoire peut approuver/refuser, consulter les cliniques et leurs travaux, mettre à jour leurs coordonnées selon les permissions, suspendre/réactiver et lancer une récupération d'accès. Pas de suppression permanente simple d'une clinique.
- Le propriétaire administre les administrateurs secondaires. Il peut déléguer à des administrateurs secondaires la création, la suspension/réactivation et la gestion des permissions des **employés**, dans la limite des autorisations explicitement délégables. Aucun administrateur secondaire ne gère les comptes d'autres administrateurs secondaires.
- Invitation des employés par e-mail : lien à usage unique, durée de validité bornée (durée précise à déterminer), création de mot de passe par le destinataire. Le mécanisme d'invitation des administrateurs secondaires doit suivre une sécurité équivalente.
- Suspension : révocation des sessions et refus des nouvelles opérations serveur. Les actes historiques demeurent attribuables à l'ancien compte.
- Changement d'e-mail d'une clinique : demande de la clinique, décision d'un administrateur habilité, confirmation par la nouvelle adresse avant activation ; alerte de sécurité à l'ancienne adresse.
- Compte de clinique suspect de compromission : action propriétaire « Sécuriser le compte » ; révocation de toutes les sessions, blocage temporaire, réinitialisation obligatoire du mot de passe, vérification du demandeur, sans suppression des données.
- Compte propriétaire perdu : récupération ordinaire par e-mail ; récupération technique exceptionnelle si l'e-mail est inaccessible, selon une procédure documentée vérifiant identité et autorité, révoquant les sessions et consignant l'intervention.
- Changement de propriétaire principal : **uniquement intervention technique exceptionnelle**, documentée, vérifiée et auditée ; un seul propriétaire à la fois ; aucune action de transfert dans l'interface.

### 2.3 Modèle de permissions

Permettre la configuration individuelle, sans multiplication inutile de rôles figés :

- Consultation **logistique** : numéro de commande, clinique, statut, priorité, dates et mode de livraison ; **aucune donnée patient ni instruction technique**.
- Consultation **détaillée** : données logistiques plus identification patient, dents, matériau, teinte, type et description.
- Visualisation des fichiers et téléchargement des fichiers : deux permissions distinctes, chacune exigeant aussi l'accès à la commande et aux données correspondantes.
- Lecture et réponse aux conversations **de commande** : deux permissions distinctes ; la réponse implique la lecture et l'accès à la commande.
- Lecture et réponse aux conversations **générales** : deux permissions distinctes des conversations de commande ; réponse implique lecture.
- Actions métier : accepter/refuser, demander correction, modifier instructions, démarrer fabrication, changer autres statuts, planifier livraison, modifier priorité, livrer, créer commandes pour une clinique, traiter retouches, gérer catalogue, comptes et paramètres, partager fichiers de suivi, etc., selon les besoins.
- Acceptation/refus, modification des instructions et démarrage fabrication exigent l'accès détaillé **en plus** de la permission d'action. Les actions purement logistiques peuvent être déléguées avec accès logistique.
- Une autorisation ne doit pas pouvoir être accordée si ses prérequis manquent. Le retrait d'un prérequis invalide les permissions dépendantes. Contrôles effectués par le serveur et lors de chaque téléchargement, recherche, notification et accès temps réel.
- Les utilisateurs autorisés peuvent voir toutes les commandes du laboratoire dans les limites de leurs permissions ; pas d'affectation individuelle de commande.
- La liste des destinataires d'e-mails métier est configurable **par catégorie** par le propriétaire parmi les administrateurs secondaires habilités ; propriétaire destinataire par défaut des notifications importantes. Les employés ne reçoivent pas automatiquement ces e-mails administratifs. Alertes critiques de sécurité/sauvegarde toujours transmises au propriétaire.

## 3. Référentiels et paramètres du laboratoire

- Catalogues administrables : **matériaux**, **teintes** (communes à tous les matériaux), **types de travaux** (facultatifs dans les commandes).
- Ajout, renommage/modification, activation, désactivation et suppression des références du catalogue courant, sans supprimer les valeurs historiques déjà utilisées.
- Les références supprimées ou inactives restent préservées dans les commandes, brouillons, archives et duplications préremplies : il faut distinguer référence de catalogue et valeur historique figée.
- États d'utilisation : **disponible**, **indisponible** (exception commerciale possible), **interdite pour raison de sécurité/conformité** (aucune exception d'utilisation).
- Une référence indisponible peut figurer dans un brouillon et être soumise avec avertissement. Le laboratoire peut l'accepter exceptionnellement avec justification et confirmation explicite sans la réactiver globalement.
- Une référence interdite ne peut pas servir à une nouvelle soumission ou à une acceptation ; son motif est obligatoire. Les travaux non livrés l'utilisant sont bloqués préventivement dans leur progression, mais **pas annulés automatiquement**. Le propriétaire est alerté et peut examiner tous les travaux concernés ; ceux déjà livrés sont signalés pour examen. Une interdiction réglementaire ne peut pas être contournée par un administrateur.
- Informations publiques du laboratoire dans le portail : nom, adresse, téléphone, e-mail, horaires, logo, lien de localisation/carte. Mise à jour depuis les paramètres, selon permissions.
- Aucun prix ou champ financier visible dans le portail clinique au lancement.

## 4. Formulaire de commande clinique

### 4.1 Champs

- Numéro unique attribué par le serveur à la soumission effective, date et heure de réception serveur enregistrées automatiquement.
- Identification patient : **soit prénom ET nom, soit référence interne de la clinique** ; possibilité de fournir les deux, sans exiger les deux modes. Un patient n'a pas de dossier transversal dans l'application et l'égalité des noms ne signifie pas identité commune.
- Date de livraison souhaitée **obligatoire** pour la clinique ; distincte de la date de livraison **planifiée** par le laboratoire. Les deux restent visibles, sans promesse de respect garanti de l'échéance.
- Matériau obligatoire, teinte obligatoire, et **un seul matériau + une seule teinte par commande**, communs à toutes les dents.
- Type de travail : facultatif ; description : **facultative**, même sans dents sélectionnées.
- Schéma dentaire FDI permanent à 32 dents : 11–18, 21–28, 31–38, 41–48. Premier appui : dent normale ; deuxième : pontic/« antar » ; troisième : non sélectionnée. Fonctionne au toucher sur tablette. **Aucune dent obligatoire**, aucun regroupement automatique des bridges ; expliciter au besoin dans la description.
- Si aucune dent ni description, afficher un avertissement non bloquant avant envoi : ne pas créer une obligation contredisant le choix métier.
- Pièces jointes facultatives : STL, PLY, OBJ, JPG, PNG, HEIC et PDF.

### 4.2 Limites des fichiers

- **200 Mo par fichier**.
- **1 Go cumulé pour les fichiers de la commande initiale lors de sa création** ; pas de nombre maximal arbitraire de fichiers.
- **1 Go par message** dans la messagerie, toujours dans la limite de 200 Mo par fichier ; pas de quota cumulatif fixe par conversation.
- Limites des fichiers ajoutés lors des modifications, des fichiers de suivi ou des retouches : appliquer au minimum 200 Mo/fichier, prévoir des règles de capacité cohérentes avec le stockage ; ne pas présumer une limite cumulative supplémentaire non décidée.
- Validation du type, du contenu, des droits, de la taille et de l'intégrité côté serveur ; progression, erreurs explicites, reprise sécurisée, aucune exposition par URL publique.

### 4.3 Détection des doublons

- Protection technique contre les doubles soumissions d'une même commande (idempotence).
- Avertissement **non bloquant** lorsqu'une commande semble similaire à une autre **de la même clinique** ; le dentiste peut consulter l'existante ou poursuivre. Aucune comparaison entre cliniques ni blocage fondé uniquement sur un nom de patient.

## 5. Cycle de vie des commandes

### 5.1 Statuts principaux

`En attente` → `Acceptée` → `En fabrication` → `Terminée` → `Livrée`.

Statuts particuliers : `Correction demandée`, `Refusée`, `Annulée`.

- `En attente` : soumission enregistrée, à décider manuellement par le laboratoire.
- `Correction demandée` : motif de correction obligatoire, attente d'une action du dentiste. Il corrige informations et fichiers, puis **renvoie explicitement** ; retour `En attente`, nouvelle décision manuelle du laboratoire et e-mail au laboratoire.
- `Refusée` : décision lab avec motif obligatoire, historique conservé, pas de réouverture directe.
- `Acceptée` : acceptation manuelle d'une commande venant de la clinique ; **acceptation automatique** si commande créée par le laboratoire pour une clinique existante.
- `En fabrication`, `Terminée`, `Livrée` : transitions manuelles selon permissions. `Terminée` = travail prêt, pas encore expédié/retiré. `Livrée` = travail physiquement sorti du laboratoire ou récupéré par la clinique, **sans confirmation du dentiste**.
- Le changement de statut, ses dates et son auteur sont historisés. Ne pas confondre drapeaux de blocage de sécurité et statut métier ; une commande `En fabrication` bloquée demeure dans ce statut tant qu'une action métier valide n'est pas prise.

### 5.2 Modification des commandes

- `En attente` : la clinique modifie directement formulaire, dents et fichiers, avec versions et historique. La commande reste `En attente` ; si le laboratoire lit une ancienne version, il doit recharger la dernière avant acceptation.
- `Correction demandée` : la clinique peut corriger, sans retour automatique en attente ; **renvoi explicite** nécessaire.
- `Acceptée` : la clinique peut soumettre **une demande de modification** proposant les valeurs avant/après ; l'original reste inchangé jusqu'à acceptation lab ; acceptation/refus motivé ou historisé et notifié par e-mail.
- Une seule demande de modification ou d'annulation en attente **au total par commande**. La première doit être traitée ou retirée avant une autre demande. La demande peut être retirée par la clinique avant décision, avec confirmation et historique. Une demande pendante interdit le début de fabrication et interdit au laboratoire de modifier directement les instructions ; les opérations logistiques compatibles restent possibles.
- Laboratoire : modification directe d'une commande `Acceptée` **uniquement avant fabrication**, permission adéquate, motif obligatoire, historique des versions, e-mail et notification interne à la clinique. Idem pour retouches. Une demande du dentiste pendante doit être résolue d'abord.
- Dès le début de fabrication, les instructions **et fichiers de fabrication** sont verrouillés ; ils ne peuvent plus être écrasés ou remplacés. Les ajouts documentaires de suivi sont distincts (voir §8).
- Les instructions contenues dans un message de chat ne changent jamais automatiquement la commande officielle.

### 5.3 Annulation

- Clinique : annulation **directe** avec confirmation en `En attente` et `Correction demandée` ; en `Acceptée`, demande nécessitant la décision du laboratoire ; aucune annulation directe par clinique dès `En fabrication`.
- Laboratoire : annulation directe possible jusqu'à `En fabrication` **inclus**, motif obligatoire, notification e-mail à la clinique, conservation des traces. Pas d'annulation ordinaire à `Terminée` ou `Livrée`.
- Demande d'annulation pendante bloque passage en fabrication ; retrait autorisé avant décision.
- Envoi d'une commande préremplie depuis une commande `Refusée` ou `Annulée` : **nouveau numéro**, statut `En attente`, lien de filiation, ancien historique inchangé ; revalidation de dates, référentiels et disponibilité réelle des fichiers.

### 5.4 Commandes créées au laboratoire

- Création pour une clinique **existante** par utilisateur habilité ; origine clairement indiquée « Créée par le laboratoire », avec auteur.
- Statut immédiat `Acceptée`, **sans approbation obligatoire de la clinique**.
- Envoi d'un e-mail et d'une notification interne à la clinique, avec lien privé vers la commande et sans données patient excessives.
- La clinique peut demander modification ou annulation tant que le travail est `Acceptée`, avant `En fabrication`.

### 5.5 Changement nécessaire après démarrage de fabrication

- Les instructions initiales restent verrouillées. Un utilisateur habilité crée une **nouvelle commande liée** ayant ses propres données, fichiers et numéro ; en tant que commande créée par le laboratoire, elle est immédiatement `Acceptée`.
- Deux types explicites de lien : **remplacement** (l'ancienne commande est annulée, motif obligatoire) ou **travail supplémentaire** (l'ancienne commande continue).
- Les liens sont visibles dans les deux sens ; les opérations sont atomiques autant que nécessaire pour éviter une filiation incomplète.
- L'ancien travail n'est jamais réécrit silencieusement. Si la décision implique une interdiction de sécurité, le nouveau travail doit respecter les références autorisées.

## 6. Retouches et refabrications après livraison

- Le dentiste ouvre une commande **Livrée** et sélectionne « Demander une retouche » ; possibilité de qualifier l'intervention (retouche ou refabrication).
- Nouvelle intervention liée à la **commande livrée réellement concernée**, même si cette commande est elle-même un remplacement ; traçabilité complète de la chaîne.
- Formulaire simplifié : matériau et teinte préremplis mais modifiables, **description du problème et des dents concernées obligatoire**, sans schéma dentaire, pièces jointes facultatives.
- La retouche est un travail distinct, avec numéro, conversation, historique et même workflow d'approbation, correction, modification, annulation, fabrication, livraison et verrouillage des instructions que les commandes normales.
- Nouvelle retouche signalée en priorité et e-mail au laboratoire ; acceptation/refus/correction manuels.
- **Une seule retouche active par commande livrée** ; une nouvelle devient possible quand la précédente est `Refusée`, `Annulée` ou `Livrée`. Une retouche refusée reste dans l'historique et une nouvelle demande peut être déposée sur le travail original.
- L'annulation d'une retouche ne change pas le statut du travail initial. Une commande historique annulée ou refusée ne peut pas recevoir de retouche.
- **Tarification, garantie, prise en charge et coût de retouche : hors périmètre de la version initiale ; à traiter dans la phase financière future.**

## 7. Livraison, suivi et planning

- Le laboratoire choisit le mode : **livraison par laboratoire**, **retrait par clinique**, **coursier externe**.
- Vue « Prêts à livrer » = commandes `Terminée` non encore déclarées livrées ; marquage individuel ou multi-sélection après confirmation, uniquement sur commandes éligibles.
- Date, mode et auteur de sortie du laboratoire enregistrés. La clinique ne confirme pas la livraison. Pas d'e-mail au dentiste lors de la livraison.
- Erreur de livraison : le propriétaire ou un administrateur secondaire **spécifiquement autorisé** peut exceptionnellement revenir de `Livrée` à `Terminée`, avec motif et historique. Réouverture de la conversation, annulation de l'ancien compteur d'archivage. S'il existe une retouche liée, correction automatique **bloquée** jusqu'à résolution explicite de la contradiction.
- Date souhaitée par la clinique et date planifiée par le laboratoire visibles et distinctes ; date planifiée modifiable sans approbation de la clinique, chaque changement historisé.
- Alerte d'urgence à J-2 avant la date planifiée et alerte de retard après ; à défaut, date souhaitée comme **repère provisoire**. Drapeau de priorité manuel. Les alertes de progression cessent pour les travaux clôturés (`Livrée`, `Refusée`, `Annulée`). Pas d'e-mails automatiques pour ces alertes.
- Calendrier hebdomadaire et mensuel : travail positionné sur date planifiée, sinon souhaitée (provisoire) ; ouverture détail en un clic. Glisser-déposer sur desktop pour modifier seulement date planifiée avec confirmation/annulation et trace ; édition détaillée sur mobile.
- Liste des travaux : recherche par patient (nom **ou référence**), clinique, numéro ; filtres statut, date, normal/retouche ; **pas de filtre matériau** prévu.
- Vue principale laboratoire : boîte de réception prioritaire pour nouvelles commandes, demandes de correction renvoyées, modifications, annulations, retouches et inscriptions, avec distinction entre notification lue et **action restant à traiter**. Liste simple, peu de colonnes.

## 8. Documents et fichiers

- Fichiers de fabrication : versions officielles attachées à une commande, modifiables seulement avant `En fabrication` suivant les règles métier, ensuite verrouillés ; versions retirées non disponibles comme instructions actives, éventuelle conservation selon politique légale.
- Fichiers de suivi : documents/photos ajoutés par le laboratoire, séparés des instructions, y compris pendant et après fabrication ; auteur, date, droits et conservation tracés.
- Visibilité des fichiers de suivi : **interne au laboratoire par défaut** ; un utilisateur habilité peut partager individuellement avec la clinique, après confirmation ; partage révocable pour les accès futurs, mais aucune promesse de suppression des copies déjà téléchargées.
- Chaque fichier est soumis à authentification, autorisation et isolation par clinique, sans URL publique permanente ni partage externe anonyme. Le stockage n'expose pas directement les fichiers via un répertoire web public.
- Téléchargement individuel et **ZIP de tous les fichiers autorisés de la commande**, sans contourner les droits ni conserver inutilement des archives permanentes. ZIP non destructif : contenu extrait identique aux originaux.
- Séparer juridiquement et techniquement les fichiers de commande, messagerie, suivi, transferts temporaires, brouillons et archives. Une interdiction d'accès doit aussi s'appliquer aux aperçus, noms, miniatures, moteurs de recherche et téléchargements en masse.

## 9. Messagerie temps réel

- **Une conversation générale permanente par clinique**, indépendante des commandes, possible sans commande préalable.
- **Une conversation distincte par commande**, y compris chaque retouche, accessible depuis sa fiche ; ne pas mélanger les conversations de différentes commandes.
- Interface type messagerie moderne, quasi temps réel, pièces jointes selon §4.2, compteurs de messages non lus, statuts `Envoyé` et `Lu`.
- Lecture d'une conversation partagée côté laboratoire constatée lorsqu'un utilisateur autorisé l'ouvre ; la lecture ne vaut pas traitement métier.
- Édition des messages avec indication « Modifié » et conservation des versions ; suppression apparente/masquage avec traçabilité, pas d'effacement silencieux. Un utilisateur ne réécrit pas les messages d'un autre. Les exigences légales de conservation priment.
- À `Livrée`, conversation de commande automatiquement close **en lecture seule** ; reste accessible selon permissions ; nouvelle retouche = nouvelle conversation. Conversation générale toujours active. Si livraison erronée corrigée selon §7, conversation rouverte si aucune contradiction avec une retouche existante.
- Fichiers : jusqu'à 200 Mo chacun, 1 Go par message, pas de quota cumulatif fixe par conversation ; surveillance de capacité et protection contre l'abus.
- Les messages ne remplacent jamais les demandes formelles de modification/cancellation ni les instructions officielles.
- Demandes d'accès, rectification, effacement de données : formulées par la clinique via **messagerie générale**, traitées par le propriétaire sans module dédié de tickets ; contact externe possible pour patients sans compte. La procédure interne doit garantir le traitement légal même sans outil de suivi automatisé.
- Signalement de sécurité : via messagerie générale pour cliniques ; contact direct propriétaire pour employés et administrateurs secondaires ; informations de contact disponibles sans connexion si l'application le permet.

## 10. Notifications et e-mails

### 10.1 E-mails au laboratoire

Six événements confirmés :

1. Nouvelle commande.
2. Nouvelle demande d'inscription de clinique.
3. Demande de modification.
4. Demande d'annulation.
5. Nouvelle demande de retouche.
6. Commande corrigée et renvoyée.

Destinataires choisis par le propriétaire **par événement**, parmi administrateurs secondaires habilités ; propriétaire destinataire par défaut des événements importants. Le reste apparaît dans le portail sans e-mail systématique.

### 10.2 E-mails à la clinique

- Acceptation d'une commande, demande de correction, refus, travail terminé.
- Décisions d'acceptation/refus des modifications et des demandes d'annulation.
- Annulation directe par le laboratoire, modification directe d'instructions par le laboratoire avant fabrication.
- Création d'une commande au nom de la clinique par le laboratoire (e-mail **et** notification interne).
- Notifications équivalentes des retouches lorsqu'applicables.
- **Pas d'e-mail systématique** pour nouvelle commande soumise par la clinique, entrée en fabrication, livraison, urgence interne, ou annonce de maintenance.
- Les changements d'adresse e-mail déclenchent des avis de sécurité à l'ancienne adresse suivant §2.2.

### 10.3 Messagerie non lue

- Notification temps réel si connecté.
- Rappel e-mail si conversation contient toujours des messages non lus **30 minutes** après réception.
- Pour la même période continue de non-lecture, rappel supplémentaire **au moins 24 heures après le précédent**, seulement si **de nouveaux messages** sont arrivés depuis le précédent rappel et sont restés non lus 30 minutes.
- Lecture complète réinitialise le cycle ; regrouper les arrivées proches dans un seul e-mail. Aucune donnée patient sensible dans le contenu du rappel. Appliquer les droits et destinataires pertinents pour les boîtes de messagerie partagées.

### 10.4 Fiabilité

- Une transaction métier réussie ne dépend jamais de l'envoi immédiat d'un e-mail.
- Envois en attente, acceptés par le fournisseur, échoués ; relances automatiques progressives, possibilité de consultation et de relance manuelle par le propriétaire.
- Éviter les doublons autant que possible ; un statut `Envoyé` ne garantit ni réception ni lecture.
- Réévaluer l'utilité d'une notification avant un envoi très tardif lorsque son action a déjà été traitée.
- Alertes techniques critiques indépendantes des e-mails métier, propriétaire systématiquement destinataire.

## 11. PWA, connexion, brouillons et travail hors ligne

- PWA installable et responsive : smartphone, tablette (usage principal) et ordinateur. Interface exclusivement en albanais ; dates `JJ/MM/AAAA`, fuseau `Europe/Pristina` ; labels techniques de matériaux/teintes conservés.
- Connexion par e-mail/mot de passe ; **pas de 2FA obligatoire** retenue. Mots de passe protégés, limitation des tentatives, anti-abus, cookies/sessions sûrs, possibilité de sessions simultanées et de révocation ; authentification persistante avec renouvellement sécurisé, non « connexion éternelle ».
- Préparation **hors ligne de brouillons complets**, fichiers inclus, avec données de catalogue précédemment chargées ; pas d'envoi officiel hors connexion.
- Protection forte du stockage local des brouillons, déverrouillage local supplémentaire et isolation par compte ; chiffrage effectif à concevoir et tester sur les navigateurs visés, sans présumer que les protections de la PWA suffisent.
- Déconnexion volontaire : conserver les brouillons locaux protégés, accessibles uniquement au retour du **même compte** et après déverrouillage.
- Suspension du compte hors ligne : impossibilité de révoquer immédiatement les données sur un appareil déconnecté ; à la reconnexion, refuser l'accès et demander la purge locale des brouillons/fichiers associés au compte suspendu, **au mieux des possibilités du système**. Pas de garantie d'effacement forensic à distance.
- Brouillons synchronisés sur serveur pour reprise multi-appareils, sans envoi automatique. Détecter versions divergentes : permettre de prendre la version serveur **ou** conserver la version locale sous un nouveau brouillon, pièces jointes comprises. Pas d'écrasement silencieux. Avertir avant abandon éventuel d'une version locale.
- Brouillons supprimables manuellement ; pas de purge par âge des brouillons **métier** demandée, sous réserve des obligations de minimisation/rétention à valider. Les transferts temporaires expirés suivent une règle de nettoyage **distincte**.
- Reconnexion : mise à jour du catalogue, contrôles métier, avertissements pour références indisponibles, refus des références interdites ; le dentiste valide toujours explicitement la soumission.
- Ordre recommandé : transferts temporaires vérifiés, confirmation finale, enregistrement serveur unique/atomique de la commande, acquittement ; conserver le brouillon local jusqu'à confirmation certaine.
- Les commandes **déjà officiellement envoyées** et leurs pièces jointes ne sont pas conservées automatiquement hors ligne dans la PWA. Consultation de leurs fichiers via connexion au serveur. Les fichiers téléchargés volontairement dans le système d'exploitation restent hors contrôle de l'application.

## 12. Transferts volumineux, quotas et saturation

- Transferts par portions avec reprise des segments déjà reçus et vérifiés tant que les données temporaires existent ; reprise après coupure réseau ou interruption liée au manque d'espace ; progression visible.
- Aucune commande officielle créée en double après reconnexion ; confirmation finale explicite.
- Refus temporaire des nouveaux transferts à l'approche d'une **réserve de stockage de sécurité** ; alertes préventives au propriétaire, message explicite aux utilisateurs ; consultation des données existantes préservée dans la mesure où le service reste fonctionnel.
- Les portions temporaires interrompues sont gardées dans des **limites bornées en durée et capacité**, puis nettoyées si expirées. Les brouillons locaux ne sont pas détruits par cette opération.
- Protection de la base de données, du système, des autres sites/services du VPS et des sauvegardes ; surveillance indépendante de l'application, car une panne disque peut rendre le portail indisponible.
- Afficher l'espace occupé et capacité disponible réelle dans l'administration ; seuils, politique de nettoyage temporaire, dimensionnement, éventuel stockage déporté : **à fixer après audit du VPS et de `architecture.md`**.
- Aucune purge automatique des fichiers déjà attachés à des travaux pour résoudre un manque d'espace.

## 13. Vues et ergonomie

### 13.1 Portail laboratoire

- Accueil prioritaire orienté **actions à traiter**, distinct des notifications lues : commandes à décider, demandes de modification, annulation, retouches, corrections renvoyées, inscriptions, alertes importantes.
- Liste Travaux, filtres et recherche (§7), fiche de commande claire : informations, schéma dentaire, pièces jointes, conversation, historique, décisions disponibles et liens vers travaux liés.
- Vue des travaux prêts à livrer, calendrier, fiches cliniques avec coordonnées/historique/conversation générale, messagerie unifiée et compteurs non lus.
- Paramètres : gestion des référentiels, informations du laboratoire, utilisateurs/permissions, destinataires d'e-mails, annonces de maintenance, stockage. Journal d'audit intégral et incidents d'envoi accessibles au propriétaire.
- Pas de tableaux de bord financiers ni surabondance de métriques.

### 13.2 Portail clinique

- Inscription / attente de validation, connexion et récupération de mot de passe.
- Création et consultation des commandes, brouillons synchronisés et hors ligne, suivi des statuts et dates, modifications/corrections/annulations selon conditions, duplications de commandes refusées/annulées, retouches depuis travaux livrés.
- Conversations générales et par travail, fichiers autorisés, notifications, coordonnées du laboratoire, documents légaux.
- Interface optimisée tactile et en albanais, indication claire des opérations nécessitant une connexion.

## 14. Archivage et protection des données

- Une commande `Livrée` est **automatiquement archivée 30 jours après la livraison effective**. Ce délai est une règle d'**organisation de l'interface**, non une durée légale de conservation.
- Archives consultables et recherchables par utilisateurs habilités ; statut `Livrée` inchangé, pièces jointes, conversations et historique préservés selon leurs règles de conservation. Une retouche peut être initiée depuis une commande livrée archivée.
- Correction exceptionnelle de livraison : annuler l'échéance d'archivage en cours ; repartir de la livraison réelle suivante.
- En fin de durée légale ou contractuellement justifiée, les données concernées sont **signalées au propriétaire** avant effacement ou anonymisation, sous réserve d'exceptions légales (litige, traçabilité, obligation de conservation). Historiser les décisions sans conserver indûment les données à supprimer.
- Distinguer les durées par catégories : commandes, documents médicaux et pièces jointes, conversations, sauvegardes, brouillons locaux/serveur, fichiers temporaires et audits. **Aucune durée légale universelle n'est présumée ici.**
- Sauvegardes : conservation décidée de **30 jours**, avec une politique de rotation compatible avec RPO et restauration ; gestion des suppressions légitimes après restauration (éviter la réapparition durable de données effacées).
- Droit des personnes : procédure hors application possible pour les patients ; demandes des cliniques via messagerie générale, sans formulaire ni suivi de tickets spécifiques. Identité, autorité, fondement et délais applicables doivent être gérés selon une procédure interne.
- Usages autorisés des données patients : fabrication, suivi des commandes, communication professionnelle, retouches, traçabilité nécessaire ; pas d'utilisation marketing ou revente.

## 15. Sécurité, journal d'audit et incidents

- Auditer les **actions importantes** : créations/acceptations/refus, modifications de versions, décisions, annulations, retouches, livraisons et corrections de livraison ; comptes, permissions, suspensions et reprises d'accès ; catalogues et interdictions ; authentifications sensibles ; paramètres, activation/désactivation maintenance, interventions techniques exceptionnelles.
- Chaque événement : auteur/compte ou processus, horodatage, action, identifiant d'objet, motif et différence utile sans enregistrer inutilement des données médicales ou secrets.
- **Seul le propriétaire** consulte le journal d'audit global ; ni employés, ni administrateurs secondaires. Aucun utilisateur ne peut le modifier ou le purger librement via l'interface. Les historiques métier de commandes restent visibles selon droits.
- Sécuriser les fichiers téléchargés, les API, les échanges temps réel, les exports, les recherches, l'affichage des noms de patients et les aperçus. Pas de stockage direct public des pièces jointes.
- Incidents : signalement via messagerie générale (clinique) ou contact direct propriétaire (personnel) ; procédure de réponse, révocation de sessions, conservation de preuves, analyse des impacts et obligations de notification **à vérifier**.
- Une seule identité partagée par clinique ne permet pas d'attribuer avec certitude une action à un dentiste précis. **Risque accepté fonctionnellement**, à signaler au laboratoire et au conseil juridique ; pas de promesse d'audit individuel interne à une clinique.
- Le choix de ne pas imposer de 2FA ne doit pas conduire à affaiblir les comptes propriétaires : protections compensatoires, alertes de connexion, révocation et récupération encadrée à valider.

## 16. Continuité, sauvegardes, maintenance

- Objectifs demandés : **RPO maximum 1 heure** ; **RTO cible 4 heures**. Ce sont des objectifs, **pas des garanties** sans validation du plan d'infrastructure, tests de restauration et prise en compte des fichiers volumineux.
- Sauvegardes automatiques, chiffrées, hors VPS, cohérentes entre base de données et pièces jointes, rétention 30 jours, restauration testée régulièrement ; les seuls brouillons locaux non synchronisés ne sont pas couverts.
- Surveillance stockage/état des services indépendante si possible ; alertes critiques au propriétaire.
- Mode maintenance activable/désactivable par le propriétaire : blocage des opérations serveur, message clair pour utilisateurs, possibilité technique de sortie d'urgence si le portail ne fonctionne pas. Les brouillons locaux restent préparables ; aucune synchronisation pendant maintenance.
- Annonce préalable facultative via **bandeau dans l'application**, date/heure en heure locale ; **pas d'e-mail** ; annonce ne déclenche pas automatiquement maintenance. Maintenance urgente sans préavis possible.
- Distinguer panne réseau/serveur du mode maintenance volontaire, sans afficher de fausse annonce.
- Toute mise à jour ordinaire devrait viser l'absence d'interruption, lorsque l'architecture le permet.

## 17. Documents légaux et conformité

Documents à intégrer en albanais :

1. Politique de confidentialité.
2. Conditions d'utilisation professionnelles.
3. Informations légales du laboratoire.

Accessibilité avant ou après authentification selon besoin ; acceptation des conditions applicables lors de l'inscription, preuve de version et date ; nouvelle acceptation si nécessaire après changement important. Textes à faire valider par des professionnels compétents **avant production**.

**Contexte juridique à examiner, sans conclusion de conformité à ce stade :**

- Loi kosovare **n° 06/L-082 sur la protection des données personnelles**, applicable au traitement et à la protection des données personnelles ; autorité : Information and Privacy Agency (AIP).
- Rôles réels des cliniques et du laboratoire dans les traitements (responsable, sous-traitant, responsabilités potentiellement propres), base juridique, données de santé et mesures renforcées, contrats nécessaires.
- Localisation réelle du VPS, de l'e-mail et des sauvegardes ; transferts internationaux éventuels et conditions applicables.
- Droits des personnes et procédures de traitement des demandes ; délais légaux à confirmer à partir du texte et des circonstances, sans les coder arbitrairement dans cette spécification.
- Obligations de conservation, sécurité, notification des incidents, traçabilité des **dispositifs médicaux dentaires sur mesure** et éventuelles exigences sectorielles : examiner les textes kosovars pertinents et leurs versions à jour, notamment loi n° 04/L-190 et ses amendements, avec conseil local qualifié.
- La conservation indéfinie des brouillons ou de documents médicaux doit être réexaminée au regard de la minimisation des données ; les décisions ergonomiques ne peuvent l'emporter sur les obligations de protection des données.

Sources de vérification :
- Agence kosovare d'information et de protection de la vie privée : https://aip.rks-gov.net/personal-data-protection/legislation/
- Journal officiel, loi 06/L-082 : https://gzk.rks-gov.net/ActDetail.aspx?ActID=18616&langid=2
- Journal officiel, loi 04/L-190 relative aux produits et dispositifs médicaux : https://gzk.rks-gov.net/ActDetail.aspx?ActID=9437&langid=2

## 18. Hors périmètre et exclusions

- **Finance reportée volontairement :** prix par dent/matériau, devis, tarification, factures, paiements, suivi des sommes dues, marges, tableaux de bord financiers, gestion des garanties et prix des retouches.
- Aucun espace patient, aucune base de dossiers patient transversale, aucune intégration médicale externe décidée.
- Aucun compte individuel dentiste/secrétaire au sein d'une clinique ; un seul compte partagé par clinique.
- Aucun système d'affectation des commandes aux employés.
- Pas d'e-mails pour toutes les actions, pas de chat entre cliniques, pas de partage de fichiers par liens publics, pas de transfert de propriété depuis le portail.
- Pas de fonctionnalité imposant de remplir description ou dents lorsque les deux sont vides ; avertissement non bloquant seulement.
- Pas de multi-matériau ou multi-teinte par commande ; envoyer plusieurs commandes si nécessaire.
- Pas de promesse de consultation des modèles 3D sans possibilité technique d'en copier les octets.
- Pas de suppression automatique de fichiers historiques pour dégager de l'espace.

## 19. Audit transversal : conclusions et arbitrages de cohérence

Les règles suivantes explicitent les interactions entre décisions antérieures, **sans modifier les décisions métier validées** :

| Sujet | Règle consolidée |
|---|---|
| Demande pendante | Une seule modification **ou** annulation à la fois ; pas de démarrage fabrication ; pas de modification directe des instructions par le laboratoire avant décision/retrait. |
| Commande en attente modifiée | Dernière version soumise visible ; acceptation d'une version obsolète interdite. |
| Correction demandée | Distincte d'`En attente` ; retour seulement après renvoi explicite. |
| Travail commencé | Instructions et fichiers verrouillés ; nouveau travail lié de remplacement ou supplémentaire. |
| Livraison erronée | Retour exceptionnel à `Terminée` ; vérifier absence de retouche contradictoire. |
| Référence supprimée | Non proposée dans le catalogue courant, mais valeurs figées historiques et brouillons préservés. |
| Référence indisponible | Soumission possible avec avertissement ; acceptation exceptionnelle avec motif. |
| Référence interdite | Soumission/acceptation impossible ; blocage préventif des travaux non livrés, sans annulation automatique ; examen des travaux livrés. |
| Rétention versus archivage | 30 jours **avant archivage UI** ≠ durée de conservation ; fin de rétention signalée au propriétaire pour décision légalement encadrée. |
| Téléchargement ZIP | Identiques permissions que le téléchargement individuel ; inclusion sélective automatique des seuls fichiers autorisés. |
| PWA hors ligne | Brouillons seulement ; aucune promesse d'effacement ou de révocation instantanée sur appareil sans connexion. |
| Compte de clinique partagé | Confidentialité par clinique assurée, mais responsabilité individuelle des membres de la clinique non identifiable techniquement. |

### 19.1 Points non bloquants pour la rédaction, mais à vérifier avant implémentation ou production

**Validation métier avec le laboratoire (ciblée, sans nouvelle longue phase de cadrage) :**

- Motifs / procédure interne de refus, corrections et annulations ; formulations albanaises exactes.
- Traitement pratique des demandes de retouche **sans prix ni garantie** dans la version initiale.
- Confirmation du fonctionnement opérationnel avec patient identifié uniquement par référence et avec commandes sans dents/description ; ces choix sont **validés** mais impliquent un risque de dossier incomplet.
- Qui est habilité à décider une mesure sur matériau interdit ou sur une commande livrée concernée, sous réserve des prescriptions légales et de la responsabilité du laboratoire.

**Vérifications techniques obligatoires :**

- Audit du VPS existant, volumes/disques, services et autres applications, capacité d'extension, confidentialité des autres sites.
- Faisabilité éprouvée du chiffrement et déverrouillage local des brouillons PWA selon les navigateurs/appareils réellement utilisés ; gestion de l'expiration des espaces temporaires, des quotas navigateurs et des pertes de stockage local.
- Faisabilité de la reprise d'upload des fragments et fichiers jusqu'à 1 Go par commande, gestion du ZIP, contrôle antivirus/fichiers malveillants, monitoring et contraintes de coût.
- Conception et tests des sauvegardes incluant gros fichiers, RPO 1h / RTO 4h, indépendance des alertes et restauration depuis un incident complet.
- Sécurité des sessions persistantes et procédure d'intervention technique exceptionnelle sur le propriétaire.

**Validation juridique/professionnelle avant production :**

- Qualifications des acteurs dans le traitement des données, droits d'accès et de rectification, consentements/accords si requis et clauses contractuelles.
- Hébergement et transferts internationaux éventuels ; sécurité du prestataire e-mail et sauvegardes.
- Durées exactes par catégorie de données, conservation des versions médicales, anonymisation, effacement, demandes patient, incidents et notifications.
- Exigences de traçabilité et obligations relatives aux dispositifs dentaires sur mesure, y compris les retraits/interdictions de sécurité.

### 19.2 Règles de conception à ne pas confondre avec des exigences nouvellement validées

- Les seuils de stockage, durées de conservation des uploads temporaires, durée d'expiration des invitations et cadence des tests de restauration sont **des paramètres à déterminer**, et non des chiffres approuvés.
- Les libellés exacts et le design des pages devront suivre une conception UI simplifiée ultérieure, sans changer les workflows.
- La mise en œuvre technique peut proposer des garanties meilleures que les exigences ci-dessus, mais ne doit **pas** ajouter de validation clinique obligatoire, de 2FA obligatoire, de module financier ou de suppression automatique de commandes sans nouvel accord.

## 20. Critères d'acceptation fonctionnels

La version initiale est fonctionnellement recevable si, au minimum :

1. Une clinique peut s'inscrire, être approuvée, se connecter et soumettre une commande complète avec ou sans sélection de dents, et avec patient identifié par nom/prénom ou référence.
2. Deux cliniques ne peuvent consulter ni deviner les données ou fichiers l'une de l'autre, y compris dans la messagerie, les téléchargements et les recherches.
3. Le laboratoire traite une commande de `En attente` à `Livrée` et peut demander une correction avant acceptation ; toutes les dates et décisions restent traçables.
4. Les corrections directes avant acceptation et les modifications soumises après acceptation respectent l'historique et les verrouillages concurrentiels.
5. Les règles d'annulation, retrait des demandes, duplications, commandes créées par le laboratoire et retouches se comportent selon §§5–6.
6. Les instructions/fichiers de fabrication restent verrouillés après le début de fabrication ; un remplacement crée bien une commande liée sans réécriture de l'ancienne.
7. Les permissions logistiques/détaillées, visualisation/téléchargement, lecture/réponse et actions métier sont effectivement contrôlées côté serveur.
8. Les e-mails et rappels respectent leur matrice de destinataires, leurs déclencheurs et leur politique de relance ; les actions métier survivent à une panne d'e-mail.
9. Les brouillons hors ligne conservent informations et fichiers, exigent un déverrouillage adéquat, détectent les conflits, et ne soumettent jamais automatiquement une commande.
10. Un transfert interrompu peut reprendre sans doublon tant que les fragments existent ; les limites de taille et seuils de sécurité sont appliqués.
11. Une référence interdite empêche effectivement une nouvelle fabrication et signale/bloque les commandes actives concernées ; une référence simplement indisponible conserve le parcours d'exception validé.
12. La livraison groupée, sa correction exceptionnelle, le calendrier, l'archivage à J+30 et les conversations clôturées/réouvertes restent cohérents.
13. Les alertes de stockage et de sauvegarde, le mode maintenance et les procédures de reprise sont testés dans l'environnement effectivement retenu.
14. Les validations légales et professionnelles ont été réalisées et documentées avant de traiter des données réelles de patients.

## 21. Utilisation du document pour la roadmap

Ce cahier des charges est la **source des exigences métier**. `architecture.md` est la **source des décisions d'architecture**. La future roadmap doit confronter les deux, vérifier l'état réel du code/serveur avant intervention, identifier dépendances, tests et critères de validation, puis découper en unités petites et vérifiables. Elle ne doit ni supposer que le projet technique existe déjà, ni inventer des fonctionnalités non validées.

**Aucun déploiement en production avec données patients réelles tant que les points de conformité et de sécurité signalés ici ne sont pas vérifiés.**
