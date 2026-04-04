import { EventEmitter } from 'events';
import { AgentEvent, AgentRole, AgentSnapshot } from './types';
import { AGENTS } from './agents';

const MAX_EVENTS = 1000;

export class EventStore {
  private events: AgentEvent[] = [];
  private snapshots: Map<AgentRole, AgentSnapshot>;
  public emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
    this.snapshots = new Map(
      AGENTS.map((a) => [
        a.role,
        {
          role: a.role,
          status: 'idle' as const,
          currentAction: null,
          lastActivityAt: null,
          eventCount: 0,
        },
      ])
    );
  }

  pushEvent(event: AgentEvent): AgentSnapshot {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }

    const snapshot = this.snapshots.get(event.agentRole)!;
    snapshot.status = event.status;
    snapshot.currentAction = event.action;
    snapshot.lastActivityAt = event.timestamp;
    snapshot.eventCount += 1;

    this.emitter.emit('event', { event, snapshot: { ...snapshot } });
    return { ...snapshot };
  }

  getEvents(limit = 50, agentRole?: AgentRole): AgentEvent[] {
    let filtered = agentRole
      ? this.events.filter((e) => e.agentRole === agentRole)
      : this.events;
    return filtered.slice(-limit);
  }

  getSnapshots(): AgentSnapshot[] {
    return Array.from(this.snapshots.values()).map((s) => ({ ...s }));
  }
}

// Singleton — survives hot reload in dev
const globalKey = '__eventStore';

function getStore(): EventStore {
  const g = globalThis as Record<string, unknown>;
  if (!g[globalKey]) {
    g[globalKey] = new EventStore();
  }
  return g[globalKey] as EventStore;
}

export const eventStore = getStore();
