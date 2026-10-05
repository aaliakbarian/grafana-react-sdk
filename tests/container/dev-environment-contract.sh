#!/usr/bin/env bash

set -euo pipefail

unexpected_ownership_before=$(mktemp)
unexpected_ownership_after=$(mktemp)
checkout_uid=$(stat -c %u .)
checkout_gid=$(stat -c %g .)

cleanup() {
  docker compose down >/dev/null 2>&1 || true
  rm -f "$unexpected_ownership_before" "$unexpected_ownership_after"
}

trap cleanup EXIT

find . -path './.git' -prune -o \( ! -uid "$checkout_uid" -o ! -gid "$checkout_gid" \) -printf '%U:%G %p\n' | LC_ALL=C sort > "$unexpected_ownership_before"
if [[ -s "$unexpected_ownership_before" ]]; then
  echo "Repository paths must initially be owned by $checkout_uid:$checkout_gid." >&2
  cat "$unexpected_ownership_before" >&2
  exit 1
fi

grep -Fq 'FROM node:22.23.3-bookworm' dev/container/Dockerfile
grep -Fq 'ARG PLAYWRIGHT_VERSION=1.56.1' dev/container/Dockerfile
grep -Fq 'PLAYWRIGHT_VERSION: "1.56.1"' compose.yaml
if grep -Eq 'playwright@(latest|\^|~)' dev/container/Dockerfile; then
  echo 'Playwright image installation must use the exact project version.' >&2
  exit 1
fi

compose_services=$(docker compose config --services | LC_ALL=C sort)

if [ "$compose_services" != $'dev\ngrafana' ]; then
  echo "Expected Compose services dev and grafana; got: $compose_services" >&2
  exit 1
fi

if [[ "${POC_SKIP_IMAGE_BUILD:-false}" != true ]]; then
  docker compose build dev
fi

docker compose run --rm --no-deps dev sh dev/container/verify-environment.sh

docker compose run --rm --no-deps dev sh -c '
  set -eu
  test "$(node --version)" = "v22.23.3"
  test "$(yarn --version)" = "4.17.1"
  test "$(id -u)" != "0"
  test "$(id -u)" = "$(stat -c %u /workspace)"
  test "$(id -g)" = "$(stat -c %g /workspace)"
  grep -q " /workspace/node_modules " /proc/mounts
  grep -q " /var/cache/yarn " /proc/mounts
  test "$(yarn playwright --version)" = "Version 1.56.1"
  test -x /ms-playwright/chromium-1194/chrome-linux/chrome
  test -x /ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell
  chromium_version=$(/ms-playwright/chromium-1194/chrome-linux/chrome --version)
  test "${chromium_version% }" = "Chromium 141.0.7390.37"
'
echo 'container_versions_and_mounts=verified'

docker compose up --detach --no-deps dev

reachable=false
for ((attempt = 1; attempt <= 30; attempt += 1)); do
  if exec 3<>/dev/tcp/127.0.0.1/5173 2>/dev/null; then
    printf 'GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3
    if IFS= read -r status_line <&3 && [[ "$status_line" == *' 200 '* ]]; then
      reachable=true
      exec 3<&-
      exec 3>&-
      break
    fi
    exec 3<&-
    exec 3>&-
  fi
  sleep 1
done

if [[ "$reachable" != true ]]; then
  echo 'Vite was not reachable through 127.0.0.1:5173.' >&2
  exit 1
fi

test "$(docker compose port dev 5173)" = '127.0.0.1:5173'
echo 'vite_host_reachability=127.0.0.1:5173'
docker compose down

find . -path './.git' -prune -o \( ! -uid "$checkout_uid" -o ! -gid "$checkout_gid" \) -printf '%U:%G %p\n' | LC_ALL=C sort > "$unexpected_ownership_after"
if [[ -s "$unexpected_ownership_after" ]]; then
  echo "Container verification produced repository paths not owned by $checkout_uid:$checkout_gid." >&2
  cat "$unexpected_ownership_after" >&2
  exit 1
fi
if ! cmp -s "$unexpected_ownership_before" "$unexpected_ownership_after"; then
  echo 'Container verification changed repository ownership.' >&2
  diff -u "$unexpected_ownership_before" "$unexpected_ownership_after" >&2 || true
  exit 1
fi
echo "repository_ownership=$checkout_uid:$checkout_gid"
