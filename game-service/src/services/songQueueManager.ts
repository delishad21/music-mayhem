import axios from 'axios';
import { GameMode, RoomSettings } from '../types/game';
import {
  cleanTitleForGuess,
  extractFeaturedArtistsFromTitle,
  formatGuessHangman,
  getHangmanOptionsFromSettings,
  getChallengeClips,
  getRandomSnippet,
  mergeArtists,
  convertChineseText,
  selectRandomLyric,
  splitArtists,
  toHangmanFormat,
} from '../utils/gameUtils';

interface QueuedSong {
  url?: string;
  songName?: string;
  artist?: string;
  status: 'pending' | 'preparing' | 'downloading' | 'ready' | 'failed';
  songId?: string;
  jobId?: string;
  error?: string;
  metadata?: PreparedSongMetadata;
  clip?: PrecomputedClip;
  progress?: number;
}

interface SongQueue {
  roomCode: string;
  gameMode: GameMode;
  settings: RoomSettings;
  songs: QueuedSong[];
  currentIndex: number;
  activeCount: number;
  activeIndices: Set<number>;
  version: number;
}

const queues = new Map<string, SongQueue>();
const queueVersions = new Map<string, number>();

const SONG_SERVICE_URL = process.env.SONG_SERVICE_URL || 'http://song-service:5001';
const TARGET_BUFFER_COUNT = 5; // Keep 5 songs ready/processing ahead
const MAX_PARALLEL_DOWNLOADS = Math.max(1, Number(process.env.MAX_PARALLEL_DOWNLOADS || 2));
const CLIP_BUFFER_BEFORE_SEC = 5;
const CLIP_BUFFER_AFTER_SEC = 2;
const RESULTS_TAIL_BUFFER_SEC = 0.75;

export interface PreparedSongMetadata {
  title: string;
  artist: string;
  duration: number;
  lyricLines: Array<{ time: number; text: string }>;
  lyricsSource?: string | null;
  albumArtUrl?: string | null;
  artists?: string[] | null;
  sourceUrl: string;
  sourceVideoId?: string;
  sourceTitle?: string;
  sourceUploader?: string;
}

export interface PrecomputedClip {
  clipStartSec: number;
  clipEndSec: number;
  mediaStartSec: number;
  mediaEndSec: number;
  playbackStartSec: number;
  playbackStopSec?: number;
  playbackDurationSec?: number;
  hangman?: string;
  targetLyric?: string;
  targetLyricDisplay?: string;
  clipLyricLines?: Array<{ time: number; text: string }>;
  challengeClips?: number[];
  lyricLinesShifted: Array<{ time: number; text: string }>;
  clipDurationSec: number;
}

function advancePastFailedSongs(queue: SongQueue): number {
  let skipped = 0;
  while (queue.currentIndex < queue.songs.length) {
    const current = queue.songs[queue.currentIndex];
    if (current.status !== 'failed') break;
    queue.currentIndex += 1;
    skipped += 1;
  }
  return skipped;
}

/**
 * Initialize a song queue for a room
 */
export function initializeQueue(
  roomCode: string,
  gameMode: GameMode,
  settings: RoomSettings,
  playlist: Array<{ url?: string; songName?: string; artist?: string }>
) {
  const nextVersion = (queueVersions.get(roomCode) || 0) + 1;
  queueVersions.set(roomCode, nextVersion);

  const queue: SongQueue = {
    roomCode,
    gameMode,
    settings,
    songs: playlist.map(item => ({
      ...item,
      status: 'pending',
    })),
    currentIndex: 0,
    activeCount: 0,
    activeIndices: new Set<number>(),
    version: nextVersion,
  };

  queues.set(roomCode, queue);

  // Start downloading first batch
  downloadAhead(roomCode);

  return queue;
}

/**
 * Prepare a queue for a room. This replaces any existing queue.
 */
export async function prepareQueue(
  roomCode: string,
  gameMode: GameMode,
  settings: RoomSettings,
  playlist: Array<{ url?: string; songName?: string; artist?: string }>
) {
  // Best-effort cleanup of already-downloaded songs from the previous queue.
  await cleanupQueue(roomCode);
  return initializeQueue(roomCode, gameMode, settings, playlist);
}

/**
 * Download songs ahead of current position
 */
async function downloadAhead(roomCode: string) {
  const queue = queues.get(roomCode);
  if (!queue) return;

  // Don’t get stuck on failed songs.
  advancePastFailedSongs(queue);

  const startIndex = queue.currentIndex;
  const endIndex = Math.min(startIndex + TARGET_BUFFER_COUNT, queue.songs.length);

  for (let i = startIndex; i < endIndex; i++) {
    if (queue.activeCount >= MAX_PARALLEL_DOWNLOADS) {
      break;
    }

    const song = queue.songs[i];

    if (song.status === 'pending' && !queue.activeIndices.has(i)) {
      const expectedVersion = queue.version;
      const { gameMode, settings } = queue;

      queue.activeCount += 1;
      queue.activeIndices.add(i);

      void prepareAndDownloadSong(roomCode, i, expectedVersion, gameMode, settings)
        .catch(err => {
          console.error(`❌ Unexpected error preparing song ${i + 1}:`, err?.message || err);
        })
        .finally(() => {
          const currentQueue = queues.get(roomCode);
          if (!currentQueue || currentQueue.version !== expectedVersion) {
            return;
          }
          currentQueue.activeCount = Math.max(0, currentQueue.activeCount - 1);
          currentQueue.activeIndices.delete(i);
          // Keep the buffer filled as soon as a slot frees up.
          void downloadAhead(roomCode);
        });
    }
  }
}

/**
 * Prepare metadata, compute clip, and download the clip via Flask API
 */
async function prepareAndDownloadSong(
  roomCode: string,
  index: number,
  expectedVersion: number,
  gameMode: GameMode,
  settings: RoomSettings
): Promise<void> {
  const queue = queues.get(roomCode);
  if (!queue) return;
  if (queue.version !== expectedVersion) return;

  const song = queue.songs[index];
  song.status = 'preparing';

  console.log(`🧠 Preparing song ${index + 1}/${queue.songs.length} for room ${roomCode}`);

  try {
    const requireLyrics = gameMode === 'finish-lyrics';
    const metadata = await prepareSongMetadata(song, requireLyrics);
    if (!metadata) {
      song.status = 'failed';
      song.error = requireLyrics
        ? 'Failed to prepare song metadata or lyrics'
        : 'Failed to prepare song metadata';
      return;
    }

    const latestQueue = queues.get(roomCode);
    if (!latestQueue || latestQueue.version !== expectedVersion) {
      return;
    }

    song.metadata = metadata;

    const clip = computeClip(metadata, gameMode, settings);
    if (!clip) {
      song.status = 'failed';
      song.error = 'Failed to compute clip';
      return;
    }

    song.clip = clip;
    song.status = 'downloading';

    // Call Flask API to start download
    const response = await axios.post(
      `${SONG_SERVICE_URL}/download-song`,
      {
        url: metadata.sourceUrl || song.url,
        songName: metadata.title,
        artist: metadata.artist,
        lyricLines: clip.lyricLinesShifted,
        duration: clip.clipDurationSec,
        clipStartSec: clip.mediaStartSec,
        clipEndSec: clip.mediaEndSec,
        skipAlignmentFilter: true,
        skipLyricsFetch: gameMode !== 'finish-lyrics',
        skipPreferredLookup: true,
        preserveOriginalAudio: true,
        forceKeyframesAtCuts: false,
      },
      { timeout: 60000 }
    );

    const jobId = response.data.jobId;
    song.jobId = jobId;

    try {
      await streamJobStatus(roomCode, index, jobId, expectedVersion);
    } catch (streamError: any) {
      console.warn(`⚠️ Job event stream failed for song ${index + 1}, falling back to polling:`, streamError?.message || streamError);
      await pollJobStatus(roomCode, index, jobId, expectedVersion);
    }
  } catch (error: any) {
    console.error(`❌ Download failed for song ${index + 1}:`, error.message);
    song.status = 'failed';
    song.error = error.message;
  }
}

async function cancelSongJob(jobId: string) {
  try {
    await axios.delete(`${SONG_SERVICE_URL}/job/${jobId}`, { timeout: 5000 });
  } catch (err: any) {
    console.error('Error cancelling song job:', err.message);
  }
}

async function streamJobStatus(
  roomCode: string,
  index: number,
  jobId: string,
  expectedVersion: number
): Promise<void> {
  const response = await axios.get(`${SONG_SERVICE_URL}/job-events/${jobId}`, {
    responseType: 'stream',
    timeout: 70000,
  });

  return new Promise((resolve, reject) => {
    let buffer = '';
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      response.data.destroy?.();
      fn();
    };

    const handlePayload = (payload: any) => {
      const currentQueue = queues.get(roomCode);
      if (!currentQueue || currentQueue.version !== expectedVersion) {
        void cancelSongJob(jobId);
        settle(resolve);
        return;
      }

      const song = currentQueue.songs[index];
      if (!song) {
        void cancelSongJob(jobId);
        settle(resolve);
        return;
      }

      const progress = Number(payload.progress);
      if (!Number.isNaN(progress)) {
        song.progress = Math.max(0, Math.min(1, progress));
      }

      if (payload.status === 'completed') {
        song.status = 'ready';
        song.songId = payload.songId;
        song.progress = 1;
        console.log(`✅ Song ${index + 1} ready: ${song.songId}`);
        settle(resolve);
      } else if (payload.status === 'failed' || payload.status === 'cancelled') {
        song.status = 'failed';
        song.error = payload.error || (payload.status === 'cancelled' ? 'Download cancelled' : 'Download failed');
        console.log(`❌ Song ${index + 1} failed: ${song.error}`);
        settle(resolve);
      }
    };

    response.data.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const event of events) {
        const dataLine = event
          .split('\n')
          .find(line => line.startsWith('data: '));
        if (!dataLine) continue;
        try {
          handlePayload(JSON.parse(dataLine.slice(6)));
        } catch (error) {
          settle(() => reject(error));
        }
      }
    });

    response.data.on('error', (error: Error) => {
      settle(() => reject(error));
    });

    response.data.on('end', () => {
      settle(() => reject(new Error('Job event stream ended before completion')));
    });
  });
}

/**
 * Poll job status until complete
 */
async function pollJobStatus(
  roomCode: string,
  index: number,
  jobId: string,
  expectedVersion: number
): Promise<void> {
  const queue = queues.get(roomCode);
  if (!queue) return;
  if (queue.version !== expectedVersion) return;

  const song = queue.songs[index];
  const maxAttempts = 60; // 60 attempts = 60 seconds
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const currentQueue = queues.get(roomCode);
      if (!currentQueue || currentQueue.version !== expectedVersion) {
        return;
      }

      const response = await axios.get(`${SONG_SERVICE_URL}/job-status/${jobId}`);
      const status = response.data.status;

      if (status === 'completed') {
        song.status = 'ready';
        song.songId = response.data.songId;
        song.progress = 1;
        console.log(`✅ Song ${index + 1} ready: ${song.songId}`);
        return;
      } else if (status === 'failed' || status === 'cancelled') {
        song.status = 'failed';
        song.error = response.data.error || (status === 'cancelled' ? 'Download cancelled' : 'Download failed');
        console.log(`❌ Song ${index + 1} failed: ${song.error}`);
        return;
      }

      const progress = Number(response.data.progress);
      if (!Number.isNaN(progress)) {
        song.progress = Math.max(0, Math.min(1, progress));
      }

      // Still downloading, wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    } catch (error: any) {
      console.error(`Error polling job status:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
  }

  // Timeout
  song.status = 'failed';
  song.error = 'Download timeout';
  console.log(`❌ Song ${index + 1} timed out`);
}

async function prepareSongMetadata(
  song: QueuedSong,
  requireLyrics: boolean
): Promise<PreparedSongMetadata | null> {
  try {
    const response = await axios.post(
      `${SONG_SERVICE_URL}/prepare-song`,
      {
        url: song.url,
        songName: song.songName,
        artist: song.artist,
        requireLyrics,
      },
      { timeout: 60000 }
    );

    const metadata = response.data?.metadata as PreparedSongMetadata | undefined;
    if (!metadata?.duration) {
      return null;
    }
    if (requireLyrics && !metadata?.lyricLines?.length) {
      return null;
    }
    return metadata;
  } catch (error: any) {
    console.error('Error preparing song metadata:', error?.message || error);
    return null;
  }
}

function shiftLyricLines(
  lyricLines: Array<{ time: number; text: string }>,
  clipStartSec: number,
  clipEndSec: number
) {
  return lyricLines
    .filter(line => line.time >= clipStartSec && line.time <= clipEndSec)
    .map(line => ({
      time: Math.max(0, line.time - clipStartSec),
      text: line.text,
    }));
}

function computeClip(
  metadata: PreparedSongMetadata,
  gameMode: GameMode,
  settings: RoomSettings
): PrecomputedClip | null {
  const duration = metadata.duration;
  const resultsTailSec = (settings.resultsDelayMs ?? 7000) / 1000 + CLIP_BUFFER_AFTER_SEC + RESULTS_TAIL_BUFFER_SEC;
  const convertMode = settings.convertChineseLyrics ?? 'none';
  const lyricLines = (metadata.lyricLines || []).map(line => ({
    ...line,
    text: convertChineseText(line.text, convertMode),
  }));
  if (!duration) return null;
  if (gameMode === 'finish-lyrics' && lyricLines.length === 0) {
    return null;
  }

  if (gameMode === 'finish-lyrics') {
    const hangmanOptions = getHangmanOptionsFromSettings(settings);
    const selection = selectRandomLyric(lyricLines, hangmanOptions);
    if (!selection) return null;

    const originalPlaybackStartSec = selection.startTime;
    const originalPlaybackStopSec = selection.targetLine.time;
    const mediaStartSec = Math.max(0, originalPlaybackStartSec - CLIP_BUFFER_BEFORE_SEC);
    const mediaEndSec = Math.min(duration, originalPlaybackStopSec + resultsTailSec);
    const playbackStartSec = Math.max(0, originalPlaybackStartSec - mediaStartSec);
    const playbackStopSec = Math.max(playbackStartSec, originalPlaybackStopSec - mediaStartSec);
    const clipDurationSec = Math.max(0, mediaEndSec - mediaStartSec);

    const lyricLinesShifted = shiftLyricLines(lyricLines, mediaStartSec, mediaEndSec);
    const clipLyricLines = lyricLinesShifted.filter(
      line => line.time >= playbackStartSec && line.time < playbackStopSec
    );

    // Include the active line at the playback start so we don't start
    // mid-line without showing it.
    const leadingLine = lyricLinesShifted
      .slice()
      .reverse()
      .find(line => line.time <= playbackStartSec);

    if (leadingLine && leadingLine.time < playbackStartSec) {
      clipLyricLines.unshift(leadingLine);
    }

    console.log(
      `🎯 [finish-lyrics] ${metadata.artist} - ${metadata.title} | ` +
      `target=${selection.targetLine.time.toFixed(1)}s start=${originalPlaybackStartSec.toFixed(1)}s | ` +
      `clip=${mediaStartSec.toFixed(1)}-${mediaEndSec.toFixed(1)}s | ` +
      `playback=${playbackStartSec.toFixed(1)}-${playbackStopSec.toFixed(1)}s`
    );

    return {
      clipStartSec: mediaStartSec,
      clipEndSec: mediaEndSec,
      mediaStartSec,
      mediaEndSec,
      playbackStartSec,
      playbackStopSec,
      targetLyric: selection.targetLine.text,
      targetLyricDisplay: toHangmanFormat(selection.targetLine.text, hangmanOptions),
      clipLyricLines,
      lyricLinesShifted,
      clipDurationSec,
    };
  }

  if (gameMode === 'guess-song-easy') {
    const clipDuration = settings.clipDuration || 15;
    const randomStart = settings.randomStart !== false;
    const snippet = getRandomSnippet(clipDuration, duration, randomStart, lyricLines);

    const originalPlaybackStartSec = snippet.startTime;
    const originalPlaybackStopSec = snippet.startTime + snippet.duration;
    const mediaStartSec = Math.max(0, originalPlaybackStartSec - CLIP_BUFFER_BEFORE_SEC);
    const mediaEndSec = Math.min(duration, originalPlaybackStopSec + resultsTailSec);
    const playbackStartSec = Math.max(0, originalPlaybackStartSec - mediaStartSec);
    const clipDurationSec = Math.max(0, mediaEndSec - mediaStartSec);
    const lyricLinesShifted = shiftLyricLines(lyricLines, mediaStartSec, mediaEndSec);

    console.log(
      `🎯 [guess-easy] ${metadata.artist} - ${metadata.title} | ` +
      `start=${originalPlaybackStartSec.toFixed(1)}s dur=${snippet.duration.toFixed(1)}s | ` +
      `clip=${mediaStartSec.toFixed(1)}-${mediaEndSec.toFixed(1)}s`
    );

    const { cleanTitle, featuredArtists } = extractFeaturedArtistsFromTitle(metadata.title);
    const artists = mergeArtists(splitArtists(metadata.artist), featuredArtists);
    const hangmanOptions = getHangmanOptionsFromSettings(settings);

    return {
      clipStartSec: mediaStartSec,
      clipEndSec: mediaEndSec,
      mediaStartSec,
      mediaEndSec,
      playbackStartSec,
      playbackDurationSec: snippet.duration,
      hangman: formatGuessHangman(cleanTitle, artists, hangmanOptions),
      lyricLinesShifted,
      clipDurationSec,
    };
  }

  if (gameMode === 'guess-song-challenge') {
    const { startTime: originalPlaybackStartSec, clips } = getChallengeClips(duration, lyricLines);
    const maxChallengeDuration = Math.max(...clips);
    const originalPlaybackStopSec = originalPlaybackStartSec + maxChallengeDuration;
    const mediaStartSec = Math.max(0, originalPlaybackStartSec - CLIP_BUFFER_BEFORE_SEC);
    const mediaEndSec = Math.min(duration, originalPlaybackStopSec + resultsTailSec);
    const playbackStartSec = Math.max(0, originalPlaybackStartSec - mediaStartSec);
    const clipDurationSec = Math.max(0, mediaEndSec - mediaStartSec);
    const lyricLinesShifted = shiftLyricLines(lyricLines, mediaStartSec, mediaEndSec);

    console.log(
      `🎯 [guess-challenge] ${metadata.artist} - ${metadata.title} | ` +
      `start=${originalPlaybackStartSec.toFixed(1)}s clips=${clips.join(',')} | ` +
      `clip=${mediaStartSec.toFixed(1)}-${mediaEndSec.toFixed(1)}s`
    );

    const { cleanTitle, featuredArtists } = extractFeaturedArtistsFromTitle(metadata.title);
    const artists = mergeArtists(splitArtists(metadata.artist), featuredArtists);
    const hangmanOptions = getHangmanOptionsFromSettings(settings);

    return {
      clipStartSec: mediaStartSec,
      clipEndSec: mediaEndSec,
      mediaStartSec,
      mediaEndSec,
      playbackStartSec,
      hangman: formatGuessHangman(cleanTitle, artists, hangmanOptions),
      challengeClips: clips,
      lyricLinesShifted,
      clipDurationSec,
    };
  }

  return null;
}

/**
 * Get the next ready song
 */
export async function getNextSong(
  roomCode: string
): Promise<{ songId: string; index: number; metadata: PreparedSongMetadata; clip: PrecomputedClip } | null> {
  const queue = queues.get(roomCode);
  if (!queue) return null;

  advancePastFailedSongs(queue);

  // Find next ready song
  for (let i = queue.currentIndex; i < queue.songs.length; i++) {
    const song = queue.songs[i];

    if (song.status === 'ready' && song.songId && song.metadata && song.clip) {
      queue.currentIndex = i;
      return { songId: song.songId, index: i, metadata: song.metadata, clip: song.clip };
    } else if (song.status === 'failed') {
      // Skip failed songs so the game can continue.
      queue.currentIndex = i + 1;
      downloadAhead(roomCode);
      continue;
    } else if (song.status === 'downloading') {
      // Wait for current download
      return null;
    } else if (song.status === 'pending') {
      // Start/continue downloading buffer work.
      downloadAhead(roomCode);
      return null;
    }
  }

  return null;
}

/**
 * Skip any failed songs at the head of the queue.
 */
export function skipFailedSongs(roomCode: string): { skipped: number; hasNext: boolean } {
  const queue = queues.get(roomCode);
  if (!queue) return { skipped: 0, hasNext: false };

  const skipped = advancePastFailedSongs(queue);
  if (skipped > 0) {
    console.log(`⏭️ Skipped ${skipped} failed song(s) for room ${roomCode}`);
    downloadAhead(roomCode);
  }

  return {
    skipped,
    hasNext: queue.currentIndex < queue.songs.length,
  };
}

/**
 * Mark a specific queued song as failed so the game can skip it.
 */
export function markSongFailed(roomCode: string, index: number, reason: string) {
  const queue = queues.get(roomCode);
  if (!queue) return;

  const song = queue.songs[index];
  if (!song) return;

  song.status = 'failed';
  song.error = reason;

  if (queue.currentIndex === index) {
    queue.currentIndex = index + 1;
  }

  console.log(`⏭️ Marked song ${index + 1} as failed for room ${roomCode}: ${reason}`);
  downloadAhead(roomCode);
}

/**
 * Returns true if there are no remaining non-failed songs.
 */
export function isQueueExhausted(roomCode: string): boolean {
  const queue = queues.get(roomCode);
  if (!queue) return true;

  advancePastFailedSongs(queue);
  if (queue.currentIndex >= queue.songs.length) return true;

  for (let i = queue.currentIndex; i < queue.songs.length; i++) {
    if (queue.songs[i].status !== 'failed') {
      return false;
    }
  }

  return true;
}

/**
 * Mark current song as used and delete it via Flask API
 */
export async function markSongUsed(roomCode: string, songId: string) {
  const queue = queues.get(roomCode);
  if (!queue) return;

  // Delete the song via Flask API
  try {
    await axios.delete(`${SONG_SERVICE_URL}/song/${songId}`);
    console.log(`🗑️  Deleted song: ${songId}`);
  } catch (err: any) {
    console.error('Error deleting song:', err.message);
  }

  // Move to next song
  queue.currentIndex++;

  // Download more songs ahead
  downloadAhead(roomCode);
}

/**
 * Get queue status
 */
export function getQueueStatus(roomCode: string) {
  const queue = queues.get(roomCode);
  if (!queue) return null;

  const total = queue.songs.length;
  const current = queue.currentIndex;
  let nextIndex = current;
  while (nextIndex < queue.songs.length && queue.songs[nextIndex].status === 'failed') {
    nextIndex += 1;
  }
  const nextSong = queue.songs[nextIndex];
  const ready = queue.songs.filter(s => s.status === 'ready').length;
  const preparing = queue.songs.filter(s => s.status === 'preparing').length;
  const downloading = queue.songs.filter(s => s.status === 'downloading').length;
  const failed = queue.songs.filter(s => s.status === 'failed').length;
  const nextProgress =
    nextSong?.status === 'ready'
      ? 1
      : Math.max(0, Math.min(1, Number(nextSong?.progress ?? 0)));
  const nextReady = Boolean(
    nextSong?.status === 'ready' && nextSong.songId && nextSong.clip
  );

  return {
    total,
    current,
    nextIndex,
    ready,
    preparing,
    downloading,
    failed,
    nextProgress,
    nextReady,
    hasNext: current < total,
  };
}

export function getQueueMeta(roomCode: string) {
  const queue = queues.get(roomCode);
  if (!queue) return null;

  return {
    total: queue.songs.length,
    gameMode: queue.gameMode,
    settings: queue.settings,
    version: queue.version,
  };
}

/**
 * Check if next song is ready
 */
export function isNextSongReady(roomCode: string): boolean {
  const queue = queues.get(roomCode);
  if (!queue) return false;

  advancePastFailedSongs(queue);

  if (queue.currentIndex >= queue.songs.length) return false;

  const nextSong = queue.songs[queue.currentIndex];
  return nextSong.status === 'ready' && !!nextSong.songId && !!nextSong.clip;
}

/**
 * Clean up queue when room ends
 */
export async function cleanupQueue(roomCode: string) {
  const queue = queues.get(roomCode);
  if (!queue) return;

  const invalidatedVersion = (queueVersions.get(roomCode) || queue.version) + 1;
  queueVersions.set(roomCode, invalidatedVersion);
  queue.version = invalidatedVersion;

  // Cancel in-flight jobs and delete all remaining songs via Flask API.
  for (const song of queue.songs) {
    if (song.jobId && (song.status === 'preparing' || song.status === 'downloading')) {
      await cancelSongJob(song.jobId);
    }
    if (song.songId && song.status === 'ready') {
      try {
        await axios.delete(`${SONG_SERVICE_URL}/song/${song.songId}`);
      } catch (err: any) {
        console.error('Error cleaning up song:', err.message);
      }
    }
  }

  queues.delete(roomCode);
  console.log(`🗑️  Cleaned up queue for room ${roomCode}`);
}
