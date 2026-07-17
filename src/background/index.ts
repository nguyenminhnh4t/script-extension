import type { RunTabLog, RuntimeMessage, StepLog } from '../types';
import { runScenario } from './runner';
import { getPickTarget, getRunStatuses, savePickTarget, saveRunLog, saveRunStatus } from '../storage';

interface PersistedActiveRun {
  runId: string;
  cleanupTabIds: number[];
  targetTabIds: number[];
}

const activeRuns = new Map<string, {
  stop: () => Promise<number>;
  cleanupTabIds: Set<number>;
  targetTabIds: Set<number>;
}>();

function getLastStepError(steps: StepLog[]): string | undefined {
  return steps.reduce<string | undefined>(
    (lastError, step) => step.status === 'error' ? step.error : lastError,
    undefined
  );
}

function activeRunStorageKey(scenarioId: string): string {
  return `activeRun:${scenarioId}`;
}

function isPersistedActiveRun(value: unknown): value is PersistedActiveRun {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<PersistedActiveRun>;
  return typeof run.runId === 'string'
    && Array.isArray(run.cleanupTabIds)
    && Array.isArray(run.targetTabIds);
}

async function getPersistedActiveRun(scenarioId: string): Promise<PersistedActiveRun | undefined> {
  const key = activeRunStorageKey(scenarioId);
  const stored = await chrome.storage.session.get(key);
  return isPersistedActiveRun(stored[key]) ? stored[key] : undefined;
}

async function removePersistedActiveRun(scenarioId: string, runId: string): Promise<void> {
  const persisted = await getPersistedActiveRun(scenarioId);
  if (persisted?.runId === runId) {
    await chrome.storage.session.remove(activeRunStorageKey(scenarioId));
  }
}

async function closeTab(tabId: number): Promise<number> {
  try {
    await chrome.tabs.remove(tabId);
    return 1;
  } catch {
    return 0;
  }
}

// Open side panel when user clicks the extension icon
chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId != null) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'RUN_SCENARIO') {
    const scenario = message.scenario;
    activeRuns.get(scenario.id)?.stop();
    let stopped = false;
    let stopPromise: Promise<number> | null = null;
    const abortController = new AbortController();
    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const cleanupTabIds = new Set<number>();
    const targetTabIds = new Set<number>();
    const runTabs = new Map<number, RunTabLog>();
    let persistenceQueue = Promise.resolve();
    const persistActiveRun = () => {
      const snapshot: PersistedActiveRun = {
        runId,
        cleanupTabIds: Array.from(cleanupTabIds),
        targetTabIds: Array.from(targetTabIds),
      };
      persistenceQueue = persistenceQueue
        .then(() => chrome.storage.session.set({ [activeRunStorageKey(scenario.id)]: snapshot }))
        .catch(() => {});
    };
    const runningStatus = (currentStep: number) => ({
      state: 'running' as const,
      currentStep,
      log: {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        startedAt,
        endedAt: '',
        status: 'error' as const,
        tabs: Array.from(runTabs.values()),
        steps: [],
        cleanupTabIds: Array.from(cleanupTabIds),
      },
    });
    const trackSpawnedTab = (tab: chrome.tabs.Tab) => {
      if (!tab.id || tab.openerTabId == null || !targetTabIds.has(tab.openerTabId)) return;
      const opener = runTabs.get(tab.openerTabId);
      cleanupTabIds.add(tab.id);
      targetTabIds.add(tab.id);
      runTabs.set(tab.id, {
        tabId: tab.id,
        tabName: tab.title || `Opened from ${opener?.tabName ?? `tab ${tab.openerTabId}`}`,
        url: tab.pendingUrl || tab.url || '',
        openedAt: new Date().toISOString(),
        source: 'spawned',
        openerTabId: tab.openerTabId,
      });
      persistActiveRun();
      saveRunStatus(scenario.id, runningStatus(0)).catch(() => {});
      if (stopped) {
        chrome.tabs.sendMessage(tab.id, { type: 'CANCEL_RUN', runId }).catch(() => {});
        void closeTab(tab.id);
      }
    };
    chrome.tabs.onCreated.addListener(trackSpawnedTab);
    const trackUpdatedTab = (
      tabId: number,
      changeInfo: { url?: string; title?: string },
      tab: chrome.tabs.Tab
    ) => {
      const existing = runTabs.get(tabId);
      if (!existing || (!changeInfo.url && !changeInfo.title)) return;
      runTabs.set(tabId, {
        ...existing,
        url: changeInfo.url || tab.url || existing.url,
        tabName: existing.source === 'spawned'
          ? changeInfo.title || tab.title || existing.tabName
          : existing.tabName,
      });
      saveRunStatus(scenario.id, runningStatus(0)).catch(() => {});
    };
    chrome.tabs.onUpdated.addListener(trackUpdatedTab);
    const trackClosedTab = (tabId: number) => {
      const removedFromCleanup = cleanupTabIds.delete(tabId);
      const removedFromTargets = targetTabIds.delete(tabId);
      if (!removedFromCleanup && !removedFromTargets) return;
      persistActiveRun();
      saveRunStatus(scenario.id, runningStatus(0)).catch(() => {});
    };
    chrome.tabs.onRemoved.addListener(trackClosedTab);
    const stop = (): Promise<number> => {
      if (stopPromise) return stopPromise;
      stopped = true;
      abortController.abort();
      targetTabIds.forEach((tabId) => {
        chrome.tabs.sendMessage(tabId, { type: 'CANCEL_RUN', runId }).catch(() => {});
      });
      stopPromise = Promise.all(Array.from(cleanupTabIds, closeTab))
        .then((closed) => closed.reduce<number>((sum, count) => sum + count, 0));
      return stopPromise;
    };
    activeRuns.set(scenario.id, { stop, cleanupTabIds, targetTabIds });
    persistActiveRun();
    saveRunStatus(scenario.id, runningStatus(0)).catch(() => {});

    runScenario(scenario, (stepIndex: number, stepLog: StepLog) => {
      saveRunStatus(scenario.id, runningStatus(stepIndex)).catch(() => {});
      chrome.runtime.sendMessage<RuntimeMessage>({
        type: 'RUN_PROGRESS',
        scenarioId: scenario.id,
        stepIndex,
        stepLog,
      }).catch(() => {});
    }, {
      isStopped: () => stopped,
      runId,
      signal: abortController.signal,
      onCleanupTabsChanged: (ids) => {
        ids.forEach((id) => cleanupTabIds.add(id));
        persistActiveRun();
        if (stopped) ids.forEach((id) => { void closeTab(id); });
        saveRunStatus(scenario.id, runningStatus(0)).catch(() => {});
      },
      onTargetTabResolved: (tabId, context) => {
        targetTabIds.add(tabId);
        const existing = runTabs.get(tabId);
        runTabs.set(tabId, {
          tabId,
          tabIndex: context.tabIndex,
          scenarioTabId: context.scenarioTabId,
          tabName: context.tabName,
          url: existing?.url ?? '',
          openedAt: existing?.openedAt ?? new Date().toISOString(),
          source: 'scenario',
        });
        chrome.tabs.get(tabId).then((tab) => {
          const tracked = runTabs.get(tabId);
          if (!tracked) return;
          runTabs.set(tabId, {
            ...tracked,
            url: tab.pendingUrl || tab.url || tracked.url,
          });
          saveRunStatus(scenario.id, runningStatus(0)).catch(() => {});
        }).catch(() => {});
        persistActiveRun();
        if (stopped) {
          chrome.tabs.sendMessage(tabId, { type: 'CANCEL_RUN', runId }).catch(() => {});
        }
      },
    })
      .then(async (log) => {
        const completedLog = {
          ...log,
          tabs: Array.from(runTabs.values()),
          cleanupTabIds: Array.from(cleanupTabIds),
        };
        const lastError = getLastStepError(completedLog.steps);
        const error = stopped ? 'Stopped' : lastError;
        saveRunStatus(scenario.id, {
          state: completedLog.status === 'success' ? 'success' : 'error',
          log: completedLog,
          ...(error ? { error } : {}),
        }).catch(() => {});
        await saveRunLog(completedLog).catch(() => {});
        chrome.runtime.sendMessage<RuntimeMessage>({
          type: 'RUN_COMPLETE',
          log: completedLog,
        }).catch(() => {});
        sendResponse({ ok: true, log: completedLog });
      })
      .catch((err: Error) => {
        saveRunStatus(scenario.id, { state: 'error', error: err.message }).catch(() => {});
        sendResponse({ ok: false, error: err.message });
      })
      .finally(() => {
        chrome.tabs.onCreated.removeListener(trackSpawnedTab);
        chrome.tabs.onUpdated.removeListener(trackUpdatedTab);
        chrome.tabs.onRemoved.removeListener(trackClosedTab);
        persistenceQueue
          .then(() => removePersistedActiveRun(scenario.id, runId))
          .catch(() => {});
        if (activeRuns.get(scenario.id)?.stop === stop) activeRuns.delete(scenario.id);
      });

    return true;
  }

  if (message.type === 'STOP_SCENARIO') {
    const run = activeRuns.get(message.scenarioId);
    if (!run) {
      Promise.all([getPersistedActiveRun(message.scenarioId), getRunStatuses()])
        .then(async ([persisted, statuses]) => {
          const statusTabIds = statuses[message.scenarioId]?.log?.cleanupTabIds ?? [];
          const cleanupTabIds = Array.from(new Set([
            ...(persisted?.cleanupTabIds ?? []),
            ...statusTabIds,
          ]));

          if (persisted) {
            persisted.targetTabIds.forEach((tabId) => {
              chrome.tabs.sendMessage(tabId, {
                type: 'CANCEL_RUN',
                runId: persisted.runId,
              }).catch(() => {});
            });
          }

          const closed = (await Promise.all(cleanupTabIds.map(closeTab)))
            .reduce<number>((sum, count) => sum + count, 0);
          if (persisted) {
            await removePersistedActiveRun(message.scenarioId, persisted.runId);
          }
          sendResponse({
            ok: cleanupTabIds.length > 0 || Boolean(persisted),
            closed,
            ...(cleanupTabIds.length === 0 && !persisted
              ? { error: 'Scenario is not running' }
              : {}),
          });
        })
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true;
    }
    run.stop()
      .then((closed) => sendResponse({ ok: true, closed }))
      .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_ACTIVE_RUNS') {
    sendResponse({ ok: true, scenarioIds: Array.from(activeRuns.keys()) });
    return false;
  }

  if (message.type === 'CLEANUP_TABS') {
    Promise.allSettled(message.tabIds.map((tabId) => chrome.tabs.remove(tabId)))
      .then((results) => {
        const closed = results.filter((result) => result.status === 'fulfilled').length;
        sendResponse({ ok: true, closed });
      })
      .catch((err: Error) => sendResponse({ ok: false, error: err.message }));

    return true;
  }

  if (message.type === 'START_PICK_MODE') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) { sendResponse({ ok: false }); return; }
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        await chrome.tabs.sendMessage(tabId, { type: 'START_PICK_MODE' });
        sendResponse({ ok: true });
      } catch {
        sendResponse({ ok: false });
      }
    });
    return true;
  }

  // PICK_COMPLETE: write selector into storage (popup may already be closed),
  // then try to relay to popup if it's still open.
  if (message.type === 'PICK_COMPLETE') {
    const selector = message.selector;
    getPickTarget().then((existing) => {
      if (existing) {
        savePickTarget({ tabIndex: existing.tabIndex, stepIndex: existing.stepIndex, selector });
      }
    });
    chrome.runtime.sendMessage(message).catch(() => {});
    return false;
  }

  if (message.type === 'PICK_CANCELLED') {
    chrome.runtime.sendMessage(message).catch(() => {});
    return false;
  }

  if (message.type === 'START_RECORD_KEY') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) { sendResponse({ ok: false }); return; }
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        await chrome.tabs.sendMessage(tabId, { type: 'START_RECORD_KEY' });
        sendResponse({ ok: true });
      } catch {
        sendResponse({ ok: false });
      }
    });
    return true;
  }

  if (message.type === 'RECORD_KEY_COMPLETE' || message.type === 'RECORD_KEY_CANCELLED') {
    chrome.runtime.sendMessage(message).catch(() => {});
    return false;
  }
});
