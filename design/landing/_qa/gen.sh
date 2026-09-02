#!/bin/sh
# Generate one still with OpenRouter muse-image, run ON THE PROD SERVER (this Mac's
# network kills HTTPS responses slower than ~10s; muse takes 30–60s), copy it back.
#   sh design/landing/_qa/gen.sh <name> "<prompt>"
# → design/landing/shared/cb/<name>.webp (page asset) + <name>.png (for viewing with Read)
# Key: OPENROUTER_API_KEY in the environment, else ~/.claude/skills/openrouter-image-gen/.env
set -eu
NAME=$1; PROMPT=$2
HOST=root@193.142.58.147
DIR="$(cd "$(dirname "$0")/.." && pwd)/shared/cb"; mkdir -p "$DIR"
if [ -z "${OPENROUTER_API_KEY:-}" ]; then set -a; . "$HOME/.claude/skills/openrouter-image-gen/.env"; set +a; fi
[ -n "${OPENROUTER_API_KEY:-}" ] || { echo "no OPENROUTER_API_KEY"; exit 1; }
MODEL=${MODEL:-meta/muse-image}
# Prompt travels as base64 so quotes never break the remote shell; the key on stdin, never in argv.
P64=$(printf '%s' "$PROMPT" | base64 | tr -d '\n')
printf '%s\n' "$OPENROUTER_API_KEY" | ssh "$HOST" "read K; mkdir -p /tmp/tf-cb && cd /tmp/tf-cb && \
  export PROMPT=\$(echo '$P64' | base64 -d) && \
  BODY=\$(python3 -c 'import json,os;print(json.dumps({\"model\":\"$MODEL\",\"prompt\":os.environ[\"PROMPT\"]}))') && \
  for i in 1 2 3; do \
    code=\$(curl -s -m 300 -w '%{http_code}' https://openrouter.ai/api/v1/images/generations -H \"Authorization: Bearer \$K\" -H 'Content-Type: application/json' -d \"\$BODY\" -o '$NAME.json'); \
    if [ \"\$code\" = 200 ] && python3 -c 'import json,base64,sys;d=json.load(open(sys.argv[1]+\".json\"));open(sys.argv[1]+\".webp\",\"wb\").write(base64.b64decode(d[\"data\"][0][\"b64_json\"]))' '$NAME'; then echo \"OK try\$i\"; exit 0; fi; \
    echo \"retry \$i code=\$code\"; head -c 300 '$NAME.json' 2>/dev/null; echo; sleep 5; \
  done; echo FAIL; exit 1"
ssh "$HOST" "cat /tmp/tf-cb/$NAME.webp" > "$DIR/$NAME.webp"   # no scp/sftp on this host; cat over ssh
sips -s format png "$DIR/$NAME.webp" --out "$DIR/$NAME.png" >/dev/null
echo "$DIR/$NAME.webp  ($(sips -g pixelWidth -g pixelHeight "$DIR/$NAME.png" | awk '/pixel/{printf "%s ", $2}'))"
