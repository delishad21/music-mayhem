import { GameMode } from "@/types/game";

interface HowToPlayCardProps {
  mode: GameMode;
  lyricAnswerTimeSec?: number;
}

export default function HowToPlayCard({
  mode,
  lyricAnswerTimeSec = 20,
}: HowToPlayCardProps) {
  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">How to Play</h3>
      <div className="text-sm space-y-2 opacity-80">
        {mode === "finish-lyrics" && (
          <>
            <p>• Listen to the 15-second clip</p>
            <p>• Complete the next lyric line</p>
            <p>• Score is based on how many words you match</p>
            <p>• You have {lyricAnswerTimeSec} seconds to answer</p>
            <p>• Lyrics are synced on a best-effort basis and may be off</p>
          </>
        )}
        {mode === "guess-song-easy" && (
          <>
            <p>• Type song name and artist</p>
            <p>• Answer while music plays</p>
            <p>• Song: 1000-200pts (speed based)</p>
            <p>• Artist: Flat 200pts bonus</p>
          </>
        )}
        {mode === "guess-song-challenge" && (
          <>
            <p>• 4 clips: 1s, 2s, 5s, 10s</p>
            <p>• Earlier guess = more points</p>
            <p>• Song: 1000-200pts</p>
            <p>• Artist: 200-50pts</p>
          </>
        )}
      </div>
    </div>
  );
}
