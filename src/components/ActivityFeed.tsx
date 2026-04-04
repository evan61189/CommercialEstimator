'use client';

import { useEffect, useRef } from 'react';
import { AgentEvent } from '@/lib/types';
import { ActivityItem } from './ActivityItem';

export function ActivityFeed({ events }: { events: AgentEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  const reversed = [...events].reverse();

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
        <h2 className="text-sm font-semibold text-gray-200">Activity Feed</h2>
        <span className="text-[11px] text-gray-500">{events.length} events</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto divide-y divide-surface-700/50">
        {reversed.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-500">
            Waiting for agent activity...
          </div>
        ) : (
          reversed.map((event) => <ActivityItem key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
}
