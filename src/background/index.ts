import type { RuntimeMessage, StepLog } from '../types';
import { runScenario } from './runner';

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'RUN_SCENARIO') {
    const scenario = message.scenario;

    runScenario(scenario, (stepIndex: number, stepLog: StepLog) => {
      chrome.runtime.sendMessage<RuntimeMessage>({
        type: 'RUN_PROGRESS',
        stepIndex,
        stepLog,
      }).catch(() => {
        // Popup may be closed — ignore
      });
    })
      .then((log) => {
        sendResponse({ ok: true, log });
      })
      .catch((err: Error) => {
        sendResponse({ ok: false, error: err.message });
      });

    return true;
  }
});
