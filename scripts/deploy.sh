#!/bin/sh
# Deploy Trust Forex to the production box.
#
#   sh scripts/deploy.sh          # web + api
#   sh scripts/deploy.sh web      # built frontend + the review page only
#   sh scripts/deploy.sh api      # server/*.mjs + restart only
#
# Layout on the host (CentOS 8, node 22, no rsync):
#   /var/www/tf-root/trust-forex          the built SPA, served by nginx
#   /opt/trust-forex/server               API code, owned by tfapi
#   /var/lib/trust-forex/trustforex.sqlite  the live DB — TF_DB points here, and
#                                         this script never touches it
#   /etc/trust-forex.env                  TF_PORT / TF_DB / TF_BOT_TOKEN
#
# Both halves swap atomically and keep the previous copy until the new one has
# answered, so a failed deploy is one `mv` away from being undone.
set -eu

HOST=${TF_HOST:-root@193.142.58.147}
WHAT=${1:-all}
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

# macOS smuggles ._* AppleDouble files into a tar unless both of these are set.
tarball() {
  COPYFILE_DISABLE=1 tar --no-xattrs -czf - "$@"
}

deploy_web() {
  echo "==> building"
  npm run build

  mkdir -p "$STAGE/trust-forex"
  cp -R dist/. "$STAGE/trust-forex/"
  # The design-review page ships with it: it is how the frames get compared
  # against the real screens on a phone.
  if [ -d design/review/ref ]; then
    mkdir -p "$STAGE/trust-forex/review"
    cp design/review/index.html "$STAGE/trust-forex/review/" 2>/dev/null || true
    cp design/review/scores.json "$STAGE/trust-forex/review/" 2>/dev/null || true
    cp -R design/review/ref "$STAGE/trust-forex/review/"
  fi

  echo "==> shipping $(du -sh "$STAGE/trust-forex" | cut -f1) to $HOST"
  tarball -C "$STAGE" trust-forex | ssh "$HOST" 'set -e
    cd /var/www/tf-root
    rm -rf trust-forex.new && mkdir trust-forex.new
    tar -xzf - -C trust-forex.new --strip-components=1
    rm -rf trust-forex.old
    # `[ -d x ] && mv` would exit 1 under set -e on the very first deploy.
    if [ -d trust-forex ]; then mv trust-forex trust-forex.old; fi
    mv trust-forex.new trust-forex
    chown -R nginx:nginx trust-forex 2>/dev/null || true'

  # The bundle name changes every build, so comparing it proves the swap landed
  # rather than proving nginx is up.
  want=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html | head -1)
  got=$(ssh "$HOST" "grep -o 'assets/index-[A-Za-z0-9_-]*\.js' /var/www/tf-root/trust-forex/index.html | head -1")
  [ "$want" = "$got" ] || { echo "FAILED: host serves $got, built $want"; exit 1; }
  echo "==> web ok ($want)"
}

deploy_api() {
  # --exclude BEFORE the path. bsdtar reads a trailing --exclude as a FILENAME,
  # errors, and still streams the whole directory — which is how local *.sqlite
  # and gateways.json once ended up on the server (08-10).
  echo "==> shipping server/ to $HOST"
  tarball --exclude='*.sqlite' --exclude='*.sqlite-shm' --exclude='*.sqlite-wal' \
          --exclude='gateways.json' --exclude='backups' server \
    | ssh "$HOST" 'set -e
    cd /opt/trust-forex
    rm -rf server.prev && cp -a server server.prev
    tar -xzf - -C /opt/trust-forex
    chown -R tfapi:tfapi server
    systemctl restart tf-api'

  sleep 2
  # 401 is the healthy answer: the route exists and is demanding Telegram auth.
  code=$(ssh "$HOST" "systemctl is-active tf-api >/dev/null && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/api/gateways")
  case "$code" in
    2*|401) echo "==> api ok ($code)" ;;
    *) echo "FAILED: api answered $code — roll back with:"
       echo "  ssh $HOST 'cd /opt/trust-forex && rm -rf server && mv server.prev server && systemctl restart tf-api'"
       ssh "$HOST" 'journalctl -u tf-api -n 20 --no-pager' || true
       exit 1 ;;
  esac
}

case "$WHAT" in
  web) deploy_web ;;
  api) deploy_api ;;
  all) deploy_web; deploy_api ;;
  *) echo "usage: sh scripts/deploy.sh [web|api|all]"; exit 2 ;;
esac

# trust-forex.old / server.prev stay: ~4MB that buys a one-command rollback of
# whatever just shipped. Each deploy clears the previous pair before making its
# own, so they never accumulate.
echo "==> done — https://trustforex.net"
echo "    roll back:  ssh $HOST 'cd /var/www/tf-root && rm -rf trust-forex && mv trust-forex.old trust-forex'"
