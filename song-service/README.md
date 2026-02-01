# Song Service - Music Mayhem

The **Song Service** is a **Flask-based Python API** responsible for all music-related operations: parsing Spotify/YouTube playlists, downloading audio via yt-dlp, fetching time-synced lyrics from multiple sources, and storing song metadata in MongoDB.

## Tech Stack

- **Framework:** Flask (Python 3.11+)
- **Audio Download:** yt-dlp
- **Lyrics:** syncedlyrics (Lrclib, NetEase, Musixmatch)
- **Playlist Parsing:** Spotify Web API, yt-dlp for YouTube
- **Database:** MongoDB (PyMongo)
- **Async:** Threading for background downloads

## Quick Start

### Development

```bash
# From project root
docker compose -f docker-compose.dev.yml up -d --build

# Or standalone
cd song-service
pip install -r requirements.txt
python app.py
```

### Production

```bash
# From project root
docker compose up -d --build
```

---

## Architecture

### Service Responsibilities

1. **Playlist Parsing**
   - Extract tracks from Spotify playlist URLs
   - Extract videos from YouTube playlist URLs
   - Return track metadata (title, artist, album art)

2. **Song Metadata Preparation**
   - Search for songs on YouTube or Spotify
   - Fetch video/audio metadata (title, artist, duration)
   - Retrieve time-synced lyrics from multiple sources
   - Return metadata without downloading

3. **Audio Downloading**
   - Background async downloads using yt-dlp
   - Extract audio from YouTube videos (MP3 format)
   - Store audio files in shared volume
   - Polling-based job status updates

4. **Lyric Processing**
   - Fetch synced lyrics (LRC format) from multiple providers
   - Parse and validate lyric timing
   - Store lyrics in shared volume
   - Support multi-language lyrics (Chinese simplified ↔ traditional conversion)

5. **Storage Management**
   - Save song metadata to MongoDB
   - Write audio files to `/app/songs/audio/`
   - Write lyric files to `/app/songs/lyrics/`
   - Clean up files on song deletion

---

## REST API

Base URL: `http://song-service:5001`

### Health Check

```http
GET /health

Response 200:
{
  "status": "ok",
  "service": "song-downloader",
  "timestamp": "2025-01-30T00:00:00.000Z"
}
```

---

### Playlist Parsing

#### Parse Spotify Playlist

```http
POST /parse-spotify-playlist
Content-Type: application/json

{
  "playlistUrl": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
}

Response 200:
{
  "tracks": [
    {
      "songName": "Song Title",
      "artist": "Artist Name",
      "albumArtUrl": "https://i.scdn.co/image/..."
    },
    ...
  ]
}

Response 400:
{
  "error": "Invalid Spotify playlist URL"
}

Response 500:
{
  "error": "Failed to fetch playlist"
}
```

**Requirements:**

- Spotify API credentials (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`)
- Playlist must be public or you must have access

#### Parse YouTube Playlist

```http
POST /parse-youtube-playlist
Content-Type: application/json

{
  "playlistUrl": "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"
}

Response 200:
{
  "tracks": [
    {
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "songName": "Video Title",
      "artist": "Channel Name",
      "albumArtUrl": "https://i.ytimg.com/vi/..."
    },
    ...
  ]
}

Response 400:
{
  "error": "Invalid YouTube playlist URL"
}
```

**Note:** Uses yt-dlp to extract playlist information without downloading videos.

---

### Song Metadata

#### Prepare Song (No Download)

Fetches metadata and lyrics without downloading audio. Used by game-service to compute clips before initiating downloads.

```http
POST /prepare-song
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  // Optional
  "songName": "Never Gonna Give You Up",                // Optional if URL provided
  "artist": "Rick Astley",                              // Optional if URL provided
  "requireLyrics": true                                 // Default: true
}

Response 200:
{
  "metadata": {
    "title": "Never Gonna Give You Up",
    "artist": "Rick Astley",
    "duration": 213.0,
    "lyricLines": [
      { "time": 0.0, "text": "We're no strangers to love" },
      { "time": 4.5, "text": "You know the rules and so do I" },
      ...
    ],
    "albumArtUrl": "https://i.ytimg.com/vi/.../maxresdefault.jpg",
    "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "lyricsSource": "lrclib"
  }
}

Response 404:
{
  "error": "Song not found"
}

Response 500:
{
  "error": "Failed to prepare song metadata"
}
```

**Search Behavior:**

- If `url` provided: Extract metadata from URL directly
- If `songName` + `artist` provided: Search YouTube or Spotify
- Search order: YouTube Music (if enabled) → YouTube → Spotify → MusicBrainz

---

### Song Download

#### Download Song

Initiates an async background download job. Returns job ID for polling.

```http
POST /download-song
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  // Optional
  "songName": "Never Gonna Give You Up",                // Required if no URL
  "artist": "Rick Astley",                              // Required if no URL
  "lyricLines": [                                       // Optional, from prepare-song
    { "time": 0.0, "text": "We're no strangers to love" },
    ...
  ],
  "duration": 213.0,                                    // Optional
  "clipStartSec": 10.0,                                 // Optional, for validation
  "clipEndSec": 25.0,                                   // Optional, for validation
  "skipLyricsFetch": false,                             // Optional, skip lyrics if already provided
  "skipAlignmentFilter": false                          // Optional, skip lyric alignment validation
}

Response 202:
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}

Response 400:
{
  "error": "Missing required fields: songName and artist"
}
```

**Background Process:**

1. Job created with unique ID
2. Background thread started
3. yt-dlp downloads audio (MP3 format, 192kbps)
4. Lyrics fetched if not provided
5. Files written to shared volume
6. Song metadata stored in MongoDB
7. Job marked as completed with `songId`

#### Get Job Status

Poll this endpoint to check download progress.

```http
GET /job-status/:jobId

Response 200 (Pending):
{
  "status": "pending",
  "progress": 0.0
}

Response 200 (Downloading):
{
  "status": "downloading",
  "progress": 0.45,
  "phase": "Downloading audio..."
}

Response 200 (Processing):
{
  "status": "downloading",
  "progress": 0.85,
  "phase": "Fetching lyrics..."
}

Response 200 (Completed):
{
  "status": "completed",
  "songId": "64abc123def456789...",
  "progress": 1.0
}

Response 200 (Failed):
{
  "status": "failed",
  "error": "yt-dlp error: Video unavailable",
  "progress": 0.0
}

Response 404:
{
  "error": "Job not found"
}
```

**Status Values:**

- `pending` - Job queued, not started
- `downloading` - Actively downloading/processing
- `completed` - Success, `songId` available
- `failed` - Error occurred, see `error` field

**Progress Values:**

- `0.0` - Not started
- `0.0-0.5` - Downloading audio
- `0.5-0.8` - Fetching lyrics
- `0.8-0.9` - Saving to database
- `1.0` - Complete

---

### Song Management

#### Get Song by ID

```http
GET /song/:songId

Response 200:
{
  "_id": "64abc123def456789...",
  "title": "Never Gonna Give You Up",
  "artist": "Rick Astley",
  "duration": 213.0,
  "audioPath": "/app/songs/audio/64abc123def456789.mp3",
  "lyricsPath": "/app/songs/lyrics/64abc123def456789.lrc",
  "lyricLines": [
    { "time": 0.0, "text": "We're no strangers to love" },
    ...
  ],
  "albumArtUrl": "https://...",
  "lyricsSource": "lrclib",
  "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "createdAt": "2025-01-30T00:00:00.000Z"
}

Response 404:
{
  "error": "Song not found"
}
```

#### Delete Song

Removes song from database AND deletes audio/lyrics files.

```http
DELETE /song/:songId

Response 200:
{
  "message": "Song deleted successfully"
}

Response 404:
{
  "error": "Song not found"
}
```

---

## Audio Downloading

### yt-dlp Configuration

**[downloader.py](downloader.py)** - Main download logic

```python
ytdl_opts = {
    'format': 'bestaudio/best',
    'outtmpl': '/app/songs/audio/%(id)s.%(ext)s',
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '192',
    }],
    'quiet': True,
    'no_warnings': True,
    'extract_flat': False,
    'nocheckcertificate': True,
    'http_chunk_size': 10485760,  # 10MB chunks
}
```

**Download Process:**

1. **Search/Resolve URL:**
   - If URL provided: Use directly
   - If song name + artist: Search YouTube/Spotify

2. **Extract Audio:**

   ```python
   with yt_dlp.YoutubeDL(ytdl_opts) as ydl:
       info = ydl.extract_info(url, download=True)
       audio_path = f"/app/songs/audio/{info['id']}.mp3"
   ```

3. **Progress Tracking:**
   - yt-dlp progress hooks update job status
   - Progress emitted as 0.0 → 0.5 during download

4. **Error Handling:**
   - Network errors: Retry with exponential backoff
   - Video unavailable: Mark job as failed
   - Age-restricted: Attempt cookies/auth bypass

---

## Lyric Fetching

### syncedlyrics Integration

**[downloader.py](downloader.py)** - Lyric fetching logic

```python
from syncedlyrics import search

lyrics_lrc = search(
    search_term=f"{artist} {title}",
    allow_plain_format=False,
    providers=["Lrclib", "NetEase", "Musixmatch"],
    enhanced=True
)
```

**Lyric Sources (Priority Order):**

1. **Lrclib** - Free, open-source lyric database
   - Best for English songs
   - High accuracy, well-timed

2. **NetEase** - Chinese music service
   - Best for Asian songs (Chinese, Korean, Japanese)
   - Large database, good quality

3. **Musixmatch** - Commercial lyric provider
   - Fallback for other languages
   - Requires API key (optional)

**Lyric Processing:**

1. **Fetch LRC Format:**

   ```lrc
   [00:12.00]We're no strangers to love
   [00:16.50]You know the rules and so do I
   ```

2. **Parse to JSON:**

   ```python
   lyric_lines = [
       {"time": 12.0, "text": "We're no strangers to love"},
       {"time": 16.5, "text": "You know the rules and so do I"}
   ]
   ```

3. **Validate Timing:**
   - Check if lyrics fall within song duration
   - Filter out invalid/misaligned lines
   - Ensure lyrics cover the clip window (if provided)

4. **Chinese Conversion (if needed):**
   ```python
   from opencc import OpenCC
   converter = OpenCC('s2t')  # Simplified to Traditional
   converted = converter.convert(text)
   ```

**Configuration Options:**

```bash
# Environment variables
SYNCEDLYRICS_PROVIDERS=Lrclib,NetEase,Musixmatch
SYNCEDLYRICS_ENHANCED=true
MIN_LYRIC_SIMILARITY=0.7  # Minimum similarity threshold
USE_YT_MUSIC=true
YT_MUSIC_ONLY=false
YTM_LYRICS_FIRST=true
```

---

## Playlist Parsing

### Spotify Integration

**[spotify_integration.py](spotify_integration.py)**

```python
from spotipy import Spotify
from spotipy.oauth2 import SpotifyClientCredentials

client = Spotify(auth_manager=SpotifyClientCredentials(
    client_id=SPOTIFY_CLIENT_ID,
    client_secret=SPOTIFY_CLIENT_SECRET
))

def parse_spotify_playlist(playlist_url: str) -> List[Track]:
    playlist_id = extract_playlist_id(playlist_url)
    results = client.playlist_tracks(playlist_id, market=SPOTIFY_MARKET)

    tracks = []
    for item in results['items']:
        track = item['track']
        tracks.append({
            'songName': track['name'],
            'artist': ', '.join([artist['name'] for artist in track['artists']]),
            'albumArtUrl': track['album']['images'][0]['url'] if track['album']['images'] else None
        })

    return tracks
```

**Requirements:**

- `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` from Spotify Developer Dashboard
- Playlist must be public or accessible with your credentials

### YouTube Integration

**[parse_playlist.py](parse_playlist.py)**

```python
import yt_dlp

def parse_youtube_playlist(playlist_url: str) -> List[Track]:
    ytdl_opts = {
        'extract_flat': True,  # Don't download, just get metadata
        'quiet': True
    }

    with yt_dlp.YoutubeDL(ytdl_opts) as ydl:
        playlist_info = ydl.extract_info(playlist_url, download=False)

        tracks = []
        for entry in playlist_info['entries']:
            tracks.append({
                'url': f"https://www.youtube.com/watch?v={entry['id']}",
                'songName': entry['title'],
                'artist': entry['uploader'],
                'albumArtUrl': entry['thumbnail']
            })

        return tracks
```

---

## Search Functionality

### Multi-source Search

**[downloader.py](downloader.py)** - `search_song()` function

```python
def search_song(song_name: str, artist: str) -> dict:
    """
    Search for song across multiple sources.
    Priority: YouTube Music → YouTube → Spotify → MusicBrainz
    """

    # 1. Try YouTube Music (if enabled)
    if USE_YT_MUSIC:
        result = search_youtube_music(f"{artist} {song_name}")
        if result:
            return result

    # 2. Try regular YouTube search
    if not YT_MUSIC_ONLY:
        result = search_youtube(f"{artist} {song_name}")
        if result:
            return result

    # 3. Try Spotify
    if SPOTIFY_CLIENT_ID:
        result = search_spotify(song_name, artist)
        if result:
            return result

    # 4. Try MusicBrainz (last resort)
    if USE_MUSICBRAINZ:
        result = search_musicbrainz(song_name, artist)
        if result:
            return result

    raise SongNotFoundError(f"Could not find: {artist} - {song_name}")
```

**YouTube Music Search:**

```python
ytdl_opts = {
    'format': 'bestaudio',
    'default_search': 'ytsearch',
    'quiet': True
}

with yt_dlp.YoutubeDL(ytdl_opts) as ydl:
    results = ydl.extract_info(f"ytsearch:{query}", download=False)
    video = results['entries'][0]
    return {
        'url': video['webpage_url'],
        'title': video['title'],
        'artist': video['uploader'],
        'duration': video['duration'],
        'thumbnail': video['thumbnail']
    }
```

---

## Data Storage

### MongoDB Schema

**songs Collection:**

```javascript
{
  _id: ObjectId("64abc123..."),
  title: "Never Gonna Give You Up",
  artist: "Rick Astley",
  duration: 213.0,
  audioPath: "/app/songs/audio/64abc123def456789.mp3",
  lyricsPath: "/app/songs/lyrics/64abc123def456789.lrc",
  lyricLines: [
    { time: 0.0, text: "We're no strangers to love" },
    { time: 4.5, text: "You know the rules and so do I" },
    ...
  ],
  albumArtUrl: "https://i.ytimg.com/vi/.../maxresdefault.jpg",
  lyricsSource: "lrclib",  // or "netease", "musixmatch", "youtube", etc.
  sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  createdAt: ISODate("2025-01-30T00:00:00.000Z")
}
```

### File Storage

**Shared Volume:** `/app/songs/`

```
/app/songs/
├── audio/
│   ├── 64abc123def456789.mp3
│   ├── 64def456abc789012.mp3
│   └── ...
└── lyrics/
    ├── 64abc123def456789.lrc
    ├── 64def456abc789012.lrc
    └── ...
```

**File Naming:**

- Audio: `{songId}.mp3`
- Lyrics: `{songId}.lrc`

**LRC File Format:**

```lrc
[ar:Rick Astley]
[ti:Never Gonna Give You Up]
[al:Whenever You Need Somebody]
[length:03:33]

[00:00.00]We're no strangers to love
[00:04.50]You know the rules and so do I
[00:08.25]A full commitment's what I'm thinking of
...
```

---

## Background Jobs

### Job Management

**[app.py](app.py)** - Job tracking

```python
import threading
from uuid import uuid4

# In-memory job storage (production: use Redis)
jobs = {}

@app.route('/download-song', methods=['POST'])
def download_song():
    job_id = str(uuid4())
    jobs[job_id] = {
        'status': 'pending',
        'progress': 0.0,
        'phase': None,
        'error': None,
        'songId': None
    }

    # Start background thread
    thread = threading.Thread(
        target=download_worker,
        args=(job_id, request.json)
    )
    thread.daemon = True
    thread.start()

    return jsonify({'jobId': job_id, 'status': 'pending'}), 202

def download_worker(job_id: str, data: dict):
    try:
        jobs[job_id]['status'] = 'downloading'
        jobs[job_id]['phase'] = 'Downloading audio...'

        # Download audio (progress: 0.0 → 0.5)
        audio_path = download_audio(data['url'], job_id)

        jobs[job_id]['progress'] = 0.5
        jobs[job_id]['phase'] = 'Fetching lyrics...'

        # Fetch lyrics (progress: 0.5 → 0.8)
        lyrics = fetch_lyrics(data['songName'], data['artist'])

        jobs[job_id]['progress'] = 0.8
        jobs[job_id]['phase'] = 'Saving to database...'

        # Save to MongoDB (progress: 0.8 → 1.0)
        song_id = save_to_db(data, audio_path, lyrics)

        jobs[job_id]['status'] = 'completed'
        jobs[job_id]['progress'] = 1.0
        jobs[job_id]['songId'] = str(song_id)

    except Exception as e:
        jobs[job_id]['status'] = 'failed'
        jobs[job_id]['error'] = str(e)
```

**Job Lifecycle:**

```
pending (0.0)
    ↓
downloading - "Downloading audio..." (0.0 → 0.5)
    ↓
downloading - "Fetching lyrics..." (0.5 → 0.8)
    ↓
downloading - "Saving to database..." (0.8 → 1.0)
    ↓
completed (1.0) → songId available
```

---

## Environment Variables

### Required

```bash
MONGODB_URI=mongodb://mongodb:27017/musicmayhem
```

### Optional (Spotify)

```bash
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_MARKET=US
```

### Optional (Lyrics)

```bash
SYNCEDLYRICS_PROVIDERS=Lrclib,NetEase,Musixmatch
SYNCEDLYRICS_ENHANCED=true
MIN_LYRIC_SIMILARITY=0.7
```

### Optional (Search)

```bash
USE_YT_MUSIC=true
YT_MUSIC_ONLY=false
YTM_LYRICS_FIRST=true
USE_MUSICBRAINZ=false
MUSICBRAINZ_USER_AGENT=MusicMayhem/1.0
```

### Optional (Server)

```bash
FLASK_ENV=development
FLASK_DEBUG=true
PORT=5001
```

---

## File Structure

```
song-service/
├── app.py                      # Flask routes and job management
├── downloader.py               # yt-dlp, lyrics, search logic
├── parse_playlist.py           # YouTube playlist parsing
├── spotify_integration.py      # Spotify API client
├── requirements.txt            # Python dependencies
├── Dockerfile
├── .env.example
└── songs/                      # Shared volume (created at runtime)
    ├── audio/
    │   └── .gitkeep
    └── lyrics/
        └── .gitkeep
```

---

## Development

### Run Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export MONGODB_URI=mongodb://localhost:27017/musicmayhem
export SPOTIFY_CLIENT_ID=your_id
export SPOTIFY_CLIENT_SECRET=your_secret

# Run Flask
python app.py
# Server starts on http://localhost:5001
```

### Debug Mode

```bash
FLASK_DEBUG=true python app.py
# Enables auto-reload and detailed error pages
```

### Testing Download

```bash
curl -X POST http://localhost:5001/download-song \
  -H "Content-Type: application/json" \
  -d '{
    "songName": "Never Gonna Give You Up",
    "artist": "Rick Astley"
  }'

# Returns: {"jobId": "...", "status": "pending"}

# Poll status
curl http://localhost:5001/job-status/<jobId>
```

## Dependencies

### Core

```txt
Flask==3.0.0
pymongo==4.6.0
python-dotenv==1.0.0
```

### Audio/Video

```txt
yt-dlp==2024.1.0
```

### Lyrics

```txt
syncedlyrics==0.9.0
opencc-python-reimplemented==0.1.7
```

### Spotify

```txt
spotipy==2.23.0
```

### Optional (MusicBrainz)

```txt
musicbrainzngs==0.7.1
```
