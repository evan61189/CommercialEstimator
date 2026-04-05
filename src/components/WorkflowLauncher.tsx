'use client';

import { useState } from 'react';

interface WorkflowInfo {
  id: string;
  name: string;
  description: string;
  stepCount: number;
  agents: string[];
}

const AVAILABLE_WORKFLOWS: WorkflowInfo[] = [
  {
    id: 'bid-leveling',
    name: 'Bid Leveling',
    description: 'Compare and level sub bids, identify scope gaps, recommend best value',
    stepCount: 2,
    agents: ['senior-estimator'],
  },
  {
    id: 'scope-analysis',
    name: 'Scope Analysis',
    description: 'Break down drawings/specs into 19 trade categories with RFI generation',
    stepCount: 2,
    agents: ['senior-estimator', 'junior-estimator'],
  },
  {
    id: 'rfp-creation',
    name: 'RFP Creation',
    description: 'Generate a complete RFP package for a specific trade',
    stepCount: 1,
    agents: ['junior-estimator'],
  },
  {
    id: 'buyout',
    name: 'Subcontractor Buyout',
    description: 'Sub agreement, PO, insurance reqs, and submittal log setup',
    stepCount: 2,
    agents: ['procurement', 'administrator'],
  },
];

const AGENT_COLORS: Record<string, string> = {
  director: 'bg-agent-director/20 text-agent-director',
  'senior-estimator': 'bg-agent-senior/20 text-agent-senior',
  'junior-estimator': 'bg-agent-junior/20 text-agent-junior',
  procurement: 'bg-agent-procurement/20 text-agent-procurement',
  administrator: 'bg-agent-admin/20 text-agent-admin',
};

const AGENT_LABELS: Record<string, string> = {
  director: 'Director',
  'senior-estimator': 'Sr. Estimator',
  'junior-estimator': 'Jr. Estimator',
  procurement: 'Procurement',
  administrator: 'Admin',
};

export function WorkflowLauncher() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [trade, setTrade] = useState('');
  const [inputData, setInputData] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!selectedWorkflow || !projectName || !inputData) return;

    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: selectedWorkflow,
          projectName,
          inputData,
          metadata: { trade: trade || 'General' },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Workflow failed');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-700">
        <h2 className="text-sm font-semibold text-gray-200">Launch Workflow</h2>
        <p className="text-[11px] text-gray-500 mt-0.5">Select a workflow to run with Claude Opus</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Workflow Selection */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {AVAILABLE_WORKFLOWS.map((wf) => (
            <button
              key={wf.id}
              onClick={() => setSelectedWorkflow(wf.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                selectedWorkflow === wf.id
                  ? 'border-agent-senior bg-agent-senior/5'
                  : 'border-surface-700 hover:border-surface-600'
              }`}
            >
              <div className="text-xs font-medium text-gray-200">{wf.name}</div>
              <div className="text-[10px] text-gray-500 mt-1 leading-tight">{wf.description}</div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {wf.agents.map((a) => (
                  <span key={a} className={`text-[9px] px-1.5 py-0.5 rounded ${AGENT_COLORS[a]}`}>
                    {AGENT_LABELS[a]}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-gray-600 mt-1">{wf.stepCount} steps</div>
            </button>
          ))}
        </div>

        {/* Input Form */}
        {selectedWorkflow && (
          <div className="space-y-3 border-t border-surface-700 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Downtown Office Tower"
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-agent-senior"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Trade</label>
                <input
                  type="text"
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  placeholder="Mechanical - HVAC"
                  className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-agent-senior"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">
                Input Data <span className="text-gray-600">(paste bid text, scope notes, drawing notes, etc.)</span>
              </label>
              <textarea
                value={inputData}
                onChange={(e) => setInputData(e.target.value)}
                rows={6}
                placeholder={
                  selectedWorkflow === 'bid-leveling'
                    ? 'Paste subcontractor bids here...\n\nBidder A - ABC Mechanical:\nRTU Replacement: $45,000\nDuctwork: $128,000\n...\n\nBidder B - XYZ HVAC:\nRTU Replacement: $42,500\nDuctwork: $135,000\n...'
                    : selectedWorkflow === 'scope-analysis'
                    ? 'Paste drawing notes, spec sections, or project scope description...'
                    : selectedWorkflow === 'rfp-creation'
                    ? 'Paste scope of work, drawing references, and project requirements...'
                    : 'Paste awarded sub info: company name, contact, trade, contract amount, scope items...'
                }
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-agent-senior resize-none font-mono"
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handleRun}
                disabled={running || !projectName || !inputData}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  running || !projectName || !inputData
                    ? 'bg-surface-700 text-gray-500 cursor-not-allowed'
                    : 'bg-agent-senior text-surface-900 hover:brightness-110'
                }`}
              >
                {running ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-surface-900/30 border-t-surface-900 rounded-full animate-spin" />
                    Running workflow...
                  </span>
                ) : (
                  `Run ${AVAILABLE_WORKFLOWS.find((w) => w.id === selectedWorkflow)?.name}`
                )}
              </button>

              {running && (
                <span className="text-[11px] text-gray-500">
                  Watch the activity feed below for real-time progress
                </span>
              )}
            </div>

            {/* Result */}
            {result && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <div className="text-xs font-medium text-emerald-400 mb-1">
                  Workflow {result.status === 'completed' ? 'Complete' : 'Finished'}
                </div>
                <div className="text-[11px] text-gray-300">
                  {String(result.stepsCompleted)}/{String(result.totalSteps)} steps completed
                  {Array.isArray(result.savedFiles) && (result.savedFiles as unknown[]).length > 0 && (
                    <span> &middot; {(result.savedFiles as unknown[]).length} files saved to Drive</span>
                  )}
                </div>
                {Array.isArray(result.savedFiles) && (result.savedFiles as { fileName: string }[]).map((f, i) => (
                  <div key={i} className="text-[10px] text-gray-500 mt-1">
                    {f.fileName}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="text-xs font-medium text-red-400">Error</div>
                <div className="text-[11px] text-gray-300 mt-1">{error}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
