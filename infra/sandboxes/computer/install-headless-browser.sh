#!/bin/sh
# Installs the pinned headless browser (Obscura, Apache-2.0, https://github.com/h4ckf0r0day/obscura)
# into the given folder, checked against its sha256. The page tools browse in it by default; see
# rakazo-cdp-broker. A folder that already holds that release is left as it is.
# Bump the version and every hash together.
set -eu
dest="${1:?usage: install-headless-browser.sh <folder>}"
version=0.2.7
case "$(uname -m)" in
  x86_64 | amd64) arch=x86_64; sha256=1d6514beacef9fe75671f4bf7a66d3a7bceef9bde39f8156d1ca4a701eb1e216 ;;
  aarch64 | arm64) arch=aarch64; sha256=f51167d7ae98be6c6327d3e7e015e74430e190ea6846589e3c131e10641a52b7 ;;
  *) echo "unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac
if [ "$(cat "$dest/.obscura-version" 2>/dev/null)" = "$version-$sha256" ] && [ -x "$dest/obscura" ]; then exit 0; fi
mkdir -p "$dest"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
curl -fsSL --retry 5 \
  "https://github.com/h4ckf0r0day/obscura/releases/download/v${version}/obscura-${arch}-linux-stealth.tar.gz" \
  -o "$work/obscura.tar.gz"
echo "$sha256  $work/obscura.tar.gz" | sha256sum -c -
tar -xzf "$work/obscura.tar.gz" -C "$work" obscura obscura-worker
install -m 755 "$work/obscura" "$dest/obscura"
install -m 755 "$work/obscura-worker" "$dest/obscura-worker"
printf '%s' "$version-$sha256" > "$dest/.obscura-version"
