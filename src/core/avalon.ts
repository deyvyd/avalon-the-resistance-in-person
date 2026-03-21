/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Team = 'good' | 'evil';

export interface RoleInfo {
  id: string;
  name: string;
  team: Team;
  description: string;
  icon: string;
  sees?: string[]; // IDs of roles this role can see
  seesAsMerlin?: boolean; // If this role appears as Merlin to Percival
  seesAsEvil?: boolean; // If this role appears as Evil to Merlin
}

export const ROLES: Record<string, RoleInfo> = {
  merlin: {
    id: 'merlin',
    name: 'Merlin',
    team: 'good',
    description: 'Sabe quem são todos os servos do mal (exceto Mordred). Deve guiar o Bem sem revelar sua identidade.',
    icon: '🧙‍♂️',
  },
  assassin: {
    id: 'assassin',
    name: 'Assassino',
    team: 'evil',
    description: 'Tenta identificar e assassinar Merlin se o Bem vencer 3 missões.',
    icon: '💀',
  },
  servant: {
    id: 'servant',
    name: 'Servo de Arthur',
    team: 'good',
    description: 'Um servo leal de Arthur. Não tem poderes especiais.',
    icon: '🛡️',
  },
  minion: {
    id: 'minion',
    name: 'Minion de Mordred',
    team: 'evil',
    description: 'Um servo do mal. Conhece os outros servos do mal.',
    icon: '🗡️',
  },
  percival: {
    id: 'percival',
    name: 'Percival',
    team: 'good',
    description: 'Vê quem pode ser Merlin (e Morgana). Ajuda a proteger Merlin.',
    icon: '👁️',
  },
  morgana: {
    id: 'morgana',
    name: 'Morgana',
    team: 'evil',
    description: 'Aparece como "possível Merlin" para Percival.',
    icon: '🧙‍♀️',
  },
  mordred: {
    id: 'mordred',
    name: 'Mordred',
    team: 'evil',
    description: 'Invisível para Merlin. Muito poderoso.',
    icon: '🐍',
  },
  oberon: {
    id: 'oberon',
    name: 'Oberon',
    team: 'evil',
    description: 'Não conhece os outros servos do Mal, e eles não o conhecem.',
    icon: '👻',
  },
  lancelot_good: {
    id: 'lancelot_good',
    name: 'Lancelot Bom',
    team: 'good',
    description: 'Começa leal ao Bem. Se trocar de lealdade, passa a jogar pelo Mal.',
    icon: '👍🏻',
  },
  lancelot_evil: {
    id: 'lancelot_evil',
    name: 'Lancelot Mau',
    team: 'evil',
    description: 'Começa leal ao Mal. Não abre os olhos com os outros Minions (levanta o polegar). Se trocar de lealdade, passa a jogar pelo Bem.',
    icon: '👎🏻',
  },
};

export interface LancelotConfig {
  variant: 'var1' | 'var2' | 'var3' | 'var1_var2' | 'var1_var3' | 'var2_var3' | null;
  deckSize: number;
  deckRevealed: boolean;
  startsAt: number;
  mandatory: boolean;
  recognition: boolean;
}

export const LANCELOT_CONFIGS: Record<string, LancelotConfig> = {
  var1: { variant: 'var1', deckSize: 5, deckRevealed: false, startsAt: 3, mandatory: false, recognition: false },
  var2: { variant: 'var2', deckSize: 7, deckRevealed: true, startsAt: 1, mandatory: true, recognition: false },
  var3: { variant: 'var3', deckSize: 0, deckRevealed: false, startsAt: 0, mandatory: false, recognition: true },
  var1_var2: { variant: 'var1_var2', deckSize: 7, deckRevealed: false, startsAt: 1, mandatory: true, recognition: false },
  var1_var3: { variant: 'var1_var3', deckSize: 5, deckRevealed: false, startsAt: 3, mandatory: false, recognition: true },
  var2_var3: { variant: 'var2_var3', deckSize: 7, deckRevealed: true, startsAt: 1, mandatory: true, recognition: true },
};

export function generateLoyaltyDeck(deckSize: number): ('none' | 'switch')[] {
  if (deckSize === 0) return [];
  const deck: ('none' | 'switch')[] = Array(deckSize).fill('none');
  deck[0] = 'switch';
  deck[1] = 'switch';
  return deck.sort(() => Math.random() - 0.5);
}

export const TEAM_DISTRIBUTION: Record<number, { good: number; evil: number }> = {
  5: { good: 3, evil: 2 },
  6: { good: 4, evil: 2 },
  7: { good: 4, evil: 3 },
  8: { good: 5, evil: 3 },
  9: { good: 6, evil: 3 },
  10: { good: 6, evil: 4 },
};

export const MISSION_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

export function needsTwoFails(missionIndex: number, playerCount: number): boolean {
  return missionIndex === 3 && playerCount >= 7;
}

export function assignRoles(playerIds: string[], selectedOptionalRoles: string[]): Record<string, string> {
  const playerCount = playerIds.length;
  const distribution = TEAM_DISTRIBUTION[playerCount];
  if (!distribution) throw new Error('Número de jogadores inválido');

  const rolesToAssign: string[] = [];

  // Mandatory roles
  rolesToAssign.push('merlin');
  rolesToAssign.push('assassin');

  // Optional roles
  selectedOptionalRoles.forEach(roleId => {
    rolesToAssign.push(roleId);
  });

  // Fill remaining slots
  const currentGood = rolesToAssign.filter(r => ROLES[r].team === 'good').length;
  const currentEvil = rolesToAssign.filter(r => ROLES[r].team === 'evil').length;

  for (let i = 0; i < distribution.good - currentGood; i++) {
    rolesToAssign.push('servant');
  }
  for (let i = 0; i < distribution.evil - currentEvil; i++) {
    rolesToAssign.push('minion');
  }

  // Shuffle roles
  const shuffledRoles = [...rolesToAssign].sort(() => Math.random() - 0.5);
  const assignments: Record<string, string> = {};

  playerIds.forEach((id, index) => {
    assignments[id] = shuffledRoles[index];
  });

  return assignments;
}

export function getNarrationSequence(selectedRoles: string[], lancelotConfig?: LancelotConfig | null, playerCount?: number): string[] {
  const sequence: string[] = ['1', '2'];

  const hasLancelots = selectedRoles.includes('lancelot_good') && selectedRoles.includes('lancelot_evil');
  const variant = lancelotConfig?.variant;
  const usePolegar = hasLancelots && (variant === 'var1' || variant === 'var2' || variant === 'var1_var2' || variant === 'var1_var3' || variant === 'var2_var3');

  if (usePolegar) {
    sequence.push('3-lancelot');
    if (selectedRoles.includes('oberon')) {
      sequence.push('4-oberon-lancelot');
    } else {
      sequence.push('4-lancelot');
    }
    if (selectedRoles.includes('mordred')) {
      sequence.push('5-mordred-lancelot');
    } else {
      sequence.push('5-lancelot');
    }
  } else {
    sequence.push('3');
    if (selectedRoles.includes('oberon')) {
      sequence.push('4-oberon');
    } else {
      sequence.push('4');
    }
    if (selectedRoles.includes('mordred')) {
      sequence.push('5-mordred');
    } else {
      sequence.push('5');
    }
  }

  sequence.push('6', '7');

  if (selectedRoles.includes('percival')) {
    if (selectedRoles.includes('morgana')) {
      sequence.push('8-morgana', '9-morgana');
    } else {
      sequence.push('8', '9');
    }
    sequence.push('10');
  }

  if (lancelotConfig?.recognition && (playerCount || 0) >= 8) {
    sequence.push('11', '12');
  }

  sequence.push('13', '14');

  return sequence;
}
