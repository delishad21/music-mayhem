#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is not installed. Install it first: https://ngrok.com/download" >&2
  exit 1
fi

COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
UPDATE_ENV=false

for arg in "$@"; do
  case "$arg" in
    --dev)
      COMPOSE_FILE="$ROOT_DIR/docker-compose.dev.yml"
      ;;
    --update-env)
      UPDATE_ENV=true
      ;;
  esac
done

echo "[ngrok] Starting edge proxy (${COMPOSE_FILE##*/}) on port 8080..."
docker compose -f "$COMPOSE_FILE" up -d edge

if [[ "$UPDATE_ENV" == true ]]; then
  echo "[ngrok] Starting tunnel in background and updating .env..."
  ngrok http 8080 --log=stdout &
  NGROK_PID=$!

  python3 - <<'PY'
import json
import time
import urllib.request
import os

def get_url():
    with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=2) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    tunnels = data.get("tunnels", [])
    for t in tunnels:
        url = t.get("public_url")
        if url and url.startswith("https://"):
            return url
    return None

url = None
for _ in range(30):
    try:
        url = get_url()
    except Exception:
        url = None
    if url:
        break
    time.sleep(1)

if not url:
    raise SystemExit("Failed to read ngrok public URL from http://127.0.0.1:4040")

env_path = os.path.join(os.getcwd(), ".env")
with open(env_path, "r", encoding="utf-8") as f:
    lines = f.read().splitlines()

keys = {
    "FRONTEND_URL": url,
    "NEXT_PUBLIC_API_URL": url,
    "NEXTAUTH_URL": url,
}

def update_line(line: str) -> str:
    for k, v in keys.items():
        if line.startswith(k + "="):
            return f"{k}={v}"
    return line

updated = [update_line(line) for line in lines]
for k, v in keys.items():
    if not any(line.startswith(k + "=") for line in updated):
        updated.append(f"{k}={v}")

with open(env_path, "w", encoding="utf-8") as f:
    f.write("\n".join(updated) + "\n")

print(f"[ngrok] Updated .env with URL: {url}")
PY

  wait "$NGROK_PID"
else
  echo ""
  echo "[ngrok] Opening tunnel to http://localhost:8080"
  echo "[ngrok] Copy the HTTPS URL it prints and set:"
  echo "  FRONTEND_URL=<ngrok-https-url>"
  echo "  NEXT_PUBLIC_API_URL=<ngrok-https-url>"
  echo "  NEXTAUTH_URL=<ngrok-https-url>"
  echo ""
  ngrok http 8080
fi
