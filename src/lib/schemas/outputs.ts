/**
 * Structured output schemas for all agent deliverables.
 * These are the JSON shapes that Claude Opus produces,
 * which then get written to Google Sheets/Docs via Zapier.
 */

// ─── Senior Estimator Outputs ───────────────────────────────────────

export interface BidLevelingRow {
  tradeCategory: string;          // e.g. "Mechanical - HVAC"
  scopeItem: string;              // e.g. "RTU replacement (4 units)"
  unit: string;                   // e.g. "EA", "SF", "LS"
  quantity: number;
  bidders: BidderEntry[];
  notes: string;
  recommendation: string;         // Which bidder and why
}

export interface BidderEntry {
  name: string;                   // e.g. "ABC Mechanical"
  unitPrice: number | null;
  totalPrice: number | null;
  included: boolean;              // Is this item in their scope?
  qualification: string | null;   // Any qualifications or exclusions
}

export interface BidLevelingOutput {
  type: 'bid-leveling';
  projectName: string;
  trade: string;
  preparedBy: string;
  date: string;
  bidders: string[];              // All bidder names
  rows: BidLevelingRow[];
  summary: {
    lowestTotal: { bidder: string; amount: number };
    recommendedBidder: string;
    reasonForRecommendation: string;
    scopeGaps: string[];          // Items not all bidders included
    qualificationFlags: string[]; // Important qualifications to review
  };
}

export interface ScopeAnalysisItem {
  division: string;               // CSI division e.g. "23 00 00"
  trade: string;                  // e.g. "Mechanical"
  description: string;
  drawingRef: string[];           // e.g. ["M-101", "M-102"]
  specSection: string | null;     // e.g. "23 74 00"
  phase: number;                  // 1-6
  notes: string;
}

export interface ScopeAnalysisOutput {
  type: 'scope-analysis';
  projectName: string;
  drawingSetRevision: string;
  date: string;
  totalPhases: number;
  trades: {
    trade: string;
    division: string;
    itemCount: number;
    items: ScopeAnalysisItem[];
  }[];
  scopeGaps: string[];           // Identified gaps or ambiguities
  clarificationsNeeded: string[];
}

export interface BudgetLineItem {
  division: string;
  trade: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  source: string;                 // "historical" | "market" | "bid"
  confidence: 'high' | 'medium' | 'low';
}

export interface BudgetOutput {
  type: 'budget';
  projectName: string;
  date: string;
  grossSquareFootage: number;
  lineItems: BudgetLineItem[];
  subtotal: number;
  contingency: number;
  contingencyPercent: number;
  generalConditions: number;
  fee: number;
  feePercent: number;
  grandTotal: number;
  costPerSF: number;
}

// ─── Junior Estimator Outputs ───────────────────────────────────────

export interface RFPOutput {
  type: 'rfp';
  projectName: string;
  projectNumber: string;
  trade: string;
  bidDueDate: string;
  preparedBy: string;
  sections: {
    projectDescription: string;
    scopeOfWork: string[];
    inclusions: string[];
    exclusions: string[];
    schedule: string;
    insuranceRequirements: string;
    bondingRequirements: string;
    submissionInstructions: string;
    bidForm: BidFormLine[];
  };
  targetedBidders: string[];
}

export interface BidFormLine {
  item: string;
  description: string;
  unit: string;
  quantity: number;
}

export interface RFIOutput {
  type: 'rfi';
  projectName: string;
  projectNumber: string;
  rfiNumber: string;
  date: string;
  to: string;
  from: string;
  subject: string;
  drawingRef: string[];
  specRef: string[];
  question: string;
  suggestedSolution: string | null;
  impactIfNotResolved: string;
  dateNeeded: string;
  status: 'open' | 'answered' | 'closed';
  response: string | null;
}

export interface ProposalOutput {
  type: 'proposal';
  projectName: string;
  clientName: string;
  date: string;
  proposalNumber: string;
  sections: {
    executiveSummary: string;
    scopeOfServices: string[];
    pricing: { description: string; amount: number }[];
    schedule: { milestone: string; date: string }[];
    qualifications: string[];
    alternates: { description: string; addDeduct: string; amount: number }[];
    termsAndConditions: string;
  };
  totalPrice: number;
}

// ─── Procurement Outputs ────────────────────────────────────────────

export interface PurchaseOrderOutput {
  type: 'purchase-order';
  poNumber: string;
  date: string;
  projectName: string;
  vendor: string;
  shipTo: string;
  lineItems: {
    item: number;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
  }[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  deliveryDate: string;
  terms: string;
  notes: string;
}

export interface SubAgreementOutput {
  type: 'sub-agreement';
  projectName: string;
  projectNumber: string;
  subcontractor: {
    name: string;
    address: string;
    contact: string;
    phone: string;
    email: string;
  };
  trade: string;
  contractAmount: number;
  scopeExhibit: string[];        // Key scope items
  schedule: { milestone: string; date: string }[];
  insuranceRequired: {
    generalLiability: string;
    autoLiability: string;
    umbrellaExcess: string;
    workersComp: string;
  };
  retainage: number;             // Percentage
  paymentTerms: string;
  flowDownProvisions: string[];
}

export interface COIReviewOutput {
  type: 'coi-review';
  subcontractor: string;
  reviewDate: string;
  policies: {
    type: string;
    carrier: string;
    policyNumber: string;
    effectiveDate: string;
    expirationDate: string;
    limits: string;
    meetsRequirement: boolean;
    deficiency: string | null;
  }[];
  additionalInsured: boolean;
  waiverOfSubrogation: boolean;
  overallCompliant: boolean;
  actionItems: string[];
}

// ─── Administrator Outputs ──────────────────────────────────────────

export interface SubmittalLogEntry {
  submittalNumber: string;
  specSection: string;
  description: string;
  subcontractor: string;
  dateSubmitted: string | null;
  dateRequired: string;
  status: 'pending' | 'submitted' | 'approved' | 'revise-resubmit' | 'rejected';
  reviewedBy: string | null;
  notes: string;
}

export interface MeetingNotesOutput {
  type: 'meeting-notes';
  projectName: string;
  meetingType: string;           // "OAC", "Coordination", "Internal"
  date: string;
  attendees: { name: string; company: string; role: string }[];
  agendaItems: {
    topic: string;
    discussion: string;
    decisions: string[];
    actionItems: {
      description: string;
      assignedTo: string;
      dueDate: string;
    }[];
  }[];
  nextMeetingDate: string | null;
}

export interface DrawingLogEntry {
  sheetNumber: string;           // e.g. "A-101"
  discipline: string;            // A, S, M, E, P, FP
  title: string;
  currentRevision: string;
  dateReceived: string;
  previousRevisions: { revision: string; date: string }[];
}

export interface TransmittalOutput {
  type: 'transmittal';
  transmittalNumber: string;
  date: string;
  projectName: string;
  projectNumber: string;
  to: { name: string; company: string };
  from: { name: string; company: string };
  sentVia: string;
  description: string;
  enclosures: {
    copies: number;
    description: string;
    type: string;                // "Shop Drawing", "Product Data", "Sample", etc.
  }[];
  remarks: string;
}

// ─── Union type for all outputs ─────────────────────────────────────

export type AgentOutput =
  | BidLevelingOutput
  | ScopeAnalysisOutput
  | BudgetOutput
  | RFPOutput
  | RFIOutput
  | ProposalOutput
  | PurchaseOrderOutput
  | SubAgreementOutput
  | COIReviewOutput
  | MeetingNotesOutput
  | TransmittalOutput;
