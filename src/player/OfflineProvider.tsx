import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Track } from '../data/songs';
import { OfflineContext } from './offlineContext';
import type { OfflineContextValue } from './offlineContext';
import {
  downloadTrack as downloadTrackFile,
  isDownloaded,
  listDownloadedIds,
  removeDownload as removeDownloadFile,
  resolvePlaybackUrl,
} from './offline';

export const OfflineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [downloaded, setDownloaded] = useState<Set<string>>(() => new Set(listDownloadedIds()));
  const [downloading, setDownloading] = useState<Set<string>>(() => new Set());
  const downloadedRef = useRef(downloaded);
  downloadedRef.current = downloaded;
  const downloadingRef = useRef(downloading);
  downloadingRef.current = downloading;

  useEffect(() => {
    let cancelled = false;
    void Promise.all(listDownloadedIds().map(async (id) => ((await isDownloaded(id)) ? id : null))).then(
      (ids) => {
        if (cancelled) return;
        setDownloaded(new Set(ids.filter((id): id is string => Boolean(id))));
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const download = useCallback(async (track: Track) => {
    if (!/^https?:\/\//i.test(track.file)) return;
    if (downloadedRef.current.has(track.id) || downloadingRef.current.has(track.id)) return;
    setDownloading((prev) => new Set(prev).add(track.id));
    try {
      await downloadTrackFile(track);
      setDownloaded((prev) => new Set(prev).add(track.id));
    } catch {
      // keep UI usable if the network or filesystem write fails
    } finally {
      setDownloading((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  }, []);

  const remove = useCallback(async (trackId: string) => {
    await removeDownloadFile(trackId);
    setDownloaded((prev) => {
      const next = new Set(prev);
      next.delete(trackId);
      return next;
    });
  }, []);

  const value = useMemo<OfflineContextValue>(
    () => ({
      downloaded,
      downloading,
      isOffline: (trackId) => downloaded.has(trackId),
      download,
      remove,
      resolveUrl: resolvePlaybackUrl,
    }),
    [downloaded, downloading, download, remove]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
};
