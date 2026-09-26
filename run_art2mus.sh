#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$ROOT_DIR/.art2mus-env/bin/python" "$ROOT_DIR/run_art2mus.py" "$@"
