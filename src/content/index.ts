import type { Step } from '../types';

function setNativeValue(element: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('Cannot find native input setter');
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function waitForElement(selector: string, timeout: number): Promise<Element> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(interval);
        resolve(el);
      } else if (Date.now() - start >= timeout) {
        clearInterval(interval);
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }
    }, 300);
  });
}

async function executeStep(step: Step): Promise<void> {
  switch (step.type) {
    case 'fill': {
      const el = document.querySelector<HTMLInputElement>(step.selector);
      if (!el) throw new Error(`Element not found: ${step.selector}`);
      setNativeValue(el, step.value);
      break;
    }
    case 'click': {
      const el = document.querySelector<HTMLElement>(step.selector);
      if (!el) throw new Error(`Element not found: ${step.selector}`);
      el.click();
      break;
    }
    case 'select': {
      const el = document.querySelector<HTMLSelectElement>(step.selector);
      if (!el) throw new Error(`Element not found: ${step.selector}`);
      el.value = step.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      break;
    }
    case 'wait': {
      await new Promise((r) => setTimeout(r, step.duration));
      break;
    }
    case 'wait_for_element': {
      await waitForElement(step.selector, step.timeout);
      break;
    }
    default:
      throw new Error(`Unknown step type: ${(step as Step).type}`);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'RUN_STEP') {
    executeStep(message.step as Step)
      .then(() => sendResponse({ ok: true }))
      .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
