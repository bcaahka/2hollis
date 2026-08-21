import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface NowPlayingPlugin {
  setMetadata(options: {
    title: string;
    artist: string;
    album: string;
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
  addListener(
    eventName: 'action',
    listenerFunc: (data: { action: string; seekTime?: number }) => void
  ): Promise<PluginListenerHandle>;
}

export const NowPlaying = registerPlugin<NowPlayingPlugin>('NowPlaying');

export const isIosNowPlaying = (): boolean => Capacitor.getPlatform() === 'ios';
