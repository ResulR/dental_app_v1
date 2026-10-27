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
pour le filtre `active` contractuel. La reprise complète en copie isolée a
réussi 571/571 tests sur 128 fichiers (176,99 s). Après l'ajout du test de
préremplissage, la suite entière a réussi 572/572 tests sur 129 fichiers
(176,78 s) dans la copie isolée. La recette PostgreSQL et
le parcours navigateur de 9.6 restent à faire avant toute clôture du point ;
aucun changement de schéma ni de service de production n'a été appliqué.

## Complément du 27 octobre — consultation et preuves manquantes

Le lien d'une correspondance transmet désormais son numéro à la recherche du
suivi clinique ; le dentiste peut lancer la recherche préremplie, consulter la
commande autorisée ou revenir au formulaire et poursuivre le dépôt. Le serveur
de suivi impose toujours sa propre portée de clinique et ses permissions.
Un test de rendu vérifie le préremplissage et les tests de service/HTTP
vérifient les frontières serveur. Le parcours complet en navigateur n'est pas
revendiqué.

Le harnais `tests/browser/order-similarity.mjs` vise un serveur Vite sur
127.0.0.1, dans une copie sous `.local`, et intercepte toute l'API avec
données synthétiques ; les destinations externes sont refusées. Il couvre
sans correspondance, correspondance, clavier/lien/recherche, poursuite du
dépôt, indisponibilité, réponse malformée et échec du précontrôle. Deux essais
sur le VPS se sont arrêtés avant les scénarios : erreur de syntaxe du
harnais temporaire corrigée, puis Chromium a atteint la limite de processus
du cgroup (100), même en mode mono-processus. Aucun résultat navigateur n'est
déclaré. Le script refuse désormais de démarrer sans 64 tâches libres.
Une exécution sur un environnement de test dédié, doté d'une marge suffisante,
reste nécessaire. Aucun processus Chromium résiduel n'a été constaté et les
services surveillés sont restés actifs.

## Recette PostgreSQL préparée, jamais lancée

`tests/postgres/run-order-similarity-v1.sh`, sa fixture et son scénario
sont indépendants des bundles v12–v17. Le nouveau répertoire privé est
`.local/order-similarity-v1`, le port/socket privé 55448 ; l'absence de ce
répertoire est une garde de lancement et une preuve actuelle de non-exécution.
La recette exige un drapeau d'approbation dédié, Git propre, identité
UID/hostname/cgroup, son propre manifeste de 250 empreintes,
marges CPU/mémoire/tâches/disque et PostgreSQL 5432 disponible. Elle crée
une copie source privée, compile dedans, installe une base synthétique sous
socket Unix avec réseau désactivé et rôle applicatif réduit, puis confronte
la requête réelle aux cliniques A/B, versions courantes, signaux, limite trois,
révocation/session/suspension et privilèges. Le trap arrête exclusivement
son cluster avec `pg_ctl -D` et conserve les journaux et captures des services.
Les commandes sont bornées par `timeout`. Aucun bundle historique n'est
modifié ni rejoué ; seules les migrations source figées 0002–0013 sont lues
dans le cluster neuf.

Audit statique : concordance des chemins, port et rôles, absence de TCP,
préconditions, arrêts ciblés et syntaxe Bash/Node examinées ; manifeste
SHA-256 `3039598e47cc41142a5ca26a0e7975c04b012830cda1cab747581f5d50fa59e5`
(250/250 à la préparation). Le SQL et les assertions réelles ne sont **pas**
validés tant que cette recette n'est pas exécutée. Un administrateur doit
autoriser explicitement **une seule exécution** après un nouveau préflight
complet, avec le commit et le manifeste exacts. L'autorisation de v17 ne
s'applique pas ici. En cas d'échec, conserver `.local/order-similarity-v1`,
identifier son PID avant tout arrêt ciblé et vérifier les services voisins ;
aucune relance automatique.
