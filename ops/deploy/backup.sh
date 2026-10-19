#!/usr/bin/env bash
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
environment=${1:?Usage: backup.sh /absolute/path/to/server.env}
[[ "$environment" = /* && -f "$environment" ]] || { echo 'An absolute environment-file path is required.' >&2; exit 1; }
current="$root/.local-run/releases/current"
[[ -f "$current" ]] || { echo 'No successfully deployed release recorded.' >&2; exit 1; }
RELEASE_TAG=$(cat "$current")
export RELEASE_TAG
compose=(docker compose --project-name omni-rest-test --env-file "$environment" -f "$root/ops/deploy/compose.yml")
umask 077
folder="$root/.local-run/backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$folder"
# A short maintenance window keeps database rows and media files consistent with one another.
# Resume writers on errors as well; the caller must treat an incomplete folder as a failed backup.
resume() { "${compose[@]}" start api frontend >&2; }
trap resume EXIT
"${compose[@]}" stop frontend api >&2
"${compose[@]}" exec -T postgres pg_dump -U omni_rest -d omni_rest | gzip > "$folder/database.sql.gz"
# Includes uploaded media, the encrypted session key ring, and the private session certificate.
"${compose[@]}" run --rm --no-deps --entrypoint tar api -C /state -czf - . > "$folder/application.tar.gz"
cp "$environment" "$folder/server.env"
printf '%s\n' "$RELEASE_TAG" > "$folder/release"
touch "$folder/complete"
echo "$folder"
