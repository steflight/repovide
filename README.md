# Agoum7 — plateforme (monorepo)

Monorepo TypeScript de la plateforme Agoum7. On démarre par le composant **Communication** (`apps/comm`, Comm-0, lecture seule).

## Structure

```
agoum7/
├── apps/
│   └── comm/               # composant Communication (démarrage ici)
├── packages/
│   ├── core-security/      # coffre, audit, human-in-the-loop (§10) — PARTAGÉ
│   └── shared/             # format de message unifié, types (§13.2)
└── .github/workflows/      # CI + déploiement filtré par chemin
```

Le socle de sécurité (`core-security`) est un import local partagé : le composant Comm le réutilise, comme prévu au cadrage (§13.3). Le cloisonnement perso/pro/dev est un cloisonnement **d'exécution** (conteneurs, secrets, pipelines séparés), pas de dépôt.

## Développer

```bash
npm install         # génère package-lock.json (à committer)
npm run build       # tsc -b : typecheck + compile tout le monorepo
npm run start:comm  # lance Comm-0 en local (health check sur :3000/health)
```

Node 22+ requis.

## CI / CD

- `ci.yml` — sur chaque PR et sur `main` : build (typecheck) + lint/test si présents.
- `deploy-comm.yml` — **build sur le serveur** : rsync des sources vers le VPS puis
  `docker compose up -d --build` + health check (aucun registre, aucun token — la clé SSH suffit).
  **Inactif** tant que les secrets `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` sont absents.

Lancer sur le serveur (manuel ou automatisé), secrets, rollback : voir **[`docs/DEPLOY.md`](docs/DEPLOY.md)**.

`main` doit être protégée (PR obligatoire) : le **merge** d'une PR est la validation humaine (§10).

## Sécurité

Les garde-fous critiques vivent dans `packages/core-security`, en code déterministe :
- `EnvSecretsVault` — secrets hors code/LLM (stub, à brancher sur un vrai coffre).
- `ConsoleAuditLog` — journal horodaté (stub, à persister chiffré).
- `DenyByDefaultGate` — validation humaine **fail-safe** (refuse par défaut).
