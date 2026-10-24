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

Le validateur historique et son SHA restent inchangés. `check:migrations` demeure **en échec** ; la recette isolée v6 charge 0023 directement dans une fixture jetable et ne valide donc pas la voie administrative. Aucune autorisation d'exécuter v6 ou une migration n'est donnée par ce document.
