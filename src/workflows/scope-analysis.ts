import { WorkflowDefinition } from './engine';

/**
 * Scope Analysis Workflow
 *
 * Input: Drawing notes, spec sections, or pasted drawing content
 * Output: Scope breakdown by trade saved to Drive as a spreadsheet
 *
 * Steps:
 * 1. Senior Estimator reads input and extracts scope items by trade
 * 2. Junior Estimator flags items that need RFIs
 * 3. Director reviews
 */
export const scopeAnalysisWorkflow: WorkflowDefinition = {
  id: 'scope-analysis',
  name: 'Scope Analysis',
  description: 'Analyze drawings/specs and break down scope into 19 trade categories with quantities, drawing references, and spec sections.',

  steps: [
    {
      id: 'extract-scope',
      agentRole: 'senior-estimator',
      name: 'Extract Scope by Trade',
      category: 'scope-analysis',
      instruction: `Analyze the provided drawing notes, specifications, or project information and extract a complete scope breakdown.

Assign every item to one of the 19 trades:
1. Sitework  2. Concrete  3. Masonry  4. Metals  5. Wood & Plastics
6. Thermal & Moisture  7. Doors & Windows  8. Finishes  9. Specialties
10. Equipment  11. Furnishings  12. Special Construction  13. Conveying Systems
14. Mechanical  15. Electrical  16. Plumbing  17. Fire Protection
18. Earthwork  19. Landscaping

Return JSON matching this schema:
{
  "type": "scope-analysis",
  "projectName": "...",
  "drawingSetRevision": "...",
  "date": "${new Date().toISOString().split('T')[0]}",
  "totalPhases": 6,
  "trades": [
    {
      "trade": "Mechanical",
      "division": "23 00 00",
      "itemCount": 0,
      "items": [
        {
          "division": "23 74 00",
          "trade": "Mechanical",
          "description": "...",
          "drawingRef": ["M-101"],
          "specSection": "23 74 00",
          "phase": 1,
          "notes": "..."
        }
      ]
    }
  ],
  "scopeGaps": ["identified gaps or ambiguities"],
  "clarificationsNeeded": ["items needing RFIs"]
}`,
      saveOutput: {
        type: '03 - Scope Analysis',
        fileName: '{projectName} - Scope Analysis - {date}',
        format: 'spreadsheet',
      },
      requiresApproval: true,
    },
    {
      id: 'generate-rfis',
      agentRole: 'junior-estimator',
      name: 'Draft RFIs for Scope Gaps',
      category: 'rfi',
      inputTransform: (prevOutput, context) => {
        return `Based on this scope analysis, draft RFIs for every item in "scopeGaps" and "clarificationsNeeded".

Project: ${context.projectName}

Scope Analysis:
${prevOutput}

For each RFI, provide:
{
  "type": "rfi",
  "projectName": "${context.projectName}",
  "rfiNumber": "RFI-001",
  "date": "${new Date().toISOString().split('T')[0]}",
  "subject": "...",
  "drawingRef": ["sheet numbers"],
  "specRef": ["spec sections"],
  "question": "detailed question",
  "suggestedSolution": "if applicable",
  "impactIfNotResolved": "schedule/cost impact",
  "dateNeeded": "YYYY-MM-DD",
  "status": "open"
}

Return as a JSON array of RFI objects wrapped in: { "rfis": [...] }`;
      },
      instruction: '',
      saveOutput: {
        type: '05 - RFIs',
        fileName: '{projectName} - RFIs from Scope Analysis - {date}',
        format: 'document',
      },
    },
  ],
};
