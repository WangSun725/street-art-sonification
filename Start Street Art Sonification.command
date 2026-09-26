#!/bin/zsh
set -eu

PROJECT_DIR="${0:A:h}"
APP_PORT="${STREET_ART_PORT:-8765}"
APP_URL="http://127.0.0.1:$APP_PORT"
cd "$PROJECT_DIR"

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "Street Art Sonification currently supports Apple Silicon Macs only."
  echo "Press Return to close this window."
  read -r
  exit 1
fi

if [[ ! -x "$PROJECT_DIR/.interaction-env/bin/python" \
   || ! -x "$PROJECT_DIR/.venv/bin/python" \
   || ! -s "$PROJECT_DIR/third_party/models/Qwen3-VL-2B-Instruct-4bit/model.safetensors" \
   || ! -s "$PROJECT_DIR/third_party/sam2/checkpoints/sam2.1_hiera_tiny.pt" ]]; then
  echo "The local models or environments are not installed yet."
  echo "Starting the first-time installer…"
  exec "$PROJECT_DIR/Install & Start.command"
fi

if curl -fsS "$APP_URL/api/demo" >/dev/null 2>&1; then
  echo "Street Art Sonification is already running."
  if [[ "${STREET_ART_NO_OPEN:-0}" != "1" ]]; then
    open "$APP_URL"
  fi
  exit 0
fi

echo
echo "Street Art Sonification is starting…"
echo "Keep this Terminal window open while using the project."
echo "Close this window or press Control-C to stop the local server."
echo

"$PROJECT_DIR/.interaction-env/bin/python" "$PROJECT_DIR/webapp/server.py" &
SERVER_PID=$!

stop_server() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap stop_server EXIT INT TERM

for attempt in {1..60}; do
  if curl -fsS "$APP_URL/api/demo" >/dev/null 2>&1; then
    if [[ "${STREET_ART_NO_OPEN:-0}" != "1" ]]; then
      open "$APP_URL"
    fi
    wait "$SERVER_PID"
    exit $?
  fi
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    echo "The local server stopped before the page was ready."
    echo "Press Return to close this window."
    read -r
    exit 1
  fi
  sleep 1
done

echo "The server did not become ready within 60 seconds."
echo "Press Return to close this window."
read -r
exit 1
