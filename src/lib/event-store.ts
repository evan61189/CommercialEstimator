import { AgentEvent, AgentRole, AgentSnapshot } from './types';
import { getSupabaseServer } from './supabase';

/**
 * Supabase-backed event store.
 * All state persists in Postgres — works perfectly on serverless (Netlify).
 * Real-time updates come through Supabase Realtime on the client side.
 */

export async function pushEvent(event: {
  agentRole: AgentRole;
  status: string;
  action: string;
  category: string;
  metadata?: Record<string, unknown>;
}): Promise<{ event: AgentEvent; snapshot: AgentSnapshot }> {
  const supabase = getSupabaseServer();

  // Insert event — the DB trigger auto-updates agent_snapshots
  const { data, error } = await supabase
    .from('agent_events')
    .insert({
      agent_role: event.agentRole,
      status: event.status,
      action: event.action,
      category: event.category,
      metadata: event.metadata || {},
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to push event: ${error.message}`);

  // Fetch updated snapshot
  const { data: snapshot } = await supabase
    .from('agent_snapshots')
    .select()
    .eq('role', event.agentRole)
    .single();

  return {
    event: {
      id: data.id,
      agentRole: data.agent_role,
      status: data.status,
      action: data.action,
      category: data.category,
      timestamp: data.created_at,
      metadata: data.metadata,
    },
    snapshot: snapshot ? {
      role: snapshot.role,
      status: snapshot.status,
      currentAction: snapshot.current_action,
      lastActivityAt: snapshot.last_activity_at,
      eventCount: snapshot.event_count,
    } : {
      role: event.agentRole,
      status: event.status,
      currentAction: event.action,
      lastActivityAt: new Date().toISOString(),
      eventCount: 1,
    },
  };
}

export async function getEvents(limit = 50, agentRole?: AgentRole): Promise<AgentEvent[]> {
  const supabase = getSupabaseServer();
  let query = supabase
    .from('agent_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (agentRole) {
    query = query.eq('agent_role', agentRole);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch events: ${error.message}`);

  return (data || []).reverse().map((row) => ({
    id: row.id,
    agentRole: row.agent_role,
    status: row.status,
    action: row.action,
    category: row.category,
    timestamp: row.created_at,
    metadata: row.metadata,
  }));
}

export async function getSnapshots(): Promise<AgentSnapshot[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('agent_snapshots')
    .select('*')
    .order('role');

  if (error) throw new Error(`Failed to fetch snapshots: ${error.message}`);

  return (data || []).map((row) => ({
    role: row.role,
    status: row.status,
    currentAction: row.current_action,
    lastActivityAt: row.last_activity_at,
    eventCount: row.event_count,
  }));
}
