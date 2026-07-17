import type { Scenario, RunLog, StepLog, Step } from '../types';
import { normalizeScenario, saveRunLog } from '../storage';

export interface RunControl {
  isStopped: () => boolean;
  runId: string;
  signal?: AbortSignal;
  onCleanupTabsChanged?: (tabIds: number[]) => void;
  onTargetTabResolved?: (tabId: number, context: RunTabContext) => void;
}

export interface RunTabContext {
  tabIndex: number;
  scenarioTabId: string;
  tabName: string;
}

async function ensureContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
}

async function runStepInTab(tabId: number, step: Step, runId: string): Promise<void> {
  const response = await chrome.tabs.sendMessage(tabId, { type: 'RUN_STEP', step, runId });
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Unknown error in content script');
  }
}

function stoppedError(): Error {
  return new Error('Stopped');
}

function throwIfStopped(control?: RunControl): void {
  if (control?.isStopped() || control?.signal?.aborted) throw stoppedError();
}

function waitForTabLoad(tabId: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      signal?.removeEventListener('abort', onAbort);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onUpdated = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    const onRemoved = (id: number) => {
      if (id === tabId) finish(new Error('Tab was closed'));
    };
    const onAbort = () => finish(stoppedError());

    if (signal?.aborted) {
      finish(stoppedError());
      return;
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    signal?.addEventListener('abort', onAbort, { once: true });

    chrome.tabs.get(tabId)
      .then((tab) => {
        if (tab.status === 'complete') finish();
      })
      .catch(() => finish(new Error('Tab was closed')));
  });
}

interface ResolvedTab {
  id: number;
  created: boolean;
}

function normalizeRunUrl(startUrl: string): string {
  return startUrl || 'about:blank';
}

async function createOrResolveTab(
  startUrl: string,
  useActiveTab: boolean,
  windowId: number | undefined,
  control: RunControl | undefined,
  onCreated: (tabId: number) => void
): Promise<ResolvedTab> {
  throwIfStopped(control);
  if (startUrl) {
    const tab = await chrome.tabs.create({ url: startUrl, ...(windowId != null ? { windowId } : {}) });
    const tabId = tab.id;
    if (!tabId) throw new Error('Created tab has no id');
    onCreated(tabId);
    throwIfStopped(control);
    await waitForTabLoad(tabId, control?.signal);
    return { id: tabId, created: true };
  }

  if (useActiveTab) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) return { id: activeTab.id, created: false };
  }

  const tab = await chrome.tabs.create({ url: 'about:blank', ...(windowId != null ? { windowId } : {}) });
  if (!tab.id) throw new Error('Created tab has no id');
  onCreated(tab.id);
  throwIfStopped(control);
  return { id: tab.id, created: true };
}

async function createRunWindow(
  startUrl: string,
  width: number,
  height: number,
  screenX: number,
  screenY: number,
  control: RunControl | undefined,
  onCreated: (tabId: number) => void
): Promise<ResolvedTab & { windowId: number }> {
  throwIfStopped(control);
  const win = await chrome.windows.create({
    url: normalizeRunUrl(startUrl),
    left: screenX,
    top: screenY,
    width,
    height,
    focused: true,
    type: 'normal',
  });
  if (!win) throw new Error('Window could not be created');
  const tabId = win.tabs?.[0]?.id;
  if (!win.id || !tabId) throw new Error('Created window has no tab');
  onCreated(tabId);
  throwIfStopped(control);
  if (startUrl) await waitForTabLoad(tabId, control?.signal);
  return { id: tabId, windowId: win.id, created: true };
}

export async function runScenario(
  rawScenario: Scenario,
  onProgress: (stepIndex: number, stepLog: StepLog) => void,
  control?: RunControl
): Promise<RunLog> {
  const normalizedScenario = normalizeScenario(rawScenario);
  if (!normalizedScenario) throw new Error('Invalid scenario');
  const scenario: Scenario = normalizedScenario;

  const startedAt = new Date().toISOString();
  const stepLogs: StepLog[] = [];
  const tabIds: number[] = [];
  const cleanupTabIds: number[] = [];
  const closedTabs = new Set<number>();
  const windowIdsByTabId = new Map<string, number>();
  const totalSteps = scenario.tabs.reduce((sum, tab) => sum + tab.steps.length, 0);
  let globalStepIndex = 0;

  function trackCleanupTab(tabId: number): void {
    if (cleanupTabIds.includes(tabId)) return;
    cleanupTabIds.push(tabId);
    control?.onCleanupTabsChanged?.(cleanupTabIds.filter((id) => !closedTabs.has(id)));
  }

  function trackCreatedTab(tabId: number, context: RunTabContext): void {
    trackCleanupTab(tabId);
    control?.onTargetTabResolved?.(tabId, context);
  }

  function buildLog(status: 'success' | 'error'): RunLog {
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      startedAt,
      endedAt: new Date().toISOString(),
      status,
      tabs: [],
      steps: stepLogs,
      cleanupTabIds: cleanupTabIds.filter((tabId) => !closedTabs.has(tabId)),
    };
  }

  async function stopIfRequested(): Promise<RunLog | null> {
    if (!control?.isStopped()) return null;
    const log = buildLog('error');
    await saveRunLog(log);
    return log;
  }

  const handleTabRemoved = (removedId: number) => {
    closedTabs.add(removedId);
    if (cleanupTabIds.includes(removedId)) {
      control?.onCleanupTabsChanged?.(cleanupTabIds.filter((id) => !closedTabs.has(id)));
    }
  };
  chrome.tabs.onRemoved.addListener(handleTabRemoved);

  try {
    for (let i = 0; i < scenario.tabs.length; i++) {
      throwIfStopped(control);
      const scenarioTab = scenario.tabs[i];
      const tabContext: RunTabContext = {
        tabIndex: i,
        scenarioTabId: scenarioTab.id,
        tabName: scenarioTab.name,
      };
      if (scenarioTab.openInNewWindow) {
        const targetWindowId = scenarioTab.windowTargetTabId
          ? windowIdsByTabId.get(scenarioTab.windowTargetTabId)
          : undefined;
        if (targetWindowId != null) {
          const resolvedTab = await createOrResolveTab(
            scenarioTab.startUrl,
            false,
            targetWindowId,
            control,
            (tabId) => trackCreatedTab(tabId, tabContext)
          );
          tabIds[i] = resolvedTab.id;
          if (!resolvedTab.created) control?.onTargetTabResolved?.(resolvedTab.id, tabContext);
          windowIdsByTabId.set(scenarioTab.id, targetWindowId);
        } else {
          const resolvedTab = await createRunWindow(
            scenarioTab.startUrl,
            scenarioTab.windowWidth,
            scenarioTab.windowHeight,
            scenarioTab.windowScreenX,
            scenarioTab.windowScreenY,
            control,
            (tabId) => trackCreatedTab(tabId, tabContext)
          );
          tabIds[i] = resolvedTab.id;
          if (!resolvedTab.created) control?.onTargetTabResolved?.(resolvedTab.id, tabContext);
          windowIdsByTabId.set(scenarioTab.id, resolvedTab.windowId);
        }
      } else {
        const resolvedTab = await createOrResolveTab(
          scenarioTab.startUrl,
          i === 0,
          undefined,
          control,
          (tabId) => trackCreatedTab(tabId, tabContext)
        );
        tabIds[i] = resolvedTab.id;
        if (!resolvedTab.created) control?.onTargetTabResolved?.(resolvedTab.id, tabContext);
      }
    }

    for (let tabIndex = 0; tabIndex < scenario.tabs.length; tabIndex++) {
      const stoppedBeforeTab = await stopIfRequested();
      if (stoppedBeforeTab) return stoppedBeforeTab;
      const scenarioTab = scenario.tabs[tabIndex];
      const tabId = tabIds[tabIndex];
      if (!tabId) throw new Error(`No tab available for ${scenarioTab.name}`);

      for (let i = 0; i < scenarioTab.steps.length; i++) {
        const stoppedBeforeStep = await stopIfRequested();
        if (stoppedBeforeStep) return stoppedBeforeStep;
        const step = scenarioTab.steps[i];

        if (closedTabs.has(tabId)) {
          const stepLog: StepLog = {
            tabId,
            tabIndex,
            tabName: scenarioTab.name,
            stepIndex: i,
            type: step.type,
            status: 'error',
            error: 'Tab was closed',
          };
          stepLogs.push(stepLog);
          onProgress(globalStepIndex, stepLog);
          const log = buildLog('error');
          await saveRunLog(log);
          return log;
        }

        if (step.type === 'open_url') {
          await chrome.tabs.update(tabId, { url: step.url });
          await waitForTabLoad(tabId, control?.signal);
          const stoppedAfterLoad = await stopIfRequested();
          if (stoppedAfterLoad) return stoppedAfterLoad;
          await ensureContentScript(tabId);
          const stoppedAfterScript = await stopIfRequested();
          if (stoppedAfterScript) return stoppedAfterScript;
          const stepLog: StepLog = {
            tabId,
            tabIndex,
            tabName: scenarioTab.name,
            stepIndex: i,
            type: step.type,
            status: 'success',
          };
          stepLogs.push(stepLog);
          onProgress(globalStepIndex, stepLog);
          globalStepIndex++;
          continue;
        }

        try {
          await ensureContentScript(tabId);
          const stoppedAfterScript = await stopIfRequested();
          if (stoppedAfterScript) return stoppedAfterScript;
          await runStepInTab(tabId, step, control?.runId ?? 'legacy');
          const stoppedAfterStep = await stopIfRequested();
          if (stoppedAfterStep) return stoppedAfterStep;
          const stepLog: StepLog = {
            tabId,
            tabIndex,
            tabName: scenarioTab.name,
            stepIndex: i,
            type: step.type,
            status: 'success',
          };
          stepLogs.push(stepLog);
          onProgress(globalStepIndex, stepLog);
        } catch (err) {
          const stoppedDuringStep = await stopIfRequested();
          if (stoppedDuringStep) return stoppedDuringStep;
          const error = err instanceof Error ? err.message : String(err);
          const stepLog: StepLog = {
            tabId,
            tabIndex,
            tabName: scenarioTab.name,
            stepIndex: i,
            type: step.type,
            status: 'error',
            error,
          };
          stepLogs.push(stepLog);
          onProgress(globalStepIndex, stepLog);
          const log = buildLog('error');
          await saveRunLog(log);
          return log;
        }

        globalStepIndex++;
      }
    }

    if (totalSteps === 0) {
      const log = buildLog('success');
      await saveRunLog(log);
      return log;
    }

    const log = buildLog('success');
    await saveRunLog(log);
    return log;
  } catch (err) {
    if (control?.isStopped() || control?.signal?.aborted) {
      const log = buildLog('error');
      await saveRunLog(log);
      return log;
    }
    throw err;
  } finally {
    chrome.tabs.onRemoved.removeListener(handleTabRemoved);
  }
}
