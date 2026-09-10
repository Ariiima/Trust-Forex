#!/bin/sh
# Incremental deploy: ship only the given paths (relative to design/) into the live /v/ tree.
#   sh design/landing/deploy-inc.sh landing/cb8 landing/shared/scale.css landing/index.html
# Use deploy.sh when retiring pages: this incremental upload does not remove old paths.
# ponytail: the full deploy.sh pushes the whole 138 MB tree and the ssh pipe has died mid-tar
# three times today. Adding a few small builds does not need the atomic whole-tree swap —
# each file is either the old one or the new one, both valid. Use deploy.sh when shared/
# assets or many builds change at once.
set -eu
[ $# -gt 0 ] || { echo "usage: deploy-inc.sh <path under design/>..."; exit 1; }
HOST=root@193.142.58.147
DEST=/var/www/tf-root/landing/v
cd "$(dirname "$0")/.."
COPYFILE_DISABLE=1 tar czf - --no-xattrs --exclude='.DS_Store' --exclude='landing/_qa' "$@" \
  | ssh -o ConnectTimeout=20 "$HOST" "tar xzf - -C $DEST && chown -R nginx:nginx $DEST && echo shipped"
for p in "$@"; do
  case "$p" in */) u="$p";; *.*) u="$p";; *) u="$p/";; esac
  printf '%-28s ' "$u"; curl -s -m 20 -o /dev/null -w '%{http_code}\n' "https://trustforex.net/v/$u"
done
