import { NextRequest, NextResponse } from 'next/server';
import { pushEvent, getEvents } from '@/lib/event-store';
import { AgentRole, AgentStatus, EventCategory } from '@/lib/types';
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

    const result = await pushEvent({
      agentRole: agentRole as AgentRole,
      status: status as AgentStatus,
      action,
      category: (category || 'orchestration') as EventCategory,
      metadata,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') as AgentRole | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const events = await getEvents(limit, role || undefined);
    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
