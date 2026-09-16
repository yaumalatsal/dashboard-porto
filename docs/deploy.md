# Deployment

Push to `main` → verify → build image → push to GHCR → deploy over SSH → wait
for the app to answer. If it never answers, the deploy fails loudly with the
container logs attached rather than reporting green over an outage.

---

## One-time setup

### 1. On the VPS

```bash
curl -fsSL https://raw.githubusercontent.com/yaumalatsal/astrolobe-porto/main/scripts/bootstrap-vps.sh | bash
```

It checks Docker and the Compose plugin, warns if something else already holds
port 3000, clones the repo to `/var/www/astrolobe-porto`, creates the
`console-data` volume, and writes a placeholder `.env`. Re-running is safe.

The CI user must be able to run `docker` **without sudo** — the pipeline does
not have a password.

### 2. GitHub secrets

Settings → Secrets and variables → Actions → **Secrets**

| Secret | What it is |
|---|---|
| `VPS_HOST` | IP or hostname |
| `VPS_USERNAME` | the SSH user that owns the deploy directory |
| `VPS_SSH_KEY` | **private** key; its public half goes in `~/.ssh/authorized_keys` |
| `VPS_PORT` | `22` unless you moved it |
| `MONITOR_API_TOKEN` | the token your monitored apps expect on `X-Monitor-Token` |
| `CONSOLE_ADMIN_TOKEN` | `openssl rand -hex 24`. Omit to leave console writes open. |

Generate a deploy key with `ssh-keygen -t ed25519 -C "github-actions" -f deploy_key`,
put `deploy_key.pub` in the VPS user's `authorized_keys`, and paste the private
`deploy_key` into `VPS_SSH_KEY` — the whole file including the header lines.

### 3. GitHub variables

Same page → **Variables** tab. These are not secret and are visible in logs.

| Variable | What it is |
|---|---|
| `SITE_URL` | `https://your-domain` — **set this before your first deploy**, see below |
| `DEPLOY_PATH` | only if you did not use `/var/www/astrolobe-porto` |

> **`SITE_URL` is baked at build time, not just read at runtime.**
> Statically prerendered pages (`/work/*`, `/orrery-lab`) generate their
> metadata during `next build`, so the OpenGraph and Twitter image URLs are
> frozen into the HTML. Leave it unset and every link you share previews
> `http://localhost:3000/images/...` — a broken thumbnail on every post.
> It is passed as a Docker build argument *and* as a runtime variable, because
> the ISR homepage re-reads it on revalidation.

### 4. Make the image pullable

GHCR packages are **private by default**. The pipeline logs the VPS into GHCR
with the workflow token, so this works out of the box — but if you would rather
not authenticate on every deploy, mark the package public once at
`github.com/users/yaumalatsal/packages/container/astrolobe-porto/settings`.

---

## What each job does

| Job | Runs on | Purpose |
|---|---|---|
| `verify` | every push **and pull request** | `tsc --noEmit`, lint, `next build`. Nothing is published unless this passes. |
| `build-and-push` | push to `main` only | Builds the image, tags `latest` and `sha-<short>`, pushes to GHCR with layer caching. |
| `deploy` | push to `main` only | SSH, pull, restart, then poll `/api/monitor/status` for 60s. |

`CONSOLE_DISABLE_POLLER=1` is set during every build. Without it the monitor
starts polling your production endpoints from a GitHub runner on each push.

Concurrency is `deploy-<ref>` with `cancel-in-progress: false` — a deploy is
never cancelled half-way through `docker compose up`.

---

## Rolling back

Every build is tagged with its commit sha.

```bash
ssh you@vps
cd /var/www/astrolobe-porto

docker pull ghcr.io/yaumalatsal/astrolobe-porto:sha-1a2b3c4
docker tag  ghcr.io/yaumalatsal/astrolobe-porto:sha-1a2b3c4 \
            ghcr.io/yaumalatsal/astrolobe-porto:latest
docker compose up -d
```

Find the sha in the Actions run, or list what is on the machine with
`docker images ghcr.io/yaumalatsal/astrolobe-porto`.

---

## The volume is the only irreplaceable thing

`console-data` holds the SQLite time-series **and** the live site registry.
Everything else is rebuildable from git. Deleting it resets all uptime history.

```bash
# back up
docker run --rm -v console-data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/console-data-$(date +%F).tgz -C /data .

# restore
docker run --rm -v console-data:/data -v "$PWD:/backup" alpine \
  sh -c 'cd /data && tar xzf /backup/console-data-2026-09-16.tgz'
```

Worth a weekly cron.

---

## When a deploy fails

The pipeline prints `docker compose ps` and the last 80 log lines before
exiting, so the Actions log usually contains the answer. Common causes:

**Port 3000 already bound.** Your previous `fable5-portfolio` container may
still hold it under a different compose project, in which case compose will not
replace it:

```bash
docker ps --format '{{.Names}} {{.Ports}}' | grep 3000
docker stop fable5-portfolio && docker rm fable5-portfolio
```

**`unauthorized` on `docker compose pull`.** The GHCR login failed, or the
package is private and the token lacks `read:packages`. Test by hand:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u yaumalatsal --password-stdin
docker pull ghcr.io/yaumalatsal/astrolobe-porto:latest
```

**Healthy check times out.** The container started and died. `docker compose logs web`.
A frequent cause is the data directory not being writable — the app runs as
uid 1001, and the volume must be owned by it.

**`git reset --hard` conflicts.** The deploy force-resets to `origin/main`, so
uncommitted edits on the VPS are discarded by design. `.env` survives because it
is untracked and gitignored.

---

## Security posture

Console **reads are public**, deliberately — the status wall is portfolio
evidence. Console **writes are open unless `CONSOLE_ADMIN_TOKEN` is set**.

With it unset on a public URL, anyone who finds the console can add or delete
monitored applications, and `POST /api/monitor/sites` makes your server fetch
any URL they supply — including addresses only your VPS can reach, such as the
LMS on the same machine. Set the secret before the site is publicly reachable.
