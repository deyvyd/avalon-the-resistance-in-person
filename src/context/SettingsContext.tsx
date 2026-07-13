/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'motion/react';
import type { AvalonSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { useWakeLock } from '../hooks/useWakeLock';
import { SettingsModal } from '../App';

export const SettingsContext = createContext<{
  settings: AvalonSettings;
  updateSettings: (newSettings: Partial<AvalonSettings>) => void;
  restoreDefaults: () => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
} | null>(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AvalonSettings>(() => {
    const saved = localStorage.getItem('avalonSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validation
        if (typeof parsed.narrationVolume !== 'number' || parsed.narrationVolume < 0.5 || parsed.narrationVolume > 1.5) {
          parsed.narrationVolume = 1.0;
        }
        if (typeof parsed.musicVolume !== 'number' || parsed.musicVolume < 0 || parsed.musicVolume > 1) {
          parsed.musicVolume = 0.15;
        }
        parsed.musicVolumeFaded = parsed.musicVolume * 0.33;
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [showSettings, setShowSettings] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!musicRef.current) {
      musicRef.current = new Audio(new URL('../assets/audios/soundtrack-selection.mp3', import.meta.url).href);
      musicRef.current.loop = true;
    }

    if (settings.musicEnabled) {
      musicRef.current.volume = settings.musicVolume;
      musicRef.current.play().catch(e => console.log("Music play blocked by browser policy"));
    } else {
      musicRef.current.pause();
    }
  }, [settings.musicEnabled, settings.musicVolume]);

  const updateSettings = (newSettings: Partial<AvalonSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.musicVolume !== undefined) {
        updated.musicVolumeFaded = newSettings.musicVolume * 0.33;
      }
      return updated;
    });
  };

  const restoreDefaults = () => {
    if (window.confirm(t('app.settings.restoreConfirm'))) {
      setSettings(DEFAULT_SETTINGS);
      localStorage.setItem('avalonSettings', JSON.stringify(DEFAULT_SETTINGS));
      setShowSettings(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('avalonSettings', JSON.stringify(settings));
    setShowSettings(false);
  };

  useWakeLock(settings.keepScreenAwake);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, restoreDefaults, showSettings, setShowSettings }}>
      {children}
      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            settings={settings}
            onUpdate={updateSettings}
            onRestore={restoreDefaults}
            onSave={saveSettings}
            onClose={() => {
              // Restore from localStorage on close without saving
              const saved = localStorage.getItem('avalonSettings');
              try {
                setSettings(saved ? JSON.parse(saved) : DEFAULT_SETTINGS);
              } catch {
                setSettings(DEFAULT_SETTINGS);
              }
              setShowSettings(false);
            }}
          />
        )}
      </AnimatePresence>
    </SettingsContext.Provider>
  );
};
