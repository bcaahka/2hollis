import { createContext, useContext } from 'react';
import type { Track } from '../data/songs';

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerContextValue {
  current: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playTrack: (track: Track) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setVolumeScrubbing: (active: boolean) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

export const PlayerContext = createContext<PlayerContextValue | null>(null);

export const usePlayer = (): PlayerContextValue => {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return ctx;
};
