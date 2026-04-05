import { WorkflowDefinition } from './engine';
import { bidLevelingWorkflow } from './bid-leveling';
import { scopeAnalysisWorkflow } from './scope-analysis';
import { rfpCreationWorkflow } from './rfp-creation';
import { buyoutWorkflow } from './buyout';

export { executeWorkflow } from './engine';

/** All registered workflows */
export const workflows: Record<string, WorkflowDefinition> = {
  'bid-leveling': bidLevelingWorkflow,
  'scope-analysis': scopeAnalysisWorkflow,
  'rfp-creation': rfpCreationWorkflow,
  'buyout': buyoutWorkflow,
};

/** Get workflow list for the dashboard */
export function getWorkflowList() {
  return Object.values(workflows).map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    stepCount: w.steps.length,
    agents: Array.from(new Set(w.steps.map((s) => s.agentRole))),
  }));
}
