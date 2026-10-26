# Revue statique finale v15 — 26 octobre 2026

Verdict : v15 bloquée pour une réception revendiquant l'attente réelle du
verrou concurrent. Aucun cluster v15 lancé.

Main 04e85c6 propre au début. Le manifeste compte 248 chemins uniques ;
SHA-256 809a1d1bd793ad64af9d884f939dff168e60c3cb041c9bff4441acb9b2d.
La vérification de chaque empreinte, deux tests statiques et les syntaxes Bash
et JavaScript réussissent. Les fichiers v15 ne référencent pas les bundles
historiques v12–v14 ; la fixture copie les migrations nécessaires.

Le runner exige UID 1002, cgroup et limites CPU/mémoire/tâches, marges, Git
propre et répertoire absent. Il utilise une socket Unix privée 0700 au port
55445 sans TCP. Timeouts, trap EXIT/INT/TERM, arrêt fast et comparaisons
production/services/sockets avant-après sont présents. SIGKILL et panne machine
exigent un contrôle indépendant. Aucun ancien dossier de preuves n'est touché.

Les assertions proposées couvrent les révocations commitées de configuration,
grant, clinique et révision après prévol ; bail expiré ; récupération ambiguë ;
fournisseur fictif bloqué ; retrait de configuration non commité. Le rôle
applicatif est utilisé dans les transactions et les refus de privilèges sont
testés.

Lacune : le test de suspension concurrente lance la promesse d'autorisation,
attend 50 ms, commit, puis vérifie le refus. Il ne constate ni attente Lock
dans pg_stat_activity ni autre preuve que la requête avait acquis ou attendu
le verrou avant le commit. Si elle ne démarre qu'après le commit, le test passe
aussi. Ce délai n'est pas une barrière. Un bundle distinct doit observer
l'attente effective avec timeout et échec si absente. V15 reste figée.

Le contrat HMAC sépare chaque tentative, mais une rotation du secret change
sa clé : conserver la version et le secret requis jusqu'à réconciliation.
Le type verified_acceptance reste une affirmation non authentifiée dans le
noyau pur ; seul un adaptateur fournisseur authentifié peut établir sa preuve.
Not found, rejet et indisponibilité n'autorisent aucun réessai automatique.
Aucun fournisseur réel ni worker actif.

Décisions métier restant nécessaires avant activation : effet temporel d'une
révocation postérieure au dernier commit d'autorisation et procédure de
résolution manuelle des résultats ambigus. Une réussite PostgreSQL future ne
prouverait ni atomicité externe ni livraison exactement une fois.
