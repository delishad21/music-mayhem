import { RefObject, useEffect } from 'react';
import { User } from '@/types/game';

interface UseVolumePreferenceProps {
  user: User | null;
  volume: number;
  resultsFade: number;
  audioElementRef: RefObject<HTMLAudioElement | null>;
  setVolume: (value: number) => void;
  audioUrl?: string;
}

export function useVolumePreference({
  user,
  volume,
  resultsFade,
  audioElementRef,
  setVolume,
  audioUrl,
}: UseVolumePreferenceProps) {
  useEffect(() => {
    if (!user) return;
    const key = `volume:${user.id}`;
    const saved = localStorage.getItem(key);
    const initialVolume = saved ? Math.min(1, Math.max(0, Number(saved))) : 0.7;
    setVolume(initialVolume);
  }, [user, setVolume]);

  useEffect(() => {
    if (!user || !audioElementRef.current) return;
    const key = `volume:${user.id}`;
    localStorage.setItem(key, String(volume));
    audioElementRef.current.volume = volume * resultsFade;
  }, [user, volume, resultsFade, audioElementRef, audioUrl]);
}
