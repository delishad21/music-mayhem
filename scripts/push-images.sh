#!/usr/bin/env bash
set -euo pipefail

DOCKERHUB_USER="${DOCKERHUB_USER:-delishad21}"
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://musicgame.delishad.com}"
VERSION_TAG="${VERSION_TAG:-}"
PLATFORM="${PLATFORM:-}"
REPOS=(
  "musicgame-game-service"
  "musicgame-song-service"
  "musicgame-frontend"
)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_cmd docker
require_cmd python3

get_next_version() {
  local repo="$1"
  python3 - <<'PY' "$DOCKERHUB_USER" "$repo"
import json
import sys
import urllib.request

user = sys.argv[1]
repo = sys.argv[2]

def fetch_tags():
    tags = []
    url = f"https://hub.docker.com/v2/repositories/{user}/{repo}/tags?page_size=100"
    while url:
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                # Repo doesn't exist yet -> no tags.
                return []
            raise
        tags.extend([t.get("name", "") for t in data.get("results", [])])
        url = data.get("next")
    return tags

tags = fetch_tags()
versions = []
for tag in tags:
    if tag.startswith("v") and tag[1:].isdigit():
        versions.append(int(tag[1:]))

next_version = 1 if not versions else max(versions) + 1
print(f"v{next_version}")
PY
}

pull_if_exists() {
  local image="$1"
  if docker manifest inspect "$image" >/dev/null 2>&1; then
    log "Pulling existing image: $image"
    local platform_args=()
    if [[ -n "$PLATFORM" ]]; then
      platform_args=(--platform "$PLATFORM")
    fi
    if ! docker pull "${platform_args[@]}" "$image"; then
      log "Warning: could not pull existing image, continuing without cache: $image"
    fi
  else
    log "No existing image found for: $image"
  fi
}

build_and_push() {
  local repo="$1"
  local version_tag="$2"
  local image_base="${DOCKERHUB_USER}/${repo}"
  local versioned="${image_base}:${version_tag}"
  local latest="${image_base}:latest"

  pull_if_exists "$latest"
  pull_if_exists "$versioned"

  local platform_args=()
  if [[ -n "$PLATFORM" ]]; then
    platform_args=(--platform "$PLATFORM")
  fi

  log "Building ${repo} as ${versioned}"
  case "$repo" in
    musicgame-game-service)
      docker build "${platform_args[@]}" -t "$versioned" -f "$ROOT_DIR/game-service/Dockerfile" "$ROOT_DIR/game-service"
      ;;
    musicgame-song-service)
      docker build "${platform_args[@]}" -t "$versioned" -f "$ROOT_DIR/song-service/Dockerfile" "$ROOT_DIR/song-service"
      ;;
    musicgame-frontend)
      docker build \
        "${platform_args[@]}" \
        --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
        -t "$versioned" \
        -f "$ROOT_DIR/frontend/Dockerfile" \
        "$ROOT_DIR/frontend"
      ;;
    *)
      echo "Unknown repo: $repo" >&2
      exit 1
      ;;
  esac

  log "Tagging ${versioned} as ${latest}"
  docker tag "$versioned" "$latest"

  log "Pushing ${versioned}"
  docker push "$versioned"

  log "Pushing ${latest}"
  docker push "$latest"
}

log "Docker Hub user: $DOCKERHUB_USER"
log "Frontend public API URL: $NEXT_PUBLIC_API_URL"
if [[ -n "$PLATFORM" ]]; then
  log "Build platform: $PLATFORM"
fi

if [[ -n "$VERSION_TAG" ]]; then
  NEXT_VERSION="$VERSION_TAG"
else
  log "Fetching next version tag..."
  NEXT_VERSION="$(get_next_version "${REPOS[0]}")"
fi
log "Next version tag: $NEXT_VERSION"

for repo in "${REPOS[@]}"; do
  build_and_push "$repo" "$NEXT_VERSION"
done

log "All images pushed: version=${NEXT_VERSION} and latest"
