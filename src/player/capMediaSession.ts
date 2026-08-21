import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import type { MediaSessionPlugin as CapgoMediaSessionPlugin } from '@capgo/capacitor-media-session';

/**
 * Capgo's published JS forces iOS onto the Web Media Session implementation.
 * The native Swift plugin (MPNowPlayingInfoCenter) exists but is unused.
 * Register without an iOS web override so lock-screen artwork works on iPhone.
 */
export type MediaSessionPlugin = CapgoMediaSessionPlugin & {
  addListener(
    eventName: 'actionHandler',
    listenerFunc: (data: { action: string; seekTime?: number | null }) => void
  ): Promise<PluginListenerHandle>;
};

export const NativeMediaSession = registerPlugin<MediaSessionPlugin>('MediaSession', {
  web: () =>
    import('@capgo/capacitor-media-session/dist/esm/web.js').then((m) => new m.MediaSessionWeb()),
});
