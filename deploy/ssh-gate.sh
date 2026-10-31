#!/usr/bin/env bash
set -euo pipefail
# Install as /usr/local/sbin/earthveda-ssh-gate, owned by root.
# The GitHub key may request exactly one release command, with no shell expansion.
original=${SSH_ORIGINAL_COMMAND:-}
if [[ "$original" =~ ^release\ (ghcr\.io/[a-z0-9_./-]+@sha256:[a-f0-9]{64})$ ]]; then
  exec env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    HOME=/home/earthveda USER=earthveda \
    /usr/bin/bash /opt/earthveda/deploy/release.sh "${BASH_REMATCH[1]}"
fi
echo 'Only the Earthveda release command is permitted.' >&2
exit 1
