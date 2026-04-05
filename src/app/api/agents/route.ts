import { NextResponse } from 'next/server';
import { getSnapshots } from '@/lib/event-store';

export async function GET() {
  try {
    const agents = await getSnapshots();
    return NextResponse.json({ agents });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
