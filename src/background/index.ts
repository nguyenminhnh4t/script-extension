import type { RuntimeMessage, StepLog } from '../types';
import { runScenario } from './runner';
import { getPickTarget, savePickTarget, saveRunStatus } from '../storage';

// Open side panel when user clicks the extension icon
chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId != null) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'RUN_SCENARIO') {
    const scenario = message.scenario;
    saveRunStatus(scenario.id, { state: 'running', currentStep: 0 }).catch(() => {});

    runScenario(scenario, (stepIndex: number, stepLog: StepLog) => {
      saveRunStatus(scenario.id, { state: 'running', currentStep: stepIndex }).catch(() => {});
      chrome.runtime.sendMessage<RuntimeMessage>({
        type: 'RUN_PROGRESS',
        scenarioId: scenario.id,
        stepIndex,
        stepLog,
      }).catch(() => {});
    })
      .then((log) => {
        const lastError = log.steps.findLast((step) => step.status === 'error')?.error;
        saveRunStatus(scenario.id, {
          state: log.status === 'success' ? 'success' : 'error',
          log,
          ...(lastError ? { error: lastError } : {}),
        }).catch(() => {});
        sendResponse({ ok: true, log });
      })
      .catch((err: Error) => {
        saveRunStatus(scenario.id, { state: 'error', error: err.message }).catch(() => {});
        sendResponse({ ok: false, error: err.message });
      });

    return true;
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
