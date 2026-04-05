'use client';

import { useEventStream } from '@/hooks/useEventStream';
import { AgentCard } from './AgentCard';
import { ActivityFeed } from './ActivityFeed';
import { ConnectionStatus } from './ConnectionStatus';
import { WorkflowLauncher } from './WorkflowLauncher';
import { AGENTS } from '@/lib/agents';
import { AgentSnapshot } from '@/lib/types';

// Default snapshots when Supabase isn't connected yet
const DEFAULT_SNAPSHOTS: AgentSnapshot[] = AGENTS.map((a) => ({
  role: a.role,
  status: 'idle' as const,
  currentAction: null,
  lastActivityAt: null,
  eventCount: 0,
}));

export function Dashboard() {
  const { events, agents, connectionStatus } = useEventStream();
  const displayAgents = agents.length > 0 ? agents : DEFAULT_SNAPSHOTS;

  return (
    <div className="min-h-screen bg-surface-900">
      {/* Header */}
      <header className="border-b border-surface-700 bg-surface-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-agent-senior font-medium mb-1">
              Built in Claude Cowork
            </p>
            <h1 className="text-xl font-bold text-gray-100">
              Preconstruction AI Command Center
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ConnectionStatus status={connectionStatus} />
            <div className="text-[11px] text-gray-500 border-l border-surface-700 pl-4">
              {displayAgents.filter((a) => a.status === 'working' || a.status === 'reviewing').length} / {displayAgents.length} active
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Actions', value: displayAgents.reduce((s, a) => s + a.eventCount, 0) },
            { label: 'AI Roles', value: displayAgents.length },
            { label: 'Active Now', value: displayAgents.filter((a) => a.status !== 'idle').length },
            { label: 'Events Streamed', value: events.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface-800 border border-surface-700 rounded-lg px-4 py-3 text-center">
              <div className="text-2xl font-bold text-gray-100">{stat.value}</div>
              <div className="text-[11px] uppercase tracking-wider text-gray-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Agent Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {displayAgents.map((snapshot) => (
            <AgentCard key={snapshot.role} snapshot={snapshot} />
          ))}
        </div>

        {/* Workflow Launcher */}
        <WorkflowLauncher />

        {/* Activity Feed */}
        <div className="h-[500px]">
          <ActivityFeed events={events} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-700 mt-8">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between text-[11px] text-gray-600">
          <span>Powered by <span className="text-gray-400 font-medium">Claude Cowork</span> from Anthropic</span>
          <span>Built by a GC estimator. Zero coding background.</span>
        </div>
      </footer>
    </div>
  );
}
