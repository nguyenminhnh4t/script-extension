import type { Scenario, RunLog } from './types';

const SCENARIOS_KEY = 'scenarios';
const LOGS_KEY = 'runLogs';
const DRAFT_KEY = 'editorDraft';
const PICK_TARGET_KEY = 'pickTarget';

export interface PickTarget {
  stepIndex: number;
  selector: string;
}

export async function getPickTarget(): Promise<PickTarget | undefined> {
  const result = await chrome.storage.local.get(PICK_TARGET_KEY);
  return result[PICK_TARGET_KEY] as PickTarget | undefined;
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
  return result[DRAFT_KEY] as EditorDraft | undefined;
}

export async function saveDraft(draft: EditorDraft): Promise<void> {
  await chrome.storage.local.set({ [DRAFT_KEY]: draft });
}

export async function clearDraft(): Promise<void> {
  await chrome.storage.local.remove(DRAFT_KEY);
}

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
