#!/usr/bin/env bash
# Samoon — server install (Ubuntu/Debian/RHEL-like, run as root).
#
# One command on a fresh server (as root). Use the server's public IP when
# there is no domain yet, or DOMAIN=... once one points at the server:
#
#   curl -fsSL https://raw.githubusercontent.com/shipittofar/samoon_Q/my-new-branch/deploy/install.sh -o install.sh && SERVER_IP=203.0.113.10 bash install.sh
#
# Safe to run again on an installed server:
#   - with no SERVER_IP/DOMAIN it reuses the address already in /opt/samoon/.env;
#   - with a new SERVER_IP/DOMAIN it moves the whole site to that address
#     (frontend and backend settings, and the self-signed certificate if that
#     is what is in use) — `samoon set-address <ip-or-domain>` does the same.
#
# What it does, and what it deliberately does NOT do:
#   - installs git, docker and the compose plugin if they are missing;
#   - if Docker Hub is unreachable (blocked), configures registry mirrors for
#     dockerd (DOCKER_MIRRORS) — only when no mirror is configured yet;
#   - clones the branch into /opt/samoon (or fast-forwards an existing clone);
#   - writes /opt/samoon/.env from deploy/env.example, filled from the address;
#   - brings up (or updates) the backend with deploy/backend-up.sh;
#   - gets a trusted Let's Encrypt certificate for a domain (deploy/ssl.sh):
#     DNS and port 80 are checked first, the existing one is kept while it is
#     valid, renewal is scheduled. A temporary self-signed certificate is used
#     only so nginx can start, and the install fails if Let's Encrypt fails;
#   - an IP address (no domain) keeps a self-signed certificate: it cannot be
#     trusted by browsers, and the install says so;
#   - builds and starts the stack, waits for the app to be healthy;
#   - installs the `samoon` command (update / status / logs / admin-add / set-address).
# It never changes SSH or any other listening port. It only opens 80 and 443 in
# ufw when ufw is already active, and it refuses to start if 80/443 are taken
# by something other than this site's own nginx.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/shipittofar/samoon_Q.git}"
BRANCH="${BRANCH:-my-new-branch}"
INSTALL_DIR="${INSTALL_DIR:-/opt/samoon}"
SSL_DIR="${SSL_DIR:-/etc/samoon/ssl}"
DOMAIN="${DOMAIN:-}"
SERVER_IP="${SERVER_IP:-}"
# Optional extra names on the same certificate, e.g. EXTRA_DOMAINS=www.example.com
# (their DNS must point to this server too). CERTBOT_EMAIL gets expiry reminders.
EXTRA_DOMAINS="${EXTRA_DOMAINS:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
# Tried in order when Docker Hub cannot be reached. Override with your own list.
DOCKER_MIRRORS="${DOCKER_MIRRORS:-https://docker.arvancloud.ir https://registry.docker.ir}"
ENV_FILE="${INSTALL_DIR}/.env"
SELF_SIGNED_MARK="${SSL_DIR}/.samoon-self-signed"

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root (sudo bash install.sh)."

# The address the site is served on: a domain when given, otherwise the IP,
# otherwise the one an earlier install wrote to .env.
ADDR="${DOMAIN:-${SERVER_IP}}"
if [ -z "${ADDR}" ] && [ -f "${ENV_FILE}" ]; then
  ADDR="$(grep '^DOMAIN=' "${ENV_FILE}" | cut -d= -f2- || true)"
  [ "${ADDR}" = "CHANGE_ME" ] && ADDR=""
  [ -n "${ADDR}" ] && say "Using the address from ${ENV_FILE}: ${ADDR}"
fi
[ -n "${ADDR}" ] || die "Set SERVER_IP=<public IP> (or DOMAIN=<domain>) and run again."

IS_IP=0
if [[ "${ADDR}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then IS_IP=1; fi

# ── 1. base packages and docker ──────────────────────────────────────────────
say "Installing base packages"
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -y >/dev/null
  apt-get install -y git curl ca-certificates openssl iproute2 python3 cron gzip >/dev/null
  systemctl enable --now cron >/dev/null 2>&1 || true
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y git curl ca-certificates openssl iproute python3 cronie gzip >/dev/null
  systemctl enable --now crond >/dev/null 2>&1 || true
else
  die "Unsupported package manager (need apt or dnf)."
fi

if ! command -v docker >/dev/null 2>&1; then
  # Distro packages first: some networks block download.docker.com (403).
  say "Installing Docker from the distribution repositories"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y docker.io >/dev/null 2>&1 || true
    apt-get install -y docker-compose-v2 >/dev/null 2>&1 || apt-get install -y docker-compose-plugin >/dev/null 2>&1 || true
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y docker docker-compose-plugin >/dev/null 2>&1 || true
  fi
fi
if ! command -v docker >/dev/null 2>&1; then
  warn "Distribution packages unavailable — trying the official Docker script"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "docker compose plugin missing — install docker-compose-plugin and re-run."
systemctl enable --now docker >/dev/null 2>&1 || true

# ── 2. Docker Hub reachable? Otherwise configure registry mirrors ────────────
# Images used by both stacks come from Docker Hub (node, python, nginx,
# postgres, redis). Where Docker Hub is blocked, pulls fail with 403 or time
# out; dockerd's registry-mirrors setting sends those pulls to a mirror.
probe_pull() { timeout 90 docker pull -q nginx:alpine >/dev/null 2>&1; }
if probe_pull; then
  say "Docker Hub is reachable"
else
  DAEMON_JSON=/etc/docker/daemon.json
  if [ -f "${DAEMON_JSON}" ] && grep -q '"registry-mirrors"' "${DAEMON_JSON}"; then
    die "Cannot pull images from Docker Hub, and ${DAEMON_JSON} already lists registry mirrors (they do not work either). Fix the mirrors there, then re-run."
  fi
  warn "Docker Hub is not reachable — configuring registry mirrors: ${DOCKER_MIRRORS}"
  mkdir -p /etc/docker
  [ -f "${DAEMON_JSON}" ] && cp "${DAEMON_JSON}" "${DAEMON_JSON}.bak.$(date +%s)"
  # Merge into any existing settings (keeps whatever else is configured there).
  python3 - "${DAEMON_JSON}" ${DOCKER_MIRRORS} <<'PY'
import json, os, sys
path, mirrors = sys.argv[1], sys.argv[2:]
data = {}
if os.path.exists(path) and os.path.getsize(path) > 0:
    with open(path) as f:
        data = json.load(f)
data["registry-mirrors"] = mirrors
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
  systemctl restart docker
  probe_pull || die "Still cannot pull images through the mirrors (${DOCKER_MIRRORS}). Set DOCKER_MIRRORS=\"https://your-mirror ...\" and re-run (the previous ${DAEMON_JSON} was backed up)."
  say "Pulling through the registry mirror works"
fi

# ── 3. ports 80/443 must be free, or already ours ────────────────────────────
if docker ps --format '{{.Names}}' | grep -qx samoon-nginx; then
  say "Ports 80/443 are served by this site's nginx (samoon-nginx) — re-installing over it"
else
  for port in 80 443; do
    if ss -ltnH "( sport = :${port} )" | grep -q .; then
      die "Port ${port} is already in use — stop that service first (nothing was changed)."
    fi
  done
fi

# ── 4. code ─────────────────────────────────────────────────────────────────
if [ -d "${INSTALL_DIR}/.git" ]; then
  say "Updating existing checkout in ${INSTALL_DIR}"
  git -C "${INSTALL_DIR}" -c core.fileMode=false fetch origin "${BRANCH}"
  git -C "${INSTALL_DIR}" -c core.fileMode=false checkout -q "${BRANCH}"
  git -C "${INSTALL_DIR}" -c core.fileMode=false pull --ff-only origin "${BRANCH}"
else
  say "Cloning ${REPO_URL} (${BRANCH}) into ${INSTALL_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
fi
# chmod +x on scripts must not count as a local change (it would block `samoon update`).
git -C "${INSTALL_DIR}" config core.fileMode false
echo "${BRANCH}" > "${INSTALL_DIR}/.deploy-branch"

# ── 5. environment file ─────────────────────────────────────────────────────
if [ ! -f "${ENV_FILE}" ]; then
  cp "${INSTALL_DIR}/deploy/env.example" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  say "Created ${ENV_FILE}"
fi
# Keys added to env.example after the first install are appended once.
while IFS= read -r line; do
  key="${line%%=*}"
  case "${key}" in ''|\#*) continue ;; esac
  grep -q "^${key}=" "${ENV_FILE}" || { echo "${line}" >> "${ENV_FILE}"; say "Added ${key} to ${ENV_FILE}"; }
done < "${INSTALL_DIR}/deploy/env.example"
# No tenant subdomains on a bare IP, so the root domain stays empty.
ROOT_DOMAIN_VALUE=""
[ "${IS_IP}" -eq 0 ] && ROOT_DOMAIN_VALUE="${ADDR}"
sed -i \
  -e "s|^DOMAIN=.*|DOMAIN=${ADDR}|" \
  -e "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://${ADDR}|" \
  -e "s|^NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=https://${ADDR}/api|" \
  -e "s|^NEXT_PUBLIC_WS_BASE_URL=.*|NEXT_PUBLIC_WS_BASE_URL=wss://${ADDR}/ws|" \
  -e "s|^NEXT_PUBLIC_ROOT_DOMAIN=.*|NEXT_PUBLIC_ROOT_DOMAIN=${ROOT_DOMAIN_VALUE}|" \
  "${ENV_FILE}"
if grep -q "CHANGE_ME" "${ENV_FILE}"; then
  die "Edit ${ENV_FILE} and replace every CHANGE_ME, then run again."
fi

# ── 6. backend (nginx routes /api, /admin, /ws to it) ────────────────────────
# Run every time: first install brings it up; later runs pull it, refresh its
# address settings for ${ADDR} and restart what changed.
docker network inspect shared-net >/dev/null 2>&1 || { say "Creating docker network shared-net"; docker network create shared-net >/dev/null; }
say "Bringing up / updating the backend (deploy/backend-up.sh)"
ADDR="${ADDR}" bash "${INSTALL_DIR}/deploy/backend-up.sh"
if ! docker volume inspect backend_static_volume >/dev/null 2>&1; then
  warn "Volume backend_static_volume not found — creating an empty one (the backend normally owns it)."
  docker volume create backend_static_volume >/dev/null
fi

# ── 7. TLS certificate ──────────────────────────────────────────────────────
# A certificate this script generated carries a marker with its address; it is
# replaced when the address changes. A certificate without the marker is
# yours (e.g. Let's Encrypt) and is never touched.
mkdir -p "${SSL_DIR}" /var/www/certbot
# This certificate is only a placeholder so nginx can start. The real one is
# requested from Let's Encrypt in step 10 (deploy/ssl.sh); if that fails the
# install stops with the reason, and the placeholder is never called HTTPS.
make_self_signed() {
  warn "Creating a temporary self-signed certificate for ${ADDR} in ${SSL_DIR} so nginx can start."
  if [ "${IS_IP}" -eq 1 ]; then warn "An IP address cannot get a Let's Encrypt certificate; this one stays in use (browsers warn)."; fi
  if [ "${IS_IP}" -eq 1 ]; then SAN="IP:${ADDR}"; else SAN="DNS:${ADDR}"; fi
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 -subj "/CN=${ADDR}" \
    -addext "subjectAltName=${SAN}" \
    -keyout "${SSL_DIR}/privkey.pem" -out "${SSL_DIR}/fullchain.pem" >/dev/null 2>&1
  chmod 600 "${SSL_DIR}/privkey.pem"
  echo "${ADDR}" > "${SELF_SIGNED_MARK}"
}
if [ ! -f "${SSL_DIR}/fullchain.pem" ] || [ ! -f "${SSL_DIR}/privkey.pem" ]; then
  make_self_signed
elif [ -f "${SELF_SIGNED_MARK}" ] && [ "$(cat "${SELF_SIGNED_MARK}")" != "${ADDR}" ]; then
  say "The address changed ($(cat "${SELF_SIGNED_MARK}") → ${ADDR}) — renewing the self-signed certificate"
  make_self_signed
fi

# ── 8. firewall: only add 80/443, only if ufw is already on ──────────────────
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  say "ufw is active — allowing 80/tcp and 443/tcp (no other rule changes)"
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

# ── 9. build and start ──────────────────────────────────────────────────────
cd "${INSTALL_DIR}"
say "Building and starting (the first build takes several minutes)"
docker compose --env-file "${ENV_FILE}" up -d --build
# nginx reads the certificate only at start; pick up a renewed one.
docker restart samoon-nginx >/dev/null 2>&1 || true

say "Waiting for the app to become healthy"
state=starting
for _ in $(seq 1 60); do
  state="$(docker inspect -f '{{.State.Health.Status}}' samoon-app 2>/dev/null || echo starting)"
  [ "${state}" = "healthy" ] && break
  sleep 3
done
[ "${state}" = "healthy" ] || die "App did not become healthy. Check: docker compose logs app"

# ── 10. install the `samoon` command ────────────────────────────────────────
chmod +x "${INSTALL_DIR}/deploy/samoon.sh" "${INSTALL_DIR}/deploy/ssl.sh"
ln -sf "${INSTALL_DIR}/deploy/samoon.sh" /usr/local/bin/samoon

# Daily database backup, on unless someone turned it off (samoon backup-schedule off
# leaves a marker so a re-run of the install does not turn it back on).
if [ ! -f /etc/cron.d/samoon-backup ] && [ ! -f /etc/samoon/.backup-schedule-off ]; then
  /usr/local/bin/samoon backup-schedule on || say "Could not turn on the daily backup (turn it on with: samoon backup-schedule on)"
fi
# ── 10b. trusted certificate from Let's Encrypt ────────────────────────────
# Needs nginx running (it answers the challenge on port 80), so it comes after
# the stack is up. It is idempotent: a current certificate is left alone.
if [ "${IS_IP}" -eq 0 ]; then
  say "Requesting a trusted Let's Encrypt certificate for ${ADDR}${EXTRA_DOMAINS:+ and ${EXTRA_DOMAINS}} (DNS and port 80 are checked first)"
  # shellcheck disable=SC2086
  if ! CERTBOT_EMAIL="${CERTBOT_EMAIL:-}" SSL_DIR="${SSL_DIR}" bash "${INSTALL_DIR}/deploy/ssl.sh" ensure "${ADDR}" ${EXTRA_DOMAINS:-}; then
    die "HTTPS is NOT set up (reason above). The site runs on a temporary self-signed certificate, which browsers do not trust. Fix the reason, then run: samoon ssl ensure ${ADDR}${EXTRA_DOMAINS:+ ${EXTRA_DOMAINS}}"
  fi
else
  warn "SERVER_IP given: no trusted certificate is possible for an IP address. Use DOMAIN=<domain> for HTTPS that browsers trust."
fi

say "Installed. Commands:  samoon status | samoon update | samoon logs [service] | samoon admin-add | samoon set-address <ip-or-domain> | samoon ssl status | samoon backup | samoon restore <file> | samoon help"
say "Site: https://${ADDR}"
