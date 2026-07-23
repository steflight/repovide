# Déploiement — composant Communication (`apps/comm`)

Pipeline : **push sur `main`** (touchant `apps/comm/**`, `packages/**` ou le workflow) →
`.github/workflows/deploy-comm.yml` construit l'image, la publie sur **GHCR**, puis
(si les secrets VPS sont présents) la déploie sur le **VPS** en SSH.

```
GitHub Actions ──build──▶ GHCR (ghcr.io/steflight/agoum7-comm)
                                   │
                                   └──SSH docker compose pull/up──▶ VPS ──▶ :3000/health
```

Le pipeline a **deux étages indépendants** :

| Étage | Actif quand… | Ce qu'il fait |
|-------|--------------|----------------|
| `build-and-push` | toujours (push `main` ou run manuel) | build de l'image + publication sur GHCR |
| `deploy` | les 3 secrets VPS sont présents | `docker login` + `docker compose pull && up -d` + health check |

Tant que les secrets VPS sont absents, l'étage `deploy` se court-circuite proprement
(aucun échec) : on peut donc **tester la moitié build/publish sans VPS**.

---

## 1. Tester tout de suite (sans VPS)

Aucune config requise. Deux options :

- **Merger un changement** touchant `apps/comm/**` ou `packages/**` sur `main`, ou
- **Onglet Actions → Deploy Comm → Run workflow** (déclenchement manuel `workflow_dispatch`).

Résultat attendu : le job `build-and-push` passe au vert et l'image apparaît dans
**GitHub → Packages** sous `agoum7-comm` (tags `latest` + le SHA du commit).
Le job `deploy` s'exécute mais **saute** l'étape SSH avec une note « Secrets VPS absents ».

> L'image GHCR est **privée** par défaut (héritée du dépôt privé). Pour que le VPS
> puisse la puller, voir `GHCR_PULL_TOKEN` plus bas — ou rendre le package public
> (Packages → agoum7-comm → Package settings → Change visibility).

---

## 2. Préparer le VPS (une fois)

Sur le serveur (Debian/Ubuntu récent), en tant qu'utilisateur de déploiement (ex. `deploy`) :

```bash
# 1. Docker + plugin compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # se reconnecter ensuite

# 2. Arborescence attendue par le workflow : ~/agoum7/apps/comm
mkdir -p ~/agoum7/apps/comm && cd ~/agoum7/apps/comm

# 3. Récupérer le docker-compose.yml du dépôt (ou le copier à la main)
curl -fsSL -o docker-compose.yml \
  https://raw.githubusercontent.com/steflight/Agoum7/main/apps/comm/docker-compose.yml

# 4. Créer le .env de runtime (JAMAIS committé — voir apps/comm/.env.example)
cat > .env <<'EOF'
PORT=3000
EOF
```

> Le workflow fait `cd ~/agoum7/apps/comm` puis `docker compose pull && up -d`.
> Si tu déploies sous un autre chemin, adapte le `cd` dans `deploy-comm.yml`.

### Reverse-proxy / HTTPS (Lot 2)

Le service n'écoute que sur `127.0.0.1:3000` (pas d'exposition publique directe).
Mettre un Traefik/Caddy devant pour le TLS + le routage du domaine.

---

## 3. Renseigner les secrets GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret** :

| Secret | Contenu | Sert à |
|--------|---------|--------|
| `VPS_HOST` | IP ou hostname du VPS | cible SSH |
| `VPS_USER` | utilisateur SSH (ex. `deploy`) | cible SSH |
| `VPS_SSH_KEY` | **clé privée** SSH (PEM complet) dont la publique est dans `~/.ssh/authorized_keys` du VPS | auth SSH |
| `GHCR_PULL_TOKEN` | PAT GitHub (classic) avec le scope **`read:packages`** | `docker login ghcr.io` côté VPS pour puller l'image privée |

Générer la paire de clés dédiée au déploiement :

```bash
ssh-keygen -t ed25519 -C "deploy@agoum7" -f agoum7_deploy -N ""
# → coller agoum7_deploy      dans le secret VPS_SSH_KEY
# → ajouter agoum7_deploy.pub dans ~/.ssh/authorized_keys sur le VPS
```

Dès que `VPS_HOST` + `VPS_USER` + `VPS_SSH_KEY` existent, l'étage `deploy` s'active
automatiquement au prochain push sur `main` (ou run manuel).

---

## 4. Vérifier un déploiement

- **GitHub** : Actions → run `Deploy Comm` vert, étape « Déploiement SSH … + health check » OK.
- **Sur le VPS** :
  ```bash
  cd ~/agoum7/apps/comm
  docker compose ps
  curl -fsS http://127.0.0.1:3000/health   # {"status":"ok","component":"comm-0",...}
  docker compose logs --tail=50
  ```

### Rollback

Les images sont taguées par SHA. Pour revenir à une version précise :

```bash
cd ~/agoum7/apps/comm
IMAGE_TAG=<sha> docker compose pull
IMAGE_TAG=<sha> docker compose up -d
```

---

## Sécurité

- Aucun secret dans le dépôt : tout passe par les secrets GitHub Actions et le `.env` du VPS.
- La clé SSH de déploiement est **dédiée** (révocable sans impact ailleurs).
- `GHCR_PULL_TOKEN` est en lecture seule (`read:packages`).
- Le service n'est pas exposé publiquement (bind `127.0.0.1`), le TLS viendra du reverse-proxy.
