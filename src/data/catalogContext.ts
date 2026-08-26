import { createContext, useContext } from 'react';
import type { Album, Track } from './songs';

export type CatalogContextValue = {
  albums: Album[];
  songs: Track[];
  source: 'api' | 'local';
  coverFor: (track: Track) => string | undefined;
};

export const CatalogContext = createContext<CatalogContextValue | null>(null);

export const useCatalog = (): CatalogContextValue => {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
};
