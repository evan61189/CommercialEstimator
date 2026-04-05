'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { AgentEvent, AgentSnapshot } from '@/lib/types';

const MAX_CLIENT_EVENTS = 200;

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

function mapEventRow(row: Record<string, unknown>): AgentEvent {
  return {
    id: row.id as string,
    agentRole: row.agent_role as AgentEvent['agentRole'],
    status: row.status as AgentEvent['status'],
    action: row.action as string,
    category: row.category as AgentEvent['category'],
    timestamp: row.created_at as string,
    metadata: (row.metadata as Record<string, unknown>) || {},
  };
}

function mapSnapshotRow(row: Record<string, unknown>): AgentSnapshot {
  return {
    role: row.role as AgentSnapshot['role'],
    status: row.status as AgentSnapshot['status'],
    currentAction: row.current_action as string | null,
    lastActivityAt: row.last_activity_at as string | null,
    eventCount: row.event_count as number,
  };
}

export function useEventStream() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [agents, setAgents] = useState<AgentSnapshot[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const channelRef = useRef<RealtimeChannel | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fetch initial state
  const loadInitialState = useCallback(async () => {
    if (!supabaseUrl || !supabaseKey) {
      setConnectionStatus('disconnected');
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const [eventsRes, snapshotsRes] = await Promise.all([
      supabase
        .from('agent_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_CLIENT_EVENTS),
      supabase.from('agent_snapshots').select('*').order('role'),
    ]);

    if (eventsRes.data) {
      setEvents(eventsRes.data.reverse().map(mapEventRow));
    }
    if (snapshotsRes.data) {
      setAgents(snapshotsRes.data.map(mapSnapshotRow));
    }

    return supabase;
  }, [supabaseUrl, supabaseKey]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const supabase = await loadInitialState();
      if (!supabase || !mounted) return;

      // Subscribe to new events via Supabase Realtime
      const channel = supabase
        .channel('agent-activity')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'agent_events' },
          (payload) => {
            if (!mounted) return;
            const newEvent = mapEventRow(payload.new);
            setEvents((prev) => [...prev.slice(-(MAX_CLIENT_EVENTS - 1)), newEvent]);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'agent_snapshots' },
          (payload) => {
            if (!mounted) return;
            const updated = mapSnapshotRow(payload.new);
            setAgents((prev) =>
              prev.map((a) => (a.role === updated.role ? updated : a))
            );
          }
        )
        .subscribe((status) => {
          if (!mounted) return;
          if (status === 'SUBSCRIBED') setConnectionStatus('connected');
          else if (status === 'CLOSED') setConnectionStatus('disconnected');
          else setConnectionStatus('connecting');
        });

      channelRef.current = channel;
    }

    init();

    return () => {
      mounted = false;
      channelRef.current?.unsubscribe();
    };
  }, [loadInitialState]);

  return { events, agents, connectionStatus };
}
