import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Shield,
  Skull,
  Sword,
  Target,
  Droplets,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MapPinned,
  Check
} from 'lucide-react';

type TFunction = (key: string, opts?: Record<string, unknown>) => string;

type StepType = 'setup' | 'revelation' | 'mission' | 'optional' | 'assassination';

interface StepAction {
  text: string;
  subactions?: string[];
}

interface GameStep {
  type: StepType;
  badges: string[];
  title: string;
  actions?: StepAction[];
  note?: string;
  description?: string;
}

interface LancelotConfig {
  variant: string;
  recognition: boolean;
  hasSwitches: boolean;
}

const generateGameSteps = (
  t: TFunction,
  lancelots: boolean,
  lancelotConfig: LancelotConfig | null,
  excalibur: boolean,
  targeting: boolean,
  ladyOfLake: boolean
): GameStep[] => {
  const steps: GameStep[] = [];

  // ETAPA 1 — Preparação do Jogo
  steps.push({
    type: 'setup',
    badges: [t('guide.step_setup_badge')],
    title: t('guide.step_setup_title'),
    actions: [
      { text: t('guide.step_setup_a1') },
      { text: t('guide.step_setup_a2') },
      { text: t('guide.step_setup_a3') }
    ]
  });

  // ETAPA 2 — Narração Inicial
  let revelationDesc = t('guide.revelation_default');
  if (lancelots && lancelotConfig) {
    const { hasSwitches, recognition } = lancelotConfig;
    if (hasSwitches && !recognition) {
      revelationDesc = t('guide.revelation_switches_no_recognition');
    } else if (!hasSwitches && recognition) {
      revelationDesc = t('guide.revelation_no_switches_recognition');
    } else if (hasSwitches && recognition) {
      revelationDesc = t('guide.revelation_switches_recognition');
    }
  }

  steps.push({
    type: 'revelation',
    badges: [t('guide.step_revelation_badge')],
    title: t('guide.step_revelation_title'),
    description: revelationDesc
  });

  // ETAPA 3 — Troca de Lado dos Lancelots
  if (lancelots && lancelotConfig?.hasSwitches) {
    steps.push({
      type: 'optional',
      badges: [t('guide.step_lancelot_badge')],
      title: t('guide.step_lancelot_title'),
      actions: [
        {
          text: t('guide.step_lancelot_a1'),
          subactions: [
            t('guide.step_lancelot_a1_sub1'),
            t('guide.step_lancelot_a1_sub2')
          ]
        }
      ],
      note: t('guide.step_lancelot_note')
    });
  }

  // ETAPA 4 — Definição do Líder da Rodada
  steps.push({
    type: 'mission',
    badges: [t('guide.step_leader_badge')],
    title: t('guide.step_leader_title'),
    note: t('guide.step_leader_note'),
    actions: [
      { text: t('guide.step_leader_a1') }
    ]
  });

  // ETAPA 5 — Missão Alvo
  if (targeting) {
    steps.push({
      type: 'optional',
      badges: [t('guide.step_targeting_badge')],
      title: t('guide.step_targeting_title'),
      actions: [
        { text: t('guide.step_targeting_a1') },
        { text: t('guide.step_targeting_a2') },
        { text: t('guide.step_targeting_a3') }
      ],
      note: t('guide.step_targeting_note')
    });
  }

  // ETAPA 6 — Fase de Formação de Equipe
  steps.push({
    type: 'mission',
    badges: [t('guide.step_team_badge')],
    title: t('guide.step_team_title'),
    actions: [
      { text: t('guide.step_team_a1') },
      {
        text: t('guide.step_team_a2'),
        subactions: [
          t('guide.step_team_a2_sub1'),
          t('guide.step_team_a2_sub2')
        ]
      }
    ],
    note: t('guide.step_team_note')
  });

  // ETAPA 7 — Uso de Excalibur
  if (excalibur) {
    steps.push({
      type: 'optional',
      badges: [t('guide.step_excalibur_badge')],
      title: t('guide.step_excalibur_title'),
      actions: [
        { text: t('guide.step_excalibur_a1') },
        { text: t('guide.step_excalibur_a2') },
        { text: t('guide.step_excalibur_a3') },
        { text: t('guide.step_excalibur_a4') },
        { text: t('guide.step_excalibur_a5') }
      ],
      note: t('guide.step_excalibur_note')
    });
  }

  // ETAPA 8 — Fase da Missão
  steps.push({
    type: 'mission',
    badges: [t('guide.step_mission_badge')],
    title: t('guide.step_mission_title'),
    actions: [
      { text: t('guide.step_mission_a1') },
      { text: t('guide.step_mission_a2') },
      {
        text: t('guide.step_mission_a3'),
        subactions: [
          t('guide.step_mission_a3_sub1'),
          t('guide.step_mission_a3_sub2')
        ]
      },
      { text: t('guide.step_mission_a4') }
    ],
    note: t('guide.step_mission_note')
  });

  // ETAPA 9 — Dama do Lago
  if (ladyOfLake) {
    steps.push({
      type: 'optional',
      badges: [t('guide.step_lady_badge')],
      title: t('guide.step_lady_title'),
      actions: [
        { text: t('guide.step_lady_a1') },
        { text: t('guide.step_lady_a2') },
        { text: t('guide.step_lady_a3') },
        { text: t('guide.step_lady_a4') },
        { text: t('guide.step_lady_a5') }
      ],
      note: t('guide.step_lady_note')
    });
  }

  // ETAPA 10 — Próxima Rodada
  steps.push({
    type: 'mission',
    badges: [t('guide.step_next_badge')],
    title: t('guide.step_next_title'),
    actions: [
      { text: t('guide.step_next_a1') },
      { text: t('guide.step_next_a2') }
    ]
  });

  // ETAPA 11 — Tentativa de Assassinato
  steps.push({
    type: 'assassination',
    badges: [t('guide.step_assassination_badge')],
    title: t('guide.step_assassination_title'),
    actions: [
      { text: t('guide.step_assassination_a1') },
      { text: t('guide.step_assassination_a2') },
      {
        text: t('guide.step_assassination_a3'),
        subactions: [
          t('guide.step_assassination_a3_sub1'),
          t('guide.step_assassination_a3_sub2')
        ]
      }
    ],
    note: t('guide.step_assassination_note')
  });

  return steps;
};

const StepCard = ({ step, index, total }: { step: GameStep; index: number; total: number; key?: any }) => {
  const typeColors = {
    setup: { border: '#4169e1', badgeText: '#82a1fd', badgeBg: 'rgba(65,105,225,0.2)', badgeBorder: '#4169e1' },
    revelation: { border: '#9370db', badgeText: '#c08fff', badgeBg: 'rgba(138,43,226,0.2)', badgeBorder: '#9370db' },
    mission: { border: '#ff9500', badgeText: '#ffb84d', badgeBg: 'rgba(255,165,0,0.2)', badgeBorder: '#ff9500' },
    optional: { border: '#0099ff', badgeText: '#33ccff', badgeBg: 'rgba(0,195,255,0.2)', badgeBorder: '#0099ff' },
    assassination: { border: '#dc143c', badgeText: '#ff6282', badgeBg: 'rgba(220,20,60,0.2)', badgeBorder: '#dc143c' }
  };

  const colors = typeColors[step.type];

  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="game-step w-full p-4 rounded-xl border-l-4 bg-white/5 shadow-lg flex flex-col gap-4 relative overflow-hidden group transition-all duration-300 hover:translate-x-1 hover:shadow-[0_4px_12px_rgba(255,215,0,0.2)]"
      style={{
        borderLeftColor: colors.border,
        background: step.type === 'optional' ? 'linear-gradient(145deg, rgba(0,195,255,0.05), rgba(0,195,255,0.02))' : undefined
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full font-bold text-lg shadow-inner min-w-[40px] h-[40px]"
            style={{
              background: 'linear-gradient(145deg, #ffd700, #b8860b)',
              color: '#1a0a2e',
              fontFamily: '"Cinzel", serif'
            }}
          >
            {index + 1}
          </div>
          <h3 className="text-lg font-bold tracking-tight text-[#ffd700] font-['Cinzel']">
            {step.title}
          </h3>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          {step.badges.map(badge => (
            <span
              key={badge}
              className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border"
              style={{
                color: colors.badgeText,
                backgroundColor: colors.badgeBg,
                borderColor: colors.badgeBorder
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3 text-[#e0e0e0] font-['Lato']">
        {step.description && (
          <p className="text-sm leading-relaxed">{step.description}</p>
        )}

        {step.actions && (
          <div className="space-y-2">
            {step.actions.map((action, i) => (
              <div key={i} className="space-y-1">
                <div className="flex gap-2">
                  {step.actions!.length > 1 && (
                    <span className="font-bold text-[#ffd700]">{i + 1}.</span>
                  )}
                  <p className="text-sm leading-relaxed">{action.text}</p>
                </div>
                {action.subactions && (
                  <ul className="pl-8 space-y-1">
                    {action.subactions.map((sub, j) => (
                      <li key={j} className="text-xs flex gap-2 items-start">
                        <span className="text-[#ffd700] mt-1">•</span>
                        <span className="opacity-80">{sub}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {step.note && (
          <div
            className="p-3 rounded-md border-l-4 italic flex gap-3 items-start"
            style={{
              borderLeftColor: colors.border,
              backgroundColor: `rgba(${parseInt(colors.border.slice(1,3), 16)}, ${parseInt(colors.border.slice(3,5), 16)}, ${parseInt(colors.border.slice(5,7), 16)}, 0.1)`
            }}
          >
            <Info size={16} className="shrink-0 mt-0.5" style={{ color: colors.border }} />
            <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: colors.border }}>
              {step.note}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const VictoryConditions = () => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* GOOD */}
      <div
        className="victory-group p-5 rounded-2xl border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_5px_15px_rgba(0,0,0,0.3)]"
        style={{
          borderColor: '#4169e1',
          backgroundColor: 'rgba(65,105,225,0.15)'
        }}
      >
        <h3 className="text-xl font-bold mb-6 text-[#82a1fd] font-['Cinzel'] flex items-center gap-2">
          <Shield size={24} /> {t('guide.goodWinsIf')}
        </h3>

        <div className="space-y-6">
          <div className="victory-condition flex gap-4 p-2 rounded-lg transition-all duration-300 hover:bg-white/5 hover:translate-x-1">
            <span className="text-3xl">😄</span>
            <div>
              <p className="font-bold text-[#e0e0e0]">{t('guide.good_condition1')}</p>
              <p className="text-xs text-[#b0b0b0]">{t('guide.good_condition1_sub')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-[1px] flex-1 bg-[#4169e1]/30" />
            <span className="font-['Cinzel'] text-[#4169e1] text-sm font-bold">{t('guide.good_and')}</span>
            <div className="h-[1px] flex-1 bg-[#4169e1]/30" />
          </div>

          <div className="victory-condition flex gap-4 p-2 rounded-lg transition-all duration-300 hover:bg-white/5 hover:translate-x-1">
            <span className="text-3xl">🧙🏻‍♂️</span>
            <div>
              <p className="font-bold text-[#e0e0e0]">{t('guide.good_condition2')}</p>
              <p className="text-xs text-[#b0b0b0]">{t('guide.good_condition2_sub')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* EVIL */}
      <div
        className="victory-group p-5 rounded-2xl border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_5px_15px_rgba(0,0,0,0.3)]"
        style={{
          borderColor: '#dc143c',
          backgroundColor: 'rgba(220,20,60,0.15)'
        }}
      >
        <h3 className="text-xl font-bold mb-6 text-[#ff6282] font-['Cinzel'] flex items-center gap-2">
          <Skull size={24} /> {t('guide.evilWinsIf')}
        </h3>

        <div className="space-y-6">
          <div className="victory-condition flex gap-4 p-2 rounded-lg transition-all duration-300 hover:bg-white/5 hover:translate-x-1">
            <span className="text-3xl">😈</span>
            <div>
              <p className="font-bold text-[#e0e0e0]">{t('guide.evil_condition1')}</p>
              <p className="text-xs text-[#b0b0b0]">{t('guide.evil_condition1_sub')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-[1px] flex-1 bg-[#dc143c]/30" />
            <span className="font-['Cinzel'] text-[#dc143c] text-sm font-bold">{t('guide.evil_or')}</span>
            <div className="h-[1px] flex-1 bg-[#dc143c]/30" />
          </div>

          <div className="victory-condition flex gap-4 p-2 rounded-lg transition-all duration-300 hover:bg-white/5 hover:translate-x-1">
            <span className="text-3xl">🤯</span>
            <div>
              <p className="font-bold text-[#e0e0e0]">{t('guide.evil_condition2')}</p>
              <p className="text-xs text-[#b0b0b0]">{t('guide.evil_condition2_sub')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-[1px] flex-1 bg-[#dc143c]/30" />
            <span className="font-['Cinzel'] text-[#dc143c] text-sm font-bold">{t('guide.evil_or')}</span>
            <div className="h-[1px] flex-1 bg-[#dc143c]/30" />
          </div>

          <div className="victory-condition flex gap-4 p-2 rounded-lg transition-all duration-300 hover:bg-white/5 hover:translate-x-1">
            <span className="text-3xl">💀</span>
            <div>
              <p className="font-bold text-[#e0e0e0]">{t('guide.evil_condition3')}</p>
              <p className="text-xs text-[#b0b0b0]">{t('guide.evil_condition3_sub')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GameGuide = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { t } = useTranslation();
  const [lancelots, setLancelots] = useState(false);
  const [lancelotVariants, setLancelotVariants] = useState<string[]>([]);
  const [excalibur, setExcalibur] = useState(false);
  const [targeting, setTargeting] = useState(false);
  const [ladyOfLake, setLadyOfLake] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const toggleLancelotVariant = (variant: string) => {
    setLancelotVariants(prev => {
      if (prev.includes(variant)) {
        return prev.filter(v => v !== variant);
      }
      if (prev.length >= 2) return prev;

      // Validation logic for combinations
      const next = [...prev, variant];
      const hasVar1 = next.includes('var1');
      const hasVar2 = next.includes('var2');
      const hasVar3 = next.includes('var3');

      if (hasVar1 && hasVar2 && hasVar3) return prev;
      return next;
    });
  };

  const getLancelotConfig = (): LancelotConfig | null => {
    if (!lancelots || lancelotVariants.length === 0) return null;

    const variant = lancelotVariants.sort().join('_');
    const hasSwitches = lancelotVariants.some(v => v === 'var1' || v === 'var2');
    const recognition = lancelotVariants.includes('var3');

    return { variant, recognition, hasSwitches };
  };

  const steps = generateGameSteps(
    t as TFunction,
    lancelots && lancelotVariants.length > 0,
    getLancelotConfig(),
    excalibur,
    targeting,
    ladyOfLake
  );

  useEffect(() => {
    setCurrentStep(0);
  }, [lancelots, lancelotVariants, excalibur, targeting, ladyOfLake]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full h-full md:h-auto md:max-h-[85vh] md:max-w-[900px] bg-[#0d1b2a] md:rounded-3xl border border-[#4a5f7f] flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="p-4 border-b border-[#4a5f7f] flex items-center justify-between bg-white/5">
            <h2 className="text-xl font-bold text-[#ffd700] font-['Cinzel'] flex items-center gap-2">
              <MapPinned size={24} /> {t('guide.title')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-[#ffd700]"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-10 custom-scrollbar">

            {/* Toggles Section */}
            <section className="space-y-4">
              <h3 className="text-xs uppercase tracking-widest text-[#b8956a] font-bold border-b border-[#4a5f7f] pb-2">
                {t('guide.optionalRules')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Lancelots */}
                <div className="space-y-3">
                  <button
                    onClick={() => setLancelots(!lancelots)}
                    className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 h-fit ${
                      lancelots ? 'border-[#ffd700] bg-[#ffd700]/10' : 'border-white/5 bg-[#1b263b] opacity-60'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${lancelots ? 'bg-[#ffd700]/20 text-[#ffd700]' : 'bg-white/5 text-gray-500'}`}>
                      <RefreshCw size={24} />
                    </div>
                    <div className="text-left flex-1">
                      <span className="font-['Cinzel'] font-bold text-sm block">{t('guide.lancelots_label')}</span>
                      <p className="text-[10px] text-gray-400">{t('guide.lancelots_desc')}</p>
                    </div>
                    {lancelots && <CheckCircle2 size={16} className="text-[#ffd700]" />}
                  </button>

                  <AnimatePresence>
                    {lancelots && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pl-2 space-y-2 overflow-hidden"
                      >
                        <div className="grid grid-cols-1 gap-2">
                          {(['var1', 'var2', 'var3'] as const).map((v, i) => {
                            const isSelected = lancelotVariants.includes(v);
                            const isMaxed = lancelotVariants.length >= 2 && !isSelected;
                            const varName = v === 'var1' ? t('guide.var1_name') : v === 'var2' ? t('guide.var2_name') : t('guide.var3_name');
                            return (
                              <button
                                key={v}
                                onClick={() => toggleLancelotVariant(v)}
                                disabled={isMaxed}
                                className={`w-full p-2 rounded-lg border transition-all flex items-center gap-3 text-left ${
                                  isSelected
                                    ? 'border-[#ffd700] bg-[#ffd700]/10 text-[#ffd700]'
                                    : isMaxed
                                      ? 'border-white/5 bg-white/5 opacity-20 cursor-not-allowed'
                                      : 'border-white/10 bg-white/5 text-[#b0b0b0] hover:bg-white/10'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[#ffd700] border-[#ffd700]' : 'border-white/30'}`}>
                                  {isSelected && <Check size={12} className="text-[#0d1b2a]" />}
                                </div>
                                <div className="flex-1">
                                  <span className="text-[10px] font-bold block">{t('guide.variant', { n: i + 1 })}</span>
                                  <span className="text-[9px] opacity-70">{varName}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {lancelotVariants.length === 0 && (
                          <p className="text-[10px] text-[#dc143c] italic mt-1">
                            {t('guide.selectVariant')}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Excalibur */}
                <button
                  onClick={() => setExcalibur(!excalibur)}
                  className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 h-fit ${
                    excalibur ? 'border-[#ffd700] bg-[#ffd700]/10' : 'border-white/5 bg-[#1b263b] opacity-60'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${excalibur ? 'bg-[#ffd700]/20 text-[#ffd700]' : 'bg-white/5 text-gray-500'}`}>
                    <Sword size={24} />
                  </div>
                  <div className="text-left flex-1">
                    <span className="font-['Cinzel'] font-bold text-sm block">{t('guide.excalibur_label')}</span>
                    <p className="text-[10px] text-gray-400">{t('guide.excalibur_desc')}</p>
                  </div>
                  {excalibur && <CheckCircle2 size={16} className="text-[#ffd700]" />}
                </button>

                {/* Missão Alvo */}
                <button
                  onClick={() => setTargeting(!targeting)}
                  className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 h-fit ${
                    targeting ? 'border-[#ffd700] bg-[#ffd700]/10' : 'border-white/5 bg-[#1b263b] opacity-60'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${targeting ? 'bg-[#ffd700]/20 text-[#ffd700]' : 'bg-white/5 text-gray-500'}`}>
                    <Target size={24} />
                  </div>
                  <div className="text-left flex-1">
                    <span className="font-['Cinzel'] font-bold text-sm block">{t('guide.targeting_label')}</span>
                    <p className="text-[10px] text-gray-400">{t('guide.targeting_desc')}</p>
                  </div>
                  {targeting && <CheckCircle2 size={16} className="text-[#ffd700]" />}
                </button>

                {/* Dama do Lago */}
                <button
                  onClick={() => setLadyOfLake(!ladyOfLake)}
                  className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 h-fit ${
                    ladyOfLake ? 'border-[#ffd700] bg-[#ffd700]/10' : 'border-white/5 bg-[#1b263b] opacity-60'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${ladyOfLake ? 'bg-[#ffd700]/20 text-[#ffd700]' : 'bg-white/5 text-gray-500'}`}>
                    <Droplets size={24} />
                  </div>
                  <div className="text-left flex-1">
                    <span className="font-['Cinzel'] font-bold text-sm block">{t('guide.ladyoflake_label')}</span>
                    <p className="text-[10px] text-gray-400">{t('guide.ladyoflake_desc')}</p>
                  </div>
                  {ladyOfLake && <CheckCircle2 size={16} className="text-[#ffd700]" />}
                </button>
              </div>
            </section>

            {/* Steps Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#4a5f7f] pb-2">
                <h3 className="text-xs uppercase tracking-widest text-[#b8956a] font-bold">
                  {t('guide.gameSteps')}
                </h3>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#b0b0b0] font-bold">
                    {t('guide.stepCounter', { current: currentStep + 1, total: steps.length })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={currentStep === 0}
                      onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                      className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-[#ffd700]"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      disabled={currentStep === steps.length - 1}
                      onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
                      className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-[#ffd700]"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-[300px] flex items-start justify-center">
                <AnimatePresence mode="wait">
                  <StepCard
                    key={currentStep}
                    step={steps[currentStep]}
                    index={currentStep}
                    total={steps.length}
                  />
                </AnimatePresence>
              </div>
            </section>

            {/* Victory Conditions Section */}
            <section className="space-y-6">
              <h3 className="text-xs uppercase tracking-widest text-[#b8956a] font-bold border-b border-[#4a5f7f] pb-2">
                {t('guide.victoryConditions')}
              </h3>
              <VictoryConditions />
            </section>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
