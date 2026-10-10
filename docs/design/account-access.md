# Inscription, approbation et récupération — conception 4.3

Sources : CDC§§2/11/15/17, [comptes](../models/accounts-clinics.md), [navigation](navigation.md), [direction R16](visual-direction.md), [coffre R15](../models/drafts-sync.md). [Parcours](account-flows.json) et [maquette albanaise](account-preview.html) constituent une conception sans authentification, compte, envoi e-mail ou secret réel créé.

## Écrans et états

| Écran | Informations et action | États/refus à rendre explicites |
|---|---|---|
| Connexion commune | Email, mot de passe, « Hyr », récupération ; portail déterminé par serveur | Attente, identifiants invalides génériques, limitation avec délai, panne distincte maintenance ; pas de sélection de rôle |
| Inscription clinique | Nom clinique, prénom/nom dentiste de référence, e-mail, mot de passe, téléphone, adresse complète ; termes applicables versionnés | Erreurs par champ sans valeurs sensibles, doublon traité sans énumération, demande envoyée seulement après reçu certain |
| Attente validation | « Regjistrimi juaj është në pritje të miratimit » et contact labo | Pas de commande officielle ; compte partagé expliqué, aucun compte secrétaire/dentiste ajouté |
| Inscription refusée | « Llogaria e klinikës nuk është miratuar. Kontaktoni laboratorin » | Aucun workflow de réinscription/fusion automatique ; motif seulement s'il est prévu et disponible, pas de nouveau champ obligatoire |
| Liste/détail inscription labo | Coordonnées de la clinique, demande actuelle, acceptations applicables, « Mirato » / « Refuzo » | Habilité uniquement, version courante ; confirmation de conséquence, pas d'affichage patient |
| Invitation admin/employé | But et e-mail destinataire ; création mot de passe après lien valide | Usage unique, expiré/révoqué/consommé/but invalide ; aucun choix libre profil/grants côté destinataire |
| Récupération mot de passe | Email et demande ; confirmation publique générique | « Nëse adresa lidhet me një llogari, do të merrni udhëzimet » ; ne pas révéler existence/suspension |
| Nouveau mot de passe | Contexte challenge valide, nouveau mot de passe et confirmation ; résultat puis retour connexion | Expiré/révoqué/utilisé, politique refusée, attente/réponse perdue ; invalidation sécurisée des sessions selon contrat |
| Suspension / blocage sécurité | Message refus et contact/procédure appropriée | Reset de mot de passe ne lève ni suspension ni security_locked |
| Compte partagé clinique | Profil reconnu et déconnexion claire | Attribution au compte clinique, pas à un dentiste physique certain |
| Changement e-mail clinique | Demande → décision habilitée → confirmation nouvelle adresse → avis ancienne adresse | Connexion ancienne adresse jusqu'à activation ; refus/expiration/collision sans changement |
| Sécuriser compte compromis | Owner seulement, conséquences explicites avant confirmation | Sessions révoquées, blocage/reset/vérification demandeur ; aucune suppression des données |
| Owner sans e-mail accessible | Contact et procédure technique exceptionnelle | Pas de bouton transfert de propriété ni route publique bypass, pas de droits SQL IA |

Approbation clinique change review_state, pas les permissions d'un employé. Ne pas imposer motif de refus inscription non défini ; les motifs des décisions commandes restent leurs règles propres. Le mail labo « nouvelle inscription » suit catégorie existante ; aucun mail automatique d'approbation clinique non spécifié n'est inventé.

## Champs et consentement

H43-01 présentation réversible : adresse complète dans un champ multiligne étiqueté, sans pays/rue/code postal obligatoires supplémentaires tant que non spécifiés. Champ téléphone sans format national arbitraire ; validation/normalisation au contrat serveur. Prénom/nom ici = dentiste de référence de la clinique, distinct des champs patient du travail.

Termes applicables accessibles avant inscription, version et date d'acceptation persistées serveur après action explicite. Ne pas transformer confidentialité en consentement marketing obligatoire. Texte juridique final et obligations Kosovo restent au jalon conformité ; la maquette n'affirme pas validité légale.

Confirmation du mot de passe est une vérification de saisie UI, pas un credential supplémentaire transmis/storé. Politique de robustesse/hachage et TTL d'invitations/challenges restent décisions techniques sécurité avant implémentation ; pas de minimum arbitraire prétendu approuvé ici. Autoriser gestionnaire de mots de passe et collage selon contrôle sécurité approprié ; labels visibles, autocomplete username/current-password/new-password selon contexte.

## Erreurs, confirmations et résilience

Erreur localisée à côté du champ et résumé accessible avec lien au premier champ erroné ; ne pas afficher la valeur du mot de passe dans un message. Formulaire reste lisible sur téléphone, bouton44px minimum, champ48px, pas de double-colonne obligatoire. Téléphone/e-mail ont clavier adapté, aucun champ masqué requis inaccessible. Chargement annoncé, un clic ne crée pas plusieurs comptes ou invitations.

Avant décision labo, confirmer clinique et effet (approuver = autoriser dépôt, refuser = ne pas l'autoriser), conserver action pending en cas de conflit de révision et exiger relecture. Suspension/sécurisation ont confirmation propre et motif/trace suivant contrat, pas un simple changement de couleur. Après échec réseau, ne pas déclarer inscription validée ; retrouver reçu/état de même intention avant retry, aucun auto-submit du formulaire.

Challenge invitation/récupération : aucun token réel dans mock, Git ou logs. Futur écran consomme le challenge selon protocole sécurisé et minimise exposition URL/Referer/historique ; ne pas transformer le code de secours R15 en un challenge e-mail. Réinitialisation de connexion : « Fjalëkalimi i llogarisë nuk ndryshon frazën e arkës lokale » ; nouveaux identifiants n'autorisent pas l'accès au coffre d'un autre compte. Phrase/code du coffre restent exclusivement navigateur et n'apparaissent jamais dans URL/télémétrie.

## Mobile et états de démonstration

Maquette locale en albanais, sections login/inscription/pending/récupération/invitation/approbation ; une colonne et labels persistants, largeur formulaire≤720px, aucune ressource externe. Champs désactivés/sans secret, boutons non opérationnels ; les démonstrations ne peuvent ni envoyer un formulaire ni créer une session. L'affichage simultané des étapes sert la revue, pas une future page de connexion encombrée : chaque étape sera un écran séparé.

Vérifications actuelles : plan des acteurs/états, champs de l'inscription exactement CDC, références et HTML/labels/types, tokens R16, absence réseau/script/action/secret. Parcours validables téléphone/tablette conçus ; tests visuels, clavier, lecteur, anti-énumération/timeouts/token/CSRF/suspension et fournisseurs restent à l'implémentation et4.14. Aucune validation fonctionnelle ou juridique prétendue.
