#!/usr/bin/env python3
"""
Parse playlists to get track lists without downloading
"""

import sys
import json
import re
import os
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv()

def parse_spotify_playlist(playlist_url: str) -> List[Dict[str, str]]:
    """Parse Spotify playlist and return track list"""
    try:
        import spotipy
        from spotipy.oauth2 import SpotifyClientCredentials

        # Extract playlist ID
        patterns = [
            r'playlist/([a-zA-Z0-9]+)',
            r'spotify:playlist:([a-zA-Z0-9]+)',
        ]

        playlist_id = None
        for pattern in patterns:
            match = re.search(pattern, playlist_url)
            if match:
                playlist_id = match.group(1)
                break

        if not playlist_id:
            playlist_id = playlist_url

        # Initialize Spotify client
        client_id = os.getenv('SPOTIFY_CLIENT_ID', '')
        client_secret = os.getenv('SPOTIFY_CLIENT_SECRET', '')

        if client_id and client_secret:
            auth_manager = SpotifyClientCredentials(
                client_id=client_id,
                client_secret=client_secret
            )
            sp = spotipy.Spotify(auth_manager=auth_manager)
        else:
            sp = spotipy.Spotify()

        # Fetch tracks (try with configured market first, then fallback to no market)
        market = os.getenv('SPOTIFY_MARKET', '').strip() or None

        def fetch_tracks(with_market: str | None):
            return sp.playlist_tracks(playlist_id, market=with_market)

        try:
            results = fetch_tracks(market)
        except Exception as e:
            # If market-specific lookup fails (e.g., 404), retry without market.
            try:
                if market:
                    results = fetch_tracks(None)
                else:
                    raise e
            except Exception as fallback_error:
                print(f"Error parsing Spotify playlist: {fallback_error}", file=sys.stderr)
                return []
        tracks = []

        while results:
            for item in results['items']:
                if item['track']:
                    track = item['track']
                    artists = ', '.join([artist['name'] for artist in track['artists']])
                    album_images = track.get('album', {}).get('images') or []
                    album_art_url = album_images[0]['url'] if album_images else None
                    tracks.append({
                        'songName': track['name'],
                        'artist': artists,
                        'albumArtUrl': album_art_url,
                    })

            # Pagination
            if results['next']:
                results = sp.next(results)
            else:
                results = None

        return tracks

    except Exception as e:
        print(f"Error parsing Spotify playlist: {e}", file=sys.stderr)
        return []


def parse_youtube_playlist(playlist_url: str) -> List[Dict[str, str]]:
    """Parse YouTube playlist and return video list"""
    try:
        import yt_dlp

        ydl_opts = {
            'quiet': True,
            'extract_flat': True,
            'no_warnings': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(playlist_url, download=False)

            if 'entries' not in result:
                return []

            tracks = []
            for entry in result['entries']:
                if entry:
                    # Extract artist and song from title if possible
                    title = entry.get('title', 'Unknown')

                    # Try to parse "Artist - Song" format
                    if ' - ' in title:
                        parts = title.split(' - ', 1)
                        artist = parts[0].strip()
                        song = parts[1].strip()
                        # Remove common suffixes
                        song = re.sub(r'\s*\(.*?(official|audio|lyric|video).*?\)', '', song, flags=re.IGNORECASE)
                        song = song.strip()
                    else:
                        artist = entry.get('uploader', 'Unknown')
                        song = title

                    video_id = entry.get('id')
                    thumbnails = entry.get('thumbnails') or []
                    thumbnail_url = None
                    if thumbnails:
                        thumbnail_url = thumbnails[-1].get('url')
                    if not thumbnail_url:
                        thumbnail_url = entry.get('thumbnail')
                    if not thumbnail_url and video_id:
                        thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

                    tracks.append({
                        'url': f"https://www.youtube.com/watch?v={video_id}",
                        'songName': song,
                        'artist': artist,
                        'albumArtUrl': thumbnail_url,
                    })

            return tracks

    except Exception as e:
        print(f"Error parsing YouTube playlist: {e}", file=sys.stderr)
        return []


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python parse_playlist.py <spotify|youtube> <playlist_url>", file=sys.stderr)
        sys.exit(1)

    playlist_type = sys.argv[1]
    playlist_url = sys.argv[2]

    if playlist_type == 'spotify':
        tracks = parse_spotify_playlist(playlist_url)
    elif playlist_type == 'youtube':
        tracks = parse_youtube_playlist(playlist_url)
    else:
        print(f"Unknown playlist type: {playlist_type}", file=sys.stderr)
        sys.exit(1)

    # Output JSON
    print(json.dumps(tracks))
