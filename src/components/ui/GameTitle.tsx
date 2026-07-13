export const GameTitle = ({ small = false }: { small?: boolean }) => (
  <div className={`text-center mb-8 ${small ? 'scale-75 -mb-4' : ''}`}>
    <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold mb-1">The Resistance</div>
    <h1 className="text-5xl font-['Cinzel'] text-[#ffd700] drop-shadow-[0_0_15px_rgba(255,215,0,0.3)] tracking-widest">AVALON</h1>
  </div>
);
