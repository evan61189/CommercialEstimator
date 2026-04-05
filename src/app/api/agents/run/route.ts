import { NextRequest, NextResponse } from 'next/server';
import { agents } from '@/agents';
import { AgentRole, EventCategory } from '@/lib/types';

/**
 * POST /api/agents/run
 * Trigger a specific agent to execute a task using Claude Opus.
 *
 * Body:
 * {
 *   "agentRole": "senior-estimator",
 *   "instruction": "Analyze the mechanical scope from drawing set M-101 through M-115",
 *   "category": "scope-analysis",
 *   "metadata": { "projectId": "PRJ-2024-001" }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentRole, instruction, category, metadata } = body;

    if (!agentRole || !agents[agentRole as AgentRole]) {
      return NextResponse.json(
        { error: `Invalid agentRole. Must be one of: ${Object.keys(agents).join(', ')}` },
        { status: 400 }
      );
    }
    if (!instruction || typeof instruction !== 'string') {
      return NextResponse.json({ error: 'instruction is required' }, { status: 400 });
    }

    const agent = agents[agentRole as AgentRole];
    const result = await agent.executeTask({
      instruction,
      category: (category || agent.role === 'director' ? 'orchestration' : category) as EventCategory,
      metadata,
    });

    return NextResponse.json({
      agentRole,
      agentName: agent.name,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
