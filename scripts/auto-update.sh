#!/bin/bash
set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

cd /Users/Trabalho/Desktop/COC

export COC_EMAIL="fernandoribeiro.com@gmail.com"
export COC_PASSWORD="binho922004"

export COC_TOKEN=$(node scripts/refresh-token.js)
echo "Token renovado para IP atual"

node scripts/fetch-wars.js
node scripts/fetch-players.js
node scripts/compute-cwl.js

git add data/wars.json data/players.json data/absences.json data/cwl-ranking.json
git diff --staged --quiet || (git commit -m "auto update $(date -u '+%Y-%m-%dT%H:%M')Z" && git push origin HEAD:master)
