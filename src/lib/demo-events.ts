import { AgentRole, AgentStatus, EventCategory, AgentEvent } from './types';
import { eventStore } from './event-store';

let demoRunning = false;

interface DemoAction {
  action: string;
  category: EventCategory;
  status: AgentStatus;
}

const DEMO_ACTIONS: Record<AgentRole, DemoAction[]> = {
  director: [
    { action: 'Routing incoming bid package to Senior Estimator', category: 'routing', status: 'working' },
    { action: 'Reviewing Junior Estimator RFP draft for HVAC scope', category: 'review', status: 'reviewing' },
    { action: 'Approving subcontractor agreement for concrete package', category: 'approval', status: 'working' },
    { action: 'Orchestrating scope handoff between estimating teams', category: 'orchestration', status: 'working' },
    { action: 'Reviewing final budget submission for Building C', category: 'review', status: 'reviewing' },
    { action: 'Routing RFI response to project owner', category: 'routing', status: 'working' },
    { action: 'Approving purchase order for structural steel', category: 'approval', status: 'working' },
    { action: 'Waiting for owner response on VE items', category: 'orchestration', status: 'waiting' },
  ],
  'senior-estimator': [
    { action: 'Analyzing mechanical scope for Building A — Phase 3', category: 'scope-analysis', status: 'working' },
    { action: 'Leveling bids from 3 HVAC contractors', category: 'bid-leveling', status: 'working' },
    { action: 'Updating Q2 budget forecast with revised steel pricing', category: 'budgeting', status: 'working' },
    { action: 'Running pricing intelligence on concrete rates — metro region', category: 'pricing', status: 'working' },
    { action: 'Scope analysis complete for electrical — 6 phases identified', category: 'scope-analysis', status: 'idle' },
    { action: 'Comparing historical pricing for fire protection scope', category: 'pricing', status: 'working' },
    { action: 'Building consolidated scope from drawing set Rev D', category: 'scope-analysis', status: 'working' },
    { action: 'Generating value engineering alternatives for MEP package', category: 'budgeting', status: 'working' },
  ],
  'junior-estimator': [
    { action: 'Preparing RFP for electrical scope — 4 bidders targeted', category: 'rfp', status: 'working' },
    { action: 'Processing RFI #47 response from structural engineer', category: 'rfi', status: 'working' },
    { action: 'Capturing historical pricing data from completed Project Meridian', category: 'historical-data', status: 'working' },
    { action: 'Drafting client proposal for Phase 2 tenant improvements', category: 'proposal', status: 'working' },
    { action: 'Logging RFI #48 — glazing spec clarification needed', category: 'rfi', status: 'working' },
    { action: 'Backfilling pricing database with Q1 bid results', category: 'historical-data', status: 'working' },
    { action: 'Comparing scope between Addendum 3 and original drawings', category: 'rfp', status: 'reviewing' },
    { action: 'Finalizing RFP package for plumbing scope', category: 'rfp', status: 'working' },
  ],
  procurement: [
    { action: 'Reviewing COI from ABC Mechanical — expiry check', category: 'coi', status: 'reviewing' },
    { action: 'Generating purchase order PO-2024-089 for rebar', category: 'purchase-order', status: 'working' },
    { action: 'Processing buyout for concrete package — 3 subs qualified', category: 'buyout', status: 'working' },
    { action: 'Drafting sub agreement for Delta Electric', category: 'sub-agreement', status: 'working' },
    { action: 'Extracting key terms from owner contract Section 7', category: 'contract', status: 'working' },
    { action: 'Verifying insurance tracking for all active subcontractors', category: 'coi', status: 'working' },
    { action: 'Creating buyout package for drywall and framing scope', category: 'buyout', status: 'working' },
    { action: 'Issuing purchase order for elevator equipment', category: 'purchase-order', status: 'working' },
  ],
  administrator: [
    { action: 'Logging submittal #234 — mechanical equipment schedules', category: 'submittal', status: 'working' },
    { action: 'Transcribing weekly OAC meeting notes', category: 'meeting-notes', status: 'working' },
    { action: 'Updating drawing log with Revision D set — 47 sheets', category: 'drawing-log', status: 'working' },
    { action: 'Syncing CRM contacts for new project stakeholders', category: 'crm', status: 'working' },
    { action: 'Generating transmittal for structural shop drawings', category: 'doc-control', status: 'working' },
    { action: 'Processing submittal #235 — fire alarm shop drawings', category: 'submittal', status: 'working' },
    { action: 'Archiving closed-out RFI responses to project record', category: 'doc-control', status: 'working' },
    { action: 'Updating meeting notes distribution list', category: 'meeting-notes', status: 'idle' },
  ],
};

const ROLES: AgentRole[] = ['director', 'senior-estimator', 'junior-estimator', 'procurement', 'administrator'];

let eventCounter = 0;

function generateEvent(): AgentEvent {
  const role = ROLES[Math.floor(Math.random() * ROLES.length)];
  const actions = DEMO_ACTIONS[role];
  const chosen = actions[Math.floor(Math.random() * actions.length)];
  eventCounter++;

  return {
    id: `demo-${Date.now()}-${eventCounter}`,
    agentRole: role,
    status: chosen.status,
    action: chosen.action,
    category: chosen.category,
    timestamp: new Date().toISOString(),
  };
}

function scheduleNext() {
  if (!demoRunning) return;
  const delay = 3000 + Math.random() * 5000; // 3-8 seconds
  setTimeout(() => {
    if (!demoRunning) return;
    const event = generateEvent();
    eventStore.pushEvent(event);
    scheduleNext();
  }, delay);
}

export function startDemo() {
  if (demoRunning) return;
  demoRunning = true;

  // Seed a few initial events immediately
  for (let i = 0; i < 8; i++) {
    const event = generateEvent();
    event.timestamp = new Date(Date.now() - (8 - i) * 10000).toISOString();
    eventStore.pushEvent(event);
  }

  scheduleNext();
}

export function stopDemo() {
  demoRunning = false;
}
