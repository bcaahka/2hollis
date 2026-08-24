import { Capacitor, registerPlugin } from '@capacitor/core';

export type SystemVolumeSliderFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
  activeColor?: string;
  trackColor?: string;
  thumbColor?: string;
};

export interface SystemVolumeSliderPlugin {
  mount(options: SystemVolumeSliderFrame): Promise<void>;
  update(options: SystemVolumeSliderFrame): Promise<void>;
  unmount(): Promise<void>;
}

export const SystemVolumeSlider = registerPlugin<SystemVolumeSliderPlugin>('SystemVolumeSlider');

export const isIosSystemVolumeSlider = (): boolean => Capacitor.getPlatform() === 'ios';

export const readVolumeSliderColors = (): Pick<
  SystemVolumeSliderFrame,
  'activeColor' | 'trackColor' | 'thumbColor'
> => {
  // Read from body — dark palette overrides live on body, not :root/html.
  const styles = getComputedStyle(document.body);
  const read = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value.startsWith('#') && value.length >= 7 ? value.slice(0, 7) : fallback;
  };
  return {
    activeColor: read('--accent', '#b91c1c'),
    trackColor: read('--bar', '#d9d9d9'),
    thumbColor: read('--fg-strong', '#0d0d0d'),
  };
};
