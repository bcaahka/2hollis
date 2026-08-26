import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ALBUMS } from './songs';
import type { Album } from './songs';
import { coverFor as liveCoverFor, fetchCatalog, mergeCatalog, setActiveCatalog } from './catalogApi';
import { CatalogContext } from './catalogContext';
import type { CatalogContextValue } from './catalogContext';

export const CatalogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [albums, setAlbums] = useState<Album[]>(ALBUMS);
  const [source, setSource] = useState<'api' | 'local'>('local');

  useEffect(() => {
    let cancelled = false;
    void fetchCatalog().then((remote) => {
      if (cancelled || !remote) return;
      const merged = mergeCatalog(ALBUMS, remote);
      setActiveCatalog(merged);
      setAlbums(merged);
      setSource('api');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<CatalogContextValue>(
    () => ({
      albums,
      songs: albums.flatMap((album) => album.tracks),
      source,
      coverFor: liveCoverFor,
    }),
    [albums, source]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};
