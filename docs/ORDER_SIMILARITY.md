# Commandes similaires — implémentation 9.6

Le contrôle facultatif `POST /api/v1/orders/similar` prend exactement l'entrée
du précontrôle de commande, sous session clinique et origine autorisée. Il
renvoie au plus trois identifiants et numéros de commandes normales de la
clinique approuvée courante, avec un signal explicatif ; aucune identité de
patient n'est renvoyée. La clinique provient des droits actuels côté serveur,
jamais d'un champ transmis. La lecture compare uniquement la version courante :
référence interne identique **ou** nom et prénom identiques, et simultanément
date demandée, matériau et teinte de la référence de catalogue identiques.
Les espaces de bord et la casse sont normalisés pour la comparaison. Les
commandes d'une autre clinique ne sont jamais candidates.

L'interface affiche les numéros et un lien vers la liste de suivi pour
consulter une commande existante. Le résultat reste un indice et ne bloque
jamais le dépôt. L'échec du contrôle de similarité affiche son indisponibilité
et laisse le précontrôle et le dépôt possibles. Le dépôt garde sa propre clé
d'idempotence transactionnelle : ce détecteur ne remplace pas cette protection.
La recherche ne persiste rien, ne réidentifie pas les patients et ne fournit
pas une preuve d'identité. Un faux négatif reste possible si les dates ou
références diffèrent ; un faux positif si des patients partagent ces éléments.

Le routeur suit le drapeau dormant du précontrôle. Les tests unitaires
vérifient le filtrage de clinique et de version dans la requête paramétrée,
l'absence d'écritures, les refus d'entrée et d'acteur, la projection stricte
sans nom patient et le comportement du client HTTP ; le test HTTP vérifie
origine, session et corps strict. La suite hors PostgreSQL a initialement
réussi 568/571 cas : délai KDF, répertoire temporaire absent dans la copie
et assertion calendrier obsolète. Les trois tests concernés passent après
ajustement de la copie, délai à 15 s et correction de l'assertion calendrier
pour le filtre `active` contractuel. La recette PostgreSQL et
le parcours navigateur de 9.6 restent à faire avant toute clôture du point ;
aucun changement de schéma ni de service de production n'a été appliqué.
