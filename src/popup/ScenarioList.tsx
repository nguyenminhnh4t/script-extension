import { useEffect, useState } from 'react';
import type { Scenario, RunLog, RunStatus, RunTabLog, StepLog, RuntimeMessage } from '../types';
import {
  getScenarios,
  deleteScenario,
  getLastRunLog,
  saveScenario,
  normalizeScenario,
  getRunStatuses,
  saveRunStatus,
  deleteRunStatus,
} from '../storage';

interface Props {
  onNew: () => void;
  onEdit: (s: Scenario) => void;
}

function getLastStepError(steps: StepLog[]): string | undefined {
  return steps.reduce<string | undefined>(
    (lastError, step) => step.status === 'error' ? step.error : lastError,
    undefined
  );
}

function getStepsForTab(log: RunLog, tab: RunTabLog): StepLog[] {
  return log.steps.filter((step) => (
    step.tabId === tab.tabId
    || (step.tabId == null && tab.tabIndex != null && step.tabIndex === tab.tabIndex)
  ));
}

// ── SVG icons ──────────────────────────────────────────────────────────────
const IconPlay = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);
const IconSpinner = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
    <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
    <path d="M12 3a9 9 0 0 1 9 9" />
  </svg>
);
const IconStop = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
);
const IconPencil = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);
const IconLog = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="13" y2="17" />
  </svg>
);
const IconUpload = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const IconDownload = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconAlert = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// ── Component ──────────────────────────────────────────────────────────────
export default function ScenarioList({ onNew, onEdit }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runStatuses, setRunStatuses] = useState<Record<string, RunStatus>>({});
  const [selectedLog, setSelectedLog] = useState<RunLog | null>(null);

  useEffect(() => {
    async function loadListState() {
      const [loadedScenarios, loadedStatuses] = await Promise.all([getScenarios(), getRunStatuses()]);
      const activeRunIds = await getActiveRunIds();
      const reconciledStatuses = await reconcileRunStatuses(loadedStatuses, activeRunIds);
      setScenarios(loadedScenarios);
      setRunStatuses(reconciledStatuses);
    }

    loadListState();
  }, []);

  useEffect(() => {
    const handleTabRemoved = (tabId: number) => {
      setRunStatuses((prev) => {
        let changed = false;
        const next = Object.fromEntries(Object.entries(prev).map(([scenarioId, status]) => {
          if (!status.log?.cleanupTabIds.includes(tabId)) return [scenarioId, status];
          const cleanupTabIds = status.log.cleanupTabIds.filter((id) => id !== tabId);
          const nextStatus: RunStatus = {
            ...status,
            log: { ...status.log, cleanupTabIds },
          };
          changed = true;
          saveRunStatus(scenarioId, nextStatus).catch(() => {});
          return [scenarioId, nextStatus];
        }));
        return changed ? next : prev;
      });
    };
    chrome.tabs.onRemoved.addListener(handleTabRemoved);
    return () => chrome.tabs.onRemoved.removeListener(handleTabRemoved);
  }, []);

  useEffect(() => {
    const handler = (message: unknown) => {
      if (!message || typeof message !== 'object') return;
      const msg = message as RuntimeMessage;
      if (msg.type === 'RUN_PROGRESS') {
        const { scenarioId, stepIndex, stepLog } = msg;
        setRunStatuses((prev) => {
          const entry = scenarioId
            ? [scenarioId, prev[scenarioId]] as const
            : Object.entries(prev).find(([, v]) => v.state === 'running');
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
                        (s: StepLog) => s.stepIndex !== stepIndex || s.tabIndex !== stepLog.tabIndex
                      ),
                      stepLog,
                    ],
                  }
                : undefined,
            },
          };
        });
      }
      if (msg.type === 'RUN_COMPLETE') {
        const { log } = msg;
        const lastError = getLastStepError(log.steps);
        setRunStatuses((prev) => ({
          ...prev,
          [log.scenarioId]: {
            state: log.status === 'success' ? 'success' : 'error',
            log,
            ...(lastError ? { error: lastError } : log.status === 'error' ? { error: 'Stopped' } : {}),
          },
        }));
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  async function handleRun(scenario: Scenario) {
    setRunStatuses((prev) => ({ ...prev, [scenario.id]: { state: 'running', currentStep: 0 } }));
    await saveRunStatus(scenario.id, { state: 'running', currentStep: 0 });
    const response = await chrome.runtime.sendMessage<RuntimeMessage, { ok: boolean; log?: RunLog; error?: string }>({
      type: 'RUN_SCENARIO',
      scenario,
    });
    if (response.ok && response.log) {
      const lastError = getLastStepError(response.log.steps);
      const nextStatus: RunStatus = {
        state: response.log.status === 'success' ? 'success' : 'error',
        log: response.log,
        ...(lastError ? { error: lastError } : response.log.status === 'error' ? { error: 'Stopped' } : {}),
      };
      setRunStatuses((prev) => ({
        ...prev,
        [scenario.id]: nextStatus,
      }));
      await saveRunStatus(scenario.id, nextStatus);
    } else {
      const nextStatus: RunStatus = { state: 'error', error: response.error };
      setRunStatuses((prev) => ({ ...prev, [scenario.id]: nextStatus }));
      await saveRunStatus(scenario.id, nextStatus);
    }
  }

  async function handleStop(scenarioId: string) {
    setRunStatuses((prev) => {
      const status = prev[scenarioId];
      if (!status) return prev;
      const nextStatus: RunStatus = {
        ...status,
        state: 'error',
        error: 'Stopped',
        ...(status.log ? {
          log: {
            ...status.log,
            endedAt: new Date().toISOString(),
            status: 'error',
          },
        } : {}),
      };
      saveRunStatus(scenarioId, nextStatus).catch(() => {});
      return { ...prev, [scenarioId]: nextStatus };
    });

    try {
      const response = await chrome.runtime.sendMessage<RuntimeMessage, { ok: boolean; error?: string }>({
        type: 'STOP_SCENARIO',
        scenarioId,
      });
      if (response.ok) return;
    } catch {
      // Reconcile below if the background worker restarted during the request.
    }

    {
      const statuses = await getRunStatuses();
      const activeRunIds = await getActiveRunIds();
      setRunStatuses(await reconcileRunStatuses(statuses, activeRunIds));
    }
  }

  async function handleCleanup(scenarioId: string, tabIds: number[]) {
    if (tabIds.length === 0) return;
    await chrome.runtime.sendMessage<RuntimeMessage, { ok: boolean; closed?: number; error?: string }>({
      type: 'CLEANUP_TABS',
      tabIds,
    });
    setRunStatuses((prev) => {
      const status = prev[scenarioId];
      if (!status?.log) return prev;
      saveRunStatus(scenarioId, {
        ...status,
        log: { ...status.log, cleanupTabIds: [] },
      }).catch(() => {});
      return {
        ...prev,
        [scenarioId]: {
          ...status,
          log: { ...status.log, cleanupTabIds: [] },
        },
      };
    });
    setSelectedLog((prev) => (
      prev?.scenarioId === scenarioId ? { ...prev, cleanupTabIds: [] } : prev
    ));
  }

  async function handleDelete(id: string) {
    await deleteScenario(id);
    await deleteRunStatus(id);
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
    const parsed = JSON.parse(text) as unknown;
    const imported = Array.isArray(parsed)
      ? parsed.map(normalizeScenario).filter((s): s is Scenario => s !== null)
      : [];
    for (const s of imported) await saveScenario(s);
    setScenarios(await getScenarios());
  }

  async function getActiveRunIds(): Promise<Set<string>> {
    try {
      const response = await chrome.runtime.sendMessage<RuntimeMessage, { ok: boolean; scenarioIds?: string[] }>({
        type: 'GET_ACTIVE_RUNS',
      });
      return new Set(response.ok ? response.scenarioIds ?? [] : []);
    } catch {
      return new Set();
    }
  }

  async function getOpenTabIds(tabIds: number[]): Promise<number[]> {
    const uniqueIds = Array.from(new Set(tabIds));
    const checks = await Promise.all(uniqueIds.map(async (tabId) => {
      try {
        await chrome.tabs.get(tabId);
        return tabId;
      } catch {
        return null;
      }
    }));
    return checks.filter((tabId): tabId is number => tabId !== null);
  }

  async function reconcileRunStatuses(
    statuses: Record<string, RunStatus>,
    activeRunIds: Set<string>
  ): Promise<Record<string, RunStatus>> {
    const entries = await Promise.all(Object.entries(statuses).map(async ([scenarioId, status]) => {
      let nextStatus = status;
      let changed = false;

      if (status.log?.cleanupTabIds.length) {
        const openCleanupTabIds = await getOpenTabIds(status.log.cleanupTabIds);
        if (openCleanupTabIds.length !== status.log.cleanupTabIds.length) {
          nextStatus = {
            ...nextStatus,
            log: { ...status.log, cleanupTabIds: openCleanupTabIds },
          };
          changed = true;
        }
      }

      if (nextStatus.state === 'running' && !activeRunIds.has(scenarioId)) {
        nextStatus = nextStatus.log?.cleanupTabIds.length
          ? { ...nextStatus, state: 'error', error: nextStatus.error ?? 'Stopped' }
          : { state: 'idle' };
        changed = true;
      }

      if (changed) await saveRunStatus(scenarioId, nextStatus);
      return [scenarioId, nextStatus] as const;
    }));

    return Object.fromEntries(entries);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const iconBtn = 'flex items-center justify-center w-7 h-7 rounded transition-colors cursor-pointer';
  const actionBtn = 'inline-flex items-center justify-center gap-1.5 h-8 rounded-md px-3 text-xs font-semibold transition-all cursor-pointer';
  const statusBtn = 'inline-flex items-center justify-center h-6 rounded px-2 text-[11px] font-medium transition-colors cursor-pointer';
  const getStepCount = (scenario: Scenario) => scenario.tabs.reduce((sum, tab) => sum + tab.steps.length, 0);

  return (
    <div className="w-full min-h-screen bg-gray-950 text-gray-100 flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/80">
        <h1 className="text-sm font-semibold tracking-wide text-gray-100">Automation Runner</h1>
        <div className="flex items-center gap-1">
          <label
            title="Import scenarios"
            className={`${iconBtn} text-gray-400 hover:text-gray-100 hover:bg-gray-800 cursor-pointer`}
          >
            <IconUpload />
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
          <button
            title="Export scenarios"
            onClick={handleExport}
            className={`${iconBtn} text-gray-400 hover:text-gray-100 hover:bg-gray-800`}
          >
            <IconDownload />
          </button>
          <div className="w-px h-4 bg-gray-700 mx-1" />
          <button
            title="New scenario"
            onClick={onNew}
            className={`${iconBtn} text-blue-400 hover:text-blue-300 hover:bg-blue-950`}
          >
            <IconPlus />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {scenarios.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 mt-16 text-gray-600">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="12" y1="8" x2="12" y2="16" />
            </svg>
            <p className="text-xs">No scenarios yet — click <span className="text-blue-400">+</span> to create one</p>
          </div>
        )}

        {scenarios.map((s) => {
          const status = runStatuses[s.id] ?? { state: 'idle' };
          const isRunning = status.state === 'running';
          const stepCount = getStepCount(s);
          const cleanupTabIds = status.log?.cleanupTabIds ?? [];
          const hasCleanup = cleanupTabIds.length > 0;

          const statusBar = (
            status.state === 'running' ? (
              <div className="flex items-center gap-1.5 text-xs text-blue-300 mt-2">
                <IconSpinner />
                <span>Step {(status.currentStep ?? 0) + 1} of {stepCount}</span>
              </div>
            ) : status.state === 'success' ? (
              <div className="flex items-center justify-between gap-2 text-xs mt-2">
                <div className="flex items-center gap-1.5 text-emerald-300">
                  <IconCheck />
                  <span>Completed</span>
                </div>
                <button
                  onClick={() => handleShowLog(s)}
                  className={`${statusBtn} text-gray-400 hover:bg-gray-800 hover:text-gray-100`}
                >
                  Log
                </button>
              </div>
            ) : status.state === 'error' ? (
              <div className="flex items-center justify-between gap-2 text-xs mt-2">
                <div className="flex min-w-0 items-center gap-1.5 text-red-300">
                  <span className="shrink-0"><IconAlert /></span>
                  <span className="truncate">{status.error}</span>
                </div>
                <button
                  onClick={() => handleShowLog(s)}
                  className={`${statusBtn} shrink-0 text-gray-400 hover:bg-gray-800 hover:text-gray-100`}
                >
                  Log
                </button>
              </div>
            ) : null
          );

          return (
            <div
              key={s.id}
              className={`bg-gray-900 border rounded-lg px-3 py-3 transition-colors hover:border-gray-700 ${
                isRunning ? 'border-blue-800/70' : hasCleanup ? 'border-cyan-700/60' : 'border-gray-800'
              }`}
            >
              {/* Top row */}
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100 leading-snug truncate">{s.name}</p>
                  {s.tabs[0]?.startUrl && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{s.tabs[0].startUrl}</p>
                  )}
                  {/* Step count pill */}
                  <p className="text-xs text-gray-600 mt-1">
                    {s.tabs.length} tab{s.tabs.length !== 1 ? 's' : ''} · {stepCount} step{stepCount !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                  <button
                    title="Edit"
                    onClick={() => onEdit(s)}
                    className={`${iconBtn} text-gray-500 hover:text-gray-200 hover:bg-gray-800`}
                  >
                    <IconPencil />
                  </button>
                  <button
                    title="Delete"
                    onClick={() => handleDelete(s.id)}
                    className={`${iconBtn} text-gray-600 hover:text-red-400 hover:bg-red-950/40`}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>

              {/* Status row */}
              {statusBar}

              {/* Primary actions */}
              <div className="mt-3 grid grid-cols-1 gap-2">
                {isRunning ? (
                  <button
                    title="Stop"
                    onClick={() => handleStop(s.id)}
                    className={`${actionBtn} bg-rose-500 text-gray-950 shadow-sm shadow-rose-950/40 hover:bg-rose-400 hover:shadow-rose-950/60 active:translate-y-px`}
                  >
                    <IconStop />
                    <span>Stop</span>
                  </button>
                ) : hasCleanup ? (
                  <button
                    onClick={() => handleCleanup(s.id, cleanupTabIds)}
                    className={`${actionBtn} bg-cyan-500 text-gray-950 shadow-sm shadow-cyan-950/40 hover:bg-cyan-400 hover:shadow-cyan-950/60 active:translate-y-px`}
                  >
                    Clean
                  </button>
                ) : (
                  <button
                    title="Run"
                    onClick={() => handleRun(s)}
                    className={`${actionBtn} bg-emerald-500 text-gray-950 shadow-sm shadow-emerald-950/40 hover:bg-emerald-400 hover:shadow-emerald-950/60 active:translate-y-px`}
                  >
                    <IconPlay />
                    <span>Start</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Log drawer */}
      {selectedLog && (
        <div className="absolute inset-0 bg-gray-950/98 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/80">
            <div>
              <p className="text-sm font-semibold">{selectedLog.scenarioName}</p>
              <p className="text-xs text-gray-500">
                {new Date(selectedLog.startedAt).toLocaleString()}
                <span className={`ml-2 font-medium ${selectedLog.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedLog.status}
                </span>
              </p>
            </div>
            <button
              onClick={() => setSelectedLog(null)}
              className={`${iconBtn} text-gray-400 hover:text-gray-100 hover:bg-gray-800`}
            >
              <IconClose />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
            {selectedLog.tabs.length > 0 ? selectedLog.tabs.map((tab) => {
              const tabSteps = getStepsForTab(selectedLog, tab);
              return (
                <div key={tab.tabId} className="rounded-lg border border-gray-800 bg-gray-900/70 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-800/80">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-semibold text-gray-200">{tab.tabName}</p>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        tab.source === 'spawned'
                          ? 'bg-violet-950 text-violet-300'
                          : 'bg-blue-950 text-blue-300'
                      }`}>
                        {tab.source === 'spawned' ? 'opened by tab' : 'scenario tab'}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-gray-500" title={tab.url || 'about:blank'}>
                      Tab ID {tab.tabId} · {tab.url || 'about:blank'}
                      {tab.openedAt ? ` · ${new Date(tab.openedAt).toLocaleTimeString()}` : ''}
                    </p>
                  </div>
                  <div className="p-2 space-y-1">
                    {tabSteps.length > 0 ? tabSteps.map((sl) => (
                      <div
                        key={`${sl.tabId ?? sl.tabIndex}-${sl.stepIndex}`}
                        className={`flex items-start gap-2 text-xs rounded-md px-2.5 py-1.5 ${
                          sl.status === 'success'
                            ? 'bg-emerald-900/20 text-emerald-300'
                            : 'bg-red-900/20 text-red-300'
                        }`}
                      >
                        <span className="mt-px shrink-0">
                          {sl.status === 'success' ? <IconCheck /> : <IconAlert />}
                        </span>
                        <span>
                          <span className="font-mono text-gray-400">Step #{sl.stepIndex + 1}</span>
                          <span className="ml-1.5 text-gray-300">{sl.type}</span>
                          {sl.error && <span className="ml-2 text-red-300">{sl.error}</span>}
                        </span>
                      </div>
                    )) : (
                      <p className="px-2 py-1 text-[11px] text-gray-600">No automation steps ran in this tab.</p>
                    )}
                  </div>
                </div>
              );
            }) : selectedLog.steps.map((sl) => (
              <div
                key={`${sl.tabId ?? sl.tabIndex}-${sl.stepIndex}`}
                className={`flex items-start gap-2 text-xs rounded-md px-2.5 py-1.5 ${
                  sl.status === 'success' ? 'bg-emerald-900/20 text-emerald-300' : 'bg-red-900/20 text-red-300'
                }`}
              >
                <span className="mt-px shrink-0">{sl.status === 'success' ? <IconCheck /> : <IconAlert />}</span>
                <span>
                  <span className="font-mono text-gray-400">{sl.tabName} #{sl.stepIndex + 1}</span>
                  <span className="ml-1.5 text-gray-300">{sl.type}</span>
                  {sl.error && <span className="ml-2 text-red-300">{sl.error}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
