#!/usr/bin/env bash
set -euo pipefail

required_env=()
required_env+=("PHAROS_RPC_URL")
required_env+=("PHAROS_DEPLOYER_PRIVATE_KEY")

for name in "${required_env[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
done

echo "Pharos deployment scaffold ready."
echo "Target runtime: node18"
# TODO: replace with your agent's actual start command
