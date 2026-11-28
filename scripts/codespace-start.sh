#!/usr/bin/env bash
# Starts the ALLORA server stack inside a GitHub Codespace and makes port 5173 public.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
for i in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
DIR="$HOME/allora-server"
mkdir -p "$DIR" && cd "$DIR"
ORIGIN="https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
HOST="${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
if [ ! -f install-images.sh ]; then
  curl -fsSLO https://raw.githubusercontent.com/elie222/rakazo/main/infra/compose/install-images.sh
fi
if [ ! -f .env ]; then bash install-images.sh --prepare-only; fi
setenv() { if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }
for key in FREELLMAPI_UNIFIED_KEY FREELLMAPI_ENCRYPTION_KEY; do
  grep -Eq "^$key=[^[:space:]]" .env || setenv "$key" "$(openssl rand -hex 32)"
done
# Default AI: FreeLLMAPI beside the server, so chat works with no API key. install-images.sh
# layers docker-compose.override.yml on its own; the keys above must exist first.
cp "$REPO/infra/compose/docker-compose.freellmapi.yml" docker-compose.override.yml
setenv BETTER_AUTH_URL "$ORIGIN"
setenv WEB_ORIGIN "$ORIGIN"
setenv API_URL "$ORIGIN"
setenv RAKAZO_HOST "$HOST"
setenv RAKAZO_ALLOWED_HOSTS "$HOST,localhost,127.0.0.1"
setenv RAKAZO_COMPUTER_MEMORY "2g"
bash install-images.sh
gh codespace ports visibility 5173:public -c "$CODESPACE_NAME" || true
echo "ALLORA server URL: $ORIGIN"
