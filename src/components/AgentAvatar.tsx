import { AgentRole } from '@/lib/types';
import { AGENT_COLORS } from '@/config/theme';

const ICONS: Record<AgentRole, string> = {
  director: 'D',
  'senior-estimator': 'SE',
  'junior-estimator': 'JE',
  procurement: 'P',
  administrator: 'A',
};

export function AgentAvatar({ role, size = 'md' }: { role: AgentRole; size?: 'sm' | 'md' }) {
  const colors = AGENT_COLORS[role];
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-11 h-11 text-sm';

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold border-2 shrink-0`}
      style={{ borderColor: colors.accent, color: colors.accent, backgroundColor: `${colors.accent}15` }}
    >
      {ICONS[role]}
    </div>
  );
}
