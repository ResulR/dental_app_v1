# Blocage compilation — suivi des commandes depuis479e1df

## État vérifié

UID1002, main/origin479e1df propres avant travail. Aucun changement de migration proposée ni SQL exécuté. Suivi préparé dans le code : recherche POST avec filtres statut/type/date souhaitée ou planifiée, liste logistique sans patient, recherche patient seulement avec permission détaillée ou clinique propriétaire, fiche/snapshots et historique des statuts paginé, UI albanaise et flag désactivé. Tests ciblés écrits mais NON exécutés : le build requis échoue. Aucune fonctionnalité de ce lot déclarée terminée. Les transitions supplémentaires et modifications ne sont pas encore implémentées.

Trois essais de buildAPI via runner borné ont échoué par épuisement du heap Node192Mio : processus2230025 (étape API -6,37.22s),2230125 (-6,34.29s) et2230216 (-6,32.86s). Message : « Ineffective mark-compacts near heap limit / Allocation failed - JavaScript heap out of memory ». Deux simplifications locales du typage (schémas exposés via ZodType et interface explicite du repository/service) n’ont pas suffi. Buildscontracts et format ciblé réussis. Pas de résultat attribué aux tests, typesweb, lint ou buildweb non atteints.

Aucun relèvement de limite, aucune désactivation de strict ou de validation. Au contrôle après arrêt : seuls les deux processus Remote permanents hors commande sont présents, aucun compilateur résiduel. Service conserve MemoryMax1073741824, TasksMax100, CPUQuotaPerSecUSec500ms et NoNewPrivileges=yes. MemoryCurrent542113792 incluant cache ; base hors cache mesurée par runner environ235Mio, distinction maintenue.

## Proposition NON appliquée

Patch séparé docs/admin-proposals/QUALITY_TSC_HEAP_256_PROPOSAL.patch : heap256Mio uniquement pour le binaire TypeScript du dépôt, tous les autres outils restent192Mio. Processus toujours séquentiels et privés au runner, pool1, deadline90s, admission24tâches et448Mio de marge hors cache, arrêt à64Mio de la limite globale, limites systemd inchangées. Aucun sudo ni modification de service requis.

Risque : plafond de vieux heap supplémentaire de64Mio pour une compilation ; ce plafond ne borne pas toute la mémoire native de Node. Surveillance/admission et MemoryMax restent donc indispensables. Le passage à256 ne garantit pas la réussite ; nouvel échec = arrêt, aucun nouveau relèvement automatique. Alternative : compilation sur un environnement de développement séparé approuvé ; aucune copie ni connexion nouvelle préparée silencieusement.

Après autorisation explicite seulement, commandes proposées depuis /srv/dental-lab :

```sh
git apply --check docs/admin-proposals/QUALITY_TSC_HEAP_256_PROPOSAL.patch
git apply docs/admin-proposals/QUALITY_TSC_HEAP_256_PROPOSAL.patch
python3 scripts/run-quality.py build:packages
```

La troisième commande doit réussir avant tests, snapshot additif, typesweb/lint/architecture/buildweb. Aucun démarrage API ou PostgreSQL. La modification du runner est à tester et à versionner séparément après succès ; aucune commande shell alternative hors runner. Les modifications applicatives incomplètes restent conservées non commitées. Le patch est un artefact de revue, pas une autorisation.
