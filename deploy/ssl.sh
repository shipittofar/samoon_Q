#!/usr/bin/env bash
# Samoon — trusted HTTPS certificates from Let's Encrypt (HTTP-01 on port 80).
#
#   ssl.sh ensure <domain> [more domains]   issue, or renew when close to expiry
#   ssl.sh renew                            certbot renew (run daily by cron)
#   ssl.sh deploy-hook                      run by certbot after each renewal
#   ssl.sh status                           which certificate is in use, and until when
#
# Nothing here ever installs a self-signed certificate as the result: if a
# certificate cannot be issued, this exits non-zero with the reason.
#
# Certificates are kept by certbot in /etc/letsencrypt; the copies nginx reads
# are in /etc/samoon/ssl (mounted into the nginx container). The copies are
# refreshed after every renewal by the deploy hook, which then reloads nginx.
set -euo pipefail

SELF="$(readlink -f "$0")"
SSL_DIR="${SSL_DIR:-/etc/samoon/ssl}"
WEBROOT="${WEBROOT:-/var/www/certbot}"
NGINX_CONTAINER="${NGINX_CONTAINER:-samoon-nginx}"
LOG="${SAMOON_SSL_LOG:-/var/log/samoon-ssl.log}"
LE_MARK="${SSL_DIR}/.samoon-letsencrypt"     # holds the domains of the installed certificate
SELF_MARK="${SSL_DIR}/.samoon-self-signed"   # written by install.sh for its temporary certificate
RENEW_WITHIN=$((30 * 86400))                 # renew when less than this is left
CRON_FILE="/etc/cron.d/samoon-ssl"

mkdir -p "$(dirname "$LOG")" 2>/dev/null || true
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG" >&2; }
die() { log "ERROR: $*"; exit 1; }

# ── checks ───────────────────────────────────────────────────────────────────

valid_domain() {
  [[ "$1" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]
}

# True when the installed certificate is Let's Encrypt, covers every domain,
# and is not close to expiry.
cert_is_current() {
  local crt="${SSL_DIR}/fullchain.pem" d
  [ -f "$LE_MARK" ] && [ -f "$crt" ] || return 1
  [ "$(cat "$LE_MARK")" = "$(printf '%s ' "$@" | sed 's/ $//')" ] || return 1
  openssl x509 -checkend "$RENEW_WITHIN" -noout -in "$crt" >/dev/null 2>&1 || return 1
  for d in "$@"; do
    openssl x509 -noout -ext subjectAltName -in "$crt" | tr -d ' ' | tr ',' '\n' | grep -qx "DNS:${d}" || return 1
  done
}

public_ip() {
  curl -4fsS --max-time 10 https://api.ipify.org 2>/dev/null \
    || curl -4fsS --max-time 10 https://ifconfig.me 2>/dev/null || true
}

check_dns() {  # check_dns <domain> <this server's public IP>
  local d="$1" me="$2" resolved
  resolved="$(getent ahostsv4 "$d" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' | sed 's/ $//')"
  [ -n "$resolved" ] || die "DNS: ${d} has no A record. Add an A record for ${d} pointing to the public IP of this server (${me:-unknown}). If the DNS host is Cloudflare, set the record to DNS only (grey cloud)."
  [ -n "$me" ] || die "cannot read this server's public IP (outbound HTTPS blocked?), so DNS cannot be checked."
  case " ${resolved} " in
    *" ${me} "*) ;;
    *) die "DNS: ${d} resolves to ${resolved}, but this server is ${me}. Point the A record of ${d} to ${me} (Cloudflare: DNS only), wait for it to spread, then run: samoon ssl ensure ${d}" ;;
  esac
}

check_port80() {  # the nginx container must be running and answer the challenge path
  local d="$1" name dir
  docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER" \
    || die "nginx (${NGINX_CONTAINER}) is not running: start the site first (samoon update), then run again."
  dir="${WEBROOT}/.well-known/acme-challenge"
  mkdir -p "$dir"
  name="probe-$RANDOM$RANDOM"
  echo ok > "${dir}/${name}"
  local got
  got="$(curl -fsS --max-time 15 "http://${d}/.well-known/acme-challenge/${name}" 2>/dev/null || true)"
  rm -f "${dir}/${name}"
  [ "$got" = "ok" ] || die "port 80 of ${d} does not reach this server. Open TCP 80 and 443 in the provider's firewall / security group, and make sure Cloudflare is not proxying the name (DNS only)."
}

# ── actions ──────────────────────────────────────────────────────────────────

install_certbot() {
  command -v certbot >/dev/null 2>&1 && return 0
  log "installing certbot"
  if command -v apt-get >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot >/dev/null
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q certbot >/dev/null
  else
    die "certbot is not installed and no supported package manager was found: install certbot, then run again."
  fi
}

issue() {  # issue <primary> [more...]
  # --keep-until-expiring only when the existing certificate already covers
  # every name: otherwise certbot would keep it unchanged and the new names
  # would be missing. Names added later are picked up with --expand.
  local primary="$1" d keep=(--keep-until-expiring) lineage="/etc/letsencrypt/live/$1/fullchain.pem"
  if [ -f "$lineage" ]; then
    for d in "$@"; do
      openssl x509 -noout -ext subjectAltName -in "$lineage" | tr -d ' ' | tr ',' '\n' | grep -qx "DNS:${d}" \
        || { keep=(); break; }
    done
  else
    keep=()
  fi
  local args=(certonly --webroot -w "$WEBROOT" --non-interactive --agree-tos --expand
              --cert-name "$primary" ${keep[@]+"${keep[@]}"})
  for d in "$@"; do args+=(-d "$d"); done
  if [ -n "${CERTBOT_EMAIL:-}" ]; then
    args+=(-m "$CERTBOT_EMAIL")
  else
    args+=(--register-unsafely-without-email)
    log "CERTBOT_EMAIL is not set: no expiry reminders from Let's Encrypt (set CERTBOT_EMAIL to get them)"
  fi
  certbot "${args[@]}" >>"$LOG" 2>&1 \
    || die "certbot could not issue the certificate for $* (details in ${LOG}; the usual cause is the port 80 / DNS checks above)."
}

reload_nginx() {
  if docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
    if docker exec "$NGINX_CONTAINER" nginx -t >/dev/null 2>&1; then
      docker exec "$NGINX_CONTAINER" nginx -s reload >/dev/null && log "nginx reloaded with the new certificate"
    else
      log "ERROR: nginx configuration test failed; not reloaded"; return 1
    fi
  else
    log "nginx is not running; it reads the new certificate when it starts"
  fi
}

# Copy the certbot files into the directory nginx reads. The private key is
# written with mode 600 and never printed.
install_from_lineage() {  # install_from_lineage <lineage dir> <domains...>
  local lin="$1"; shift
  [ -f "${lin}/fullchain.pem" ] && [ -f "${lin}/privkey.pem" ] || die "no certificate files in ${lin}"
  mkdir -p "$SSL_DIR"
  chmod 750 "$SSL_DIR"
  install -m 644 -o root -g root "$(readlink -f "${lin}/fullchain.pem")" "${SSL_DIR}/fullchain.pem.new"
  install -m 600 -o root -g root "$(readlink -f "${lin}/privkey.pem")" "${SSL_DIR}/privkey.pem.new"
  mv -f "${SSL_DIR}/fullchain.pem.new" "${SSL_DIR}/fullchain.pem"
  mv -f "${SSL_DIR}/privkey.pem.new" "${SSL_DIR}/privkey.pem"
  echo "$*" > "$LE_MARK"
  rm -f "$SELF_MARK"
  reload_nginx
}

install_hook() {
  local dir=/etc/letsencrypt/renewal-hooks/deploy
  mkdir -p "$dir"
  printf '#!/bin/sh\nexec "%s" deploy-hook\n' "$SELF" > "${dir}/samoon-ssl"
  chmod 755 "${dir}/samoon-ssl"
}

install_cron() {
  cat > "$CRON_FILE" <<CRON
# Samoon: renew the Let's Encrypt certificate when it is close to expiry (managed by deploy/ssl.sh)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3,15 * * * root ${SELF} renew >/dev/null 2>&1
CRON
  chmod 644 "$CRON_FILE"
}

cmd_ensure() {
  [ "$(id -u)" -eq 0 ] || die "run as root"
  [ $# -ge 1 ] || die "usage: ssl.sh ensure <domain> [more domains]"
  local d
  for d in "$@"; do
    valid_domain "$d" || die "not a domain name: ${d}. An IP address cannot get a Let's Encrypt certificate; use a domain."
  done
  mkdir -p "$SSL_DIR"
  if cert_is_current "$@"; then
    log "Let's Encrypt certificate for $* is valid for more than 30 days: nothing to do"
    install_hook; install_cron
    return 0
  fi
  local me; me="$(public_ip)"
  for d in "$@"; do check_dns "$d" "$me"; done
  check_port80 "$1"
  install_certbot
  issue "$@"
  install_from_lineage "/etc/letsencrypt/live/$1" "$@"
  install_hook
  install_cron
  log "Let's Encrypt certificate installed for $*"
}

cmd_renew() {
  if [ ! -f "$LE_MARK" ]; then
    log "no Let's Encrypt certificate is installed: nothing to renew"
    return 0
  fi
  install_certbot
  if certbot renew --quiet --non-interactive >>"$LOG" 2>&1; then
    log "renew: certbot finished (renewed certificates are installed by the deploy hook)"
  else
    die "certbot renew failed; see ${LOG}"
  fi
}

cmd_deploy_hook() {
  local lin="${RENEWED_LINEAGE:-}"
  [ -n "$lin" ] || die "deploy-hook runs only from certbot (RENEWED_LINEAGE is not set)"
  local name; name="$(basename "$lin")"
  if [ -f "$LE_MARK" ] && [ "$(cut -d' ' -f1 "$LE_MARK")" = "$name" ]; then
    install_from_lineage "$lin" "$(cat "$LE_MARK")"
    log "renewed certificate for ${name} installed"
  else
    log "renewed certificate ${name} is not the site's certificate: nothing to do"
  fi
}

cmd_status() {
  local crt="${SSL_DIR}/fullchain.pem"
  if [ -f "$LE_MARK" ]; then
    echo "Certificate: Let's Encrypt for $(cat "$LE_MARK")"
  elif [ -f "$SELF_MARK" ]; then
    echo "Certificate: SELF-SIGNED (browsers do not trust it). Fix: samoon ssl ensure <domain>"
  else
    echo "Certificate: none installed. Fix: samoon ssl ensure <domain>"
  fi
  if [ -f "$crt" ]; then
    openssl x509 -noout -subject -issuer -enddate -in "$crt" | sed 's/^/  /'
  fi
  if [ -f "$CRON_FILE" ]; then echo "Renewal: daily check at 03:17 and 15:17 UTC (${CRON_FILE})"; else echo "Renewal: not scheduled (run: samoon ssl ensure <domain>)"; fi
  [ -f "$LOG" ] && echo "Log: ${LOG} (last line: $(tail -n 1 "$LOG" 2>/dev/null))" || true
}

case "${1:-}" in
  ensure)      shift; cmd_ensure "$@" ;;
  renew)       cmd_renew ;;
  deploy-hook) cmd_deploy_hook ;;
  status)      cmd_status ;;
  *) echo "usage: ssl.sh ensure <domain> [more domains] | renew | status" >&2; exit 2 ;;
esac
