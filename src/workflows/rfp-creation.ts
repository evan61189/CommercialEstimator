import { WorkflowDefinition } from './engine';

/**
 * RFP Creation Workflow
 *
 * Input: Scope analysis output or manual scope description for a trade
 * Output: Complete RFP package saved to Drive
 *
 * Steps:
 * 1. Junior Estimator drafts the full RFP from scope
 * 2. Director reviews before release
 */
export const rfpCreationWorkflow: WorkflowDefinition = {
  id: 'rfp-creation',
  name: 'RFP Creation',
  description: 'Generate a complete Request for Proposal for a specific trade, including scope of work, bid form, schedule, and submission instructions.',

  steps: [
    {
      id: 'draft-rfp',
      agentRole: 'junior-estimator',
      name: 'Draft RFP Package',
      category: 'rfp',
      instruction: `Create a complete Request for Proposal (RFP) for the specified trade based on the provided scope information.

Return JSON matching this schema:
{
  "type": "rfp",
  "projectName": "...",
  "projectNumber": "...",
  "trade": "...",
  "bidDueDate": "YYYY-MM-DD",
  "preparedBy": "Junior Estimator AI",
  "sections": {
    "projectDescription": "2-3 paragraph description",
    "scopeOfWork": ["detailed scope item 1", "..."],
    "inclusions": ["item 1", "..."],
    "exclusions": ["item 1", "..."],
    "schedule": "project schedule requirements",
    "insuranceRequirements": "GL $1M/$2M, Auto $1M, WC statutory, Umbrella $5M",
    "bondingRequirements": "performance and payment bonds if applicable",
    "submissionInstructions": "how and where to submit",
    "bidForm": [
      { "item": "1", "description": "...", "unit": "LS", "quantity": 1 }
    ]
  },
  "targetedBidders": ["Suggested sub 1", "..."]
}

Make the RFP professional, thorough, and ready to send to subcontractors.
Include standard GC boilerplate for insurance and submission.`,
      saveOutput: {
        type: '04 - RFPs',
        fileName: '{projectName} - RFP - {trade} - {date}',
        format: 'document',
      },
      requiresApproval: true,
    },
  ],
};
