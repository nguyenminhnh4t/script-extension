import type { Scenario, RunLog, StepLog, Step } from '../types';
import { saveRunLog } from '../storage';

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

export async function runScenario(
  scenario: Scenario,
  onProgress: (stepIndex: number, stepLog: StepLog) => void
): Promise<RunLog> {
  const startedAt = new Date().toISOString();
  const stepLogs: StepLog[] = [];

  let tabId: number | undefined;

  if (scenario.startUrl) {
    const tab = await chrome.tabs.create({ url: scenario.startUrl });
    tabId = tab.id!;
    await waitForTabLoad(tabId);
  } else {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = activeTab?.id;
  }

  if (!tabId) throw new Error('No tab available to run scenario');

  await ensureContentScript(tabId);

  let tabClosed = false;
  chrome.tabs.onRemoved.addListener((removedId) => {
    if (removedId === tabId) tabClosed = true;
  });

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];

    if (tabClosed) {
      const stepLog: StepLog = { stepIndex: i, type: step.type, status: 'error', error: 'Tab was closed' };
      stepLogs.push(stepLog);
      onProgress(i, stepLog);
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
      const stepLog: StepLog = { stepIndex: i, type: step.type, status: 'success' };
      stepLogs.push(stepLog);
      onProgress(i, stepLog);
      continue;
    }

    try {
      await runStepInTab(tabId, step);
      const stepLog: StepLog = { stepIndex: i, type: step.type, status: 'success' };
      stepLogs.push(stepLog);
      onProgress(i, stepLog);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const stepLog: StepLog = { stepIndex: i, type: step.type, status: 'error', error };
      stepLogs.push(stepLog);
      onProgress(i, stepLog);
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
