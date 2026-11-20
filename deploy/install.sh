#!/usr/bin/env bash
# Samoon — one-time server install (Ubuntu/Debian/RHEL-like, run as root).
#
# The repository is PRIVATE, so the server needs read-only access first.
# On the server, as root:
#   ssh-keygen -t ed25519 -f /root/.ssh/samoon_deploy -N ""
#   cat /root/.ssh/samoon_deploy.pub   # add it: GitHub repo → Settings → Deploy keys (read-only)
#   append to /root/.ssh/config these three lines:
#     Host github.com
#       IdentityFile /root/.ssh/samoon_deploy
#       IdentitiesOnly yes
#   ssh -T git@github.com              # should greet you by the key name
# Then:
#
#   git clone -b my-new-branch git@github.com:shipittofar/samoon_Q.git /opt/samoon
#   DOMAIN=samoon.example.com bash /opt/samoon/deploy/install.sh
#
# What it does, and what it deliberately does NOT do:
#   - installs git, docker and the compose plugin if they are missing;
#   - clones the branch into /opt/samoon (or fast-forwards an existing clone);
#   - writes /opt/samoon/.env from deploy/env.example (stops if CHANGE_ME remains);
#   - creates a self-signed TLS certificate only if none exists (replace it later);
#   - builds and starts the stack, waits for the app to be healthy;
#   - installs the `samoon` command (update / status / logs / admin-add).
# It never changes SSH or any other listening port. It only opens 80 and 443 in
# ufw when ufw is already active, and it refuses to start if 80/443 are taken.
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:shipittofar/samoon_Q.git}"
BRANCH="${BRANCH:-my-new-branch}"
INSTALL_DIR="${INSTALL_DIR:-/opt/samoon}"
SSL_DIR="${SSL_DIR:-/etc/samoon/ssl}"
DOMAIN="${DOMAIN:-}"

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root (sudo bash install.sh)."

# ── 1. base packages and docker ──────────────────────────────────────────────
say "Installing base packages"
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -y >/dev/null
  apt-get install -y git curl ca-certificates openssl iproute2 >/dev/null
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y git curl ca-certificates openssl iproute >/dev/null
else
  die "Unsupported package manager (need apt or dnf)."
fi

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker (official convenience script)"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "docker compose plugin missing — install docker-compose-plugin and re-run."
systemctl enable --now docker >/dev/null 2>&1 || true

# ── 2. ports 80/443 must be free (others are left alone) ─────────────────────
for port in 80 443; do
  if ss -ltnH "( sport = :${port} )" | grep -q .; then
    die "Port ${port} is already in use — stop that service first (nothing was changed)."
  fi
done

# ── 3. code ─────────────────────────────────────────────────────────────────
if [ -d "${INSTALL_DIR}/.git" ]; then
  say "Updating existing checkout in ${INSTALL_DIR}"
  git -C "${INSTALL_DIR}" fetch origin "${BRANCH}"
  git -C "${INSTALL_DIR}" checkout -q "${BRANCH}"
  git -C "${INSTALL_DIR}" pull --ff-only origin "${BRANCH}"
else
  say "Cloning ${REPO_URL} (${BRANCH}) into ${INSTALL_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
fi
echo "${BRANCH}" > "${INSTALL_DIR}/.deploy-branch"

# ── 4. environment file ─────────────────────────────────────────────────────
ENV_FILE="${INSTALL_DIR}/.env"
if [ ! -f "${ENV_FILE}" ]; then
  cp "${INSTALL_DIR}/deploy/env.example" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  say "Created ${ENV_FILE}"
fi
if [ -n "${DOMAIN}" ]; then
  sed -i \
    -e "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" \
    -e "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://${DOMAIN}|" \
    -e "s|^NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN}/api|" \
    -e "s|^NEXT_PUBLIC_WS_BASE_URL=.*|NEXT_PUBLIC_WS_BASE_URL=wss://${DOMAIN}/ws|" \
    -e "s|^NEXT_PUBLIC_ROOT_DOMAIN=.*|NEXT_PUBLIC_ROOT_DOMAIN=${DOMAIN}|" \
    "${ENV_FILE}"
fi
if grep -q "CHANGE_ME" "${ENV_FILE}"; then
  die "Edit ${ENV_FILE} (replace every CHANGE_ME, or re-run with DOMAIN=...), then run this again."
fi

# ── 5. the backend must be running (nginx routes /api, /admin, /ws to it) ────
docker network inspect shared-net >/dev/null 2>&1 || { say "Creating docker network shared-net"; docker network create shared-net >/dev/null; }
if ! docker ps --format '{{.Names}}' | grep -qx "$(grep '^BACKEND_CONTAINER=' "${ENV_FILE}" | cut -d= -f2)"; then
  die "The backend container is not running. Start the Django backend stack first (it must be on shared-net), then re-run."
fi
if ! docker volume inspect backend_static_volume >/dev/null 2>&1; then
  warn "Volume backend_static_volume not found — creating an empty one (the backend normally owns it)."
  docker volume create backend_static_volume >/dev/null
fi

# ── 6. TLS certificate (only if none exists) ────────────────────────────────
mkdir -p "${SSL_DIR}"
if [ ! -f "${SSL_DIR}/fullchain.pem" ] || [ ! -f "${SSL_DIR}/privkey.pem" ]; then
  CN="${DOMAIN:-localhost}"
  warn "No certificate in ${SSL_DIR} — creating a self-signed one for ${CN}."
  warn "Browsers will warn until you replace it with a real one (e.g. Let's Encrypt → copy to ${SSL_DIR})."
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 -subj "/CN=${CN}" \
    -keyout "${SSL_DIR}/privkey.pem" -out "${SSL_DIR}/fullchain.pem" >/dev/null 2>&1
  chmod 600 "${SSL_DIR}/privkey.pem"
fi

# ── 7. firewall: only add 80/443, only if ufw is already on ──────────────────
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  say "ufw is active — allowing 80/tcp and 443/tcp (no other rule changes)"
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

# ── 8. build and start ──────────────────────────────────────────────────────
cd "${INSTALL_DIR}"
say "Building and starting (the first build takes several minutes)"
docker compose --env-file "${ENV_FILE}" up -d --build

say "Waiting for the app to become healthy"
for _ in $(seq 1 60); do
  state="$(docker inspect -f '{{.State.Health.Status}}' samoon-app 2>/dev/null || echo starting)"
  [ "${state}" = "healthy" ] && break
  sleep 3
done
[ "${state}" = "healthy" ] || die "App did not become healthy. Check: docker compose logs app"

# ── 9. install the `samoon` command ─────────────────────────────────────────
chmod +x "${INSTALL_DIR}/deploy/samoon.sh"
ln -sf "${INSTALL_DIR}/deploy/samoon.sh" /usr/local/bin/samoon
say "Installed. Commands:  samoon status | samoon update | samoon logs [service] | samoon admin-add"
say "Site: https://${DOMAIN:-<your-server>}   (self-signed until a real certificate is in ${SSL_DIR})"
