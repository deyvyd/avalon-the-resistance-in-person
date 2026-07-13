/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Settings, X } from 'lucide-react';
import type { AvalonSettings } from '../../types';
import { APP_VERSION } from '../../constants';

export const SettingsModal = ({
  settings,
  onUpdate,
  onRestore,
  onSave,
  onClose
}: {
  settings: AvalonSettings;
  onUpdate: (s: Partial<AvalonSettings>) => void;
  onRestore: () => void;
  onSave: () => void;
  onClose: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="fixed inset-0 z-overlay-top flex items-end md:items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.9 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
        exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`relative w-full md:max-w-[480px] bg-gradient-to-br from-[#16213e] to-[#1e2d45] border-t-2 md:border-2 border-[#ffd700] shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col ${
          isMobile ? 'rounded-t-[20px] max-h-[85dvh]' : 'rounded-[15px] max-h-[90vh]'
        }`}
      >
        {/* Handle for mobile */}
        {isMobile && (
          <div className="flex justify-center py-3">
            <div className="w-10 h-1 bg-gray-500/50 rounded-full" />
          </div>
        )}

        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center border-b border-[#ffd700]/20">
          <h2 className="text-xl font-['Cinzel'] text-[#ffd700] flex items-center gap-3">
            <Settings size={24} /> {t('app.settings.title')}
          </h2>
          {!isMobile && (
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={24} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-6 space-y-8">
          {/* Áudio */}
          <section className="space-y-4">
            <h3 className="text-xs font-['Cinzel'] text-[#ffd700] tracking-[2px] uppercase border-b border-[#ffd700]/20 pb-2">
              {t('app.settings.audio')}
            </h3>

            <div className="bg-[#1e2d45]/40 border border-[#ffd700]/10 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-['Cinzel'] text-[#ffd700] flex items-center gap-2">
                  {t('app.settings.backgroundMusic')}
                </div>
                <button
                  onClick={() => onUpdate({ musicEnabled: !settings.musicEnabled })}
                  className={`w-12 h-6 rounded-full relative transition-all ${settings.musicEnabled ? 'bg-[#4169e1]/40 border border-[#4169e1]' : 'bg-[#dc143c]/10 border border-[#dc143c]'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${settings.musicEnabled ? 'right-1 bg-[#ffd700]' : 'left-1 bg-gray-500'}`} />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.musicVolume}
                  disabled={!settings.musicEnabled}
                  onChange={(e) => onUpdate({ musicVolume: parseFloat(e.target.value) })}
                  className="flex-grow accent-[#ffd700] h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                />
                <span className="text-xs font-mono w-8 text-right">{Math.round(settings.musicVolume * 100)}%</span>
              </div>
            </div>

            <div className="bg-[#1e2d45]/40 border border-[#ffd700]/10 rounded-lg p-4 space-y-3">
              <div className="font-['Cinzel'] text-[#ffd700] flex items-center gap-2">
                {t('app.settings.narrationVolume')}
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={settings.narrationVolume}
                  onChange={(e) => onUpdate({ narrationVolume: parseFloat(e.target.value) })}
                  className="flex-grow accent-[#ffd700] h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs font-mono w-8 text-right">{Math.round(settings.narrationVolume * 100)}%</span>
              </div>
            </div>

            <div className="bg-[#1e2d45]/40 border border-[#ffd700]/10 rounded-lg p-4 space-y-3">
              <div className="font-['Cinzel'] text-[#ffd700] flex items-center gap-2">
                {t('app.settings.pauseBetweenAudios')}
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={settings.pauseDuration}
                  onChange={(e) => onUpdate({ pauseDuration: parseInt(e.target.value) })}
                  className="flex-grow accent-[#ffd700] h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs font-mono w-8 text-right">{settings.pauseDuration}s</span>
              </div>
              <p className="text-[10px] text-[#9b7a4f] italic">{t('app.settings.pauseHint')}</p>
            </div>
          </section>

          {/* Interface */}
          <section className="space-y-4">
            <h3 className="text-xs font-['Cinzel'] text-[#ffd700] tracking-[2px] uppercase border-b border-[#ffd700]/20 pb-2">
              {t('app.settings.interface')}
            </h3>

            <div className="bg-[#1e2d45]/40 border border-[#ffd700]/10 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-['Cinzel'] text-[#ffd700] flex items-center gap-2">
                  {t('app.settings.keepScreenAwake')}
                </div>
                <button
                  disabled={!('wakeLock' in navigator)}
                  onClick={() => onUpdate({ keepScreenAwake: !settings.keepScreenAwake })}
                  className={`w-12 h-6 rounded-full relative transition-all ${settings.keepScreenAwake ? 'bg-[#4169e1]/40 border border-[#4169e1]' : 'bg-[#dc143c]/10 border border-[#dc143c]'} disabled:opacity-20`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${settings.keepScreenAwake ? 'right-1 bg-[#ffd700]' : 'left-1 bg-gray-500'}`} />
                </button>
              </div>
              <p className="text-[10px] text-[#9b7a4f] italic">{t('app.settings.keepScreenHint')}</p>
            </div>

            <div className="bg-[#1e2d45]/40 border border-[#ffd700]/10 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-['Cinzel'] text-[#ffd700] flex items-center gap-2">
                  {t('app.settings.confirmLeave')}
                </div>
                <button
                  onClick={() => onUpdate({ confirmOnLeave: !settings.confirmOnLeave })}
                  className={`w-12 h-6 rounded-full relative transition-all ${settings.confirmOnLeave ? 'bg-[#4169e1]/40 border border-[#4169e1]' : 'bg-[#dc143c]/10 border border-[#dc143c]'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${settings.confirmOnLeave ? 'right-1 bg-[#ffd700]' : 'left-1 bg-gray-500'}`} />
                </button>
              </div>
              <p className="text-[10px] text-[#9b7a4f] italic">{t('app.settings.confirmLeaveHint')}</p>
            </div>

            <div className="bg-[#1e2d45]/40 border border-[#ffd700]/10 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-['Cinzel'] text-[#ffd700] flex items-center gap-2">
                  {t('app.settings.language')}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => i18n.changeLanguage('pt')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${i18n.language === 'pt' ? 'bg-[#4169e1]/40 border border-[#4169e1] text-[#ffd700]' : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/30'}`}
                  >
                    🇧🇷 PT
                  </button>
                  <button
                    onClick={() => i18n.changeLanguage('en')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${i18n.language === 'en' ? 'bg-[#4169e1]/40 border border-[#4169e1] text-[#ffd700]' : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/30'}`}
                  >
                    🇺🇸 EN
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-[#9b7a4f] italic">{t('app.settings.languageHint')}</p>
            </div>
          </section>

          {/* Sobre */}
          <section className="space-y-4">
            <h3 className="text-xs font-['Cinzel'] text-[#ffd700] tracking-[2px] uppercase border-b border-[#ffd700]/20 pb-2">
              {t('app.settings.about')}
            </h3>
            <div className="text-center space-y-2">
              <p className="font-['Cinzel'] text-[#ffd700]">The Resistance: Avalon</p>
              <p className="text-[10px] text-gray-400">{t('app.settings.originalDesign')}</p>
              <p className="text-[10px] text-gray-400">{t('app.settings.appVersion', { version: APP_VERSION })}</p>
              <p className="text-[10px] text-gray-400">{t('app.settings.developedFor')}</p>
              <div className="pt-4 flex justify-center gap-4 text-xs font-bold text-[#ffd700]">
                <button onClick={() => { onClose(); /* Trigger Manual */ window.dispatchEvent(new CustomEvent('open-manual')); }} className="hover:underline">{t('app.settings.manual')}</button>
                <span className="text-gray-700">|</span>
                <button onClick={() => { onClose(); /* Trigger Guide */ window.dispatchEvent(new CustomEvent('open-guide')); }} className="hover:underline">{t('app.settings.gameGuide')}</button>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#ffd700]/20 flex gap-3 bg-[#16213e]">
          <button
            onClick={onRestore}
            className="flex-1 py-3 px-4 rounded-xl border border-[#4a5f7f] text-[#b0b0b0] font-bold text-sm transition-all hover:bg-white/5"
          >
            {t('app.settings.restoreDefaults')}
          </button>
          <button
            onClick={onSave}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-br from-[#ffd700] to-[#b8860b] text-[#1a0a2e] font-bold text-sm transition-all active:scale-95"
          >
            {t('app.settings.saveAndClose')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
