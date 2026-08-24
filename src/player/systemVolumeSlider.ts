import { Capacitor, registerPlugin } from '@capacitor/core';

export type SystemVolumeSliderFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface SystemVolumeSliderPlugin {
  mount(options: SystemVolumeSliderFrame): Promise<void>;
  update(options: SystemVolumeSliderFrame): Promise<void>;
  unmount(): Promise<void>;
}

export const SystemVolumeSlider = registerPlugin<SystemVolumeSliderPlugin>('SystemVolumeSlider');

export const isIosSystemVolumeSlider = (): boolean => Capacitor.getPlatform() === 'ios';
