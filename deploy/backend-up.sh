#!/usr/bin/env bash
# Samoon — bring up the Django backend stack on this server (run as root).
#
# Called by deploy/install.sh on every install run; can also be run on its own:
#   sudo ADDR=203.0.113.10 bash backend-up.sh
#
#   - clones the backend branch into /opt/samoonbackend (or fast-forwards it);
#   - creates the shared docker network;
#   - writes /opt/samoonbackend/.env with fresh random secrets the first time;
#     on later runs keeps the secrets (the database password must not change)
#     and only refreshes the address settings (allowed hosts, CORS/CSRF
#     origins, public URLs), so moving to a new IP or a domain just works;
#   - builds and starts web, postgres, redis, celery and celery-beat (celery
#     processes uploaded images) and waits for web to be healthy.
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
  git -C "${BACKEND_DIR}" -c core.fileMode=false fetch origin "${BACKEND_BRANCH}"
  git -C "${BACKEND_DIR}" -c core.fileMode=false checkout -q "${BACKEND_BRANCH}"
  git -C "${BACKEND_DIR}" -c core.fileMode=false pull --ff-only origin "${BACKEND_BRANCH}"
else
  say "Cloning ${BACKEND_REPO} (${BACKEND_BRANCH}) into ${BACKEND_DIR}"
  git clone --branch "${BACKEND_BRANCH}" "${BACKEND_REPO}" "${BACKEND_DIR}"
fi

git -C "${BACKEND_DIR}" config core.fileMode false

docker network inspect shared-net >/dev/null 2>&1 || { say "Creating docker network shared-net"; docker network create shared-net >/dev/null; }

ENV_FILE="${BACKEND_DIR}/.env"
ORIGIN="https://${ADDR}"
if [ ! -f "${ENV_FILE}" ]; then
  say "Writing ${ENV_FILE} with fresh random secrets"
  PG_PASS="$(openssl rand -hex 24)"
  DJ_KEY="$(openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-60)"
  umask 077
  cat > "${ENV_FILE}" <<ENVFILE
# Written by deploy/backend-up.sh. Keep this file private (it is in .gitignore).
# The address lines are rewritten on every install run; everything else is yours.

DJANGO_DEBUG=False
DJANGO_SECRET_KEY=${DJ_KEY}

POSTGRES_DB=samoon
POSTGRES_USER=samoon
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379/1
ENVFILE
  chmod 600 "${ENV_FILE}"
fi

# Address settings follow the current address on every run (secrets untouched).
# smartrestaurant-web: the Next.js server calls Django by its container name.
set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${ENV_FILE}"
  fi
}
say "Backend address: ${ADDR}"
set_env DJANGO_ALLOWED_HOSTS "${ADDR},localhost,127.0.0.1,web,smartrestaurant-web"
set_env CSRF_TRUSTED_ORIGINS "${ORIGIN}"
set_env CORS_ALLOWED_ORIGINS "${ORIGIN}"
set_env PUBLIC_API_URL "${ORIGIN}/api"
set_env PUBLIC_SITE_URL "${ORIGIN}"

cd "${BACKEND_DIR}"
say "Building and starting the backend (first build takes several minutes)"
# celery + celery-beat: uploaded images are processed (and orphan uploads are
# cleaned up) by Celery; without them uploads never leave "uploaded".
docker compose --env-file "${ENV_FILE}" up -d --build web postgres redis celery celery-beat

say "Waiting for the backend to be healthy"
state=starting
for _ in $(seq 1 90); do
  state="$(docker inspect -f '{{.State.Health.Status}}' smartrestaurant-web 2>/dev/null || echo starting)"
  [ "${state}" = "healthy" ] && break
  sleep 3
done
[ "${state}" = "healthy" ] || die "Backend did not become healthy. Check: cd ${BACKEND_DIR} && docker compose logs web"
say "Backend is up."
