import { useState } from 'react';
import { GearSix, X } from 'phosphor-react';
import { GameMode } from '@/types/game';
import SettingsCard from '@/components/game/SettingsCard';
import PlaylistCard from '@/components/game/PlaylistCard';
import PanelHeading from '@/components/game/PanelHeading';
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="eyebrow mb-1">Host Setup</div>
          <div className="text-sm opacity-70">
            {settings.maxRounds > 0 ? `${settings.maxRounds} rounds` : 'No round cap'} · {settings.shufflePlaylist ? 'Shuffle on' : 'Shuffle off'}
          </div>
        </div>
        <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setSettingsOpen(true)}>
          <GearSix size={16} weight="duotone" />
          Settings
        </button>
      </div>

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
        <div className="rounded-[3px] border border-red-500 bg-red-500 bg-opacity-20 p-3 text-red-500">
          {hostError}
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="modal-panel max-h-[88vh] w-full max-w-3xl overflow-y-auto">
            <div className="mb-5 flex items-start justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="eyebrow mb-2">Room Settings</div>
                <PanelHeading icon={<GearSix size={16} weight="duotone" />} title="Game Setup" />
              </div>
              <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                <X size={16} weight="duotone" />
              </button>
            </div>
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
            <div className="mt-5 flex justify-end border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <button type="button" className="btn px-5 py-2 text-sm" onClick={() => setSettingsOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
