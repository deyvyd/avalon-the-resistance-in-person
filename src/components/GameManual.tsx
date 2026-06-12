import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  ChevronDown,
  Target,
  Users,
  Settings,
  Gamepad2,
  Flag,
  ShieldCheck,
  Lightbulb,
  Shield,
  Skull,
  Info,
  AlertTriangle,
  Sword,
  Droplets,
  RefreshCw,
  MapPinned,
  Book
} from 'lucide-react';

// --- Types ---

interface SearchEntry {
  sectionId: string;
  sectionTitle: string;
  text: string;
  originalText: string;
  type: 'paragraph' | 'title' | 'box' | 'list-item' | 'character' | 'table-cell';
}

interface ManualSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  render: () => React.ReactNode;
  searchText: string; // Pre-compiled text for search
}

// --- Utils ---

const normalizeText = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
};

const highlightMatch = (text: string, query: string) => {
  if (!query) return text;
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  const index = normalizedText.indexOf(normalizedQuery);

  if (index === -1) return text;

  const before = text.substring(0, index);
  const match = text.substring(index, index + query.length);
  const after = text.substring(index + query.length);

  return (
    <>
      {before}
      <mark className="bg-[#ffd700]/25 text-[#ffd700] font-bold rounded px-0.5">{match}</mark>
      {after}
    </>
  );
};

// --- Components ---

const Box = ({ children, type }: { children: React.ReactNode; type: 'highlight' | 'warning' | 'tip' | 'evil' }) => {
  const styles = {
    highlight: 'bg-[#4169e1]/15 border-l-4 border-[#4169e1]',
    warning: 'bg-[#dc143c]/15 border-l-4 border-[#dc143c]',
    tip: 'bg-[#d4af37]/15 border-l-4 border-[#d4af37]',
    evil: 'bg-[#8b0000]/20 border-l-4 border-[#8b0000]',
  };

  return (
    <div className={`${styles[type]} rounded-lg p-4 my-4`}>
      {children}
    </div>
  );
};

const ScriptBox = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[#1e2d45]/60 border border-[#ffd700]/30 rounded-lg p-4 my-4 italic text-sm space-y-2">
    {children}
  </div>
);

const CharacterCard = ({ title, team, children }: { title: string; team: 'good' | 'evil' | 'lancelot'; children: React.ReactNode }) => {
  const borders = {
    good: 'border-[#4169e1]',
    evil: 'border-[#dc143c]',
    lancelot: 'border-[#ffd700]',
  };

  return (
    <div className={`bg-gradient-to-br from-[#2a3f5f] to-[#1e2a3a] border-2 ${borders[team]} rounded-xl p-4 my-3 shadow-lg`}>
      <h4 className="text-lg font-bold mb-2 font-['Cinzel'] text-[#ffd700]">{title}</h4>
      <div className="text-sm text-[#e0e0e0] space-y-1">
        {children}
      </div>
    </div>
  );
};

const ManualTable = ({ headers, rows, type }: { headers: string[]; rows: (string | number)[][]; type?: 'good' | 'evil' }) => (
  <div className="overflow-x-auto my-4 rounded-lg border border-[#ffd700]/20">
    <table className="w-full border-collapse text-sm">
      <thead className="bg-[#2a3f5f]/80 text-[#ffd700] font-['Cinzel']">
        <tr>
          {headers.map((h, i) => (
            <th key={i} className="p-3 text-left border border-[#ffd700]/20">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            className={`
              ${type === 'good' ? 'bg-[#4169e1]/10' : type === 'evil' ? 'bg-[#dc143c]/10' : 'bg-white/5'}
              border-b border-[#ffd700]/10
            `}
          >
            {row.map((cell, j) => (
              <td key={j} className="p-3 border border-[#ffd700]/20 text-[#e0e0e0]">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Term = ({ pt, en }: { pt: string; en: string }) => (
  <span className="group relative inline-block">
    <span className="underline decoration-dotted decoration-[#ffd700]/50 cursor-help">{pt}</span>
    <span className="hidden sm:group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#0d1b2a] border border-[#ffd700] text-[#ffd700] text-[10px] rounded whitespace-nowrap z-50">
      {en}
    </span>
    <span className="sm:hidden text-[10px] text-[#ffd700] opacity-80 ml-1">({en})</span>
  </span>
);

// --- Main Component ---

export const GameManual = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // --- Content Definition ---

  const sections: ManualSection[] = useMemo(() => [
    {
      id: 'objetivo',
      title: t('manual.section_objetivo_title'),
      icon: <Target size={20} />,
      searchText: 'Objetivo do Jogo The Resistance: Avalon é um jogo de dedução social e lealdade oculta. Os jogadores são divididos em dois times secretos: Servos de Arthur Loyal Servants of Arthur BEM Lutam pela bondade e honra. Vencem completando 3 missões com sucesso. Minions de Mordred MAL Alinhados com as forças do mal. Vencem se 3 missões falharem, ou assassinando Merlin, ou se 5 times consecutivos forem rejeitados. Durante o jogo, os jogadores podem fazer qualquer afirmação, a qualquer momento. Discussão, enganação, acusação e dedução lógica são fundamentais para a vitória de qualquer lado. Dica Importante: Mesmo um único jogador do mal em uma equipe é suficiente para sabotar uma missão!',
      render: () => (
        <div className="space-y-4">
          <p className="text-[#e0e0e0]">
            <strong>The Resistance: Avalon</strong> {t('manual.section_objetivo_title') === 'Game Objective'
              ? 'is a social deduction and hidden loyalty game. Players are divided into two secret teams:'
              : 'é um jogo de dedução social e lealdade oculta. Os jogadores são divididos em dois times secretos:'}
          </p>

          <Box type="highlight">
            <h4 className="font-bold text-[#82a1fd] flex items-center gap-2 mb-1">
              🛡️ {t('manual.section_objetivo_title') === 'Game Objective' ? 'Servants of Arthur' : 'Servos de Arthur'} <span className="text-xs opacity-70 italic">(Loyal Servants of Arthur)</span> ({t('manual.section_objetivo_title') === 'Game Objective' ? 'GOOD' : 'BEM'})
            </h4>
            <p className="text-sm">
              {t('manual.section_objetivo_title') === 'Game Objective'
                ? 'Fight for goodness and honor. Win by completing '
                : 'Lutam pela bondade e honra. Vencem completando '}
              <strong>{t('manual.section_objetivo_title') === 'Game Objective' ? '3 successful missions' : '3 missões com sucesso'}</strong>.
            </p>
          </Box>

          <Box type="evil">
            <h4 className="font-bold text-[#ff6282] flex items-center gap-2 mb-1">
              💀 {t('manual.section_objetivo_title') === 'Game Objective' ? 'Minions of Mordred' : 'Minions de Mordred'} <span className="text-xs opacity-70 italic">(Minions of Mordred)</span> ({t('manual.section_objetivo_title') === 'Game Objective' ? 'EVIL' : 'MAL'})
            </h4>
            <p className="text-sm">
              {t('manual.section_objetivo_title') === 'Game Objective'
                ? <>Aligned with the forces of evil. Win if <strong>3 missions fail</strong>, or by assassinating Merlin, or if 5 consecutive teams are rejected.</>
                : <>Alinhados com as forças do mal. Vencem se <strong>3 missões falharem</strong>, ou assassinando Merlin, ou se 5 times consecutivos forem rejeitados.</>
              }
            </p>
          </Box>

          <p className="text-sm text-[#e0e0e0]">
            {t('manual.section_objetivo_title') === 'Game Objective'
              ? <>During the game, players may make <strong>any claim</strong>, at any time. Discussion, deception, accusation and logical deduction are fundamental for either side to win.</>
              : <>Durante o jogo, os jogadores podem fazer <strong>qualquer afirmação</strong>, a qualquer momento. Discussão, enganação, acusação e dedução lógica são fundamentais para a vitória de qualquer lado.</>
            }
          </p>

          <Box type="tip">
            <p className="text-sm">
              {t('manual.section_objetivo_title') === 'Game Objective'
                ? <>💡 <strong>Important Tip:</strong> Even a single evil player on a team is enough to sabotage a mission!</>
                : <>💡 <strong>Dica Importante:</strong> Mesmo um único jogador do mal em uma equipe é suficiente para sabotar uma missão!</>
              }
            </p>
          </Box>
        </div>
      )
    },
    {
      id: 'personagens',
      title: t('manual.section_personagens_title'),
      icon: <Users size={20} />,
      searchText: 'Personagens Especiais Personagens Obrigatórios MERLIN BEM Poder: Sabe quem são TODOS os jogadores do mal (exceto Mordred, se estiver em jogo). Desafio: Deve guiar o bem sem revelar sua identidade, ou será assassinado! Assassino Assassin MAL Poder: Se o bem vencer 3 missões, o Assassino pode tentar adivinhar quem é Merlin. Vitória: Se acertar, mata Merlin e o mal vence mesmo após 3 sucessos! Personagens Opcionais PERCIVAL BEM Poder: Sabe quem é Merlin (ou quem parece ser Merlin se Morgana estiver em jogo). Objetivo: Proteger a identidade de Merlin. Tendência: Fortalece o Bem Nota: Em jogos com Percival, adicione Mordred OU Morgana para balancear. MORDRED MAL Poder: Sua identidade NÃO é revelada para Merlin no início do jogo. Estratégia: Pode fingir ser do bem sem Merlin saber. Tendência: Fortalece o Mal OBERON MAL Poder: NÃO se revela para os outros jogadores do mal, nem os conhece. Desafio: Está isolado, mas Merlin o vê. Tendência: Fortalece o Bem MORGANA MAL Poder: Aparece para Percival como se fosse Merlin. Confusão: Percival vê duas pessoas e não sabe qual é o verdadeiro Merlin. Tendência: Fortalece o Mal LANCELOT BOM E LANCELOT MAU',
      render: () => (
        <div className="space-y-6">
          <div>
            <h4 className="text-xs uppercase tracking-widest text-[#b8956a] font-bold mb-4 border-b border-[#4a5f7f] pb-1">{t('manual.chars_mandatory')}</h4>
            <CharacterCard title="🧙🏻‍♂️ MERLIN — BEM" team="good">
              <p>⚡ <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Power' : 'Poder'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Knows ALL evil players (except Mordred, if in play).' : 'Sabe quem são TODOS os jogadores do mal (exceto Mordred, se estiver em jogo).'}</p>
              <p>🏔️ <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Challenge' : 'Desafio'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Must guide the good without revealing his identity, or he will be assassinated!' : 'Deve guiar o bem sem revelar sua identidade, ou será assassinado!'}</p>
            </CharacterCard>
            <CharacterCard title={t('manual.section_personagens_title') === 'Special Characters' ? '💀 Assassin — EVIL' : '💀 Assassino (Assassin) — MAL'} team="evil">
              <p>⚡ <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Power' : 'Poder'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'If good wins 3 missions, the Assassin can try to guess who Merlin is.' : 'Se o bem vencer 3 missões, o Assassino pode tentar adivinhar quem é Merlin.'}</p>
              <p>🏆 <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Victory' : 'Vitória'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'If correct, kills Merlin and evil wins even after 3 successes!' : 'Se acertar, mata Merlin e o mal vence mesmo após 3 sucessos!'}</p>
            </CharacterCard>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-widest text-[#b8956a] font-bold mb-4 border-b border-[#4a5f7f] pb-1">{t('manual.chars_optional')}</h4>
            <CharacterCard title="🛡️ PERCIVAL — BEM" team="good">
              <p>⚡ <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Power' : 'Poder'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Knows who Merlin is (or who appears to be Merlin if Morgana is in play).' : 'Sabe quem é Merlin (ou quem parece ser Merlin se Morgana estiver em jogo).'}</p>
              <p>🎯 <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Goal' : 'Objetivo'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Protect the identity of Merlin.' : 'Proteger a identidade de Merlin.'}</p>
              <p>📈 <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Tendency' : 'Tendência'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Strengthens Good' : 'Fortalece o Bem'}</p>
              <Box type="highlight">
                <p className="text-xs">{t('manual.section_personagens_title') === 'Special Characters' ? 'Note: In games with Percival, add Mordred OR Morgana to balance.' : 'Nota: Em jogos com Percival, adicione Mordred OU Morgana para balancear.'}</p>
              </Box>
            </CharacterCard>
            <CharacterCard title="🐍 MORDRED — MAL" team="evil">
              <p>⚡ <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Power' : 'Poder'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'His identity is NOT revealed to Merlin at the start of the game.' : 'Sua identidade NÃO é revelada para Merlin no início do jogo.'}</p>
              <p>♞ <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Strategy' : 'Estratégia'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Can pretend to be good without Merlin knowing.' : 'Pode fingir ser do bem sem Merlin saber.'}</p>
              <p>📈 <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Tendency' : 'Tendência'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Strengthens Evil' : 'Fortalece o Mal'}</p>
            </CharacterCard>
            <CharacterCard title="👻 OBERON — MAL" team="evil">
              <p>⚡ <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Power' : 'Poder'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Does NOT reveal himself to other evil players, nor does he know them.' : 'NÃO se revela para os outros jogadores do mal, nem os conhece.'}</p>
              <p>🏔️ <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Challenge' : 'Desafio'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'He is isolated, but Merlin sees him (does not know that others do not know him).' : 'Está isolado, mas Merlin o vê (não sabe que os outros não o conhecem).'}</p>
              <p>📈 <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Tendency' : 'Tendência'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Strengthens Good (hinders evil coordination)' : 'Fortalece o Bem (dificulta coordenação do mal)'}</p>
              <Box type="highlight">
                <p className="text-xs">{t('manual.section_personagens_title') === 'Special Characters'
                  ? 'Note: Oberon is not a Minion of Mordred and does not open his eyes during the initial revelation.'
                  : <>Nota: Oberon não é um <em>Minion de Mordred</em> <span className="italic">(Minion of Mordred)</span> e não abre os olhos durante a revelação inicial.</>
                }</p>
              </Box>
            </CharacterCard>
            <CharacterCard title="🧙‍♀️ MORGANA — MAL" team="evil">
              <p>⚡ <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Power' : 'Poder'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Appears to Percival as if she were Merlin.' : 'Aparece para Percival como se fosse Merlin.'}</p>
              <p>🔀 <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Confusion' : 'Confusão'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Percival sees two people and does not know which is the true Merlin.' : 'Percival vê duas pessoas e não sabe qual é o verdadeiro Merlin.'}</p>
              <p>📈 <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Tendency' : 'Tendência'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Strengthens Evil' : 'Fortalece o Mal'}</p>
            </CharacterCard>
            <CharacterCard title={t('manual.section_personagens_title') === 'Special Characters' ? '👍🏻 GOOD LANCELOT (Good Lancelot) AND 👎🏻 EVIL LANCELOT (Evil Lancelot)' : '👍🏻 LANCELOT BOM (Good Lancelot) E 👎🏻 LANCELOT MAU (Evil Lancelot)'} team="lancelot">
              <p>🏷️ <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Card names' : 'Nomes nas cartas'}:</strong> <em>{t('manual.section_personagens_title') === 'Special Characters' ? 'Good Lancelot' : 'Lancelot Bom'}</em> <span className="italic">(Good Lancelot)</span> {t('manual.section_personagens_title') === 'Special Characters' ? 'and' : 'e'} <em>{t('manual.section_personagens_title') === 'Special Characters' ? 'Evil Lancelot' : 'Lancelot Mau'}</em> <span className="italic">(Evil Lancelot)</span></p>
              <p>⚙️ <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Mechanic' : 'Mecânica'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'If you add Good Lancelot, you MUST add Evil Lancelot (you can only play with both or neither).' : 'Se adicionar Lancelot Bom, DEVE adicionar Lancelot Mau (só é possível jogar com os 2 ou nenhum).'}</p>
              <p>📈 <strong>{t('manual.section_personagens_title') === 'Special Characters' ? 'Tendency' : 'Tendência'}:</strong> {t('manual.section_personagens_title') === 'Special Characters' ? 'Adds complexity and uncertainty to the game.' : 'Adiciona complexidade e incerteza ao jogo.'}</p>
              <p className="text-xs italic mt-2">{t('manual.section_personagens_title') === 'Special Characters' ? '*See Optional Rules section for the 3 Lancelot variants.*' : '*Veja seção de Regras Opcionais para as 3 variantes de Lancelot.*'}</p>
            </CharacterCard>
          </div>
        </div>
      )
    },
    {
      id: 'preparacao',
      title: t('manual.section_preparacao_title'),
      icon: <Settings size={20} />,
      searchText: 'Preparação do Jogo Distribuição de Jogadores Use a tabela abaixo para determinar quantos jogadores estarão em cada time: Bem (Azul) Mal (Vermelho) Tamanho das Equipes por Missão Em partidas com 7+ jogadores, a 4ª missão requer 2 cartas de falha para falhar. Revelação Inicial: O Mal se Reconhece',
      render: () => (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-bold text-[#ffd700] mb-2 font-['Cinzel']">{t('manual.prep_player_dist')}</h4>
            <p className="text-xs text-[#b0b0b0] mb-3">{t('manual.prep_player_dist_sub')}</p>
            <ManualTable
              headers={['', '5', '6', '7', '8', '9', '10']}
              rows={[
                [t('manual.prep_good_blue'), 3, 4, 4, 5, 6, 6],
                [t('manual.prep_evil_red'), 2, 2, 3, 3, 3, 4]
              ]}
            />
          </div>

          <div>
            <h4 className="text-sm font-bold text-[#ffd700] mb-2 font-['Cinzel']">{t('manual.prep_team_size')}</h4>
            <ManualTable
              headers={[t('manual.prep_mission'), '5', '6', '7', '8', '9', '10']}
              rows={[
                [t('manual.prep_mission_1'), 2, 2, 2, 3, 3, 3],
                [t('manual.prep_mission_2'), 3, 3, 3, 4, 4, 4],
                [t('manual.prep_mission_3'), 2, 4, 3, 4, 4, 4],
                [t('manual.prep_mission_4'), 3, 3, '4*', '5*', '5*', '5*'],
                [t('manual.prep_mission_5'), 3, 4, 4, 5, 5, 5]
              ]}
            />
            <Box type="warning">
              <p className="text-xs">{t('manual.prep_4th_warning')}</p>
            </Box>
          </div>

          <div>
            <h4 className="text-sm font-bold text-[#ffd700] mb-2 font-['Cinzel']">{t('manual.prep_revelation_title')}</h4>
            <p className="text-xs text-[#b0b0b0] mb-3">{t('manual.prep_revelation_sub')}</p>
            <ScriptBox>
              <p>"Todos, fechem os olhos e estendam a mão em punho na frente de vocês"</p>
              <p className="text-[#ff6282]">[MAL] "Minions de Mordred, abram os olhos e olhem ao redor para conhecer todos os agentes do mal"</p>
              <p className="text-[#ff6282]">[MAL] "Minions de Mordred, fechem os olhos"</p>
              <p>"Todos devem estar com os olhos fechados e mãos em punho"</p>
              <p className="text-[#ff6282]">[MAL] "Minions de Mordred, estendam o polegar para que Merlin saiba quem vocês são"</p>
              <p className="text-[#82a1fd]">[BEM] "Merlin, abra os olhos e veja os agentes do mal"</p>
              <p className="text-[#ff6282]">[MAL] "Minions de Mordred, abaixem o polegar e formem o punho novamente"</p>
              <p className="text-[#82a1fd]">[BEM] "Merlin, feche os olhos"</p>
              <p>"Todos devem estar com os olhos fechados e mãos em punho"</p>
              <p>"Todos, abram os olhos"</p>
            </ScriptBox>
            <Box type="warning">
              <p className="text-xs">⚠️ <strong>{t('manual.section_preparacao_title') === 'Game Setup' ? 'Important' : 'Importante'}:</strong> {t('manual.section_preparacao_title') === 'Game Setup'
                ? 'Evil players know each other and Merlin knows who they are, but cannot reveal that he knows or all is lost! He must be subtle!'
                : 'Os jogadores do mal se conhecem e Merlin sabe quem são eles, mas não pode revelar que sabe ou tudo estará perdido! Ele precisa ser sutil!'
              }</p>
            </Box>
          </div>

          <div>
            <h4 className="text-sm font-bold text-[#ffd700] mb-2 font-['Cinzel']">{t('manual.prep_revelation_optional_title')}</h4>
            <ScriptBox>
              <p>"Todos, fechem os olhos e estendam a mão em punho"</p>
              <p className="text-[#ff6282]">[MAL] "Minions de Mordred, exceto Oberon, abram os olhos e se reconheçam"</p>
              <p className="text-[#ff6282]">[MAL] "Minions de Mordred, fechem os olhos"</p>
              <p>"Todos com olhos fechados e mãos em punho"</p>
              <p className="text-[#ff6282]">[MAL] "Minions de Mordred, exceto Mordred, estendam o polegar para Merlin"</p>
              <p className="text-[#82a1fd]">[BEM] "Merlin, abra os olhos e veja o mal"</p>
              <p className="text-[#ff6282]">[MAL] "Minions, abaixem o polegar"</p>
              <p className="text-[#82a1fd]">[BEM] "Merlin, feche os olhos"</p>
              <p>"Todos com olhos fechados"</p>
              <p className="text-[#c08fff]">[ROXO] "Merlin e Morgana, estendam o polegar para Percival"</p>
              <p className="text-[#c08fff]">[ROXO] "Percival, abra os olhos e veja Merlin e Morgana"</p>
              <p className="text-[#c08fff]">[ROXO] "Merlin e Morgana, abaixem o polegar"</p>
              <p className="text-[#c08fff]">[ROXO] "Percival, feche os olhos"</p>
              <p>"Todos abram os olhos"</p>
            </ScriptBox>
            <p className="text-[10px] text-gray-500 italic mt-2">{t('manual.prep_revelation_note')}</p>
          </div>
        </div>
      )
    },
    {
      id: 'como-jogar',
      title: t('manual.section_como_jogar_title'),
      icon: <Gamepad2 size={20} />,
      searchText: 'Como Jogar O jogo consiste em várias rodadas. Cada rodada tem duas fases: 1. Fase de Formação de Equipe 2. Fase da Missão',
      render: () => {
        const isEn = i18n.language === 'en';
        return (
          <div className="space-y-6">
            <p className="text-sm text-[#e0e0e0]">{isEn
              ? 'The game consists of several rounds. Each round has two phases:'
              : 'O jogo consiste em várias rodadas. Cada rodada tem duas fases:'
            }</p>

            <div>
              <h4 className="text-sm font-bold text-[#ffd700] mb-3 font-['Cinzel']">{isEn ? '1. Team Building Phase' : '1. Fase de Formação de Equipe'}</h4>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-[#e0e0e0]">
                <li>{isEn ? <>The <strong>Leader</strong> proposes a team to complete the mission</> : <>O <strong>Líder</strong> propõe uma equipe para completar a missão</>}</li>
                <li>{isEn ? <>All players <strong>discuss</strong> the proposal (discussion is fundamental!)</> : <>Todos os jogadores <strong>discutem</strong> a proposta (discussão é fundamental!)</>}</li>
                <li>{isEn
                  ? <>Each player votes secretly using their <strong>Vote Tokens</strong>:</>
                  : <>Cada jogador vota secretamente usando seus <strong>Tokens de Voto</strong>:</>
                }
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                    <li><Term pt={isEn ? 'Approve' : 'Aprovar'} en="Approve" /> - {isEn ? 'accept the proposed team' : 'aceitar a equipe proposta'}</li>
                    <li><Term pt={isEn ? 'Reject' : 'Rejeitar'} en="Reject" /> - {isEn ? 'refuse the proposed team' : 'recusar a equipe proposta'}</li>
                  </ul>
                </li>
                <li>{isEn ? 'Votes are revealed simultaneously' : 'Os votos são revelados simultaneamente'}</li>
                <li>{isEn ? <>If <strong>majority approves</strong>, the team goes on the mission</> : <>Se a <strong>maioria aprovar</strong>, a equipe vai para a missão</>}</li>
                <li>{isEn ? 'If rejected, leadership passes to the next player (clockwise)' : 'Se for rejeitada, a liderança passa para o próximo jogador (sentido horário)'}</li>
              </ol>
              <Box type="warning">
                <p className="text-xs">⚠️ <strong>{isEn ? 'Attention' : 'Atenção'}:</strong> {isEn
                  ? <>If 5 consecutive teams are rejected in the same round, <strong>Evil wins automatically</strong>!</>
                  : <>Se 5 equipes consecutivas forem rejeitadas na mesma rodada, o <strong>Mal vence automaticamente</strong>!</>
                }</p>
              </Box>
              <Box type="tip">
                <h5 className="font-bold text-xs mb-1">🕵️ {isEn ? 'Strategy' : 'Estratégia'}:</h5>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  <li>{isEn ? 'Be careful who you trust!' : 'Cuidado em quem vai confiar!'}</li>
                  <li>{isEn ? 'Rejecting a team does NOT mean you are evil. Experienced players may reject several teams before approving one.' : 'Rejeitar uma equipe NÃO significa que você é do mal. Jogadores experientes podem rejeitar várias equipes antes de aprovar uma.'}</li>
                  <li>{isEn ? 'Watch who approves and ask why.' : 'Observe quem aprova e pergunte o motivo.'}</li>
                </ul>
              </Box>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#ffd700] mb-3 font-['Cinzel']">{isEn ? '2. Mission Phase' : '2. Fase da Missão'}</h4>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-[#e0e0e0]">
                <li>{isEn
                  ? <>Each approved team member receives <strong>Mission Cards</strong>:</>
                  : <>Cada membro da equipe aprovada recebe <strong>Cartas de Missão</strong>:</>
                }
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                    <li><Term pt={isEn ? 'Success' : 'Sucesso'} en="Success" />
                      <ul className="pl-4 mt-0.5 opacity-80">
                        <li>{isEn ? <>Players of <strong>GOOD</strong> MUST ALWAYS play this card</> : <>Jogadores do <strong>BEM</strong> SEMPRE devem jogar essa carta</>}</li>
                        <li>{isEn ? <>Players of <strong>EVIL</strong> CAN play this card to bluff</> : <>Jogadores do <strong>MAL</strong> PODEM jogar essa carta para blefar</>}</li>
                      </ul>
                    </li>
                    <li><Term pt={isEn ? 'Fail' : 'Falha'} en="Fail" />
                      <ul className="pl-4 mt-0.5 opacity-80">
                        <li>{isEn ? <>Players of <strong>GOOD</strong> MUST NEVER play this card</> : <>Jogadores do <strong>BEM</strong> NUNCA devem jogar essa carta</>}</li>
                        <li>{isEn ? <>Players of <strong>EVIL</strong> NORMALLY play this card to sabotage missions</> : <>Jogadores do <strong>MAL</strong> NORMALMENTE jogam essa carta para sabotar missões</>}</li>
                      </ul>
                    </li>
                  </ul>
                </li>
                <li>{isEn ? <>Each one <strong>secretly</strong> chooses a card and plays it face down</> : <>Cada um escolhe <strong>secretamente</strong> uma carta e joga virada para baixo</>}</li>
                <li>{isEn ? 'The Leader shuffles and reveals the played cards' : 'O Líder embaralha e revela as cartas jogadas'}
                  <ul className="list-disc pl-5 mt-1 opacity-80 text-xs">
                    <li>{isEn ? <>The mission is a <strong>SUCCESS</strong> only if ALL cards are success</> : <>A missão é <strong>SUCESSO</strong> apenas se TODAS as cartas forem de sucesso</>}</li>
                    <li>{isEn ? <>The mission <strong>FAILS</strong> if there is one or more fail cards</> : <>A missão <strong>FALHA</strong> se houver uma ou mais cartas de falha</>}</li>
                  </ul>
                </li>
              </ol>
              <Box type="warning">
                <p className="text-xs"><strong>{isEn ? 'Exception' : 'Exceção'}:</strong> {isEn
                  ? <>In the 4th mission with 7+ players, <strong>2 <Term pt="Fail" en="Fail" /></strong> cards are required for the mission to fail</>
                  : <>Na 4ª missão com 7+ jogadores, são necessárias <strong>2 cartas <Term pt="Falha" en="Fail" /></strong> para a missão falhar</>
                }</p>
              </Box>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#ffd700] mb-2 font-['Cinzel']">{isEn ? 'Game Progression' : 'Progressão do Jogo'}</h4>
              <p className="text-sm text-[#e0e0e0]">{isEn
                ? 'After each mission (success or fail), mark the result on the board and pass leadership to the next player. The game continues until one side wins.'
                : 'Após cada missão (sucesso ou falha), marque o resultado no tabuleiro e passe a liderança para o próximo jogador. O jogo continua até que um lado vença.'
              }</p>
            </div>
          </div>
        );
      }
    },
    {
      id: 'final',
      title: t('manual.section_final_title'),
      icon: <Flag size={20} />,
      searchText: 'Final do Jogo Condições de Vitória do BEM Condições de Vitória do MAL Tentativa de Assassinato Resumo das Vitórias',
      render: () => {
        const isEn = i18n.language === 'en';
        return (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-bold text-[#82a1fd] mb-2 font-['Cinzel']">{t('manual.end_good_title')}</h4>
              <Box type="highlight">
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li><strong>{isEn ? '3 missions completed successfully' : '3 missões completadas com sucesso'}</strong></li>
                  <li><strong>{isEn ? 'AND' : 'E'}</strong> {isEn ? 'Merlin is not assassinated (or the Assassin misses)' : 'Merlin não for assassinado (ou o Assassino errar)'}</li>
                </ul>
              </Box>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#ff6282] mb-2 font-['Cinzel']">{t('manual.end_evil_title')}</h4>
              <Box type="warning">
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li><strong>{isEn ? '3 missions fail' : '3 missões falharem'}</strong>, {isEn ? 'OR' : 'OU'}</li>
                  <li><strong>{isEn ? '5 consecutive teams are rejected' : '5 equipes consecutivas serem rejeitadas'}</strong> {isEn ? 'in the same round, OR' : 'na mesma rodada, OU'}</li>
                  <li><strong>{isEn ? 'Assassinate Merlin' : 'Assassinar Merlin'}</strong> {isEn ? 'correctly after 3 good successes' : 'corretamente após 3 sucessos do bem'}</li>
                </ul>
              </Box>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#ffd700] mb-2 font-['Cinzel']">{t('manual.end_assassination_title')}</h4>
              <p className="text-sm text-[#e0e0e0] mb-3">{isEn
                ? "If Good completes 3 missions successfully, the game does NOT end immediately! Evil players have one last chance:"
                : "Se o Bem completar 3 missões com sucesso, o jogo NÃO termina imediatamente! Os jogadores do mal têm uma última chance:"
              }</p>
              <Box type="tip">
                <h5 className="font-bold text-xs mb-2">{t('manual.end_assassination_proc')}</h5>
                <ol className="list-decimal pl-5 text-xs space-y-2">
                  <li>{isEn ? 'Evil players discuss among themselves (without revealing cards)' : 'Os jogadores do mal discutem entre si (sem revelar cartas)'}</li>
                  <li>{isEn ? <>The player with the <strong>Assassin</strong> card points to a good player</> : <>O jogador com a carta de <strong>Assassino</strong> aponta para um jogador do bem</>}</li>
                  <li>{isEn ? <>If it is Merlin → <strong>EVIL WINS!</strong></> : <>Se for Merlin → <strong>MAL VENCE!</strong></>}</li>
                  <li>{isEn ? <>If it is not Merlin → <strong>GOOD WINS!</strong></> : <>Se não for Merlin → <strong>BEM VENCE!</strong></>}</li>
                </ol>
              </Box>
              <Box type="highlight">
                <p className="text-xs">👑 <strong>{isEn ? 'Final Tip' : 'Dica Final'}:</strong> {isEn
                  ? 'Merlin must help good subtly, using votes and discreet comments. If too obvious, he will be easily identified and assassinated!'
                  : 'Merlin deve ajudar o bem de forma sutil, usando votos e comentários discretos. Se for óbvio demais, será facilmente identificado e assassinado!'
                }</p>
              </Box>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#ffd700] mb-2 font-['Cinzel']">{t('manual.end_summary_title')}</h4>
              <ManualTable
                headers={[t('manual.end_summary_good_header'), t('manual.end_summary_evil_header')]}
                rows={[
                  [t('manual.end_summary_r1_good'), t('manual.end_summary_r1_evil')],
                  [t('manual.end_summary_r2_good'), t('manual.end_summary_r2_evil')],
                  [t('manual.end_summary_r3_good'), t('manual.end_summary_r3_evil')]
                ]}
              />
            </div>
          </div>
        );
      }
    },
    {
      id: 'regras-opcionais',
      title: t('manual.section_regras_title'),
      icon: <ShieldCheck size={20} />,
      searchText: 'Regras Opcionais Avançadas Missão Alvo Targeting Excalibur Dama do Lago Lady of the Lake Lancelot',
      render: () => {
        const isEn = i18n.language === 'en';
        return (
          <div className="space-y-6">
            <p className="text-sm text-[#e0e0e0]">{isEn
              ? <>The following rules are <strong>optional</strong> and can be added to the game to increase complexity, strategy and fun.</>
              : <>As regras a seguir são <strong>opcionais</strong> e podem ser adicionadas ao jogo para aumentar a complexidade, estratégia e diversão.</>
            }</p>

            <div>
              <h4 className="text-sm font-bold text-[#ffd700] mb-3 font-['Cinzel']">🎯 <Term pt={isEn ? 'Target Mission' : 'Missão Alvo'} en="Targeting" /></h4>
              <p className="text-sm text-[#e0e0e0] mb-3">{isEn
                ? <>The <Term pt="Target Mission" en="Targeting" /> variant allows players to complete missions in <strong>any order</strong>.</>
                : <>A variante <Term pt="Missão Alvo" en="Targeting" /> permite aos jogadores completar as missões em <strong>qualquer ordem</strong>.</>
              }</p>
              <Box type="highlight">
                <h5 className="font-bold text-xs mb-2">{isEn ? 'How It Works:' : 'Como Funciona:'}</h5>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  <li>{isEn ? 'During the Team Building Phase, the Leader chooses:' : 'Durante a Fase de Formação de Equipe, o Líder escolhe:'}
                    <ol className="list-decimal pl-4 mt-1">
                      <li>{isEn ? 'Which players will be on the team' : 'Quais jogadores estarão na equipe'}</li>
                      <li>{isEn ? 'Which mission the team will attempt' : 'Qual missão a equipe tentará completar'}</li>
                    </ol>
                  </li>
                  <li>{isEn ? 'Use the round marker to indicate which mission was selected' : 'Use o marcador de rodada para indicar qual missão foi selecionada'}</li>
                  <li>{isEn ? 'The number of players on the team must match the requirement of the chosen mission' : 'O número de jogadores na equipe deve corresponder ao requisito da missão escolhida'}</li>
                </ul>
              </Box>
              <Box type="tip">
                <p className="text-xs">💡 <strong>{isEn ? 'Example' : 'Exemplo'}:</strong> {isEn
                  ? 'The leader decides to start with the 3rd mission, which requires 4 members. The leader chooses 4 players for the team and places the round marker on the 3rd mission before calling the vote.'
                  : 'O líder decide começar pela 3ª missão, que requer 4 membros. O líder escolhe 4 jogadores para a equipe e coloca o marcador de rodada na 3ª missão antes de pedir a votação.'
                }</p>
              </Box>
              <Box type="warning">
                <h5 className="font-bold text-xs mb-2">{isEn ? 'Important Rules:' : 'Regras Importantes:'}</h5>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  <li>{isEn ? 'The 5th mission can only be attempted after at least 2 other missions are completed' : 'A 5ª missão só pode ser tentada após pelo menos 2 outras missões serem finalizadas'}</li>
                  <li>{isEn ? 'An attempted mission cannot be attempted again' : 'Uma missão tentada não pode ser tentada novamente'}</li>
                  <li>{isEn ? 'For 7+ players, the 4th mission still requires 2 Fail cards to fail' : 'Para 7+ jogadores, a 4ª missão ainda requer 2 cartas Fail (Falha) para falhar'}</li>
                  <li>{isEn ? 'After the mission, place the corresponding scoring marker on the attempted mission space' : 'Após a missão, coloque o marcador de pontuação correspondente no espaço da missão tentada'}</li>
                </ul>
              </Box>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#ffd700] mb-3 font-['Cinzel']">🗡️ Excalibur</h4>
              <p className="text-sm text-[#e0e0e0] mb-3">{isEn
                ? <>Excalibur allows a team member to <strong>alter the mission outcome</strong> by swapping the card played by another player.</>
                : <>Excalibur permite a um membro da equipe <strong>alterar o resultado da missão</strong> trocando a carta jogada por outro jogador.</>
              }</p>
              <Box type="highlight">
                <h5 className="font-bold text-xs mb-2">{isEn ? 'How It Works:' : 'Como Funciona:'}</h5>
                <ul className="list-disc pl-5 text-xs space-y-2">
                  <li><strong>{isEn ? 'Formation Phase:' : 'Fase de Formação:'}</strong> {isEn ? 'The Leader gives Excalibur to ONE team member (cannot keep it himself)' : 'O Líder dá Excalibur a UM jogador da equipe (não pode ser ele mesmo)'}</li>
                  <li><strong>{isEn ? 'Mission Phase:' : 'Fase da Missão:'}</strong> {isEn ? <>Each player places their card face down <strong>in front of them</strong></> : <>Cada jogador coloca sua carta virada para baixo <strong>na sua frente</strong></>}</li>
                  <li><strong>{isEn ? 'Excalibur Power:' : 'Poder de Excalibur:'}</strong> {isEn ? <>BEFORE collecting cards, the Excalibur holder can force ONE other player to <strong>swap</strong> their card</> : <>ANTES de coletar as cartas, o jogador com Excalibur pode mandar UM outro jogador <strong>trocar</strong> sua carta</>}</li>
                  <li><strong>{isEn ? 'Revelation:' : 'Revelação:'}</strong> {isEn ? <>The Excalibur holder <strong>looks</strong> at the card that was originally played by the other player</> : <>O jogador com Excalibur <strong>olha</strong> a carta que foi originalmente jogada pelo outro jogador</>}</li>
                  <li>{isEn ? 'The Leader then collects and shuffles the cards normally' : 'O Líder então coleta e embaralha as cartas normalmente'}</li>
                </ul>
              </Box>
              <Box type="tip">
                <p className="text-xs">💡 <strong>{isEn ? 'Example' : 'Exemplo'}:</strong> {isEn
                  ? 'Maria uses Excalibur and forces Pedro to swap his card. Maria looks at Pedro\'s original card (it was Success) and realizes her swap condemned the mission to failure!'
                  : 'Maria usa Excalibur e manda Pedro trocar sua carta. Maria olha a carta original de Pedro (era Sucesso) e percebe que sua troca condenou a missão ao fracasso!'
                }</p>
              </Box>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#ffd700] mb-3 font-['Cinzel']">💧 <Term pt={isEn ? 'Lady of the Lake' : 'Dama do Lago'} en="Lady of the Lake" /></h4>
              <p className="text-sm text-[#e0e0e0] mb-3">{isEn
                ? 'Recommended for 7+ players. Allows a player to secretly examine the loyalty of another player.'
                : 'Recomendado para 7+ jogadores. Permite que um jogador examine secretamente a lealdade de outro jogador.'
              }</p>
              <Box type="highlight">
                <h5 className="font-bold text-xs mb-2">{isEn ? 'Setup:' : 'Preparação:'}</h5>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  <li>{isEn
                    ? <>Give the <Term pt="Lady of the Lake" en="Lady of the Lake" /> token to the player to the <strong>right</strong> of the first Leader</>
                    : <>Dê o token <Term pt="Dama do Lago" en="Lady of the Lake" /> ao jogador à <strong>direita</strong> do Líder inicial</>
                  }</li>
                  <li>{isEn
                    ? <>Prepare 2 <strong><Term pt="Loyalty Cards" en="Loyalty Cards" /></strong>: one for GOOD (blue) and one for EVIL (red)</>
                    : <>Prepare 2 <strong><Term pt="Cartas de Lealdade" en="Loyalty Cards" /></strong>: uma do BEM (azul) e uma do MAL (vermelha)</>
                  }</li>
                </ul>
              </Box>
              <Box type="tip">
                <h5 className="font-bold text-xs mb-2">{isEn ? 'How to Use:' : 'Como Usar:'}</h5>
                <ul className="list-disc pl-5 text-xs space-y-2">
                  <li>{isEn ? <>After the <strong>2nd, 3rd and 4th missions</strong>, the holder chooses another player to examine</> : <>Após a <strong>2ª, 3ª e 4ª missões</strong>, o portador escolhe outro jogador para examinar</>}</li>
                  <li>{isEn ? 'The examined player secretly passes the card matching their loyalty' : 'O jogador examinado passa secretamente a carta correspondente à sua lealdade'}</li>
                  <li>{isEn ? <>The Lady of the Lake sees the loyalty, can discuss, but <strong>cannot reveal the card</strong></> : <>A Dama do Lago vê a lealdade, pode discutir, mas <strong>não pode revelar a carta</strong></>}</li>
                  <li>{isEn ? <>The examined player <strong>receives the token</strong></> : <>O jogador examinado <strong>recebe o token</strong></>}</li>
                  <li>{isEn ? <>A player who has already used the Lady of the Lake <strong>cannot</strong> be examined</> : <>Um jogador que já usou a Dama do Lago <strong>não pode</strong> ser examinado</>}</li>
                </ul>
              </Box>
              <Box type="warning">
                <p className="text-xs">⚠️ <strong>{isEn ? 'Important' : 'Importante'}:</strong> {isEn ? 'Passing the wrong card results in automatic loss!' : 'Passar a carta errada resulta em perda automática!'}</p>
              </Box>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#ffd700] mb-3 font-['Cinzel']">🔄 {isEn ? 'Lancelot — Complex Character' : 'Lancelot — Personagem Complexo'}</h4>
              <p className="text-sm text-[#e0e0e0] mb-3">{isEn
                ? 'Players never swap their Character cards. Only loyalty can change.'
                : 'Os jogadores nunca trocam suas cartas de Personagem. Apenas a lealdade pode mudar.'
              }</p>

              <h5 className="text-xs font-bold text-[#ffd700] mt-4 mb-2">{isEn ? 'Variant 1 — Lancelot Switches Sides During the Game:' : 'Variante 1 — Lancelot Troca de Lado Durante o Jogo:'}</h5>
              <Box type="highlight">
                <h5 className="font-bold text-xs mb-2">{isEn ? 'Setup:' : 'Preparação:'}</h5>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  <li>{isEn
                    ? <>Create <strong>Loyalty Deck</strong> with: 3 <strong><Term pt="No Change" en="No Change" /></strong> cards + 2 <strong><Term pt="Switch Allegiance" en="Switch Allegiance" /></strong> cards</>
                    : <>Crie <strong>Baralho de Lealdade</strong> com: 3 cartas <strong><Term pt="Sem Mudança" en="No Change" /></strong> + 2 cartas <strong><Term pt="Trocar de Lado" en="Switch Allegiance" /></strong></>
                  }</li>
                </ul>
              </Box>
              <ScriptBox>
                <p className="text-[#ff6282]">"Minions de Mordred, incluindo Lancelot do Mal, estendam o polegar para Merlin"</p>
                <p className="text-[#82a1fd]">"Merlin, abra os olhos e veja o mal (Lancelot do Mal levanta o polegar, mas Merlin não sabe que ele é o Lancelot)"</p>
                <p className="text-[#82a1fd]">"Merlin, feche os olhos. Minions, abaixem o polegar"</p>
              </ScriptBox>
              <Box type="tip">
                <h5 className="font-bold text-xs mb-2">{isEn ? 'During the Game:' : 'Durante o Jogo:'}</h5>
                <p className="text-xs">{isEn ? <>From <strong>round 3</strong>, flip 1 card from the deck:</> : <>A partir da <strong>3ª rodada</strong>, vire 1 carta do baralho:</>}</p>
                <ul className="list-disc pl-5 text-xs mt-1 space-y-1">
                  <li><em>{isEn ? 'No Change' : 'Sem Mudança'}</em>: {isEn ? 'Nothing happens' : 'Nada acontece'}</li>
                  <li><em>{isEn ? 'Switch Allegiance' : 'Trocar de Lado'}</em>: {isEn ? 'Both Lancelots SWITCH SIDES secretly!' : 'Os dois Lancelots TROCAM DE LADO secretamente!'}</li>
                </ul>
              </Box>

              <h5 className="text-xs font-bold text-[#ffd700] mt-6 mb-2">{isEn ? 'Variant 2 — Switches Known in Advance:' : 'Variante 2 — Trocas Conhecidas Antecipadamente:'}</h5>
              <Box type="highlight">
                <p className="text-xs">{isEn ? 'The first 5 cards of the deck are revealed at the start. Everyone knows WHEN the switches will happen.' : 'As 5 primeiras cartas do baralho são reveladas no início. Todos sabem QUANDO as trocas acontecerão.'}</p>
              </Box>

              <h5 className="text-xs font-bold text-[#ffd700] mt-6 mb-2">{isEn ? 'Variant 3 — Lancelots Recognize Each Other:' : 'Variante 3 — Lancelots se Conhecem:'}</h5>
              <Box type="highlight">
                <p className="text-xs">{isEn ? 'The two Lancelots recognize each other at the start of the game.' : 'Os dois Lancelots se reconhecem apenas entre si no início do jogo.'}</p>
              </Box>

              <Box type="warning">
                <p className="text-xs">⚠️ <strong>{isEn ? 'Attention' : 'Atenção'}:</strong> {isEn ? 'Lancelots greatly increase the complexity of the game. Recommended only for experienced players.' : 'Lancelots aumentam muito a complexidade do jogo. Recomendado apenas para jogadores experientes.'}</p>
              </Box>
            </div>
          </div>
        );
      }
    },
    {
      id: 'dicas',
      title: t('manual.section_dicas_title'),
      icon: <Lightbulb size={20} />,
      searchText: 'Dicas Estratégicas Para o BEM Para o MAL Dicas Gerais',
      render: () => {
        const isEn = i18n.language === 'en';
        return (
          <div className="space-y-6">
            <Box type="highlight">
              <h4 className="font-bold text-xs mb-2">🛡️ {isEn ? 'For GOOD:' : 'Para o BEM:'}</h4>
              <ul className="list-disc pl-5 text-xs space-y-1">
                <li>{isEn ? 'Discuss A LOT before approving any team' : 'Discuta MUITO antes de aprovar qualquer equipe'}</li>
                <li>{isEn ? 'Observe voting patterns (who approves/rejects frequently)' : 'Observe padrões de votação (quem aprova/rejeita frequentemente)'}</li>
                <li>{isEn ? 'Do not be afraid to reject suspicious teams' : 'Não tenha medo de rejeitar equipes suspeitas'}</li>
                <li>{isEn ? 'Merlin: be subtle! Use votes and indirect comments' : 'Merlin: seja sutil! Use votos e comentários indiretos'}</li>
                <li>{isEn ? "Percival: protect Merlin without revealing who he is" : 'Percival: proteja Merlin sem revelar quem ele é'}</li>
              </ul>
            </Box>

            <Box type="evil">
              <h4 className="font-bold text-xs mb-2">💀 {isEn ? 'For EVIL:' : 'Para o MAL:'}</h4>
              <ul className="list-disc pl-5 text-xs space-y-1">
                <li>{isEn ? 'Coordinate with your allies without being obvious' : 'Coordene-se com seus aliados sem ser óbvio'}</li>
                <li>{isEn ? 'Sometimes, playing SUCCESS can create more confusion' : 'Às vezes, jogar SUCESSO pode gerar mais confusão'}</li>
                <li>{isEn ? 'Accuse other players to deflect suspicion' : 'Acuse outros jogadores para desviar suspeitas'}</li>
                <li>{isEn ? 'Watch who Merlin may be protecting or accusing' : 'Observe quem Merlin pode estar protegendo ou acusando'}</li>
                <li>{isEn ? 'In the assassination attempt, choose the "wisest" player' : 'Na tentativa de assassinato, escolham o jogador mais "sábio"'}</li>
              </ul>
            </Box>

            <Box type="tip">
              <h4 className="font-bold text-xs mb-2">💡 {isEn ? 'General Tips:' : 'Dicas Gerais:'}</h4>
              <ul className="list-disc pl-5 text-xs space-y-1">
                <li><strong>{isEn ? 'Communicate!' : 'Comunique-se!'}</strong> {isEn ? 'The game lives on discussion' : 'O jogo vive da discussão'}</li>
                <li>{isEn ? 'Bluffing is allowed and encouraged' : 'Blefar é permitido e incentivado'}</li>
                <li>{isEn ? 'Pay attention to the emotional reactions of players' : 'Preste atenção nas reações emocionais dos jogadores'}</li>
                <li>{isEn ? '"Use logic: If X were evil, why would he do Y?"' : 'Use a lógica: "Se X fosse do mal, por que faria Y?"'}</li>
                <li>{isEn ? 'Remember: a close vote does not necessarily mean evil' : 'Lembre-se: votação apertada não significa necessariamente mal'}</li>
              </ul>
            </Box>
          </div>
        );
      }
    }
  ], [t]);

  // --- Search Logic ---

  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];

    const normalizedQuery = normalizeText(searchQuery);
    const results: { section: ManualSection; snippet: React.ReactNode }[] = [];

    sections.forEach(section => {
      const normalizedContent = normalizeText(section.searchText);
      if (normalizedContent.includes(normalizedQuery)) {
        // Find a snippet around the match
        const index = normalizedContent.indexOf(normalizedQuery);
        const start = Math.max(0, index - 60);
        const end = Math.min(section.searchText.length, index + normalizedQuery.length + 60);
        let snippet = section.searchText.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < section.searchText.length) snippet = snippet + '...';

        results.push({
          section,
          snippet: highlightMatch(snippet, searchQuery)
        });
      }
    });

    return results;
  }, [searchQuery, sections]);

  // --- Handlers ---

  const handleSectionClick = (id: string, query?: string) => {
    // We MUST clear the search query to switch back to Accordion View
    // so the elements we want to scroll to actually exist in the DOM.
    const currentQuery = query || searchQuery;
    setSearchQuery('');
    setActiveSection(id);

    // Scroll to section
    setTimeout(() => {
      const sectionElement = document.getElementById(`section-${id}`);
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // If there was a query, try to find the specific text within the section
        if (currentQuery && currentQuery.length >= 2) {
          setTimeout(() => {
            const walker = document.createTreeWalker(sectionElement, NodeFilter.SHOW_TEXT, null);
            let node;
            const normalizedQuery = normalizeText(currentQuery);

            while (node = walker.nextNode()) {
              if (normalizeText(node.textContent || '').includes(normalizedQuery)) {
                const parent = node.parentElement;
                if (parent) {
                  parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  parent.classList.add('search-highlight-temp');
                  setTimeout(() => parent.classList.remove('search-highlight-temp'), 2000);
                  break;
                }
              }
            }
          }, 400); // Wait for accordion expansion
        }
      }
    }, 150); // Slightly longer delay to ensure React has rendered the Accordion View
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-[900px] bg-[#0d1b2a] md:rounded-3xl border border-[#4a5f7f] flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="p-4 border-b border-[#4a5f7f] flex flex-col gap-4 bg-[#1e2d45]/50">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.3em] text-[#b8956a] font-['Cinzel']">{t('manual.subtitle')}</span>
                <h2 className="text-2xl font-bold text-[#ffd700] font-['Cinzel'] tracking-[0.2em]">{t('manual.title')}</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block px-3 py-1 rounded-full border border-[#ffd700]/30 bg-[#1e2d45] text-[#ffd700] text-[10px] font-bold uppercase tracking-widest">
                  {t('manual.rulesManual')}
                </span>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-[#ffd700]"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                placeholder={t('manual.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1e2d45]/80 border border-[#4a5f7f] focus:border-[#ffd700] rounded-xl py-2.5 pl-10 pr-10 text-sm text-white outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div ref={contentRef} className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-[#0d1b2a]">
            {searchQuery.length >= 2 ? (
              /* Search Results View */
              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-widest text-[#b8956a] font-bold mb-4">
                  {t('manual.searchResultsFor', { query: searchQuery })}
                </h3>
                {searchResults.length > 0 ? (
                  searchResults.map((result, i) => (
                    <button
                      key={i}
                      onClick={() => handleSectionClick(result.section.id, searchQuery)}
                      className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#ffd700]/30 transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[#ffd700] opacity-50">{result.section.icon}</span>
                        <span className="text-[10px] uppercase tracking-widest text-[#ffd700] font-bold">
                          {result.section.title}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed italic">
                        {result.snippet}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12 space-y-4">
                    <Search size={48} className="mx-auto text-gray-700" />
                    <p className="text-gray-500">
                      {t('manual.noResults', { query: searchQuery })}<br />
                      <span className="text-xs">{t('manual.tryOtherTerm')}</span>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Accordion View */
              <div className="space-y-4">
                {sections.map(section => (
                  <div key={section.id} id={`section-${section.id}`} className="scroll-mt-4">
                    <button
                      onClick={() => handleSectionClick(section.id)}
                      className={`
                        w-full flex items-center justify-between p-4 rounded-xl border transition-all
                        ${activeSection === section.id
                          ? 'bg-[#1e2d45] border-[#ffd700] shadow-[0_0_20px_rgba(255,215,0,0.1)]'
                          : 'bg-white/5 border-white/10 hover:border-white/20'}
                      `}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${activeSection === section.id ? 'bg-[#ffd700] text-[#0d1b2a]' : 'bg-white/5 text-[#ffd700]'}`}>
                          {section.icon}
                        </div>
                        <h3 className={`text-lg font-bold font-['Cinzel'] tracking-widest ${activeSection === section.id ? 'text-[#ffd700]' : 'text-[#e0e0e0]'}`}>
                          {section.title}
                        </h3>
                      </div>
                      <ChevronDown
                        size={20}
                        className={`text-gray-500 transition-transform duration-300 ${activeSection === section.id ? 'rotate-180 text-[#ffd700]' : ''}`}
                      />
                    </button>

                    <AnimatePresence>
                      {activeSection === section.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 md:p-6 border-x border-b border-[#ffd700]/20 rounded-b-xl bg-[#1e2d45]/20">
                            {section.render()}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#4a5f7f] bg-[#1e2d45]/30 text-center">
            <p className="text-[10px] text-[#b8956a] font-['Cinzel'] tracking-widest">
              {t('manual.footer_credit')}
            </p>
            <p className="text-[8px] text-gray-500 mt-1">
              {t('manual.footer_adapted')}
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
