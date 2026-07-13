/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Info, XCircle } from 'lucide-react';

export const LancelotModal = ({
  isOpen,
  onClose,
  onConfirm,
  initialConfig
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (configKey: string) => void;
  initialConfig: string | null;
}) => {
  const { t } = useTranslation();
  const [v1, setV1] = useState(false);
  const [v2, setV2] = useState(false);
  const [v3, setV3] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setV1(initialConfig?.includes('var1') || false);
      setV2(initialConfig?.includes('var2') || false);
      setV3(initialConfig?.includes('var3') || false);
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const selectedCount = [v1, v2, v3].filter(Boolean).length;

  const getLancelotConfigKey = (var1: boolean, var2: boolean, var3: boolean): string => {
    if (!var1 && !var2 && !var3) return 'none';
    if ( var1 && !var2 && !var3) return 'var1';
    if (!var1 &&  var2 && !var3) return 'var2';
    if (!var1 && !var2 &&  var3) return 'var3';
    if ( var1 &&  var2 && !var3) return 'var1_var2';
    if ( var1 && !var2 &&  var3) return 'var1_var3';
    if (!var1 &&  var2 &&  var3) return 'var2_var3';
    return 'none';
  };

  const configKey = getLancelotConfigKey(v1, v2, v3);

  const PREVIEWS: Record<string, any> = {
    none: {
      title: t('app.lancelot.none.title'),
    },
    var1: {
      title: t('app.lancelot.var1.title'),
      preparacao: [t('app.lancelot.var1.prep0'), t('app.lancelot.var1.prep1'), t('app.lancelot.var1.prep2')],
      durante: [t('app.lancelot.var1.during0'), t('app.lancelot.var1.during1'), t('app.lancelot.var1.during2')],
      tendencia: t('app.lancelot.var1.tendency'),
      ideal: t('app.lancelot.var1.ideal')
    },
    var2: {
      title: t('app.lancelot.var2.title'),
      preparacao: [t('app.lancelot.var2.prep0'), t('app.lancelot.var2.prep1'), t('app.lancelot.var2.prep2')],
      durante: [t('app.lancelot.var2.during0'), t('app.lancelot.var2.during1'), t('app.lancelot.var2.during2')],
      tendencia: t('app.lancelot.var2.tendency'),
      ideal: t('app.lancelot.var2.ideal'),
      avisos: [t('app.lancelot.var2.warn0')]
    },
    var3: {
      title: t('app.lancelot.var3.title'),
      preparacao: [t('app.lancelot.var3.prep0'), t('app.lancelot.var3.prep1'), t('app.lancelot.var3.prep2')],
      durante: [t('app.lancelot.var3.during0'), t('app.lancelot.var3.during1')],
      tendencia: t('app.lancelot.var3.tendency'),
      ideal: t('app.lancelot.var3.ideal')
    },
    var1_var2: {
      title: t('app.lancelot.var1_var2.title'),
      preparacao: [t('app.lancelot.var1_var2.prep0'), t('app.lancelot.var1_var2.prep1'), t('app.lancelot.var1_var2.prep2')],
      durante: [t('app.lancelot.var1_var2.during0'), t('app.lancelot.var1_var2.during1'), t('app.lancelot.var1_var2.during2')],
      tendencia: t('app.lancelot.var1_var2.tendency'),
      ideal: t('app.lancelot.var1_var2.ideal')
    },
    var1_var3: {
      title: t('app.lancelot.var1_var3.title'),
      preparacao: [t('app.lancelot.var1_var3.prep0'), t('app.lancelot.var1_var3.prep1'), t('app.lancelot.var1_var3.prep2')],
      durante: [t('app.lancelot.var1_var3.during0'), t('app.lancelot.var1_var3.during1'), t('app.lancelot.var1_var3.during2')],
      tendencia: t('app.lancelot.var1_var3.tendency'),
      ideal: t('app.lancelot.var1_var3.ideal')
    },
    var2_var3: {
      title: t('app.lancelot.var2_var3.title'),
      preparacao: [t('app.lancelot.var2_var3.prep0'), t('app.lancelot.var2_var3.prep1'), t('app.lancelot.var2_var3.prep2')],
      durante: [t('app.lancelot.var2_var3.during0'), t('app.lancelot.var2_var3.during1'), t('app.lancelot.var2_var3.during2'), t('app.lancelot.var2_var3.during3')],
      tendencia: t('app.lancelot.var2_var3.tendency'),
      ideal: t('app.lancelot.var2_var3.ideal'),
      avisos: [t('app.lancelot.var2_var3.warn0')]
    }
  };

  const preview = PREVIEWS[configKey];

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0d1b2a]/95 border-2 border-[#ffd700] w-full h-full md:h-auto md:max-w-3xl md:rounded-3xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(255,215,0,0.2)]"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#ffd700]/30 flex justify-between items-center bg-[#1b263b]/50">
          <h2 className="text-2xl font-['Cinzel'] text-[#ffd700] flex items-center gap-3">
            <span className="text-3xl">🗡️</span> {t('app.lancelot.configureTitle')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <XCircle size={28} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto md:flex md:overflow-hidden">
          {/* Left: Selection */}
          <div className="p-6 space-y-4 md:w-[320px] md:border-r md:border-[#ffd700]/20 md:overflow-y-auto">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" /> {t('app.lancelot.selectVariants')}
            </h3>

            {[
              { id: 'v1', label: t('app.lancelot.variant1'), sub: t('app.lancelot.variant1Sub'), icon: '🎲', state: v1, setter: setV1 },
              { id: 'v2', label: t('app.lancelot.variant2'), sub: t('app.lancelot.variant2Sub'), icon: '📅', state: v2, setter: setV2 },
              { id: 'v3', label: t('app.lancelot.variant3'), sub: t('app.lancelot.variant3Sub'), icon: '👁️', state: v3, setter: setV3 },
            ].map((item) => {
              const disabled = !item.state && selectedCount >= 2;
              return (
                <button
                  key={item.id}
                  disabled={disabled}
                  onClick={() => item.setter(!item.state)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                    item.state
                      ? 'border-[#ffd700] bg-[#ffd700]/10 shadow-[0_0_15px_rgba(255,215,0,0.1)]'
                      : 'border-[#4a5f7f] bg-white/5'
                  } ${disabled ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:border-[#ffd700]/50'}`}
                >
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                    item.state ? 'bg-[#ffd700] border-[#ffd700]' : 'border-[#4a5f7f]'
                  }`}>
                    {item.state && <CheckCircle2 size={16} className="text-[#0d1b2a]" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{item.icon}</span>
                      <span className={`font-bold text-sm ${item.state ? 'text-[#ffd700]' : 'text-white'}`}>{item.label}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{item.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Preview */}
          <div className="p-6 bg-[#1b263b]/30 flex-grow md:overflow-y-auto">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold mb-6 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" /> {t('app.lancelot.previewCurrent')}
            </h3>

            {configKey === 'none' ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <Info size={32} className="text-gray-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-[#ffd700] font-bold uppercase tracking-widest">{t('app.lancelot.noVariantSelected')}</p>
                  <p className="text-sm text-gray-400 max-w-[240px] mx-auto">
                    {t('app.lancelot.noVariantHint')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h4 className="text-xl font-['Cinzel'] text-[#ffd700] text-center drop-shadow-[0_0_10px_rgba(255,215,0,0.2)]">
                  {preview.title}
                </h4>

                <div className="space-y-6">
                  <section className="space-y-3">
                    <h5 className="text-xs font-['Cinzel'] text-[#ffd700] flex items-center gap-2">
                      <span className="text-lg">⚙️</span> {t('app.lancelot.preparation')}
                    </h5>
                    <ul className="space-y-2 ml-2">
                      {preview.preparacao.map((item: string, i: number) => (
                        <li key={i} className="text-sm text-[#e0e0e0] flex items-start gap-2">
                          <span className="text-[#ffd700] mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="space-y-3">
                    <h5 className="text-xs font-['Cinzel'] text-[#ffd700] flex items-center gap-2">
                      <span className="text-lg">🎮</span> {t('app.lancelot.duringGame')}
                    </h5>
                    <ul className="space-y-2 ml-2">
                      {preview.durante.map((item: string, i: number) => (
                        <li key={i} className="text-sm text-[#e0e0e0] flex items-start gap-2">
                          <span className="text-[#ffd700] mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <div className="pt-6 border-t border-[#ffd700]/20 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-[#b8860b]">{t('app.lancelot.tendency')}</p>
                      <p className="text-xs font-bold text-[#ffd700]">{preview.tendencia}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-[#b8860b]">{t('app.lancelot.idealFor')}</p>
                      <p className="text-xs font-bold text-[#ffd700]">{preview.ideal}</p>
                    </div>
                  </div>

                  {preview.avisos && (
                    <div className="p-4 bg-red-500/15 border border-red-600/40 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-red-400 flex items-center gap-2">
                        <span>⚠️</span> {t('app.lancelot.warnings')}
                      </p>
                      <ul className="space-y-1">
                        {preview.avisos.map((item: string, i: number) => (
                          <li key={i} className="text-xs text-red-200/80 flex items-start gap-2">
                            <span>⚠</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#ffd700]/30 flex gap-3 bg-[#1b263b]/50">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-white/20 text-gray-400 font-bold hover:bg-white/5 transition-all"
          >
            {t('app.lancelot.cancel')}
          </button>
          <button
            disabled={configKey === 'none'}
            onClick={() => onConfirm(configKey)}
            className="flex-[1.5] py-3 px-4 rounded-xl bg-[#ffd700] text-[#0d1b2a] font-bold hover:bg-[#ffed4a] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={20} /> {t('app.lancelot.confirm')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
