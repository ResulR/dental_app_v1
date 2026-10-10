# Direction visuelle en albanais — décision R16, point 4.1

Statut : direction approuvée par le propriétaire, décision R16 du 10/10/2026 ; conception uniquement. Source : CDC§§1/7/11/13/18 et ROADMAP4.1 « Tokens, typographie et parcours prioritaires approuvés ». Aucun workflow modifié, aucune application installée.

Audit : aucun frontend, asset, logo ou design existant dans le projet ; pas de charte fournie. Les fondations3.1–3.11 sont validées en conception. Proposition H41-01 réversible : une direction unique sobre et professionnelle, dominante blanc/gris et accent vert pétrole ; aucune marque/logo inventé. Police système, pas de téléchargement de police ni dépendance externe.

Le skill Superdesign a été consulté ; son CLI/service externe n'est pas lancé dans cette intervention, qui reste exclusivement via Remote sur le VPS conformément à l'autorisation du propriétaire. Les fichiers locaux ci-dessous portent la proposition concrète ; aucune maquette générée sur un service externe ni authentification n'est prétendue.

## Tokens de la direction approuvée

Source machine : [tokens.json](tokens.json). Exemple statique albanais : [direction-preview.html](direction-preview.html), sans réseau/JS/stockage ou données réelles. Cette page illustre l'accueil labo et l'entrée brouillon clinique ; elle ne valide pas les futurs écrans/actions/permissions.

| Usage | Valeur |
|---|---|
| Fond / surface | #F4F7FA / #FFFFFF |
| Texte principal / secondaire | #0F172A / #475569 |
| Accent et action principale | #0F766E ; texte blanc |
| Bordure de champ interactive | #64748B, distincte des séparateurs décoratifs #CBD5E1 |
| Focus | #1D4ED8, anneau3px avec espace2px |
| Succès | #166534 sur #F0FDF4 |
| Avertissement | #92400E sur #FFFBEB |
| Erreur / annulation | #B91C1C sur #FEF2F2 |
| Espacements |4/8/12/16/24/32px ; cartes24px sur tablette,16px sur petit écran |
| Rayons |8px champs/boutons,12px cartes ; ombres très discrètes |
| Cibles principales | Minimum44px approuvé pour boutons/liens tactiles ; champs48px |
| Typographie | system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif ; corps16px/1.5 |
| Titres / labels |28px/1.2 titre page ;20px/1.3 section ;14px/1.5 secondaire ; graisse600 |
| Largeur | Contenu jusqu'à1200px, formulaire lisible jusqu'à720px ; aucun tableau horizontal imposé au mobile |

Couleur accompagnée d'un libellé/iconographie intelligible, jamais seule distinction de statut. Bouton destructif distinct avec confirmation prévue par workflow ; ne pas faire ressembler « Livrer » à « Supprimer ». Blanc sur accent et textes sur fonds sont contrôlés numériquement ; accessibilité tactile/clavier/lecteur d'écran réelle restera testée en4.14 et implémentation. Ne pas qualifier les tokens seuls de conformité WCAG.

## Parcours prioritaires approuvés

| Priorité | Public | Entrée et résultat |
|---|---|---|
|1 | Labo habilité | « Për t’u trajtuar » → ouvrir travail/demande → relecture dernière version → décision explicite ; notification lue distincte de demande traitée |
|2 | Clinique | « Porosi e re » → compléter brouillon/fichiers → résumé et confirmation en ligne → reçu officiel ; hors ligne sauvegarde locale seulement |
|3 | Labo logistique | « Gati për dorëzim » → sélectionner éligibles → confirmer sortie physique avec mode/date ; pas de confirmation du dentiste |
|4 | Deux portails habilités | « Mesazhet » → conversation générale ou travail clairement identifié → Envoyé/Lu ; chat ne modifie pas les instructions |
|5 | Clinique | « Draftet » → déverrouillage coffre ou secours R15 → reprise/conflit → soumission explicite ; code jamais communiqué au serveur |

« Paramètres » hors accueil quotidien ; audit global propriétaire seul. Aucune métrique financière ni tâches employé affectées. Liste simple : numéro/clinique/statut/dates/actions selon permissions. Identification patient seulement dans projections autorisées ; elle est absente de la maquette logistique.

## Vocabulaire albanais de travail

| Concept | Libellé candidat |
|---|---|
| À traiter / Travaux / Cliniques | Për t’u trajtuar / Punët / Klinikat |
| Prêts à livrer / Calendrier / Messagerie | Gati për dorëzim / Kalendari / Mesazhet |
| Nouvelle commande / Brouillons | Porosi e re / Draftet |
| En attente / Correction demandée | Në pritje / Kërkohet korrigjim |
| Acceptée / En fabrication | E pranuar / Në prodhim |
| Terminée / Livrée | E përfunduar / E dorëzuar |
| Refusée / Annulée | E refuzuar / E anuluar |
| Planifiée / Souhaitée | E planifikuar / E dëshiruar |
| Envoyé / Lu | Dërguar / Lexuar |
| Local chiffré / Synchronisé | I ruajtur i enkriptuar në këtë pajisje / I sinkronizuar |
| Déverrouiller / Code de secours | Zhblloko / Kodi i rikuperimit |

Ces formulations sont candidates, revue par personne albanaise au jalon UX/recette ; labels techniques matériaux/teintes conservés. Dates affichées DD/MM/YYYY, Europe/Pristina ; aucune traduction ne change le statut/workflow. Statut avec article accordé à porosi ; dent pontic « antar » conservé selon CDC.

## États et responsive

Clinique mobile-first, laboratoire adapté prioritairement à la tablette : navigation compacte, une action dominante, liste avec grands points tactiles. Mobile : colonnes deviennent cartes lisibles, navigation accessible, boutons et textes passent à la ligne. Desktop : largeur bornée, densité maîtrisée ; calendrier drag/drop traité4.10. Chargement, erreur, liste vide et maintenance ont des textes distincts ; pas de spinner perpétuel ni fausse maintenance en panne réseau.

La maquette présente des éléments statiques de démonstration avec références et cliniques fictives, sans nom patient. Les liens d'exemple ciblent les sections de la page ; aucune vraie mutation, session, clé/code, requête, fichier médical ou stockage navigateur.

## Validation et réception

À effectuer maintenant : parsing des tokens et HTML, langue sq, absence de ressources externes/scripts/formulaires sensibles, contrastes calculés, modes/propriétés, liens et diff. Contrôle visuel/rendu navigateur, tactile, clavier et revue linguistique non exécutés à ce point ; critères complets4.14 conservés.

Décision R16 : palette blanc/gris, accent #0F766E, police système base16px, cibles≥44px, responsive mobile-first clinique, albanais et ordre des cinq parcours approuvés. Conserver libellés de statuts sans dépendance exclusive à la couleur, erreurs/confirmations/actions critiques explicites et données sensibles uniquement selon droits. Tests clavier/contrastes/mobile à l'implémentation ; cette approbation n'est ni validation fonctionnelle ni certification accessibilité. Détails esthétiques mineurs cohérents et réversibles appliqués sans nouvelle validation ; décisions structurantes restent à faire approuver.
