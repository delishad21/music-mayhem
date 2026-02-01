#!/usr/bin/env python3
"""
Spotify playlist integration
Fetches songs from Spotify playlists and downloads them from YouTube
"""

import os
import re
from typing import List, Dict, Any
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from downloader import download_from_search
from dotenv import load_dotenv

load_dotenv()

# Spotify API setup (optional - will work without credentials for public playlists)
SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID', '')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET', '')


def get_spotify_client():
    """Initialize Spotify client"""
    if SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET:
        auth_manager = SpotifyClientCredentials(
            client_id=SPOTIFY_CLIENT_ID,
            client_secret=SPOTIFY_CLIENT_SECRET
        )
        return spotipy.Spotify(auth_manager=auth_manager)
    else:
        # Try without credentials (limited access)
        return spotipy.Spotify()


def extract_playlist_id(playlist_url: str) -> str:
    """Extract playlist ID from Spotify URL"""
    # Handle various Spotify URL formats
    patterns = [
        r'playlist/([a-zA-Z0-9]+)',
        r'spotify:playlist:([a-zA-Z0-9]+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, playlist_url)
        if match:
            return match.group(1)

    # Assume it's already just an ID
    return playlist_url


def get_spotify_playlist_tracks(playlist_url: str) -> List[Dict[str, Any]]:
    """
    Fetch all tracks from a Spotify playlist
    Returns list of {name, artist, duration_ms, isrc}
    """
    try:
        sp = get_spotify_client()
        playlist_id = extract_playlist_id(playlist_url)

        print(f"📋 Fetching Spotify playlist: {playlist_id}\n")

        results = sp.playlist_tracks(playlist_id)
        tracks = []

        while results:
            for item in results['items']:
                if item['track']:
                    track = item['track']
                    artists = ', '.join([artist['name'] for artist in track['artists']])

                    tracks.append({
                        'name': track['name'],
                        'artist': artists,
                        'duration_ms': track['duration_ms'],
                        'isrc': track.get('external_ids', {}).get('isrc'),
                    })

            # Handle pagination
            if results['next']:
                results = sp.next(results)
            else:
                results = None

        print(f"✅ Found {len(tracks)} tracks in playlist\n")
        return tracks

    except Exception as e:
        print(f"❌ Spotify API error: {e}")
        return []


def download_spotify_playlist(playlist_url: str) -> List[Dict[str, Any]]:
    """
    Download all songs from a Spotify playlist via YouTube
    """
    tracks = get_spotify_playlist_tracks(playlist_url)
    downloaded_songs = []

    for i, track in enumerate(tracks, 1):
        print(f"[{i}/{len(tracks)}] Processing: {track['name']} by {track['artist']}")

        song_data = download_from_search(track['name'], track['artist'])

        if song_data and song_data.get('lyricLines'):
            downloaded_songs.append(song_data)
        else:
            print(f"⚠️  Skipped (no synced lyrics available)\n")

    print(f"\n✅ Successfully downloaded {len(downloaded_songs)} of {len(tracks)} songs")
    return downloaded_songs


if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print("Usage: python spotify_integration.py <spotify_playlist_url>")
        print("\nOptional: Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env")
        sys.exit(1)

    playlist_url = sys.argv[1]
    download_spotify_playlist(playlist_url)
