#!/bin/sh
set -eu

grafana_env_file=${GRAFANA_ENV_FILE:-dev/grafana/.env}

if { [ -z "${GRAFANA_ADMIN_USER:-}" ] || [ -z "${GRAFANA_ADMIN_PASSWORD:-}" ]; } && [ -f "$grafana_env_file" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$grafana_env_file"
  set +a
fi

: "${GRAFANA_ADMIN_USER:?Set GRAFANA_ADMIN_USER or load dev/grafana/.env}"
: "${GRAFANA_ADMIN_PASSWORD:?Set GRAFANA_ADMIN_PASSWORD or load dev/grafana/.env}"

compose() {
  if [ -f "$grafana_env_file" ]; then
    docker compose --env-file "$grafana_env_file" "$@"
  else
    docker compose "$@"
  fi
}

compose up -d --wait grafana dev
compose exec -T \
  -e "POC_GRAFANA_VERIFY_USER=${GRAFANA_ADMIN_USER}" \
  -e "POC_GRAFANA_VERIFY_PASSWORD=${GRAFANA_ADMIN_PASSWORD}" \
  dev node tests/container/verify-grafana-fixture.mjs
compose run --rm --no-deps \
  -e "POC_GRAFANA_VERIFY_USER=${GRAFANA_ADMIN_USER}" \
  -e "POC_GRAFANA_VERIFY_PASSWORD=${GRAFANA_ADMIN_PASSWORD}" \
  dev yarn playwright test tests/e2e/grafana-fixture-reference.spec.ts --project=chromium
