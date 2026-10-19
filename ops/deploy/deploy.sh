#!/usr/bin/env bash
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
environment=${1:?Usage: deploy.sh /absolute/path/to/server.env RELEASE_TAG}
release=${2:?Supply a built release tag}
[[ "$environment" = /* && -f "$environment" ]] || { echo 'Use an existing absolute environment-file path.' >&2; exit 1; }
[[ "$release" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] || { echo 'Invalid release tag.' >&2; exit 1; }
export RELEASE_TAG="$release"
compose=(docker compose --project-name omni-rest-test --env-file "$environment" -f "$root/ops/deploy/compose.yml")
"${compose[@]}" config --quiet
mkdir -p "$root/.local-run/releases" "$root/.local-run/backups"
chmod 700 "$root/.local-run/releases" "$root/.local-run/backups"
lock="$root/.local-run/releases/deploy.lock"
mkdir "$lock" 2>/dev/null || { echo 'Another deployment is active; inspect before retrying.' >&2; exit 1; }
trap 'rmdir "$lock"' EXIT
previous="$root/.local-run/releases/current"
if [[ -f "$previous" ]]; then
    bash "$root/ops/deploy/backup.sh" "$environment"
fi
"${compose[@]}" up -d --wait postgres
# No automatic database downgrade is attempted on a failed release.
"${compose[@]}" run --rm --no-deps api --migrate
if ! "${compose[@]}" up -d --no-build --wait --wait-timeout 180; then
    echo 'Release failed health checks. Persistent data is retained; inspect service logs before retrying.' >&2
    exit 1
fi
if [[ -f "$previous" ]]; then
    cp "$previous" "$root/.local-run/releases/previous"
fi
printf '%s\n' "$release" > "$previous"
echo 'Release containers are healthy. Verify public menu and admin workflows before acceptance.'
