import { NextRequest, NextResponse } from 'next/server';
import { eventStore } from '@/lib/event-store';
import { AgentEvent, AgentRole, AgentStatus, EventCategory } from '@/lib/types';
import { AGENTS } from '@/lib/agents';

const VALID_ROLES = new Set(AGENTS.map((a) => a.role));
const VALID_STATUSES = new Set<AgentStatus>(['idle', 'working', 'reviewing', 'waiting', 'error']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentRole, status, action, category, metadata } = body;

    if (!agentRole || !VALID_ROLES.has(agentRole)) {
      return NextResponse.json({ error: 'Invalid agentRole' }, { status: 400 });
    }
    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const event: AgentEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentRole: agentRole as AgentRole,
      status: status as AgentStatus,
      action,
      category: (category || 'orchestration') as EventCategory,
      timestamp: new Date().toISOString(),
      metadata,
    };

    const snapshot = eventStore.pushEvent(event);
    return NextResponse.json({ event, snapshot }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role') as AgentRole | null;
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const events = eventStore.getEvents(limit, role || undefined);
  return NextResponse.json({ events });
}
