# Frontend - Music Mayhem

## Tech Stack

- **Framework:** Next.js 15 (App Router, React 19)
- **Authentication:** Auth.js (NextAuth) with credentials provider
- **Real-time:** Socket.IO client
- **State Management:** Zustand
- **Styling:** Tailwind CSS
- **Language:** TypeScript

## Quick Start

### Development

```bash
# From project root
docker compose -f docker-compose.dev.yml up -d --build

# Or from frontend directory
npm install
npm run dev
```

Access at http://localhost:3000

### Production

```bash
# From project root
docker compose up -d --build
```

---

## Architecture

### Pages (App Router)

```
src/app/
├── page.tsx                          # Home - Mode selection and room creation
├── auth/page.tsx                     # Login/Register/Guest access
├── lobby/page.tsx                    # Browse and join public rooms
├── game/
│   ├── [mode]/page.tsx              # Deprecated: Mode-specific landing
│   └── [mode]/[roomCode]/page.tsx   # Active game room (main gameplay)
└── api/
    └── auth/[...nextauth]/route.ts  # Auth.js API routes
```

### Components Structure

```
src/components/
├── AuthProvider.tsx                  # Auth.js session provider
├── AuthRequiredModal.tsx             # Modal for unauthenticated users
├── AuthSync.tsx                      # Sync NextAuth with Zustand store
├── ThemeProvider.tsx                 # Dark/light theme context
├── ThemeToggle.tsx                   # Theme switcher button
├── GameModeCard.tsx                  # Game mode selection cards
├── RoomSettingsModal.tsx             # Room configuration modal
└── game/                             # Game-specific components
    ├── ChatPanel.tsx                 # Chat/wrong answers display
    ├── HostSetupPanel.tsx            # Host controls and playlist upload
    ├── PlayersPanel.tsx              # Player list and scores
    ├── PlaylistCard.tsx              # Playlist management
    ├── SettingsCard.tsx              # Game settings configuration
    ├── panels/                       # Game state panels
    │   ├── AnswerPhasePanel.tsx      # Answer input phase
    │   ├── CountdownPanel.tsx        # Pre-round countdown (3-2-1)
    │   ├── GameOverPanel.tsx         # Final results and standings
    │   ├── LoadingPanel.tsx          # Song loading state
    │   ├── PlayingAudioPanel.tsx     # Audio playback + lyrics
    │   ├── ResultsPanel.tsx          # Round results and scores
    │   └── WaitingPanel.tsx          # Pre-game lobby
    └── AnswerInput.tsx               # Answer submission component
```

### State Management (Zustand)

**Store Location:** [src/store/useStore.ts](src/store/useStore.ts)

```typescript
interface Store {
  // Theme
  isDarkMode: boolean;
  toggleDarkMode: () => void;

  // Authentication
  authStatus: "loading" | "authenticated" | "unauthenticated";
  user: User | null;
  setAuthStatus: (status) => void;
  setUser: (user: User | null) => void;

  // Room State
  room: Room | null;
  currentPlayer: Player | null;
  isJoiningRoom: boolean;
  isLeavingRoom: boolean;
  setRoom: (room: Room | null) => void;
  setCurrentPlayer: (player: Player | null) => void;
  resetRoomState: () => void;

  // Game State
  phase:
    | "waiting"
    | "loading"
    | "countdown"
    | "playing-audio"
    | "answering"
    | "showing-results"
    | "game-over";
  audioUrl: string | null;
  startTime: number;
  stopTime: number;
  duration: number;
  hangman: string | null; // Finish Lyrics: masked lyric
  targetLyric: string | null; // Finish Lyrics: correct lyric
  playerScores: Array<{ userId; score }>;
  correctAnswer: { title; artists } | null;
  myAnswerStatus: "none" | "pending" | "correct" | "incorrect";
  lastAnswerFeedback: AnswerFeedback | null;
  chatMessages: ChatMessage[];
  queueStatus: QueueStatus | null;

  // ... setters and actions
}
```

### Custom Hooks

**[src/hooks/useSocket.ts](src/hooks/useSocket.ts)** - Socket.IO lifecycle and event handling

```typescript
useSocket(roomCode: string | null)
// - Connects to game-service Socket.IO
// - Listens to all game events
// - Updates Zustand store automatically
// - Handles reconnection and cleanup
```

**Game-specific hooks ([src/hooks/game/](src/hooks/game/)):**

- `useGameAudio.ts` - Audio playback control with HTMLAudioElement
- `useGameState.ts` - Game phase state machine
- `usePlaylist.ts` - Playlist upload and parsing
- `useRoomSettings.ts` - Room configuration management

---

## API Integration

### REST API Client

**[src/lib/api.ts](src/lib/api.ts)** - HTTP client for game-service

#### Authentication APIs

```typescript
// Register new user
api.auth.register(username, password, displayName?)
// → POST /api/auth/register
// → Returns: { user: User, token: string }

// Login with credentials
api.auth.login(username, password)
// → POST /api/auth/login
// → Returns: { user: User, token: string }

// Guest login (no credentials)
api.auth.guest()
// → POST /api/auth/guest
// → Returns: { user: User, token: string }

// Get user's game history
api.auth.getHistory(username)
// → GET /api/auth/history/:username
// → Returns: { sessionHistory: SessionHistory[] }
```

#### Room APIs

```typescript
// List active public rooms
api.rooms.getRooms();
// → GET /api/rooms
// → Returns: { rooms: Room[] }

// Get specific room details
api.rooms.getRoom(roomCode);
// → GET /api/rooms/:code
// → Returns: { room: Room }
```

#### Song/Playlist APIs

```typescript
// Parse Spotify playlist URL
api.songs.parseSpotifyPlaylist(playlistUrl);
// → POST /api/songs/parse-spotify-playlist
// → Returns: { tracks: Track[] }

// Parse YouTube playlist URL
api.songs.parseYoutubePlaylist(playlistUrl);
// → POST /api/songs/parse-youtube-playlist
// → Returns: { tracks: Track[] }

// Create custom song list
api.songs.createSongList(songs);
// → POST /api/songs/create-song-list
// → Returns: { tracks: Track[] }
```

### Socket.IO Events

**Connection:**

```typescript
const socket = io(NEXT_PUBLIC_API_URL, {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});
```

**Client → Server Events:**

```typescript
// Room Management
socket.emit('create-room', {
  gameMode: 'finish-lyrics' | 'guess-song-easy' | 'guess-song-challenge',
  settings: RoomSettings,
  password?: string
});

socket.emit('join-room', {
  roomCode: string,
  password?: string
});

socket.emit('leave-room', {
  roomCode: string
});

socket.emit('update-settings', {
  roomCode: string,
  settings: Partial<RoomSettings>
});

// Game Control (Host only)
socket.emit('prepare-playlist', {
  roomCode: string,
  playlistItems: PlaylistItem[]
});

socket.emit('start-game', {
  roomCode: string
});

socket.emit('stop-game', {
  roomCode: string
});

socket.emit('skip-round', {
  roomCode: string
});

socket.emit('next-round', {
  roomCode: string
});

// Player Actions
socket.emit('submit-answer', {
  roomCode: string,
  answer: string | { title: string, artists: string },
  timestamp: number
});

socket.emit('typing-status', {
  roomCode: string,
  isTyping: boolean
});
```

**Server → Client Events:**

```typescript
// Room Events
socket.on("room-created", (data: { roomCode: string }) => {});
socket.on("room-joined", (data: { room: Room; player: Player }) => {});
socket.on("player-joined", (data: { player: Player }) => {});
socket.on("player-left", (data: { userId: string }) => {});
socket.on("settings-updated", (data: { settings: RoomSettings }) => {});

// Game Flow Events
socket.on("game-starting", () => {});
socket.on("playlist-preparing", () => {});
socket.on("playlist-ready", () => {});
socket.on("loading-song", () => {});
socket.on("round-countdown", (data: { count: number }) => {});

// Round Events
socket.on(
  "round-started",
  (data: {
    audioUrl: string;
    startTime: number;
    stopTime: number;
    duration: number;
    clipLyricLines?: LyricLine[]; // Finish Lyrics mode
    hangman?: string; // Finish Lyrics mode
    targetLyric?: string; // Finish Lyrics mode
    clipDuration?: number; // Guess Song modes
  }) => {},
);

socket.on(
  "show-hangman",
  (data: { hangman: string; targetLyric: string }) => {},
);

socket.on(
  "play-clip",
  (data: {
    clipNumber: number; // Challenge mode: 1-4
    clipDuration: number;
  }) => {},
);

socket.on(
  "answer-feedback",
  (data: { correct: boolean; points: number; message?: string }) => {},
);

socket.on(
  "player-answer-status",
  (data: {
    userId: string;
    status: "answered" | "correct" | "incorrect";
  }) => {},
);

socket.on(
  "chat-message",
  (data: {
    userId: string;
    username: string;
    message: string;
    timestamp: number;
  }) => {},
);

socket.on(
  "round-ended",
  (data: {
    correctAnswer: { title: string; artists: string[] };
    scores: Array<{ userId: string; score: number }>;
  }) => {},
);

socket.on(
  "game-ended",
  (data: {
    finalScores: Array<{ userId: string; username: string; score: number }>;
  }) => {},
);

// Status Events
socket.on("queue-status", (data: QueueStatus) => {});
socket.on("sync-state", (data: { room: Room; gameState: GameState }) => {});
socket.on("song-skipped", (data: { reason: string }) => {});
socket.on("game-stopped", () => {});

// Notifications
socket.on("error", (data: { message: string }) => {});
socket.on(
  "toast",
  (data: { message: string; type: "info" | "success" | "error" }) => {},
);
```

---

## Game Flow State Machine

The frontend follows a **state machine** pattern for game phases:

```
waiting (lobby)
    ↓ [host starts game]
loading (downloading songs)
    ↓ [first song ready]
countdown (3-2-1)
    ↓ [countdown complete]
playing-audio (clip plays)
    ↓ [audio ends]
answering (submit answers)
    ↓ [time up or all answered]
showing-results (scores, correct answer)
    ↓ [auto-advance after delay]
[next round] → countdown → ...
    ↓ [all rounds complete]
game-over (final standings)
```

**Phase Components:**

- `waiting` → `WaitingPanel.tsx`
- `loading` → `LoadingPanel.tsx`
- `countdown` → `CountdownPanel.tsx`
- `playing-audio` → `PlayingAudioPanel.tsx`
- `answering` → `AnswerPhasePanel.tsx`
- `showing-results` → `ResultsPanel.tsx`
- `game-over` → `GameOverPanel.tsx`

---

## Game Mode UI Differences

### Finish the Lyrics

**PlayingAudioPanel:**

- Displays scrolling synced lyrics in real-time
- Highlights current lyric line
- Shows hangman puzzle when target lyric appears

**AnswerPhasePanel:**

- Single text input for typing the lyric
- Real-time word matching feedback
- Hangman display above input

**Scoring Display:**

- Word match percentage (0-100%)
- Points awarded (0-1000)

### Guess the Song (Easy)

**PlayingAudioPanel:**

- Shows audio visualization or album art
- Countdown timer for clip duration
- No lyrics displayed

**AnswerPhasePanel:**

- Two inputs: Title and Artists
- Can submit during clip playback
- Immediate feedback on submission

**Scoring Display:**

- Title points (time-based, 1000 → 200)
- Artist bonus (200 per correct artist)
- Total score per round

### Guess the Song (Challenge)

**PlayingAudioPanel:**

- Progressive clip counter (1s → 2s → 5s → 10s)
- Visual indicator of current clip
- Album art or placeholder

**AnswerPhasePanel:**

- Same as Easy mode (title + artists)
- Score preview based on current clip

**Scoring Display:**

- Points based on clip when answered (1000/600/400/200)
- Artist bonuses
- Encourages early guessing

---

## Authentication Flow

Music Mayhem supports **three authentication modes:**

### 1. Registered User

```typescript
// User flow
1. Navigate to /auth
2. Fill registration form (username, password, displayName)
3. Submit → api.auth.register()
4. Receive JWT token + user object
5. Store in localStorage + session
6. Redirect to home
```

### 2. Guest User

```typescript
// User flow
1. Navigate to /auth
2. Click "Continue as Guest"
3. Submit → api.auth.guest()
4. Auto-generated username (e.g., "Guest_abc123")
5. Receive JWT token + user object
6. Store in session (not localStorage)
7. Redirect to home
```

### 3. Session Persistence

**Auth.js (NextAuth) Integration:**

- Uses **credentials provider** for username/password
- JWT strategy for session tokens
- Session stored in HTTP-only cookies
- 7-day expiration

**Zustand Sync ([AuthSync.tsx](src/components/AuthSync.tsx)):**

- Syncs Auth.js session to Zustand store
- Provides global access to `user` and `authStatus`
- Auto-refresh on session change

---

## Runtime Configuration

The frontend uses **runtime configuration** to support dynamic environment variables in Docker:

### Build-time (NEXT*PUBLIC*\*)

```bash
# .env or .env.local
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
```

### Runtime (Docker)

**[public/runtime-config.js](public/runtime-config.js)** - Generated at container start

```javascript
window.__RUNTIME_CONFIG__ = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
};
```

**Usage ([src/lib/runtimeConfig.ts](src/lib/runtimeConfig.ts)):**

```typescript
export const getApiUrl = () => {
  // Check runtime config (Docker)
  if (typeof window !== "undefined" && window.__RUNTIME_CONFIG__?.apiUrl) {
    return window.__RUNTIME_CONFIG__.apiUrl;
  }
  // Fallback to build-time env
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
};
```

**Docker Entrypoint ([scripts/runtime-config.sh](scripts/runtime-config.sh)):**

- Replaces placeholders in `runtime-config.js` with actual env vars
- Allows single Docker image for multiple environments

---

## Styling

### Tailwind CSS

**[src/app/globals.css](src/app/globals.css)** - Global styles and CSS variables

**Theme System:**

```css
:root {
  --background: 0 0% 100%; /* Light mode background */
  --foreground: 222.2 47.4% 11.2%; /* Light mode text */
  /* ... */
}

.dark {
  --background: 224 71% 4%; /* Dark mode background */
  --foreground: 213 31% 91%; /* Dark mode text */
  /* ... */
}
```

**Mode-specific Tinting:**

- Finish Lyrics: Purple accent (`bg-purple-500`)
- Guess Song Easy: Green accent (`bg-green-500`)
- Guess Song Challenge: Orange accent (`bg-orange-500`)

**Component Patterns:**

```typescript
// Cards
className = "bg-card border border-border rounded-lg shadow-lg p-6";

// Buttons
className =
  "bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md";

// Input fields
className =
  "w-full px-4 py-2 rounded-md border border-input bg-background text-foreground";
```

---

## Key Components

### [WaitingPanel](src/components/game/panels/WaitingPanel.tsx)

**Purpose:** Pre-game lobby for room setup and player waiting

**Features:**

- Display room code and game mode
- Player list with ready status
- Host controls (settings, playlist upload, start game)
- Spectator indicator for late joiners
- Room settings modal

**Host Actions:**

- Update room settings (clips, rounds, time limits)
- Upload playlist (Spotify/YouTube URL or custom)
- Start game when ready

### [PlayingAudioPanel](src/components/game/panels/PlayingAudioPanel.tsx)

**Purpose:** Audio playback phase with mode-specific UI

**Finish Lyrics Mode:**

- Scrolling lyrics synchronized with audio
- Highlight current line based on timestamp
- Display hangman puzzle at target lyric

**Guess Song Modes:**

- Album art or visualization
- Countdown timer
- Challenge mode: Clip counter (1s/2s/5s/10s)

**Audio Playback:**

- Uses `useGameAudio` hook with HTMLAudioElement
- Precise start/stop time control
- Auto-advance to answer phase on completion

### [AnswerPhasePanel](src/components/game/panels/AnswerPhasePanel.tsx)

**Purpose:** Player answer submission

**Finish Lyrics:**

- Single text input
- Hangman display for reference
- Word-match validation on submit

**Guess Song (Easy/Challenge):**

- Two inputs: Title and Artists
- Separate submission for each
- Instant feedback on correctness

**Features:**

- Timer countdown
- Typing indicator broadcast
- Submit button disabled after answer
- Auto-focus on input

### [ResultsPanel](src/components/game/panels/ResultsPanel.tsx)

**Purpose:** Round results and score updates

**Display:**

- Correct answer (title, artists, lyric)
- Points earned by each player
- Updated leaderboard
- Auto-advance countdown

**Actions:**

- Host can advance early with "Next Round" button
- Displays congratulations for top scorer
- Shows player answer status (correct/incorrect)

### [HostSetupPanel](src/components/game/HostSetupPanel.tsx)

**Purpose:** Host-only controls for game management

**Features:**

- Playlist upload (URL or manual entry)
- Playlist queue status (preparing, ready, failed)
- Game start button (enabled when songs ready)
- Stop game button (during active game)
- Skip round button (if song fails)

**Playlist Upload Flow:**

1. Enter Spotify/YouTube playlist URL
2. Click "Load Playlist"
3. Frontend calls parse API
4. Emit `prepare-playlist` to socket
5. Display queue status (downloading songs)
6. Enable "Start Game" when buffer ready

---

## Environment Variables

### Required

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-min-32-chars
```

### Optional

```bash
NEXT_PUBLIC_DISABLE_AUTH=false    # Skip auth (dev only)
NEXT_PUBLIC_DEBUG_SOCKET=false    # Socket.IO debug logs
```

---

## Development

### File Watcher

```bash
npm run dev
# Next.js Fast Refresh enabled
# Changes reflect instantly
```

### Type Checking

```bash
npm run type-check
# Run TypeScript compiler without emitting
```

### Linting

```bash
npm run lint
# ESLint with Next.js config
```

### Building

```bash
npm run build
# Production build with optimizations
npm run start
# Start production server
```

---

## Testing Locally

### With Docker

```bash
# From project root
docker compose -f docker-compose.dev.yml up -d --build
# Access at http://localhost:3000
```

### Standalone (no Docker)

```bash
# Terminal 1: MongoDB
docker run -d -p 27017:27017 mongo:latest

# Terminal 2: Song Service
cd song-service
pip install -r requirements.txt
MONGODB_URI=mongodb://localhost:27017 python app.py

# Terminal 3: Game Service
cd game-service
npm install
MONGODB_URI=mongodb://localhost:27017 npm run dev

# Terminal 4: Frontend
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:5000 npm run dev
```
