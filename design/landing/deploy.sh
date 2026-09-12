#!/bin/sh
# Ship the landing pages (Home, Cashback, Results, Referral, About, Broker Partnership, Partner Brokers, Blog, Legal Center) and their runtime dependencies under /v/.
# URL: https://trustforex.net/v/landing/ -> home/
# The apex index.html (the live "coming soon" page) is never touched. No rsync on the host → tar over ssh.
set -eu
HOST=root@193.142.58.147
DEST=/var/www/tf-root/landing/v/landing
cd "$(dirname "$0")"
node blog/build.mjs
python3 _qa/stamp.py
# Replace the landing pages, leaving sibling asset directories outside this release.
COPYFILE_DISABLE=1 tar czf - --no-xattrs --exclude='.DS_Store' \
    index.html home cb8 results referral about partnership brokers blog legal shared/scale.css \
    shared/fonts/inter.css shared/fonts/Inter-VF.woff2 \
  | ssh -o BatchMode=yes -o ConnectTimeout=20 "$HOST" "rm -rf $DEST.new && mkdir -p $DEST.new && tar xzf - -C $DEST.new && chown -R nginx:nginx $DEST.new && rm -rf $DEST.old && { [ -d $DEST ] && mv $DEST $DEST.old || true; } && mv $DEST.new $DEST && du -sh $DEST"
for p in landing/ landing/home/ landing/cb8/ landing/results/ landing/referral/ landing/about/ landing/partnership/ landing/brokers/ landing/blog/ landing/legal/; do
  printf '%-28s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://trustforex.net/v/$p"
done
echo "roll back: ssh $HOST 'rm -rf $DEST && mv $DEST.old $DEST'"
