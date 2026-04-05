import { WorkflowDefinition } from './engine';

/**
 * Bid Leveling Workflow
 *
 * Input: Raw bid data (pasted text, extracted PDF content) from multiple subcontractors
 * Output: Google Sheets bid leveling workbook saved to Drive
 *
 * Steps:
 * 1. Senior Estimator analyzes all bids and produces structured comparison
 * 2. Senior Estimator identifies scope gaps and qualifications
 * 3. Director reviews the leveling before it's finalized
 * 4. Senior Estimator generates recommendation summary
 */
export const bidLevelingWorkflow: WorkflowDefinition = {
  id: 'bid-leveling',
  name: 'Bid Leveling',
  description: 'Compare and level subcontractor bids for a specific trade, identifying scope gaps, qualifications, and recommending the best value.',

  steps: [
    {
      id: 'extract-and-normalize',
      agentRole: 'senior-estimator',
      name: 'Extract & Normalize Bids',
      category: 'bid-leveling',
      instruction: `You are leveling subcontractor bids. Analyze the provided bid data and extract a normalized comparison.

For each bid, identify:
1. Every line item / scope item included
2. Unit prices and totals
3. Exclusions and qualifications
4. Allowances and alternates
5. Schedule commitments

Return your analysis as JSON matching this exact schema:

{
  "type": "bid-leveling",
  "projectName": "...",
  "trade": "...",
  "preparedBy": "Senior Estimator AI",
  "date": "${new Date().toISOString().split('T')[0]}",
  "bidders": ["Bidder A", "Bidder B", ...],
  "rows": [
    {
      "tradeCategory": "...",
      "scopeItem": "...",
      "unit": "EA|SF|LF|LS|etc",
      "quantity": 0,
      "bidders": [
        {
          "name": "Bidder A",
          "unitPrice": 0,
          "totalPrice": 0,
          "included": true,
          "qualification": null
        }
      ],
      "notes": "...",
      "recommendation": "..."
    }
  ],
  "summary": {
    "lowestTotal": { "bidder": "...", "amount": 0 },
    "recommendedBidder": "...",
    "reasonForRecommendation": "...",
    "scopeGaps": ["items not all bidders included"],
    "qualificationFlags": ["important qualifications"]
  }
}

Be thorough. Every scope item from every bidder must appear as a row. If a bidder didn't include an item, mark included: false. Flag any qualifications that could affect the total cost.`,
      saveOutput: {
        type: '06 - Bids & Bid Leveling',
        fileName: '{projectName} - Bid Leveling - {trade} - {date}',
        format: 'spreadsheet',
      },
      requiresApproval: true,
    },
    {
      id: 'recommendation',
      agentRole: 'senior-estimator',
      name: 'Generate Recommendation',
      category: 'bid-leveling',
      requiresApproval: false,
      inputTransform: (prevOutput, context) => {
        return `Based on this bid leveling analysis, write a concise executive recommendation memo.

Project: ${context.projectName}
Trade: ${context.metadata.trade || 'Unknown'}

Bid Leveling Data:
${prevOutput}

Include:
1. Recommended subcontractor and why (not just lowest price — consider scope completeness, qualifications, schedule)
2. Risk factors for each bidder
3. Items that need clarification before award
4. Suggested negotiation points with the recommended bidder
5. Total cost comparison (apples-to-apples after leveling)

Format as a professional memo in plain text. This will be saved as a Google Doc.`;
      },
      instruction: '', // Set by inputTransform
      saveOutput: {
        type: '06 - Bids & Bid Leveling',
        fileName: '{projectName} - Bid Recommendation - {trade} - {date}',
        format: 'document',
      },
    },
  ],
};
