# Déploiement — composant Communication (`apps/comm`)

Mode retenu : **build directement sur le serveur** (pas de registre externe, pas de token).
La clé SSH de déploiement suffit.

```
GitHub Actions ──rsync sources (SSH)──▶ VPS ──docker compose up -d --build──▶ :3000/health
```

Le pipeline (`.github/workflows/deploy-comm.yml`) reste **dormant** tant que les secrets
`VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` ne sont pas posés. On peut aussi déployer **à la main**
(ci-dessous) sans rien configurer sur GitHub.

---

## A. Lancer sur le serveur ce soir (manuel, ~5 min)

Sur le VPS (Debian/Ubuntu), en tant qu'utilisateur de déploiement :

```bash
# 1. Docker (si absent)
command -v docker >/dev/null || { curl -fsSL https://get.docker.com | sh; sudo usermod -aG docker "$USER"; }
#    ↑ si tu viens d'ajouter ton user au groupe docker : se déconnecter/reconnecter une fois.

# 2. Récupérer le code (dépôt privé → authentifie-toi avec ton compte GitHub)
git clone https://github.com/steflight/Agoum7.git ~/agoum7
cd ~/agoum7/apps/comm

# 3. Fichier d'environnement de runtime (jamais committé)
printf 'PORT=3000\n' > .env

# 4. Build + lancement (l'image se construit sur le serveur)
docker compose up -d --build

# 5. Vérifier
curl -fsS http://127.0.0.1:3000/health   # → {"status":"ok","component":"comm-0",...}
docker compose ps
docker compose logs -f                    # Ctrl-C pour quitter
```

C'est tout : le service tourne, redémarre tout seul (`restart: unless-stopped`), et écoute
sur `127.0.0.1:3000`.

### Mettre à jour plus tard

```bash
cd ~/agoum7 && git pull
cd apps/comm && docker compose up -d --build
```

---

## B. Automatiser via GitHub Actions (optionnel)

Pour que chaque push sur `main` redéploie tout seul, poser 3 secrets
(Repo → **Settings → Secrets and variables → Actions**) :

| Secret | Contenu |
|--------|---------|
| `VPS_HOST` | IP / hostname du VPS |
| `VPS_USER` | utilisateur SSH (ex. `deploy`) |
| `VPS_SSH_KEY` | **clé privée** SSH dédiée (la publique est dans `~/.ssh/authorized_keys` du VPS) |

Générer une clé dédiée au déploiement :

```bash
ssh-keygen -t ed25519 -C "deploy@agoum7" -f agoum7_deploy -N ""
# → coller agoum7_deploy      dans le secret VPS_SSH_KEY
# → ajouter agoum7_deploy.pub dans ~/.ssh/authorized_keys du VPS
```

Le workflow rsync les sources vers `~/agoum7/` puis lance `docker compose up -d --build` +
health check. Tant que les secrets sont absents, il ne fait rien (aucun échec).

> `~/agoum7/apps/comm/.env` sur le VPS n'est **jamais** écrasé par le rsync (exclu).

---

## Runtime & sécurité

- Le service n'écoute que sur `127.0.0.1:3000` : pas d'exposition publique directe.
  Le TLS + le routage du domaine viendront d'un reverse-proxy (Traefik/Caddy) au Lot 2.
- Aucun secret dans le dépôt : `.env` (runtime) vit sur le serveur, les creds CI sont des
  secrets GitHub. La clé SSH de déploiement est dédiée et révocable.
- Rollback : `cd ~/agoum7 && git checkout <commit> && cd apps/comm && docker compose up -d --build`.
