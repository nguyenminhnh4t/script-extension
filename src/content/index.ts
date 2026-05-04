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
    case 'press': {
      const target = (document.activeElement as HTMLElement | null) ?? document.body;
      const init: KeyboardEventInit = { key: step.key, bubbles: true, cancelable: true };
      target.dispatchEvent(new KeyboardEvent('keydown', init));
      target.dispatchEvent(new KeyboardEvent('keypress', init));
      target.dispatchEvent(new KeyboardEvent('keyup', init));
      break;
    }
    default:
      throw new Error(`Unknown step type: ${(step as Step).type}`);
  }
}

// --- Selector generator ---

function buildSelector(el: Element): string {
  // Prefer id
  if (el.id) return `#${CSS.escape(el.id)}`;

  // Prefer name attribute (common for inputs)
  const name = el.getAttribute('name');
  if (name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;

  // Try unique class combo
  if (el.classList.length > 0) {
    const sel = `${el.tagName.toLowerCase()}.${Array.from(el.classList).map(CSS.escape).join('.')}`;
    if (document.querySelectorAll(sel).length === 1) return sel;
  }

  // nth-child fallback
  const parent = el.parentElement;
  if (parent) {
    const index = Array.from(parent.children).indexOf(el) + 1;
    const parentSel = buildSelector(parent);
    return `${parentSel} > ${el.tagName.toLowerCase()}:nth-child(${index})`;
  }

  return el.tagName.toLowerCase();
}

// --- Pick mode ---

let pickCleanup: (() => void) | null = null;

function startPickMode(): void {
  if (pickCleanup) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'cursor:crosshair', 'background:transparent',
  ].join(';');

  const prevOutline = { el: null as HTMLElement | null, value: '' };

  function highlight(target: EventTarget | null): void {
    if (prevOutline.el) {
      prevOutline.el.style.outline = prevOutline.value;
      prevOutline.el = null;
    }
    if (target instanceof HTMLElement && target !== overlay) {
      prevOutline.el = target;
      prevOutline.value = target.style.outline;
      target.style.outline = '2px solid #3b82f6';
    }
  }

  function onMouseMove(e: MouseEvent): void {
    overlay.style.pointerEvents = 'none';
    const real = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.pointerEvents = 'auto';
    highlight(real);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') cancel();
  }

  function cancel(): void {
    cleanup();
    chrome.runtime.sendMessage({ type: 'PICK_CANCELLED' }).catch(() => {});
  }

  function onClick(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    overlay.style.pointerEvents = 'none';
    const real = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.pointerEvents = 'auto';
    if (!real) { cancel(); return; }
    const selector = buildSelector(real);
    cleanup();
    chrome.runtime.sendMessage({ type: 'PICK_COMPLETE', selector }).catch(() => {});
  }

  function cleanup(): void {
    if (prevOutline.el) {
      prevOutline.el.style.outline = prevOutline.value;
    }
    overlay.removeEventListener('mousemove', onMouseMove);
    overlay.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
    pickCleanup = null;
  }

  pickCleanup = cleanup;
  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(overlay);
}

// --- Record key mode ---

let recordKeyCleanup: (() => void) | null = null;

function startRecordKeyMode(): void {
  if (recordKeyCleanup) return;

  const banner = document.createElement('div');
  banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
    'background:#1e3a5f', 'color:#93c5fd', 'font:13px/1 monospace',
    'text-align:center', 'padding:8px', 'letter-spacing:.05em',
    'border-bottom:1px solid #3b82f6',
  ].join(';');
  banner.textContent = 'Press any key to record  ·  Esc to cancel';

  function onKeyDown(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopImmediatePropagation();
    const key = e.key;
    cleanup();
    if (key === 'Escape') {
      chrome.runtime.sendMessage({ type: 'RECORD_KEY_CANCELLED' }).catch(() => {});
    } else {
      chrome.runtime.sendMessage({ type: 'RECORD_KEY_COMPLETE', key }).catch(() => {});
    }
  }

  function cleanup(): void {
    document.removeEventListener('keydown', onKeyDown, { capture: true });
    banner.remove();
    recordKeyCleanup = null;
  }

  recordKeyCleanup = cleanup;
  document.addEventListener('keydown', onKeyDown, { capture: true });
  document.body.appendChild(banner);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'RUN_STEP') {
    executeStep(message.step as Step)
      .then(() => sendResponse({ ok: true }))
      .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (message.type === 'START_PICK_MODE') {
    startPickMode();
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === 'START_RECORD_KEY') {
    startRecordKeyMode();
    sendResponse({ ok: true });
    return true;
  }
});
