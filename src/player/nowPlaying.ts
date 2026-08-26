import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export type NowPlayingAction = {
  action: string;
  seekTime?: number;
};

export type NowPlayingTimeUpdate = {
  position: number;
  duration: number;
  playing: boolean;
};

export interface NowPlayingPlugin {
  play(options: {
    url: string;
    title: string;
    artist: string;
    album: string;
    artworkPath?: string;
    artworkBase64?: string;
  }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(options: { time: number }): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<{ position: number; duration: number; playing: boolean }>;
  setMetadata(options: {
    title: string;
    artist: string;
    album: string;
    artworkPath?: string;
    artworkBase64?: string;
    artworkSrc?: string;
  }): Promise<void>;
  setPlaybackState(options: { playbackState: 'none' | 'paused' | 'playing' }): Promise<void>;
  setPositionState(options: {
    duration?: number;
    position?: number;
    playbackRate?: number;
  }): Promise<void>;
  clear(): Promise<void>;
  setEq(options: { gains: number[] }): Promise<void>;
  addListener(
    eventName: 'action',
    listenerFunc: (data: NowPlayingAction) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'timeupdate',
    listenerFunc: (data: NowPlayingTimeUpdate) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playing' | 'paused' | 'ended',
    listenerFunc: () => void
  ): Promise<PluginListenerHandle>;
}

export const NowPlaying = registerPlugin<NowPlayingPlugin>('NowPlaying');

export const isIosNowPlaying = (): boolean => Capacitor.getPlatform() === 'ios';

export const toPublicPath = (path: string): string => {
  if (/^(https?:|blob:|file:|capacitor:)/i.test(path)) return path;
  return path.replace(/^\//, '');
};
