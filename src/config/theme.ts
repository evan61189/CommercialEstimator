import { AgentRole } from '@/lib/types';

export const AGENT_COLORS: Record<AgentRole, { accent: string; bg: string; border: string; text: string }> = {
  director:          { accent: '#6B8ABA', bg: 'bg-blue-500/5',   border: 'border-l-agent-director',    text: 'text-agent-director' },
  'senior-estimator': { accent: '#D4915C', bg: 'bg-orange-500/5', border: 'border-l-agent-senior',     text: 'text-agent-senior' },
  'junior-estimator': { accent: '#D4A84C', bg: 'bg-amber-500/5',  border: 'border-l-agent-junior',     text: 'text-agent-junior' },
  procurement:        { accent: '#7DA47B', bg: 'bg-green-500/5',  border: 'border-l-agent-procurement', text: 'text-agent-procurement' },
  administrator:      { accent: '#9B8EC4', bg: 'bg-purple-500/5', border: 'border-l-agent-admin',       text: 'text-agent-admin' },
};

export const STATUS_COLORS: Record<string, string> = {
  idle:      'text-gray-400',
  working:   'text-emerald-400',
  reviewing: 'text-amber-400',
  waiting:   'text-blue-400',
  error:     'text-red-400',
};
