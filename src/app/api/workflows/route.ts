import { NextResponse } from 'next/server';
import { getWorkflowList } from '@/workflows';

/** GET /api/workflows — list all available workflows */
export async function GET() {
  return NextResponse.json({ workflows: getWorkflowList() });
}
