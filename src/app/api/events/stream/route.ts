import { NextResponse } from 'next/server';
import { startDemo } from '@/lib/demo-events';

export const dynamic = 'force-dynamic';

/**
 * GET /api/events/stream
 * In demo mode, starts the simulated event generator.
 * Real-time updates come through Supabase Realtime on the client.
 */
export async function GET() {
  const demoMode = process.env.DEMO_MODE === 'true';

  if (demoMode) {
    await startDemo();
    return NextResponse.json({
      status: 'demo_started',
      message: 'Demo event generator running. Events will appear via Supabase Realtime.',
    });
  }

  return NextResponse.json({
    status: 'ok',
    message: 'Agents push events via POST /api/events. Dashboard receives them via Supabase Realtime.',
  });
}
