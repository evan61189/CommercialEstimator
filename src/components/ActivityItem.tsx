import { AgentEvent } from '@/lib/types';
import { AGENT_MAP } from '@/lib/agents';
import { AGENT_COLORS } from '@/config/theme';
import { AgentAvatar } from './AgentAvatar';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function ActivityItem({ event }: { event: AgentEvent }) {
  const def = AGENT_MAP[event.agentRole];
  const colors = AGENT_COLORS[event.agentRole];

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-800/50 transition-colors group">
      <AgentAvatar role={event.agentRole} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs font-medium ${colors.text}`}>{def.displayName}</span>
          <span className="text-[10px] text-gray-600 bg-surface-700/50 px-1.5 py-0.5 rounded">
            {event.category}
          </span>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed truncate">{event.action}</p>
      </div>
      <span className="text-[11px] text-gray-600 shrink-0 tabular-nums pt-0.5">
        {formatTime(event.timestamp)}
      </span>
    </div>
  );
}
