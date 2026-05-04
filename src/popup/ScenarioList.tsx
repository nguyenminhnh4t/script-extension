import { useEffect, useState } from 'react';
import type { Scenario, RunLog, StepLog, RuntimeMessage } from '../types';
import { getScenarios, deleteScenario, getLastRunLog, saveScenario } from '../storage';

interface Props {
  onNew: () => void;
  onEdit: (s: Scenario) => void;
}

type RunState = 'idle' | 'running' | 'success' | 'error';

interface RunStatus {
  state: RunState;
  currentStep?: number;
  log?: RunLog;
  error?: string;
}

export default function ScenarioList({ onNew, onEdit }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runStatuses, setRunStatuses] = useState<Record<string, RunStatus>>({});
  const [selectedLog, setSelectedLog] = useState<RunLog | null>(null);

  useEffect(() => {
    getScenarios().then(setScenarios);
  }, []);

  useEffect(() => {
    const handler = (message: RuntimeMessage) => {
      if (message.type === 'RUN_PROGRESS') {
        const { stepIndex, stepLog } = message;
        setRunStatuses((prev) => {
          const entry = Object.entries(prev).find(([, v]) => v.state === 'running');
          if (!entry) return prev;
          const [id] = entry;
          return {
            ...prev,
            [id]: {
              ...prev[id],
              currentStep: stepIndex,
              log: prev[id].log
                ? {
                    ...prev[id].log!,
                    steps: [
                      ...(prev[id].log?.steps ?? []).filter(
                        (s: StepLog) => s.stepIndex !== stepIndex
                      ),
                      stepLog,
                    ],
                  }
                : undefined,
            },
          };
        });
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  async function handleRun(scenario: Scenario) {
    setRunStatuses((prev) => ({
      ...prev,
      [scenario.id]: { state: 'running', currentStep: 0 },
    }));

    const response = await chrome.runtime.sendMessage<RuntimeMessage, { ok: boolean; log?: RunLog; error?: string }>({
      type: 'RUN_SCENARIO',
      scenario,
    });

    if (response.ok && response.log) {
      setRunStatuses((prev) => ({
        ...prev,
        [scenario.id]: { state: 'success', log: response.log },
      }));
    } else {
      setRunStatuses((prev) => ({
        ...prev,
        [scenario.id]: { state: 'error', error: response.error },
      }));
    }
  }

  async function handleDelete(id: string) {
    await deleteScenario(id);
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleShowLog(scenario: Scenario) {
    const log = await getLastRunLog(scenario.id);
    setSelectedLog(log ?? null);
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(scenarios, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scenarios.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = JSON.parse(text) as Scenario[];
    for (const s of imported) {
      await saveScenario(s);
    }
    const updated = await getScenarios();
    setScenarios(updated);
  }

  const stateColor: Record<RunState, string> = {
    idle: 'text-gray-400',
    running: 'text-blue-500',
    success: 'text-green-500',
    error: 'text-red-500',
  };

  return (
    <div className="w-[420px] min-h-[500px] bg-gray-950 text-gray-100 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h1 className="text-base font-semibold tracking-wide">Automation Runner</h1>
        <div className="flex gap-2">
          <label className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-white cursor-pointer">
            Import
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
          </label>
          <button
            onClick={handleExport}
            className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-white"
          >
            Export
          </button>
          <button
            onClick={onNew}
            className="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-white"
          >
            + New
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
        {scenarios.length === 0 && (
          <p className="text-sm text-gray-500 text-center mt-12">No scenarios yet. Create one!</p>
        )}
        {scenarios.map((s) => {
          const status = runStatuses[s.id] ?? { state: 'idle' };
          return (
            <div key={s.id} className="px-4 py-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-gray-500 truncate max-w-[200px]">{s.startUrl}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleRun(s)}
                    disabled={status.state === 'running'}
                    className="text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 px-2 py-1 rounded"
                  >
                    {status.state === 'running' ? `Step ${(status.currentStep ?? 0) + 1}…` : 'Run'}
                  </button>
                  <button
                    onClick={() => onEdit(s)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-xs bg-red-800 hover:bg-red-700 px-2 py-1 rounded"
                  >
                    Del
                  </button>
                </div>
              </div>
              {status.state !== 'idle' && (
                <p className={`text-xs ${stateColor[status.state]}`}>
                  {status.state === 'running' && `Running step ${(status.currentStep ?? 0) + 1} of ${s.steps.length}…`}
                  {status.state === 'success' && '✓ Completed successfully'}
                  {status.state === 'error' && `✗ Failed: ${status.error}`}
                </p>
              )}
              {(status.state === 'success' || status.state === 'error') && (
                <button
                  onClick={() => handleShowLog(s)}
                  className="text-xs text-blue-400 hover:underline self-start"
                >
                  View log
                </button>
              )}
            </div>
          );
        })}
      </div>

      {selectedLog && (
        <div className="absolute inset-0 bg-gray-950/95 flex flex-col p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-sm">Run Log — {selectedLog.scenarioName}</h2>
            <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-white">✕</button>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            {new Date(selectedLog.startedAt).toLocaleString()} · {selectedLog.status}
          </p>
          <div className="space-y-1">
            {selectedLog.steps.map((sl) => (
              <div key={sl.stepIndex} className={`text-xs rounded px-2 py-1 ${sl.status === 'success' ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
                <span className="font-mono">Step {sl.stepIndex + 1} [{sl.type}]</span>
                {sl.error && <span className="ml-2 text-red-300">{sl.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
