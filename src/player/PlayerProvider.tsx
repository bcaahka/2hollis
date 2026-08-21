import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { Volume } from '@capawesome/capacitor-volume';
import { SONGS } from '../data/songs';
import type { Track } from '../data/songs';
import { PlayerContext } from './context';
import type { PlayerContextValue, RepeatMode } from './context';
import {
  registerMediaActionHandlers,
  syncMediaMetadata,
  syncPlaybackState,
  syncPositionState,
} from './mediaSession';

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');

  const currentRef = useRef(current);
  currentRef.current = current;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;

  const next = useCallback(() => {
    setCurrent((prev) => {
      if (!prev) return prev;
      const idx = SONGS.findIndex((s) => s.id === prev.id);
      if (idx < 0) return prev;
      if (shuffleRef.current && SONGS.length > 1) {
        let r = idx;
        while (r === idx) r = Math.floor(Math.random() * SONGS.length);
        return SONGS[r];
      }
      return SONGS[(idx + 1) % SONGS.length];
    });
  }, []);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setProgress(0);
      return;
    }
    setCurrent((p) => {
      if (!p) return p;
      const idx = SONGS.findIndex((s) => s.id === p.id);
      if (idx < 0) return p;
      if (shuffleRef.current && SONGS.length > 1) {
        let r = idx;
        while (r === idx) r = Math.floor(Math.random() * SONGS.length);
        return SONGS[r];
      }
      return SONGS[(idx - 1 + SONGS.length) % SONGS.length];
    });
  }, []);

  const handleEndedRef = useRef<() => void>(() => undefined);
  handleEndedRef.current = () => {
    if (repeatRef.current === 'one') {
      audioRef.current?.play().catch(() => undefined);
      return;
    }
    next();
  };

  const getAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.volume = Capacitor.isNativePlatform() ? 1 : volumeRef.current;
      audio.addEventListener('timeupdate', () => setProgress(audio.currentTime));
      audio.addEventListener('loadedmetadata', () => setDuration(audio.duration || 0));
      audio.addEventListener('durationchange', () => setDuration(audio.duration || 0));
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('ended', () => handleEndedRef.current());
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  useEffect(() => {
    if (!current) return;
    const audio = getAudio();
    const track = current;
    audio.src = track.file;
    setProgress(0);
    setDuration(0);

    // WKWebView can overwrite MPNowPlayingInfoCenter when <audio> starts.
    // Re-push metadata (with artwork) after playback actually begins.
    const republishArtwork = () => {
      if (Capacitor.getPlatform() !== 'ios') return;
      void syncMediaMetadata(track).then(() => syncPlaybackState(true, true));
    };
    audio.addEventListener('playing', republishArtwork);

    audio.play().catch(() => undefined);
    return () => {
      audio.removeEventListener('playing', republishArtwork);
    };
  }, [current, getAudio]);

  const playTrack = useCallback(
    (track: Track) => {
      const audio = getAudio();
      if (currentRef.current && currentRef.current.id === track.id) {
        audio.currentTime = 0;
        setProgress(0);
        audio.play().catch(() => undefined);
        return;
      }
      setCurrent(track);
    },
    [getAudio]
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setProgress(time);
  }, []);

  const volumeScrubbingRef = useRef(false);
  const volumeTimerRef = useRef<number | null>(null);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    volumeRef.current = clamped;

    if (Capacitor.isNativePlatform()) {
      if (volumeTimerRef.current) window.clearTimeout(volumeTimerRef.current);
      volumeTimerRef.current = window.setTimeout(() => {
        Volume.setVolume({ volume: volumeRef.current }).catch(() => undefined);
      }, 40);
      return;
    }
    const audio = audioRef.current;
    if (audio) audio.volume = clamped;
  }, []);

  const setVolumeScrubbing = useCallback((active: boolean) => {
    volumeScrubbingRef.current = active;
    if (!active && Capacitor.isNativePlatform()) {
      Volume.setVolume({ volume: volumeRef.current }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let handle: PluginListenerHandle | null = null;
    Volume.getVolume()
      .then(({ volume: v }) => {
        if (!cancelled) setVolumeState(v);
      })
      .catch(() => undefined);
    Volume.startWatching().catch(() => undefined);
    Volume.addListener('volumeChange', (event) => {
      if (cancelled || volumeScrubbingRef.current) return;
      setVolumeState(event.volume);
    })
      .then((h) => {
        handle = h;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (volumeTimerRef.current) window.clearTimeout(volumeTimerRef.current);
      if (handle) handle.remove().catch(() => undefined);
      Volume.stopWatching().catch(() => undefined);
    };
  }, []);

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));
  }, []);

  useEffect(() => {
    void registerMediaActionHandlers({
      play: () => {
        audioRef.current?.play().catch(() => undefined);
      },
      pause: () => {
        audioRef.current?.pause();
      },
      previoustrack: prev,
      nexttrack: next,
      seekto: seek,
    });
  }, [next, prev, seek]);

  // Metadata first, then playback state — avoids empty artwork in the system UI.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await syncMediaMetadata(current, () => cancelled);
      if (cancelled) return;
      await syncPlaybackState(isPlaying, Boolean(current));
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [current, isPlaying]);

  const lastPositionSyncRef = useRef(0);
  useEffect(() => {
    if (!current || duration <= 0) return;
    const now = Date.now();
    const due = now - lastPositionSyncRef.current > 900;
    const nearEnd = duration - progress < 1;
    if (!due && !nearEnd && progress > 0.25) return;
    lastPositionSyncRef.current = now;
    void syncPositionState(progress, duration);
  }, [progress, duration, current]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      isPlaying,
      progress,
      duration,
      volume,
      shuffle,
      repeat,
      playTrack,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      setVolumeScrubbing,
      toggleShuffle,
      cycleRepeat,
    }),
    [
      current,
      isPlaying,
      progress,
      duration,
      volume,
      shuffle,
      repeat,
      playTrack,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      setVolumeScrubbing,
      toggleShuffle,
      cycleRepeat,
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};
