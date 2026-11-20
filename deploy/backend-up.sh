#!/usr/bin/env bash
# Samoon — bring up the Django backend stack on this server (run as root).
#
# Called by deploy/install.sh when the backend container is not running; can
# also be run on its own:  sudo ADDR=203.0.113.10 bash backend-up.sh
#
#   - clones the backend branch into /opt/samoonbackend (or fast-forwards it);
#   - creates the shared docker network;
#   - writes /opt/samoonbackend/.env ONCE with fresh random secrets (never
#     overwritten, so the database password stays the same on re-runs);
#   - builds and starts the stack and waits for the web container to be healthy.
# Ports are published on 127.0.0.1 only (set in the backend's docker-compose.yml).
set -euo pipefail

BACKEND_REPO="${BACKEND_REPO:-https://github.com/shipittofar/samoonbackend.git}"
BACKEND_BRANCH="${BACKEND_BRANCH:-server-env-settings}"
BACKEND_DIR="${BACKEND_DIR:-/opt/samoonbackend}"
ADDR="${ADDR:-${SERVER_IP:-${DOMAIN:-}}}"

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root."
[ -n "${ADDR}" ] || die "Set ADDR (or SERVER_IP / DOMAIN) to the address the site is served on."
command -v openssl >/dev/null 2>&1 || die "openssl is required."

if [ -d "${BACKEND_DIR}/.git" ]; then
  say "Updating backend checkout in ${BACKEND_DIR}"
  git -C "${BACKEND_DIR}" fetch origin "${BACKEND_BRANCH}"
  git -C "${BACKEND_DIR}" checkout -q "${BACKEND_BRANCH}"
  git -C "${BACKEND_DIR}" pull --ff-only origin "${BACKEND_BRANCH}"
else
  say "Cloning ${BACKEND_REPO} (${BACKEND_BRANCH}) into ${BACKEND_DIR}"
  git clone --branch "${BACKEND_BRANCH}" "${BACKEND_REPO}" "${BACKEND_DIR}"
fi

docker network inspect shared-net >/dev/null 2>&1 || { say "Creating docker network shared-net"; docker network create shared-net >/dev/null; }

ENV_FILE="${BACKEND_DIR}/.env"
if [ ! -f "${ENV_FILE}" ]; then
  say "Writing ${ENV_FILE} with fresh random secrets"
  PG_PASS="$(openssl rand -hex 24)"
  DJ_KEY="$(openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-60)"
  ORIGIN="https://${ADDR}"
  umask 077
  cat > "${ENV_FILE}" <<EOF
# Written by deploy/backend-up.sh. Keep this file private (it is in .gitignore).

DJANGO_DEBUG=False
DJANGO_SECRET_KEY=${DJ_KEY}
DJANGO_ALLOWED_HOSTS=${ADDR},localhost,127.0.0.1,web
CSRF_TRUSTED_ORIGINS=${ORIGIN}
CORS_ALLOWED_ORIGINS=${ORIGIN}
PUBLIC_API_URL=${ORIGIN}/api
PUBLIC_SITE_URL=${ORIGIN}

POSTGRES_DB=samoon
POSTGRES_USER=samoon
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379/1
EOF
  chmod 600 "${ENV_FILE}"
else
  say "${ENV_FILE} already exists — keeping it (edit it by hand to change settings)"
fi

cd "${BACKEND_DIR}"
say "Building and starting the backend (first build takes several minutes)"
docker compose --env-file "${ENV_FILE}" up -d --build web postgres redis

say "Waiting for the backend to be healthy"
state=starting
for _ in $(seq 1 90); do
  state="$(docker inspect -f '{{.State.Health.Status}}' smartrestaurant-web 2>/dev/null || echo starting)"
  [ "${state}" = "healthy" ] && break
  sleep 3
done
[ "${state}" = "healthy" ] || die "Backend did not become healthy. Check: cd ${BACKEND_DIR} && docker compose logs web"
say "Backend is up."
