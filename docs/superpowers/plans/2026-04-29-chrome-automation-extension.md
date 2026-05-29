# Chrome Automation Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight Chrome Extension (MV3) that lets users create, edit, and run config-based browser automation scenarios via a popup UI.

**Architecture:** Vite builds the popup and injects scripts; a background service worker orchestrates scenario execution by injecting the content script into tabs; the content script executes DOM actions (fill, click, select, wait). Scenarios and logs are persisted in `chrome.storage.local`.

**Tech Stack:** Vite, TypeScript, Tailwind CSS, Chrome Extension MV3 APIs (`chrome.storage`, `chrome.tabs`, `chrome.scripting`, `chrome.runtime`), no external runtime dependencies.

---

## File Map

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest — permissions, entry points |
| `vite.config.ts` | Vite multi-entry config for popup + background |
| `tailwind.config.ts` | Tailwind setup |
| `src/types.ts` | Shared TypeScript types (Scenario, Step, RunLog) |
| `src/storage.ts` | CRUD wrappers for `chrome.storage.local` |
| `src/popup/main.tsx` | Popup React entry |
| `src/popup/App.tsx` | Root — view router (list ↔ editor) |
| `src/popup/ScenarioList.tsx` | List scenarios, run/edit/delete buttons |
| `src/popup/ScenarioEditor.tsx` | Create/edit scenario + steps |
| `src/popup/LogViewer.tsx` | Display last run log |
| `src/background/index.ts` | Service worker — receives run messages, drives execution |
| `src/background/runner.ts` | Scenario runner — open tab, iterate steps |
| `src/content/index.ts` | Content script — execute single step via `window.__runStep` |
| `popup.html` | Popup HTML shell |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.js`
- Create: `popup.html`

- [ ] **Step 1: Init npm project**

```bash
cd e:/script-extension
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react react-dom
npm install -D vite @vitejs/plugin-react typescript tailwindcss postcss autoprefixer @types/chrome @types/react @types/react-dom
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
```

- [ ] **Step 4: Create `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./popup.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: Create `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "lib": ["ES2020", "DOM"],
    "types": ["chrome"],
    "outDir": "dist",
    "skipLibCheck": true
  },
  "include": ["src", "vite.config.ts", "tailwind.config.ts"]
}
```

- [ ] **Step 7: Create `popup.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Automation Runner</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/popup/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Simple Automation Runner",
  "version": "1.0.0",
  "description": "Config-driven browser task runner",
  "permissions": ["storage", "tabs", "scripting", "activeTab"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_width": 420,
    "default_height": 600
  },
  "content_scripts": [],
  "web_accessible_resources": [
    {
      "resources": ["content.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

- [ ] **Step 9: Add npm scripts to `package.json`**

Edit `package.json` scripts section:
```json
{
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 10: Commit**

```bash
git init
git add package.json vite.config.ts tailwind.config.ts tsconfig.json postcss.config.js popup.html manifest.json
git commit -m "chore: project scaffold with Vite + React + Tailwind + MV3 manifest"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export type StepType =
  | 'open_url'
  | 'fill'
  | 'click'
  | 'select'
  | 'wait'
  | 'wait_for_element';

export interface OpenUrlStep {
  type: 'open_url';
  url: string;
}

export interface FillStep {
  type: 'fill';
  selector: string;
  value: string;
}

export interface ClickStep {
  type: 'click';
  selector: string;
}

export interface SelectStep {
  type: 'select';
  selector: string;
  value: string;
}

export interface WaitStep {
  type: 'wait';
  duration: number;
}

export interface WaitForElementStep {
  type: 'wait_for_element';
  selector: string;
  timeout: number;
}

export type Step =
  | OpenUrlStep
  | FillStep
  | ClickStep
  | SelectStep
  | WaitStep
  | WaitForElementStep;

export interface Scenario {
  id: string;
  name: string;
  startUrl: string;
  steps: Step[];
}

export type StepStatus = 'pending' | 'success' | 'error';

export interface StepLog {
  stepIndex: number;
  type: StepType;
  status: StepStatus;
  error?: string;
}

export interface RunLog {
  scenarioId: string;
  scenarioName: string;
  startedAt: string;
  endedAt: string;
  status: 'success' | 'error';
  steps: StepLog[];
}

export type RuntimeMessage =
  | { type: 'RUN_SCENARIO'; scenario: Scenario }
  | { type: 'RUN_STEP'; step: Step }
  | { type: 'RUN_COMPLETE'; log: RunLog }
  | { type: 'RUN_PROGRESS'; stepIndex: number; stepLog: StepLog };
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: shared TypeScript types for scenarios, steps, logs"
```

---

## Task 3: Storage Layer

**Files:**
- Create: `src/storage.ts`

- [ ] **Step 1: Create `src/storage.ts`**

```ts
import type { Scenario, RunLog } from './types';

const SCENARIOS_KEY = 'scenarios';
const LOGS_KEY = 'runLogs';

export async function getScenarios(): Promise<Scenario[]> {
  const result = await chrome.storage.local.get(SCENARIOS_KEY);
  return (result[SCENARIOS_KEY] as Scenario[]) ?? [];
}

export async function saveScenario(scenario: Scenario): Promise<void> {
  const scenarios = await getScenarios();
  const idx = scenarios.findIndex((s) => s.id === scenario.id);
  if (idx >= 0) {
    scenarios[idx] = scenario;
  } else {
    scenarios.push(scenario);
  }
  await chrome.storage.local.set({ [SCENARIOS_KEY]: scenarios });
}

export async function deleteScenario(id: string): Promise<void> {
  const scenarios = await getScenarios();
  await chrome.storage.local.set({
    [SCENARIOS_KEY]: scenarios.filter((s) => s.id !== id),
  });
}

export async function getRunLogs(): Promise<RunLog[]> {
  const result = await chrome.storage.local.get(LOGS_KEY);
  return (result[LOGS_KEY] as RunLog[]) ?? [];
}

export async function saveRunLog(log: RunLog): Promise<void> {
  const logs = await getRunLogs();
  logs.unshift(log);
  // Keep last 50 logs
  await chrome.storage.local.set({ [LOGS_KEY]: logs.slice(0, 50) });
}

export async function getLastRunLog(scenarioId: string): Promise<RunLog | undefined> {
  const logs = await getRunLogs();
  return logs.find((l) => l.scenarioId === scenarioId);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/storage.ts
git commit -m "feat: chrome.storage.local CRUD wrappers for scenarios and run logs"
```

---

## Task 4: Content Script

**Files:**
- Create: `src/content/index.ts`

- [ ] **Step 1: Create `src/content/index.ts`**

```ts
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

// Exposed for scripting.executeScript injection
(window as unknown as Record<string, unknown>).__runStep = executeStep;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'RUN_STEP') {
    executeStep(message.step as Step)
      .then(() => sendResponse({ ok: true }))
      .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: content script with fill, click, select, wait, wait_for_element"
```

---

## Task 5: Background Runner

**Files:**
- Create: `src/background/runner.ts`
- Create: `src/background/index.ts`

- [ ] **Step 1: Create `src/background/runner.ts`**

```ts
import type { Scenario, RunLog, StepLog } from '../types';
import { saveRunLog } from '../storage';

async function ensureContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
}

async function runStepInTab(tabId: number, step: import('../types').Step): Promise<void> {
  const response = await chrome.tabs.sendMessage(tabId, { type: 'RUN_STEP', step });
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Unknown error in content script');
  }
}

export async function runScenario(
  scenario: Scenario,
  onProgress: (stepIndex: number, stepLog: StepLog) => void
): Promise<RunLog> {
  const startedAt = new Date().toISOString();
  const stepLogs: StepLog[] = [];

  // Open or reuse tab
  let tabId: number | undefined;

  if (scenario.startUrl) {
    const tab = await chrome.tabs.create({ url: scenario.startUrl });
    tabId = tab.id!;
    // Wait for tab to load
    await new Promise<void>((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(id, info) {
        if (id === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });
  } else {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = activeTab?.id;
  }

  if (!tabId) throw new Error('No tab available to run scenario');

  await ensureContentScript(tabId);

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    // open_url is handled specially — navigate tab instead of content script
    if (step.type === 'open_url') {
      await chrome.tabs.update(tabId, { url: step.url });
      await new Promise<void>((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(id, info) {
          if (id === tabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        });
      });
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
```

- [ ] **Step 2: Create `src/background/index.ts`**

```ts
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

    return true; // async response
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add src/background/runner.ts src/background/index.ts
git commit -m "feat: background service worker scenario runner with tab management"
```

---

## Task 6: Popup — Entry & App Shell

**Files:**
- Create: `src/popup/main.tsx`
- Create: `src/popup/App.tsx`
- Create: `src/popup/index.css`

- [ ] **Step 1: Create `src/popup/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: Create `src/popup/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Create `src/popup/App.tsx`**

```tsx
import { useState } from 'react';
import type { Scenario } from '../types';
import ScenarioList from './ScenarioList';
import ScenarioEditor from './ScenarioEditor';

type View = { name: 'list' } | { name: 'editor'; scenario?: Scenario };

export default function App() {
  const [view, setView] = useState<View>({ name: 'list' });

  if (view.name === 'editor') {
    return (
      <ScenarioEditor
        initial={view.scenario}
        onSave={() => setView({ name: 'list' })}
        onCancel={() => setView({ name: 'list' })}
      />
    );
  }

  return (
    <ScenarioList
      onNew={() => setView({ name: 'editor' })}
      onEdit={(s) => setView({ name: 'editor', scenario: s })}
    />
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/popup/main.tsx src/popup/App.tsx src/popup/index.css
git commit -m "feat: popup entry point and app shell with list/editor routing"
```

---

## Task 7: Popup — Scenario List

**Files:**
- Create: `src/popup/ScenarioList.tsx`

- [ ] **Step 1: Create `src/popup/ScenarioList.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { Scenario, RunLog, StepLog, RuntimeMessage } from '../types';
import { getScenarios, deleteScenario, getLastRunLog } from '../storage';

interface Props {
  onNew: () => void;
  onEdit: (s: Scenario) => void;
}

type RunState = 'idle' | 'running' | 'success' | 'error';

interface RunStatus {
  state: RunState;
  currentStep?: number;
  log?: RunLog;
  error?: string;
}

export default function ScenarioList({ onNew, onEdit }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runStatuses, setRunStatuses] = useState<Record<string, RunStatus>>({});
  const [selectedLog, setSelectedLog] = useState<RunLog | null>(null);

  useEffect(() => {
    getScenarios().then(setScenarios);
  }, []);

  useEffect(() => {
    const handler = (message: RuntimeMessage) => {
      if (message.type === 'RUN_PROGRESS') {
        const { stepIndex, stepLog } = message;
        setRunStatuses((prev) => {
          const entry = Object.entries(prev).find(
            ([, v]) => v.state === 'running'
          );
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
                        (s: StepLog) => s.stepIndex !== stepIndex
                      ),
                      stepLog,
                    ],
                  }
                : undefined,
            },
          };
        });
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  async function handleRun(scenario: Scenario) {
    setRunStatuses((prev) => ({
      ...prev,
      [scenario.id]: { state: 'running', currentStep: 0 },
    }));

    const response = await chrome.runtime.sendMessage<RuntimeMessage, { ok: boolean; log?: RunLog; error?: string }>({
      type: 'RUN_SCENARIO',
      scenario,
    });

    if (response.ok && response.log) {
      setRunStatuses((prev) => ({
        ...prev,
        [scenario.id]: { state: 'success', log: response.log },
      }));
    } else {
      setRunStatuses((prev) => ({
        ...prev,
        [scenario.id]: { state: 'error', error: response.error },
      }));
    }
  }

  async function handleDelete(id: string) {
    await deleteScenario(id);
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleShowLog(scenario: Scenario) {
    const log = await getLastRunLog(scenario.id);
    setSelectedLog(log ?? null);
  }

  const stateColor: Record<RunState, string> = {
    idle: 'text-gray-400',
    running: 'text-blue-500',
    success: 'text-green-500',
    error: 'text-red-500',
  };

  return (
    <div className="w-[420px] min-h-[500px] bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h1 className="text-base font-semibold tracking-wide">Automation Runner</h1>
        <button
          onClick={onNew}
          className="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-white"
        >
          + New
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
        {scenarios.length === 0 && (
          <p className="text-sm text-gray-500 text-center mt-12">No scenarios yet. Create one!</p>
        )}
        {scenarios.map((s) => {
          const status = runStatuses[s.id] ?? { state: 'idle' };
          return (
            <div key={s.id} className="px-4 py-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-gray-500 truncate max-w-[200px]">{s.startUrl}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleRun(s)}
                    disabled={status.state === 'running'}
                    className="text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 px-2 py-1 rounded"
                  >
                    {status.state === 'running' ? `Step ${(status.currentStep ?? 0) + 1}…` : 'Run'}
                  </button>
                  <button
                    onClick={() => onEdit(s)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-xs bg-red-800 hover:bg-red-700 px-2 py-1 rounded"
                  >
                    Del
                  </button>
                </div>
              </div>
              {status.state !== 'idle' && (
                <p className={`text-xs ${stateColor[status.state]}`}>
                  {status.state === 'running' && `Running step ${(status.currentStep ?? 0) + 1} of ${s.steps.length}…`}
                  {status.state === 'success' && '✓ Completed successfully'}
                  {status.state === 'error' && `✗ Failed: ${status.error}`}
                </p>
              )}
              {(status.state === 'success' || status.state === 'error') && (
                <button
                  onClick={() => handleShowLog(s)}
                  className="text-xs text-blue-400 hover:underline self-start"
                >
                  View log
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Log Modal */}
      {selectedLog && (
        <div className="absolute inset-0 bg-gray-950/95 flex flex-col p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-sm">Run Log — {selectedLog.scenarioName}</h2>
            <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-white">✕</button>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            {new Date(selectedLog.startedAt).toLocaleString()} · {selectedLog.status}
          </p>
          <div className="space-y-1">
            {selectedLog.steps.map((sl) => (
              <div key={sl.stepIndex} className={`text-xs rounded px-2 py-1 ${sl.status === 'success' ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
                <span className="font-mono">Step {sl.stepIndex + 1} [{sl.type}]</span>
                {sl.error && <span className="ml-2 text-red-300">{sl.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/ScenarioList.tsx
git commit -m "feat: scenario list with run/edit/delete and live progress"
```

---

## Task 8: Popup — Scenario Editor

**Files:**
- Create: `src/popup/ScenarioEditor.tsx`

- [ ] **Step 1: Create `src/popup/ScenarioEditor.tsx`**

```tsx
import { useState } from 'react';
import type { Scenario, Step, StepType } from '../types';
import { saveScenario } from '../storage';

const STEP_TYPES: StepType[] = ['open_url', 'fill', 'click', 'select', 'wait', 'wait_for_element'];

function emptyStep(): Step {
  return { type: 'fill', selector: '', value: '' };
}

function newScenario(): Scenario {
  return {
    id: crypto.randomUUID(),
    name: '',
    startUrl: '',
    steps: [],
  };
}

interface Props {
  initial?: Scenario;
  onSave: () => void;
  onCancel: () => void;
}

export default function ScenarioEditor({ initial, onSave, onCancel }: Props) {
  const [scenario, setScenario] = useState<Scenario>(initial ?? newScenario());
  const [error, setError] = useState('');

  function updateField<K extends keyof Scenario>(key: K, value: Scenario[K]) {
    setScenario((prev) => ({ ...prev, [key]: value }));
  }

  function updateStep(index: number, partial: Partial<Step>) {
    setScenario((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], ...partial } as Step;
      return { ...prev, steps };
    });
  }

  function changeStepType(index: number, type: StepType) {
    const defaults: Record<StepType, Step> = {
      open_url: { type: 'open_url', url: '' },
      fill: { type: 'fill', selector: '', value: '' },
      click: { type: 'click', selector: '' },
      select: { type: 'select', selector: '', value: '' },
      wait: { type: 'wait', duration: 1000 },
      wait_for_element: { type: 'wait_for_element', selector: '', timeout: 10000 },
    };
    setScenario((prev) => {
      const steps = [...prev.steps];
      steps[index] = defaults[type];
      return { ...prev, steps };
    });
  }

  function addStep() {
    setScenario((prev) => ({ ...prev, steps: [...prev.steps, emptyStep()] }));
  }

  function removeStep(index: number) {
    setScenario((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setScenario((prev) => {
      const steps = [...prev.steps];
      const target = index + direction;
      if (target < 0 || target >= steps.length) return prev;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...prev, steps };
    });
  }

  async function handleSave() {
    if (!scenario.name.trim()) {
      setError('Scenario name is required');
      return;
    }
    await saveScenario(scenario);
    onSave();
  }

  function stepFields(step: Step, index: number) {
    switch (step.type) {
      case 'open_url':
        return (
          <input
            className={inputCls}
            placeholder="URL"
            value={step.url}
            onChange={(e) => updateStep(index, { url: e.target.value })}
          />
        );
      case 'fill':
        return (
          <>
            <input className={inputCls} placeholder="CSS Selector" value={step.selector} onChange={(e) => updateStep(index, { selector: e.target.value })} />
            <input className={inputCls} placeholder="Value" value={step.value} onChange={(e) => updateStep(index, { value: e.target.value })} />
          </>
        );
      case 'click':
        return <input className={inputCls} placeholder="CSS Selector" value={step.selector} onChange={(e) => updateStep(index, { selector: e.target.value })} />;
      case 'select':
        return (
          <>
            <input className={inputCls} placeholder="CSS Selector" value={step.selector} onChange={(e) => updateStep(index, { selector: e.target.value })} />
            <input className={inputCls} placeholder="Option value" value={step.value} onChange={(e) => updateStep(index, { value: e.target.value })} />
          </>
        );
      case 'wait':
        return (
          <input
            className={inputCls}
            type="number"
            placeholder="Duration (ms)"
            value={step.duration}
            onChange={(e) => updateStep(index, { duration: Number(e.target.value) })}
          />
        );
      case 'wait_for_element':
        return (
          <>
            <input className={inputCls} placeholder="CSS Selector" value={step.selector} onChange={(e) => updateStep(index, { selector: e.target.value })} />
            <input
              className={inputCls}
              type="number"
              placeholder="Timeout (ms)"
              value={step.timeout}
              onChange={(e) => updateStep(index, { timeout: Number(e.target.value) })}
            />
          </>
        );
    }
  }

  const inputCls = 'bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 w-full focus:outline-none focus:border-blue-500';

  return (
    <div className="w-[420px] min-h-[500px] bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h1 className="text-base font-semibold">{initial ? 'Edit Scenario' : 'New Scenario'}</h1>
        <button onClick={onCancel} className="text-gray-400 hover:text-white text-sm">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Scenario meta */}
        <div className="space-y-2">
          <input
            className={inputCls}
            placeholder="Scenario name"
            value={scenario.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Start URL (optional — leave blank to use active tab)"
            value={scenario.startUrl}
            onChange={(e) => updateField('startUrl', e.target.value)}
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Steps */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Steps</p>
          {scenario.steps.map((step, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <select
                  className="bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-100 flex-shrink-0 focus:outline-none"
                  value={step.type}
                  onChange={(e) => changeStepType(i, e.target.value as StepType)}
                >
                  {STEP_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="flex gap-1 ml-auto">
                  <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="text-gray-500 hover:text-gray-200 disabled:opacity-30 text-xs px-1">↑</button>
                  <button onClick={() => moveStep(i, 1)} disabled={i === scenario.steps.length - 1} className="text-gray-500 hover:text-gray-200 disabled:opacity-30 text-xs px-1">↓</button>
                  <button onClick={() => removeStep(i)} className="text-red-500 hover:text-red-400 text-xs px-1">✕</button>
                </div>
              </div>
              {stepFields(step, i)}
            </div>
          ))}
          <button
            onClick={addStep}
            className="w-full text-xs border border-dashed border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-300 py-2 rounded"
          >
            + Add Step
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-white px-3 py-1.5">Cancel</button>
        <button onClick={handleSave} className="text-sm bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded text-white">Save</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/ScenarioEditor.tsx
git commit -m "feat: scenario editor with step CRUD, type switching, reordering"
```

---

## Task 9: Build & Load Extension

**Files:**
- No new files — verify build works and `dist/` is correct

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: `dist/` contains `popup.html`, `popup.js`, `background.js`, `content.js`, `manifest.json` (copy manually if not auto-copied), `popup.css`.

- [ ] **Step 2: Copy manifest to dist**

Vite doesn't auto-copy `manifest.json`. Add a copy plugin or do it manually:

```bash
cp manifest.json dist/manifest.json
```

To automate this for future builds, install `vite-plugin-static-copy`:
```bash
npm install -D vite-plugin-static-copy
```

Update `vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [{ src: 'manifest.json', dest: '.' }],
    }),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
```

- [ ] **Step 3: Rebuild**

```bash
npm run build
```

Expected: `dist/manifest.json` present.

- [ ] **Step 4: Load in Chrome**

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `dist/` folder
4. Verify extension appears without errors

- [ ] **Step 5: Smoke test — create and run a scenario**

1. Click extension icon
2. Click "+ New"
3. Enter name: "Test Login", start URL: `https://example.com`
4. Add a `wait` step with duration `2000`
5. Click Save
6. Click Run
7. Verify a new tab opens to `https://example.com` and closes after 2 seconds

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "chore: add vite-plugin-static-copy to copy manifest.json to dist"
```

---

## Task 10: Error UX Polish

**Files:**
- Modify: `src/popup/ScenarioList.tsx` (already handles error state inline — verify display)
- Modify: `src/background/runner.ts` (tab closed error)

- [ ] **Step 1: Handle tab closed in runner**

In `src/background/runner.ts`, add tab removal listener to detect tab closed mid-run. Insert before the step loop:

```ts
let tabClosed = false;
chrome.tabs.onRemoved.addListener((removedId) => {
  if (removedId === tabId) tabClosed = true;
});
```

Then at the top of the step loop body (before the `if (step.type === 'open_url')` check):

```ts
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
```

- [ ] **Step 2: Rebuild and verify error display**

```bash
npm run build && cp manifest.json dist/manifest.json
```

Reload extension, run a scenario, close the tab mid-run, verify popup shows "Tab was closed" error.

- [ ] **Step 3: Commit**

```bash
git add src/background/runner.ts
git commit -m "feat: detect tab closed during scenario execution and surface error"
```

---

## Task 11: Import / Export Scenarios

**Files:**
- Modify: `src/popup/ScenarioList.tsx`

- [ ] **Step 1: Add export button to ScenarioList**

At the bottom of the header row in `ScenarioList.tsx`, add export and import buttons alongside the existing "+ New" button:

```tsx
// Replace header buttons section:
<div className="flex gap-2">
  <label className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-white cursor-pointer">
    Import
    <input
      type="file"
      accept=".json"
      className="hidden"
      onChange={handleImport}
    />
  </label>
  <button
    onClick={handleExport}
    className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-white"
  >
    Export
  </button>
  <button
    onClick={onNew}
    className="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-white"
  >
    + New
  </button>
</div>
```

- [ ] **Step 2: Add handler functions in `ScenarioList.tsx`**

Add these functions inside the component, before the return:

```ts
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
  const imported = JSON.parse(text) as Scenario[];
  for (const s of imported) {
    await saveScenario(s);
  }
  const updated = await getScenarios();
  setScenarios(updated);
}
```

- [ ] **Step 3: Rebuild, reload extension, verify export downloads JSON and import re-loads it**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/popup/ScenarioList.tsx
git commit -m "feat: import/export scenarios as JSON"
```

---

## Self-Review Against Spec

| Spec requirement | Task |
|---|---|
| Open URL | Task 5 (runner) + Task 4 (content) |
| Fill input | Task 4 |
| Click element | Task 4 |
| Select dropdown | Task 4 |
| Wait | Task 4 |
| Wait for element | Task 4 |
| Save/load scenarios locally | Task 3 |
| Scenario CRUD | Tasks 3, 7, 8 |
| JSON config / schema | Task 2 (types) |
| Sequential runner + logs | Task 5 |
| Chrome popup UI | Tasks 6, 7, 8 |
| Error UX (step#, message, stop) | Tasks 5, 7, 10 |
| Import/export | Task 11 |
| Manifest MV3 | Task 1 |
| Selector not found / timeout errors | Task 4 |
| Tab closed error | Task 10 |
| Invalid config warning | Task 8 (name required) |
| Security warning | NOT IMPLEMENTED — add to Task 8 as a static banner |

**Fix: Add security warning banner in ScenarioEditor** — add to Step 1 of Task 8, at the top of the form area:

```tsx
<div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-2 text-xs text-yellow-400">
  ⚠ Do not store production credentials. Config is saved in plaintext locally.
</div>
```
