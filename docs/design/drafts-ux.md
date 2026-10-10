# 4.12 — Brouillons et coffre
Sources CDC§11/R15/12 ; ../models/drafts-sync.md, ADR0003.
Conception indépendante du tactile FDI et des primitives navigateur : validation effective coffre/PWA non levée.

## Liste et préparation
H412-01 réversible : liste titre sûr/draft/dernière sauvegarde et badges explicites Local seulement / Synchronisé / Modifié localement / Conflit / Verrouillé. Aucune annonce sauvegardé avant transaction réussie. Révision serveur et local distinctes, pas arbitrage par horloge appareil.
Bandeau Hors ligne : préparer brouillons et fichiers chiffrés, catalogue précédemment chargé ; pas messages/travaux officiels ni bouton envoi autorisé. Catalogue non chargé : expliquer indisponibilité, ne pas inventer valeurs. Même compte seulement, aucune donnée en clair avant déverrouillage.
Connexion conservée connue hors ligne ≠ vérification suspension à distance. Après logout, retour même compte avec authentification en ligne puis unlock distinct. Logout conserve chiffrement, ferme clés mémoire/caches ; autre compte ne voit pas contenu/badges identifiants sensibles.
Chargement/quota/cryptoerror : texte cause sûre, ancien état conservé, aucune sauvegarde fictive. Pas purge brouillons métier par âge. Suppression manuelle demande confirmation local/serveur et signale conflits/tombstone.
Fichiers inclus chiffrés par portions ; progression préparation locale distincte d'upload4.11, erreur quota refuse nouvel ajout sans perdre ancienbrouillon.

## Initialisation et R15
Écran explique cette arka sur cet appareil, phrase différente du mot de passe connexion. Saisie/confirmation traitées localement ; code aléatoire généré seulement implémentation, écran remise privé, confirmer conservation sûre.
Aucun code/phrase/clés vers serveur, URL, logs, capture diagnostic, analytics, messages interonglets. Maquette ne génère ou affiche aucun vrai code ; champs désactivés.
Limites avant confirmation : phrase+code perdus = local irrécupérable ; appareil/navigateur/stockage perdu = secrets ne recréent pas données absentes ; serveur réellement synchronisé reste accessible par authordinaire. Pas sauvegarde automatique/coffresync ou récupération admin.
Récupérer avec code : même compte et stockage intact, définir/confirmer nouvelle phrase, rewrapper même clé conformément3.8 ; atomicité IndexedDBettestmanifeste, interruption conserve ancienneenveloppe. Ne pas présenter resetlogin comme unlock.
Appareil sans supportcrypto/IndexedDB : erreur explicite, aucun fallback clair. Calibration/navigateur/éviction/contextHTTPS restent gates avantimplémentationproduction.

## Reconnexion, conflit et confirmation
Synchroniser draft ≠ soumettre commande. Reconnecter recharge catalogue/droits : indisponible avertit, interdit bloque soumission, pas destruction du draft. Maintenance pause sync, préparation locale peut continuer ; suspendu connu refuse serveur et demande purge au mieux, aucune garantie forensic/distancehorsligne.
Conflit : montrer version serveur et locale avec fichiers/nombre/état selon compte. Deux actions explicites :
- Utiliser version serveur, avertir abandon de modifications locales, confirmer ; conserver ancienne jusqu'à récupération complète/commit.
- Conserver version locale comme nouveau draft, fichiers compris, identité distincte ; serveur existant inchangé.
Réponse perdue : résultat incertain, même reçu/intention, pas copie automatique incontrôlée.
Envoi officiel seulement en ligne, uploads vérifiés, récapitulatif4.5 et confirmation ; préserver draft jusqu'au reçu certain. Ensuite finaliser sans transformer draft en cache offline de commande officielle.
Scénarios revus : fermer navigateur/quota ne font pas faux succès ; logout/retour même compte ; conflit avec fichiers ; maintenance ; suspendu àreconnexion ; motdepasseconnexionreset nechangephrase ; code avec appareilperdu insuffisant.
Scénarios visibles dans maquette, pas PWA installable ni crypto/sync navigateur fonctionnel. Recetteappareilsréels/interruptionquota/conflits/cryptographie reste aux points dédiés et4.14.
