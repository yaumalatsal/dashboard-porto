#!/usr/bin/env bash
#
# One-time VPS preparation. Run this once, as the user the CI pipeline will SSH
# in as, before the first deploy. It is idempotent — re-running is safe.
#
#   curl -fsSL https://raw.githubusercontent.com/yaumalatsal/dashboard-porto/main/scripts/bootstrap-vps.sh | bash
#
# or, having cloned already:  bash scripts/bootstrap-vps.sh

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/yaumalatsal/dashboard-porto.git}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/dashboard-porto}"
APP_PORT="${APP_PORT:-3000}"

say()  { printf '\n\033[1;33m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;31m !\033[0m %s\n' "$1"; }

# ── Docker ───────────────────────────────────────────────────────────────────
say "Checking Docker"
if ! command -v docker >/dev/null 2>&1; then
  warn "Docker is not installed. Install it first:"
  echo "    curl -fsSL https://get.docker.com | sh"
  echo "    sudo usermod -aG docker \$USER   # then log out and back in"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  warn "The Docker Compose plugin is missing (you may have the old docker-compose)."
  echo "    sudo apt-get install -y docker-compose-plugin"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  warn "Cannot talk to the Docker daemon as $(whoami)."
  echo "    sudo usermod -aG docker \$USER   # then log out and back in"
  echo "The CI pipeline runs docker without sudo, so this must work unprivileged."
  exit 1
fi
echo "    docker ok — $(docker --version)"

# ── Port availability ────────────────────────────────────────────────────────
# The previous portfolio container (fable5-portfolio) also bound 3000. If it is
# still running under a different compose project, the new stack cannot start
# and the error surfaces as an opaque bind failure mid-deploy.
say "Checking port ${APP_PORT}"
CONFLICT="$(docker ps --format '{{.Names}} {{.Ports}}' | grep ":${APP_PORT}->" || true)"
if [ -n "$CONFLICT" ]; then
  echo "    Port ${APP_PORT} is currently bound by:"
  echo "      $CONFLICT"
  if echo "$CONFLICT" | grep -q 'dashboard-porto'; then
    echo "    That is this stack — compose will replace it. Fine."
  else
    warn "A different container holds the port. Stop it before deploying:"
    echo "      docker stop $(echo "$CONFLICT" | awk '{print $1}')"
    echo "      docker rm   $(echo "$CONFLICT" | awk '{print $1}')"
  fi
else
  echo "    port ${APP_PORT} is free"
fi

# ── Repository ───────────────────────────────────────────────────────────────
say "Preparing ${DEPLOY_PATH}"
if [ ! -d "$DEPLOY_PATH/.git" ]; then
  sudo mkdir -p "$(dirname "$DEPLOY_PATH")"
  sudo chown "$(id -u):$(id -g)" "$(dirname "$DEPLOY_PATH")"
  git clone "$REPO_URL" "$DEPLOY_PATH"
  echo "    cloned"
else
  git -C "$DEPLOY_PATH" fetch --quiet origin main
  git -C "$DEPLOY_PATH" reset --hard --quiet origin/main
  echo "    updated to origin/main"
fi

# The deploy does `git reset --hard`, which would discard a hand-edited .env —
# so it must be ignored locally as well as in the repo.
cd "$DEPLOY_PATH"

# ── Persistent volume ────────────────────────────────────────────────────────
# Holds the SQLite time-series and the live site registry. Everything else in
# the deployment is rebuildable from git; this is not.
say "Ensuring the console-data volume exists"
if docker volume inspect console-data >/dev/null 2>&1; then
  echo "    console-data already exists — history preserved"
else
  docker volume create console-data >/dev/null
  echo "    created console-data"
fi

# ── Runtime env ──────────────────────────────────────────────────────────────
# CI overwrites this on every deploy; writing it here means a manual
# `docker compose up` before the first pipeline run also works.
say "Runtime environment"
if [ -f .env ]; then
  echo "    .env already present — left alone (CI rewrites it on deploy)"
else
  umask 077
  cat > .env <<'ENVFILE'
# Written by scripts/bootstrap-vps.sh; overwritten by the CI deploy.
SITE_URL=http://localhost:3000
MONITOR_API_TOKEN=
CONSOLE_ADMIN_TOKEN=
ENVFILE
  echo "    wrote a placeholder .env (chmod 600)"
fi

say "Done"
cat <<'NEXT'
Remaining steps, all in GitHub → Settings:

  Secrets (Settings → Secrets and variables → Actions → Secrets)
    VPS_HOST              this machine's IP or hostname
    VPS_USERNAME          the user you are running this as
    VPS_SSH_KEY           a private key whose public half is in ~/.ssh/authorized_keys
    VPS_PORT              22, unless you moved it
    MONITOR_API_TOKEN     the token your monitored apps expect
    CONSOLE_ADMIN_TOKEN   openssl rand -hex 24   (omit to leave console writes open)

  Variables (same page → Variables tab)
    SITE_URL              https://your-domain   — share-card URLs are built from this
    DEPLOY_PATH           only if not /var/www/dashboard-porto

Then push to main, or run the workflow manually from the Actions tab.
NEXT
