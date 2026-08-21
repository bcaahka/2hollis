import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { coverFor } from '../data/songs';
import type { Track } from '../data/songs';
import { NativeMediaSession } from './capMediaSession';
import { NowPlaying, isIosNowPlaying } from './nowPlaying';

const artworkCache = new Map<string, string>();
const ART_SIZE = 320;

const toPublicPath = (path: string): string => path.replace(/^\//, '');

const bitmapToJpeg = (source: CanvasImageSource, sw: number, sh: number): string => {
  const canvas = document.createElement('canvas');
  canvas.width = ART_SIZE;
  canvas.height = ART_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ART_SIZE, ART_SIZE);

  const scale = Math.max(ART_SIZE / sw, ART_SIZE / sh);
  const w = sw * scale;
  const h = sh * scale;
  ctx.drawImage(source, (ART_SIZE - w) / 2, (ART_SIZE - h) / 2, w, h);

  return canvas.toDataURL('image/jpeg', 0.85);
};

const fallbackArtwork = (album: string): string => {
  const key = `fallback:${album}:${ART_SIZE}`;
  const cached = artworkCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = ART_SIZE;
  canvas.height = ART_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ART_SIZE, ART_SIZE);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 72px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('2', ART_SIZE / 2, ART_SIZE / 2 - 8);
  ctx.font = '300 18px Arial, Helvetica, sans-serif';
  ctx.fillText(album.toUpperCase().slice(0, 22), ART_SIZE / 2, ART_SIZE - 28);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  artworkCache.set(key, dataUrl);
  return dataUrl;
};

const fetchCoverBlob = async (path: string): Promise<Blob | null> => {
  const candidates = [path, Capacitor.convertFileSrc(path)];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob.size > 0) return blob;
    } catch {
      // try next
    }
  }
  return null;
};

const coverToDataUrl = async (path: string): Promise<string | undefined> => {
  const key = `${path}:${ART_SIZE}`;
  const cached = artworkCache.get(key);
  if (cached) return cached;

  try {
    const blob = await fetchCoverBlob(path);
    if (!blob) return undefined;

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      try {
        const dataUrl = bitmapToJpeg(bitmap, bitmap.width, bitmap.height);
        if (!dataUrl.startsWith('data:image/')) return undefined;
        artworkCache.set(key, dataUrl);
        return dataUrl;
      } finally {
        bitmap.close();
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('img'));
        el.src = objectUrl;
      });
      const dataUrl = bitmapToJpeg(img, img.naturalWidth, img.naturalHeight);
      if (!dataUrl.startsWith('data:image/')) return undefined;
      artworkCache.set(key, dataUrl);
      return dataUrl;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return undefined;
  }
};

export const resolveArtwork = async (track: Track): Promise<string> => {
  const cover = coverFor(track);
  if (cover) {
    const fromCover = await coverToDataUrl(cover);
    if (fromCover) return fromCover;
  }
  return fallbackArtwork(track.album);
};

const toBase64Payload = (dataUrl: string): string =>
  dataUrl.replace(/^data:image\/\w+;base64,/, '');

const absoluteCoverUrl = (cover: string): string => {
  try {
    return new URL(cover, window.location.href).href;
  } catch {
    return cover;
  }
};

export const syncMediaMetadata = async (
  track: Track | null,
  isCancelled?: () => boolean
): Promise<void> => {
  if (!track) {
    if (isIosNowPlaying()) {
      await NowPlaying.clear().catch(() => undefined);
    } else {
      await NativeMediaSession.setPlaybackState({ playbackState: 'none' }).catch(() => undefined);
    }
    return;
  }

  const cover = coverFor(track);
  if (isCancelled?.()) return;

  if (isIosNowPlaying()) {
    // Prefer native bundle path — avoids large base64 over the Capacitor bridge.
    // Only generate canvas/base64 when there is no cover file (e.g. 4x4).
    let artworkBase64: string | undefined;
    if (!cover) {
      const dataUrl = await resolveArtwork(track);
      if (isCancelled?.()) return;
      artworkBase64 = toBase64Payload(dataUrl);
    }

    await NowPlaying.setMetadata({
      title: track.title,
      artist: '2hollis',
      album: track.album,
      artworkPath: cover ? toPublicPath(cover) : undefined,
      artworkSrc: cover ? absoluteCoverUrl(cover) : undefined,
      artworkBase64,
    }).catch(() => undefined);
    return;
  }

  const dataUrl = await resolveArtwork(track);
  if (isCancelled?.()) return;

  await NativeMediaSession.setMetadata({
    title: track.title,
    artist: '2hollis',
    album: track.album,
    artwork: dataUrl
      ? [{ src: dataUrl, sizes: `${ART_SIZE}x${ART_SIZE}`, type: 'image/jpeg' }]
      : undefined,
  }).catch(() => undefined);
};

export const syncPlaybackState = async (isPlaying: boolean, hasTrack: boolean): Promise<void> => {
  const playbackState = !hasTrack ? 'none' : isPlaying ? 'playing' : 'paused';
  if (isIosNowPlaying()) {
    await NowPlaying.setPlaybackState({ playbackState }).catch(() => undefined);
    return;
  }
  await NativeMediaSession.setPlaybackState({ playbackState }).catch(() => undefined);
};

export const syncPositionState = async (position: number, duration: number): Promise<void> => {
  if (!Number.isFinite(duration) || duration <= 0) return;
  const payload = {
    position: Math.max(0, Math.min(position, duration)),
    duration,
    playbackRate: 1,
  };
  if (isIosNowPlaying()) {
    await NowPlaying.setPositionState(payload).catch(() => undefined);
    return;
  }
  await NativeMediaSession.setPositionState(payload).catch(() => undefined);
};

export type MediaActionHandlers = {
  play: () => void;
  pause: () => void;
  previoustrack: () => void;
  nexttrack: () => void;
  seekto: (seekTime: number) => void;
};

let iosActionListener: PluginListenerHandle | null = null;

export const registerMediaActionHandlers = async (handlers: MediaActionHandlers): Promise<void> => {
  const run = (action: string, seekTime?: number | null) => {
    if (action === 'seekto') {
      if (seekTime != null) handlers.seekto(seekTime);
      return;
    }
    if (action === 'play') handlers.play();
    else if (action === 'pause') handlers.pause();
    else if (action === 'previoustrack') handlers.previoustrack();
    else if (action === 'nexttrack') handlers.nexttrack();
  };

  if (isIosNowPlaying()) {
    if (iosActionListener) {
      await iosActionListener.remove().catch(() => undefined);
      iosActionListener = null;
    }
    iosActionListener = await NowPlaying.addListener('action', (data) => {
      run(data.action, data.seekTime);
    });
    return;
  }

  for (const action of ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto'] as const) {
    await NativeMediaSession.setActionHandler({ action }, (details) => {
      run(details.action, details.seekTime);
    }).catch(() => undefined);
  }
};
