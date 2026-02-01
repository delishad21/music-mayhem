import { GameMode } from '@/types/game';
import SettingsCard from '@/components/game/SettingsCard';
import PlaylistCard from '@/components/game/PlaylistCard';
import { SongItem } from '@/lib/api';

interface HostSetupPanelProps {
  mode: GameMode;
  hostError: string;
  settings: {
    roundCountdownSec: number;
    resultsDelaySec: number;
    guessClipDurationSec: number;
    lyricAnswerTimeSec: number;
    maxRounds: number;
    allowJoinInProgress: boolean;
    allowChineseVariants: boolean;
    shufflePlaylist: boolean;
    convertChineseLyrics: 'none' | 't2s' | 's2t';
    revealNumbers: boolean;
    revealKorean: boolean;
    revealJapanese: boolean;
    revealChinese: boolean;
    revealVietnamese: boolean;
    revealSpanish: boolean;
  };
  settingsHandlers: {
    onRoundCountdownChange: (value: number) => void;
    onResultsDelayChange: (value: number) => void;
    onGuessClipDurationChange: (value: number) => void;
    onLyricAnswerTimeChange: (value: number) => void;
    onMaxRoundsChange: (value: number) => void;
    onAllowJoinInProgressChange: (value: boolean) => void;
    onAllowChineseVariantsChange: (value: boolean) => void;
    onShufflePlaylistChange: (value: boolean) => void;
    onConvertChineseLyricsChange: (value: 'none' | 't2s' | 's2t') => void;
    onRevealNumbersChange: (value: boolean) => void;
    onRevealKoreanChange: (value: boolean) => void;
    onRevealJapaneseChange: (value: boolean) => void;
    onRevealChineseChange: (value: boolean) => void;
    onRevealVietnameseChange: (value: boolean) => void;
    onRevealSpanishChange: (value: boolean) => void;
  };
  playlist: SongItem[];
  playlistSource: 'spotify' | 'youtube' | 'manual';
  playlistUrl: string;
  manualSongs: string;
  isParsingPlaylist: boolean;
  isStartingGame: boolean;
  firstSongReady: boolean;
  nextSongProgress: number;
  queueLoadingCount: number;
  queueFailedCount: number;
  playlistPreparing?: boolean;
  shuffleEnabled: boolean;
  recommendedPlaylists: {
    spotify?: Array<{ name: string; url: string }>;
    youtube?: Array<{ name: string; url: string }>;
  };
  onShufflePlaylist: () => void;
  onPlaylistSourceChange: (value: 'spotify' | 'youtube' | 'manual') => void;
  onPlaylistUrlChange: (value: string) => void;
  onManualSongsChange: (value: string) => void;
  onLoadPlaylist: () => void;
  onStartGame: () => void;
  onResetPlaylist: () => void;
}

export default function HostSetupPanel({
  mode,
  hostError,
  settings,
  settingsHandlers,
  playlist,
  playlistSource,
  playlistUrl,
  manualSongs,
  isParsingPlaylist,
  isStartingGame,
  firstSongReady,
  nextSongProgress,
  queueLoadingCount,
  queueFailedCount,
  playlistPreparing,
  recommendedPlaylists,
  shuffleEnabled,
  onShufflePlaylist,
  onPlaylistSourceChange,
  onPlaylistUrlChange,
  onManualSongsChange,
  onLoadPlaylist,
  onStartGame,
  onResetPlaylist,
}: HostSetupPanelProps) {
  return (
    <div className="grid xl:grid-cols-2 gap-6 max-w-5xl mx-auto items-start">
      <SettingsCard
        mode={mode}
        roundCountdownSec={settings.roundCountdownSec}
        resultsDelaySec={settings.resultsDelaySec}
        guessClipDurationSec={settings.guessClipDurationSec}
        lyricAnswerTimeSec={settings.lyricAnswerTimeSec}
        maxRounds={settings.maxRounds}
        allowJoinInProgress={settings.allowJoinInProgress}
        allowChineseVariants={settings.allowChineseVariants}
        shufflePlaylist={settings.shufflePlaylist}
        convertChineseLyrics={settings.convertChineseLyrics}
        revealNumbers={settings.revealNumbers}
        revealKorean={settings.revealKorean}
        revealJapanese={settings.revealJapanese}
        revealChinese={settings.revealChinese}
        revealVietnamese={settings.revealVietnamese}
        revealSpanish={settings.revealSpanish}
        onRoundCountdownChange={settingsHandlers.onRoundCountdownChange}
        onResultsDelayChange={settingsHandlers.onResultsDelayChange}
        onGuessClipDurationChange={settingsHandlers.onGuessClipDurationChange}
        onLyricAnswerTimeChange={settingsHandlers.onLyricAnswerTimeChange}
        onMaxRoundsChange={settingsHandlers.onMaxRoundsChange}
        onAllowJoinInProgressChange={settingsHandlers.onAllowJoinInProgressChange}
        onAllowChineseVariantsChange={settingsHandlers.onAllowChineseVariantsChange}
        onShufflePlaylistChange={settingsHandlers.onShufflePlaylistChange}
        onConvertChineseLyricsChange={settingsHandlers.onConvertChineseLyricsChange}
        onRevealNumbersChange={settingsHandlers.onRevealNumbersChange}
        onRevealKoreanChange={settingsHandlers.onRevealKoreanChange}
        onRevealJapaneseChange={settingsHandlers.onRevealJapaneseChange}
        onRevealChineseChange={settingsHandlers.onRevealChineseChange}
        onRevealVietnameseChange={settingsHandlers.onRevealVietnameseChange}
        onRevealSpanishChange={settingsHandlers.onRevealSpanishChange}
      />
      <PlaylistCard
        playlist={playlist}
        playlistSource={playlistSource}
        playlistUrl={playlistUrl}
        manualSongs={manualSongs}
        shuffleEnabled={shuffleEnabled}
        isParsingPlaylist={isParsingPlaylist}
        isStartingGame={isStartingGame}
        firstSongReady={firstSongReady}
        nextSongProgress={nextSongProgress}
        queueLoadingCount={queueLoadingCount}
        queueFailedCount={queueFailedCount}
        playlistPreparing={playlistPreparing}
        recommendedPlaylists={recommendedPlaylists}
        onShufflePlaylist={onShufflePlaylist}
        onPlaylistSourceChange={onPlaylistSourceChange}
        onPlaylistUrlChange={onPlaylistUrlChange}
        onManualSongsChange={onManualSongsChange}
        onLoadPlaylist={onLoadPlaylist}
        onStartGame={onStartGame}
        onResetPlaylist={onResetPlaylist}
      />

      {hostError && (
        <div className="p-3 rounded-lg bg-red-500 bg-opacity-20 text-red-500 border border-red-500">
          {hostError}
        </div>
      )}
    </div>
  );
}
