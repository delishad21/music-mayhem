#!/usr/bin/env python3
"""
Song downloader service for Music Lyric Game
Downloads songs from YouTube with synced lyrics
"""

import os
import re
import subprocess
import requests
from pathlib import Path
from typing import Optional, Dict, List, Any, Callable, Tuple
import time
import yt_dlp
import syncedlyrics
from syncedlyrics import Lyrics, TargetType, Musixmatch, Lrclib, NetEase, Megalobiz, Genius
try:
    from ytmusicapi import YTMusic
except Exception:  # pragma: no cover - optional fallback
    YTMusic = None
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# Directories
BASE_DIR = Path(__file__).parent
AUDIO_DIR = BASE_DIR / 'songs' / 'audio'
LYRICS_DIR = BASE_DIR / 'songs' / 'lyrics'

# Ensure directories exist
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
LYRICS_DIR.mkdir(parents=True, exist_ok=True)

# MongoDB connection
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://admin:musicgame123@localhost:27017/music_game?authSource=admin')
mongo_client = MongoClient(MONGODB_URI)
db = mongo_client['music_game']
songs_collection = db['songs']
ProgressCallback = Callable[[Dict[str, Any]], None]
LOG_TZ = os.getenv('LOG_TZ', 'local').strip().lower()
USE_YT_MUSIC = os.getenv('USE_YT_MUSIC', '1').strip().lower() not in ('0', 'false', 'no')
YT_MUSIC_ONLY = os.getenv('YT_MUSIC_ONLY', '1').strip().lower() not in ('0', 'false', 'no')
USE_MUSICBRAINZ = os.getenv('USE_MUSICBRAINZ', '1').strip().lower() not in ('0', 'false', 'no')
MUSICBRAINZ_USER_AGENT = os.getenv('MUSICBRAINZ_USER_AGENT', 'music-game/0.1 (local)').strip()
SYNCEDLYRICS_PROVIDERS = os.getenv(
    'SYNCEDLYRICS_PROVIDERS',
    'Lrclib,NetEase,Megalobiz',
).strip()
SYNCEDLYRICS_ENHANCED = os.getenv('SYNCEDLYRICS_ENHANCED', '1').strip().lower() not in ('0', 'false', 'no')
_ytmusic_client = None
YT_MUSIC_NEGATIVE_MARKERS = [
    'official video',
    'music video',
    'mv',
    'live',
    'performance',
    'concert',
    'cover',
    'karaoke',
    'reaction',
    'remix',
]


def _ts() -> str:
    if LOG_TZ == 'utc':
        return time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime())
    return time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())


def log(message: str, prefix: Optional[str] = None) -> None:
    """
    Log a message with optional prefix for identifying parallel downloads.
    prefix: Optional identifier like "Song 1/50" or "Artist - Title"
    """
    if prefix:
        print(f"[{_ts()}] [{prefix}] {message}", flush=True)
    else:
        print(f"[{_ts()}] {message}", flush=True)


def sanitize_filename(filename: str) -> str:
    """Remove invalid characters from filename"""
    return re.sub(r'[<>:"/\\|?*]', '', filename)


def parse_lrc(lrc_content: str) -> List[Dict[str, Any]]:
    """Parse LRC format lyrics into structured data"""
    lines = []
    for line in lrc_content.split('\n'):
        match = re.match(r'\[(\d+):(\d+\.\d+)\](.*)', line)
        if match:
            minutes, seconds, text = match.groups()
            time_in_seconds = int(minutes) * 60 + float(seconds)
            # Strip inline word-level timestamps like <00:12.34>
            text = re.sub(r'<\d+:\d+(?:\.\d+)?>', '', text)
            text = re.sub(r'\s+', ' ', text).strip()
            if text:  # Only add non-empty lyrics
                lines.append({
                    'time': time_in_seconds,
                    'text': text.strip()
                })
    return lines


def _parse_providers_list(value: str) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(',') if item.strip()]

def fetch_musicbrainz_artists(title: str, artist: str) -> Optional[List[str]]:
    if not USE_MUSICBRAINZ:
        return None
    if not title and not artist:
        return None

    query_parts = []
    if title:
        query_parts.append(f'recording:"{title}"')
    if artist:
        query_parts.append(f'artist:"{artist}"')
    query = ' AND '.join(query_parts) if query_parts else title or artist

    try:
        response = requests.get(
            'https://musicbrainz.org/ws/2/recording',
            params={'query': query, 'fmt': 'json', 'limit': 5},
            headers={'User-Agent': MUSICBRAINZ_USER_AGENT},
            timeout=8,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        recordings = data.get('recordings') if isinstance(data, dict) else None
        if not recordings:
            return None

        # Choose the highest scoring recording first.
        best = max(recordings, key=lambda item: item.get('score', 0))
        artist_credit = best.get('artist-credit') or []
        artists = []
        for credit in artist_credit:
            artist_obj = credit.get('artist') if isinstance(credit, dict) else None
            name = (artist_obj or {}).get('name') if isinstance(artist_obj, dict) else None
            if name:
                artists.append(name.strip())

        return artists or None
    except Exception:
        return None

def _build_lyrics_providers(lang: Optional[str], enhanced: bool) -> List[Any]:
    return [
        Musixmatch(lang=lang, enhanced=enhanced),
        Lrclib(),
        NetEase(),
        Megalobiz(),
        Genius(),
    ]

def _select_providers(all_providers: List[Any], providers_filter: List[str]) -> List[Any]:
    if not providers_filter:
        return all_providers
    wanted = {name.strip().lower() for name in providers_filter if name.strip()}
    if not wanted:
        return all_providers
    selected = []
    for provider in all_providers:
        name = str(provider).lower()
        if name in wanted:
            selected.append(provider)
    return selected if selected else all_providers

def _search_syncedlyrics_with_source(
    search_term: str,
    providers_filter: List[str],
    lang: Optional[str],
    enhanced: bool,
    log_prefix: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    target_type = TargetType.PREFER_SYNCED
    lrc = Lyrics()

    for provider in _select_providers(_build_lyrics_providers(lang, enhanced), providers_filter):
        try:
            lrc.update(provider.get_lrc(search_term))
        except Exception as e:
            log(f"⚠️  Syncedlyrics provider error on {provider}: {e}", log_prefix)
            continue

        if lrc.is_preferred(target_type):
            return lrc.to_str(target_type), str(provider)
        if lrc.is_acceptable(target_type):
            # Plaintext found; keep searching for synced lyrics.
            continue

    if lrc.is_acceptable(target_type):
        return lrc.to_str(target_type), "syncedlyrics"
    return None, None

def _extract_youtube_id(url: str) -> Optional[str]:
    if not url:
        return None
    match = re.search(r'(?:v=|/)([0-9A-Za-z_-]{11})', url)
    if match:
        return match.group(1)
    return None

def _looks_like_synced_lyrics(text: str) -> bool:
    if not text:
        return False
    return bool(re.search(r'\[\d+:\d+(?:\.\d+)?\]', text) or re.search(r'<\d+:\d+(?:\.\d+)?>', text))


def _fetch_ytmusic_lyrics(video_id: str, log_prefix: Optional[str] = None) -> Optional[str]:
    """
    Fetch time-synced lyrics from YouTube Music API for a given video ID.
    Returns LRC-formatted lyrics if available, None otherwise.
    """
    client = _get_ytmusic_client()
    if not client:
        log("⚠️ YouTube Music client not available", log_prefix)
        return None

    try:
        # Get watch playlist which contains lyrics info
        watch_playlist = client.get_watch_playlist(videoId=video_id)

        if not watch_playlist:
            log(f"⚠️ No watch playlist for video {video_id}", log_prefix)
            return None

        # Check for lyrics browse ID
        lyrics_browse_id = watch_playlist.get('lyrics')
        if not lyrics_browse_id:
            log(f"⚠️ No lyrics browse ID in watch playlist for {video_id}", log_prefix)
            return None

        log(f"🔍 Found lyrics browse ID: {lyrics_browse_id}", log_prefix)

        # Fetch the actual lyrics
        lyrics_data = client.get_lyrics(lyrics_browse_id)

        if not lyrics_data:
            log(f"⚠️ No lyrics data returned for browse ID {lyrics_browse_id}", log_prefix)
            return None

        # Debug: log what keys are in lyrics_data
        log(f"🔍 Lyrics data keys: {list(lyrics_data.keys())}", log_prefix)

        # Check if lyrics have timestamps
        has_timestamps = lyrics_data.get('hasTimestamps', False)
        lyrics_text = lyrics_data.get('lyrics', '')

        if not has_timestamps:
            log(f"ℹ️ Lyrics have no timestamps (hasTimestamps=False)", log_prefix)
            return None

        # If hasTimestamps is True, the lyrics text should contain LRC format
        if lyrics_text and has_timestamps:
            log(f"✅ Found lyrics with timestamps", log_prefix)

            # Check if it's already in LRC format
            if _looks_like_synced_lyrics(lyrics_text):
                log(f"✅ Lyrics are in LRC format", log_prefix)
                # Count lines for debugging
                line_count = len([l for l in lyrics_text.split('\n') if l.strip() and l.strip().startswith('[')])
                log(f"✅ Successfully fetched {line_count} synced lyric lines from YT Music", log_prefix)
                return lyrics_text
            else:
                log(f"⚠️ hasTimestamps=True but lyrics not in LRC format", log_prefix)
                # Log first 200 chars to debug
                sample = lyrics_text[:200].replace('\n', '\\n')
                log(f"🔍 Lyrics sample: {sample}...", log_prefix)

        log(f"⚠️ No usable synced lyrics found", log_prefix)

    except Exception as e:
        log(f"⚠️ YouTube Music lyrics fetch error: {e}", log_prefix)
        import traceback
        log(f"Traceback: {traceback.format_exc()}", log_prefix)
        return None

    return None


def _search_lrclib_best_match(
    query: str,
    duration_seconds: Optional[float],
    log_prefix: Optional[str],
) -> Optional[str]:
    if not query or not duration_seconds or duration_seconds <= 0:
        return None

    try:
        response = requests.get(
            'https://lrclib.net/api/search',
            params={'q': query},
            timeout=8,
        )
        if response.status_code != 200:
            return None

        results = response.json()
        if not isinstance(results, list):
            return None

        candidates: List[Tuple[float, Optional[float], str]] = []
        for item in results:
            if not isinstance(item, dict):
                continue
            synced = item.get('syncedLyrics')
            if not synced:
                continue
            item_duration = item.get('duration')
            duration_value = None
            try:
                if item_duration is not None:
                    duration_value = float(item_duration)
            except (TypeError, ValueError):
                duration_value = None

            if duration_value is None:
                score = float('inf')
            else:
                score = abs(duration_value - duration_seconds)

            candidates.append((score, duration_value, synced))

        if not candidates:
            return None

        candidates.sort(key=lambda entry: (entry[0], entry[1] is None))
        return candidates[0][2]
    except Exception as e:
        log(f"⚠️  LRCLIB search error: {e}", log_prefix)
        return None


def search_synced_lyrics(
    query: str,
    video_id: Optional[str] = None,
    duration_seconds: Optional[float] = None,
    log_prefix: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Search for synced lyrics, trying YouTube Music API first, then falling back to syncedlyrics.
    Returns (lrc_content, source_name) tuple.
    """
    # First, try YouTube Music API if we have a video ID
    ytm_lyrics_first = os.getenv('YTM_LYRICS_FIRST', '0').strip().lower() in ('1', 'true', 'yes')

    if ytm_lyrics_first and video_id:
        ytmusic_lrc = _fetch_ytmusic_lyrics(video_id, log_prefix)
        if ytmusic_lrc and _looks_like_synced_lyrics(ytmusic_lrc):
            return ytmusic_lrc, "ytmusic"

    # Try LRCLIB directly with duration matching (if enabled)
    providers = _parse_providers_list(SYNCEDLYRICS_PROVIDERS)
    providers_lower = {name.lower() for name in providers}
    if duration_seconds and 'lrclib' in providers_lower:
        lrclib_lrc = _search_lrclib_best_match(query, duration_seconds, log_prefix)
        if lrclib_lrc and _looks_like_synced_lyrics(lrclib_lrc):
            return lrclib_lrc, "lrclib"
        # Avoid double-calling LRCLIB via syncedlyrics after we just tried it.
        providers = [name for name in providers if name.lower() != 'lrclib']

    # Fall back to syncedlyrics
    synced_result, provider_name = _search_syncedlyrics_with_source(
        search_term=query,
        providers_filter=providers,
        lang=None,
        enhanced=SYNCEDLYRICS_ENHANCED,
        log_prefix=log_prefix,
    )
    if synced_result:
        return synced_result, provider_name or "syncedlyrics"

    # If syncedlyrics failed and we haven't tried ytmusic yet, try it now
    if not ytm_lyrics_first and video_id:
        ytmusic_lrc = _fetch_ytmusic_lyrics(video_id, log_prefix)
        if ytmusic_lrc and _looks_like_synced_lyrics(ytmusic_lrc):
            return ytmusic_lrc, "ytmusic"

    return None, None


def _is_alignment_reasonable(duration: float, lyric_lines: List[Dict[str, Any]]) -> bool:
    """
    Heuristic filter to skip badly aligned songs automatically.
    """
    if duration <= 0 or not lyric_lines:
        return False

    last_lyric_time = lyric_lines[-1]['time']
    if last_lyric_time <= 0:
        return False

    coverage_ratio = last_lyric_time / duration if duration > 0 else 0
    duration_gap = abs(duration - last_lyric_time)
    line_count = len(lyric_lines)

    # Reasonable alignment usually covers most of the song and
    # ends within ~45 seconds of the audio duration.
    if line_count < 20:
        return False
    if coverage_ratio < 0.6:
        return False
    if duration_gap > 45:
        return False

    return True


def _score_candidate_video(
    video: Dict[str, Any],
    song_name: str,
    artist: str,
) -> float:
    """
    Score a YouTube candidate for how likely it is to be the official audio.
    Higher is better.
    """
    title = (video.get('title') or '').lower()
    uploader = (video.get('uploader') or '').lower()
    channel = (video.get('channel') or '').lower()
    description = (video.get('description') or '').lower()
    duration = video.get('duration') or 0

    score = 0.0

    # Strong positives
    if 'official audio' in title:
        score += 120
    if '- topic' in uploader or '- topic' in channel:
        score += 90
    if 'provided to youtube' in description:
        score += 70
    if 'audio' in title:
        score += 25
    if 'lyrics' in title or 'lyric video' in title:
        score += 10

    # Title contains both artist and song
    artist_lower = artist.lower()
    song_lower = song_name.lower()
    if artist_lower in title:
        score += 20
    if song_lower in title:
        score += 25

    # Soft duration preference: typical songs are ~2-6 minutes.
    if 120 <= duration <= 420:
        score += 15
    elif duration and (duration < 60 or duration > 600):
        score -= 20

    # Strong negatives
    negative_markers = [
        'official video',
        'music video',
        'mv',
        'live',
        'concert',
        'cover',
        'reaction',
        'karaoke',
        'sped up',
        'slowed',
        'nightcore',
        '8d audio',
        'remix',
    ]
    for marker in negative_markers:
        if marker in title:
            score -= 60

    return score


def _score_ytmusic_candidate(
    result: Dict[str, Any],
    song_name: str,
    artist: str,
) -> float:
    """
    Score a YouTube Music search result.
    """
    title = (result.get('title') or '').lower()
    artists = result.get('artists') or []
    artist_names = [a.get('name', '').lower() for a in artists if isinstance(a, dict)]
    duration = result.get('duration_seconds') or 0

    score = 0.0

    artist_lower = artist.lower()
    song_lower = song_name.lower()

    if any(artist_lower in name for name in artist_names):
        score += 60
    if song_lower in title:
        score += 40

    if 120 <= duration <= 420:
        score += 15
    elif duration and (duration < 60 or duration > 600):
        score -= 20

    for marker in YT_MUSIC_NEGATIVE_MARKERS:
        if marker in title:
            score -= 80

    return score


def _get_ytmusic_client():
    global _ytmusic_client
    if not YTMusic:
        return None
    if _ytmusic_client is None:
        _ytmusic_client = YTMusic()
    return _ytmusic_client


def find_audio_track_ytmusic(song_name: str, artist: str, log_prefix: Optional[str] = None) -> Optional[str]:
    """
    Search YouTube Music for an official audio track and return a music.youtube.com URL.
    """
    client = _get_ytmusic_client()
    if not client:
        return None

    query = f"{artist} {song_name}"
    try:
        results = client.search(query, filter="songs", limit=10)
    except Exception as e:
        log(f"Search error (YouTube Music) for '{query}': {e}", log_prefix)
        return None

    if not results:
        return None

    best = None
    best_score = float('-inf')
    for item in results:
        if not isinstance(item, dict):
            continue
        if item.get('resultType') != 'song':
            continue
        video_id = item.get('videoId')
        if not video_id:
            continue
        title = (item.get('title') or '').lower()
        if any(marker in title for marker in YT_MUSIC_NEGATIVE_MARKERS):
            continue
        score = _score_ytmusic_candidate(item, song_name, artist)
        if score > best_score:
            best_score = score
            best = item

    if best and best.get('videoId'):
        title = best.get('title') or best.get('videoId')
        log(f"🎯 Selected YT Music candidate: {title} (score={best_score:.1f})", log_prefix)
        return f"https://music.youtube.com/watch?v={best['videoId']}"

    return None


def _seconds_to_timecode(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:d}:{minutes:02d}:{secs:06.3f}"


def _normalize_download_url(url: str) -> str:
    """
    Prefer youtube.com URLs for yt-dlp to avoid some auth-gated music.youtube.com pages.
    """
    if not url:
        return url
    if 'music.youtube.com' in url:
        video_id = _extract_youtube_id(url)
        if video_id:
            return f"https://www.youtube.com/watch?v={video_id}"
    return url


def _apply_ydlp_reliability_opts(ydl_opts: Dict[str, Any]) -> Dict[str, Any]:
    """
    Harden yt-dlp against common YouTube throttling/403 issues.
    """
    ydl_opts.setdefault('retries', 10)
    ydl_opts.setdefault('fragment_retries', 10)
    ydl_opts.setdefault('file_access_retries', 5)
    ydl_opts.setdefault('concurrent_fragment_downloads', 1)
    ydl_opts.setdefault('noprogress', True)
    ydl_opts.setdefault('geo_bypass', True)
    ydl_opts.setdefault('nocheckcertificate', True)
    ydl_opts.setdefault('format_sort', ['abr', 'asr', 'ext'])
    ydl_opts.setdefault('extractor_args', {
        'youtube': {
            # Try more stable clients first.
            'player_client': ['android', 'web'],
        }
    })

    return ydl_opts


def _emit_progress(progress_callback: Optional[ProgressCallback], payload: Dict[str, Any]) -> None:
    if not progress_callback:
        return
    try:
        progress_callback(payload)
    except Exception:
        # Never let progress reporting break the download.
        pass


def get_audio_duration(file_path: str) -> float:
    """Get audio file duration using ffprobe"""
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', file_path],
            capture_output=True,
            text=True
        )
        return float(result.stdout.strip())
    except:
        return 0.0


def find_audio_track(song_name: str, artist: str, log_prefix: Optional[str] = None) -> Optional[str]:
    """
    Search for official audio track, preferring YouTube Music results.
    """
    if USE_YT_MUSIC:
        preferred = find_audio_track_ytmusic(song_name, artist, log_prefix)
        if preferred:
            return preferred
        if YT_MUSIC_ONLY:
            log("⚠️ No YouTube Music song result found; skipping YouTube fallback.", log_prefix)
            return None

    # Use a few targeted queries and score the top results from each.
    search_queries = [
        f"{artist} {song_name} official audio",
        f"{artist} {song_name} topic",
        f"{artist} {song_name} audio",
        f"{artist} {song_name}",
    ]

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        # We need duration/title/uploader for scoring.
        'extract_flat': False,
        'skip_download': True,
    }

    best_video: Optional[Dict[str, Any]] = None
    best_score = float('-inf')

    for query in search_queries:
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                result = ydl.extract_info(f"ytsearch5:{query}", download=False)
        except Exception as e:
            log(f"Search error for '{query}': {e}", log_prefix)
            continue

        entries = result.get('entries') if isinstance(result, dict) else None
        if not entries:
            continue

        for video in entries:
            if not video or not video.get('id'):
                continue
            score = _score_candidate_video(video, song_name, artist)
            if score > best_score:
                best_score = score
                best_video = video

    if best_video and best_video.get('id'):
        chosen_url = f"https://www.youtube.com/watch?v={best_video['id']}"
        chosen_title = best_video.get('title') or best_video['id']
        log(f"🎯 Selected audio candidate: {chosen_title} (score={best_score:.1f})", log_prefix)
        return chosen_url

    return None


def prepare_song_metadata(
    youtube_url: str,
    song_name: Optional[str] = None,
    artist_name: Optional[str] = None,
    require_lyrics: bool = True,
    progress_callback: Optional[ProgressCallback] = None,
    log_prefix: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Fetch song duration and synced lyrics without downloading audio.
    Returns canonical metadata for selecting clips before downloading.
    """
    url_to_use = youtube_url
    if song_name and artist_name:
        preferred = find_audio_track(song_name, artist_name, log_prefix)
        if preferred:
            url_to_use = preferred

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
    }
    ydl_opts = _apply_ydlp_reliability_opts(ydl_opts)

    try:
        _emit_progress(progress_callback, {'phase': 'preparing', 'progress': 0.05})
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(_normalize_download_url(url_to_use), download=False)
        _emit_progress(progress_callback, {'phase': 'preparing', 'progress': 0.25})
    except Exception as e:
        log(f"❌ Failed to fetch metadata: {e}", log_prefix)
        return None

    title = song_name or info.get('title', 'Unknown')
    artist = artist_name or info.get('artist') or info.get('uploader', 'Unknown')
    duration = float(info.get('duration') or 0.0)
    thumbnail = info.get('thumbnail')

    title_clean = re.sub(rf'{re.escape(artist)}\s*-\s*', '', title, flags=re.IGNORECASE)
    title_clean = re.sub(r'\s*\(.*?(official|audio|lyric|video).*?\)', '', title_clean, flags=re.IGNORECASE)
    title_clean = title_clean.strip()

    # Fetch canonical artists if available.
    artists_list = fetch_musicbrainz_artists(title_clean, artist) or []
    if artists_list:
        artist = ', '.join(artists_list)

    lrc_content = None
    lyrics_source = None
    if require_lyrics:
        lrc_content, lyrics_source = search_synced_lyrics(
            f"{artist} {title_clean}",
            _extract_youtube_id(url_to_use),
            duration,
            log_prefix,
        )
        _emit_progress(progress_callback, {'phase': 'preparing', 'progress': 0.55})
        if not lrc_content:
            return None
        if lyrics_source:
            log(f"🧾 Lyrics source: {lyrics_source}", log_prefix)

        lyric_lines = parse_lrc(lrc_content)

        if not _is_alignment_reasonable(duration, lyric_lines):
            log(
                "❌ Lyrics/audio alignment looks unreliable during metadata prep. "
                "Skipping this song.\n",
                log_prefix
            )
            return None
    else:
        # Lyrics are optional for this mode; try to fetch, but don't block on failure.
        lyric_lines = []
        try:
            lrc_content, lyrics_source = search_synced_lyrics(
                f"{artist} {title_clean}",
                _extract_youtube_id(url_to_use),
                duration,
                log_prefix,
            )
            _emit_progress(progress_callback, {'phase': 'preparing', 'progress': 0.55})
            lyric_lines = parse_lrc(lrc_content) if lrc_content else []
            if lyrics_source:
                log(f"🧾 Lyrics source: {lyrics_source}", log_prefix)
        except Exception as e:
            _emit_progress(progress_callback, {'phase': 'preparing', 'progress': 0.55})
            log(f"⚠️  Lyrics fetch failed (optional): {e}", log_prefix)

    _emit_progress(progress_callback, {'phase': 'preparing', 'progress': 0.7})

    return {
        'title': title_clean,
        'artist': artist,
        'duration': duration,
        'lyricLines': lyric_lines,
        'lyricsSource': lyrics_source,
        'artists': artists_list,
        'albumArtUrl': thumbnail,
        'sourceUrl': url_to_use,
        'sourceVideoId': info.get('id'),
        'sourceTitle': info.get('title'),
        'sourceUploader': info.get('uploader'),
    }


def download_song(
    youtube_url: str,
    song_name: Optional[str] = None,
    artist_name: Optional[str] = None,
    lyric_lines_override: Optional[List[Dict[str, Any]]] = None,
    duration_override: Optional[float] = None,
    clip_start_sec: Optional[float] = None,
    clip_end_sec: Optional[float] = None,
    skip_alignment_filter: bool = False,
    skip_lyrics_fetch: bool = False,
    progress_callback: Optional[ProgressCallback] = None,
    log_prefix: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Download a song from YouTube and fetch synced lyrics
    Returns song metadata if successful, None otherwise
    """
    download_url = _normalize_download_url(youtube_url)
    if download_url != youtube_url:
        log(f"🎬 Final download URL: {download_url} (normalized from music.youtube.com)", log_prefix)
    else:
        log(f"🎬 Final download URL: {youtube_url}", log_prefix)

    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        # Use the YouTube ID for a stable, predictable filename that matches
        # what we store in the database and serve from the backend.
        'outtmpl': str(AUDIO_DIR / '%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
    }
    ydl_opts = _apply_ydlp_reliability_opts(ydl_opts)

    def progress_hook(d: Dict[str, Any]) -> None:
        status = d.get('status')
        if status == 'downloading':
            downloaded = float(d.get('downloaded_bytes') or 0)
            total = float(d.get('total_bytes') or d.get('total_bytes_estimate') or 0)
            if total > 0:
                pct = max(0.0, min(1.0, downloaded / total))
                # Map download progress into the latter half of the bar.
                _emit_progress(progress_callback, {'phase': 'downloading', 'progress': 0.7 + pct * 0.25})
        elif status == 'finished':
            _emit_progress(progress_callback, {'phase': 'processing', 'progress': 0.97})

    ydl_opts['progress_hooks'] = [progress_hook]

    if clip_start_sec is not None and clip_end_sec is not None and clip_end_sec > clip_start_sec:
        start_tc = _seconds_to_timecode(clip_start_sec)
        end_tc = _seconds_to_timecode(clip_end_sec)
        ydl_opts['download_sections'] = [f"*{start_tc}-{end_tc}"]
        ydl_opts['force_keyframes_at_cuts'] = True

    try:
        download_start = time.perf_counter()
        _emit_progress(progress_callback, {'phase': 'downloading', 'progress': 0.72})
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(download_url, download=True)
            title = song_name or info.get('title', 'Unknown')
            artist = artist_name or info.get('artist') or info.get('uploader', 'Unknown')

            # Clean up title if it contains artist name
            title_clean = re.sub(rf'{re.escape(artist)}\s*-\s*', '', title, flags=re.IGNORECASE)
            title_clean = re.sub(r'\s*\(.*?(official|audio|lyric|video).*?\)', '', title_clean, flags=re.IGNORECASE)
            title_clean = title_clean.strip()

            safe_filename = sanitize_filename(f"{artist} - {title_clean}")
            audio_filename = f"{info.get('id', safe_filename)}.mp3"
            audio_path = AUDIO_DIR / audio_filename
            source_video_id = info.get('id')
            source_title = info.get('title')
            source_uploader = info.get('uploader')
            album_art_url = info.get('thumbnail')

            # Get synced lyrics
            lyrics_path = None
            lyric_lines: List[Dict[str, Any]] = []

            lyrics_source = None
            if lyric_lines_override is not None:
                lyric_lines = lyric_lines_override
                lyrics_source = 'provided'
            elif skip_lyrics_fetch:
                lyric_lines = []
                lyrics_source = None
            else:
                duration_hint = float(info.get('duration') or 0.0)
                lrc_content, lyrics_source = search_synced_lyrics(
                    f"{artist} {title_clean}",
                    source_video_id,
                    duration_hint,
                    log_prefix,
                )

                if lrc_content:
                    if lyrics_source:
                        log(f"🧾 Lyrics source: {lyrics_source}", log_prefix)
                    lyrics_filename = f"{safe_filename}.lrc"
                    lyrics_path = LYRICS_DIR / lyrics_filename

                    with open(lyrics_path, 'w', encoding='utf-8') as f:
                        f.write(lrc_content)

                    lyric_lines = parse_lrc(lrc_content)
                else:
                    log("⚠️  No synced lyrics found", log_prefix)

            # Get audio duration
            duration = duration_override or get_audio_duration(str(audio_path))

            # Misalignment filter: skip songs that still look badly aligned.
            if not skip_alignment_filter and not _is_alignment_reasonable(duration, lyric_lines):
                log(
                    "❌ Lyrics/audio alignment looks unreliable. "
                    "Skipping this song to avoid a bad game experience.\n",
                    log_prefix
                )
                return None

            song_data = {
                'title': title_clean,
                'artist': artist,
                'audioPath': str(audio_path),
                'lyricsPath': str(lyrics_path) if lyrics_path else None,
                'duration': duration,
                'lyricLines': lyric_lines,
                'lyricsSource': lyrics_source,
                'albumArtUrl': album_art_url,
                'sourceUrl': youtube_url,
                'sourceVideoId': source_video_id,
                'sourceTitle': source_title,
                'sourceUploader': source_uploader,
                'clipStartSec': clip_start_sec,
                'clipEndSec': clip_end_sec,
            }

            # Save to MongoDB
            result = songs_collection.insert_one(song_data)
            song_data['_id'] = str(result.inserted_id)

            download_elapsed = time.perf_counter() - download_start
            log(f"✅ Downloaded successfully! ID: {song_data['_id']} (total {download_elapsed:.2f}s)", log_prefix)
            _emit_progress(progress_callback, {'phase': 'done', 'progress': 1.0})
            return song_data

    except Exception as e:
        log(f"❌ Error downloading song: {e}", log_prefix)
        return None


def download_from_search(song_name: str, artist: str, log_prefix: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Search for a song and download it
    """
    url = find_audio_track(song_name, artist, log_prefix)

    if not url:
        return None

    return download_song(url, song_name, artist, log_prefix=log_prefix)

def download_with_preferred_audio(
    youtube_url: str,
    song_name: Optional[str],
    artist: Optional[str],
    lyric_lines_override: Optional[List[Dict[str, Any]]] = None,
    duration_override: Optional[float] = None,
    clip_start_sec: Optional[float] = None,
    clip_end_sec: Optional[float] = None,
    skip_alignment_filter: bool = False,
    skip_lyrics_fetch: bool = False,
    progress_callback: Optional[ProgressCallback] = None,
    log_prefix: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Prefer an official audio/topic track when we know the song and artist,
    even if a specific YouTube URL was provided (e.g., a music video).
    Falls back to the provided URL if no better audio track is found.
    """
    if song_name and artist:
        try:
            preferred_url = find_audio_track(song_name, artist, log_prefix)
            if preferred_url and preferred_url != youtube_url:
                return download_song(
                    preferred_url,
                    song_name,
                    artist,
                    lyric_lines_override=lyric_lines_override,
                    duration_override=duration_override,
                    clip_start_sec=clip_start_sec,
                    clip_end_sec=clip_end_sec,
                    skip_alignment_filter=skip_alignment_filter,
                    skip_lyrics_fetch=skip_lyrics_fetch,
                    progress_callback=progress_callback,
                    log_prefix=log_prefix,
                )
            if YT_MUSIC_ONLY and not preferred_url:
                log("⚠️ YT_MUSIC_ONLY enabled and no song result found. Skipping download.", log_prefix)
                return None
        except Exception as e:
            log(f"⚠️ Preferred audio lookup failed, using provided URL: {e}", log_prefix)

    return download_song(
        youtube_url,
        song_name,
        artist_name=artist,
        lyric_lines_override=lyric_lines_override,
        duration_override=duration_override,
        clip_start_sec=clip_start_sec,
        clip_end_sec=clip_end_sec,
        skip_alignment_filter=skip_alignment_filter,
        skip_lyrics_fetch=skip_lyrics_fetch,
        progress_callback=progress_callback,
        log_prefix=log_prefix,
    )


def download_youtube_playlist(playlist_url: str) -> List[Dict[str, Any]]:
    """
    Download all songs from a YouTube playlist
    """
    print(f"📋 Processing YouTube playlist: {playlist_url}\n")

    ydl_opts = {
        'quiet': True,
        'extract_flat': True,
    }

    songs = []

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(playlist_url, download=False)

            if 'entries' in result:
                for entry in result['entries']:
                    if entry:
                        video_url = f"https://www.youtube.com/watch?v={entry['id']}"
                        song_data = download_song(video_url)
                        if song_data and song_data.get('lyricLines'):
                            songs.append(song_data)
    except Exception as e:
        print(f"❌ Playlist error: {e}")

    return songs


def cleanup_song(song_id: str):
    """
    Delete song files and database entry
    """
    song = songs_collection.find_one({'_id': song_id})
    if song:
        # Delete audio file
        if os.path.exists(song['audioPath']):
            os.remove(song['audioPath'])

        # Delete lyrics file
        if song.get('lyricsPath') and os.path.exists(song['lyricsPath']):
            os.remove(song['lyricsPath'])

        # Delete from database
        songs_collection.delete_one({'_id': song_id})
        print(f"🗑️  Cleaned up song: {song['title']}")


if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  Download from URL: python downloader.py <youtube_url>")
        print("  Search and download: python downloader.py search <song_name> <artist>")
        print("  Download playlist: python downloader.py playlist <playlist_url>")
        sys.exit(1)

    command = sys.argv[1]

    if command == 'search' and len(sys.argv) >= 4:
        song_name = sys.argv[2]
        artist = sys.argv[3]
        download_from_search(song_name, artist)
    elif command == 'playlist' and len(sys.argv) >= 3:
        playlist_url = sys.argv[2]
        songs = download_youtube_playlist(playlist_url)
        print(f"\n✅ Downloaded {len(songs)} songs with synced lyrics")
    else:
        # Assume it's a URL
        download_song(command)
