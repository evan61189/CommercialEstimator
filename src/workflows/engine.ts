import { AgentRole, EventCategory } from '@/lib/types';
import { pushEvent } from '@/lib/event-store';
import { agents } from '@/agents';
import { getDriveClient } from '@/lib/drive/client';

/**
 * Workflow Engine — orchestrates multi-step agent workflows.
 *
 * A workflow is a series of steps where:
 * 1. An agent processes input with Claude Opus
 * 2. The output (structured JSON) feeds into the next step
 * 3. Files get saved to Google Drive at the right points
 * 4. The Director monitors and approves at checkpoints
 */

export interface WorkflowStep {
  id: string;
  agentRole: AgentRole;
  name: string;
  instruction: string;
  category: EventCategory;
  /** If true, Director must approve before the next step runs */
  requiresApproval?: boolean;
  /** Transform the previous step's output into this step's input */
  inputTransform?: (prevOutput: string, context: WorkflowContext) => string;
  /** After this step, save the output to Google Drive */
  saveOutput?: {
    type: string;
    fileName: string;
    format: 'spreadsheet' | 'document';
  };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface WorkflowContext {
  projectName: string;
  projectNumber?: string;
  inputData: string;            // Raw input (e.g., pasted bid text, drawing notes)
  metadata: Record<string, unknown>;
  stepOutputs: Record<string, string>;  // step.id → Claude's output
  savedFiles: { stepId: string; fileUrl: string; fileName: string }[];
}

export interface WorkflowResult {
  workflowId: string;
  status: 'completed' | 'failed' | 'awaiting-approval';
  context: WorkflowContext;
  currentStep: number;
  totalSteps: number;
  error?: string;
}

export async function executeWorkflow(
  definition: WorkflowDefinition,
  context: WorkflowContext
): Promise<WorkflowResult> {
  const drive = getDriveClient();

  // Director announces workflow start
  await pushEvent({
    agentRole: 'director',
    status: 'working',
    action: `Starting workflow: ${definition.name} for ${context.projectName}`,
    category: 'orchestration',
    metadata: { workflowId: definition.id, projectName: context.projectName },
  });

  for (let i = 0; i < definition.steps.length; i++) {
    const step = definition.steps[i];
    const agent = agents[step.agentRole];

    // Build instruction for this step
    let instruction = step.instruction;
    if (step.inputTransform && i > 0) {
      const prevStepId = definition.steps[i - 1].id;
      const prevOutput = context.stepOutputs[prevStepId] || '';
      instruction = step.inputTransform(prevOutput, context);
    } else if (i === 0) {
      // First step gets the raw input
      instruction = `${step.instruction}\n\nInput data:\n${context.inputData}`;
    }

    // Add JSON output format instruction
    instruction += `\n\nIMPORTANT: Return your response as valid JSON matching the expected output schema. Do not include markdown code fences — return raw JSON only.`;

    try {
      // Execute the step
      const result = await agent.executeTask({
        instruction,
        category: step.category,
        metadata: {
          workflowId: definition.id,
          stepId: step.id,
          stepNumber: i + 1,
          totalSteps: definition.steps.length,
          projectName: context.projectName,
        },
      });

      context.stepOutputs[step.id] = result;

      // Save output to Google Drive if configured
      if (step.saveOutput) {
        try {
          const folderPath = step.saveOutput.type;
          const fileName = step.saveOutput.fileName
            .replace('{projectName}', context.projectName)
            .replace('{date}', new Date().toISOString().split('T')[0])
            .replace('{trade}', (context.metadata.trade as string) || 'General');

          if (step.saveOutput.format === 'spreadsheet') {
            // Parse JSON and create spreadsheet
            const parsed = JSON.parse(result);
            const file = await drive.createSpreadsheet(
              fileName,
              folderPath,
              formatAsSheetData(parsed)
            );
            context.savedFiles.push({
              stepId: step.id,
              fileUrl: file.url,
              fileName: file.name,
            });

            await pushEvent({
              agentRole: step.agentRole,
              status: 'working',
              action: `Saved ${fileName} to Google Drive`,
              category: step.category,
              metadata: { fileUrl: file.url, fileName },
            });
          } else {
            // Save as Google Doc
            const file = await drive.createDocument(fileName, folderPath, result);
            context.savedFiles.push({
              stepId: step.id,
              fileUrl: file.url,
              fileName: file.name,
            });

            await pushEvent({
              agentRole: step.agentRole,
              status: 'working',
              action: `Saved ${fileName} to Google Drive`,
              category: step.category,
              metadata: { fileUrl: file.url, fileName },
            });
          }
        } catch (saveError) {
          // File save failed but workflow continues
          await pushEvent({
            agentRole: step.agentRole,
            status: 'error',
            action: `Failed to save to Drive: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`,
            category: step.category,
          });
        }
      }

      // Director approval checkpoint
      if (step.requiresApproval) {
        await pushEvent({
          agentRole: 'director',
          status: 'reviewing',
          action: `Reviewing ${step.name} output from ${agent.name}`,
          category: 'review',
          metadata: { workflowId: definition.id, stepId: step.id },
        });

        // In production, this would pause and wait for human/Director approval.
        // For now, Director auto-approves after review.
        await pushEvent({
          agentRole: 'director',
          status: 'working',
          action: `Approved: ${step.name} — proceeding to next step`,
          category: 'approval',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      await pushEvent({
        agentRole: 'director',
        status: 'error',
        action: `Workflow failed at step "${step.name}": ${message}`,
        category: 'orchestration',
        metadata: { workflowId: definition.id, stepId: step.id },
      });

      return {
        workflowId: definition.id,
        status: 'failed',
        context,
        currentStep: i + 1,
        totalSteps: definition.steps.length,
        error: message,
      };
    }
  }

  // Director announces completion
  await pushEvent({
    agentRole: 'director',
    status: 'idle',
    action: `Workflow complete: ${definition.name} for ${context.projectName}`,
    category: 'orchestration',
    metadata: {
      workflowId: definition.id,
      filesCreated: context.savedFiles.length,
    },
  });

  return {
    workflowId: definition.id,
    status: 'completed',
    context,
    currentStep: definition.steps.length,
    totalSteps: definition.steps.length,
  };
}

/** Convert structured JSON output to Google Sheets row format */
function formatAsSheetData(data: Record<string, unknown>): { sheetName: string; headers: string[]; rows: (string | number | null)[][] }[] {
  // Handle bid leveling specifically
  if (data.type === 'bid-leveling' && Array.isArray(data.rows)) {
    const bidders = (data.bidders as string[]) || [];
    const headers = ['Trade/Category', 'Scope Item', 'Unit', 'Qty'];
    for (const bidder of bidders) {
      headers.push(`${bidder} - Unit Price`, `${bidder} - Total`, `${bidder} - Included`, `${bidder} - Qualifications`);
    }
    headers.push('Notes', 'Recommendation');

    const rows = (data.rows as Record<string, unknown>[]).map((row) => {
      const cells: (string | number | null)[] = [
        row.tradeCategory as string,
        row.scopeItem as string,
        row.unit as string,
        row.quantity as number,
      ];
      const rowBidders = (row.bidders as Record<string, unknown>[]) || [];
      for (let i = 0; i < bidders.length; i++) {
        const b = rowBidders[i] || {};
        cells.push(
          b.unitPrice as number | null,
          b.totalPrice as number | null,
          b.included ? 'Yes' : 'No',
          (b.qualification as string) || ''
        );
      }
      cells.push(row.notes as string, row.recommendation as string);
      return cells;
    });

    // Summary sheet
    const summary = data.summary as Record<string, unknown> || {};
    const summaryRows: (string | number | null)[][] = [
      ['Lowest Total', (summary.lowestTotal as Record<string, unknown>)?.bidder as string || '', (summary.lowestTotal as Record<string, unknown>)?.amount as number || 0],
      ['Recommended Bidder', summary.recommendedBidder as string || '', ''],
      ['Reason', summary.reasonForRecommendation as string || '', ''],
    ];
    const gaps = (summary.scopeGaps as string[]) || [];
    gaps.forEach((gap, i) => summaryRows.push([`Scope Gap ${i + 1}`, gap, '']));
    const flags = (summary.qualificationFlags as string[]) || [];
    flags.forEach((flag, i) => summaryRows.push([`Flag ${i + 1}`, flag, '']));

    return [
      { sheetName: 'Bid Leveling', headers, rows },
      { sheetName: 'Summary', headers: ['Item', 'Detail', 'Value'], rows: summaryRows },
    ];
  }

  // Generic fallback: convert any object to key-value rows
  const rows = Object.entries(data)
    .filter(([, v]) => typeof v !== 'object')
    .map(([k, v]) => [k, String(v)]);

  return [{ sheetName: 'Data', headers: ['Field', 'Value'], rows }];
}
