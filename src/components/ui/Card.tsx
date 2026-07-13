import { ReactNode } from 'react';

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`bg-[#1b263b] border border-white/10 rounded-2xl p-6 shadow-xl ${className}`}>
    {children}
  </div>
);
