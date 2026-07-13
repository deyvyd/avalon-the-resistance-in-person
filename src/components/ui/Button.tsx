import { ReactNode } from 'react';

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = ''
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  disabled?: boolean;
  className?: string;
}) => {
  const variants = {
    primary: 'bg-[#ffd700] text-[#0d1b2a] hover:bg-[#ffed4a]',
    secondary: 'bg-[#2a3f5f] text-white hover:bg-[#3a547a]',
    danger: 'bg-[#c0392b] text-white hover:bg-[#e74c3c]',
    outline: 'border-2 border-[#ffd700] text-[#ffd700] hover:bg-[#ffd700] hover:text-[#0d1b2a]'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-4 px-6 rounded-xl font-['Cinzel'] font-bold text-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};
