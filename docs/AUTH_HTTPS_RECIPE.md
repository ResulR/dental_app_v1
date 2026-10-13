# Recette HTTP/navigateur HTTPS — préparée, NON exécutée

Poste opérateur dédié et autorisé, navigateur existant, runtime/TLS reçus, origine HTTPS approuvée et compte de recette contrôlé. Aucun outil/browser installé sur le VPS ni configuration TLS/proxy modifiée par l'agent. Les12intégrations Node locales restent des tests hors PostgreSQL réel.

## HTTP réel, entrée privée

Cette recette lit le mot de passe localement sur le poste opérateur, jamais dans ChatGPT/argument/env/historique. Aucun cookie/credential/body de réponse affiché. Dossier temporaire700/fichiers600 à conserver uniquement le temps autorisé. Ne pas utiliser un compte de patient ni révoquer des sessions réelles tierces. Ne pas lancer sousdental-ai/root ou dans le périmètre des autres applications.

Après choix public de DENTAL_LAB_HTTPS_ORIGIN, exécuter chaque étape séparément et vérifier le statut attendu avant continuation :

```bash
set -euo pipefail
umask 077
: "${DENTAL_LAB_HTTPS_ORIGIN:?origine HTTPS approuvée requise}"
taskAuthDir="$(mktemp -d)"
python3 - "$taskAuthDir/login.json" <<'PY'
import getpass,json,os,sys
payload={'email':input('Email du compte de recette approuvé : '),'password':getpass.getpass('Mot de passe (entrée privée) : ')}
fd=os.open(sys.argv[1],os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as output:json.dump(payload,output)
PY
curl --silent --show-error --max-time 20 --proto '=https' \
 --request POST --header 'Content-Type: application/json' \
 --header "Origin: $DENTAL_LAB_HTTPS_ORIGIN" \
 --data-binary "@$taskAuthDir/login.json" --cookie-jar "$taskAuthDir/cookies.txt" \
 --output "$taskAuthDir/login.response" --write-out '%{http_code}\n' \
 "$DENTAL_LAB_HTTPS_ORIGIN/api/v1/auth/login"
```

Attendu204. Aucun -k/redirect follow. Erreur réseau/réponse perdue :relecture de session avec cookiejar avant nouvelle intention de login ;ne pas rejouer automatiquement.

```bash
curl --silent --show-error --max-time 20 --proto '=https' \
 --cookie "$taskAuthDir/cookies.txt" --output "$taskAuthDir/session.response.json" \
 --write-out '%{http_code}\n' "$DENTAL_LAB_HTTPS_ORIGIN/api/v1/auth/session"
```

Attendu200, JSONstrictaccount_id/profile, Cache-Control no-store à contrôler sans afficher Set-Cookie. Tester401 sanscookie et403 avecOriginétranger,400 avecaccount_idinjecté danslogout-all ;aucun compteciblé duclient ne doit être utilisé. Rotation/révocationdeuxappareils/rollback/pannes doivent suivre la matrice POINT_7_1_2_INTEGRATION_ADMIN et un harness decommit/course à finaliser. Le probeSQLrollback ne démontre pas ces scénarios.

## Navigateur, identité saisie personnellement

Ouvrir uniquement l'origine approuvée, saisir le credential personnellement, contrôler formulairealbanais/401/429/panne et accessibilité clavier/tactile sans capture contenant l'adresse ou le mot de passe. Vérifier session restaurée après rechargement, renouvellement actif/absolu, absence de token dans URL/storage/logs, cookie__Host-/Secure/HttpOnly/SameSiteLax/Path=/, absence de cacheAPI en serviceworker. Deux profils/appareils synthétiques :logout ciblé conserve l'autre, global le refuse. Vérifier que la récupération/coffreR15 n'est pas faussement présenté comme livré.

Pour l'automatisation complémentaire, l'opérateur crée lui-même un storageState Playwright privé d'une seule session de recette (aucune donnée patient), sous son UID, fichier600/unlien,≤16KiB. Aucunsecret enenv :seul le CHEMINprivé du fichier est configuré. Ne pas transmettre ce fichier à l'agent, Git ou un artefact partagé. Le contexte de test le réutilise puis révoque cette session ciblée ;le fichier devient périmé après le test.

```bash
DENTAL_LAB_HTTPS_RECIPE_APPROVED=dedicated-auth-recipe-v1 \
 DENTAL_LAB_HTTPS_ORIGIN=https://DOMAINE_APPROUVE \
 DENTAL_LAB_HTTPS_STORAGE_STATE=/CHEMIN_PRIVE/storage-state.json \
 npx --no-install playwright test --config=playwright.https.config.mjs
```

Remplacer seulement les deux paramètres publics/chemin après accord. Exécuter sur le poste opérateur avec les dépendances/navigateur déjà autorisés, pas dans le serviceRemote/VPS. Le config refuse root/dental-ai, origine nonHTTPS, état lisible par d'autres ou symlink ;ignoreHTTPSErrorsfalse, retries0, trace/screenshot/videooff. Aucun serveur n'est automatiquement démarré. Le test contrôle identité/cookie/cacheAPI/logout, pas le provisionnement, l'envoi d'alerte ou les coursesPG. Aucune exécution/validation navigateur revendiquée.

## Rapport et fin

Conserver code/statuts/assertions booléennes, version/SHA du code, matrice et limites. Pas de password/hash/cookie/storageState ni corpsprivé dans rapport/captures. Fermer les seuls contextes/clients de recette, supprimer leurs fichiers secrets locaux selon la procédure autorisée de l'opérateur ;ne pas purger les données de l'application ou modifier les reçus. Une panne exige vérification de l'état réel avant reprise.
