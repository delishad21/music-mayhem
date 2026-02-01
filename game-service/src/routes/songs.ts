import express from 'express';
import axios from 'axios';

const router = express.Router();
const SONG_SERVICE_URL = process.env.SONG_SERVICE_URL || 'http://song-service:5001';

/**
 * Parse a Spotify playlist URL to get track list
 */
router.post('/parse-spotify-playlist', async (req, res) => {
  try {
    const { playlistUrl } = req.body;

    if (!playlistUrl) {
      return res.status(400).json({ error: 'Playlist URL required' });
    }

    const response = await axios.post(`${SONG_SERVICE_URL}/parse-spotify-playlist`, {
      playlistUrl,
    }, { timeout: 30000 });

    res.json(response.data);
  } catch (error: any) {
    console.error('Parse Spotify playlist error:', error.message);
    const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch playlist';
    res.status(error.response?.status || 500).json({ error: errorMessage });
  }
});

/**
 * Parse a YouTube playlist URL to get video list
 */
router.post('/parse-youtube-playlist', async (req, res) => {
  try {
    const { playlistUrl } = req.body;

    if (!playlistUrl) {
      return res.status(400).json({ error: 'Playlist URL required' });
    }

    const response = await axios.post(`${SONG_SERVICE_URL}/parse-youtube-playlist`, {
      playlistUrl,
    }, { timeout: 30000 });

    res.json(response.data);
  } catch (error: any) {
    console.error('Parse YouTube playlist error:', error.message);
    const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch playlist';
    res.status(error.response?.status || 500).json({ error: errorMessage });
  }
});

/**
 * Manual song list
 */
router.post('/create-song-list', async (req, res) => {
  try {
    const { songs } = req.body;

    if (!songs || !Array.isArray(songs)) {
      return res.status(400).json({ error: 'Songs array required' });
    }

    res.json({ tracks: songs });
  } catch (error) {
    console.error('Create song list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
