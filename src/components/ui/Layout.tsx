import { ReactNode } from 'react';
import { Settings } from 'lucide-react';
import { GameTitle } from './GameTitle';

export const Layout = ({ children, showTitle = true, onSettingsClick }: { children: ReactNode; showTitle?: boolean; onSettingsClick?: () => void }) => (
  <div className="min-h-screen bg-[#0d1b2a] text-white font-['Lato'] selection:bg-[#ffd700] selection:text-[#0d1b2a] pb-12">
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="flex justify-end mb-4">
        <button
          onClick={onSettingsClick}
          className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-[#ffd700] transition-all"
        >
          <Settings size={24} />
        </button>
      </div>
      {showTitle && <GameTitle small={!window.location.pathname.endsWith('/') && !window.location.pathname.endsWith('/room/')} />}
      {children}
    </div>
  </div>
);
