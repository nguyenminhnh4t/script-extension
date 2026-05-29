import type { Scenario, RunLog, StepLog, Step } from '../types';
import { normalizeScenario, saveRunLog } from '../storage';

async function ensureContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
}

async function runStepInTab(tabId: number, step: Step): Promise<void> {
  const response = await chrome.tabs.sendMessage(tabId, { type: 'RUN_STEP', step });
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Unknown error in content script');
  }
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

async function createOrResolveTab(startUrl: string, useActiveTab: boolean): Promise<number> {
  if (startUrl) {
    const tab = await chrome.tabs.create({ url: startUrl });
    const tabId = tab.id;
    if (!tabId) throw new Error('Created tab has no id');
    await waitForTabLoad(tabId);
    return tabId;
  }

  if (useActiveTab) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) return activeTab.id;
  }

  const tab = await chrome.tabs.create({ url: 'about:blank' });
  if (!tab.id) throw new Error('Created tab has no id');
  return tab.id;
}

export async function runScenario(
  rawScenario: Scenario,
  onProgress: (stepIndex: number, stepLog: StepLog) => void
): Promise<RunLog> {
  const scenario = normalizeScenario(rawScenario);
  if (!scenario) throw new Error('Invalid scenario');

  const startedAt = new Date().toISOString();
  const stepLogs: StepLog[] = [];
  const tabIds: number[] = [];
  const closedTabs = new Set<number>();
  const totalSteps = scenario.tabs.reduce((sum, tab) => sum + tab.steps.length, 0);
  let globalStepIndex = 0;

  for (let i = 0; i < scenario.tabs.length; i++) {
    tabIds[i] = await createOrResolveTab(scenario.tabs[i].startUrl, i === 0);
  }

  chrome.tabs.onRemoved.addListener((removedId) => {
    closedTabs.add(removedId);
  });

  for (let tabIndex = 0; tabIndex < scenario.tabs.length; tabIndex++) {
    const scenarioTab = scenario.tabs[tabIndex];
    const tabId = tabIds[tabIndex];
    if (!tabId) throw new Error(`No tab available for ${scenarioTab.name}`);

    for (let i = 0; i < scenarioTab.steps.length; i++) {
      const step = scenarioTab.steps[i];

      if (closedTabs.has(tabId)) {
        const stepLog: StepLog = {
          tabIndex,
          tabName: scenarioTab.name,
          stepIndex: i,
          type: step.type,
          status: 'error',
          error: 'Tab was closed',
        };
        stepLogs.push(stepLog);
        onProgress(globalStepIndex, stepLog);
        const log: RunLog = {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          startedAt,
          endedAt: new Date().toISOString(),
          status: 'error',
          steps: stepLogs,
        };
        await saveRunLog(log);
        return log;
      }

      if (step.type === 'open_url') {
        await chrome.tabs.update(tabId, { url: step.url });
        await waitForTabLoad(tabId);
        await ensureContentScript(tabId);
        const stepLog: StepLog = {
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
        await runStepInTab(tabId, step);
        const stepLog: StepLog = {
          tabIndex,
          tabName: scenarioTab.name,
          stepIndex: i,
          type: step.type,
          status: 'success',
        };
        stepLogs.push(stepLog);
        onProgress(globalStepIndex, stepLog);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        const stepLog: StepLog = {
          tabIndex,
          tabName: scenarioTab.name,
          stepIndex: i,
          type: step.type,
          status: 'error',
          error,
        };
        stepLogs.push(stepLog);
        onProgress(globalStepIndex, stepLog);
        const log: RunLog = {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          startedAt,
          endedAt: new Date().toISOString(),
          status: 'error',
          steps: stepLogs,
        };
        await saveRunLog(log);
        return log;
      }

      globalStepIndex++;
    }
  }

  if (totalSteps === 0) {
    const log: RunLog = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      startedAt,
      endedAt: new Date().toISOString(),
      status: 'success',
      steps: stepLogs,
    };
    await saveRunLog(log);
    return log;
  }

  const log: RunLog = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    startedAt,
    endedAt: new Date().toISOString(),
    status: 'success',
    steps: stepLogs,
  };
  await saveRunLog(log);
  return log;
}
