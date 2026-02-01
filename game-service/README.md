# Game Service - Music Mayhem

The **Game Service** is the core backend for Music Mayhem, built with **Express.js** and **Socket.IO**. It orchestrates real-time multiplayer gameplay, manages rooms, handles authentication, coordinates song downloads, validates answers, and calculates scores.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Real-time:** Socket.IO
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JWT + bcrypt
- **Audio Serving:** Express static middleware

## Quick Start

### Development

```bash
# From project root
docker compose -f docker-compose.dev.yml up -d --build

# Or standalone
cd game-service
npm install
npm run dev
```

### Production

```bash
# From project root
docker compose up -d --build
```

---

## Architecture

### Service Responsibilities

1. **Authentication & User Management**
   - User registration (username/password)
   - Login with JWT token generation
   - Guest mode (auto-generated usernames)
   - Session history storage

2. **Room Management**
   - Create/join/leave rooms
   - Private rooms with password protection
   - Host controls and permissions
   - Spectator mode for late joiners

3. **Game Orchestration**
   - Round state machine (countdown → audio → answering → results)
   - Answer validation and scoring
   - Real-time score updates
   - Auto-advance between rounds

4. **Song Queue Management**
   - Coordinate with song-service for downloads
   - Parallel download buffering (up to 5 songs)
   - Progress tracking and status updates
   - Error handling and skip logic

5. **Audio Serving**
   - Serve downloaded audio files at `/audio/*`
   - Access shared volume with song-service

6. **Playlist Integration**
   - Proxy Spotify/YouTube playlist parsing to song-service
   - Transform playlist data for frontend

---

## REST API

Base URL: `http://game-service:5000/api`

### Authentication Endpoints

#### Register New User

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "player123",
  "password": "securepassword",
  "displayName": "Player One"  // Optional
}

Response 201:
{
  "user": {
    "_id": "64abc123...",
    "username": "player123",
    "displayName": "Player One",
    "isGuest": false,
    "sessionHistory": [],
    "createdAt": "2025-01-30T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response 400:
{
  "message": "Username already exists"
}
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "player123",
  "password": "securepassword"
}

Response 200:
{
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response 401:
{
  "message": "Invalid credentials"
}
```

#### Guest Login

```http
POST /api/auth/guest
Content-Type: application/json

{
  "username": "Guest_abc123"  // Optional, auto-generated if omitted
}

Response 200:
{
  "user": {
    "_id": "64abc123...",
    "username": "Guest_abc123",
    "displayName": "Guest_abc123",
    "isGuest": true,
    "sessionHistory": [],
    "createdAt": "2025-01-30T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Get User History

```http
GET /api/auth/history/:username

Response 200:
{
  "sessionHistory": [
    {
      "gameMode": "finish-lyrics",
      "score": 8500,
      "date": "2025-01-29T20:00:00.000Z",
      "roomCode": "ABCDEF"
    },
    ...
  ]
}

Response 404:
{
  "message": "User not found"
}
```

### Room Endpoints

#### List Active Rooms

```http
GET /api/rooms

Response 200:
{
  "rooms": [
    {
      "code": "ABCDEF",
      "hostId": "64abc123...",
      "gameMode": "guess-song-easy",
      "players": [
        {
          "userId": "64abc123...",
          "username": "player123",
          "score": 0,
          "isHost": true,
          "isSpectator": false,
          "answeredCurrentRound": false
        }
      ],
      "status": "waiting",
      "currentRound": 0,
      "isPrivate": false,
      "settings": { ... }
    }
  ]
}
```

**Note:** Only returns public rooms in `waiting` status (not in-game or private).

#### Get Room Details

```http
GET /api/rooms/:code

Response 200:
{
  "room": { ... }
}

Response 404:
{
  "message": "Room not found"
}
```

### Song/Playlist Endpoints

**These endpoints proxy requests to the song-service.**

#### Parse Spotify Playlist

```http
POST /api/songs/parse-spotify-playlist
Content-Type: application/json

{
  "playlistUrl": "https://open.spotify.com/playlist/..."
}

Response 200:
{
  "tracks": [
    {
      "songName": "Song Title",
      "artist": "Artist Name",
      "albumArtUrl": "https://..."
    },
    ...
  ]
}

Response 500:
{
  "message": "Failed to parse playlist"
}
```

#### Parse YouTube Playlist

```http
POST /api/songs/parse-youtube-playlist
Content-Type: application/json

{
  "playlistUrl": "https://www.youtube.com/playlist?list=..."
}

Response 200:
{
  "tracks": [
    {
      "url": "https://www.youtube.com/watch?v=...",
      "songName": "Video Title",
      "artist": "Channel Name",
      "albumArtUrl": "https://..."
    },
    ...
  ]
}
```

#### Create Custom Song List

```http
POST /api/songs/create-song-list
Content-Type: application/json

{
  "songs": [
    {
      "songName": "Song Title",
      "artist": "Artist Name",
      "url": "https://www.youtube.com/watch?v=...",  // Optional
      "albumArtUrl": "https://..."  // Optional
    },
    ...
  ]
}

Response 200:
{
  "tracks": [ ... ]
}
```

### Health Check

```http
GET /api/health

Response 200:
{
  "status": "ok",
  "service": "game-service",
  "timestamp": "2025-01-30T00:00:00.000Z"
}
```

### Audio Serving

```http
GET /audio/:filename

Response 200:
Content-Type: audio/mpeg
[Audio file stream]

Response 404:
Audio file not found
```

**File Location:** Audio files are served from the shared volume `SONG_SERVICE_PATH/audio/` (default: `/app/songs/audio/`).

---

## Socket.IO Events

### Connection

```typescript
// Client connection
const socket = io("http://game-service:5000", {
  transports: ["websocket", "polling"],
  reconnection: true,
});

// Server accepts connections on default namespace '/'
```

### Client → Server Events

#### Create Room

```typescript
socket.emit('create-room', {
  gameMode: 'finish-lyrics' | 'guess-song-easy' | 'guess-song-challenge',
  userId: string,
  username: string,
  settings?: Partial<RoomSettings>,
  password?: string  // For private rooms
});

// Server response:
socket.on('room-created', (data: {
  roomCode: string,
  room: Room
}) => {});
```

#### Join Room

```typescript
socket.emit('join-room', {
  roomCode: string,
  userId: string,
  username: string,
  password?: string  // If room is private
});

// Server response:
socket.on('room-joined', (data: {
  room: Room,
  player: Player
}) => {});

// Or error:
socket.on('error', (data: { message: string }) => {});
```

#### Leave Room

```typescript
socket.emit('leave-room', {
  roomCode: string,
  userId?: string
});

// Server broadcasts to room:
socket.on('player-left', (data: {
  userId: string,
  room: Room
}) => {});
```

#### Update Settings (Host Only)

```typescript
socket.emit("update-settings", {
  roomCode: string,
  settings: Partial<RoomSettings>,
});

// Server broadcasts to room:
socket.on("settings-updated", (data: RoomSettings) => {});
```

#### Prepare Playlist (Host Only)

```typescript
socket.emit("prepare-playlist", {
  roomCode: string,
  playlistItems: Array<{
    url?: string;
    songName: string;
    artist: string;
    albumArtUrl?: string;
  }>,
});

// Server emits progress updates:
socket.on(
  "playlist-preparing",
  (data: { message: string; queueStatus: QueueStatus }) => {},
);

socket.on(
  "playlist-ready",
  (data: { message: string; queueStatus: QueueStatus }) => {},
);
```

#### Start Game (Host Only)

```typescript
socket.emit("start-game", {
  roomCode: string,
});

// Server broadcasts:
socket.on("game-starting", () => {});
```

#### Stop Game (Host Only)

```typescript
socket.emit("stop-game", {
  roomCode: string,
});

// Server broadcasts:
socket.on("game-stopped", (data: { room: Room }) => {});
```

#### Skip Round (Host Only)

```typescript
socket.emit("skip-round", {
  roomCode: string,
});

// Server immediately ends round
```

#### Next Round (Host Only)

```typescript
socket.emit("next-round", {
  roomCode: string,
});

// Server starts next round immediately (skips auto-advance delay)
```

#### Submit Answer

```typescript
socket.emit("submit-answer", {
  roomCode: string,
  answer: string | { title: string, artists: string }, // Mode-dependent
  timestamp: number, // Client timestamp for latency calculation
});

// Server response to player:
socket.on(
  "answer-feedback",
  (data: { correct: boolean; points: number; message?: string }) => {},
);

// Server broadcasts to room:
socket.on(
  "player-answer-status",
  (data: {
    userId: string;
    status: "answered" | "correct" | "incorrect";
  }) => {},
);

// If answer is wrong (Guess Song modes):
socket.on(
  "chat-message",
  (data: {
    userId: string;
    username: string;
    message: string;
    timestamp: number;
  }) => {},
);
```

#### Typing Status

```typescript
socket.emit("typing-status", {
  roomCode: string,
  isTyping: boolean,
});

// Server broadcasts to others in room:
socket.on(
  "player-typing",
  (data: { userId: string; username: string; isTyping: boolean }) => {},
);
```

#### Get Rooms List

```typescript
socket.emit("get-rooms");

// Server response:
socket.on("rooms-list", (data: { rooms: Room[] }) => {});
```

### Server → Client Events

#### Game Flow Events

```typescript
// Loading next song
socket.on(
  "loading-song",
  (data: { message: string; queueStatus: QueueStatus }) => {},
);

// Pre-round countdown (3-2-1)
socket.on(
  "round-countdown",
  (data: {
    count: number; // 3, 2, 1
    round: number; // Current round number
  }) => {},
);

// Round starts - audio plays
socket.on(
  "round-started",
  (data: {
    audioUrl: string;
    startTime: number; // Seconds to start clip
    stopTime: number; // Seconds to stop clip
    duration: number; // Total song duration
    round: number;
    // Mode-specific fields:
    clipLyricLines?: LyricLine[]; // Finish Lyrics
    hangman?: string; // Finish Lyrics
    targetLyric?: string; // Finish Lyrics
    clipDuration?: number; // Guess Song modes
  }) => {},
);

// Finish Lyrics: Show hangman puzzle
socket.on(
  "show-hangman",
  (data: {
    hangman: string;
    targetLyric: string; // For debugging, not shown to player
    answerTime: number; // Seconds to answer
  }) => {},
);

// Guess Song Challenge: Play individual clips
socket.on(
  "play-clip",
  (data: {
    clipNumber: number; // 1, 2, 3, or 4
    clipDuration: number; // 1s, 2s, 5s, or 10s
    answerTime: number;
  }) => {},
);

// Round ends - show results
socket.on(
  "round-ended",
  (data: {
    correctAnswer:
      | {
          title: string;
          artists: string[];
        }
      | {
          lyric: string;
        };
    scores: Array<{
      userId: string;
      username: string;
      score: number;
      roundScore: number;
    }>;
    round: number;
  }) => {},
);

// Game ends - final standings
socket.on(
  "game-ended",
  (data: {
    finalScores: Array<{
      userId: string;
      username: string;
      score: number;
    }>;
    room: Room;
  }) => {},
);

// Song failed to load
socket.on("song-skipped", (data: { reason: string; songName?: string }) => {});
```

#### Queue Status Updates

```typescript
socket.on(
  "queue-status",
  (data: {
    total: number; // Total songs in playlist
    current: number; // Currently processing index
    ready: number; // Number of songs ready to play
    failed: number; // Number of failed downloads
    progress: number; // Current song download progress (0-1)
  }) => {},
);
```

#### State Sync (Reconnection)

```typescript
socket.on(
  "sync-state",
  (data: {
    room: Room;
    gameState: {
      phase: string;
      currentRound: number;
      audioUrl?: string;
      // ... current game state
    };
  }) => {},
);
```

#### Notifications

```typescript
socket.on("error", (data: { message: string }) => {});

socket.on(
  "toast",
  (data: {
    message: string;
    type: "info" | "success" | "error" | "warning";
  }) => {},
);
```

---

## Game Logic

### Room Settings

```typescript
interface RoomSettings {
  maxPlayers: number; // Default: 8
  maxRounds: number; // Default: 10
  clipDuration: number; // Default: 15s (Guess Song modes)
  answerTime: number; // Default: 15s (Finish Lyrics), 10s (Guess Song)
  resultsDelay: number; // Default: 7s between rounds
  randomStart: boolean; // Default: true (random clip position)

  // Finish Lyrics - Character reveal options
  revealOptions?: {
    numbers: boolean; // Show numbers in hangman
    korean: boolean; // Show Korean characters
    japanese: boolean; // Show Japanese characters
    chinese: boolean; // Show Chinese characters
    vietnamese: boolean; // Show Vietnamese characters
    spanish: boolean; // Show Spanish characters
  };
}
```

### Game Modes

#### 1. Finish the Lyrics

**Flow:**

1. Prepare song metadata → Get synced lyrics
2. Compute clip:
   - Select random lyric line with sufficient text
   - Calculate playback window (before + during lyric)
   - Generate hangman display (mask based on revealOptions)
3. Round starts:
   - Play full song from start to target lyric
   - Display scrolling lyrics
   - Show hangman at target lyric time
4. Answer phase:
   - Players type the lyric
   - Word-by-word matching
5. Scoring:
   ```typescript
   const wordsMatched = countMatchingWords(answer, targetLyric);
   const totalWords = targetLyric.split(/\s+/).length;
   const matchRatio = wordsMatched / totalWords;
   const points = Math.round(1000 * matchRatio);
   ```

**Hangman Generation:**

- Replace alphabet characters with underscores
- Keep punctuation, spaces, and configured reveal characters
- Example: "Hello world 123" → "**\_** **\_** 123" (numbers revealed)

#### 2. Guess the Song (Easy)

**Flow:**

1. Prepare song metadata
2. Compute clip:
   - Random start position (if randomStart enabled)
   - Clip duration from settings (default 15s)
3. Round starts:
   - Play clip
   - Players guess during playback
4. Answer phase:
   - Validate title (fuzzy match)
   - Validate artists (partial match, comma-separated)
5. Scoring:

   ```typescript
   // Title score (time-based)
   const timeFactor = (submitTime - roundStartTime) / clipDuration;
   const titleScore = Math.round(1000 - 800 * timeFactor); // 1000 → 200

   // Artist bonus (flat)
   const artistScore = correctArtists.length * 200;

   const total = titleScore + artistScore;
   ```

**Fuzzy Matching:**

- Normalize strings (lowercase, remove punctuation)
- Levenshtein distance for typos
- Accept partial matches for artists

#### 3. Guess the Song (Challenge)

**Flow:**

1. Prepare song metadata
2. Compute clip:
   - Random start position
3. Round starts with progressive clips:
   - Play 1-second clip → answer window (5s)
   - Play 2-second clip → answer window (5s)
   - Play 5-second clip → answer window (5s)
   - Play 10-second clip → answer window (10s)
4. Players can answer after any clip
5. Scoring:
   ```typescript
   const clipScores = {
     1: 1000,
     2: 600,
     3: 400,
     4: 200,
   };
   const titleScore = clipScores[clipNumber];
   const artistScore = correctArtists.length * 200;
   const total = titleScore + artistScore;
   ```

### Song Queue Manager

**[src/services/songQueueManager.ts](src/services/songQueueManager.ts)**

**Lifecycle:**

```typescript
const queue = new SongQueueManager(roomCode, playlistItems, settings);

// Initialize queue
await queue.initialize();

// Start background downloads (maintains 5-song buffer)
queue.startDownloadAhead();

// Get status
const status = queue.getStatus();
// → { total: 20, current: 3, ready: 5, failed: 0, progress: 0.75 }

// Get next song
const song = await queue.getNextSong();
// → { songId, audioUrl, metadata, precomputedClip }

// Advance to next
queue.advanceQueue();

// Cleanup
queue.cleanup();
```

**Download Process:**

For each song in playlist:

1. **Metadata Preparation:**

   ```typescript
   POST /prepare-song → song-service
   // Returns: { metadata: { title, artist, duration, lyricLines } }
   ```

2. **Clip Computation:**

   ```typescript
   computeClip(metadata, settings, gameMode);
   // Returns: { startTime, stopTime, hangman?, targetLyric?, ... }
   ```

3. **Download Initiation:**

   ```typescript
   POST /download-song → song-service
   // Returns: { jobId }
   ```

4. **Status Polling:**

   ```typescript
   GET /job-status/{jobId} → song-service
   // Poll every 1 second until completed or timeout (60s)
   ```

5. **Mark Ready:**
   ```typescript
   queue.songReady[index] = { songId, audioUrl, precomputedClip };
   ```

**Parallel Downloads:**

- Up to 5 concurrent downloads
- Maintains 5-song ready buffer ahead of current song
- Emits progress updates to frontend via socket

---

## Game State Machine

Each room has a game state that progresses through phases:

```
waiting (lobby)
    ↓ [host starts game]
preparing (downloading songs)
    ↓ [buffer ready]
loading (loading next song)
    ↓ [song ready]
countdown (3-2-1)
    ↓ [countdown complete]
playing-audio (clip plays)
    ↓ [audio ends]
answering (player submission)
    ↓ [time up or all answered]
showing-results (scores, correct answer)
    ↓ [auto-advance after delay OR host next-round]
[repeat] → loading → countdown → ...
    ↓ [all rounds complete]
game-over (final standings)
```

**State Management:**

- Each room stored in-memory in `socketService.ts`
- No persistent game state in MongoDB
- On disconnect, room remains active (rejoin possible)
- Room cleanup on all players leaving or game end

---

## Answer Validation

### Finish the Lyrics

```typescript
function validateLyricsAnswer(
  answer: string,
  targetLyric: string,
): { correct: boolean; points: number } {
  // Normalize both strings
  const normalizedAnswer = normalizeText(answer);
  const normalizedTarget = normalizeText(targetLyric);

  // Split into words
  const answerWords = normalizedAnswer.split(/\s+/);
  const targetWords = normalizedTarget.split(/\s+/);

  // Count matches
  let matches = 0;
  for (const word of targetWords) {
    if (answerWords.includes(word)) matches++;
  }

  // Calculate score
  const ratio = matches / targetWords.length;
  const points = Math.round(1000 * ratio);

  return {
    correct: ratio >= 0.8, // 80% threshold for "correct"
    points,
  };
}
```

### Guess the Song (Title)

```typescript
function validateTitle(answer: string, correctTitle: string): boolean {
  // Normalize
  const normAnswer = normalizeText(answer);
  const normTitle = normalizeText(correctTitle);

  // Exact match
  if (normAnswer === normTitle) return true;

  // Fuzzy match (Levenshtein distance)
  const distance = levenshtein(normAnswer, normTitle);
  const threshold = Math.max(2, Math.floor(normTitle.length * 0.15));

  return distance <= threshold;
}
```

### Guess the Song (Artists)

```typescript
function validateArtists(
  answerString: string,
  correctArtists: string[],
): { correct: boolean; matchedArtists: string[] } {
  // Split by comma or "and"
  const answerArtists = answerString
    .split(/[,&]|\sand\s/i)
    .map((a) => normalizeText(a.trim()))
    .filter((a) => a.length > 0);

  const matched: string[] = [];

  for (const correctArtist of correctArtists) {
    const normCorrect = normalizeText(correctArtist);

    for (const answerArtist of answerArtists) {
      // Check partial match or fuzzy match
      if (
        answerArtist.includes(normCorrect) ||
        normCorrect.includes(answerArtist) ||
        levenshtein(answerArtist, normCorrect) <= 2
      ) {
        matched.push(correctArtist);
        break;
      }
    }
  }

  return {
    correct: matched.length > 0,
    matchedArtists: matched,
  };
}
```

---

## Data Models (MongoDB)

### User Model

**[src/models/User.ts](src/models/User.ts)**

```typescript
interface User {
  _id: ObjectId;
  username: string; // Unique
  password: string; // bcrypt hashed (10 rounds)
  displayName: string;
  isGuest: boolean;
  sessionHistory: SessionHistory[];
  createdAt: Date;
}

interface SessionHistory {
  gameMode: string;
  score: number;
  date: Date;
  roomCode: string;
}
```

### Song Model

**[src/models/Song.ts](src/models/Song.ts)**

```typescript
interface Song {
  _id: ObjectId;
  title: string;
  artist: string;
  duration: number;
  audioPath: string; // e.g., "/app/songs/audio/abc123.mp3"
  lyricsPath?: string; // e.g., "/app/songs/lyrics/abc123.lrc"
  lyricLines: LyricLine[];
  albumArtUrl?: string;
  lyricsSource?: string;
  sourceUrl?: string;
  createdAt: Date;
}

interface LyricLine {
  time: number; // Seconds
  text: string;
}
```

**Note:** Songs are created by song-service, game-service only reads them.

---

## Environment Variables

### Required

```bash
MONGODB_URI=mongodb://mongodb:27017/musicmayhem
JWT_SECRET=your-secret-key-min-32-chars
PORT=5000
SONG_SERVICE_URL=http://song-service:5001
```

### Optional

```bash
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://frontend:3000
SONG_SERVICE_PATH=/app/songs
NODE_ENV=development
```

### JWT Configuration

- **Algorithm:** HS256
- **Expiration:** 7 days
- **Payload:** `{ userId, username }`

---

## File Structure

```
game-service/
├── src/
│   ├── server.ts                 # Express + Socket.IO bootstrap
│   ├── routes/
│   │   ├── auth.ts              # POST /register, /login, /guest
│   │   ├── songs.ts             # Proxy playlist parsing to song-service
│   │   └── rooms.ts             # GET /rooms, /rooms/:code
│   ├── services/
│   │   ├── socketService.ts     # Socket.IO event handlers, game orchestration
│   │   └── songQueueManager.ts  # Song download queue and buffering
│   ├── models/
│   │   ├── User.ts              # Mongoose User model
│   │   └── Song.ts              # Mongoose Song model
│   ├── types/
│   │   └── game.ts              # TypeScript interfaces
│   └── utils/
│       ├── gameUtils.ts         # Answer validation, scoring, clip computation
│       └── auth.ts              # JWT utilities
├── package.json
├── tsconfig.json
└── Dockerfile
```

---

## Development

### Hot Reload

```bash
npm run dev
# Uses nodemon to watch TypeScript files
```

### Type Checking

```bash
npm run type-check
```

### Building

```bash
npm run build
# Compiles TypeScript to dist/
```

### Production

```bash
npm start
# Runs compiled JavaScript from dist/
```

---

## Testing Locally

### With Docker

```bash
# From project root
docker compose -f docker-compose.dev.yml up -d --build
```

### Standalone

```bash
# Terminal 1: MongoDB
docker run -d -p 27017:27017 mongo:latest

# Terminal 2: Song Service
cd song-service
MONGODB_URI=mongodb://localhost:27017 python app.py

# Terminal 3: Game Service
cd game-service
npm install
MONGODB_URI=mongodb://localhost:27017 \
JWT_SECRET=test-secret-key \
SONG_SERVICE_URL=http://localhost:5001 \
npm run dev
```

---
