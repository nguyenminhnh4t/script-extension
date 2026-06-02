import type { Scenario, ScenarioTab, RunLog, Step, StepLog, StepType } from './types';

const SCENARIOS_KEY = 'scenarios';
const LOGS_KEY = 'runLogs';
const DRAFT_KEY = 'editorDraft';
const PICK_TARGET_KEY = 'pickTarget';
const STEP_TYPES: StepType[] = ['open_url', 'fill', 'click', 'select', 'wait', 'wait_for_element', 'press'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeStep(value: unknown): Step | null {
  if (!isRecord(value) || !STEP_TYPES.includes(value.type as StepType)) return null;

  switch (value.type) {
    case 'open_url':
      return { type: 'open_url', url: stringValue(value.url) };
    case 'fill':
      return { type: 'fill', selector: stringValue(value.selector), value: stringValue(value.value) };
    case 'click':
      return { type: 'click', selector: stringValue(value.selector) };
    case 'select':
      return { type: 'select', selector: stringValue(value.selector), value: stringValue(value.value) };
    case 'wait':
      return { type: 'wait', duration: numberValue(value.duration, 1000) };
    case 'wait_for_element':
      return {
        type: 'wait_for_element',
        selector: stringValue(value.selector),
        timeout: numberValue(value.timeout, 10000),
      };
    case 'press':
      return { type: 'press', key: stringValue(value.key) };
  }
}

export function normalizeScenario(value: unknown): Scenario | null {
  if (!isRecord(value)) return null;

  const legacyWindowConfig = {
    openInNewWindow: booleanValue(value.openInNewWindow),
    windowScreenX: Math.round(numberValue(value.windowScreenX, 0)),
    windowScreenY: Math.round(numberValue(value.windowScreenY, 0)),
    windowWidth: Math.max(320, Math.round(numberValue(value.windowWidth, 1280))),
    windowHeight: Math.max(240, Math.round(numberValue(value.windowHeight, 800))),
  };
  const rawTabs = Array.isArray(value.tabs) ? value.tabs : null;
  const tabs = rawTabs
    ? rawTabs.map((tab) => normalizeScenarioTab(tab, legacyWindowConfig)).filter((tab): tab is ScenarioTab => tab !== null)
    : [normalizeScenarioTab({
        id: 'tab-1',
        name: 'Tab 1',
        startUrl: value.startUrl,
        steps: value.steps,
      }, legacyWindowConfig)].filter((tab): tab is ScenarioTab => tab !== null);

  return {
    id: stringValue(value.id, crypto.randomUUID()),
    name: stringValue(value.name, 'Untitled scenario'),
    tabs: tabs.length > 0 ? tabs : [{
      id: crypto.randomUUID(),
      name: 'Tab 1',
      startUrl: '',
      openInNewWindow: legacyWindowConfig.openInNewWindow,
      windowScreenX: legacyWindowConfig.windowScreenX,
      windowScreenY: legacyWindowConfig.windowScreenY,
      windowWidth: legacyWindowConfig.windowWidth,
      windowHeight: legacyWindowConfig.windowHeight,
      steps: [],
    }],
  };
}

function normalizeScenarioTab(
  value: unknown,
  fallbackWindowConfig = { openInNewWindow: false, windowScreenX: 0, windowScreenY: 0, windowWidth: 1280, windowHeight: 800 }
): ScenarioTab | null {
  if (!isRecord(value)) return null;
  const rawSteps = Array.isArray(value.steps) ? value.steps : [];
  return {
    id: stringValue(value.id, crypto.randomUUID()),
    name: stringValue(value.name, 'Tab'),
    startUrl: stringValue(value.startUrl),
    openInNewWindow: booleanValue(value.openInNewWindow, fallbackWindowConfig.openInNewWindow),
    ...(typeof value.windowTargetTabId === 'string' && value.windowTargetTabId ? { windowTargetTabId: value.windowTargetTabId } : {}),
    windowScreenX: Math.round(numberValue(value.windowScreenX, fallbackWindowConfig.windowScreenX)),
    windowScreenY: Math.round(numberValue(value.windowScreenY, fallbackWindowConfig.windowScreenY)),
    windowWidth: Math.max(320, Math.round(numberValue(value.windowWidth, fallbackWindowConfig.windowWidth))),
    windowHeight: Math.max(240, Math.round(numberValue(value.windowHeight, fallbackWindowConfig.windowHeight))),
    steps: rawSteps.map(normalizeStep).filter((step): step is Step => step !== null),
  };
}

function normalizeStepLog(value: unknown): StepLog | null {
  if (!isRecord(value) || !STEP_TYPES.includes(value.type as StepType)) return null;
  const status = value.status === 'success' || value.status === 'error' || value.status === 'pending'
    ? value.status
    : 'error';
  return {
    tabIndex: numberValue(value.tabIndex, 0),
    tabName: stringValue(value.tabName, 'Tab 1'),
    stepIndex: numberValue(value.stepIndex, 0),
    type: value.type as StepType,
    status,
    ...(typeof value.error === 'string' ? { error: value.error } : {}),
  };
}

function normalizeRunLog(value: unknown): RunLog | null {
  if (!isRecord(value)) return null;
  const rawSteps = Array.isArray(value.steps) ? value.steps : [];
  const rawCleanupTabIds = Array.isArray(value.cleanupTabIds) ? value.cleanupTabIds : [];
  return {
    scenarioId: stringValue(value.scenarioId),
    scenarioName: stringValue(value.scenarioName, 'Untitled scenario'),
    startedAt: stringValue(value.startedAt),
    endedAt: stringValue(value.endedAt),
    status: value.status === 'success' ? 'success' : 'error',
    steps: rawSteps.map(normalizeStepLog).filter((step): step is StepLog => step !== null),
    cleanupTabIds: rawCleanupTabIds.filter((id): id is number => typeof id === 'number' && Number.isInteger(id)),
  };
}

export interface PickTarget {
  tabIndex: number;
  stepIndex: number;
  selector: string;
}

export async function getPickTarget(): Promise<PickTarget | undefined> {
  const result = await chrome.storage.local.get(PICK_TARGET_KEY);
  const target = result[PICK_TARGET_KEY];
  if (!isRecord(target)) return undefined;
  return {
    tabIndex: numberValue(target.tabIndex, 0),
    stepIndex: numberValue(target.stepIndex, 0),
    selector: stringValue(target.selector),
  };
}

export async function savePickTarget(target: PickTarget): Promise<void> {
  await chrome.storage.local.set({ [PICK_TARGET_KEY]: target });
}

export async function clearPickTarget(): Promise<void> {
  await chrome.storage.local.remove(PICK_TARGET_KEY);
}

export interface EditorDraft {
  scenario: Scenario;
  /** id of the scenario being edited, undefined for new */
  editingId?: string;
}

export async function getDraft(): Promise<EditorDraft | undefined> {
  const result = await chrome.storage.local.get(DRAFT_KEY);
  const draft = result[DRAFT_KEY];
  if (!isRecord(draft)) return undefined;
  const scenario = normalizeScenario(draft.scenario);
  if (!scenario) return undefined;
  return {
    scenario,
    ...(typeof draft.editingId === 'string' ? { editingId: draft.editingId } : {}),
  };
}

export async function saveDraft(draft: EditorDraft): Promise<void> {
  const scenario = normalizeScenario(draft.scenario);
  if (!scenario) return;
  await chrome.storage.local.set({ [DRAFT_KEY]: { ...draft, scenario } });
}

export async function clearDraft(): Promise<void> {
  await chrome.storage.local.remove(DRAFT_KEY);
}

export async function getScenarios(): Promise<Scenario[]> {
  const result = await chrome.storage.local.get(SCENARIOS_KEY);
  const scenarios = result[SCENARIOS_KEY];
  if (!Array.isArray(scenarios)) return [];
  return scenarios.map(normalizeScenario).filter((scenario): scenario is Scenario => scenario !== null);
}

export async function saveScenario(scenario: Scenario): Promise<void> {
  const normalized = normalizeScenario(scenario);
  if (!normalized) throw new Error('Invalid scenario');
  const scenarios = await getScenarios();
  const idx = scenarios.findIndex((s) => s.id === normalized.id);
  if (idx >= 0) {
    scenarios[idx] = normalized;
  } else {
    scenarios.push(normalized);
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
  const logs = result[LOGS_KEY];
  if (!Array.isArray(logs)) return [];
  return logs.map(normalizeRunLog).filter((log): log is RunLog => log !== null);
}

export async function saveRunLog(log: RunLog): Promise<void> {
  const normalized = normalizeRunLog(log);
  if (!normalized) return;
  const logs = await getRunLogs();
  logs.unshift(normalized);
  // Keep last 50 logs
  await chrome.storage.local.set({ [LOGS_KEY]: logs.slice(0, 50) });
}

export async function getLastRunLog(scenarioId: string): Promise<RunLog | undefined> {
  const logs = await getRunLogs();
  return logs.find((l) => l.scenarioId === scenarioId);
}
