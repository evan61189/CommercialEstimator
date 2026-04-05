import { AgentSnapshot } from '@/lib/types';
import { AGENT_MAP } from '@/lib/agents';
import { AGENT_COLORS } from '@/config/theme';
import { AgentAvatar } from './AgentAvatar';
import { StatusBadge } from './StatusBadge';

function timeAgo(iso: string | null): string {
  if (!iso) return 'No activity';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function AgentCard({ snapshot }: { snapshot: AgentSnapshot }) {
  const def = AGENT_MAP[snapshot.role];
  const colors = AGENT_COLORS[snapshot.role];
  const isActive = snapshot.status === 'working' || snapshot.status === 'reviewing';

  return (
    <div
      className={`agent-card border-l-4 ${colors.border} ${colors.bg} ${isActive ? 'ring-1 ring-white/5' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <AgentAvatar role={snapshot.role} />
          <div>
            <h3 className={`font-semibold text-sm ${colors.text}`}>{def.displayName}</h3>
            <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{def.description}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <StatusBadge status={snapshot.status} />
        <span className="text-[11px] text-gray-500">{timeAgo(snapshot.lastActivityAt)}</span>
      </div>

      {snapshot.currentAction && (
        <p className="text-xs text-gray-300 bg-surface-900/50 rounded-lg px-3 py-2 leading-relaxed truncate" title={snapshot.currentAction}>
          {snapshot.currentAction}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
        <span>{snapshot.eventCount} actions logged</span>
        {isActive && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        )}
      </div>
    </div>
  );
}
