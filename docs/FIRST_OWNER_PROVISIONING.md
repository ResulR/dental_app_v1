# Premier compte propriétaire — conditions et état13/10/2026

Aucun premier compte/credential n'est créé par ce document ou par l'agent. Le bootstrap est une opération administrative de données, pas une route publique, invitation admin ordinaire ou récupération d'un compte existant.

## Conditions obligatoires

- Identité/autorité de la personne et email réel confirmés par l'opérateur habilité ; ne jamais inventer l'adresse. Canonicalisation emailKey7.1 réutilisée, email_original conservée.
- Base dental_lab seulement, PostgreSQL17, schéma0002 reçu, audit/outbox0008 reçus, objets/ACL applicatifs reçus et registre sans résultat incertain. Snapshot/sauvegarde et procédure de retour approuvés avant écriture.
- Absence de compte et owner_slot vérifiée dans la transaction ; si un compte/propriétaire existe, arrêter. Ce n'est pas une procédure pour remplacer, promouvoir ou supprimer un compte ; utiliser7.14/7.15 après décision appropriée.
- Entrée privée du mot de passe par la personne, sans argument CLI, variable d'environnement, historique shell, Git, output/log/ticket ni transmission à l'agent. Réutiliser hashPassword/scrypt7.1 avec minimum15codepoints/maximum1024octets. Hash également traité comme donnée sensible, pas copié dans un script SQL versionné.
- Code/outils de provisionnement approuvés et figés, opérateur et vérificateur, fenêtre contrôlée ; aucune permission supplémentaire au runtime/agent. Le runtime n'a volontairement pas INSERT/UPDATE owner_slot ou UPDATE accounts.profile.
- Une transaction administrative unique crée accounts(owner/active), owner_slot singleton, credential, audit de processus owner_bootstrap avec corrélation et preuve d'autorité référencée hors donnée sensible. Contraintes réciproques différées vérifiées avant COMMIT. Aucun credential séparé ni compte partiellement utilisable.
- Aucune modification de rôle/HBA/systemd/autreapplication. Aucune réutilisation du mot de passe du VPS, PostgreSQL, GitHub ou d'un autre projet.

## Vérifications de sortie

Un owner actif/slot conforme/credential valide, flags de sécurité cohérents, epoch initial/révision, contraintes validées et audit non modifiable. Aucune lecture/affichage de hash ou password pour vérifier. Refus de deuxième bootstrap démontré sans mutation ; panne avant commit rollback ; commit incertain diagnostiqué avant tout nouvel essai. Ne pas annoncer rollback si l'état engagé est inconnu.

Ensuite, recette protégée SQL/ACL en rollback avec employee synthétique ; elle refuse si runtime actif ou limiteur déjà utilisé. Puis runtime approuvé/TLS et connexion personnelle. Le propriétaire saisit ses credentials via HTTPS et vérifie la déconnexion/révocation. Les secrets et preuves humaines ne sont jamais requis par l'agent pour développer.

## État au13/10/2026 — outil privé implémenté

Outil réel préparé : scripts/owner-bootstrap-admin.py (supervision humaine protégée), owner-bootstrap-worker.mjs (hachage runtime / écriture administrative), owner-bootstrap-core.mjs (transaction fermée). Aucun endpoint ni droit runtime nouveau. Autorisation privée à durée limitée, marqueur de consommation durable, verrou SQL, refus de réutilisation et résultat incertain sans rejeu. Les preuves d'identité restent humaines ; un UUID seul n'est pas une preuve d'autorité.

Dossier exécutable après approbation : [FIRST_OWNER_BOOTSTRAP_ADMIN](admin-proposals/FIRST_OWNER_BOOTSTRAP_ADMIN.md), [copie/SHA](admin-proposals/OWNER_BOOTSTRAP_COPY.md), [runtime](admin-proposals/FIRST_LOGIN_RUNTIME.md). Harness réel commit/atomicité/rollback/perte de connexion/concurrence préparé pour cluster isolé neuf, jamais une fixture owner engagée sur le VPS.

**Implémenté et testé hors ligne ; NON appliqué, NON réceptionné.** Aucun compte réel créé. Nous pouvons passer à la validation réelle groupée du bootstrap et du premier parcours de connexion. Elle commence par la recette PostgreSQL isolée puis les migrations/ACL et le compte expressément approuvé. Domaine/port/certificat/politiques restent des paramètres administrateur à confirmer ; la configuration exacte TLS dépend de ces valeurs.

Alertes7.13 : file durable et atomique prête, mais worker/fournisseur/template et preuve de réception du mail restent à développer/configurer/recevoir. Ce manque empêche de déclarer la production complètement conforme ; il ne doit pas être masqué par une première session HTTPS réussie.
