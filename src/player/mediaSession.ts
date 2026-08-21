import { Capacitor } from '@capacitor/core';
import { MediaSession } from '@capgo/capacitor-media-session';
import { coverFor } from '../data/songs';
import type { Track } from '../data/songs';

const artworkCache = new Map<string, string>();

const toDataUrl = async (path: string): Promise<string | undefined> => {
  const cached = artworkCache.get(path);
  if (cached) return cached;
  try {
    const res = await fetch(Capacitor.convertFileSrc(path));
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    artworkCache.set(path, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
};

export const syncMediaMetadata = async (track: Track | null): Promise<void> => {
  if (!track) {
    await MediaSession.setPlaybackState({ playbackState: 'none' }).catch(() => undefined);
    return;
  }

  const cover = coverFor(track);
  const artworkSrc = cover ? await toDataUrl(cover) : undefined;

  await MediaSession.setMetadata({
    title: track.title,
    artist: '2hollis',
    album: track.album,
    artwork: artworkSrc
      ? [{ src: artworkSrc, sizes: '512x512', type: 'image/jpeg' }]
      : undefined,
  }).catch(() => undefined);
};

export const syncPlaybackState = async (isPlaying: boolean, hasTrack: boolean): Promise<void> => {
  await MediaSession.setPlaybackState({
    playbackState: !hasTrack ? 'none' : isPlaying ? 'playing' : 'paused',
  }).catch(() => undefined);
};

export const syncPositionState = async (position: number, duration: number): Promise<void> => {
  if (!Number.isFinite(duration) || duration <= 0) return;
  await MediaSession.setPositionState({
    position: Math.max(0, Math.min(position, duration)),
    duration,
    playbackRate: 1,
  }).catch(() => undefined);
};

export type MediaActionHandlers = {
  play: () => void;
  pause: () => void;
  previoustrack: () => void;
  nexttrack: () => void;
  seekto: (seekTime: number) => void;
};

export const registerMediaActionHandlers = async (handlers: MediaActionHandlers): Promise<void> => {
  await MediaSession.setActionHandler({ action: 'play' }, () => handlers.play()).catch(() => undefined);
  await MediaSession.setActionHandler({ action: 'pause' }, () => handlers.pause()).catch(() => undefined);
  await MediaSession.setActionHandler({ action: 'previoustrack' }, () => handlers.previoustrack()).catch(
    () => undefined
  );
  await MediaSession.setActionHandler({ action: 'nexttrack' }, () => handlers.nexttrack()).catch(() => undefined);
  await MediaSession.setActionHandler({ action: 'seekto' }, (details) => {
    if (details.seekTime != null) handlers.seekto(details.seekTime);
  }).catch(() => undefined);
};
