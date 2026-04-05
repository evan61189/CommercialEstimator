import { NextRequest, NextResponse } from 'next/server';
import { workflows, executeWorkflow } from '@/workflows';
import { WorkflowContext } from '@/workflows/engine';

/**
 * POST /api/workflows/run
 * Trigger a workflow execution.
 *
 * Body:
 * {
 *   "workflowId": "bid-leveling",
 *   "projectName": "Downtown Office Tower",
 *   "projectNumber": "PRJ-2024-001",
 *   "inputData": "... pasted bid text or scope data ...",
 *   "metadata": { "trade": "Mechanical - HVAC" }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, projectName, projectNumber, inputData, metadata } = body;

    if (!workflowId || !workflows[workflowId]) {
      return NextResponse.json(
        {
          error: `Unknown workflow. Available: ${Object.keys(workflows).join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (!projectName) {
      return NextResponse.json({ error: 'projectName is required' }, { status: 400 });
    }

    if (!inputData) {
      return NextResponse.json({ error: 'inputData is required' }, { status: 400 });
    }

    const definition = workflows[workflowId];

    const context: WorkflowContext = {
      projectName,
      projectNumber: projectNumber || '',
      inputData,
      metadata: metadata || {},
      stepOutputs: {},
      savedFiles: [],
    };

    // Execute the workflow (this calls Claude Opus for each step)
    const result = await executeWorkflow(definition, context);

    return NextResponse.json({
      workflowId: result.workflowId,
      status: result.status,
      stepsCompleted: result.currentStep,
      totalSteps: result.totalSteps,
      savedFiles: result.context.savedFiles,
      error: result.error,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
