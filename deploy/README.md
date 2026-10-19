# Home server deployment

```
browser ─HTTPS─▶ host nginx :443 (musicgame.delishad.com) ─▶ 127.0.0.1:5762 edge (nginx) ─┬─ /api, /socket.io, /audio ─▶ game-service ─▶ mongodb
                                                                                          └─ everything else ─▶ frontend          song-service ─▶ pot-provider
```

- Compose project `musicgame`, stack: [docker-compose.yml](../docker-compose.yml). Every image
  (`musicgame-<service>:<commit>`) is built on the server from this repo; mongo and the
  PO-token provider are pulled as before.
- Settings and secrets: `~/services/musicgame/.env` on the server, from
  [musicgame.env.example](musicgame.env.example).
- Data: `/srv/musicgame/mongodb` (database, backed up nightly via the `backup: mongo` label),
  `/srv/musicgame/songs` (downloaded audio/lyrics, re-downloadable), `/srv/musicgame/cookies.txt`
  (optional yt-dlp cookies).
- nginx: the existing host site `musicgame.conf` (proxies everything to 127.0.0.1:5762,
  WebSocket headers included) is unchanged. The edge proxy config now lives in
  [infra/nginx/edge.conf](../infra/nginx/edge.conf) and is baked into the `musicgame-edge`
  image; `/srv/musicgame/nginx/default.conf` is no longer used.
- Health: `https://musicgame.delishad.com/api/health` (game service, through both proxies).

## Deploying

Say `ship <task>` or run `devbot deploy music-mayhem`; `devbot rollback music-mayhem` undoes it.

Logs: `docker logs music-game-game-service` (also `-frontend`, `-songs`, `-edge`, `-mongo`)
and `/var/log/nginx/musicgame_*.log`.

## First-time setup (switching from Portainer stack 42)

1. Run `devbot adopt music-mayhem 42` to copy the Portainer stack's environment into
   `~/services/musicgame/.env`.
2. Check that `.env` has `PORT=5000` (the edge proxy expects it) and compare it with
   [musicgame.env.example](musicgame.env.example); `DOCKERHUB_USERNAME` is no longer needed.
3. Ship (`ship <task>` or `devbot deploy music-mayhem`). The first deploy stops and removes the
   Portainer stack and starts the same containers, network and `/srv/musicgame` data under the
   new images.
4. Open https://musicgame.delishad.com, sign in and start a room to confirm songs still play.
5. Optionally delete the old `delishad21/musicgame-*` images on Docker Hub and
   `/srv/musicgame/nginx/default.conf` on the server.

## Retired

The Docker Hub flow (`scripts/push-images.sh` building and pushing
`delishad21/musicgame-*:latest` for Portainer to pull) has been removed.
