'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AgentEvent, AgentSnapshot, SSEInitPayload, SSEActivityPayload } from '@/lib/types';

const MAX_CLIENT_EVENTS = 200;

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function useEventStream() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [agents, setAgents] = useState<AgentSnapshot[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const retryDelay = useRef(1000);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus('connecting');
    const es = new EventSource('/api/events/stream');
    eventSourceRef.current = es;

    es.addEventListener('init', (e: MessageEvent) => {
      const data: SSEInitPayload = JSON.parse(e.data);
      setAgents(data.agents);
      setEvents(data.recentEvents.slice(-MAX_CLIENT_EVENTS));
      setConnectionStatus('connected');
      retryDelay.current = 1000;
    });

    es.addEventListener('activity', (e: MessageEvent) => {
      const data: SSEActivityPayload = JSON.parse(e.data);
      setEvents((prev) => [...prev.slice(-(MAX_CLIENT_EVENTS - 1)), data.event]);
      setAgents((prev) =>
        prev.map((a) => (a.role === data.snapshot.role ? data.snapshot : a))
      );
    });

    es.onerror = () => {
      es.close();
      setConnectionStatus('disconnected');
      const delay = Math.min(retryDelay.current, 30000);
      retryDelay.current = delay * 2;
      setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);

  return { events, agents, connectionStatus };
}
