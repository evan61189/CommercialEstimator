import { AgentStatus } from '@/lib/types';
import { STATUS_COLORS } from '@/config/theme';

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  working: 'Working',
  reviewing: 'Reviewing',
  waiting: 'Waiting',
  error: 'Error',
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium">
      <span className={`status-dot status-dot-${status}`} />
      <span className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</span>
    </span>
  );
}
