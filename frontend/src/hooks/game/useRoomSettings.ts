import type { Socket } from 'socket.io-client';
import { Room } from '@/types/game';
import { updateSettings } from '@/hooks/useSocket';

interface UseRoomSettingsProps {
  socket: Socket | null;
  room: Room | null;
  isHost: boolean;
  setHostError: (message: string) => void;
  roundCountdownSec: number;
  setRoundCountdownSec: (value: number) => void;
  resultsDelaySec: number;
  setResultsDelaySec: (value: number) => void;
  guessClipDurationSec: number;
  setGuessClipDurationSec: (value: number) => void;
  lyricAnswerTimeSec: number;
  setLyricAnswerTimeSec: (value: number) => void;
  maxRounds: number;
  setMaxRounds: (value: number) => void;
  allowJoinInProgress: boolean;
  setAllowJoinInProgress: (value: boolean) => void;
  allowChineseVariants: boolean;
  setAllowChineseVariants: (value: boolean) => void;
  shufflePlaylist: boolean;
  setShufflePlaylist: (value: boolean) => void;
  convertChineseLyrics: 'none' | 't2s' | 's2t';
  setConvertChineseLyrics: (value: 'none' | 't2s' | 's2t') => void;
  revealNumbers: boolean;
  setRevealNumbers: (value: boolean) => void;
  revealKorean: boolean;
  setRevealKorean: (value: boolean) => void;
  revealJapanese: boolean;
  setRevealJapanese: (value: boolean) => void;
  revealChinese: boolean;
  setRevealChinese: (value: boolean) => void;
  revealVietnamese: boolean;
  setRevealVietnamese: (value: boolean) => void;
  revealSpanish: boolean;
  setRevealSpanish: (value: boolean) => void;
}

export function useRoomSettings({
  socket,
  room,
  isHost,
  setHostError,
  roundCountdownSec,
  setRoundCountdownSec,
  resultsDelaySec,
  setResultsDelaySec,
  guessClipDurationSec,
  setGuessClipDurationSec,
  lyricAnswerTimeSec,
  setLyricAnswerTimeSec,
  maxRounds,
  setMaxRounds,
  allowJoinInProgress,
  setAllowJoinInProgress,
  allowChineseVariants,
  setAllowChineseVariants,
  shufflePlaylist,
  setShufflePlaylist,
  convertChineseLyrics,
  setConvertChineseLyrics,
  revealNumbers,
  setRevealNumbers,
  revealKorean,
  setRevealKorean,
  revealJapanese,
  setRevealJapanese,
  revealChinese,
  setRevealChinese,
  revealVietnamese,
  setRevealVietnamese,
  revealSpanish,
  setRevealSpanish,
}: UseRoomSettingsProps) {
  const applySettingsPatch = (patch: Record<string, any>) => {
    if (!socket || !room || !isHost) return;
    if (room.isActive) {
      setHostError('Settings can be changed between games.');
      return;
    }
    setHostError('');
    updateSettings(socket, room.code, patch);
  };

  const settingsHandlers = {
    onRoundCountdownChange: (value: number) => {
      setRoundCountdownSec(value);
      applySettingsPatch({ roundCountdownMs: value * 1000 });
    },
    onResultsDelayChange: (value: number) => {
      setResultsDelaySec(value);
      applySettingsPatch({ resultsDelayMs: value * 1000 });
    },
    onGuessClipDurationChange: (value: number) => {
      setGuessClipDurationSec(value);
      applySettingsPatch({ clipDuration: value });
    },
    onLyricAnswerTimeChange: (value: number) => {
      setLyricAnswerTimeSec(value);
      applySettingsPatch({ lyricAnswerTimeMs: value * 1000 });
    },
    onMaxRoundsChange: (value: number) => {
      setMaxRounds(value);
      applySettingsPatch({ maxRounds: value });
    },
    onAllowJoinInProgressChange: (value: boolean) => {
      setAllowJoinInProgress(value);
      applySettingsPatch({ allowJoinInProgress: value });
    },
    onAllowChineseVariantsChange: (value: boolean) => {
      setAllowChineseVariants(value);
      applySettingsPatch({ allowChineseVariants: value });
    },
    onShufflePlaylistChange: (value: boolean) => {
      setShufflePlaylist(value);
      applySettingsPatch({ shufflePlaylist: value });
    },
    onConvertChineseLyricsChange: (value: 'none' | 't2s' | 's2t') => {
      setConvertChineseLyrics(value);
      applySettingsPatch({ convertChineseLyrics: value });
    },
    onRevealNumbersChange: (value: boolean) => {
      setRevealNumbers(value);
      applySettingsPatch({ revealNumbers: value });
    },
    onRevealKoreanChange: (value: boolean) => {
      setRevealKorean(value);
      applySettingsPatch({ revealKorean: value });
    },
    onRevealJapaneseChange: (value: boolean) => {
      setRevealJapanese(value);
      applySettingsPatch({ revealJapanese: value });
    },
    onRevealChineseChange: (value: boolean) => {
      setRevealChinese(value);
      applySettingsPatch({ revealChinese: value });
    },
    onRevealVietnameseChange: (value: boolean) => {
      setRevealVietnamese(value);
      applySettingsPatch({ revealVietnamese: value });
    },
    onRevealSpanishChange: (value: boolean) => {
      setRevealSpanish(value);
      applySettingsPatch({ revealSpanish: value });
    },
  };

  return {
    applySettingsPatch,
    settingsHandlers,
    values: {
      roundCountdownSec,
      resultsDelaySec,
      guessClipDurationSec,
      lyricAnswerTimeSec,
      maxRounds,
      allowJoinInProgress,
      allowChineseVariants,
      shufflePlaylist,
      convertChineseLyrics,
      revealNumbers,
      revealKorean,
      revealJapanese,
      revealChinese,
      revealVietnamese,
      revealSpanish,
    },
  };
}
