export interface AvalonSettings {
  musicEnabled: boolean;
  musicVolume: number;
  narrationVolume: number;
  pauseDuration: number;
  musicVolumeFaded: number;
  keepScreenAwake: boolean;
  confirmOnLeave: boolean;
}

export interface Player {
  id: string; // Persistent ID
  socketId: string;
  name: string;
  role?: string;
  isConfirmed: boolean;
}

export interface Mission {
  index: number;
  size: number;
  status: 'pending' | 'success' | 'fail';
  votes: ('success' | 'fail')[];
  team: string[];
}

export type GamePhase =
  | 'lobby'
  | 'character-reveal'
  | 'narration'
  | 'team-proposal'
  | 'team-voting'
  | 'team-result'
  | 'mission-voting'
  | 'excalibur-usage'
  | 'mission-result'
  | 'lady-of-the-lake'
  | 'assassination'
  | 'game-over';

export interface MatchRecord {
  id: string;
  timestamp: string;
  playerCount: number;
  players: { name: string; role: string; team: 'good' | 'evil' }[];
  options: { lancelot: string; ladyOfLake: boolean; excalibur: boolean; targeting: boolean };
  missions: { status: 'pending' | 'success' | 'fail'; fails: number }[];
  winner: 'good' | 'evil';
  reason: string;
  duration: number;
}

export interface TeamVoteResult {
  votes: Record<string, 'approve' | 'reject'>;
  passed: boolean;
}

export interface MissionVoteResult {
  votes: ('success' | 'fail')[];
  passed: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  players: Player[];
  phase: GamePhase;
  selectedRoles: string[];
  missions: Mission[];
  currentMissionIndex: number;
  currentLeaderIndex: number;
  rejectionCount: number;
  proposedTeam: string[];
  teamVotesCount: number;
  missionVotesCount: number;
  hasVotedTeam: boolean;
  hasVotedMission: boolean;
  knowledge: { playerId: string; hint: 'evil' | 'maybe-merlin' | 'lancelot'; team?: 'good' | 'evil' }[];
  lastTeamVoteResult?: TeamVoteResult;
  lastMissionVoteResult?: MissionVoteResult;
  assassinationTargetId?: string;
  firstLeaderId?: string;
  winner?: 'good' | 'evil';
  gameOverReason?: string;
  lancelotConfig: {
    id: string;
    variant: 'var1' | 'var2' | 'var3' | 'var1_var2' | 'var1_var3' | 'var2_var3' | null;
    deckSize: number;
    deckRevealed: boolean;
    startsAt: number;
    mandatory: boolean;
    recognition: boolean;
  } | null;
  loyaltyDeckIndex: number;
  loyaltyDeckVisible: string[];
  lancelotLoyalty: { lancelotGoodTeam: 'good' | 'evil'; lancelotEvilTeam: 'good' | 'evil'; swapOccurred: boolean } | null;
  ladyOfLakeEnabled: boolean;
  ladyOfLakeHolder: string | null;
  ladyOfLakeUsed: string[];
  ladyOfLakePhase: boolean;
  excaliburEnabled: boolean;
  excaliburHolder: string | null;
  excaliburUsed: boolean;
  excaliburTarget: string | null;
  excaliburReveal: 'success' | 'fail' | null;
  targetingEnabled: boolean;
  attemptedMissions: number[];
  matchHistory: MatchRecord[];
  currentMatchStartedAt: Date | null;
}
