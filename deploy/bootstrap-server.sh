#!/usr/bin/env bash
# Run once as root on a fresh Ubuntu 24.04/26.04 amd64 VPS.
# Infrastructure accounts, DNS and Atlas are configured separately.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run this script as root on the server.'; exit 1; }
[[ -f /etc/os-release ]] || exit 1
. /etc/os-release
[[ "$ID" == ubuntu && ( "$VERSION_ID" == 24.04 || "$VERSION_ID" == 26.04 ) ]] || {
  echo 'This bootstrap supports Ubuntu 24.04 or 26.04.'; exit 1;
}
[[ "$(dpkg --print-architecture)" == amd64 ]] || { echo 'The included pipeline builds linux/amd64; choose an x86 server.'; exit 1; }
if command -v docker >/dev/null; then
  echo 'Docker already exists. Validate its official installation and Compose plugin before proceeding.'
  docker compose version
else
  apt-get update
  apt-get install -y ca-certificates curl python3 util-linux openssh-server
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# These are also required if Docker was installed before this script.
apt-get install -y python3 curl util-linux
systemctl enable --now docker
if ! id earthveda >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash earthveda
fi
# Docker membership is privileged. Only the forced deployment key is installed.
usermod -aG docker earthveda
install -d -m 770 -o root -g earthveda /opt/earthveda
install -d -m 755 -o root -g root /opt/earthveda/deploy
install -d -m 700 -o earthveda -g earthveda /home/earthveda/.ssh
docker compose version
echo 'Host prepared. Follow docs/CI_CD_DEPLOYMENT_BASH.md to install release files, keys and private configuration.'
