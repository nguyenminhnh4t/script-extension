import type { RuntimeMessage, StepLog } from '../types';
import { runScenario } from './runner';
import { getPickTarget, savePickTarget } from '../storage';

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'RUN_SCENARIO') {
    const scenario = message.scenario;

    runScenario(scenario, (stepIndex: number, stepLog: StepLog) => {
      chrome.runtime.sendMessage<RuntimeMessage>({
        type: 'RUN_PROGRESS',
        stepIndex,
        stepLog,
      }).catch(() => {});
    })
      .then((log) => sendResponse({ ok: true, log }))
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
        savePickTarget({ stepIndex: existing.stepIndex, selector });
      }
    });
    chrome.runtime.sendMessage(message).catch(() => {});
    return false;
  }

  if (message.type === 'PICK_CANCELLED') {
    chrome.runtime.sendMessage(message).catch(() => {});
    return false;
  }
});
