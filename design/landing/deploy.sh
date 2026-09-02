#!/bin/sh
# Ship the landing versions + the blue asset gallery to the apex docroot, under /v/.
# Mirrors design/{landing,landing-assets/blue} so every relative link works unchanged.
# URLs: https://trustforex.net/v/landing/  (a/ b/ c/ d/)   https://trustforex.net/v/landing-assets/blue/
# The apex index.html (the live "coming soon" page) is never touched. No rsync on the host → tar over ssh.
set -eu
HOST=root@193.142.58.147
DEST=/var/www/tf-root/landing/v
cd "$(dirname "$0")/.."
COPYFILE_DISABLE=1 tar czf - --no-xattrs --exclude='.DS_Store' --exclude='landing/_proto' --exclude='landing/_qa' --exclude='landing/a/media/raw' --exclude='*.log' \
    --exclude='landing-assets/blue/.raw.json' --exclude='landing-assets/blue/.req.json' \
    landing landing-assets/blue \
  | ssh "$HOST" "rm -rf $DEST.new && mkdir -p $DEST.new && tar xzf - -C $DEST.new && chown -R nginx:nginx $DEST.new && rm -rf $DEST.old && { [ -d $DEST ] && mv $DEST $DEST.old || true; } && mv $DEST.new $DEST && du -sh $DEST"
for p in landing/ landing/a/ landing/b/ landing/c/ landing/d/ landing/b1/ landing/b2/ landing/b3/ landing/b4/ landing/cb1/ landing/cb2/ landing/cb3/ landing/cb4/ landing-assets/blue/; do
  printf '%-28s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://trustforex.net/v/$p"
done
echo "roll back: ssh $HOST 'rm -rf $DEST && mv $DEST.old $DEST'"
