#!/usr/bin/env python3
"""
Flask API server for song downloading service
"""

import os
import json
import threading
import uuid
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Import our existing modules
from downloader import (
    download_song,
    download_from_search,
    download_with_preferred_audio,
    prepare_song_metadata,
)
from parse_playlist import parse_spotify_playlist, parse_youtube_playlist
from pymongo import MongoClient

load_dotenv()

app = Flask(__name__)
CORS(app)

# Silence Werkzeug request logs (e.g. GET /job-status ... 200)
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)
werkzeug_logger.propagate = False

# MongoDB connection
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://admin:musicgame123@localhost:27017/music_game?authSource=admin')
mongo_client = MongoClient(MONGODB_URI)
db = mongo_client['music_game']
songs_collection = db['songs']

# In-memory download tracking
download_jobs = {}
job_lock = threading.Lock()


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'song-downloader'})


@app.route('/download-song', methods=['POST'])
def api_download_song():
    """
    Download a song by URL or search
    Body: {
      "url": "...",
      "songName": "...",
      "artist": "...",
      "lyricLines": [...],
      "duration": 123.4,
      "clipStartSec": 12.0,
      "clipEndSec": 28.0
    }
    Returns: { "jobId": "...", "status": "downloading" }
    """
    data = request.json
    url = data.get('url')
    song_name = data.get('songName')
    artist = data.get('artist')
    lyric_lines = data.get('lyricLines')
    duration = data.get('duration')
    clip_start_sec = data.get('clipStartSec')
    clip_end_sec = data.get('clipEndSec')
    skip_alignment_filter = data.get('skipAlignmentFilter')
    skip_lyrics_fetch = data.get('skipLyricsFetch', False)

    if skip_alignment_filter is None:
        skip_alignment_filter = clip_start_sec is not None and clip_end_sec is not None

    if not url and not (song_name and artist):
        return jsonify({'error': 'Either url or (songName + artist) required'}), 400

    # Generate a stable, unique job ID
    job_id = uuid.uuid4().hex

    with job_lock:
        download_jobs[job_id] = {
            'status': 'downloading',
            'songId': None,
            'error': None,
            'progress': 0.0,
            'phase': 'queued',
        }

    def update_progress(payload: dict):
        progress = float(payload.get('progress') or 0.0)
        phase = payload.get('phase') or 'downloading'
        with job_lock:
            job = download_jobs.get(job_id)
            if not job:
                return
            job['progress'] = max(0.0, min(1.0, progress))
            job['phase'] = phase

    # Start download in background
    def download_task():
        try:
            # Create a log prefix for identifying this download
            if song_name and artist:
                log_prefix = f"{artist} - {song_name}"
            elif url:
                log_prefix = f"URL: {url[:50]}..."
            else:
                log_prefix = job_id[:8]

            update_progress({'phase': 'preparing', 'progress': 0.02})
            if url:
                result = download_with_preferred_audio(
                    url,
                    song_name,
                    artist,
                    lyric_lines_override=lyric_lines,
                    duration_override=duration,
                    clip_start_sec=clip_start_sec,
                    clip_end_sec=clip_end_sec,
                    skip_alignment_filter=bool(skip_alignment_filter),
                    skip_lyrics_fetch=bool(skip_lyrics_fetch),
                    progress_callback=update_progress,
                    log_prefix=log_prefix,
                )
            else:
                result = download_from_search(song_name, artist, log_prefix=log_prefix)

            with job_lock:
                if result:
                    download_jobs[job_id]['status'] = 'completed'
                    download_jobs[job_id]['songId'] = str(result.get('_id'))
                    download_jobs[job_id]['progress'] = 1.0
                    download_jobs[job_id]['phase'] = 'done'
                else:
                    download_jobs[job_id]['status'] = 'failed'
                    download_jobs[job_id]['error'] = 'Download failed or no synced lyrics'
        except Exception as e:
            with job_lock:
                download_jobs[job_id]['status'] = 'failed'
                download_jobs[job_id]['error'] = str(e)

    thread = threading.Thread(target=download_task)
    thread.daemon = True
    thread.start()

    return jsonify({
        'jobId': job_id,
        'status': 'downloading',
    })


@app.route('/prepare-song', methods=['POST'])
def api_prepare_song():
    """
    Prepare song metadata and synced lyrics without downloading audio.
    Body: { "url": "...", "songName": "...", "artist": "..." }
    Returns: { "metadata": { ... } }
    """
    data = request.json
    url = data.get('url')
    song_name = data.get('songName')
    artist = data.get('artist')
    require_lyrics = bool(data.get('requireLyrics', True))

    if not url and not (song_name and artist):
        return jsonify({'error': 'Either url or (songName + artist) required'}), 400

    try:
        # Create a log prefix for identifying this preparation
        if song_name and artist:
            log_prefix = f"{artist} - {song_name}"
        elif url:
            log_prefix = f"URL: {url[:50]}..."
        else:
            log_prefix = "prepare"

        if url:
            metadata = prepare_song_metadata(
                url,
                song_name,
                artist,
                require_lyrics=require_lyrics,
                log_prefix=log_prefix,
            )
        else:
            # If only song/artist are provided, find a likely audio track first.
            from downloader import find_audio_track
            preferred_url = find_audio_track(song_name, artist, log_prefix=log_prefix)
            if not preferred_url:
                return jsonify({'error': 'Could not find a suitable audio track'}), 404
            metadata = prepare_song_metadata(
                preferred_url,
                song_name,
                artist,
                require_lyrics=require_lyrics,
                log_prefix=log_prefix,
            )

        if not metadata:
            return jsonify({'error': 'Failed to prepare song metadata'}), 500

        return jsonify({'metadata': metadata})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/job-status/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """
    Get status of a download job
    Returns: { "status": "downloading|completed|failed", "songId": "...", "error": "..." }
    """
    with job_lock:
        job = download_jobs.get(job_id)

    if not job:
        return jsonify({'error': 'Job not found'}), 404

    return jsonify(job)


@app.route('/parse-spotify-playlist', methods=['POST'])
def api_parse_spotify():
    """
    Parse Spotify playlist URL
    Body: { "playlistUrl": "..." }
    Returns: { "tracks": [{ "songName": "...", "artist": "..." }] }
    """
    data = request.json
    playlist_url = data.get('playlistUrl')

    if not playlist_url:
        return jsonify({'error': 'playlistUrl required'}), 400

    try:
        tracks = parse_spotify_playlist(playlist_url)
        return jsonify({'tracks': tracks})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/parse-youtube-playlist', methods=['POST'])
def api_parse_youtube():
    """
    Parse YouTube playlist URL
    Body: { "playlistUrl": "..." }
    Returns: { "tracks": [{ "url": "...", "songName": "...", "artist": "..." }] }
    """
    data = request.json
    playlist_url = data.get('playlistUrl')

    if not playlist_url:
        return jsonify({'error': 'playlistUrl required'}), 400

    try:
        tracks = parse_youtube_playlist(playlist_url)
        return jsonify({'tracks': tracks})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/song/<song_id>', methods=['GET'])
def get_song(song_id):
    """
    Get song details from database
    Returns: { "title": "...", "artist": "...", ... }
    """
    try:
        from bson import ObjectId
        song = songs_collection.find_one({'_id': ObjectId(song_id)})

        if not song:
            return jsonify({'error': 'Song not found'}), 404

        # Convert ObjectId to string
        song['_id'] = str(song['_id'])

        return jsonify(song)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/song/<song_id>', methods=['DELETE'])
def delete_song(song_id):
    """
    Delete song files and database entry
    """
    try:
        from bson import ObjectId
        import os

        song = songs_collection.find_one({'_id': ObjectId(song_id)})

        if not song:
            return jsonify({'error': 'Song not found'}), 404

        # Delete audio file
        if song.get('audioPath') and os.path.exists(song['audioPath']):
            os.remove(song['audioPath'])

        # Delete lyrics file
        if song.get('lyricsPath') and os.path.exists(song['lyricsPath']):
            os.remove(song['lyricsPath'])

        # Delete from database
        songs_collection.delete_one({'_id': ObjectId(song_id)})

        return jsonify({'success': True, 'message': 'Song deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("🎵 Song Download Service API starting...")
    print(f"📂 Audio directory: {os.path.join(os.getcwd(), 'songs/audio')}")
    print(f"📝 Lyrics directory: {os.path.join(os.getcwd(), 'songs/lyrics')}")
    # In Docker dev, the reloader can wipe in-memory jobs and also
    # serialize requests. Run threaded without the reloader instead.
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=False,
        use_reloader=False,
        threaded=True,
    )
