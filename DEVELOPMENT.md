# Music Mayhem

A real-time multiplayer music guessing game with three game modes: **Finish the Lyrics**, **Guess the Song (Easy)**, and **Guess the Song (Challenge)**. Built with a microservices architecture featuring Next.js frontend, Express/Socket.IO game server, and Flask-based song processing service.

## Quick Start

### Development (with hot reload)

```bash
cp .env .env.local || true
# Edit .env if needed

docker compose -f docker-compose.dev.yml up -d --build
```

Access the game at http://localhost:3000

### Production (single URL via nginx edge)

```bash
# Edit .env for production domains and secrets

docker compose up -d --build
```

### Portainer / Home Server

- Use `docker-compose.portainer.yml` and supply env vars in Portainer
- Mounts expect `/srv/musicgame`

---

## Architecture Overview

Music Mayhem uses a **microservices architecture** with four main components:

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Web Browser)                      │
│                 HTTP + WebSocket Connections                 │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
              ┌────────────────────────┐
              │   EDGE (Nginx Proxy)   │
              │      Port 5762         │
              └────────────────────────┘
                     ↓         ↓
        ┌────────────┘         └───────────┐
        ↓                                   ↓
┌──────────────────┐              ┌──────────────────┐
│    FRONTEND      │              │  GAME-SERVICE    │
│   (Next.js 15)   │              │ (Express+Socket) │
│    Port 3000     │◄────────────►│    Port 5000     │
└──────────────────┘              └──────────────────┘
                                           ↕
                                  ┌──────────────────┐
                                  │  SONG-SERVICE    │
                                  │  (Flask/Python)  │
                                  │    Port 5001     │
                                  └──────────────────┘
                                           ↕
                                  ┌──────────────────┐
                                  │    MONGODB       │
                                  │   Port 27017     │
                                  └──────────────────┘
                                           ↕
                                  ┌──────────────────┐
                                  │  Shared Volume   │
                                  │   song_data/     │
                                  │   - audio/       │
                                  │   - lyrics/      │
                                  └──────────────────┘
```

### Services

1. **Frontend** ([docs](frontend/README.md))
   - Next.js 15 App Router with React 19
   - Auth.js (NextAuth) for authentication (credentials + guest mode)
   - Socket.IO client for real-time game state synchronization
   - Zustand for state management
   - Tailwind CSS for styling

2. **Game Service** ([docs](game-service/README.md))
   - Express.js REST API for authentication and room management
   - Socket.IO server for real-time multiplayer game orchestration
   - Game logic: room creation, playlist management, round orchestration, scoring
   - Serves audio files from shared volume at `/audio/*`
   - MongoDB integration for users and game sessions

3. **Song Service** ([docs](song-service/README.md))
   - Flask REST API for playlist parsing and song downloads
   - yt-dlp for audio extraction from YouTube
   - syncedlyrics for time-synced lyrics from multiple sources
   - Playlist parsing for Spotify and YouTube
   - MongoDB storage for song metadata

4. **Edge (Nginx)**
   - Reverse proxy exposing all services on single port (5762)
   - Routes HTTP requests to appropriate services
   - WebSocket upgrade support for Socket.IO

5. **MongoDB**
   - Stores users (authentication, session history)
   - Stores song metadata (title, artist, lyrics, paths)
   - No active game state (handled in-memory by Socket.IO)

---

## How Services Interact

### 1. Frontend ↔ Game Service

**REST API Communication:**
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate with username/password
- `POST /api/auth/guest` - Quick guest login
- `GET /api/auth/history/:username` - Retrieve game history
- `GET /api/rooms` - List active public rooms
- `GET /api/rooms/:code` - Get room details
- `POST /api/songs/parse-spotify-playlist` - Parse Spotify playlist (proxied to song-service)
- `POST /api/songs/parse-youtube-playlist` - Parse YouTube playlist (proxied to song-service)
- `POST /api/songs/create-song-list` - Create custom song list

**WebSocket (Socket.IO) Events:**

*Client → Server:*
- `create-room` - Create new game room
- `join-room` - Join existing room by code
- `leave-room` - Leave current room
- `get-rooms` - Request active rooms list
- `update-settings` - Update room settings (host only)
- `prepare-playlist` - Pre-download songs before game starts
- `start-game` - Begin game with playlist (host only)
- `stop-game` - Stop active game (host only)
- `skip-round` - Skip current song (host only)
- `next-round` - Advance to next round (host only)
- `submit-answer` - Submit player answer with timestamp
- `typing-status` - Broadcast typing indicator

*Server → Client:*
- `room-created` - Room successfully created
- `room-joined` - Successfully joined room
- `player-joined` - Another player joined
- `player-left` - Player exited room
- `settings-updated` - Room settings changed
- `game-starting` - Game initialization begun
- `playlist-preparing` - Downloading/processing songs
- `playlist-ready` - First song ready to play
- `loading-song` - Loading next song
- `round-countdown` - 3-second countdown before round
- `round-started` - Audio playing, display clip
- `show-hangman` - Display hangman puzzle (finish-lyrics mode)
- `play-clip` - Play audio clip (guess-song modes)
- `answer-feedback` - Validation result and points awarded
- `player-answer-status` - Update player status on scoreboard
- `chat-message` - Wrong answer displayed as chat
- `round-ended` - Round results and updated scores
- `game-ended` - Game over, final standings
- `sync-state` - Resync state for late-joiners/reconnects
- `song-skipped` - Song failed to load, moving to next
- `game-stopped` - Host stopped game mid-play
- `error` - Error occurred
- `toast` - UI notification message

**Audio Streaming:**
- Frontend fetches audio via `GET /audio/{filename}` served by game-service
- Audio files stored in shared volume, written by song-service

### 2. Game Service ↔ Song Service

**HTTP Communication (Game Service as Client):**

Game service makes HTTP requests to Flask API:

1. **Metadata Preparation:**
   - `POST /prepare-song` → Get song metadata without downloading
   - Input: `{url?, songName?, artist?, requireLyrics}`
   - Output: `{metadata: {title, artist, duration, lyricLines, ...}}`

2. **Download Initiation:**
   - `POST /download-song` → Start async download job
   - Input: `{url?, songName?, artist?, lyricLines, duration, ...}`
   - Output: `{jobId, status}`

3. **Status Polling:**
   - `GET /job-status/{jobId}` → Check download progress
   - Polls every 1 second, 60-second timeout
   - Output: `{status, progress, songId?, error?, phase?}`

4. **Playlist Parsing:**
   - `POST /parse-spotify-playlist` → Extract Spotify playlist tracks
   - `POST /parse-youtube-playlist` → Extract YouTube playlist videos
   - Output: `{tracks: [{songName, artist, url?, albumArtUrl?}]}`

**Data Flow:**

```
Game Service                Song Service                MongoDB + Filesystem
─────────────────────────────────────────────────────────────────────────
1. POST /prepare-song   →   Fetch metadata
                            Get lyrics from sources
                        ←   {metadata}

2. Compute game clip        (based on metadata)
   (hangman, timing)

3. POST /download-song  →   Background job starts
                        ←   {jobId}

4. Poll /job-status/:id →   yt-dlp downloads audio      → Write audio file
                            syncedlyrics fetches sync   → Write .lrc file
                            Store in MongoDB            → Insert Song doc
                        ←   {status: 'completed',
                             songId: 'abc123'}

5. Emit progress to
   frontend via socket

6. Start next round,
   serve audio via
   GET /audio/abc123.mp3
```

### 3. Song Service ↔ MongoDB

**Collections:**

1. **songs** - Song metadata and paths
   ```javascript
   {
     _id: ObjectId,
     title: String,
     artist: String,
     duration: Number,
     audioPath: String,          // e.g., "/app/songs/audio/abc123.mp3"
     lyricsPath: String,         // e.g., "/app/songs/lyrics/abc123.lrc"
     lyricLines: [{time: Number, text: String}],
     albumArtUrl: String,
     lyricsSource: String,
     sourceUrl: String,
     createdAt: Date
   }
   ```

2. **users** - Authentication and history
   ```javascript
   {
     _id: ObjectId,
     username: String,
     password: String,           // bcrypt hashed
     displayName: String,
     isGuest: Boolean,
     sessionHistory: [{
       gameMode: String,
       score: Number,
       date: Date,
       roomCode: String
     }],
     createdAt: Date
   }
   ```

---

## Game Modes

### 1. Finish the Lyrics

**Gameplay:**
- Full song plays with scrolling synced lyrics
- At a specific time window, next lyric line is hidden (shown as hangman puzzle)
- Players type the exact lyrics to fill in the blanks
- Scoring based on word-match accuracy (0-1000 points)

**Configuration:**
- `answerTime` - Seconds to submit answer (default: 15s)
- `revealOptions` - Languages/characters to reveal (numbers, Chinese, Korean, etc.)
- `clipDuration` - Length of lyric clip to play before answer phase

**Game Flow:**
1. Round countdown (3s)
2. Audio plays with scrolling lyrics
3. Hangman display shown at target lyric
4. Players submit answers during answer phase
5. Results displayed with word-match percentage
6. Advance to next round

### 2. Guess the Song (Easy)

**Gameplay:**
- 15-second audio clip plays (continuous or random start)
- Players guess **song title** and **all artists**
- Can answer during clip playback
- Time-based scoring for title (1000 → 200 points)
- Flat 200 points per correct artist

**Configuration:**
- `clipDuration` - Clip length (default: 15s)
- `randomStart` - Random vs. beginning of song
- `answerTime` - Seconds to answer after clip (default: 10s)

**Game Flow:**
1. Round countdown (3s)
2. Audio clip plays
3. Players type title and artists
4. Immediate feedback on submission
5. Results show all correct artists
6. Advance to next round

### 3. Guess the Song (Challenge)

**Gameplay:**
- Progressive clips: 1s → 2s → 5s → 10s
- Players guess after each clip or wait for longer clips
- Earlier guesses = higher scores (1000 for 1s, 200 for 10s)
- Same artist bonus system as Easy mode

**Configuration:**
- `randomStart` - Random clip locations
- `answerTime` - Seconds to answer between clips

**Game Flow:**
1. Round countdown (3s)
2. Play 1-second clip → answer window
3. Play 2-second clip → answer window
4. Play 5-second clip → answer window
5. Play 10-second clip → answer window
6. Display results and scores
7. Advance to next round

---

## Complete Game Session Flow

```
1. User → Frontend: Register/Login/Guest
   Frontend → Game Service: POST /api/auth/login
   Game Service → MongoDB: Validate credentials
   Game Service → Frontend: JWT token + user info

2. User → Frontend: Create room
   Frontend → Socket: emit('create-room', settings)
   Game Service: Generate room code, initialize state
   Socket → Frontend: emit('room-created', {roomCode})

3. Other players join:
   Frontend → Socket: emit('join-room', {roomCode})
   Socket → All clients: emit('player-joined', player)

4. Host uploads playlist:
   Frontend → Socket: emit('prepare-playlist', {playlistItems})

5. Game Service downloads songs:
   For each song:
     Game Service → Song Service: POST /prepare-song
     Song Service → Game Service: {metadata}
     Game Service: Compute clip (hangman/timing)
     Game Service → Song Service: POST /download-song
     Song Service: Background download (yt-dlp + lyrics)
     Song Service → Filesystem: Write audio + lyrics
     Song Service → MongoDB: Insert song document
     Game Service polls: GET /job-status/{jobId}
     Socket → Frontend: emit('queue-status', progress)

6. Host starts game:
   Frontend → Socket: emit('start-game')
   Socket → All clients: emit('game-starting')

7. For each round:
   Socket → Clients: emit('loading-song')
   Socket → Clients: emit('round-countdown')
   Socket → Clients: emit('round-started', {audioUrl, clipData})

   Players submit answers:
   Frontend → Socket: emit('submit-answer', {answer, timestamp})
   Game Service: Validate answer, calculate score
   Socket → Player: emit('answer-feedback', {points, correct})
   Socket → All: emit('player-answer-status', {userId, status})

   Round ends:
   Socket → All: emit('round-ended', {scores, correctAnswer})
   Auto-advance after resultsDelay (default: 7s)

8. Game ends:
   Socket → All: emit('game-ended', {finalScores})
   Game Service → MongoDB: Save session history
   Frontend: Display final standings

9. Players leave:
   Frontend → Socket: emit('leave-room')
   Socket → Others: emit('player-left')
```

---

## Key Features

### Authentication
- **Registered Users:** Username + password (bcrypt hashed, 10 rounds)
- **Guest Mode:** Auto-generated username, no password
- **JWT Tokens:** 7-day expiration
- **Session History:** Games played, scores, modes

### Room Management
- **Private Rooms:** Password-protected with bcrypt
- **Spectator Mode:** Late joiners watch without playing
- **Host Controls:** Update settings, start/stop game, skip rounds
- **Real-time Updates:** All state changes broadcast via Socket.IO

### Song Queue System
- **Parallel Downloads:** Up to 5 concurrent downloads
- **Buffer Ahead:** Maintains 5-song ready buffer
- **Progress Tracking:** Live updates to frontend
- **Error Handling:** Skip failed songs, continue queue

### Lyric Processing
- **Multi-language Support:** Chinese (Simplified ↔ Traditional), Korean, Japanese, Vietnamese, Spanish
- **Synced Lyrics:** Time-aligned with audio (LRC format)
- **Multiple Sources:** Lrclib, NetEase, Musixmatch
- **Hangman Display:** Configurable reveal options per language

### Scoring
- **Time-based:** Guess Song modes (earlier = higher score)
- **Accuracy-based:** Finish Lyrics mode (word-match %)
- **Artist Bonus:** 200 points per correct artist
- **Multiplayer:** Real-time leaderboard updates

---

## Deployment Architecture

### Docker Services

```yaml
services:
  mongodb:      # Database
  song-service: # Flask API (Python)
  game-service: # Express + Socket.IO (Node.js)
  frontend:     # Next.js SSR
  edge:         # Nginx reverse proxy
```

### Nginx Routing

```
/                → frontend:3000
/api/*           → game-service:5000
/socket.io/*     → game-service:5000 (WebSocket upgrade)
/audio/*         → game-service:5000 (static files)
```

### Shared Volumes

- `mongodb_data` - Database persistence
- `song_data` - Audio and lyrics files shared between game-service and song-service
- `frontend_node_modules` - Dev mode cache
- `backend_node_modules` - Dev mode cache

### Environment Variables

See `.env.example` for full configuration. Key variables:

**Game Service:**
- `MONGODB_URI`
- `JWT_SECRET`
- `SONG_SERVICE_URL`
- `PORT`

**Song Service:**
- `MONGODB_URI`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- `USE_YT_MUSIC`, `YT_MUSIC_ONLY`
- `SYNCEDLYRICS_PROVIDERS`

**Frontend:**
- `NEXT_PUBLIC_API_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

---

## Development

### Prerequisites
- Docker & Docker Compose
- (Optional) Spotify API credentials for playlist parsing

### Local Setup

1. Clone repository
2. Copy environment file:
   ```bash
   cp .env .env.local
   ```
3. (Optional) Add Spotify credentials to `.env.local`
4. Start services:
   ```bash
   docker compose -f docker-compose.dev.yml up -d --build
   ```
5. Access at http://localhost:3000

### Hot Reload

Development mode includes:
- Frontend: Next.js fast refresh
- Game Service: nodemon auto-restart
- Song Service: Flask debug mode

### Logs

```bash
# All services
docker compose -f docker-compose.dev.yml logs -f

# Specific service
docker compose -f docker-compose.dev.yml logs -f game-service
```

---

## Repository Structure

```
.
├── frontend/              # Next.js 15 client app
│   ├── src/
│   │   ├── app/          # App Router pages
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks (useSocket, game hooks)
│   │   ├── store/        # Zustand state management
│   │   ├── lib/          # API client, utilities
│   │   └── types/        # TypeScript types
│   └── public/           # Static assets
│
├── game-service/         # Express + Socket.IO backend
│   └── src/
│       ├── routes/       # REST API routes
│       ├── services/     # Socket.IO, song queue
│       ├── models/       # MongoDB models
│       ├── types/        # TypeScript types
│       └── utils/        # Game logic, utilities
│
├── song-service/         # Flask Python service
│   ├── app.py           # Flask routes
│   ├── downloader.py    # yt-dlp, lyrics fetching
│   ├── parse_playlist.py # Spotify/YouTube parsing
│   └── spotify_integration.py # Spotify API client
│
├── infra/nginx/          # Nginx configuration
│   └── templates/        # Dynamic config templates
│
├── scripts/              # Utility scripts
│   ├── build-and-push.sh # Docker build/push
│   └── ngrok-tunnel.sh   # Ngrok tunneling
│
├── docker-compose.yml           # Production compose
├── docker-compose.dev.yml       # Development compose
└── docker-compose.portainer.yml # Portainer/home server
```

---

## Service Documentation

- [Frontend README](frontend/README.md) - Next.js app, components, state management
- [Game Service README](game-service/README.md) - REST API, Socket.IO events, game logic
- [Song Service README](song-service/README.md) - Flask API, downloading, lyrics

---

## Troubleshooting

### Songs not downloading
- Check `SONG_SERVICE_URL` in game-service env
- Verify yt-dlp is updated in song-service container
- Check song-service logs: `docker compose logs -f song-service`

### Socket.IO connection issues
- Ensure nginx correctly upgrades WebSocket connections
- Check `NEXT_PUBLIC_API_URL` matches your domain
- Verify CORS settings in game-service

### Lyrics not syncing
- Some songs may not have synced lyrics available
- Check `SYNCEDLYRICS_PROVIDERS` configuration
- Try different lyric sources in env vars

### Audio playback issues
- Verify shared volume `song_data` is mounted correctly
- Check audio files exist in `song_data/audio/`
- Ensure game-service has read access to shared volume

---

## License

MIT (or your chosen license)

---

## Credits

Built with:
- [Next.js](https://nextjs.org/) - Frontend framework
- [Socket.IO](https://socket.io/) - Real-time communication
- [Express](https://expressjs.com/) - Backend framework
- [Flask](https://flask.palletsprojects.com/) - Song service API
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Audio downloading
- [syncedlyrics](https://github.com/rtcq/syncedlyrics) - Lyrics fetching
- [MongoDB](https://www.mongodb.com/) - Database
