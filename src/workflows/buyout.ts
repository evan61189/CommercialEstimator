import { WorkflowDefinition } from './engine';

/**
 * Subcontractor Buyout Workflow
 *
 * Input: Awarded bid info (sub name, trade, contract amount, scope)
 * Output: Complete buyout package (sub agreement + PO + COI checklist) saved to Drive
 *
 * Steps:
 * 1. Procurement drafts sub agreement
 * 2. Procurement generates purchase order
 * 3. Administrator sets up submittal log for the trade
 * 4. Director reviews full package
 */
export const buyoutWorkflow: WorkflowDefinition = {
  id: 'buyout',
  name: 'Subcontractor Buyout',
  description: 'Generate a complete buyout package for an awarded subcontractor including sub agreement, PO, insurance requirements, and submittal log setup.',

  steps: [
    {
      id: 'draft-sub-agreement',
      agentRole: 'procurement',
      name: 'Draft Sub Agreement',
      category: 'sub-agreement',
      instruction: `Draft a subcontractor agreement based on the provided award information.

Return JSON matching this schema:
{
  "type": "sub-agreement",
  "projectName": "...",
  "projectNumber": "...",
  "subcontractor": {
    "name": "...",
    "address": "...",
    "contact": "...",
    "phone": "...",
    "email": "..."
  },
  "trade": "...",
  "contractAmount": 0,
  "scopeExhibit": ["scope item 1", "..."],
  "schedule": [{ "milestone": "...", "date": "YYYY-MM-DD" }],
  "insuranceRequired": {
    "generalLiability": "$1,000,000 / $2,000,000",
    "autoLiability": "$1,000,000",
    "umbrellaExcess": "$5,000,000",
    "workersComp": "Statutory"
  },
  "retainage": 10,
  "paymentTerms": "Net 30 from approved invoice",
  "flowDownProvisions": ["key provisions from prime contract"]
}

Include standard commercial construction flow-down provisions.`,
      saveOutput: {
        type: '09 - Contracts & Sub Agreements',
        fileName: '{projectName} - Sub Agreement - {trade} - {date}',
        format: 'document',
      },
      requiresApproval: true,
    },
    {
      id: 'setup-submittals',
      agentRole: 'administrator',
      name: 'Setup Submittal Log',
      category: 'submittal',
      inputTransform: (prevOutput, context) => {
        return `Based on this subcontractor agreement, set up the initial submittal log entries for this trade.

Project: ${context.projectName}
Sub Agreement:
${prevOutput}

Create submittal log entries for all items that will require submittals (shop drawings, product data, samples, etc.) based on the scope.

Return JSON:
{
  "type": "submittal-log",
  "entries": [
    {
      "submittalNumber": "SUB-001",
      "specSection": "23 74 00",
      "description": "...",
      "subcontractor": "...",
      "dateSubmitted": null,
      "dateRequired": "YYYY-MM-DD",
      "status": "pending",
      "reviewedBy": null,
      "notes": "..."
    }
  ]
}`;
      },
      instruction: '',
      saveOutput: {
        type: '12 - Submittals',
        fileName: '{projectName} - Submittal Log - {trade} - {date}',
        format: 'spreadsheet',
      },
    },
  ],
};
