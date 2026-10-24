# Revue statique du contrôle des migrations 0022–0023

Aucune migration appliquée. Reçus de production à vérifier séparément avant toute décision d'application. Le contrôle `scripts/migration-catalog.py` charge exactement le lanceur historique dont il vérifie le SHA-256 ; sa fonction `validate` rejette par expression régulière les mots `BEGIN`, `SET`, `DO`, etc. partout dans le texte, y compris commentaires et corps de fonction.

| Migration | Déclencheur réel | Pourquoi une substitution textuelle ne suffit pas |
| --- | --- | --- |
| 0022 | `LANGUAGE plpgsql SET search_path`, blocs `BEGIN … END`, commentaires avec `SET` | Trois déclencheurs empêchent l'insertion d'un reçu déjà finalisé, sa réécriture après finalisation et le commit d'un reçu encore `pending`. Retirer ces protections affaiblirait l'atomicité et l'immutabilité vérifiées en v5. |
| 0023 | `ON CONFLICT … DO NOTHING` | L'insertion des marqueurs absents à zéro doit être idempotente, y compris sous concurrence. Un simple `WHERE NOT EXISTS` peut échouer sur une course à la contrainte unique ; aucune lecture historique ne doit être fabriquée. |

## Correction proposée, soumise à une revue distincte

1. Conserver les octets des migrations approuvées et toutes les preuves. Vérifier les reçus et les SHA de 0022 et 0023 en lecture seule avant toute nouvelle proposition.
2. Préparer une **nouvelle révision du lanceur et de son inventaire**, explicitement approuvée par l'administrateur : garder le refus des commandes transactionnelles/session au niveau SQL, mais analyser les instructions SQL hors chaînes/commentaires/corps dollar ; autoriser seulement les définitions de fonction et le `ON CONFLICT DO NOTHING` examinés avec les empreintes exactes de 0022/0023. Une liste blanche d'empreintes seules ne remplace pas l'analyse du contenu et la revue humaine. Aucun assouplissement pour les autres migrations.
3. Vérifier ce nouveau validateur avec tests positifs des deux fichiers inchangés et tests négatifs (`BEGIN`, `SET`, `DO`, `COPY`, méta-commandes, faux commentaires, corps dollar tronqué, SHA différent). Comparer les privilèges, l'atomicité et les reçus. Faire réceptionner la modification du lanceur, puis seulement envisager la procédure de migration de production.

## Prototype hors chemin privilégié

`scripts/proposed-migration-validator.py` expose un adaptateur `validate(name, sha, data, historical_validate)` et n'est appelé ni par le lanceur installé ni par `scripts/migration-catalog.py`. Pour toutes les migrations sauf 0022/0023, il délègue intégralement à `historical_validate`. Pour ces deux noms exacts, il exige à la fois le SHA fourni et l'empreinte figée dans le prototype (`e259575c…838cd4` et `5eaa63d5…45bf`). Son analyseur lexical sépare les instructions au niveau supérieur, ignore les commentaires imbriqués et les chaînes SQL/dollar correctement fermées, refuse les caractères non pris en charge, les commandes transactionnelles/de session et toute structure d'instructions inattendue. Les trois corps de fonctions de 0022 restent opaques **uniquement** parce que les octets entiers sont figés ; `SET search_path` est borné aux en-têtes des trois fonctions et `DO NOTHING` à l'INSERT de 0023. Ce prototype n'est pas un parseur PostgreSQL général ni une autorisation d'exécuter une migration SQL différente.

`tests/migrations/test_proposed_validator.py` couvre les deux fichiers intacts, la délégation au contrôle historique, les modifications d'octets accompagnées de nouveaux SHA, les commandes interdites hors exception et les citations/commentaires/corps dollar tronqués. L'approbation administrative nécessitera encore une revue des octets du candidat, une version nouvelle et protégée du lanceur/inventaire, une vérification en lecture seule des reçus installés, des essais isolés du chemin complet et une procédure d'installation avec retour arrière. Le lanceur installé reste le seul chemin de production autorisé actuellement.

Le validateur historique et son SHA restent inchangés. `check:migrations` demeure **en échec** ; la recette isolée v6 charge 0023 directement dans une fixture jetable et ne valide donc pas la voie administrative. Aucune autorisation d'exécuter v6 ou une migration n'est donnée par ce document.
