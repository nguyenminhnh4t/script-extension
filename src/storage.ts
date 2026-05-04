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
