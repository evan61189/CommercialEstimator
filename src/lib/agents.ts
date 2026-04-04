import { AgentDefinition } from './types';

export const AGENTS: AgentDefinition[] = [
  {
    role: 'director',
    displayName: 'The Director',
    description: 'Orchestrates all roles, routes work, reviews & approves',
    accentColor: 'agent-director',
    categories: ['orchestration', 'routing', 'review', 'approval'],
  },
  {
    role: 'senior-estimator',
    displayName: 'Senior Estimator',
    description: 'Scope analysis, bid leveling, budgeting, pricing intelligence',
    accentColor: 'agent-senior',
    categories: ['scope-analysis', 'bid-leveling', 'budgeting', 'pricing'],
  },
  {
    role: 'junior-estimator',
    displayName: 'Junior Estimator',
    description: 'RFPs, RFIs, proposals, historical data capture',
    accentColor: 'agent-junior',
    categories: ['rfp', 'rfi', 'proposal', 'historical-data'],
  },
  {
    role: 'procurement',
    displayName: 'Procurement',
    description: 'Contracts, COIs, sub agreements, purchase orders, buyout',
    accentColor: 'agent-procurement',
    categories: ['contract', 'coi', 'sub-agreement', 'purchase-order', 'buyout'],
  },
  {
    role: 'administrator',
    displayName: 'Administrator',
    description: 'Submittals, meeting notes, drawing logs, CRM, doc control',
    accentColor: 'agent-admin',
    categories: ['submittal', 'meeting-notes', 'drawing-log', 'crm', 'doc-control'],
  },
];

export const AGENT_MAP = Object.fromEntries(
  AGENTS.map((a) => [a.role, a])
) as Record<string, AgentDefinition>;
