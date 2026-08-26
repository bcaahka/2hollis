import { createContext, useContext } from 'react';
import type { Track } from '../data/songs';

export type OfflineContextValue = {
  downloaded: ReadonlySet<string>;
  downloading: ReadonlySet<string>;
  isOffline: (trackId: string) => boolean;
  download: (track: Track) => Promise<void>;
  remove: (trackId: string) => Promise<void>;
  resolveUrl: (track: Track) => Promise<string>;
};

export const OfflineContext = createContext<OfflineContextValue | null>(null);

export const useOffline = (): OfflineContextValue => {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
};
