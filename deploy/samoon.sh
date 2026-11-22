#!/usr/bin/env bash
# Samoon day-to-day commands (installed as /usr/local/bin/samoon by install.sh).
#
#   samoon status                      containers, health, deployed commits (frontend + backend)
#   samoon update [backend|frontend]   pull from GitHub and redeploy (default: backend, then frontend)
#   samoon logs [service]              follow logs (default: app; backend: samoon logs web)
#   samoon restart                     restart the frontend stack without rebuilding
#   samoon admin-add [mobile]          add a platform superuser: the first one directly; later ones
#                                      need "Allow superuser requests" on and approval in /admin/
#   samoon set-address <ip-or-domain>  move the site to a new IP or domain (frontend + backend
#                                      settings, self-signed certificate) by re-running the install
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/samoon}"
ENV_FILE="${INSTALL_DIR}/.env"
BACKEND_DIR="${BACKEND_DIR:-/opt/samoonbackend}"
BACKEND_ENV="${BACKEND_DIR}/.env"

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "${INSTALL_DIR}/.git" ] || die "${INSTALL_DIR} is not installed — run deploy/install.sh first."
cd "${INSTALL_DIR}"
BRANCH="$(cat .deploy-branch 2>/dev/null || echo my-new-branch)"

compose() { docker compose --env-file "${ENV_FILE}" "$@"; }
backend_compose() { (cd "${BACKEND_DIR}" && docker compose --env-file "${BACKEND_ENV}" "$@"); }

has_backend() { [ -d "${BACKEND_DIR}/.git" ]; }

backend_name() {
  grep '^BACKEND_CONTAINER=' "${ENV_FILE}" 2>/dev/null | cut -d= -f2 || true
}

health_of() { docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null || echo unknown; }

# Pull the current branch of a checkout; prints what changed. Refuses when tracked
# FILE CONTENT was changed locally. Untracked files (.env, .deploy-branch) and
# permission-only changes (chmod +x on a script) are not "local changes" and never
# block an update.
pull_checkout() {
  local dir="$1" label="$2" branch before after
  local g=(git -C "${dir}" -c core.fileMode=false)
  if [ -n "$("${g[@]}" status --porcelain --untracked-files=no)" ]; then
    die "${label}: the checkout has local changes — refusing to update. Run 'git -C ${dir} status'."
  fi
  branch="${3:-$("${g[@]}" rev-parse --abbrev-ref HEAD)}"
  [ "${branch}" != "HEAD" ] || die "${label}: the checkout is on a detached HEAD."
  say "${label}: fetching ${branch} from GitHub"
  "${g[@]}" fetch origin "${branch}"
  before="$("${g[@]}" rev-parse HEAD)"
  "${g[@]}" checkout -q "${branch}"
  "${g[@]}" pull --ff-only origin "${branch}"
  after="$("${g[@]}" rev-parse HEAD)"
  if [ "${before}" = "${after}" ]; then
    say "${label}: already up to date (${after:0:7})"
  else
    say "${label}: updated ${before:0:7} → ${after:0:7}"
    "${g[@]}" log --oneline "${before}..${after}" | head -10 | sed 's/^/      /'
  fi
}

wait_healthy() {
  local container="$1" tries="$2"
  for _ in $(seq 1 "${tries}"); do
    [ "$(health_of "${container}")" = "healthy" ] && return 0
    sleep "${SAMOON_HEALTH_INTERVAL:-3}"
  done
  return 1
}

cmd_status() {
  echo "Frontend : ${BRANCH}  $(git log -1 --format='%h %s (%cr)')"
  if has_backend; then
    echo "Backend  : $(git -C "${BACKEND_DIR}" rev-parse --abbrev-ref HEAD)  $(git -C "${BACKEND_DIR}" log -1 --format='%h %s (%cr)')"
  else
    echo "Backend  : not installed in ${BACKEND_DIR}"
  fi
  echo
  compose ps
  if has_backend; then
    echo
    backend_compose ps
  fi
  echo
  echo "Health   : frontend $(health_of samoon-app), backend $(health_of "$(backend_name)")"
}

update_backend() {
  if ! has_backend; then
    say "Backend: not installed in ${BACKEND_DIR} — skipping"
    return 0
  fi
  pull_checkout "${BACKEND_DIR}" "Backend"
  # Same services backend-up.sh starts. celery processes uploaded images, so it
  # is started here too on servers installed before it was part of the install.
  local services=(web postgres redis celery celery-beat)
  say "Backend: rebuilding and restarting ${services[*]} (database migrations run when web starts)"
  backend_compose up -d --build "${services[@]}"
  say "Backend: waiting for it to be healthy"
  wait_healthy smartrestaurant-web 100 \
    || die "Backend is not healthy after the update — the frontend was NOT touched. Check: samoon logs web"
  say "Backend: healthy."
}

update_frontend() {
  pull_checkout "${INSTALL_DIR}" "Frontend" "${BRANCH}"
  say "Frontend: rebuilding and restarting (NEXT_PUBLIC_* values are compiled in, so a rebuild is required)"
  compose up -d --build
  wait_healthy samoon-app 60 || die "Frontend is not healthy after the update. Check: samoon logs app"
  say "Frontend: healthy."
}

cmd_update() {
  case "${1:-all}" in
    all)       update_backend; update_frontend ;;
    backend)   update_backend ;;
    frontend)  update_frontend ;;
    *) die "Unknown target: $1 (use: samoon update [backend|frontend])" ;;
  esac
}

cmd_logs() {
  local service="${1:-app}"
  case "${service}" in
    web|postgres|redis|celery|celery-beat|nginx-backend)
      has_backend || die "Backend is not installed in ${BACKEND_DIR}."
      backend_compose logs -f --tail=200 "${service}" ;;
    *) compose logs -f --tail=200 "${service}" ;;
  esac
}

cmd_restart() {
  compose restart
}

cmd_set_address() {
  local addr="${1:-}"
  [ -n "${addr}" ] || die "Usage: samoon set-address <ip-or-domain>"
  [[ "${addr}" =~ ^[A-Za-z0-9.-]+$ ]] || die "That does not look like an IP address or a domain: ${addr}"
  say "Moving the site to ${addr} (re-running the install; data and secrets are kept)"
  # Run a copy: the install pulls the checkout, which may rewrite install.sh
  # while bash is still reading it.
  local script
  script="$(mktemp)"
  cp "${INSTALL_DIR}/deploy/install.sh" "${script}"
  if [[ "${addr}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    SERVER_IP="${addr}" DOMAIN="" bash "${script}"
  else
    DOMAIN="${addr}" SERVER_IP="" bash "${script}"
  fi
  rm -f "${script}"
}

cmd_admin_add() {
  local backend
  backend="$(backend_name)"
  [ -n "${backend}" ] || die "BACKEND_CONTAINER is not set in ${ENV_FILE}."
  docker ps --format '{{.Names}}' | grep -qx "${backend}" || die "Backend container '${backend}' is not running."
  say "Adding a platform superuser in '${backend}'. The password is typed here and not stored."
  # The first superuser is created at once. After that this files a request that an existing
  # superuser approves in Django admin -> Accounts -> Superuser requests (and only while
  # "Allow superuser requests" is on in Accounts -> Platform security settings).
  docker exec -it "${backend}" python manage.py admin_add "$@"
}

case "${1:-status}" in
  status)     cmd_status ;;
  update)     shift || true; cmd_update "${1:-all}" ;;
  logs)       shift || true; cmd_logs "${1:-}" ;;
  restart)    cmd_restart ;;
  admin-add)  shift || true; cmd_admin_add "$@" ;;
  set-address) shift || true; cmd_set_address "${1:-}" ;;
  -h|--help|help)
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "Unknown command: $1 (try: samoon help)" ;;
esac
