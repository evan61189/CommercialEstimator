import { NextResponse } from 'next/server';
import { eventStore } from '@/lib/event-store';

export async function GET() {
  return NextResponse.json({ agents: eventStore.getSnapshots() });
}
