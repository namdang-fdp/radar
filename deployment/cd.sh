#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
root="${RADAR_DEPLOY_ROOT:-/root/selfhost/radar}"
release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
image="${1:-}"
registry_user="${2:-}"
[[ "$image" =~ ^docker\.io/[a-z0-9][a-z0-9_-]*/radar@sha256:[a-f0-9]{64}$ ]] || { echo 'Expected a Docker Hub Radar image digest' >&2; exit 1; }
[[ -z "$registry_user" || "$registry_user" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || exit 1
test -r "$root/.env"
test -f "$release/compose.yaml"
exec 9>"$root/.deploy.lock"
flock -w 300 9 || { echo 'Another deployment is active' >&2; exit 1; }
previous_release=$(readlink -f "$root/current" 2>/dev/null || true)
previous_image=''
if [[ -L "$root/current" || -e "$root/current" ]]; then
  test -r "$previous_release/image.env" || { echo 'Current release metadata is missing; inspect before deploying.' >&2; exit 1; }
fi
if [[ -f "$previous_release/image.env" ]]; then
  previous_image=$(sed -n 's/^RADAR_IMAGE=//p' "$previous_release/image.env")
  [[ "$previous_image" =~ ^docker\.io/[a-z0-9][a-z0-9_-]*/radar@sha256:[a-f0-9]{64}$ ]] || exit 1
  test -f "$previous_release/compose.yaml"
fi
registry_config=$(mktemp -d)
export DOCKER_CONFIG="$registry_config"
cleanup() { rm -rf -- "$registry_config"; }
trap cleanup EXIT
compose() {
  local config="$1" target="$2"
  shift 2
  RADAR_IMAGE="$target" docker compose --project-name radar --project-directory "$root" \
    --env-file "$root/.env" -f "$config/compose.yaml" "$@"
}
if [[ -n "$registry_user" ]]; then
  docker login docker.io --username "$registry_user" --password-stdin >/dev/null
fi
compose "$release" "$image" config --quiet
# Pull before touching the current services. Old images are retained for rollback.
compose "$release" "$image" pull
rollback() {
  local failure=${1:-$?}
  trap - ERR HUP INT TERM
  echo 'Deployment failed; restoring previous application containers.' >&2
  if [[ -n "$previous_image" ]]; then
    compose "$previous_release" "$previous_image" up -d --wait --wait-timeout 180 || echo 'Rollback requires operator attention.' >&2
  else
    compose "$release" "$image" stop || true
    echo 'First deployment failed; no previous release exists.' >&2
  fi
  exit "$failure"
}
trap rollback ERR
trap 'rollback 129' HUP
trap 'rollback 130' INT
trap 'rollback 143' TERM
if [[ -n "$previous_image" ]]; then compose "$previous_release" "$previous_image" stop worker; fi
# Migrations must stay backward-compatible; container rollback does not reverse SQL.
compose "$release" "$image" run --rm --no-deps web node --import tsx scripts/migrate.ts
compose "$release" "$image" up -d --wait --wait-timeout 180
compose "$release" "$image" exec -T web node -e "fetch('http://127.0.0.1:4321/api/status').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
printf 'RADAR_IMAGE=%s\n' "$image" > "$release/image.env.next"
mv -f "$release/image.env.next" "$release/image.env"
ln -sfn "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
trap - ERR HUP INT TERM
compose "$release" "$image" ps
printf 'Deployed %s\n' "$image"
