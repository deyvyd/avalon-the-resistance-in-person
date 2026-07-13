import { ReactNode } from 'react';
import type { Team } from '../../core/avalon';

export const Badge = ({ children, team, variant }: { children: ReactNode; team?: Team; variant?: 'purple' }) => (
  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
    variant === 'purple' ? 'bg-purple-600 text-white' :
    team === 'good' ? 'bg-[#3498db] text-white' : 'bg-[#c0392b] text-white'
  }`}>
    {children}
  </span>
);
