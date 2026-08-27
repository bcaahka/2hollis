import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { Volume } from '@capawesome/capacitor-volume';
import { useCatalog } from '../data/catalogContext';
import type { Track } from '../data/songs';
import { PlayerContext } from './context';
import type { PlayerContextValue, RepeatMode } from './context';
import {
  registerMediaActionHandlers,
  resolveArtwork,
  syncMediaMetadata,
  syncPlaybackState,
  syncPositionState,
} from './mediaSession';
import { NowPlaying, isIosNowPlaying, toPublicPath } from './nowPlaying';
import { useOffline } from './offlineContext';
import { EQ_PRESETS, clampGain, loadEqGains, normalizeGains, saveEqGains } from './eq';
import type { EqGains, EqPresetId } from './eq';
import { attachWebEq, resumeWebEq, setWebEqGains } from './webEq';

const toBase64Payload = (dataUrl: string): string =>
  dataUrl.replace(/^data:image\/\w+;base64,/, '');

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { songs, coverFor } = useCatalog();
  const { resolveUrl, download } = useOffline();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iosNative = isIosNowPlaying();
  const [current, setCurrent] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [eqGains, setEqGainsState] = useState<EqGains>(loadEqGains);

  const currentRef = useRef(current);
  currentRef.current = current;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const songsRef = useRef(songs);
  songsRef.current = songs;
  const eqGainsRef = useRef(eqGains);
  eqGainsRef.current = eqGains;

  useEffect(() => {
    if (!current) return;
    void download(current);
  }, [current, download]);

  const next = useCallback(() => {
    setCurrent((prev) => {
      if (!prev) return prev;
      const list = songsRef.current;
      const idx = list.findIndex((s) => s.id === prev.id);
      if (idx < 0) return prev;
      if (shuffleRef.current && list.length > 1) {
        let r = idx;
        while (r === idx) r = Math.floor(Math.random() * list.length);
        return list[r];
      }
      return list[(idx + 1) % list.length];
    });
  }, []);

  const restartCurrent = useCallback(() => {
    setProgress(0);
    if (iosNative) {
      void NowPlaying.seek({ time: 0 }).then(() => NowPlaying.resume()).catch(() => undefined);
      setIsPlaying(true);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => undefined);
  }, [iosNative]);

  const prev = useCallback(() => {
    if (progressRef.current > 3) {
      restartCurrent();
      return;
    }
    setCurrent((p) => {
      if (!p) return p;
      const list = songsRef.current;
      const idx = list.findIndex((s) => s.id === p.id);
      if (idx < 0) return p;
      if (shuffleRef.current && list.length > 1) {
        let r = idx;
        while (r === idx) r = Math.floor(Math.random() * list.length);
        return list[r];
      }
      return list[(idx - 1 + list.length) % list.length];
    });
  }, [restartCurrent]);

  const handleEndedRef = useRef<() => void>(() => undefined);
  handleEndedRef.current = () => {
    const dur = durationRef.current;
    const pos = progressRef.current;
    // iOS seek/stop can emit a fake "ended" in the middle of a track.
    if (dur > 2 && dur - pos > 1.25) return;
    if (repeatRef.current === 'one') {
      restartCurrent();
      return;
    }
    next();
  };

  const playNativeTrack = useCallback(async (track: Track) => {
    const cover = coverFor(track);
    let artworkBase64: string | undefined;
    if (!cover) {
      const dataUrl = await resolveArtwork(track);
      artworkBase64 = toBase64Payload(dataUrl);
    }

    const url = await resolveUrl(track);
    await NowPlaying.play({
      url: toPublicPath(url),
      title: track.title,
      artist: '2hollis',
      album: track.album,
      artworkPath: cover ? toPublicPath(cover) : undefined,
      artworkBase64,
    });
    void NowPlaying.setEq({ gains: [...eqGainsRef.current] }).catch(() => undefined);
  }, [coverFor, resolveUrl]);

  const getAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.crossOrigin = 'anonymous';
      audio.setAttribute('playsinline', 'true');
      audio.volume = Capacitor.isNativePlatform() ? 1 : volumeRef.current;
      try {
        attachWebEq(audio, eqGainsRef.current);
      } catch {
        // Web Audio EQ unavailable (autoplay / old webview)
      }
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

  const iosPlayGenRef = useRef(0);

  // iOS: native AVPlayer owns audio + Now Playing artwork.
  useEffect(() => {
    if (!iosNative) return;
    if (!current) {
      iosPlayGenRef.current += 1;
      void NowPlaying.stop().catch(() => undefined);
      setIsPlaying(false);
      setProgress(0);
      setDuration(0);
      return;
    }

    const gen = ++iosPlayGenRef.current;
    setProgress(0);
    setDuration(0);
    void playNativeTrack(current)
      .then(() => {
        if (gen !== iosPlayGenRef.current) return;
        setIsPlaying(true);
      })
      .catch(() => {
        if (gen !== iosPlayGenRef.current) return;
        setIsPlaying(false);
      });
  }, [current, iosNative, playNativeTrack]);

  // Android / web: HTMLAudioElement.
  useEffect(() => {
    if (iosNative) return;
    if (!current) return;
    let cancelled = false;
    const audio = getAudio();
    setProgress(0);
    setDuration(0);
    void resolveUrl(current).then((url) => {
      if (cancelled) return;
      audio.src = url;
      resumeWebEq();
      audio.play().catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [current, getAudio, iosNative, resolveUrl]);

  // iOS native player events.
  useEffect(() => {
    if (!iosNative) return;
    let cancelled = false;
    const handles: PluginListenerHandle[] = [];

    const add = async () => {
      handles.push(
        await NowPlaying.addListener('timeupdate', (data) => {
          if (cancelled) return;
          setProgress(data.position);
          if (data.duration > 0) setDuration(data.duration);
          setIsPlaying(data.playing);
        })
      );
      handles.push(
        await NowPlaying.addListener('playing', () => {
          if (!cancelled) setIsPlaying(true);
        })
      );
      handles.push(
        await NowPlaying.addListener('paused', () => {
          if (!cancelled) setIsPlaying(false);
        })
      );
      handles.push(
        await NowPlaying.addListener('ended', () => {
          if (!cancelled) handleEndedRef.current();
        })
      );
    };

    void add();
    return () => {
      cancelled = true;
      handles.forEach((h) => {
        void h.remove().catch(() => undefined);
      });
    };
  }, [iosNative]);

  const playTrack = useCallback(
    (track: Track) => {
      if (currentRef.current && currentRef.current.id === track.id) {
        restartCurrent();
        return;
      }
      setCurrent(track);
    },
    [restartCurrent]
  );

  const toggle = useCallback(() => {
    if (iosNative) {
      if (isPlayingRef.current) {
        void NowPlaying.pause().catch(() => undefined);
        setIsPlaying(false);
      } else {
        void NowPlaying.resume().catch(() => undefined);
        setIsPlaying(true);
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      resumeWebEq();
      audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [iosNative]);

  const seek = useCallback(
    (time: number) => {
      setProgress(time);
      if (iosNative) {
        void NowPlaying.seek({ time }).catch(() => undefined);
        return;
      }
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = time;
    },
    [iosNative]
  );

  const volumeScrubbingRef = useRef(false);
  const volumeRafRef = useRef<number | null>(null);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    volumeRef.current = clamped;

    if (Capacitor.isNativePlatform()) {
      // Coalesce to one native call per frame — avoids bridge backlog lag.
      if (volumeRafRef.current != null) return;
      volumeRafRef.current = window.requestAnimationFrame(() => {
        volumeRafRef.current = null;
        Volume.setVolume({ volume: volumeRef.current }).catch(() => undefined);
      });
      return;
    }
    const audio = audioRef.current;
    if (audio) audio.volume = clamped;
  }, []);

  const setVolumeScrubbing = useCallback((active: boolean) => {
    volumeScrubbingRef.current = active;
    if (!active && Capacitor.isNativePlatform()) {
      if (volumeRafRef.current != null) {
        window.cancelAnimationFrame(volumeRafRef.current);
        volumeRafRef.current = null;
      }
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
      if (volumeRafRef.current != null) {
        window.cancelAnimationFrame(volumeRafRef.current);
        volumeRafRef.current = null;
      }
      if (handle) handle.remove().catch(() => undefined);
      Volume.stopWatching().catch(() => undefined);
    };
  }, []);

  const applyEq = useCallback(
    (next: EqGains) => {
      const gains = normalizeGains(next);
      setEqGainsState(gains);
      eqGainsRef.current = gains;
      saveEqGains(gains);
      if (iosNative) {
        void NowPlaying.setEq({ gains: [...gains] }).catch(() => undefined);
        return;
      }
      setWebEqGains(gains);
    },
    [iosNative]
  );

  const setEqGain = useCallback(
    (index: number, value: number) => {
      const next = [...eqGainsRef.current] as EqGains;
      next[index] = clampGain(value);
      applyEq(next);
    },
    [applyEq]
  );

  const setEqPreset = useCallback(
    (id: EqPresetId) => {
      applyEq(EQ_PRESETS[id]);
    },
    [applyEq]
  );

  useEffect(() => {
    if (iosNative) {
      void NowPlaying.setEq({ gains: [...eqGainsRef.current] }).catch(() => undefined);
    }
  }, [iosNative]);

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));
  }, []);

  useEffect(() => {
    void registerMediaActionHandlers({
      play: () => {
        if (iosNative) {
          void NowPlaying.resume().catch(() => undefined);
          setIsPlaying(true);
          return;
        }
        audioRef.current?.play().catch(() => undefined);
        resumeWebEq();
      },
      pause: () => {
        if (iosNative) {
          void NowPlaying.pause().catch(() => undefined);
          setIsPlaying(false);
          return;
        }
        audioRef.current?.pause();
      },
      previoustrack: prev,
      nexttrack: next,
      seekto: seek,
    });
  }, [iosNative, next, prev, seek]);

  // Android / web media session only.
  useEffect(() => {
    if (iosNative) return;
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
  }, [current, isPlaying, iosNative]);

  const lastPositionSyncRef = useRef(0);
  useEffect(() => {
    if (iosNative) return;
    if (!current || duration <= 0) return;
    const now = Date.now();
    const due = now - lastPositionSyncRef.current > 900;
    const nearEnd = duration - progress < 1;
    if (!due && !nearEnd && progress > 0.25) return;
    lastPositionSyncRef.current = now;
    void syncPositionState(progress, duration);
  }, [progress, duration, current, iosNative]);

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
      eqGains,
      setEqGain,
      setEqPreset,
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
      eqGains,
      setEqGain,
      setEqPreset,
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};
