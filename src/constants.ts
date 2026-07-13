import type { AvalonSettings } from './types';

export const APP_VERSION = '1.2.0';

export const DEFAULT_SETTINGS: AvalonSettings = {
  musicEnabled: true,
  musicVolume: 0.15,
  narrationVolume: 1.0,
  pauseDuration: 5,
  musicVolumeFaded: 0.15 * 0.33,
  keepScreenAwake: true,
  confirmOnLeave: true,
};
