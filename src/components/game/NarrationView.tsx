/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  SkipForward
} from 'lucide-react';
import { generateNarrationSequence, shouldPauseAfter, Roles } from '../../core/avalon';
import type { Room } from '../../types';
import { useSocket } from '../../context/SocketContext';
import { useSettings } from '../../context/SettingsContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export const NarrationView = ({ room, isHost }: { room: Room; isHost: boolean }) => {
  const { t } = useTranslation();
  const socket = useSocket();
  const { settings, showSettings } = useSettings();
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (showSettings) {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPaused(true);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    }
  }, [showSettings]);

  const roles: Roles = {
    merlin: true,
    assassin: true,
    percival: room.selectedRoles.includes('percival'),
    morgana: room.selectedRoles.includes('morgana'),
    mordred: room.selectedRoles.includes('mordred'),
    oberon: room.selectedRoles.includes('oberon'),
    lancelotGood: room.selectedRoles.includes('lancelot_good'),
    lancelotEvil: room.selectedRoles.includes('lancelot_evil'),
  };

  const sequence = generateNarrationSequence(roles, room.lancelotConfig, room.players.length);
  
  const narrationTexts: Record<string, string> = {
    '1': t('narration.1'),
    '2': t('narration.2'),
    '3': t('narration.3'),
    '3-lancelot': t('narration.3-lancelot'),
    '4': t('narration.4'),
    '4-oberon': t('narration.4-oberon'),
    '4-lancelot': t('narration.4-lancelot'),
    '4-oberon-lancelot': t('narration.4-oberon-lancelot'),
    '5': t('narration.5'),
    '5-mordred': t('narration.5-mordred'),
    '5-lancelot': t('narration.5-lancelot'),
    '5-mordred-lancelot': t('narration.5-mordred-lancelot'),
    '6': t('narration.6'),
    '7': t('narration.7'),
    '8': t('narration.8'),
    '8-morgana': t('narration.8-morgana'),
    '9': t('narration.9'),
    '9-morgana': t('narration.9-morgana'),
    '10': t('narration.10'),
    '11': t('narration.11'),
    '12': t('narration.12'),
    '13': t('narration.13'),
    '14': t('narration.14'),
  };

  const playStep = (index: number) => {
    if (index >= sequence.length) {
      if (isHost) {
        socket.emit('narration-ended', { roomCode: room.code });
      }
      return;
    }

    setStep(index);
    const audioFile = sequence[index];
    const audio = new Audio(new URL(`../../assets/audios/${audioFile}.mp3`, import.meta.url).href);
    // HTMLAudioElement lança IndexSizeError acima de 1.0; slider vai até 1.5 como "boost" visual
    audio.volume = Math.min(1, settings.narrationVolume);
    audioRef.current = audio;

    audio.onended = () => {
      if (shouldPauseAfter(audioFile)) {
        timerRef.current = setTimeout(() => {
          playStep(index + 1);
        }, settings.pauseDuration * 1000);
      } else {
        playStep(index + 1);
      }
    };

    audio.play().catch(e => console.error("Erro ao tocar áudio:", e));
  };

  const togglePlay = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      playStep(step);
    } else {
      if (isPaused) {
        audioRef.current?.play();
        setIsPaused(false);
      } else {
        audioRef.current?.pause();
        setIsPaused(true);
      }
    }
  };

  const restart = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setStep(0);
    setIsPlaying(false);
    setIsPaused(false);
  };

  const skip = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (step + 1 < sequence.length) {
      playStep(step + 1);
    } else {
      if (isHost) {
        socket.emit('narration-ended', { roomCode: room.code });
      }
    }
  };

  const skipAll = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (isHost) {
      socket.emit('narration-ended', { roomCode: room.code });
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12 text-center py-12">
      <div className="space-y-4">
        <div className="text-8xl animate-pulse">🌙</div>
        <h2 className="text-4xl font-['Cinzel'] text-[#ffd700]">{t('app.narrationView.nightFalls')}</h2>
      </div>

      <Card className="py-12">
        {isHost ? (
          <div className="space-y-8">
            <p className="text-2xl font-bold italic">"{narrationTexts[sequence[step]] || '...'}"</p>
            <div className="flex flex-col gap-6 items-center">
              <div className="flex justify-center gap-4">
                <Button variant="secondary" onClick={restart} className="w-auto px-4"><RotateCcw size={20} /></Button>
                <Button onClick={togglePlay} className="w-auto px-8">
                  {!isPlaying ? t('app.narrationView.startNarration') : (isPaused ? <Play /> : <Pause />)}
                </Button>
                <Button variant="secondary" onClick={skip} className="w-auto px-4" disabled={!isPlaying}><SkipForward size={20} /></Button>
              </div>
              
              {!isPlaying && (
                <button 
                  onClick={skipAll}
                  className="text-gray-400 hover:text-white text-[10px] uppercase tracking-[0.2em] font-black transition-colors flex items-center gap-2"
                >
                  <VolumeX size={14} />
                  {t('app.narrationView.skipFullNarration')}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">{t('app.narrationView.step', { current: step + 1, total: sequence.length })}</p>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <Volume2 size={16} />
              <span>{isPlaying ? t('app.narrationView.playing', { file: sequence[step] }) : t('app.narrationView.readyToStart')}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-xl text-gray-300">{t('app.narrationView.followAudioHost')}</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.4 }}
                  className="w-3 h-3 bg-[#ffd700] rounded-full"
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
};
