#!/usr/bin/env bash
# Exercise the real release script against fake Docker/curl commands, no cloud credentials.
set -euo pipefail
project=$(cd "$(dirname "$0")/.." && pwd)
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
mkdir -p "$test_dir/bin"
old_image="ghcr.io/example/earthveda@sha256:$(printf 'a%.0s' {1..64})"
new_image="ghcr.io/example/earthveda@sha256:$(printf 'b%.0s' {1..64})"
export DEPLOY_TEST_NEW_IMAGE="$new_image"

cat > "$test_dir/bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == compose && "$2" == --env-file && "$3" == release.env ]]
operation=${6:?}
image=$(sed -n 's/^APP_IMAGE=//p' release.env)
printf '%s %s\n' "$operation" "$image" >> "$DEPLOY_TEST_LOG"
if [[ "$image" == "$DEPLOY_TEST_NEW_IMAGE" ]]; then
  [[ "${DEPLOY_TEST_FAILURE:-}" == pull && "$operation" == pull ]] && exit 1
  [[ "${DEPLOY_TEST_FAILURE:-}" == start && "$operation" == up ]] && exit 1
fi
[[ "${DEPLOY_TEST_FAILURE:-}" == rollback && "$operation" == up ]] && exit 1
exit 0
SH
cat > "$test_dir/bin/curl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
image=$(sed -n 's/^APP_IMAGE=//p' release.env)
printf 'https %s\n' "$image" >> "$DEPLOY_TEST_LOG"
[[ "$*" == *https://shop.example.com/api/ready* && "$*" == *--fail* ]]
if [[ "${DEPLOY_TEST_FAILURE:-}" == https && "$image" == "$DEPLOY_TEST_NEW_IMAGE" ]]; then exit 22; fi
exit 0
SH
chmod 700 "$test_dir/bin/docker" "$test_dir/bin/curl"
export PATH="$test_dir/bin:$PATH"

prepare() {
  scenario_dir="$test_dir/$1"
  mkdir -p "$scenario_dir"
  printf 'DOMAIN=shop.example.com\nDEPLOY_IMAGE_REPOSITORY=ghcr.io/example/earthveda\nAPP_IMAGE=%s\n' "$old_image" > "$scenario_dir/release.env"
  printf 'TEST_ONLY=1\n' > "$scenario_dir/.env.production"
  cp "$scenario_dir/release.env" "$scenario_dir/original.env"
  : > "$scenario_dir/commands.log"
  export EARTHVEDA_DEPLOY_DIR="$scenario_dir" DEPLOY_TEST_LOG="$scenario_dir/commands.log"
  export DEPLOY_TEST_FAILURE=''
}
run_release() { bash "$project/deploy/release.sh" "$1" > "$scenario_dir/output.log" 2>&1; }
fail() { echo "FAIL: $*" >&2; exit 1; }

prepare success
run_release "$new_image" || fail 'healthy release failed'
grep -Fxq "APP_IMAGE=$new_image" "$scenario_dir/release.env" || fail 'new digest not selected'
cmp "$scenario_dir/release.env.previous" "$scenario_dir/original.env" || fail 'previous config lost'
grep -Fxq "https $new_image" "$DEPLOY_TEST_LOG" || fail 'HTTPS readiness not checked'
[[ "$(stat -c '%a' "$scenario_dir/release.env")" == 600 ]] || fail 'release file permissions'
echo 'PASS: healthy release selects digest, preserves previous config and checks HTTPS'

for failure in pull start https; do
  prepare "$failure"
  export DEPLOY_TEST_FAILURE="$failure"
  if run_release "$new_image"; then fail "failed $failure returned success"; fi
  cmp "$scenario_dir/release.env" "$scenario_dir/original.env" || fail "$failure did not restore config"
  grep -Fxq "up $old_image" "$DEPLOY_TEST_LOG" || fail "$failure did not restart old release"
  grep -Fxq "https $old_image" "$DEPLOY_TEST_LOG" || fail "$failure rollback not verified"
  echo "PASS: $failure failure restores and verifies previous release, reports failure"
done

prepare rollback
export DEPLOY_TEST_FAILURE=rollback
if run_release "$new_image"; then fail 'unhealthy rollback returned success'; fi
cmp "$scenario_dir/release.env" "$scenario_dir/original.env" || fail 'unhealthy rollback lost old digest'
grep -q 'Rollback is unhealthy' "$scenario_dir/output.log" || fail 'rollback failure not reported'
echo 'PASS: unhealthy rollback preserves old config and reports an incident'

for invalid in 'ghcr.io/attacker/other@sha256:' 'ghcr.io/example/earthveda:latest' 'bad;touch /tmp/evil'; do
  prepare invalid
  candidate="$invalid"
  [[ "$invalid" == *sha256: ]] && candidate="$invalid$(printf 'b%.0s' {1..64})"
  if run_release "$candidate"; then fail 'unsafe image accepted'; fi
  cmp "$scenario_dir/release.env" "$scenario_dir/original.env" || fail 'unsafe image changed release'
  [[ ! -s "$DEPLOY_TEST_LOG" ]] || fail 'unsafe image invoked Docker'
done
echo 'PASS: other repositories, mutable tags and shell injection rejected before Docker'

prepare duplicate
printf 'DOMAIN=other.example.com\n' >> "$scenario_dir/release.env"
if run_release "$new_image"; then fail 'duplicate release settings accepted'; fi
[[ ! -s "$DEPLOY_TEST_LOG" ]] || fail 'duplicate configuration invoked Docker'
echo 'PASS: duplicate release settings rejected'

prepare locked
(
  exec 8>"$scenario_dir/.deploy.lock"
  flock -n 8
  if run_release "$new_image"; then fail 'concurrent release accepted'; fi
)
[[ ! -s "$DEPLOY_TEST_LOG" ]] || fail 'concurrent release invoked Docker'
echo 'PASS: server lock rejects overlapping releases'

for command in 'whoami' "release $new_image; echo injection" "release $new_image extra"; do
  if SSH_ORIGINAL_COMMAND="$command" bash "$project/deploy/ssh-gate.sh" > "$test_dir/gate.log" 2>&1; then
    fail 'SSH gate accepted an unrestricted command'
  fi
done
echo 'PASS: deployment SSH key rejects arbitrary commands and command injection'

# Intercept env only after the release tests to inspect the allowed gate invocation.
cat > "$test_dir/bin/env" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$DEPLOY_TEST_LOG"
SH
chmod 700 "$test_dir/bin/env"
SSH_ORIGINAL_COMMAND="release $new_image" bash "$project/deploy/ssh-gate.sh" || fail 'valid gate command rejected'
grep -Fxq /opt/earthveda/deploy/release.sh "$DEPLOY_TEST_LOG" || fail 'gate did not select trusted script'
grep -Fxq "$new_image" "$DEPLOY_TEST_LOG" || fail 'gate did not forward exact digest as one argument'
grep -Fxq -- -i "$DEPLOY_TEST_LOG" || fail 'gate did not clear client-controlled environment'
echo 'PASS: valid SSH release selects trusted script, resets environment and forwards exact digest'
