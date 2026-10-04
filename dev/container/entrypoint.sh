#!/bin/sh

set -eu

workspace=/workspace
workspace_uid=$(stat -c %u "$workspace")
workspace_gid=$(stat -c %g "$workspace")

if [ "$workspace_uid" = "0" ]; then
  echo "Refusing to run development commands as root; the bind-mounted checkout must be owned by a non-root WSL user." >&2
  exit 1
fi

for writable_path in /workspace/node_modules /var/cache/yarn /tmp/poc-home; do
  mkdir -p "$writable_path"
  if [ "$(stat -c %u "$writable_path")" != "$workspace_uid" ] || [ "$(stat -c %g "$writable_path")" != "$workspace_gid" ]; then
    chown -R "$workspace_uid:$workspace_gid" "$writable_path"
  fi
done

exec gosu "$workspace_uid:$workspace_gid" "$@"

