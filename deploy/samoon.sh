#!/usr/bin/env bash
# Samoon day-to-day commands (installed as /usr/local/bin/samoon by install.sh).
#
#   samoon status             containers, health, deployed commit
#   samoon update             pull the branch from GitHub and redeploy
#   samoon logs [service]     follow logs (default: app)
#   samoon restart            restart the stack without rebuilding
#   samoon admin-add          create a platform admin in the backend (asks for email/password)
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/samoon}"
ENV_FILE="${INSTALL_DIR}/.env"

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "${INSTALL_DIR}/.git" ] || die "${INSTALL_DIR} is not installed — run deploy/install.sh first."
cd "${INSTALL_DIR}"
BRANCH="$(cat .deploy-branch 2>/dev/null || echo my-new-branch)"

compose() { docker compose --env-file "${ENV_FILE}" "$@"; }

backend_name() {
  grep '^BACKEND_CONTAINER=' "${ENV_FILE}" 2>/dev/null | cut -d= -f2 || true
}

cmd_status() {
  echo "Branch : ${BRANCH}"
  echo "Commit : $(git log -1 --format='%h %s (%cr)')"
  compose ps
  echo "Health : $(docker inspect -f '{{.State.Health.Status}}' samoon-app 2>/dev/null || echo unknown)"
}

cmd_update() {
  if [ -n "$(git status --porcelain)" ]; then
    die "The checkout has local changes — refusing to update. Run 'git status' in ${INSTALL_DIR}."
  fi
  say "Fetching ${BRANCH} from GitHub"
  git fetch origin "${BRANCH}"
  local before after
  before="$(git rev-parse HEAD)"
  git checkout -q "${BRANCH}"
  git pull --ff-only origin "${BRANCH}"
  after="$(git rev-parse HEAD)"
  if [ "${before}" = "${after}" ]; then
    say "Already up to date (${after:0:7}). Rebuilding anyway so env changes apply."
  else
    say "Updated ${before:0:7} → ${after:0:7}"
  fi
  say "Rebuilding and restarting (NEXT_PUBLIC_* values are compiled in, so a rebuild is required)"
  compose up -d --build
  for _ in $(seq 1 60); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' samoon-app 2>/dev/null)" = "healthy" ] && { say "Healthy."; return 0; }
    sleep 3
  done
  die "App is not healthy after the update. Check: samoon logs app"
}

cmd_logs() {
  compose logs -f --tail=200 "${1:-app}"
}

cmd_restart() {
  compose restart
}

cmd_admin_add() {
  local backend
  backend="$(backend_name)"
  [ -n "${backend}" ] || die "BACKEND_CONTAINER is not set in ${ENV_FILE}."
  docker ps --format '{{.Names}}' | grep -qx "${backend}" || die "Backend container '${backend}' is not running."
  say "Creating a platform admin in '${backend}'. The password is typed here and not stored."
  docker exec -it "${backend}" python manage.py createsuperuser
}

case "${1:-status}" in
  status)     cmd_status ;;
  update)     cmd_update ;;
  logs)       shift || true; cmd_logs "${1:-}" ;;
  restart)    cmd_restart ;;
  admin-add)  cmd_admin_add ;;
  -h|--help|help)
    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "Unknown command: $1 (try: samoon help)" ;;
esac
