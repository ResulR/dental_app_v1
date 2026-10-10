# 4.9 — Messagerie
Sources CDC§§9–10, droits3.3 et ../models/events-notifications-audit.md.
Indépendant FDI : aucun schéma nécessaire ; messages ne changent jamais instructions.

## Navigation et contexte
H49-01 réversible : liste des conversations puis écran conversation sur mobile, deux panneaux seulement si place suffisante. Retour à liste conserve sélection/position, contexte toujours au-dessus de la saisie.
Une conversation générale permanente par clinique, possible sans commande, libellé Général + clinique. Une par travail/retouche : numéro + clinique + statut. Pas transfert de texte ou fichiers entre conversations au changement ; préparation locale en mémoire rattachée explicitement à conversation, pas cache offline de messages officiels.
Vue unifiée non-lus triés sans croiser scopes ni déduire accès d'un badge. Lecture/réponse générales indépendantes de lecture/réponse travail, fichiers grants distincts. Supprimer champs de saisie pour lecteur seul, expliquer lecture seule ; aucun accès par URL devinée.

## Messages et actions
Entête fixe dans flux normal (pas masquage mobile), liste chronologique auteur/côté/date EuropePristina, états texte En cours d'envoi / Envoyé / Échec / Lu. Envoyé=serveur persistant, pas preuve lecture ; lu=curseur côté destinataire autorisé ouvert, pas aperçu ou événement RT. Mention lecture partagée côté labo, pas identité physique certaine.
Ouverture marque lu jusqu'à messages effectivement ouverts ; nouvelles arrivées au-delà restent non lues. « Nouveaux messages » permet rejoindre bas sans déplacer lecture en cours. role/status discret, annonces groupées ; pas annonce agressive de tout contenu.
Message propre : Modifier crée version mention Modifié et historique autorisé ; Masquer demande confirmation, texte remplacé « Message masqué », traces préservées. Aucune édition d'autrui ni effacement silencieux.
Fichiers facultatifs200Mo/fichier et1Go/message, compteur cumulatif message seulement ; progression/retour erreurs4.11, pas quota arbitraire conversation.
Composeur : texte visible, pièces, bouton Envoyer nommé ; H49-02 Enter garde saut ligne, envoi bouton (pas double envoyé involontaire tactile/clavier). Aucune promesse de chiffrement bout-à-bout messagerie serveur.
Échec/timeout : conserver préparation en mémoire, état inconnu/réessayer avec même intention, ne pas marquer envoyé avant reçu. Droits retirés : fermer conversation/retirer contenu, refus serveur.

## États
Livrée : conversation travail lecture seule, saisie retirée, raison affichée ; générale active, retouche a nouvelle conversation. Refusée/Annulée ne créent pas clôture additionnelle inventée.
Correction livraison exceptionnelle sans contradiction retouche rouvre conversation, trace ; pas action utilisateur standard dans messagerie.
Perte RT : bannière reconnexion, relire état autorisé ; messages persistés serveur conservés, pas « hors ligne prêt à envoyer ». Offline : pas accès travaux/messages officiels depuis cache, localdraftsseulement4.12.
Demandes de confidentialité clinique et signalements via générale, propriétaire traite ; pas module tickets inventé.
Rappels mails : après30min non-lu, supplémentaire≥24h et nouveaux messages restés non-lus30min ; Lu complet réinitialise, Lu partiel non. Affichage ne promet pas notification e-mail immédiate.

## Parcours revus
Générale sans commande → composeur autorisé → envoyé → ouverture côté labo=Lu mais action commande inchangée.
Commande A → retour liste → retouche B : titres/conversations/fichiers distincts.
Travail livré → historique lisible, aucune réponse ; générale reste active.
Erreur transfert/message : jamais succès fictif ; reprendre intention autorisée.
Prototypes inertes, aucun SSE/envoi/grant/test navigateur opérationnel prétendu. Recette clavier/mobile/lecteur, contrats/permissions et reprise temps réel aux gates correspondantes.
