import { ILyricLine } from '../models/Song';
import { RoomSettings } from '../types/game';

export interface HangmanMaskOptions {
  revealNumbers?: boolean;
  revealKorean?: boolean;
  revealJapanese?: boolean;
  revealChinese?: boolean;
  revealVietnamese?: boolean;
  revealSpanish?: boolean;
}

const DEFAULT_HANGMAN_OPTIONS: Required<HangmanMaskOptions> = {
  revealNumbers: false,
  revealKorean: true,
  revealJapanese: true,
  revealChinese: false,
  revealVietnamese: true,
  revealSpanish: true,
};

export function getHangmanOptionsFromSettings(settings?: RoomSettings): HangmanMaskOptions {
  return {
    revealNumbers: settings?.revealNumbers ?? DEFAULT_HANGMAN_OPTIONS.revealNumbers,
    revealKorean: settings?.revealKorean ?? DEFAULT_HANGMAN_OPTIONS.revealKorean,
    revealJapanese: settings?.revealJapanese ?? DEFAULT_HANGMAN_OPTIONS.revealJapanese,
    revealChinese: settings?.revealChinese ?? DEFAULT_HANGMAN_OPTIONS.revealChinese,
    revealVietnamese: settings?.revealVietnamese ?? DEFAULT_HANGMAN_OPTIONS.revealVietnamese,
    revealSpanish: settings?.revealSpanish ?? DEFAULT_HANGMAN_OPTIONS.revealSpanish,
  };
}

function isKoreanChar(char: string): boolean {
  return /[\uAC00-\uD7AF]/u.test(char);
}

function isJapaneseChar(char: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF]/u.test(char);
}

function isChineseChar(char: string): boolean {
  return /\p{Script=Han}/u.test(char);
}

function hasKana(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF]/u.test(text);
}

function isSpanishChar(char: string): boolean {
  return /[\u00C0-\u00FF]/u.test(char);
}

function isVietnameseChar(char: string): boolean {
  return /[\u0100-\u024F\u1EA0-\u1EF9]/u.test(char);
}

/**
 * Convert text to hangman format
 * Shows: letters as underscores, spaces, punctuation as-is
 * Example: "Hello, world!" -> "_____, _____!"
 */
export function toHangmanFormat(text: string, options: HangmanMaskOptions = DEFAULT_HANGMAN_OPTIONS): string {
  const resolved = { ...DEFAULT_HANGMAN_OPTIONS, ...options };
  const textHasKana = hasKana(text);

  return Array.from(text).map(char => {
    if (/[a-zA-Z]/.test(char)) {
      return '_';
    }
    if (/[0-9]/.test(char)) {
      return resolved.revealNumbers ? char : '_';
    }
    if (isKoreanChar(char)) {
      return resolved.revealKorean ? char : '_';
    }
    if (isJapaneseChar(char)) {
      return resolved.revealJapanese ? char : '_';
    }
    if (isChineseChar(char)) {
      const revealHan = textHasKana ? resolved.revealJapanese : resolved.revealChinese;
      return revealHan ? char : '_';
    }
    if (isVietnameseChar(char)) {
      return resolved.revealVietnamese ? char : '_';
    }
    if (isSpanishChar(char)) {
      return resolved.revealSpanish ? char : '_';
    }
    return char;
  }).join('');
}

function isMaskableLetter(
  char: string,
  options: Required<HangmanMaskOptions>,
  context: { hasKana: boolean }
): boolean {
  if (/[a-zA-Z]/.test(char)) {
    return true;
  }
  if (/[0-9]/.test(char)) {
    return !options.revealNumbers;
  }
  if (isKoreanChar(char)) {
    return !options.revealKorean;
  }
  if (isJapaneseChar(char)) {
    return !options.revealJapanese;
  }
  if (isChineseChar(char)) {
    return context.hasKana ? !options.revealJapanese : !options.revealChinese;
  }
  if (isVietnameseChar(char)) {
    return !options.revealVietnamese;
  }
  if (isSpanishChar(char)) {
    return !options.revealSpanish;
  }
  return false;
}

type NormalizeOptions = {
  allowChineseVariants?: boolean;
};

type ChineseConverter = (input: string) => string;

let chineseConverter: ChineseConverter | null = null;
let chineseConverterInitialized = false;
let chineseConverterReverse: ChineseConverter | null = null;
let chineseConverterReverseInitialized = false;

function getChineseConverter(): ChineseConverter | null {
  if (chineseConverterInitialized) return chineseConverter;
  chineseConverterInitialized = true;

  try {
    const candidates: any[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      candidates.push(require('opencc-js'));
    } catch {
      // ignore
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      candidates.push(require('opencc-js/dist/umd/full'));
    } catch {
      // ignore
    }

    for (const candidate of candidates) {
      const OpenCC = candidate?.OpenCC ?? candidate?.default ?? candidate;
      if (OpenCC?.Converter) {
        chineseConverter = OpenCC.Converter({ from: 'tw', to: 'cn' });
        break;
      }
      if (typeof OpenCC === 'function') {
        chineseConverter = OpenCC as ChineseConverter;
        break;
      }
    }

    if (!chineseConverter) {
      throw new Error('OpenCC converter not found in loaded module.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Chinese variant converter unavailable, skipping conversion. (${message})`);
  }

  return chineseConverter;
}

function getChineseConverterReverse(): ChineseConverter | null {
  if (chineseConverterReverseInitialized) return chineseConverterReverse;
  chineseConverterReverseInitialized = true;

  try {
    const candidates: any[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      candidates.push(require('opencc-js'));
    } catch {
      // ignore
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      candidates.push(require('opencc-js/dist/umd/full'));
    } catch {
      // ignore
    }

    for (const candidate of candidates) {
      const OpenCC = candidate?.OpenCC ?? candidate?.default ?? candidate;
      if (OpenCC?.Converter) {
        chineseConverterReverse = OpenCC.Converter({ from: 'cn', to: 'tw' });
        break;
      }
      if (typeof OpenCC === 'function') {
        chineseConverterReverse = OpenCC as ChineseConverter;
        break;
      }
    }

    if (!chineseConverterReverse) {
      throw new Error('OpenCC converter not found in loaded module.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Chinese variant converter unavailable, skipping conversion. (${message})`);
  }

  return chineseConverterReverse;
}

export function convertChineseText(
  text: string,
  mode: 'none' | 't2s' | 's2t' | undefined
): string {
  if (!text || !mode || mode === 'none') return text;

  const converter = mode === 't2s' ? getChineseConverter() : getChineseConverterReverse();
  if (!converter) return text;
  return converter(text);
}

/**
 * Normalize text for comparison (remove punctuation, lowercase, trim spaces)
 */
export function normalizeText(text: string, options?: NormalizeOptions): string {
  let normalized = text ?? '';

  if (options?.allowChineseVariants) {
    const converter = getChineseConverter();
    if (converter) {
      normalized = converter(normalized);
    }
  }

  return normalized
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove punctuation but keep letters/numbers in any language
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

export function normalizeArtistName(text: string, options?: NormalizeOptions): string {
  return normalizeText(text, options).replace(/\s+/g, '');
}

export function normalizeTitleName(text: string, options?: NormalizeOptions): string {
  return normalizeText(text, options).replace(/\s+/g, '');
}

/**
 * Check if answer matches target (ignoring punctuation and case)
 */
export function isAnswerCorrect(answer: string, target: string, options?: NormalizeOptions): boolean {
  return normalizeText(answer, options) === normalizeText(target, options);
}

export function isArtistMatch(answer: string, target: string, options?: NormalizeOptions): boolean {
  return normalizeArtistName(answer, options) === normalizeArtistName(target, options);
}

export function isTitleMatch(answer: string, target: string, options?: NormalizeOptions): boolean {
  return normalizeTitleName(answer, options) === normalizeTitleName(target, options);
}

export function extractFeaturedArtistsFromTitle(title: string): {
  cleanTitle: string;
  featuredArtists: string[];
} {
  if (!title) {
    return { cleanTitle: '', featuredArtists: [] };
  }

  const featurePattern = /(\(|\[)?\s*(feat\.?|ft\.?|featuring)\s+([^\)\]\-]+)(\)|\])?/i;
  let match = title.match(featurePattern);
  if (!match) {
    const withBracketPattern = /(\(|\[)\s*with\s+([^\)\]\-]+)(\)|\])/i;
    match = title.match(withBracketPattern);
    if (!match) {
      return { cleanTitle: title.trim(), featuredArtists: [] };
    }
  }

  const artistsPart = (match[3] || match[2] || '').trim();
  const cleanTitle = title.replace(match[0], '').replace(/\s+-\s+$/, '').trim();

  const featuredArtists = artistsPart
    .split(/\s*(?:,|&| and | x | × |\/|;)\s*/i)
    .map(artist => artist.trim())
    .filter(Boolean);

  return { cleanTitle, featuredArtists };
}

export function cleanTitleForGuess(title: string): string {
  return extractFeaturedArtistsFromTitle(title).cleanTitle;
}

export function splitArtists(artist: string): string[] {
  if (!artist) return [];
  const cleaned = artist
    .replace(/(?:feat\.?|ft\.?|featuring)\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = cleaned
    .split(/\s*(?:,|&| and | x | × |\/|;)\s*/i)
    .map(part => part.trim())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const normalized = normalizeText(part);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(part);
  }
  return unique.length ? unique : [cleaned].filter(Boolean);
}

export function mergeArtists(base: string[], extra: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  const add = (name: string) => {
    const normalized = normalizeText(name);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    merged.push(name);
  };

  base.forEach(add);
  extra.forEach(add);

  return merged;
}

export function matchArtists(
  answer: string,
  artists: string[],
  options?: NormalizeOptions
): string[] {
  const answerParts = answer
    .split(/\s*(?:,|&| and | x | × |\/|;)\s*/i)
    .map(part => part.trim())
    .filter(Boolean);

  const normalizedAnswers = new Set(answerParts.map(part => normalizeArtistName(part, options)));
  const matched: string[] = [];

  for (const artist of artists) {
    const normalizedArtist = normalizeArtistName(artist, options);
    if (!normalizedArtist) continue;
    if (normalizedAnswers.has(normalizedArtist)) {
      matched.push(artist);
    }
  }

  return matched;
}

export function formatGuessHangman(title: string, artists: string[], options?: HangmanMaskOptions): string {
  const cleanedTitle = cleanTitleForGuess(title);
  const titleLine = `Song name:\n${toHangmanFormat(cleanedTitle, options)}`;

  if (!artists.length) {
    return `${titleLine}\nArtist:\n${toHangmanFormat('', options)}`;
  }

  const artistLines = artists.map((artist, index) => (
    `Artist ${index + 1}:\n${toHangmanFormat(artist, options)}`
  ));

  return [titleLine, ...artistLines].join('\n');
}

/**
 * Calculate a similarity score (0-1) between two strings using Levenshtein distance.
 */
export function calculateSimilarityRatio(
  answer: string,
  target: string,
  options?: NormalizeOptions
): number {
  const a = normalizeText(answer, options);
  const b = normalizeText(target, options);
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  const aLen = a.length;
  const bLen = b.length;
  const maxLen = Math.max(aLen, bLen);
  if (maxLen === 0) return 1;

  const dp: number[] = new Array(bLen + 1);
  for (let j = 0; j <= bLen; j++) {
    dp[j] = j;
  }

  for (let i = 1; i <= aLen; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= bLen; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1, // deletion
        dp[j - 1] + 1, // insertion
        prev + cost // substitution
      );
      prev = temp;
    }
  }

  const distance = dp[bLen];
  return Math.max(0, Math.min(1, 1 - distance / maxLen));
}

/**
 * Convert similarity ratio to a score between 0 and maxScore.
 */
export function calculateSimilarityScore(
  answer: string,
  target: string,
  maxScore = 1000,
  options?: NormalizeOptions
): number {
  const ratio = calculateSimilarityRatio(answer, target, options);
  return Math.round(Math.max(0, Math.min(maxScore, ratio * maxScore)));
}

function tokenizeForScoring(text: string, options?: NormalizeOptions): string[] {
  const preprocessed = text.replace(/[-‐‑–—]/g, ' ');
  const normalized = normalizeText(preprocessed, options);
  if (!normalized) return [];

  const tokens: string[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer) {
      tokens.push(buffer);
      buffer = '';
    }
  };

  for (const char of normalized) {
    if (char === ' ') {
      flush();
      continue;
    }

    if (isChineseChar(char) || isKoreanChar(char) || isJapaneseChar(char)) {
      flush();
      tokens.push(char);
      continue;
    }

    buffer += char;
  }

  flush();
  return tokens;
}

export function splitNormalizedWords(text: string, options?: NormalizeOptions): string[] {
  return tokenizeForScoring(text, options);
}

export function calculateWordMatchScore(
  answer: string,
  target: string,
  maxScore = 1000,
  options?: NormalizeOptions
): { score: number; matchedWords: number; totalWords: number } {
  const answerWords = splitNormalizedWords(answer, options);
  const targetWords = splitNormalizedWords(target, options);
  const totalWords = targetWords.length;
  if (totalWords === 0) {
    return { score: 0, matchedWords: 0, totalWords: 0 };
  }

  let matchedWords = 0;
  for (let i = 0; i < totalWords; i++) {
    if (answerWords[i] && answerWords[i] === targetWords[i]) {
      matchedWords += 1;
    }
  }

  const perWord = maxScore / totalWords;
  const score = Math.round(Math.max(0, Math.min(maxScore, matchedWords * perWord)));

  return { score, matchedWords, totalWords };
}

/**
 * Calculate score based on time taken
 * @param timeTaken - Time in milliseconds
 * @param maxTime - Maximum time allowed in milliseconds
 * @param maxScore - Maximum possible score
 * @param minScore - Minimum possible score
 */
export function calculateTimeBasedScore(
  timeTaken: number,
  maxTime: number,
  maxScore: number,
  minScore: number
): number {
  if (timeTaken >= maxTime) return minScore;

  const ratio = timeTaken / maxTime;
  const score = maxScore - (maxScore - minScore) * ratio;

  return Math.round(Math.max(minScore, Math.min(maxScore, score)));
}

/**
 * Select a random lyric line for "Finish the Lyrics" mode
 * Returns the line to display and the line to guess
 */
export function selectRandomLyric(
  lyricLines: ILyricLine[],
  options: HangmanMaskOptions = DEFAULT_HANGMAN_OPTIONS
): {
  displayLine: ILyricLine;
  targetLine: ILyricLine;
  startTime: number;
} | null {
  if (lyricLines.length < 2) return null;

  const resolved = { ...DEFAULT_HANGMAN_OPTIONS, ...options };
  const candidates: Array<{
    displayLine: ILyricLine;
    targetLine: ILyricLine;
    score: number;
  }> = [];

  const maxIndex = lyricLines.length - 2;
  for (let i = 0; i <= maxIndex; i++) {
    const displayLine = lyricLines[i];
    const targetLine = lyricLines[i + 1];
    const text = targetLine.text.trim();
    if (text.length < 6) continue;

    // Skip lyrics that appear too early in the song
    // We need at least 15 seconds of playback before the target
    if (targetLine.time < 15) continue;

    const symbolCount = Array.from(text).reduce((count, char) => {
      if (!char.trim()) return count;
      return isMaskableLetter(char, resolved, { hasKana: hasKana(text) }) ? count : count + 1;
    }, 0);
    const symbolRatio = symbolCount / Math.max(1, text.length);
    if (symbolRatio > 0.2) continue;
    if (/[()\[\]{}]/.test(text)) continue;

    const gap = targetLine.time - displayLine.time;
    const gapScore = gap <= 6 ? 1 : gap <= 10 ? 0.6 : 0.2;
    const lengthScore = text.length >= 12 ? 1 : text.length >= 8 ? 0.6 : 0.3;
    const symbolScore = 1 - symbolRatio;

    const score = symbolScore * 0.6 + gapScore * 0.3 + lengthScore * 0.1;

    candidates.push({ displayLine, targetLine, score });
  }

  if (!candidates.length) {
    // Find a target that's at least 15 seconds into the song
    const validIndices = [];
    for (let i = 0; i <= maxIndex; i++) {
      if (lyricLines[i + 1].time >= 15) {
        validIndices.push(i);
      }
    }

    // If no valid targets at all, use the latest possible one
    const fallbackIndex = validIndices.length > 0
      ? validIndices[Math.floor(Math.random() * validIndices.length)]
      : maxIndex;

    const displayLine = lyricLines[fallbackIndex];
    const targetLine = lyricLines[fallbackIndex + 1];
    return {
      displayLine,
      targetLine,
      startTime: Math.max(0, targetLine.time - 15),
    };
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, Math.min(10, candidates.length));
  const pick = top[Math.floor(Math.random() * top.length)];

  return {
    displayLine: pick.displayLine,
    targetLine: pick.targetLine,
    startTime: Math.max(0, pick.targetLine.time - 15),
  };
}

/**
 * Get a random snippet from a song for "Guess the Song" mode
 */
export function getRandomSnippet(
  duration: number,
  songDuration: number,
  randomStart: boolean,
  lyricLines: ILyricLine[]
): { startTime: number; duration: number } {
  if (!randomStart || lyricLines.length === 0) {
    return { startTime: 0, duration };
  }

  // Find a good starting point that's not too close to the end
  const maxStartTime = Math.max(0, songDuration - duration - 5);

  // Try to start at the beginning of a lyric line
  const validLines = lyricLines.filter(line => line.time <= maxStartTime);

  if (validLines.length > 0) {
    const randomLine = validLines[Math.floor(Math.random() * validLines.length)];
    return { startTime: randomLine.time, duration };
  }

  // Fallback to random time
  const startTime = Math.random() * maxStartTime;
  return { startTime, duration };
}

/**
 * Get clip durations for challenge mode
 * Returns: [1s, 2s, 5s, 10s] with their start time
 */
export function getChallengeClips(
  songDuration: number,
  lyricLines: ILyricLine[]
): { startTime: number; clips: number[] } {
  const clips = [1, 2, 5, 10];

  // Pick a random 10-second segment
  const maxStartTime = Math.max(0, songDuration - 10);

  // Try to align with lyric lines
  const validLines = lyricLines.filter(line => line.time <= maxStartTime);

  let startTime: number;
  if (validLines.length > 0) {
    const randomLine = validLines[Math.floor(Math.random() * validLines.length)];
    startTime = randomLine.time;
  } else {
    startTime = Math.random() * maxStartTime;
  }

  return { startTime, clips };
}

/**
 * Generate a random room code
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
