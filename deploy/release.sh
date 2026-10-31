#!/usr/bin/env bash
set -euo pipefail
umask 077
# Override only for isolated operator-run tests. The SSH gate fixes this path.
cd "${EARTHVEDA_DEPLOY_DIR:-/opt/earthveda}"
image=${1:?Supply the verified GHCR image digest}
[[ $# == 1 && "$image" =~ ^ghcr\.io/[a-z0-9_./-]+@sha256:[a-f0-9]{64}$ ]] || exit 1
exec 9>.deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 1; }

# Parse only these simple values; never execute an environment file as shell code.
settings_text=$(python3 - <<'PY'
from pathlib import Path
values = {}
for line in Path('release.env').read_text().splitlines():
    if '=' not in line or line.lstrip().startswith('#'):
        continue
    key, value = line.split('=', 1)
    key = key.strip()
    if key in ('DEPLOY_IMAGE_REPOSITORY', 'DOMAIN'):
        if key in values:
            raise SystemExit('Duplicate release setting')
        values[key] = value.strip()
print(values.get('DEPLOY_IMAGE_REPOSITORY', ''))
print(values.get('DOMAIN', ''))
PY
)
mapfile -t settings <<< "$settings_text"
repository=${settings[0]:-}
domain=${settings[1]:-}
[[ "$repository" =~ ^ghcr\.io/[a-z0-9_.-]+/[a-z0-9_.-]+$ ]] || { echo 'Set DEPLOY_IMAGE_REPOSITORY in release.env'; exit 1; }
[[ "$image" == "$repository"@sha256:* ]] || { echo 'Refusing an image from another repository'; exit 1; }
[[ "$domain" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$ ]] || { echo 'Set a valid DOMAIN in release.env'; exit 1; }
[[ -f .env.production ]] || { echo 'Missing .env.production'; exit 1; }
chmod 600 .env.production release.env
install -m 600 release.env release.env.previous

python3 - "$image" <<'PY'
import os
from pathlib import Path
import sys
import tempfile
target = Path('release.env')
lines = [line for line in target.read_text().splitlines() if line.split('=', 1)[0].strip() != 'APP_IMAGE']
fd, name = tempfile.mkstemp(prefix='.release-', dir='.')
try:
    with os.fdopen(fd, 'w') as f:
        f.write('\n'.join(lines + ['APP_IMAGE=' + sys.argv[1]]) + '\n')
    os.replace(name, target)
finally:
    if os.path.exists(name):
        os.unlink(name)
PY
compose=(docker compose --env-file release.env -f compose.production.yaml)
https_ready() {
  curl --fail --silent --show-error --retry 10 --retry-delay 3 \
    --retry-connrefused --retry-all-errors --retry-max-time 90 --max-time 10 \
    "https://$domain/api/ready" >/dev/null
}
rollback() {
  echo 'Release failed; restoring previous image configuration.'
  install -m 600 release.env.previous release.env
  # Try both commands even if pulling fails: the previous image may be cached.
  "${compose[@]}" pull || true
  if "${compose[@]}" up -d --wait --wait-timeout 180 && https_ready; then
    echo 'Previous release is healthy.'
  else
    echo 'Rollback is unhealthy. Inspect server/container logs.' >&2
  fi
}
if ! "${compose[@]}" config --quiet || ! "${compose[@]}" pull || \
   ! "${compose[@]}" up -d --wait --wait-timeout 180 || ! https_ready; then
  rollback
  exit 1
fi
echo "Release healthy: $image"
