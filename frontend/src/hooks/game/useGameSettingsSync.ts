import { useEffect } from 'react';
import { Room } from '@/types/game';

interface UseGameSettingsSyncProps {
  room: Room | null;
  setRoundCountdownSec: (value: number) => void;
  setResultsDelaySec: (value: number) => void;
  setGuessClipDurationSec: (value: number) => void;
  setLyricAnswerTimeSec: (value: number) => void;
  setMaxRounds: (value: number) => void;
  setAllowJoinInProgress: (value: boolean) => void;
  setAllowChineseVariants: (value: boolean) => void;
  setShufflePlaylist: (value: boolean) => void;
  setConvertChineseLyrics: (value: 'none' | 't2s' | 's2t') => void;
  setRevealNumbers: (value: boolean) => void;
  setRevealKorean: (value: boolean) => void;
  setRevealJapanese: (value: boolean) => void;
  setRevealChinese: (value: boolean) => void;
  setRevealVietnamese: (value: boolean) => void;
  setRevealSpanish: (value: boolean) => void;
}

export function useGameSettingsSync({
  room,
  setRoundCountdownSec,
  setResultsDelaySec,
  setGuessClipDurationSec,
  setLyricAnswerTimeSec,
  setMaxRounds,
  setAllowJoinInProgress,
  setAllowChineseVariants,
  setShufflePlaylist,
  setConvertChineseLyrics,
  setRevealNumbers,
  setRevealKorean,
  setRevealJapanese,
  setRevealChinese,
  setRevealVietnamese,
  setRevealSpanish,
}: UseGameSettingsSyncProps) {
  useEffect(() => {
    if (!room?.settings) return;
    const settings = room.settings;
    setRoundCountdownSec(Math.round((settings.roundCountdownMs ?? 3000) / 1000));
    setResultsDelaySec(Math.round((settings.resultsDelayMs ?? 7000) / 1000));
    setGuessClipDurationSec(settings.clipDuration ?? 15);
    setLyricAnswerTimeSec(Math.round((settings.lyricAnswerTimeMs ?? 20000) / 1000));
    setMaxRounds(settings.maxRounds ?? 0);
    setAllowJoinInProgress(settings.allowJoinInProgress !== false);
    setAllowChineseVariants(settings.allowChineseVariants !== false);
    setShufflePlaylist(settings.shufflePlaylist !== false);
    setConvertChineseLyrics(settings.convertChineseLyrics ?? 'none');
    setRevealNumbers(settings.revealNumbers === true);
    setRevealKorean(settings.revealKorean !== false);
    setRevealJapanese(settings.revealJapanese !== false);
    setRevealChinese(settings.revealChinese === true);
    setRevealVietnamese(settings.revealVietnamese !== false);
    setRevealSpanish(settings.revealSpanish !== false);
  }, [
    room?.settings,
    setRoundCountdownSec,
    setResultsDelaySec,
    setGuessClipDurationSec,
    setLyricAnswerTimeSec,
    setMaxRounds,
    setAllowJoinInProgress,
    setAllowChineseVariants,
    setShufflePlaylist,
    setConvertChineseLyrics,
    setRevealNumbers,
    setRevealKorean,
    setRevealJapanese,
    setRevealChinese,
    setRevealVietnamese,
    setRevealSpanish,
  ]);
}
