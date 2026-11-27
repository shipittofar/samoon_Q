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
#   samoon backup                      dump the database (+ settings) to /var/backups/samoon,
#                                      keeping the newest 14 (SAMOON_BACKUP_KEEP)
#   samoon backups                     list backups and whether the daily backup is on
#   samoon restore <file.dump> [--yes] replace the database with a backup (makes a safety
#                                      backup first; asks you to type RESTORE)
#   samoon backup-schedule on|off      daily backup at 03:30 UTC (on by default after install)
#   samoon ssl status                  which HTTPS certificate is in use and when it expires
#   samoon ssl ensure <domain>         get or renew the trusted Let's Encrypt certificate
#   samoon ssl renew                   renew now if it is close to expiry (cron does this too)
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
  # nginx reads nginx.conf and the certificate only at start.
  docker restart samoon-nginx >/dev/null 2>&1 || true
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

# ── Database backups ─────────────────────────────────────────────────────────
# Uploaded images live in object storage (Arvan S3), not on this server; what
# needs backing up here is the PostgreSQL database and the settings files.

BACKUP_DIR="${SAMOON_BACKUP_DIR:-/var/backups/samoon}"
BACKUP_KEEP="${SAMOON_BACKUP_KEEP:-14}"
PG_CONTAINER="${PG_CONTAINER:-smartrestaurant-postgres}"
CRON_FILE="${SAMOON_CRON_FILE:-/etc/cron.d/samoon-backup}"
SAMOON_ETC="${SAMOON_ETC:-/etc/samoon}"
BACKUP_LOG="${SAMOON_BACKUP_LOG:-/var/log/samoon-backup.log}"

pg_running() { docker ps --format '{{.Names}}' | grep -qx "${PG_CONTAINER}"; }

# docker exec into the postgres container; inside it $POSTGRES_USER / $POSTGRES_DB
# come from the backend .env (the container's env_file).
pg_exec() { docker exec "$@"; }

LAST_BACKUP=""

# samoon backup [--quiet] [--no-prune]
cmd_backup() {
  local quiet=0 prune=1 arg
  for arg in "$@"; do
    case "${arg}" in
      --quiet) quiet=1 ;;
      --no-prune) prune=0 ;;
      "") ;;
      *) die "Unknown option: ${arg} (use: samoon backup [--quiet])" ;;
    esac
  done
  has_backend || die "Backend is not installed in ${BACKEND_DIR}."
  pg_running || die "Database container '${PG_CONTAINER}' is not running."
  umask 077
  mkdir -p "${BACKUP_DIR}"
  chmod 700 "${BACKUP_DIR}"
  local stamp dump tmp config
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  dump="${BACKUP_DIR}/samoon-${stamp}.dump"
  config="${BACKUP_DIR}/samoon-${stamp}-config.tar.gz"
  tmp="${dump}.partial"
  [ "${quiet}" = 1 ] || say "Dumping the database to ${dump}"
  # Custom format (-Fc): compressed, restorable with pg_restore.
  if ! pg_exec "${PG_CONTAINER}" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "${tmp}"; then
    rm -f "${tmp}"
    die "pg_dump failed — no backup was written."
  fi
  # A dump pg_restore cannot list is useless: check before keeping it.
  if ! pg_exec -i "${PG_CONTAINER}" pg_restore --list < "${tmp}" > /dev/null; then
    rm -f "${tmp}"
    die "The dump could not be read back — no backup was written."
  fi
  mv -f "${tmp}" "${dump}"
  # Settings and secrets (database password, Django key, certificate): needed
  # to rebuild this server as it was. Private, like the .env files themselves.
  local files=()
  for f in "${BACKEND_ENV}" "${ENV_FILE}" "${SAMOON_ETC}"; do [ -e "${f}" ] && files+=("${f}"); done
  [ "${#files[@]}" -gt 0 ] && tar -czf "${config}" "${files[@]}" 2>/dev/null || true

  LAST_BACKUP="${dump}"

  # Keep the newest ${BACKUP_KEEP} dumps (and their settings archives).
  if [ "${prune}" = 1 ]; then
    local old
    ls -1t "${BACKUP_DIR}"/samoon-*.dump 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | while read -r old; do
      rm -f "${old}" "${old%.dump}-config.tar.gz"
    done
  fi
  if [ "${quiet}" = 1 ]; then
    echo "$(date -u +%FT%TZ) backup ok: ${dump} ($(du -h "${dump}" | cut -f1))"
  else
    if [ "${prune}" = 1 ]; then
      say "Backup ready: ${dump} ($(du -h "${dump}" | cut -f1)); keeping the newest ${BACKUP_KEEP}."
    else
      say "Backup ready: ${dump} ($(du -h "${dump}" | cut -f1))."
    fi
    echo "    Copy it off this server too, e.g. from your computer:"
    echo "    scp root@<server>:${dump} ."
  fi
}

cmd_backups() {
  if ! ls -1 "${BACKUP_DIR}"/samoon-*.dump >/dev/null 2>&1; then
    echo "No backups in ${BACKUP_DIR} yet. Make one with: samoon backup"
  else
    echo "Backups in ${BACKUP_DIR} (newest first):"
    ls -1t "${BACKUP_DIR}"/samoon-*.dump | while read -r f; do
      printf '  %-60s %8s  %s\n' "${f}" "$(du -h "${f}" | cut -f1)" "$(date -u -r "${f}" '+%F %H:%M UTC')"
    done
  fi
  echo
  backup_schedule_status
}

# Drop the database and load a dump into it (backend must be stopped).
load_dump() {
  pg_exec "${PG_CONTAINER}" sh -c 'dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$POSTGRES_DB"'     && pg_exec -i "${PG_CONTAINER}" sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --role="$POSTGRES_USER" --exit-on-error' < "$1"
}

cmd_restore() {
  local file="${1:-}" yes="${2:-}"
  [ -n "${file}" ] || die "Usage: samoon restore <backup.dump> [--yes]   (list them with: samoon backups)"
  [ -f "${file}" ] || die "No such file: ${file}"
  has_backend || die "Backend is not installed in ${BACKEND_DIR}."
  pg_running || die "Database container '${PG_CONTAINER}' is not running."
  pg_exec -i "${PG_CONTAINER}" pg_restore --list < "${file}" > /dev/null     || die "${file} is not a readable database backup (made with 'samoon backup')."

  echo "This REPLACES the whole current database with ${file}."
  echo "Everything changed since that backup is lost (a safety backup of the current"
  echo "database is made first)."
  if [ "${yes}" != "--yes" ]; then
    local answer
    read -r -p "Type RESTORE to continue: " answer
    [ "${answer}" = "RESTORE" ] || die "Cancelled — nothing was changed."
  fi

  # Work from a private copy: nothing (backup clean-up, a cron run) can remove
  # or change the file between now and the restore.
  mkdir -p "${BACKUP_DIR}"
  RESTORE_TMP="$(mktemp "${BACKUP_DIR}/.restore-XXXXXX.dump")"
  trap 'rm -f "${RESTORE_TMP}"' EXIT
  cp -f "${file}" "${RESTORE_TMP}"
  local source="${RESTORE_TMP}"

  say "Safety backup of the current database"
  cmd_backup --no-prune
  local safety="${LAST_BACKUP}"

  say "Stopping the backend (web, celery) so nothing writes during the restore"
  backend_compose stop web celery celery-beat

  say "Restoring ${file}"
  if ! load_dump "${source}"; then
    say "Restore failed — putting the previous database back from ${safety}"
    if load_dump "${safety}"; then
      backend_compose up -d web celery celery-beat
      die "Restore of ${file} failed; the database is back as it was before. Check the messages above."
    fi
    die "Restore failed AND the safety backup could not be loaded. The backend is stopped. Safety backup: ${safety}"
  fi

  say "Starting the backend (migrations bring an older backup up to date)"
  backend_compose up -d web celery celery-beat
  wait_healthy smartrestaurant-web 100 || die "Backend is not healthy after the restore. Check: samoon logs web"
  say "Restore complete. The database as it was before is kept in ${safety}"
}

backup_schedule_status() {
  if [ -f "${CRON_FILE}" ]; then
    echo "Daily backup: ON ($(grep -v '^#' "${CRON_FILE}" | awk '/^[0-9]/{printf "%02d:%02d UTC", $2, $1; exit}'), log: ${BACKUP_LOG})"
  else
    echo "Daily backup: OFF (turn on with: samoon backup-schedule on)"
  fi
}

cmd_backup_schedule() {
  case "${1:-status}" in
    on)
      rm -f "${SAMOON_ETC}/.backup-schedule-off"
      # 03:30 UTC (07:00 Tehran): a quiet hour for restaurants.
      cat > "${CRON_FILE}" <<CRON
# Samoon daily database backup (managed by: samoon backup-schedule on|off)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 3 * * * root SAMOON_BACKUP_KEEP=${BACKUP_KEEP} /usr/local/bin/samoon backup --quiet >> ${BACKUP_LOG} 2>&1
CRON
      chmod 644 "${CRON_FILE}"
      backup_schedule_status ;;
    off)
      rm -f "${CRON_FILE}"
      mkdir -p "${SAMOON_ETC}" && touch "${SAMOON_ETC}/.backup-schedule-off"
      backup_schedule_status ;;
    status) backup_schedule_status ;;
    *) die "Usage: samoon backup-schedule on|off|status" ;;
  esac
}

cmd_ssl() {
  local ssl="${INSTALL_DIR}/deploy/ssl.sh"
  [ -x "$ssl" ] || die "${ssl} is missing: update the site first (samoon update)"
  case "${1:-status}" in
    status) "$ssl" status ;;
    ensure) shift || true; [ $# -ge 1 ] || die "Usage: samoon ssl ensure <domain> [more domains]"; "$ssl" ensure "$@" ;;
    renew)  "$ssl" renew ;;
    *) die "Usage: samoon ssl status|ensure <domain>|renew" ;;
  esac
}

case "${1:-status}" in
  status)     cmd_status ;;
  backup)     shift || true; cmd_backup "$@" ;;
  backups)    cmd_backups ;;
  restore)    shift || true; cmd_restore "${1:-}" "${2:-}" ;;
  backup-schedule) shift || true; cmd_backup_schedule "${1:-status}" ;;
  ssl)        shift || true; cmd_ssl "$@" ;;
  update)     shift || true; cmd_update "${1:-all}" ;;
  logs)       shift || true; cmd_logs "${1:-}" ;;
  restart)    cmd_restart ;;
  admin-add)  shift || true; cmd_admin_add "$@" ;;
  set-address) shift || true; cmd_set_address "${1:-}" ;;
  -h|--help|help)
    sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "Unknown command: $1 (try: samoon help)" ;;
esac
