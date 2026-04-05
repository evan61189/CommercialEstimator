export type AgentRole =
  | 'director'
  | 'senior-estimator'
  | 'junior-estimator'
  | 'procurement'
  | 'administrator';

export type AgentStatus = 'idle' | 'working' | 'reviewing' | 'waiting' | 'error';

export type EventCategory =
  // Director
  | 'orchestration' | 'routing' | 'review' | 'approval'
  // Senior Estimator
  | 'scope-analysis' | 'bid-leveling' | 'budgeting' | 'pricing'
  // Junior Estimator
  | 'rfp' | 'rfi' | 'proposal' | 'historical-data'
  // Procurement
  | 'contract' | 'coi' | 'sub-agreement' | 'purchase-order' | 'buyout'
  // Administrator
  | 'submittal' | 'meeting-notes' | 'drawing-log' | 'crm' | 'doc-control';

export interface AgentEvent {
  id: string;
  agentRole: AgentRole;
  status: AgentStatus;
  action: string;
  category: EventCategory;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AgentDefinition {
  role: AgentRole;
  displayName: string;
  description: string;
  accentColor: string;
  categories: EventCategory[];
}

export interface AgentSnapshot {
  role: AgentRole;
  status: AgentStatus;
  currentAction: string | null;
  lastActivityAt: string | null;
  eventCount: number;
}

export interface SSEInitPayload {
  agents: AgentSnapshot[];
  recentEvents: AgentEvent[];
}

export interface SSEActivityPayload {
  event: AgentEvent;
  snapshot: AgentSnapshot;
}
