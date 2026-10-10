# ADR0004 — Outillage des fondations
Décision technique réversible sous stack approuvée/R17. npm workspaces, packages privés, versions exactes et lockfile.
Node existant22.22.2/npm10.9.7 conservés, aucun upgrade global. TypeScript6.0.3 reste en branche6 ; typescript-eslint8.71.1 annonce >=4.8.4 <6.1 et ESLint8/9/10, choix ESLint10.12.0 compatible Node22.13+.
Versions vérifiées par npm view sur registre depuis VPS10/10/2026 : React/DOM19.3.0, Express5.3.0, Zod4.6.5, Vite8.3.4/pluginreact6.1.2, Vitest5.0.3, Playwright1.64.0, Prettier3.9.10 ; types Node22.20.5/React19.3.0/Express5.0.6.
Vitest accepté avec Vite8 et Node22.12+, workers limités à1 aux tests ; Playwright API et configuration navigateur, sans installer/exécuter Chromium sur VPS sous R17.
ESLint/import-boundaries/typecheck strict au point5.4 ; test configs5.5 ; shell5.6 ; API5.7 ; contrats validés5.9. Pas de framework CSS/routeur/pg avant besoin réel.
Installation scripts lifecycle désactivés, cache dans projet ignoré, engines strict. Extensions natives précompilées vérifiées aux contrôles, pas contournement si indisponibles.
Sources primaires vérifiées : vite.dev/guide (Node20.19+/22.12+), TypeScript6 release notes et Express5 installation ; métadonnées npm peers/engines. Lockfile représente la résolution effective, pas tableau documentaire.
Aucun service, compte système, secret, SQL ou privilège créé. E2E API n'est pas recette tactile/visuelle ; readiness production non accordée.
