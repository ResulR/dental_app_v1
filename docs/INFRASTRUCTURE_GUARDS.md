# Garde-fous infrastructure — rapport2.9

Statut : audit VALIDÉ pour développement, limites restantes documentées ; ROADMAP.md reste canonique. Aucun changement système ni test d'action de service effectué. Mode de développement systemd accepté en2.3, sans isolation complète ni données médicales réelles. Rapport fondé sur preuves directes et administrateur séparées.

| Frontière | Preuve disponible | Limite |
|---|---|---|
| Identité/Remote/projet | Reprises directes en ligne UID1002/dental-ai, cgroup dental-ai-remote.service, /srv/dental-lab privé, Git contrôlé | Pas de confinement général de toutes les commandes |
| Compte/sudo/projets voisins | Rapport administrateur2.1 : pas de sudo, groupes dental-ai/users, refus lecture chemins voisins et secrets cités | Pas de nouveau sondage par agent ; pas garantie de tous chemins |
| Bases | Rapport HBA2.5 et refus des huit bases, audits directs READ ONLY dental_lab ; audit sans migrator/owner | Aucun test répété des autres bases, cluster partagé |
| Migrations | Rapport intégration2.6 et corroborations source root SHA/mode, NOLOGIN/zéro session/tables absentes | SQL/SHA approuvés par administrateur à chaque fois ; pending/effets non transactionnels/charge PostgreSQL restent à gérer |
| Runtime antérieur | Rapport administrateur refus lecture environnement/traversée ; exclusion explicite2.7 | dental-site n'est pas runtime dental-lab, aucun autre accès autorisé |
| Futur runtime | Préparation2.7 et conception2.8, aucune délégation IA/systemctl*/code root éditable | Rien installé ; validation effective19.3/19.4 requise |
| Réseau/processus/IPC/ressources | Limites documentées2.2 et mode explicitement accepté2.3 | Réseau local non isolé démontré, pas de refus universel ni garantie de production ; ne pas sonder voisins |
| Administration systemd | manage-units testé par administrateur ; trois autres catégories générales testées directement, tous code2/authentification requise ; pas de sudo ni délégation créée par projet | Contexte sans authentification seulement ; pas garantie de toutes les exceptions possibles ou du futur état |

## Complément Polkit/systemd — contrôle ciblé et validation développement

Rapport administrateur10/10/2026 : UID1002/groupes dental-ai/users, aucun sudo ni groupe sudo/adm, Remote sous dental-ai avec NoNewPrivileges ; Polkit actif, aucune règle locale dans /etc/polkit-1/rules.d, règles système50-default.rules et systemd-networkd.rules identifiées, aucune délégation à dental-ai dans les lignes examinées. manage-units exige auth_admin/auth_admin/auth_admin_keep selon contexte. pkcheck sans interaction sous dental-ai : code2, authentification requise, autorisation non accordée. Aucun service démarré/arrêté/redémarré ; états actifs rapportés par administrateur. Ces preuves ne démontrent pas toutes les délégations possibles.

Complément directement exécuté par l'agent sous UID1002, cgroup Remote, /srv/dental-lab : /usr/bin/pkcheck présent ; manage-unit-files, reload-daemon et set-environment retournent chacun2 avec authentification requise. Aucune option d'interaction/agent d'authentification, aucun appel d'action systemctl/D-Bus de gestion, aucun nom/endpoint de service voisin interrogé. Commande reproductible, à exécuter seulement comme dental-ai, pour contrôle d'autorisation sans action :

```bash
test "$(id -u)" = 1002 || exit 1
for action in org.freedesktop.systemd1.manage-unit-files org.freedesktop.systemd1.reload-daemon org.freedesktop.systemd1.set-environment; do
 printf '\nACTION=%s\n' "$action"
 if /usr/bin/pkcheck --action-id "$action" --process $$; then result=0; else result=$?; fi
 printf 'CODE=%s\n' "$result"
done
```

Le code2 n'est pas une autorisation ni un refus irrévocable après authentification : il atteste que l'autorisation n'a pas été accordée sans interaction dans le contexte testé. Codes0 (accord),127/erreur ou résultat inattendu imposeraient arrêt et audit, pas classement automatique comme refus.

Références primaires : https://github.com/systemd/systemd/blob/main/src/core/org.freedesktop.systemd1.policy.in ; https://polkit.pages.freedesktop.org/polkit/eggdbus-interface-org.freedesktop.PolicyKit1.Authority.html. Les identifiants connus ont été confirmés par le résultat du système, pas supposés disponibles.

## Portée de la clôture2.9

Identité, confinement adopté, refus fichiers/bases/secrets administrateur, séparation migrations, exclusion runtime antérieur, absence de délégation créée par ce projet et quatre catégories générales d'administration systemd sont documentés avec résultats reproductibles. Critères d'audit satisfaits pour le mode de développement explicitement accepté2.3, sans prétendre prouver l'absence universelle d'un autre mécanisme ou d'une exception par unité/verb/contexte. L'ancienne exigence du rapport d'exclure « toutes » les autorisations possibles était trop générale par rapport à cette validation bornée ; elle n'est pas transformée en garantie acquise.

Toute nouvelle règle/délégation/identité/unité/credential ou changement de contexte impose réaudit avant utilisation. Les gates sécurité/production et installation runtime19.3–19.4 restent obligatoires. Aucun secret/patient réel ni autorisation de migration supplémentaire. L'IA ne contacte aucun service voisin même si un accès technique est possible.

L'accès Remote déjà actif reste autorisé par la décision2.3 : aucun arrêt/reconfiguration pour appliquer littéralement la formule « activable seulement après validation ». Aucun privilège/accès étendu. Réseau local, processus/IPC et ressources serveur partagés restent des risques connus, acceptés seulement pour développement et à réévaluer avant production.
